import fs from "node:fs";
import assert from "node:assert/strict";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  zeroAddress,
  zeroHash,
  keccak256,
  stringToHex,
  namehash,
} from "viem";
import { contenthash } from "./assets.mjs";
import { foundry } from "viem/chains";
import { namedCatalogue, knownNames } from "../../src/named-catalogue.js";
import { runAdminSeed } from "../../src/admin-seed.js";
const config = JSON.parse(fs.readFileSync(".local/demo.json"));
const sources = JSON.parse(fs.readFileSync("src/artwork-sources.json"));
const catalogue = namedCatalogue(
  ["davinci.eth", "vangogh.eth", "louvre.eth"],
  sources,
);
const contracts = JSON.parse(fs.readFileSync("src/generated/contracts.json"));
const assets = JSON.parse(fs.readFileSync("src/named-assets.json"));
const rpc = "http://127.0.0.1:8545";
const pc = createPublicClient({
  chain: foundry,
  transport: http(rpc),
  pollingInterval: 50,
});
assert.equal(await pc.getChainId(), 31337);
const snapshot = await pc.request({ method: "evm_snapshot" });
try {
  const accounts = await pc.request({ method: "eth_accounts" });
  const owner = accounts[1];
  const registrar = createWalletClient({
    chain: foundry,
    account: accounts[0],
    transport: http(rpc),
  });
  const w = createWalletClient({
    chain: foundry,
    account: owner,
    transport: http(rpc),
  });
  // The injected browser provider exposes one selected account, not all Anvil accounts.
  w.getAddresses = async () => [owner];
  for (const label of [
    "ncrmro",
    "davinci",
    "vangogh",
    "louvre",
    "mfah",
    "uffizi",
  ]) {
    const h = await registrar.writeContract({
      address: config.ens.ETHRegistry,
      abi: parseAbi([
        "function register(string,address,address,address,uint256,uint64) returns(uint256)",
      ]),
      functionName: "register",
      args: [
        label,
        owner,
        zeroAddress,
        zeroAddress,
        1n << 20n,
        (await pc.getBlock()).timestamp + 86400n * 365n,
      ],
    });
    assert.equal(
      (await pc.waitForTransactionReceipt({ hash: h })).status,
      "success",
    );
  }
  const parents = Object.fromEntries(
    catalogue.participants.map((p) => [p.id, p.parent]),
  );
  const store = {};
  let updates = 0;
  const opts = {
    pc,
    w,
    account: owner,
    config,
    catalogue,
    contracts,
    assets,
    parents,
    load: (k) => store[k],
    save: (k, v) => {
      store[k] = structuredClone(v);
    },
    status: () => {
      updates++;
    },
  };
  // Reproduce the user's empty, admin-owned older artist namespace.
  const deployOld = async (kind, args) => {
    const h = await w.deployContract({ ...contracts[kind], args });
    const r = await pc.waitForTransactionReceipt({ hash: h });
    assert.equal(r.status, "success");
    return r.contractAddress;
  };
  const oldNamespace = await deployOld("ParticipantRegistry", [
    config.ens.LabelStore,
    config.ens.ETHRegistry,
    "davinci",
    owner,
  ]);
  const oldArt = await deployOld("ArtworkRegistry", [
    config.ens.LabelStore,
    oldNamespace,
    namehash("art.davinci.eth"),
    owner,
  ]);
  for (const options of [
    {
      address: oldNamespace,
      abi: contracts.ParticipantRegistry.abi,
      functionName: "attach",
      args: ["art", oldArt],
    },
    {
      address: config.ens.ETHRegistry,
      abi: parseAbi(["function setSubregistry(uint256,address)"]),
      functionName: "setSubregistry",
      args: [BigInt(keccak256(stringToHex("davinci"))), oldNamespace],
    },
  ]) {
    const h = await w.writeContract(options);
    assert.equal(
      (await pc.waitForTransactionReceipt({ hash: h })).status,
      "success",
    );
  }
  const emptyState = await pc.request({ method: "evm_snapshot" });
  const example = Object.values(assets.works)[0];
  const mint = await w.writeContract({
    address: oldArt,
    abi: contracts.ArtworkRegistry.abi,
    functionName: "issueDated",
    args: [
      {
        label: "existing-work",
        title: "Existing owner record",
        year: 2026,
        medium: "Test",
        dimensions: "",
        imageURI: example.image,
        manifestURI: example.manifest,
        contenthash: contenthash(example.manifest),
        agreementURI: "",
        agreementHash: zeroHash,
        artist: owner,
        royaltyRecipient: owner,
        royaltyBps: 500,
      },
      1767225600n,
    ],
  });
  assert.equal(
    (await pc.waitForTransactionReceipt({ hash: mint })).status,
    "success",
  );
  await assert.rejects(
    () => runAdminSeed({ ...opts, checkOnly: true }),
    /populated or incompatible registry/,
  );
  await pc.request({ method: "evm_revert", params: [emptyState] });
  const block = await pc.getBlockNumber({ cacheTime: 0 });
  await runAdminSeed({ ...opts, checkOnly: true });
  assert.equal(
    await pc.getBlockNumber({ cacheTime: 0 }),
    block,
    "preflight sends no writes",
  );
  const impostor = createWalletClient({
    chain: foundry,
    account: accounts[2],
    transport: http(rpc),
  });
  impostor.getAddresses = async () => [accounts[2]];
  await assert.rejects(
    () => runAdminSeed({ ...opts, w: impostor, account: accounts[2] }),
    /Only the current ncrmro.eth owner/,
  );
  let sends = 0;
  const realWrite = w.writeContract.bind(w);
  w.writeContract = async (options) => {
    if (++sends === 9) throw Error("User rejected request");
    return realWrite(options);
  };
  await assert.rejects(() => runAdminSeed(opts), /User rejected/);
  assert.ok(store.bootstrap.transactions["namespace.link"]);
  w.writeContract = realWrite;
  const result = await runAdminSeed(opts);
  assert.equal(result.index.namespaces.length, 3);
  const confirmed = store.catalogue.transactions;
  const mintBlocks = catalogue.works.map(
    (work) => confirmed["mint." + work.id].blockNumber,
  );
  const lastMint = Math.max(...mintBlocks);
  for (const participant of catalogue.participants) {
    const following =
      participant.kind === "gallery"
        ? ["ParticipantRegistry", "GalleryRegistry"]
        : ["MandateRegistry", "SimpleSettlement", "approve"];
    for (const step of following) {
      assert.ok(
        confirmed[participant.id + "." + step].blockNumber > lastMint,
        participant.id + "." + step + " must follow artwork issuance",
      );
    }
  }

  assert.equal(
    store.bootstrap.previousRegistries["davinci.eth"].toLowerCase(),
    oldNamespace.toLowerCase(),
  );
  const after = await pc.getBlockNumber({ cacheTime: 0 });
  await runAdminSeed(opts);
  assert.equal(
    await pc.getBlockNumber({ cacheTime: 0 }),
    after,
    "resume sends no duplicate transactions",
  );
  const namespace = store.bootstrap.deployments.namespace;
  const index = JSON.parse(
    await pc.readContract({
      address: namespace,
      abi: contracts.DemoNamespace.abi,
      functionName: "catalogue",
    }),
  );
  assert.equal(index.namespaces.length, 3);
  for (const p of index.namespaces) {
    assert.notEqual(p.wallet.toLowerCase(), owner.toLowerCase());
    assert.equal(
      (
        await pc.readContract({
          address: p.wallet,
          abi: contracts.DemoAccount.abi,
          functionName: "admin",
        })
      ).toLowerCase(),
      owner.toLowerCase(),
    );
  }
  const unauthorizedIndex = await impostor.writeContract({
    address: namespace,
    abi: contracts.DemoNamespace.abi,
    functionName: "publishCatalogue",
    args: ["{}"],
  });
  assert.equal(
    (await pc.waitForTransactionReceipt({ hash: unauthorizedIndex })).status,
    "reverted",
  );
  const unauthorizedActor = await impostor.writeContract({
    address: index.namespaces[0].wallet,
    abi: contracts.DemoAccount.abi,
    functionName: "execute",
    args: [namespace, "0x"],
  });
  assert.equal(
    (await pc.waitForTransactionReceipt({ hash: unauthorizedActor })).status,
    "reverted",
  );
  assert.equal(
    JSON.parse(
      await pc.readContract({
        address: namespace,
        abi: contracts.DemoNamespace.abi,
        functionName: "catalogue",
      }),
    ).namespaces.length,
    3,
  );
  const expanded = namedCatalogue(
    ["davinci.eth", "vangogh.eth", "louvre.eth", "mfah.eth", "uffizi.eth"],
    sources,
  );
  const bigger = {
    ...opts,
    catalogue: expanded,
    parents: Object.fromEntries(
      expanded.participants.map((p) => [p.id, p.parent]),
    ),
  };
  const growth = await runAdminSeed(bigger);
  assert.equal(growth.index.namespaces.length, 5);
  assert.equal(
    JSON.parse(
      await pc.readContract({
        address: namespace,
        abi: contracts.DemoNamespace.abi,
        functionName: "catalogue",
      }),
    ).namespaces.length,
    5,
  );
  const expandedBlock = await pc.getBlockNumber({ cacheTime: 0 });
  await runAdminSeed(bigger);
  assert.equal(await pc.getBlockNumber({ cacheTime: 0 }), expandedBlock);
  w.getAddresses = async () => [accounts[2]];
  await assert.rejects(() => runAdminSeed(opts), /Wallet account changed/);
  console.log(
    "PASS: admin ownership gating, preflight without writes, rejected-signature recovery, incremental discovery including MFAH and Uffizi, distinct contract actors, real minting/exhibitions/history, on-chain public index, no duplicate writes on resume, unauthorized contract calls rejected, wallet change stops writes.",
  );
  console.log(
    JSON.stringify({
      catalogueTransactions: result.transactions,
      bootstrapTransactions: Object.keys(store.bootstrap.transactions).length,
      network: "official local ENSv2 devnet; snapshot restored",
    }),
  );
} finally {
  await pc.request({ method: "evm_revert", params: [snapshot] });
}
