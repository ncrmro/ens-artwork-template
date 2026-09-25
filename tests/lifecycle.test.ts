import { test } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import "@nomicfoundation/hardhat-viem";
import {
  parseEther,
  namehash,
  keccak256,
  stringToHex,
  zeroHash,
  type Address,
  type Abi,
  type Hex,
} from "viem";
import artifacts from "../src/generated/contracts.json";
const contracts = artifacts as Record<string, { abi: Abi; bytecode: Hex }>;
const ipfs =
  "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const hash =
  "0xe3010170122029f2d17be6139079dc48696d1f582a8530eb9805b561eda517e22a892c7e3f1f";
const labelId = BigInt(keccak256(stringToHex("blue-mountain")));
async function fixture() {
  const conn = await network.connect("unit");
  const pc = await conn.viem.getPublicClient();
  const [artist, gallery, bob, carol] = await conn.viem.getWalletClients();
  const deploy = async (
    name: string,
    args: readonly unknown[] = [],
    signer = artist,
  ) => {
    const h = await signer.deployContract({ ...contracts[name], args });
    const r = await pc.waitForTransactionReceipt({ hash: h });
    assert.equal(r.status, "success");
    return r.contractAddress!;
  };
  const read = async (
    address: Address,
    name: string,
    fn: string,
    args: readonly unknown[] = [],
  ): Promise<any> =>
    pc.readContract({
      address,
      abi: contracts[name].abi,
      functionName: fn,
      args,
    });
  const write = async (
    signer: typeof artist,
    address: Address,
    name: string,
    fn: string,
    args: readonly unknown[] = [],
    value?: bigint,
  ) => {
    const h = await signer.writeContract({
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
  const store = await deploy("TestLabelStore");
  const root = await deploy("TestParent");
  const gRoot = await deploy("TestParent", [], gallery);
  const namespace = await deploy("ParticipantRegistry", [
    store,
    root,
    "eonmun",
    artist.account.address,
  ]);
  const artwork = await deploy("ArtworkRegistry", [
    store,
    namespace,
    namehash("art.eonmun.eth"),
    artist.account.address,
  ]);
  const mandates = await deploy("MandateRegistry", [artwork]);
  const settlement = await deploy("SimpleSettlement", [mandates]);
  const gNamespace = await deploy(
    "ParticipantRegistry",
    [store, gRoot, "gallery", gallery.account.address],
    gallery,
  );
  const galleryRegistry = await deploy(
    "GalleryRegistry",
    [
      store,
      gNamespace,
      namehash("exhibitions.gallery.eth"),
      gallery.account.address,
    ],
    gallery,
  );
  await write(artist, namespace, "ParticipantRegistry", "attach", [
    "art",
    artwork,
  ]);
  await write(artist, root, "TestParent", "setChild", [namespace]);
  await write(gallery, gNamespace, "ParticipantRegistry", "attach", [
    "exhibitions",
    galleryRegistry,
  ]);
  await write(gallery, gRoot, "TestParent", "setChild", [gNamespace]);
  const genesis = {
    label: "blue-mountain",
    title: "Blue Mountain",
    year: 2026,
    medium: "Acrylic and gold leaf on linen",
    dimensions: "48 x 116 inches",
    imageURI: ipfs,
    manifestURI: ipfs,
    contenthash: hash,
    agreementURI: "",
    agreementHash: zeroHash,
    artist: artist.account.address,
    royaltyRecipient: artist.account.address,
    royaltyBps: 500,
  };
  await write(artist, artwork, "ArtworkRegistry", "issue", [genesis]);
  const token = await read(artwork, "ArtworkRegistry", "getTokenId", [labelId]);
  const expiry = (await pc.getBlock()).timestamp + 3600n;
  const grant = async (
    signer = artist,
    roles = 273n,
    price = parseEther("1"),
    expires = expiry,
  ) => {
    await write(signer, mandates, "MandateRegistry", "create", [
      token,
      gallery.account.address,
      price,
      1000,
      expires,
      roles,
    ]);
    return (await read(mandates, "MandateRegistry", "count")) as bigint;
  };
  return {
    conn,
    pc,
    artist,
    gallery,
    bob,
    carol,
    read,
    write,
    artwork,
    mandates,
    settlement,
    galleryRegistry,
    namespace,
    root,
    token,
    genesis,
    expiry,
    grant,
  };
}
test("independent artist/gallery registries: immutable genesis, authority without ownership, exhibition, primary sale and resale", async () => {
  const f = await fixture();
  const {
    artist,
    gallery,
    bob,
    carol,
    read,
    write,
    artwork,
    mandates,
    settlement,
    galleryRegistry,
    token,
    genesis,
  } = f;
  await assert.rejects(() =>
    write(gallery, artwork, "ArtworkRegistry", "issue", [
      { ...genesis, label: "forged" },
    ]),
  );
  await assert.rejects(() =>
    write(artist, artwork, "ArtworkRegistry", "issue", [genesis]),
  );
  const resolver = await read(artwork, "ArtworkRegistry", "artworkResolver");
  assert.equal(
    await read(resolver, "ArtResolver", "contenthash", [
      namehash("blue-mountain.art.eonmun.eth"),
    ]),
    hash,
  );
  await assert.rejects(() =>
    write(artist, resolver, "ArtResolver", "publish", [
      namehash("blue-mountain.art.eonmun.eth"),
      hash,
      ipfs,
    ]),
  );
  await assert.rejects(() =>
    write(artist, artwork, "ArtworkRegistry", "setResolver", [
      token,
      artist.account.address,
    ]),
  );
  const id = await f.grant();
  assert.equal(
    await read(mandates, "MandateRegistry", "hasRoles", [
      id,
      273n,
      gallery.account.address,
    ]),
    true,
  );
  assert.equal(
    await read(mandates, "MandateRegistry", "active", [id, 257n]),
    false,
  );
  await assert.rejects(() =>
    write(gallery, settlement, "SimpleSettlement", "list", [
      id,
      parseEther("1"),
    ]),
  );
  await write(gallery, mandates, "MandateRegistry", "accept", [id]);
  await assert.rejects(() =>
    write(gallery, mandates, "MandateRegistry", "grantRoles", [
      id,
      1n,
      carol.account.address,
    ]),
  );
  await assert.rejects(() =>
    write(gallery, artwork, "ArtworkRegistry", "safeTransferFrom", [
      artist.account.address,
      gallery.account.address,
      token,
      1n,
      "0x",
    ]),
  );
  await assert.rejects(() =>
    write(gallery, settlement, "SimpleSettlement", "list", [
      id,
      parseEther("0.9"),
    ]),
  );
  await write(gallery, galleryRegistry, "GalleryRegistry", "publish", [
    {
      label: "tokyo-2026",
      title: "Tokyo 2026",
      manifestURI: ipfs,
      contenthash: hash,
      custodyStatement: "Gallery reports holding the physical artwork.",
    },
    mandates,
    id,
  ]);
  const e = await read(galleryRegistry, "GalleryRegistry", "exhibition", [
    BigInt(keccak256(stringToHex("tokyo-2026"))),
  ]);
  assert.equal(e.artwork.toLowerCase(), artwork.toLowerCase());
  assert.equal(e.issuer.toLowerCase(), gallery.account.address);
  await write(gallery, settlement, "SimpleSettlement", "list", [
    id,
    parseEther("1"),
  ]);
  assert.equal(
    (await read(artwork, "ArtworkRegistry", "ownerOf", [token])).toLowerCase(),
    artist.account.address,
  );
  await assert.rejects(() =>
    write(bob, settlement, "SimpleSettlement", "buy", [1n], parseEther("1")),
  ); // approval required
  await write(artist, artwork, "ArtworkRegistry", "setApprovalForAll", [
    settlement,
    true,
  ]);
  await assert.rejects(() =>
    write(
      gallery,
      settlement,
      "SimpleSettlement",
      "buy",
      [1n],
      parseEther("1"),
    ),
  );
  await write(
    bob,
    settlement,
    "SimpleSettlement",
    "buy",
    [1n],
    parseEther("1"),
  );
  assert.equal(
    (await read(artwork, "ArtworkRegistry", "ownerOf", [token])).toLowerCase(),
    bob.account.address,
  );
  assert.equal(
    await read(mandates, "MandateRegistry", "active", [id, 257n]),
    false,
  );
  assert.equal(
    await read(mandates, "MandateRegistry", "active", [id, 16n]),
    false,
  );
  assert.equal(
    await read(artwork, "ArtworkRegistry", "hasRoles", [
      token,
      1n << 156n,
      bob.account.address,
    ]),
    true,
  );
  assert.equal(
    await read(artwork, "ArtworkRegistry", "hasRoles", [
      token,
      1n << 156n,
      artist.account.address,
    ]),
    false,
  );
  await assert.rejects(() =>
    write(artist, artwork, "ArtworkRegistry", "setPresentation", [
      token,
      "New York",
      "",
    ]),
  );
  await write(bob, artwork, "ArtworkRegistry", "setPresentation", [
    token,
    "Tokyo",
    "https://example.org",
  ]);
  await assert.rejects(() =>
    write(bob, settlement, "SimpleSettlement", "buy", [1n], parseEther("1")),
  );
  const second = await f.grant(bob, 273n, parseEther("2"));
  await write(gallery, mandates, "MandateRegistry", "accept", [second]);
  await write(gallery, settlement, "SimpleSettlement", "list", [
    second,
    parseEther("2"),
  ]);
  await write(bob, artwork, "ArtworkRegistry", "setApprovalForAll", [
    settlement,
    true,
  ]);
  await write(
    carol,
    settlement,
    "SimpleSettlement",
    "buy",
    [2n],
    parseEther("2"),
  );
  assert.equal(
    await read(settlement, "SimpleSettlement", "proceeds", [
      artist.account.address,
    ]),
    parseEther("1"),
  ); // .9 primary + .1 royalty
  assert.equal(
    await read(settlement, "SimpleSettlement", "proceeds", [
      gallery.account.address,
    ]),
    parseEther(".3"),
  );
  assert.equal(
    await read(settlement, "SimpleSettlement", "proceeds", [
      bob.account.address,
    ]),
    parseEther("1.7"),
  );
  const after = await read(artwork, "ArtworkRegistry", "genesis", [token]);
  assert.equal(after.manifestURI, genesis.manifestURI);
  assert.equal(after.contenthash, hash);
  assert.equal(after.title, "Blue Mountain");
  assert.equal(
    (await read(artwork, "ArtworkRegistry", "ownerOf", [token])).toLowerCase(),
    carol.account.address,
  );
  await assert.rejects(() =>
    write(artist, artwork, "ArtworkRegistry", "safeTransferFrom", [
      carol.account.address,
      artist.account.address,
      token,
      1n,
      "0x",
    ]),
  );
  const balance = await f.pc.getBalance({ address: artist.account.address });
  const r = await write(artist, settlement, "SimpleSettlement", "withdraw");
  assert.equal(
    (await f.pc.getBalance({ address: artist.account.address })) +
      r.gasUsed * r.effectiveGasPrice -
      balance,
    parseEther("1"),
  );
  assert.equal(
    await read(settlement, "SimpleSettlement", "proceeds", [
      artist.account.address,
    ]),
    0n,
  );
});
test("mandate revocation, expiry, insufficient scope, parent unlink and ownership round trips invalidate authority", async () => {
  const f = await fixture();
  const {
    artist,
    gallery,
    bob,
    read,
    write,
    artwork,
    mandates,
    settlement,
    token,
  } = f;
  const id = await f.grant();
  await write(gallery, mandates, "MandateRegistry", "accept", [id]);
  await write(gallery, settlement, "SimpleSettlement", "list", [
    id,
    parseEther("1"),
  ]);
  await write(artist, artwork, "ArtworkRegistry", "setApprovalForAll", [
    settlement,
    true,
  ]);
  await write(artist, mandates, "MandateRegistry", "revoke", [id]);
  await assert.rejects(() =>
    write(bob, settlement, "SimpleSettlement", "buy", [1n], parseEther("1")),
  );
  const exhibitOnly = await f.grant(artist, 16n, 0n);
  await write(gallery, mandates, "MandateRegistry", "accept", [exhibitOnly]);
  assert.equal(
    await read(mandates, "MandateRegistry", "active", [exhibitOnly, 16n]),
    true,
  );
  await assert.rejects(() =>
    write(gallery, settlement, "SimpleSettlement", "list", [
      exhibitOnly,
      parseEther("1"),
    ]),
  );
  const second = await f.grant();
  await write(gallery, mandates, "MandateRegistry", "accept", [second]);
  await write(artist, artwork, "ArtworkRegistry", "safeTransferFrom", [
    artist.account.address,
    bob.account.address,
    token,
    1n,
    "0x",
  ]);
  await write(bob, artwork, "ArtworkRegistry", "safeTransferFrom", [
    bob.account.address,
    artist.account.address,
    token,
    1n,
    "0x",
  ]);
  assert.equal(
    await read(mandates, "MandateRegistry", "active", [second, 257n]),
    false,
  );
  const third = await f.grant();
  await write(gallery, mandates, "MandateRegistry", "accept", [third]);
  await write(artist, f.root, "TestParent", "setChild", [bob.account.address]);
  await assert.rejects(() =>
    write(gallery, settlement, "SimpleSettlement", "list", [
      third,
      parseEther("1"),
    ]),
  );
  await write(artist, f.root, "TestParent", "setChild", [f.namespace]);
  await write(gallery, settlement, "SimpleSettlement", "list", [
    third,
    parseEther("1"),
  ]);
  await f.conn.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [Number(f.expiry + 1n)],
  });
  await f.conn.provider.request({ method: "evm_mine", params: [] });
  assert.equal(
    await read(mandates, "MandateRegistry", "active", [third, 257n]),
    false,
  );
  await assert.rejects(() =>
    write(bob, settlement, "SimpleSettlement", "buy", [2n], parseEther("1")),
  );
});
