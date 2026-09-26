// Exercises the actual pinned ENSv2 devnet, preserving the visible demo with a snapshot.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { foundry } from "viem/chains";
const config = JSON.parse(fs.readFileSync(".local/demo.json"));
assert.equal(config.chainId, 31337);
const { context: c, accounts: a } = config.localDemo;
const artifacts = JSON.parse(fs.readFileSync("src/generated/contracts.json"));
const transport = http("http://127.0.0.1:8545");
const pc = createPublicClient({
  chain: foundry,
  transport,
  pollingInterval: 50,
});
assert.equal(await pc.getChainId(), 31337);
const read = (address, kind, functionName, args = []) =>
  pc.readContract({ address, abi: artifacts[kind].abi, functionName, args });
const evidence = [];
async function write(
  account,
  address,
  kind,
  functionName,
  args = [],
  value,
  expected = "success",
) {
  const w = createWalletClient({ account, chain: foundry, transport });
  // Explicit gas sends forbidden actions to the EVM so reverts have real receipts.
  const hash = await w.writeContract({
    address,
    abi: artifacts[kind].abi,
    functionName,
    args,
    value,
    gas: 3000000n,
  });
  const receipt = await pc.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, expected, functionName);
  evidence.push({ functionName, hash, status: receipt.status });
}
const snapshot = await pc.request({ method: "evm_snapshot" });
try {
  for (const t of config.localDemo.transactions)
    assert.equal(
      (await pc.getTransactionReceipt({ hash: t.hash })).status,
      "success",
    );
  const held = await read(c.artwork, "ArtworkRegistry", "recordId", [3n]);
  const token = await read(c.artwork, "ArtworkRegistry", "getTokenId", [held]);
  assert.equal(
    (
      await read(c.artwork, "ArtworkRegistry", "getOwner", [held])
    ).toLowerCase(),
    a.collector.toLowerCase(),
  );
  assert.equal(
    await read(c.artwork, "ArtworkRegistry", "saleAllowed", [held]),
    false,
  );
  const expiry = (await pc.getBlock()).timestamp + 365n * 86400n;
  assert.equal(
    await read(c.mandates, "MandateRegistry", "hasRoles", [
      1n,
      273n,
      a.gallery,
    ]),
    true,
  );
  assert.equal(
    await read(c.mandates, "MandateRegistry", "hasRoles", [
      1n,
      273n,
      a.collector,
    ]),
    false,
  );
  // The actual gallery cannot escalate its ENSv2 EnhancedAccessControl roles.
  await write(
    a.gallery,
    c.mandates,
    "MandateRegistry",
    "grantRoles",
    [1n, 273n, a.collector],
    undefined,
    "reverted",
  );
  await write(
    a.collector,
    c.artwork,
    "ArtworkRegistry",
    "safeTransferFrom",
    [a.collector, a.artist, token, 1n, "0x"],
    undefined,
    "reverted",
  );
  await write(
    a.collector,
    c.artwork,
    "ArtworkRegistry",
    "safeBatchTransferFrom",
    [a.collector, a.artist, [token], [1n], "0x"],
    undefined,
    "reverted",
  );
  await write(
    a.collector,
    c.settlement,
    "SimpleSettlement",
    "listDirect",
    [token, parseEther("0.3"), expiry],
    undefined,
    "reverted",
  );
  // A loan is permitted while resale is held, and it does not change the owner.
  await write(a.collector, c.mandates, "MandateRegistry", "create", [
    token,
    a.gallery,
    parseEther("0.3"),
    1000,
    expiry,
    273n,
  ]);
  const mandate = await read(c.mandates, "MandateRegistry", "count");
  await write(a.gallery, c.mandates, "MandateRegistry", "accept", [mandate]);
  assert.equal(
    await read(c.mandates, "MandateRegistry", "active", [mandate, 16n]),
    true,
  );
  await write(
    a.gallery,
    c.settlement,
    "SimpleSettlement",
    "list",
    [mandate, parseEther("0.3")],
    undefined,
    "reverted",
  );
  const unlock = await read(c.artwork, "ArtworkRegistry", "resaleAllowedAt", [
    held,
  ]);
  await pc.request({
    method: "evm_setNextBlockTimestamp",
    params: [Number(unlock)],
  });
  await pc.request({ method: "evm_mine" });
  await write(a.gallery, c.settlement, "SimpleSettlement", "list", [
    mandate,
    parseEther("0.3"),
  ]);
  const listing = await read(c.settlement, "SimpleSettlement", "count");
  await write(a.collector, c.artwork, "ArtworkRegistry", "setApprovalForAll", [
    c.settlement,
    true,
  ]);
  const before = await read(c.settlement, "SimpleSettlement", "proceeds", [
    a.artist,
  ]);
  await write(
    a.artist,
    c.settlement,
    "SimpleSettlement",
    "buy",
    [listing],
    parseEther("0.3"),
  );
  assert.equal(
    (await read(c.settlement, "SimpleSettlement", "proceeds", [a.artist])) -
      before,
    parseEther("0.015"),
  );
  assert.equal(
    await read(c.mandates, "MandateRegistry", "active", [mandate, 273n]),
    false,
  );
  assert.ok(
    (await read(c.artwork, "ArtworkRegistry", "resaleAllowedAt", [held])) >
      unlock,
  );
  // Revocation removes the original gallery's scoped ENSv2 roles.
  await write(a.artist, c.mandates, "MandateRegistry", "revoke", [1n]);
  assert.equal(
    await read(c.mandates, "MandateRegistry", "hasRoles", [
      1n,
      273n,
      a.gallery,
    ]),
    false,
  );
  fs.mkdirSync("output", { recursive: true });
  fs.writeFileSync(
    "output/local-policy-proof.json",
    JSON.stringify(
      {
        chainId: 31337,
        runId: config.localDemo.runId,
        snapshotRevertedAfterVerification: true,
        evidence,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS actual ENSv2 devnet: mint receipts, scoped gallery roles, forbidden escalation, held single/batch transfers, blocked direct/gallery sale, valid exhibition loan during hold, permitted gallery resale after 180 days, 5% royalty, ownership invalidation and revocation.",
  );
} finally {
  await pc.request({ method: "evm_revert", params: [snapshot] });
}
