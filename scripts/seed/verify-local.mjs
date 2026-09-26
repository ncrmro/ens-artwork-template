import fs from "node:fs";
import assert from "node:assert/strict";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  zeroAddress,
  keccak256,
  stringToHex,
} from "viem";
import { foundry } from "viem/chains";
import { seedCatalogue } from "./run.mjs";
const config = JSON.parse(fs.readFileSync(".local/demo.json"));
const catalogue = JSON.parse(fs.readFileSync("src/demo-catalogue.json"));
const contracts = JSON.parse(fs.readFileSync("src/generated/contracts.json"));
const rpcUrl = "http://127.0.0.1:8545";
const pc = createPublicClient({
  chain: foundry,
  transport: http(rpcUrl),
  pollingInterval: 50,
});
assert.equal(await pc.getChainId(), 31337);
const snapshot = await pc.request({ method: "evm_snapshot" });
const accounts = await pc.request({ method: "eth_accounts" });
const root = createWalletClient({
  account: accounts[0],
  chain: foundry,
  transport: http(rpcUrl),
});
const keep = process.argv.includes("--keep");
const prefixArg = process.argv.indexOf("--prefix");
const prefix =
  prefixArg >= 0
    ? process.argv[prefixArg + 1]
    : keep
      ? "catalogue"
      : "verify-catalogue";
assert.match(prefix, /^[a-z][a-z0-9-]*$/, "Use a valid namespace prefix");
const directory = `.local/${prefix}`;
fs.mkdirSync(directory, { recursive: true });
const plan = {
  chainId: 31337,
  participants: catalogue.participants.map((p, i) => ({
    id: p.id,
    parent: prefix + "-" + p.id + ".eth",
    wallet: accounts[i],
  })),
  journal: directory + "/journal.json",
  indexOutput: directory + "/index.json",
};
if (!keep) fs.rmSync(plan.journal, { force: true });
try {
  for (const p of plan.participants) {
    const expiry = await pc.readContract({
      address: config.ens.ETHRegistry,
      abi: parseAbi(["function findExpiry(string) view returns(uint64)"]),
      functionName: "findExpiry",
      args: [p.parent.split(".")[0]],
    });
    if (expiry > 0n) continue;
    const hash = await root.writeContract({
      address: config.ens.ETHRegistry,
      abi: parseAbi([
        "function register(string,address,address,address,uint256,uint64) returns(uint256)",
      ]),
      functionName: "register",
      args: [
        p.parent.split(".")[0],
        p.wallet,
        zeroAddress,
        zeroAddress,
        1n << 20n,
        (await pc.getBlock()).timestamp + 365n * 86400n,
      ],
    });
    assert.equal(
      (await pc.waitForTransactionReceipt({ hash })).status,
      "success",
    );
  }
  const options = {
    plan,
    config,
    catalogue,
    contracts,
    rpcUrl,
    signerUrl: rpcUrl,
    apply: true,
    allowLocal: true,
  };
  const first = await seedCatalogue(options);
  const block = await pc.getBlockNumber({ cacheTime: 0 });
  const second = await seedCatalogue(options);
  assert.equal(
    await pc.getBlockNumber({ cacheTime: 0 }),
    block,
    "Resume must not send duplicate transactions",
  );
  assert.equal(first.transactions, second.transactions);
  assert.equal(first.index.namespaces.length, 4);
  for (const n of first.index.namespaces.filter((n) =>
    n.name.startsWith("art."),
  )) {
    const works = catalogue.works.filter((w) => w.artist === n.displayName);
    for (const w of works) {
      const id = BigInt(keccak256(stringToHex(w.id)));
      const read = (functionName, args) =>
        pc.readContract({
          address: n.registry,
          abi: contracts.ArtworkRegistry.abi,
          functionName,
          args,
        });
      assert.equal(
        await read("createdAt", [id]),
        BigInt(Date.parse(w.createdAt + "T00:00:00Z") / 1000),
      );
      assert.equal(
        Number(await read("historyCount", [id])),
        catalogue.history.filter((h) => h.workId === w.id).length,
      );
    }
  }
  if (keep) {
    config.localDemo.catalogueIndex = first.index.namespaces;
    fs.writeFileSync(".local/demo.json", JSON.stringify(config, null, 2));
  }
  console.log(
    "PASS: official ENSv2 devnet; four independent namespaces, five dated artworks, three dated exhibitions, gallery submissions, accepted mandates, listings, attributed history; second run sends zero transactions.",
  );
  console.log(
    JSON.stringify({
      transactions: first.transactions,
      proof: keep
        ? "Persistent local chain 31337, not Sepolia receipts"
        : "local chain 31337; snapshot restored, not Sepolia receipts",
    }),
  );
} finally {
  if (!keep) await pc.request({ method: "evm_revert", params: [snapshot] });
}
