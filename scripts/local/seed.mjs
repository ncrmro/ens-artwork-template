import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  http,
  namehash,
  keccak256,
  stringToHex,
  parseEther,
  zeroHash,
  bytesToHex,
} from "viem";
import { foundry } from "viem/chains";
import { CID } from "multiformats/cid";
export async function seed(env, root) {
  const contracts = JSON.parse(
    fs.readFileSync(root + "/src/generated/contracts.json"),
  );
  const defaults = JSON.parse(
    fs.readFileSync(root + "/src/demo-defaults.json"),
  );
  const config = JSON.parse(fs.readFileSync(root + "/artist.config.json"));
  const pc = createPublicClient({
    chain: foundry,
    pollingInterval: 100,
    transport: http("http://127.0.0.1:8545"),
  });
  const artist = env.namedAccounts.owner.address,
    gallery = env.namedAccounts.user.address,
    collector = env.namedAccounts.user2.address;
  const wc = (account) =>
    createWalletClient({
      account,
      chain: foundry,
      transport: http("http://127.0.0.1:8545"),
    });
  async function sent(hash) {
    const r = await pc.waitForTransactionReceipt({ hash: await hash });
    if (r.status !== "success") throw Error("Seed transaction reverted");
    return r;
  }
  async function deploy(who, kind, args) {
    return (await sent(wc(who).deployContract({ ...contracts[kind], args })))
      .contractAddress;
  }
  const write = (who, address, kind, functionName, args) =>
    sent(
      wc(who).writeContract({
        address,
        abi: contracts[kind].abi,
        functionName,
        args,
      }),
    );
  const read = (address, kind, functionName, args = []) =>
    pc.readContract({ address, abi: contracts[kind].abi, functionName, args });
  const ens = {
    ETHRegistry: env.v2.ETHRegistry.address,
    LabelStore: env.rocketh.get("LabelStore").address,
    UniversalResolver: env.v2.UniversalResolver.address,
  };
  const namespace = await deploy(artist, "ParticipantRegistry", [
    ens.LabelStore,
    ens.ETHRegistry,
    "eonmun",
    artist,
  ]);
  const artwork = await deploy(artist, "ArtworkRegistry", [
    ens.LabelStore,
    namespace,
    namehash("art.eonmun.eth"),
    artist,
  ]);
  await write(artist, namespace, "ParticipantRegistry", "attach", [
    "art",
    artwork,
  ]);
  await env.waitFor(
    env.v2.ETHRegistry.write.setSubregistry(
      [BigInt(keccak256(stringToHex("eonmun"))), namespace],
      { account: env.namedAccounts.owner },
    ),
  );
  const mandates = await deploy(artist, "MandateRegistry", [artwork]);
  const settlement = await deploy(artist, "SimpleSettlement", [mandates]);
  const galleryNamespace = await deploy(gallery, "ParticipantRegistry", [
    ens.LabelStore,
    ens.ETHRegistry,
    "atelier",
    gallery,
  ]);
  const galleryRegistry = await deploy(gallery, "GalleryRegistry", [
    ens.LabelStore,
    galleryNamespace,
    namehash("exhibitions.atelier.eth"),
    gallery,
  ]);
  await write(gallery, galleryNamespace, "ParticipantRegistry", "attach", [
    "exhibitions",
    galleryRegistry,
  ]);
  await env.waitFor(
    env.v2.ETHRegistry.write.setSubregistry(
      [BigInt(keccak256(stringToHex("atelier"))), galleryNamespace],
      { account: env.namedAccounts.user },
    ),
  );
  const contenthash = (uri) =>
    bytesToHex(new Uint8Array([0xe3, 1, ...CID.parse(uri.slice(7)).bytes]));
  const ids = [];
  for (const { label, title, manifest } of defaults.works) {
    await write(artist, artwork, "ArtworkRegistry", "issue", [
      {
        label,
        title,
        year: 2026,
        medium: "Oil on canvas",
        dimensions: "60 × 80 cm",
        imageURI: defaults.image,
        manifestURI: manifest,
        contenthash: contenthash(manifest),
        agreementURI: "",
        agreementHash: zeroHash,
        artist,
        royaltyRecipient: artist,
        royaltyBps: 500,
      },
    ]);
    ids.push(
      await read(artwork, "ArtworkRegistry", "getTokenId", [
        BigInt(keccak256(stringToHex(label))),
      ]),
    );
  }
  const expires = BigInt(Math.floor(Date.now() / 1000) + 365 * 86400);
  await write(artist, artwork, "ArtworkRegistry", "setApprovalForAll", [
    settlement,
    true,
  ]);
  await write(gallery, galleryRegistry, "GalleryRegistry", "createExhibition", [
    {
      label: "tokyo",
      title: "Between Earth & Ether",
      manifestURI: defaults.exhibition,
      contenthash: contenthash(defaults.exhibition),
      custodyStatement:
        "Demonstration statement only; no verified physical custody.",
    },
  ]);
  const showId = BigInt(keccak256(stringToHex("tokyo")));
  for (let i = 0; i < 2; i++) {
    await write(artist, mandates, "MandateRegistry", "create", [
      ids[i],
      gallery,
      parseEther("0.1"),
      1000,
      expires,
      273n,
    ]);
    await write(artist, galleryRegistry, "GalleryRegistry", "submit", [
      showId,
      mandates,
      BigInt(i + 1),
      settlement,
    ]);
  }
  await write(gallery, mandates, "MandateRegistry", "accept", [1n]);
  await write(gallery, galleryRegistry, "GalleryRegistry", "decide", [
    1n,
    true,
  ]);
  await write(gallery, settlement, "SimpleSettlement", "list", [
    1n,
    parseEther("0.1"),
  ]);
  await write(artist, settlement, "SimpleSettlement", "listDirect", [
    ids[2],
    parseEther("0.2"),
    expires,
  ]);
  const context = {
    parent: "eonmun.eth",
    namespace,
    artwork,
    mandates,
    settlement,
    galleryName: "atelier.eth",
    galleryNamespace,
    galleryRegistry,
  };
  fs.writeFileSync(
    root + "/.local/demo.json",
    JSON.stringify(
      {
        ...config,
        chainId: 31337,
        rpcUrl: "/api/rpc",
        ipfsGateway: "/ipfs/",
        ens,
        localDemo: {
          runId: randomUUID(),
          accounts: { artist, gallery, collector },
          context,
        },
      },
      null,
      2,
    ),
  );
}
