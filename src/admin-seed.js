import { repairEonmunMediaPins } from "./eonmun-import.js";
import {
  encodeDeployData,
  encodeFunctionData,
  decodeEventLog,
  keccak256,
  stringToHex,
  zeroAddress,
  parseAbi,
} from "viem";
import { seedCatalogue } from "./seed-engine.js";
const eq = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const hash = (s) => BigInt(keccak256(stringToHex(s)));
const rootAbi = parseAbi([
  "function findOwner(string) view returns(address)",
  "function findExpiry(string) view returns(uint64)",
  "function getResource(uint256) view returns(uint256)",
  "function hasRoles(uint256,uint256,address) view returns(bool)",
  "function getSubregistry(string) view returns(address)",
  "function setSubregistry(uint256,address)",
]);
export async function emptyOwnedParticipant(pc, address, account, contracts) {
  try {
    const owner = await pc.readContract({
      address,
      abi: contracts.ParticipantRegistry.abi,
      functionName: "participant",
    });
    if (!eq(owner, account)) return false;
    for (const label of ["art", "exhibitions"]) {
      const child = await pc.readContract({
        address,
        abi: rootAbi,
        functionName: "getSubregistry",
        args: [label],
      });
      if (
        child !== zeroAddress &&
        Number(
          await pc.readContract({
            address: child,
            abi: contracts[
              label === "art" ? "ArtworkRegistry" : "GalleryRegistry"
            ].abi,
            functionName: "recordCount",
          }),
        ) !== 0
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
export async function runAdminSeed({
  pc,
  w,
  account,
  config,
  catalogue,
  contracts,
  assets,
  parents,
  load,
  save,
  status,
  checkOnly = false,
}) {
  const root = config.ens.ETHRegistry;
  const read = (address, abi, functionName, args = []) =>
    pc.readContract({ address, abi, functionName, args });
  async function guard() {
    if (
      (await pc.getChainId()) !== config.chainId ||
      (await w.getChainId()) !== config.chainId
    )
      throw Error("Wallet network changed. Switch back before resuming.");
    if (![11155111, 31337].includes(config.chainId))
      throw Error("Unsupported seed network");
    const accounts = await w.getAddresses();
    if (!eq(accounts[0], account))
      throw Error("Wallet account changed. Reconnect ncrmro.eth to resume.");
    const owner = await read(root, rootAbi, "findOwner", ["ncrmro"]);
    const expiry = await read(root, rootAbi, "findExpiry", ["ncrmro"]);
    if (!eq(owner, account) || expiry <= (await pc.getBlock()).timestamp)
      throw Error("Only the current ncrmro.eth owner can seed.");
  }
  await guard();
  const fingerprint = keccak256(
    stringToHex(
      JSON.stringify({
        account: account.toLowerCase(),
        chain: config.chainId,
        root,

        contracts,
      }),
    ),
  );
  let boot = load("bootstrap") || {
    fingerprint,
    transactions: {},
    deployments: {},
  };
  if (boot.fingerprint !== fingerprint)
    throw Error(
      "This browser has a different saved seed plan. Restore the original selections or import the matching checkpoint.",
    );
  boot.parents ||= {};
  for (const [id, name] of Object.entries(parents)) {
    if (boot.parents[id] && boot.parents[id] !== name)
      throw Error("Existing participant name changed: " + id);
    boot.parents[id] = name;
  }
  const persist = () => save("bootstrap", boot);
  async function tx(key, send) {
    await guard();
    status(key);
    let h = boot.transactions[key];
    if (!h) {
      h = await send();
      boot.transactions[key] = h;
      persist();
    }
    const r = await pc.waitForTransactionReceipt({ hash: h, timeout: 180000 });
    if (r.status !== "success") throw Error(key + " reverted: " + h);
    return r;
  }
  async function deploy(key, kind, args) {
    if (!boot.deployments[key]) {
      const r = await tx(key, () =>
        w.deployContract({ account, ...contracts[kind], args }),
      );
      boot.deployments[key] = r.contractAddress;
      persist();
    }
    if (!(await pc.getCode({ address: boot.deployments[key] })))
      throw Error("Missing deployment. Check the network and checkpoint.");
    return boot.deployments[key];
  }
  const linked = await read(root, rootAbi, "getSubregistry", ["ncrmro"]);
  if (linked !== zeroAddress && !eq(linked, boot.deployments.namespace))
    throw Error(
      "ncrmro.eth already links a different registry. It will not be replaced. Import this seed's checkpoint to resume.",
    );
  const emptyReplacements = new Map();
  const parentNames = catalogue.participants.map((p) => parents[p.id]);
  if (
    new Set(parentNames.map((n) => n?.split(".")[0])).size !==
    catalogue.participants.length
  )
    throw Error("Choose distinct participant labels.");
  const permission = async (label) => {
    const expiry = await read(root, rootAbi, "findExpiry", [label]);
    const resource = await read(root, rootAbi, "getResource", [hash(label)]);
    if (
      expiry <= (await pc.getBlock()).timestamp ||
      !(await read(root, rootAbi, "hasRoles", [resource, 1n << 20n, account]))
    )
      throw Error(
        label + ".eth is missing, expired or not controlled by this wallet.",
      );
  };
  await permission("ncrmro");
  for (const p of catalogue.participants) {
    const name = parents[p.id];
    if (
      name !== p.id + ".ncrmro.eth" &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*\.eth$/.test(name)
    )
      throw Error("Use an owned .eth name or the default demo subdomain.");
    if (name === "ncrmro.eth")
      throw Error("ncrmro.eth is reserved for the demo index.");
    if (!name.endsWith(".ncrmro.eth")) {
      await permission(name.split(".")[0]);
      const existing = await read(root, rootAbi, "getSubregistry", [
        name.split(".")[0],
      ]);
      const known =
        load("catalogue")?.deployments?.[p.id + ".ParticipantRegistry"];
      if (existing !== zeroAddress && !eq(existing, known)) {
        if (await emptyOwnedParticipant(pc, existing, account, contracts)) {
          emptyReplacements.set(name, existing);
          continue;
        }
        throw Error(
          name +
            " already has a populated or incompatible registry. It will not be replaced.",
        );
      }
    }
  }
  if ((await pc.getBalance({ address: account })) === 0n)
    throw Error("The connected wallet needs test ETH.");
  if (checkOnly) return { ready: true, parents };
  const namespace = await deploy("namespace", "DemoNamespace", [
    config.ens.LabelStore,
    root,
    account,
  ]);
  if (linked === zeroAddress)
    await tx("namespace.link", () =>
      w.writeContract({
        account,
        address: root,
        abi: rootAbi,
        functionName: "setSubregistry",
        args: [hash("ncrmro"), namespace],
      }),
    );
  const participants = [];
  for (const p of catalogue.participants) {
    const actor = await deploy("actor." + p.id, "DemoAccount", [account]);
    participants.push({
      id: p.id,
      parent: parents[p.id],
      wallet: actor,
      controller: account,
    });
  }
  const nested = (p) => p.parent.endsWith(".ncrmro.eth");
  const parentRegistry = (p) => (nested(p) ? namespace : root);
  const byLabel = (label) =>
    participants.find((p) => p.parent.split(".")[0] === label);
  const adminWrite = async (options) => {
    const request = { ...options, account };
    await pc.simulateContract(request);
    return w.writeContract(request);
  };
  const actorWallet = (p) => ({
    deployContract: (options) =>
      adminWrite({
        address: p.wallet,
        abi: contracts.DemoAccount.abi,
        functionName: "deploy",
        args: [encodeDeployData(options)],
      }),
    writeContract: (options) =>
      adminWrite({
        address: p.wallet,
        abi: contracts.DemoAccount.abi,
        functionName: "execute",
        args: [options.address, encodeFunctionData(options)],
      }),
  });
  const result = await seedCatalogue({
    plan: {
      chainId: config.chainId,
      participants,
      journal: "browser checkpoint",
      indexOutput: "ncrmro.eth catalogue",
    },
    config,
    catalogue,
    contracts,
    apply: true,
    allowLocal: config.chainId === 31337,
    adapter: {
      pc,
      authorize: guard,
      validParent: (n) => parentNames.includes(n),
      parentRegistry,
      async rootRead(fn, args) {
        if (fn === "hasRoles") {
          const p = participants.find(
            (p) => hash(p.parent.split(".")[0]) === args[0],
          );
          const label = nested(p) ? "ncrmro" : p.parent.split(".")[0];
          const resource = await read(root, rootAbi, "getResource", [
            hash(label),
          ]);
          return read(root, rootAbi, "hasRoles", [resource, args[1], args[2]]);
        }
        if (fn === "getResource") return args[0];
        const p = byLabel(args[0]);
        if (fn === "findExpiry")
          return read(root, rootAbi, fn, [nested(p) ? "ncrmro" : args[0]]);
        const value = await read(parentRegistry(p), rootAbi, fn, args);
        if (
          fn === "getSubregistry" &&
          eq(value, emptyReplacements.get(p.parent))
        )
          return zeroAddress;
        return value;
      },
      wallet: actorWallet,
      rootWallet: (p) => ({
        writeContract: async (options) => {
          if (nested(p))
            return adminWrite({
              address: namespace,
              abi: contracts.DemoNamespace.abi,
              functionName: "attachParticipant",
              args: [p.parent.split(".")[0], p.wallet, options.args[1]],
            });
          const replacing = emptyReplacements.get(p.parent);
          if (replacing) {
            const current = await read(root, rootAbi, "getSubregistry", [
              p.parent.split(".")[0],
            ]);
            if (
              !eq(current, replacing) ||
              !(await emptyOwnedParticipant(pc, replacing, account, contracts))
            )
              throw Error(
                "Existing registry changed or is no longer empty; stopped before relinking.",
              );
            boot.previousRegistries ||= {};
            boot.previousRegistries[p.parent] = replacing;
            persist();
          }
          return adminWrite(options);
        },
      }),
      loadJournal: () => repairEonmunMediaPins(load("catalogue")),
      saveJournal: (j) => save("catalogue", j),
      assets: () => assets,
      beforeSend: async (key) => {
        await guard();
        status(key);
      },
      receipt: (r) => {
        for (const l of r.logs) {
          if (!participants.some((p) => eq(p.wallet, l.address))) continue;
          try {
            const e = decodeEventLog({
              abi: contracts.DemoAccount.abi,
              data: l.data,
              topics: l.topics,
            });
            if (e.eventName === "ContractCreated")
              return { ...r, contractAddress: e.args.deployed };
          } catch {}
        }
        return r;
      },
      publishIndex: async (index) => {
        await tx(
          "index.publish." + keccak256(stringToHex(JSON.stringify(index))),
          () =>
            adminWrite({
              address: namespace,
              abi: contracts.DemoNamespace.abi,
              functionName: "publishCatalogue",
              args: [JSON.stringify(index)],
            }),
        );
        save("index", index);
      },
    },
  });
  status("Complete — catalogue published for all visitors.");
  return result;
}
