import { artworkLabel } from "./artwork-label.js";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  zeroAddress,
  zeroHash,
  keccak256,
  stringToHex,
  namehash,
  parseEther,
  parseAbi,
} from "viem";
import { sepolia, foundry } from "viem/chains";
import { CID } from "multiformats/cid";
import { bytesToHex } from "viem";
const contenthash = (uri) =>
  bytesToHex(new Uint8Array([0xe3, 1, ...CID.parse(uri.slice(7)).bytes]));
const rootABI = parseAbi([
  "function getSubregistry(string) view returns(address)",
  "function findExpiry(string) view returns(uint64)",
  "function getResource(uint256) view returns(uint256)",
  "function hasRoles(uint256,uint256,address) view returns(bool)",
  "function setSubregistry(uint256,address)",
]);
const eq = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const hashLabel = (s) => BigInt(keccak256(stringToHex(s)));
export async function seedCatalogue({
  plan,
  config,
  catalogue,
  contracts,
  rpcUrl,
  signerUrl,
  apply = false,
  allowLocal = false,
  adapter,
}) {
  if (plan.chainId !== 11155111 && !(allowLocal && plan.chainId === 31337))
    throw Error("Only Sepolia is allowed (local validation requires --local).");
  const chain = plan.chainId === 31337 ? foundry : sepolia;
  const pc =
    adapter?.pc ||
    createPublicClient({
      chain,
      transport: http(rpcUrl),
      pollingInterval: plan.chainId === 31337 ? 50 : 2000,
    });
  if ((await pc.getChainId()) !== plan.chainId)
    throw Error("RPC chain mismatch");
  const read = (address, kind, functionName, args = []) =>
    pc.readContract({ address, abi: contracts[kind].abi, functionName, args });
  const rootRead = (functionName, args = []) =>
    adapter?.rootRead
      ? adapter.rootRead(functionName, args)
      : pc.readContract({
          address: config.ens.ETHRegistry,
          abi: rootABI,
          functionName,
          args,
        });
  const participants = catalogue.participants.map((p) => ({
    ...p,
    ...plan.participants.find((x) => x.id === p.id),
  }));
  if (new Set(participants.map((p) => p.parent)).size !== participants.length)
    throw Error("Participants require distinct ENS parent names.");
  const issues = [];
  const now = Number((await pc.getBlock()).timestamp);
  const date = (s) => {
    const n = Date.parse(s + "T00:00:00Z") / 1000;
    if (!Number.isInteger(n) || n <= 0 || n > now)
      throw Error("Historical date must be past or present: " + s);
    return BigInt(n);
  };
  for (const p of participants) date(p.establishedAt);
  for (const w of catalogue.works) date(w.createdAt);
  for (const s of catalogue.shows) date(s.occurredAt);
  for (const h of catalogue.history) date(h.date);
  for (const p of participants) {
    if (
      !(adapter?.validParent
        ? adapter.validParent(p.parent)
        : /^[a-z0-9]+(?:-[a-z0-9]+)*\.eth$/.test(p.parent))
    )
      issues.push(p.id + ": invalid ENS parent");
    if (!isAddress(p.wallet || "") || eq(p.wallet, zeroAddress)) {
      issues.push(p.id + ": configure a signing wallet address");
      continue;
    }
    try {
      const label = p.parent.split(".")[0];
      if (
        Number(await rootRead("findExpiry", [label])) <=
        Number((await pc.getBlock()).timestamp)
      )
        issues.push(p.id + ": ENS name missing or expired: " + p.parent);
      const resource = await rootRead("getResource", [hashLabel(label)]);
      if (
        !(await rootRead("hasRoles", [
          resource,
          1n << 20n,
          p.controller || p.wallet,
        ]))
      )
        issues.push(p.id + ": wallet lacks ENS subregistry permission");
      if ((await pc.getBalance({ address: p.controller || p.wallet })) === 0n)
        issues.push(p.id + ": wallet needs test ETH");
    } catch {
      issues.push(p.id + ": cannot verify configured ENSv2 name");
    }
  }
  for (const s of catalogue.shows) {
    const g = participants.find((p) => p.name === s.gallery);
    for (const id of s.works) {
      const w = catalogue.works.find((w) => w.id === id);
      const a = participants.find((p) => p.name === w?.artist);
      if (!a || !g) issues.push("Unknown artist/gallery in " + s.id);
      else if (eq(a.wallet, g.wallet))
        issues.push(s.id + ": artist and gallery must use independent wallets");
    }
  }
  if (!apply) {
    return {
      chainId: plan.chainId,
      participants: participants.map(({ id, parent, wallet }) => ({
        id,
        parent,
        wallet,
      })),
      artworks: catalogue.works.length,
      exhibitions: catalogue.shows.length,
      issues,
    };
  }
  if (issues.length) throw Error("Preflight failed:\n" + issues.join("\n"));
  if (!adapter && !signerUrl)
    throw Error(
      "Set SEED_SIGNER_RPC_URL to an external wallet signer; no keys are accepted by this script.",
    );
  if (!adapter) throw Error("A seed adapter is required");
  await adapter.authorize(participants);
  const fingerprint = keccak256(
    stringToHex(
      JSON.stringify({
        chainId: plan.chainId,
        ens: config.ens,

        contracts,
      }),
    ),
  );
  let journal = {
    fingerprint,
    chainId: plan.chainId,
    transactions: {},
    deployments: {},
  };
  const saved = await adapter.loadJournal();
  if (saved) {
    journal = saved;
    if (journal.fingerprint !== fingerprint)
      throw Error(
        "Seed plan, chain, data or contract artifacts changed. Resume the original plan; do not overwrite existing namespaces.",
      );
  }
  journal.pins ||= {};
  const pin = (key, value) => {
    const digest = keccak256(stringToHex(JSON.stringify(value)));
    if (journal.pins[key] && journal.pins[key] !== digest)
      throw Error("Existing seeded record changed: " + key);
    journal.pins[key] = digest;
  };
  for (const p of participants) pin("participant:" + p.id, p);
  for (const w of catalogue.works) pin("work:" + w.id, w);
  for (const s of catalogue.shows)
    pin("show:" + s.id, { ...s, works: undefined });
  const persist = () => adapter.saveJournal(journal);
  persist();
  const wc = (p) => adapter.wallet(p);
  // Save hashes before waiting: a restart resumes receipts instead of resending confirmed writes.
  async function tx(key, send) {
    let h = journal.transactions[key]?.hash;
    if (!h) {
      await adapter.beforeSend?.(key);
      h = await send();
      journal.transactions[key] = { hash: h };
      persist();
    }
    let r = await pc.waitForTransactionReceipt({ hash: h, timeout: 180000 });
    r = adapter.receipt ? adapter.receipt(r, key) : r;
    if (r.status !== "success") throw Error(key + " reverted: " + h);
    journal.transactions[key] = {
      hash: h,
      blockNumber: Number(r.blockNumber),
      contractAddress: r.contractAddress,
      status: r.status,
    };
    persist();
    return r;
  }
  async function deploy(p, kind, args) {
    const k = p.id + "." + kind;
    if (!journal.deployments[k]) {
      const r = await tx(k, () =>
        wc(p).deployContract({ ...contracts[kind], args }),
      );
      journal.deployments[k] = r.contractAddress;
      persist();
    }
    const address = journal.deployments[k];
    if (!(await pc.getCode({ address })))
      throw Error("Missing deployed code " + k);
    return address;
  }
  const write = (key, p, address, kind, functionName, args = []) =>
    tx(key, () =>
      wc(p).writeContract({
        address,
        abi: contracts[kind].abi,
        functionName,
        args,
      }),
    );
  const assets = await adapter.assets();
  for (const w of catalogue.works) pin("media:" + w.id, assets.works[w.id]);
  for (const s of catalogue.shows) pin("manifest:" + s.id, assets.shows[s.id]);
  persist();
  // Preflight existing namespaces before any deployments. Never replace a user's linked registry.
  for (const p of participants) {
    const linked = await rootRead("getSubregistry", [p.parent.split(".")[0]]);
    const known = journal.deployments[p.id + ".ParticipantRegistry"];
    if (linked !== zeroAddress && !eq(linked, known))
      throw Error(
        p.parent +
          " already has a different subregistry. Choose a fresh name; it will not be replaced.",
      );
  }
  async function mintArtwork(w, a) {
    const media = assets.works[w.id];
    await write(
      "mint." + w.id,
      a,
      a.registry,
      "ArtworkRegistry",
      "issueDated",
      [
        {
          label: w.id,
          title: artworkLabel(w.title),
          year: Number(w.createdAt.slice(0, 4)),
          medium: w.medium,
          dimensions: w.dimensions,
          imageURI: media.image,
          manifestURI: media.manifest,
          contenthash: contenthash(media.manifest),
          agreementURI: "",
          agreementHash: zeroHash,
          artist: a.wallet,
          royaltyRecipient: a.wallet,
          royaltyBps: 500,
        },
        date(w.createdAt),
      ],
    );
  }
  // Complete each artist's issuance before configuring galleries or sales.
  const issuanceFirst = [
    ...participants.filter((p) => p.kind === "artist"),
    ...participants.filter((p) => p.kind !== "artist"),
  ];
  for (const p of issuanceFirst) {
    p.namespace = await deploy(p, "ParticipantRegistry", [
      config.ens.LabelStore,
      adapter.parentRegistry
        ? adapter.parentRegistry(p)
        : config.ens.ETHRegistry,
      p.parent.split(".")[0],
      p.wallet,
    ]);
    const child = p.kind === "artist" ? "art" : "exhibitions";
    const kind = p.kind === "artist" ? "ArtworkRegistry" : "GalleryRegistry";
    p.registry = await deploy(p, kind, [
      config.ens.LabelStore,
      p.namespace,
      namehash(child + "." + p.parent),
      p.wallet,
    ]);
    const linked = await read(
      p.namespace,
      "ParticipantRegistry",
      "getSubregistry",
      [child],
    );
    if (linked === zeroAddress)
      await write(
        p.id + ".attach",
        p,
        p.namespace,
        "ParticipantRegistry",
        "attach",
        [child, p.registry],
      );
    else if (!eq(linked, p.registry))
      throw Error("Unexpected child registry for " + p.id);
    if (
      (await rootRead("getSubregistry", [p.parent.split(".")[0]])) ===
      zeroAddress
    )
      await tx(p.id + ".link", () =>
        (adapter.rootWallet ? adapter.rootWallet(p) : wc(p)).writeContract({
          address: config.ens.ETHRegistry,
          abi: rootABI,
          functionName: "setSubregistry",
          args: [hashLabel(p.parent.split(".")[0]), p.namespace],
        }),
      );
    if (p.kind === "gallery")
      await write(
        p.id + ".established",
        p,
        p.registry,
        "GalleryRegistry",
        "recordEstablishment",
        [date(p.establishedAt)],
      );
    if (p.kind === "artist") {
      for (const work of catalogue.works.filter((w) => w.artist === p.name)) {
        await mintArtwork(work, p);
      }
    }
  }
  // Sales and loans are optional infrastructure after the artwork exists.
  for (const p of participants) {
    if (p.kind === "artist") {
      p.mandates = await deploy(p, "MandateRegistry", [p.registry]);
      p.settlement = await deploy(p, "SimpleSettlement", [p.mandates]);
      await write(
        p.id + ".approve",
        p,
        p.registry,
        "ArtworkRegistry",
        "setApprovalForAll",
        [p.settlement, true],
      );
    }
  }
  for (const s of catalogue.shows) {
    const g = participants.find((p) => p.name === s.gallery);
    const manifest = assets.shows[s.id].manifest;
    await write(
      "show." + s.id,
      g,
      g.registry,
      "GalleryRegistry",
      "createExhibitionDated",
      [
        {
          label: s.id,
          title: s.title,
          manifestURI: manifest,
          contenthash: contenthash(manifest),
          custodyStatement:
            s.description +
            " Testnet example; no verified physical custody. Historical dates are gallery-reported.",
        },
        date(s.occurredAt),
      ],
    );
    for (const workId of s.works) {
      const w = catalogue.works.find((w) => w.id === workId);
      const a = participants.find((p) => p.name === w.artist);
      const token = await read(a.registry, "ArtworkRegistry", "getTokenId", [
        hashLabel(workId),
      ]);
      const k = "loan." + s.id + "." + workId;
      const expires = (await pc.getBlock()).timestamp + 365n * 86400n;
      const r = await write(k, a, a.mandates, "MandateRegistry", "create", [
        token,
        g.wallet,
        parseEther(w.price),
        1000,
        expires,
        s.status === "current" ? 273n : 16n,
      ]);
      const { decodeEventLog } = await import("viem");
      const event = (receipt, eventName, kind) =>
        receipt.logs
          .filter((l) =>
            eq(l.address, kind === "MandateRegistry" ? a.mandates : g.registry),
          )
          .map((l) => {
            try {
              return decodeEventLog({
                abi: contracts[kind].abi,
                data: l.data,
                topics: l.topics,
              });
            } catch {
              return null;
            }
          })
          .find((x) => x?.eventName === eventName);
      const mandateId = event(r, "MandateCreated", "MandateRegistry")?.args.id;
      if (!mandateId) throw Error("Missing mandate event");
      await write(k + ".accept", g, a.mandates, "MandateRegistry", "accept", [
        mandateId,
      ]);
      const sub = await write(
        k + ".submit",
        a,
        g.registry,
        "GalleryRegistry",
        "submit",
        [hashLabel(s.id), a.mandates, mandateId, a.settlement],
      );
      const submissionId = event(sub, "ArtworkSubmitted", "GalleryRegistry")
        ?.args.submissionId;
      if (!submissionId) throw Error("Missing submission event");
      await write(k + ".decide", g, g.registry, "GalleryRegistry", "decide", [
        submissionId,
        true,
      ]);
      if (s.status === "current")
        await write(k + ".list", g, a.settlement, "SimpleSettlement", "list", [
          mandateId,
          parseEther(w.price),
        ]);
    }
  }
  for (const w of catalogue.works.filter((w) => w.owner === w.artist)) {
    const a = participants.find((p) => p.name === w.artist);
    const token = await read(a.registry, "ArtworkRegistry", "getTokenId", [
      hashLabel(w.id),
    ]);
    await write(
      "direct." + w.id,
      a,
      a.settlement,
      "SimpleSettlement",
      "listDirect",
      [
        token,
        parseEther(w.price),
        (await pc.getBlock()).timestamp + 365n * 86400n,
      ],
    );
  }
  for (const h of catalogue.history) {
    const i = keccak256(stringToHex(JSON.stringify(h)));
    const w = catalogue.works.find((w) => w.id === h.workId);
    const a = participants.find((p) => p.name === w.artist);
    const kind = h.title.startsWith("Purchased") ? 3 : h.showId ? 2 : 1;
    await write(
      "history." + i,
      a,
      a.registry,
      "ArtworkRegistry",
      "recordHistory",
      [
        hashLabel(w.id),
        {
          referenceId: keccak256(stringToHex("catalogue-v1:" + i)),
          kind,
          occurredAt: date(h.date),
          title: artworkLabel(h.title),
          detail: h.detail,
        },
      ],
    );
  }
  // Publish only actual, resolved registries and verified receipt evidence.
  const namespaces = [];
  for (const p of participants) {
    if (
      !eq(
        await rootRead("getSubregistry", [p.parent.split(".")[0]]),
        p.namespace,
      )
    )
      throw Error("ENS root readback failed");
    const child = p.kind === "artist" ? "art" : "exhibitions";
    if (
      !eq(
        await read(p.namespace, "ParticipantRegistry", "getSubregistry", [
          child,
        ]),
        p.registry,
      )
    )
      throw Error("ENS child readback failed");
    const expected =
      p.kind === "artist"
        ? catalogue.works.filter((w) => w.artist === p.name).length
        : catalogue.shows.filter((s) => s.gallery === p.name).length;
    if (
      Number(
        await read(
          p.registry,
          p.kind === "artist" ? "ArtworkRegistry" : "GalleryRegistry",
          "recordCount",
        ),
      ) !== expected
    )
      throw Error("Seed record count mismatch");
    namespaces.push({
      name: child + "." + p.parent,
      displayName: artworkLabel(p.name),
      wallet: p.wallet,
      registry: p.registry,
      settlement: p.settlement || "",
    });
  }
  const index = { chainId: plan.chainId, namespaces };
  await adapter.publishIndex(index);
  return {
    chainId: plan.chainId,
    index,
    transactions: Object.keys(journal.transactions).length,
    journal: plan.journal,
  };
}
