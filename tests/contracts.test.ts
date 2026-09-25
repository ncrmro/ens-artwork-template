import { test } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import "@nomicfoundation/hardhat-viem";
import {
  parseEther,
  keccak256,
  stringToHex,
  namehash,
  encodeFunctionData,
  decodeFunctionResult,
  parseAbi,
  type Abi,
  type Hex,
  type Address,
} from "viem";
import { toHex } from "viem";
import artifacts from "../src/generated/contracts.json";
const contracts = artifacts as Record<string, { abi: Abi; bytecode: Hex }>;
const hash =
  "0xe3010170122029f2d17be6139079dc48696d1f582a8530eb9805b561eda517e22a892c7e3f1f";
const metadata =
  "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
async function fixture() {
  const conn = await network.connect("unit");
  const pc = await conn.viem.getPublicClient();
  const [artist, a, b] = await conn.viem.getWalletClients();
  async function deploy(name: string, args: readonly unknown[] = []) {
    const h = await artist.deployContract({ ...contracts[name], args });
    const r = await pc.waitForTransactionReceipt({ hash: h });
    assert.ok(r.contractAddress);
    return r.contractAddress;
  }
  const store = await deploy("TestLabelStore"),
    parent = await deploy("TestParent");
  const registry = await deploy("ArtRegistry", [
    store,
    parent,
    "eonmoon",
    artist.account.address,
  ]);
  const sale = await deploy("ArtSale", [registry]);
  const write = async (
    w: typeof artist,
    address: Address,
    name: string,
    fn: string,
    args: readonly unknown[] = [],
    value?: bigint,
  ) => {
    const h = await w.writeContract({
      address,
      abi: contracts[name].abi,
      functionName: fn,
      args,
      value,
    });
    const r = await pc.waitForTransactionReceipt({ hash: h });
    assert.equal(r.status, "success");
    return r;
  };
  const read = async (
    address: Address,
    name: string,
    fn: string,
    args: readonly unknown[] = [],
  ) =>
    pc.readContract({
      address,
      abi: contracts[name].abi,
      functionName: fn,
      args,
    });
  await write(artist, parent, "TestParent", "setChild", [registry]);
  await write(artist, registry, "ArtRegistry", "publish", [
    "artwork1",
    "Lunar Study",
    metadata,
    hash,
    artist.account.address,
    750,
  ]);
  const id = (await read(registry, "ArtRegistry", "findTokenId", [
    "artwork1",
  ])) as bigint;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 604800);
  return {
    conn,
    pc,
    artist,
    a,
    b,
    registry,
    sale,
    parent,
    write,
    read,
    id,
    deadline,
    deploy,
  };
}
test("primary purchase, resale, exact royalty withdrawal, IPFS record and metadata persist", async () => {
  const f = await fixture();
  const { artist, a, b, registry, sale, write, read, id, deadline } = f;
  try {
    await write(artist, registry, "ArtRegistry", "setApprovalForAll", [
      sale,
      true,
    ]);
    await write(artist, sale, "ArtSale", "list", [
      id,
      parseEther("1"),
      deadline,
    ]);
    await assert.rejects(
      write(a, sale, "ArtSale", "buy", [id, 1n], parseEther(".9")),
    );
    await write(a, sale, "ArtSale", "buy", [id, 1n], parseEther("1"));
    assert.equal(
      (
        (await read(registry, "ArtRegistry", "ownerOf", [id])) as string
      ).toLowerCase(),
      a.account.address.toLowerCase(),
    );
    assert.equal(
      await read(sale, "ArtSale", "proceeds", [artist.account.address]),
      parseEther("1"),
    );
    await assert.rejects(
      write(b, sale, "ArtSale", "buy", [id, 1n], parseEther("1")),
    );
    await write(a, registry, "ArtRegistry", "setApprovalForAll", [sale, true]);
    await write(a, sale, "ArtSale", "list", [id, parseEther("1"), deadline]);
    await write(b, sale, "ArtSale", "buy", [id, 2n], parseEther("1"));
    assert.equal(
      await read(sale, "ArtSale", "proceeds", [artist.account.address]),
      parseEther("1.075"),
    );
    assert.equal(
      await read(sale, "ArtSale", "proceeds", [a.account.address]),
      parseEther(".925"),
    );
    await write(artist, sale, "ArtSale", "withdraw");
    await write(a, sale, "ArtSale", "withdraw");
    assert.equal(
      await read(sale, "ArtSale", "proceeds", [artist.account.address]),
      0n,
    );
    assert.equal(
      await read(sale, "ArtSale", "proceeds", [a.account.address]),
      0n,
    );
    const resolver = (await read(
      registry,
      "ArtRegistry",
      "artResolver",
    )) as Address;
    assert.equal(
      await read(resolver, "ArtResolver", "contenthash", [
        namehash("artwork1.eonmoon.eth"),
      ]),
      hash,
    );
    assert.equal(await read(registry, "ArtRegistry", "uri", [id]), metadata);
    const dns = toHex(
      new Uint8Array([
        8,
        ...Buffer.from("artwork1"),
        7,
        ...Buffer.from("eonmoon"),
        3,
        ...Buffer.from("eth"),
        0,
      ]),
    );
    const abi = parseAbi([
      "function contenthash(bytes32 node) view returns(bytes)",
    ]);
    const data = encodeFunctionData({
      abi,
      functionName: "contenthash",
      args: [namehash("artwork1.eonmoon.eth")],
    });
    const resolved = (await read(resolver, "ArtResolver", "resolve", [
      dns,
      data,
    ])) as Hex;
    assert.equal(
      decodeFunctionResult({
        abi,
        functionName: "contenthash",
        data: resolved,
      }),
      hash,
    );
  } finally {
    await f.conn.close();
  }
});
test("unauthorized publishing, record edits, resolver replacement, stale listing, cancellation, expired parent", async () => {
  const f = await fixture();
  const { artist, a, b, registry, sale, parent, write, read, id, deadline } = f;
  try {
    await assert.rejects(
      write(a, registry, "ArtRegistry", "publish", [
        "artwork2",
        "X",
        metadata,
        hash,
        a.account.address,
        0,
      ]),
    );
    await assert.rejects(
      write(artist, registry, "ArtRegistry", "publish", [
        "artwork1",
        "X",
        metadata,
        hash,
        artist.account.address,
        750,
      ]),
    );
    await assert.rejects(
      write(artist, registry, "ArtRegistry", "setResolver", [
        id,
        a.account.address,
      ]),
    );
    const resolver = (await read(
      registry,
      "ArtRegistry",
      "artResolver",
    )) as Address;
    await assert.rejects(
      write(artist, resolver, "ArtResolver", "publish", [
        namehash("artwork1.eonmoon.eth"),
        hash,
        metadata,
      ]),
    );
    await write(artist, registry, "ArtRegistry", "setApprovalForAll", [
      sale,
      true,
    ]);
    await write(artist, sale, "ArtSale", "list", [id, 1n, deadline]);
    await assert.rejects(write(a, sale, "ArtSale", "cancel", [id]));
    await write(artist, sale, "ArtSale", "cancel", [id]);
    await assert.rejects(write(a, sale, "ArtSale", "buy", [id, 1n], 1n));
    await write(artist, sale, "ArtSale", "list", [id, 1n, deadline]);
    await assert.rejects(write(b, sale, "ArtSale", "buy", [id, 1n], 1n));
    await write(artist, parent, "TestParent", "setExpiry", [1]);
    await assert.rejects(write(a, sale, "ArtSale", "buy", [id, 2n], 1n));
    await write(artist, sale, "ArtSale", "cancel", [id]); // expiry never traps escrow
  } finally {
    await f.conn.close();
  }
});
test("mutable token IDs retain records and royalties; boundary royalties; independent EVM example", async () => {
  const f = await fixture();
  const { artist, a, registry, write, read, id, deploy } = f;
  try {
    const role = 1n << 28n;
    await write(artist, registry, "ArtRegistry", "grantRoles", [
      id,
      role,
      a.account.address,
    ]);
    const next = (await read(registry, "ArtRegistry", "findTokenId", [
      "artwork1",
    ])) as bigint;
    assert.notEqual(next, id);
    assert.equal(await read(registry, "ArtRegistry", "uri", [next]), metadata);
    const royalty = (await read(registry, "ArtRegistry", "royaltyInfo", [
      next,
      10000n,
    ])) as [Address, bigint];
    assert.equal(royalty[1], 750n);
    for (const bps of [0, 10000]) {
      const label = "boundary" + bps;
      await write(artist, registry, "ArtRegistry", "publish", [
        label,
        label,
        metadata,
        hash,
        artist.account.address,
        bps,
      ]);
      const token = await read(registry, "ArtRegistry", "findTokenId", [label]);
      assert.equal(
        (
          (await read(registry, "ArtRegistry", "royaltyInfo", [
            token,
            10000n,
          ])) as [Address, bigint]
        )[1],
        BigInt(bps),
      );
    }
    await assert.rejects(
      write(artist, registry, "ArtRegistry", "publish", [
        "bad",
        "X",
        metadata,
        hash,
        artist.account.address,
        10001,
      ]),
    );
    const ex = await deploy("EvmExample");
    await write(a, ex, "EvmExample", "save", ["hello Sepolia"]);
    assert.equal(
      await read(ex, "EvmExample", "messages", [a.account.address]),
      "hello Sepolia",
    );
    assert.equal(
      await read(ex, "EvmExample", "messages", [artist.account.address]),
      "",
    );
  } finally {
    await f.conn.close();
  }
});
