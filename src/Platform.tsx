"use client";
import { artworkLabel } from "./artwork-label";
import browseIndex from "./browse-index.json";
import { ipfsURL } from "./ipfs";
import SiteHeader from "./SiteHeader";
import PageSkeleton, { CollectionSkeleton } from "./PageSkeleton";
import defaults from "./demo-defaults.json";
import React, { useEffect, useRef, useState } from "react";
import {
  isAddress,
  keccak256,
  stringToHex,
  namehash,
  zeroAddress,
  zeroHash,
  formatEther,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import {
  client,
  chainId,
  configureChain,
  selectLocalWallet,
  wallet,
  receipt,
  contracts,
  parentAbi,
  contentHash,
  validateParent,
  type Config,
} from "./chain";

type Context = {
  parent: string;
  namespace: string;
  artwork: string;
  mandates: string;
  settlement: string;
  galleryName: string;
  galleryNamespace: string;
  galleryRegistry: string;
};
const blank: Context = {
  parent: "",
  namespace: "",
  artwork: "",
  mandates: "",
  settlement: "",
  galleryName: "",
  galleryNamespace: "",
  galleryRegistry: "",
};
const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
const short = (a: string) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");
const key = (n: bigint) => n & ~0xffffffffn;
const read = async (
  address: string,
  contract: string,
  fn: string,
  args: readonly unknown[] = [],
): Promise<any> =>
  client.readContract({
    address: address as Address,
    abi: contracts[contract].abi,
    functionName: fn,
    args,
  });
const field = (f: FormData, k: string) => String(f.get(k) || "");
const today = () => new Date().toISOString().slice(0, 10);
const historicalDate = (date: string) => {
  const value = Date.parse(date + "T00:00:00Z") / 1000;
  if (!Number.isInteger(value) || value <= 0 || value > Date.now() / 1000)
    throw Error("Choose a date in the past or today.");
  return BigInt(value);
};
const ttl = () => BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
const contextKey = (account: string) =>
  "artwork-platform:v3:" + chainId + ":" + account.toLowerCase();
function Input({
  label,
  name,
  type = "text",
  value = "",
  required = true,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  required?: boolean;
  max?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        max={max}
      />
    </label>
  );
}
export default function Platform({ page }: { page: string }) {
  const [config, setConfig] = useState<Config>();
  const configRef = useRef<Config | undefined>(undefined);
  const storageKey = (a: string) =>
    contextKey(a) + ":" + (configRef.current?.localDemo?.runId || "public");
  function chooseRole(role: string) {
    const demo = configRef.current?.localDemo;
    if (!demo) return;
    selectLocalWallet(demo.accounts[role]);
    localStorage.setItem("artwork-platform:local-role:" + demo.runId, role);
    restore(demo.accounts[role]);
  }
  const [account, setAccount] = useState<Address>();
  const accountRef = useRef<Address | undefined>(undefined);
  const [ctx, setContext] = useState<Context>(blank);
  const ctxRef = useRef(ctx);
  const [tenant, setTenant] = useState<Context>(blank);
  const tenantRef = useRef<Context>(blank);
  const recordContext = useRef<Partial<Context>>({});
  const restoring = useRef(0);
  const [names, setNames] = useState<{ name: string; allowed: boolean }[]>([]);
  const [finding, setFinding] = useState(false);
  const [nameError, setNameError] = useState("");
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState("");
  const [block, setBlock] = useState("");
  const [artworks, setArtworks] = useState<any[]>([]);
  const [shows, setShows] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [balance, setBalance] = useState(0n);
  const [galleryOwner, setGalleryOwner] = useState("");
  const [artistOwner, setArtistOwner] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const refreshGeneration = useRef(0);
  const [payouts, setPayouts] = useState<{ address: string; amount: bigint }[]>(
    [],
  );
  const [activeArt, setActiveArt] = useState("");
  const [showId, setShowId] = useState("");
  const setupPage = page === "setup-artist" || page === "setup-gallery";
  const gallery = page === "gallery" || page === "setup-gallery";
  const managingGallery =
    gallery ||
    ((page === "artwork" || page === "exhibition") &&
      same(account, galleryOwner));
  function applyTenant(n: Context) {
    tenantRef.current = n;
    setTenant(n);
    const view = { ...n, ...recordContext.current };
    ctxRef.current = view;
    setContext(view);
  }
  async function restore(a?: Address) {
    const generation = ++restoring.current;
    ++refreshGeneration.current;
    accountRef.current = a;
    setAccount(a);
    setChosen("");
    setNames([]);
    let n = { ...blank, ...configRef.current?.localDemo?.context };
    try {
      if (a) {
        const saved = JSON.parse(
          localStorage.getItem(storageKey(a)) ||
            (chainId === 11155111
              ? localStorage.getItem("artwork-platform:v2:" + a.toLowerCase())
              : null) ||
            "{}",
        );
        for (const k of Object.keys(blank) as (keyof Context)[])
          if (typeof saved?.[k] === "string") n[k] = saved[k];
      }
    } catch {
      /* Discard malformed browser storage. */
    }
    recordContext.current = {};
    applyTenant(n);
    // A shared record is a view, never the current managed tenant.
    const q = new URLSearchParams(location.search);
    const view: Partial<Context> = {};
    try {
      const registry = q.get("registry");
      const exhibition =
        page === "exhibition"
          ? registry
          : page === "artist"
            ? q.get("invitation")
            : page === "artwork"
              ? q.get("exhibition")
              : null;
      if (exhibition && isAddress(exhibition)) {
        const [ns] = await read(exhibition, "GalleryRegistry", "getParent");
        const [, label] = await read(ns, "ParticipantRegistry", "getParent");
        view.galleryRegistry = exhibition;
        view.galleryNamespace = ns;
        view.galleryName = label + ".eth";
      }
      if (page === "artwork" && registry && isAddress(registry)) {
        const [ns] = await read(registry, "ArtworkRegistry", "getParent");
        const [, label] = await read(ns, "ParticipantRegistry", "getParent");
        view.artwork = registry;
        view.namespace = ns;
        view.parent = label + ".eth";
        view.settlement = "";
        view.mandates = "";
        const sale = q.get("sale");
        if (sale && isAddress(sale)) {
          if (!same(await read(sale, "SimpleSettlement", "artwork"), registry))
            throw Error("Settlement does not match the shared artwork.");
          view.settlement = sale;
          view.mandates = await read(sale, "SimpleSettlement", "mandates");
        }
      }
      if (generation !== restoring.current) return;
      recordContext.current = view;
      applyTenant(tenantRef.current);
    } catch (e: any) {
      if (generation === restoring.current)
        setError(e.shortMessage || e.message);
    }
  }
  function save(patch: Partial<Context>) {
    const n = { ...tenantRef.current, ...patch };
    applyTenant(n);
    if (accountRef.current) {
      localStorage.setItem(storageKey(accountRef.current), JSON.stringify(n));
      for (const name of [n.parent, n.galleryName].filter(Boolean))
        localStorage.setItem(
          storageKey(accountRef.current) + ":" + name,
          JSON.stringify(n),
        );
    }
    return n;
  }
  function url(
    path: string,
    patch: Partial<Context> = {},
    extra: Record<string, string> = {},
  ) {
    const n = { ...ctx, ...patch };
    const q = new URLSearchParams();
    if (path === "/artwork/") {
      if (n.artwork) q.set("registry", n.artwork);
      if (n.settlement) q.set("sale", n.settlement);
      if (extra.art) q.set("art", extra.art);
      if (n.galleryRegistry) q.set("exhibition", n.galleryRegistry);
    } else if (path === "/exhibition/") {
      if (n.galleryRegistry) q.set("registry", n.galleryRegistry);
      if (extra.show) q.set("show", extra.show);
    }
    return path + (q.size ? "?" + q.toString() : "");
  }
  function invite(path: string) {
    if (path === "/exhibition/")
      return url(path, {}, currentShow ? { show: String(currentShow.id) } : {});
    const q = new URLSearchParams({ invitation: ctx.galleryRegistry });
    if (currentShow) q.set("show", String(currentShow.id));
    return path + "?" + q.toString();
  }
  useEffect(() => {
    const route = new URL(location.href);
    const q = route.searchParams;
    if (page === "artwork" && q.has("art") && !q.has("registry")) {
      if (q.has("artwork")) q.set("registry", q.get("artwork")!);
      if (q.has("settlement")) q.set("sale", q.get("settlement")!);
    }
    if (
      page === "exhibition" &&
      q.has("show") &&
      q.has("galleryRegistry") &&
      !q.has("registry")
    )
      q.set("registry", q.get("galleryRegistry")!);
    for (const k of Object.keys(blank)) q.delete(k);
    window.history.replaceState(
      null,
      "",
      route.pathname + route.search + route.hash,
    );
    setActiveArt(q.get("art") || "");
    setShowId(new URLSearchParams(location.search).get("show") || "");
    const p = (window as any).ethereum;
    let gone = false;
    const accounts = (a: Address[]) => {
      if (!gone && !configRef.current?.localDemo) restore(a[0]);
    };
    fetch("/api/config")
      .then(async (r) => {
        if (!r.ok) throw Error("Configuration unavailable");
        return (await r.json()) as Config;
      })
      .then(async (c) => {
        if (gone) return;
        configureChain(c);
        configRef.current = c;
        setConfig(c);
        if (c.localDemo) {
          const role =
            localStorage.getItem(
              "artwork-platform:local-role:" + c.localDemo.runId,
            ) || "artist";
          chooseRole(role in c.localDemo.accounts ? role : "artist");
        } else if (p) {
          try {
            accounts(await p.request({ method: "eth_accounts" }));
          } catch {
            restore();
          }
          p.on?.("accountsChanged", accounts);
        } else restore();
      })
      .catch((e) => !gone && setError(e.message));
    const changed = () =>
      setMessage(
        "Wallet network changed. Transactions must use the configured network.",
      );
    p?.on?.("chainChanged", changed);
    return () => {
      gone = true;
      p?.removeListener?.("accountsChanged", accounts);
      p?.removeListener?.("chainChanged", changed);
    };
  }, []);
  useEffect(() => {
    if (config && !busy)
      void refresh().catch((e) => setError(e.shortMessage || e.message));
  }, [config, ctx, account, busy]);
  useEffect(() => {
    let gone = false;
    if (!account || !config) return;
    setFinding(true);
    setNameError("");
    setNames([]);
    (async () => {
      let skip = 0,
        after: string | null = null;
      const all = new Set<string>();
      let pages = 0;
      do {
        const q = new URLSearchParams({ address: account, skip: String(skip) });
        if (after) q.set("after", after);
        const r = await fetch("/api/names?" + q);
        const x: any = await r.json();
        if (!r.ok) throw Error(x.error);
        x.names.forEach((n: string) => all.add(n));
        skip = x.nextSkip ?? skip;
        after = x.nextAfter;
        if (x.nextSkip === null && !after) break;
        if (++pages >= 100)
          throw Error(
            "Too many names to display. Check a specific name below.",
          );
      } while (!gone);
      const result = [];
      for (const name of all) {
        const allowed = await access(name, account);
        result.push({ name, allowed });
      }
      if (!gone) {
        setNames(result);
        const parent = gallery
          ? tenantRef.current.galleryName
          : tenantRef.current.parent;
        if (result.some((n) => n.name === parent && n.allowed))
          setChosen(parent);
      }
    })()
      .catch((e) => !gone && setNameError(e.message))
      .finally(() => !gone && setFinding(false));
    return () => {
      gone = true;
    };
  }, [account, config]);
  async function access(name: string, a: Address) {
    if (!config) return false;
    const label = validateParent(name).split(".")[0];
    const id = BigInt(keccak256(stringToHex(label)));
    const expiry = await client.readContract({
      address: config.ens.ETHRegistry,
      abi: parentAbi,
      functionName: "findExpiry",
      args: [label],
    });
    if (Number(expiry) <= Date.now() / 1000) return false;
    const resource = await client.readContract({
      address: config.ens.ETHRegistry,
      abi: parentAbi,
      functionName: "getResource",
      args: [id],
    });
    return client.readContract({
      address: config.ens.ETHRegistry,
      abi: parentAbi,
      functionName: "hasRoles",
      args: [resource, 1n << 20n, a],
    });
  }
  async function chooseNamespace(name: string, asGallery = managingGallery) {
    if (!account || !config || !name) return;
    if (!(await access(name, account)))
      throw Error("This wallet cannot manage that name.");
    setChosen(name);
    const current = asGallery
      ? tenantRef.current.galleryName
      : tenantRef.current.parent;
    if (current === name) {
      save({});
      return;
    }
    const previous = JSON.parse(
      localStorage.getItem(storageKey(account) + ":" + name) || "{}",
    );
    const namespace = await client.readContract({
      address: config.ens.ETHRegistry,
      abi: parentAbi,
      functionName: "getSubregistry",
      args: [name.split(".")[0]],
    });
    let child = "";
    if (namespace !== zeroAddress) {
      try {
        child = await read(namespace, "ParticipantRegistry", "getSubregistry", [
          asGallery ? "exhibitions" : "art",
        ]);
      } catch {
        /* setup checks compatibility */
      }
    }
    if (child === zeroAddress) child = "";
    if (!asGallery && child && !previous.settlement) {
      const indexed = (
        config.localDemo?.catalogueIndex ||
        (browseIndex.chainId === config.chainId ? browseIndex.namespaces : [])
      ).find((n) => n.name === "art." + name);
      if (
        indexed?.settlement &&
        isAddress(indexed.settlement) &&
        same(
          await read(indexed.settlement, "SimpleSettlement", "artwork"),
          child,
        )
      ) {
        previous.artwork = child;
        previous.settlement = indexed.settlement;
        previous.mandates = await read(
          indexed.settlement,
          "SimpleSettlement",
          "mandates",
        );
      }
    }
    save(
      asGallery
        ? {
            galleryName: name,
            galleryNamespace: namespace === zeroAddress ? "" : namespace,
            galleryRegistry: child,
          }
        : {
            parent: name,
            namespace: namespace === zeroAddress ? "" : namespace,
            artwork: child,
            mandates: previous.artwork === child ? previous.mandates || "" : "",
            settlement:
              previous.artwork === child ? previous.settlement || "" : "",
          },
    );
  }
  async function switchWorkspace(value: string) {
    if (!value) return;
    const [mode, name] = value.split(":");
    if (mode !== "artist" && mode !== "gallery") return;
    await chooseNamespace(name, mode === "gallery");
    if (accountRef.current)
      localStorage.setItem(storageKey(accountRef.current) + ":mode", mode);
    localStorage.setItem("artwork-platform:last-workspace", mode);
    location.assign("/" + mode + "/");
  }
  async function connect() {
    const { account: a } = await wallet();
    restore(a);
    setMessage(
      "Wallet connected on " +
        (config?.localDemo ? "local ENSv2." : "Sepolia."),
    );
  }
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    setTx("");
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(e.shortMessage || e.message);
    } finally {
      setBusy(false);
    }
  }
  async function write(
    address: string,
    contract: string,
    fn: string,
    args: readonly unknown[] = [],
    value?: bigint,
  ) {
    const { w, account: a } = await wallet();
    if (!same(a, accountRef.current))
      throw Error("Wallet account changed. Reconnect before signing.");
    setMessage(
      config?.localDemo
        ? "Submitting " + fn + " to the local chain…"
        : "Confirm " + fn + " in your wallet.",
    );
    const h = await w.writeContract({
      account: a,
      address: address as Address,
      abi: contracts[contract].abi,
      functionName: fn,
      args,
      value,
    });
    setTx(h);
    await receipt(h);
    setMessage(fn + " confirmed.");
    return h;
  }
  async function artwork(address: string, id: bigint, settlement: string) {
    if (
      isAddress(settlement) &&
      !same(await read(settlement, "SimpleSettlement", "artwork"), address)
    )
      throw Error("Settlement does not match this artwork registry.");
    const raw = await read(address, "ArtworkRegistry", "genesis", [id]);
    const g = { ...raw, title: artworkLabel(raw.title) };
    const tokenId = await read(address, "ArtworkRegistry", "getTokenId", [id]);
    const owner = await read(address, "ArtworkRegistry", "getOwner", [id]);
    let direct: any = null;
    if (isAddress(settlement)) {
      const count = Number(
        await read(settlement, "SimpleSettlement", "directCount"),
      );
      for (let i = count; i > Math.max(0, count - 100); i--) {
        const d = await read(settlement, "SimpleSettlement", "directListings", [
          BigInt(i),
        ]);
        if (
          key(d[0]) === key(id) &&
          (await read(settlement, "SimpleSettlement", "directActive", [
            BigInt(i),
          ]))
        ) {
          direct = { id: BigInt(i), price: d[3] };
          break;
        }
      }
    }
    // Older Sepolia registries are readable but must not be labelled as enforcing this policy.
    let termsId: string | undefined,
      unlockAt = 0,
      saleAllowed = true;
    try {
      termsId = await read(address, "ArtworkRegistry", "TERMS_ID");
      unlockAt = Number(
        await read(address, "ArtworkRegistry", "resaleAllowedAt", [id]),
      );
      saleAllowed = await read(address, "ArtworkRegistry", "saleAllowed", [id]);
    } catch {
      /* legacy registry */
    }
    let creationDate = 0,
      recordedDate = 0;
    const historical: any[] = [];
    try {
      creationDate = Number(
        await read(address, "ArtworkRegistry", "createdAt", [id]),
      );
      recordedDate = Number(
        await read(address, "ArtworkRegistry", "issuedAt", [key(id)]),
      );
      const count = Number(
        await read(address, "ArtworkRegistry", "historyCount", [id]),
      );
      for (let i = 0; i < Math.min(count, 100); i++)
        historical.push(
          await read(address, "ArtworkRegistry", "historicalRecord", [
            id,
            BigInt(i),
          ]),
        );
      historical.sort((a, b) => Number(a.occurredAt) - Number(b.occurredAt));
    } catch {
      /* Pre-history registry; do not invent dates. */
    }
    return {
      ...g,
      creationDate,
      recordedDate,
      historical,
      id,
      tokenId,
      owner,
      address,
      settlement,
      direct,
      termsId,
      unlockAt,
      saleAllowed,
    };
  }
  async function refresh() {
    if (!config) return;
    const generation = ++refreshGeneration.current;
    setDataLoading(true);
    try {
      const c = ctxRef.current;
      setBlock(String(await client.getBlockNumber()));
      const works = [];
      if (isAddress(c.artwork)) {
        const owner = await read(c.artwork, "ArtworkRegistry", "artist");
        if (generation === refreshGeneration.current) setArtistOwner(owner);
        const count = Number(
          await read(c.artwork, "ArtworkRegistry", "recordCount"),
        );
        for (let i = 0; i < Math.min(count, 100); i++) {
          works.push(
            await artwork(
              c.artwork,
              await read(c.artwork, "ArtworkRegistry", "recordId", [BigInt(i)]),
              c.settlement,
            ),
          );
        }
      }
      if (generation !== refreshGeneration.current) return;
      setArtworks(works);
      const exhibits = [],
        pending = [];
      if (isAddress(c.galleryRegistry)) {
        setGalleryOwner(
          await read(c.galleryRegistry, "GalleryRegistry", "gallery"),
        );
        const count = Number(
          await read(c.galleryRegistry, "GalleryRegistry", "recordCount"),
        );
        for (let i = 0; i < Math.min(count, 100); i++) {
          const id = await read(
            c.galleryRegistry,
            "GalleryRegistry",
            "recordId",
            [BigInt(i)],
          );
          let occurredAt = 0;
          try {
            occurredAt = Number(
              await read(c.galleryRegistry, "GalleryRegistry", "occurredAt", [
                id,
              ]),
            );
          } catch {}
          exhibits.push({
            occurredAt,
            ...(await read(c.galleryRegistry, "GalleryRegistry", "exhibition", [
              id,
            ])),
            id,
          });
        }
        const n = Number(
          await read(c.galleryRegistry, "GalleryRegistry", "submissionCount"),
        );
        for (let i = 1; i <= Math.min(n, 100); i++) {
          const [
            exhibitionId,
            mandates,
            mandateId,
            settlement,
            submitter,
            status,
          ] = await read(c.galleryRegistry, "GalleryRegistry", "submissions", [
            BigInt(i),
          ]);
          const m = await read(mandates, "MandateRegistry", "get", [mandateId]);
          const registry = await read(mandates, "MandateRegistry", "artwork");
          const a = await artwork(registry, m.tokenId, settlement);
          let offer = null;
          const lc = Number(
            await read(settlement, "SimpleSettlement", "count"),
          );
          for (let j = lc; j > Math.max(0, lc - 100); j--) {
            const l = await read(settlement, "SimpleSettlement", "listings", [
              BigInt(j),
            ]);
            if (
              l[0] === mandateId &&
              !l[3] &&
              (await read(mandates, "MandateRegistry", "active", [
                mandateId,
                257n,
              ]))
            ) {
              offer = { id: BigInt(j), price: l[1] };
              break;
            }
          }
          pending.push({
            id: BigInt(i),
            exhibitionId,
            mandates,
            mandateId,
            settlement,
            submitter,
            status,
            m,
            art: a,
            offer,
            permissions: await read(mandates, "MandateRegistry", "hasRoles", [
              mandateId,
              m.roles,
              m.gallery,
            ]),
            active: await read(mandates, "MandateRegistry", "active", [
              mandateId,
              16n,
            ]),
          });
        }
      } else setGalleryOwner("");
      if (generation !== refreshGeneration.current) return;
      setShows(exhibits);
      setSubmissions(pending);
      const a = accountRef.current;
      const pays = [];
      if (a) {
        for (const address of new Set<string>(
          [c.settlement, ...pending.map((s) => s.settlement)]
            .filter((x) => isAddress(x))
            .map((x) => x.toLowerCase()),
        )) {
          pays.push({
            address,
            amount: await read(address, "SimpleSettlement", "proceeds", [a]),
          });
        }
      }
      setPayouts(pays);
      setBalance(
        a && isAddress(c.settlement)
          ? await read(c.settlement, "SimpleSettlement", "proceeds", [a])
          : 0n,
      );
    } finally {
      if (generation === refreshGeneration.current) setDataLoading(false);
    }
  }
  async function setup() {
    if (!config || !chosen) throw Error("Choose an ENS name first.");
    const { w, account: a } = await wallet();
    if (!same(a, accountRef.current)) throw Error("Reconnect your wallet.");
    if (!(await access(chosen, a)))
      throw Error("This wallet cannot set the subregistry for that name.");
    let n = { ...tenantRef.current };
    const label = chosen.split(".")[0];
    const nsKey = gallery ? "galleryNamespace" : "namespace",
      childKey = gallery ? "galleryRegistry" : "artwork";
    const currentName = gallery ? n.galleryName : n.parent;
    if (currentName !== chosen)
      n = gallery
        ? {
            ...n,
            galleryName: chosen,
            galleryNamespace: "",
            galleryRegistry: "",
          }
        : {
            ...n,
            parent: chosen,
            namespace: "",
            artwork: "",
            mandates: "",
            settlement: "",
          };
    const checkpoint = (p: Partial<Context>) => {
      n = { ...n, ...p };
      save(n);
    };
    const txsend = async (
      contract: string,
      args: readonly unknown[],
      target?: string,
      fn?: string,
    ) => {
      if (
        !same((await w.getAddresses())[0], a) ||
        (await w.getChainId()) !== config.chainId
      )
        throw Error("Wallet or network changed. Resume with the same wallet.");
      setMessage(
        "Confirm " +
          (fn || "deploy " + contract) +
          ". Completed steps are saved.",
      );
      const h = target
        ? await w.writeContract({
            account: a,
            address: target as Address,
            abi: contracts[contract].abi,
            functionName: fn!,
            args,
          })
        : await w.deployContract({ account: a, ...contracts[contract], args });
      setTx(h);
      return (await receipt(h)).contractAddress!;
    };
    const existing = await client.readContract({
      address: config.ens.ETHRegistry,
      abi: parentAbi,
      functionName: "getSubregistry",
      args: [label],
    });
    if (existing !== zeroAddress && !same(existing, n[nsKey])) {
      try {
        const p = await read(existing, "ParticipantRegistry", "getParent");
        if (
          !same(
            await read(existing, "ParticipantRegistry", "participant"),
            a,
          ) ||
          !same(p[0], config.ens.ETHRegistry) ||
          p[1] !== label
        )
          throw Error();
        n[nsKey] = existing;
      } catch {
        throw Error(
          "This name already uses a different registry. It will not be replaced. Choose another name.",
        );
      }
    }
    checkpoint({});
    if (!isAddress(n[nsKey]))
      checkpoint({
        [nsKey]: await txsend("ParticipantRegistry", [
          config.ens.LabelStore,
          config.ens.ETHRegistry,
          label,
          a,
        ]),
      });
    const nsParent = await read(n[nsKey], "ParticipantRegistry", "getParent");
    if (
      !same(nsParent[0], config.ens.ETHRegistry) ||
      nsParent[1] !== label ||
      !same(await read(n[nsKey], "ParticipantRegistry", "participant"), a)
    )
      throw Error("Saved registry belongs to another wallet.");
    const childLabel = gallery ? "exhibitions" : "art",
      kind = gallery ? "GalleryRegistry" : "ArtworkRegistry";
    const knownChild = await read(
      n[nsKey],
      "ParticipantRegistry",
      "getSubregistry",
      [childLabel],
    );
    if (!isAddress(n[childKey]) && knownChild !== zeroAddress)
      checkpoint({ [childKey]: knownChild });
    if (!isAddress(n[childKey]))
      checkpoint({
        [childKey]: await txsend(kind, [
          config.ens.LabelStore,
          n[nsKey],
          namehash(childLabel + "." + chosen),
          a,
        ]),
      });
    const [parentRegistry, parentLabel] = await read(
      n[childKey],
      kind,
      "getParent",
    );
    if (
      !same(parentRegistry, n[nsKey]) ||
      parentLabel !== childLabel ||
      !same(await read(n[childKey], kind, gallery ? "gallery" : "artist"), a) ||
      (await read(n[childKey], kind, "namespaceNode")) !==
        namehash(childLabel + "." + chosen)
    )
      throw Error("Saved collection does not match this namespace.");
    const attached = await read(
      n[nsKey],
      "ParticipantRegistry",
      "getSubregistry",
      [childLabel],
    );
    if (attached !== zeroAddress && !same(attached, n[childKey]))
      throw Error("Subdomain already points elsewhere.");
    if (!same(attached, n[childKey]))
      await txsend(
        "ParticipantRegistry",
        [childLabel, n[childKey]],
        n[nsKey],
        "attach",
      );
    if (!same(existing, n[nsKey]))
      await txsend(
        "ParticipantRegistry",
        [BigInt(keccak256(stringToHex(label))), n[nsKey]],
        config.ens.ETHRegistry,
        "setSubregistry",
      );
    if (!gallery) {
      if (!isAddress(n.mandates))
        checkpoint({ mandates: await txsend("MandateRegistry", [n.artwork]) });
      if (
        !same(await read(n.mandates, "MandateRegistry", "artwork"), n.artwork)
      )
        throw Error("Wrong mandate registry.");
      if (!isAddress(n.settlement))
        checkpoint({
          settlement: await txsend("SimpleSettlement", [n.mandates]),
        });
      if (
        !same(
          await read(n.settlement, "SimpleSettlement", "mandates"),
          n.mandates,
        )
      )
        throw Error("Wrong settlement.");
    }
    setMessage(
      (gallery ? "Gallery" : "Artist") +
        " registry ready. Create your first " +
        (gallery ? "exhibition." : "artwork."),
    );
  }
  const selected =
    artworks.find((a) => String(a.id) === activeArt) || artworks[0];
  const currentShow = shows.find((s) => String(s.id) === showId) || shows[0];
  const image = (a: any) => (
    <img
      src={
        a.imageURI?.startsWith("ipfs://")
          ? ipfsURL(a.imageURI, config?.ipfsGateway)
          : "/blue-mountain.svg"
      }
      alt={a.title}
      onError={(e) => {
        e.currentTarget.src = "/blue-mountain.svg";
        e.currentTarget.alt =
          "Artwork image unavailable; placeholder illustration";
      }}
    />
  );
  const card = (a: any) => (
    <article className="panel art-card" key={a.address + String(a.id)}>
      {image(a)}
      <p className="eyebrow">
        {a.medium} · {a.year}
      </p>
      <h2>{a.title}</h2>
      <p>
        Artist {short(a.artist)} · Owner {short(a.owner)}
      </p>
      <a
        className="button"
        href={url(
          "/artwork/",
          { artwork: a.address, settlement: a.settlement },
          { art: String(a.id) },
        )}
      >
        View artwork ↗
      </a>
    </article>
  );
  const connectButton = (
    <button className="button" disabled={busy} onClick={() => act(connect)}>
      {account ? "Refresh wallet" : "Connect wallet ↗"}
    </button>
  );
  const ready = gallery
    ? isAddress(ctx.galleryRegistry)
    : isAddress(ctx.artwork) && isAddress(ctx.settlement);
  const managedParent = names.find(
    (n) =>
      n.allowed &&
      n.name === (managingGallery ? tenant.galleryName : tenant.parent),
  )?.name;
  if (!config && !error) return <PageSkeleton page={page} />;
  return (
    <>
      <SiteHeader>
        <div className="wallet-context">
          {account && (
            <label className="namespace-control">
              <span>Manage workspace</span>
              <select
                aria-label="Managed namespace"
                disabled={busy || finding}
                value={
                  managedParent
                    ? (managingGallery ? "gallery:" : "artist:") + managedParent
                    : ""
                }
                onChange={(e) =>
                  void act(() => switchWorkspace(e.target.value))
                }
              >
                <option value="">
                  {finding
                    ? "Checking name permissions…"
                    : "Choose a namespace…"}
                </option>
                {names
                  .filter((n) => n.allowed)
                  .flatMap((n) => [
                    <option key={"artist:" + n.name} value={"artist:" + n.name}>
                      art.{n.name} · Artist
                    </option>,
                    <option
                      key={"gallery:" + n.name}
                      value={"gallery:" + n.name}
                    >
                      exhibitions.{n.name} · Gallery
                    </option>,
                  ])}
              </select>
            </label>
          )}
          <button
            className="wallet"
            disabled={busy}
            onClick={() => act(connect)}
            title={account || "Connect wallet"}
          >
            {account ? short(account) : "Connect wallet ↗"}
          </button>
        </div>
      </SiteHeader>
      <div className="network">
        <span>
          {config?.localDemo
            ? "LOCAL ENSv2 / REAL TEST TRANSACTIONS"
            : "ETHEREUM SEPOLIA / TESTNET"}
        </span>
        <span>
          {block ? "BLOCK " + Number(block).toLocaleString() : "CONNECTING…"}
        </span>
      </div>
      <main
        className={
          "page workspace-" +
          (gallery || page === "exhibition" ? "gallery" : "artist")
        }
      >
        {config?.localDemo && (
          <section className="panel">
            <h2>Seeded local-chain demo</h2>
            <p>
              EON MUN · eonmun.eth / Atelier Gallery · atelier.eth. Disposable
              funded accounts; transactions change the local blockchain.
            </p>
            <div className="actions">
              {Object.entries(config.localDemo.accounts).map(
                ([role, address]) => (
                  <button
                    key={role}
                    className="button"
                    disabled={busy}
                    aria-pressed={same(account, address)}
                    onClick={() => chooseRole(role)}
                  >
                    Use {role}
                  </button>
                ),
              )}
            </div>
            <details>
              <summary>Seed transaction evidence</summary>
              <p>
                These receipts come from deployment, minting and purchase
                transactions on this local chain. Collected Study is already
                collector-owned and locked for 180 days.
              </p>
              {config.localDemo.transactions?.map((t) => (
                <p className="mono" key={t.hash}>
                  {t.action} · block {t.blockNumber} · {t.hash}
                </p>
              ))}
            </details>
            <p>
              IPFS defaults are bundled sample fixtures, not uploads or public
              pinning.
            </p>
            <p>
              Active:{" "}
              {
                Object.entries(config.localDemo.accounts).find(([, a]) =>
                  same(account, a),
                )?.[0]
              }{" "}
              · Chain 31337. Restart the local chain to reset.
            </p>
          </section>
        )}

        {(error || message || busy) && (
          <div
            className={"notice " + (error ? "error" : "")}
            role={error ? "alert" : "status"}
          >
            {error || message || "Waiting for wallet…"}
            {tx && config?.localDemo && (
              <p className="mono">
                Confirmed or pending local transaction: {tx}
              </p>
            )}
            {tx && !config?.localDemo && (
              <a
                href={"https://sepolia.etherscan.io/tx/" + tx}
                target="_blank"
                rel="noreferrer"
              >
                View transaction ↗
              </a>
            )}
          </div>
        )}
        {page === "home" && (
          <>
            <p className="eyebrow">ONE ARTWORK. MANY PARTICIPANTS.</p>
            <h1>
              Art has a life.
              <br />
              <em>Give it an identity.</em>
            </h1>
            <p className="intro">
              Your name. Your collection. Your exhibitions. Create an
              independent home for physical art, then connect artists, galleries
              and collectors through one shared record.
            </p>
            <p>
              <a className="button dark" href="/registry/">
                Create a new registry ↗
              </a>
            </p>
            <a className="button dark" href="/demo/artist/">
              Explore the complete demo ↗
            </a>
            <p>
              No wallet needed for the demo. Live setup uses names you control
              on {config?.localDemo ? "local ENSv2" : "ENS v2 Sepolia"}.
            </p>
          </>
        )}
        {(page === "artist" || page === "gallery") && (
          <>
            <p className="eyebrow">
              {gallery ? "GALLERY" : "ARTIST"} WORKSPACE
            </p>
            <h1>
              {gallery ? "Your exhibitions." : "Your artwork."}
              <br />
              <em>Your name.</em>
            </h1>
            <p className="intro">
              {gallery
                ? "Create exhibitions, invite artists and curate submissions without taking ownership of their NFTs."
                : "Create a permanent identity for your physical art. Sell directly or work with a gallery."}
            </p>
            {!ready && !dataLoading && (
              <section className="panel">
                <p>
                  {account
                    ? "Select an existing workspace from the namespace menu above, or create a new registry."
                    : "Connect your wallet to view your workspace, or browse published artwork and exhibitions."}
                </p>
                {!account && connectButton}
                <a className="button" href="/registry/">
                  Create a new registry ↗
                </a>
                <a
                  className="button"
                  href={gallery ? "/browse/galleries/" : "/browse/art/"}
                >
                  Browse {gallery ? "galleries" : "artwork"} ↗
                </a>
              </section>
            )}
          </>
        )}
        {setupPage && (
          <>
            <a href="/registry/">← Registry types</a>
            <p className="eyebrow">
              NEW {gallery ? "GALLERY" : "ARTWORK"} REGISTRY
            </p>
            <h1>Create your {gallery ? "gallery" : "artwork"} registry.</h1>
            <p className="intro">
              Choose a name you control to create your{" "}
              {gallery ? "exhibitions" : "artwork collection"}. Your wallet
              signs each setup transaction.
            </p>
            <section className="panel">
              <h2>{ready ? "Your registry" : "Choose your ENS name"}</h2>
              {!account ? (
                <p>
                  Connect your wallet to see names you own or have permission to
                  manage. {connectButton}
                </p>
              ) : (
                <>
                  <p className="mono">Connected: {account}</p>
                  {finding && (
                    <div
                      className="skeleton skeleton-title"
                      aria-label="Finding ENS names"
                    />
                  )}
                  {nameError && <p role="alert">{nameError}</p>}
                  <label>
                    ENS name
                    <select
                      aria-label="ENS name"
                      value={chosen}
                      onChange={(e) =>
                        void act(() => chooseNamespace(e.target.value))
                      }
                      disabled={finding || busy}
                    >
                      <option value="">Choose a name…</option>
                      {names.map((n) => (
                        <option
                          key={n.name}
                          value={n.name}
                          disabled={!n.allowed}
                        >
                          {n.name}
                          {n.allowed ? "" : " — no subregistry permission"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!finding && !nameError && !names.length && (
                    <p>
                      No supported .eth names found.{" "}
                      <a
                        href="https://app.ens.dev"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Register or migrate a name on ENS v2 Sepolia ↗
                      </a>
                    </p>
                  )}
                  <details>
                    <summary>Recently registered name missing?</summary>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void act(async () => {
                          const n = validateParent(field(f, "name"));
                          if (!(await access(n, account)))
                            throw Error(
                              "No current subregistry permission for this name.",
                            );
                          setNames((old) => [
                            ...old.filter((x) => x.name !== n),
                            { name: n, allowed: true },
                          ]);
                          setChosen(n);
                        });
                      }}
                    >
                      <Input label="Check ENS name" name="name" />
                      <button className="button" disabled={busy}>
                        Check access
                      </button>
                    </form>
                  </details>
                  <button
                    className="button dark"
                    disabled={busy || !chosen}
                    onClick={() => act(setup)}
                  >
                    Create / resume {gallery ? "gallery" : "artist"} registry ↗
                  </button>
                  <p className="fine">
                    {chosen
                      ? (gallery ? "exhibitions." : "art.") + chosen
                      : "Select a name to preview your subdomain."}{" "}
                    · {gallery ? "Up to four" : "Up to six"} wallet
                    confirmations. Completed steps are saved.
                  </p>
                </>
              )}
              {ready && (
                <p className="tag">
                  {gallery
                    ? "exhibitions." + ctx.galleryName
                    : "art." + ctx.parent}{" "}
                  · Registry configured
                </p>
              )}
              {ready && (
                <p>
                  <a
                    className="button dark"
                    href={gallery ? "/gallery/" : "/artist/"}
                  >
                    Open {gallery ? "gallery" : "artist"} workspace ↗
                  </a>
                </p>
              )}
            </section>
          </>
        )}
        {page === "artist" && isAddress(ctx.artwork) && (
          <>
            <h2>Your collection</h2>
            {dataLoading ? (
              <CollectionSkeleton />
            ) : (
              <div className="catalogue">{artworks.map(card)}</div>
            )}
            {!dataLoading && !artworks.length && (
              <p>Your first artwork will appear here.</p>
            )}
            {same(account, artistOwner) && (
              <form
                className="panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(async () => {
                    const a = accountRef.current;
                    if (!a) throw Error("Connect wallet.");
                    const manifest = field(f, "manifest");
                    await write(
                      ctx.artwork,
                      "ArtworkRegistry",
                      field(f, "createdAt") ? "issueDated" : "issue",
                      [
                        {
                          label: field(f, "label"),
                          title: field(f, "title"),
                          year: field(f, "createdAt")
                            ? Number(field(f, "createdAt").slice(0, 4))
                            : Number(field(f, "year")),
                          medium: field(f, "medium"),
                          dimensions: field(f, "dimensions"),
                          imageURI: field(f, "image"),
                          manifestURI: manifest,
                          contenthash: contentHash(manifest),
                          agreementURI: "",
                          agreementHash: zeroHash,
                          artist: a,
                          royaltyRecipient: a,
                          royaltyBps: 500,
                        },
                        ...(field(f, "createdAt")
                          ? [historicalDate(field(f, "createdAt"))]
                          : []),
                      ],
                    );
                    setMessage(
                      "Artwork issued. Genesis is permanently locked.",
                    );
                  });
                }}
              >
                <h2>Create artwork</h2>
                <Input
                  label="Artwork creation date (optional)"
                  name="createdAt"
                  type="date"
                  required={false}
                  max={today()}
                />
                <p className="fine">
                  Leave blank for today. Historical dates are artist-reported;
                  the mint is recorded at the current block time.
                </p>
                <div className="config-grid">
                  <Input
                    label="Title"
                    name="title"
                    value={config?.localDemo ? "Mountain Study" : ""}
                  />
                  <Input
                    label="Artwork label"
                    name="label"
                    value={config?.localDemo ? "mountain-study" : ""}
                  />
                  <Input label="Year" name="year" type="number" value="2026" />
                  <Input
                    label="Medium"
                    name="medium"
                    value={config?.localDemo ? "Oil on canvas" : ""}
                  />
                  <Input
                    label="Dimensions"
                    name="dimensions"
                    value={config?.localDemo ? "60 × 80 cm" : ""}
                  />
                  <p className="notice">
                    Standard artwork terms · 5% artist resale royalty · 180-day
                    transfer hold after each ownership change. First sale is
                    available immediately. These terms cannot be customized.
                  </p>
                  <Input
                    label="Image IPFS URI"
                    name="image"
                    value={config?.localDemo ? defaults.image : ""}
                  />
                  <Input
                    label="Manifest IPFS URI"
                    name="manifest"
                    value={config?.localDemo ? defaults.manifest : ""}
                  />
                </div>
                <button className="button dark" disabled={busy || !account}>
                  Issue & lock genesis ↗
                </button>
              </form>
            )}
          </>
        )}
        {page === "gallery" && ready && same(account, galleryOwner) && (
          <>
            {!shows.length && (
              <form
                className="panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(() =>
                    write(
                      ctx.galleryRegistry,
                      "GalleryRegistry",
                      "recordEstablishment",
                      [historicalDate(field(f, "establishedAt"))],
                    ),
                  );
                }}
              >
                <h2>Gallery establishment</h2>
                <p>
                  Record the gallery’s historical founding date once, before its
                  first exhibition. Contract deployment keeps its actual
                  timestamp.
                </p>
                <Input
                  label="Gallery establishment date"
                  name="establishedAt"
                  type="date"
                  max={today()}
                />
                <button className="button" disabled={busy}>
                  Record establishment date
                </button>
              </form>
            )}
            <form
              className="panel"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act(async () => {
                  const u = field(f, "manifest");
                  await write(
                    ctx.galleryRegistry,
                    "GalleryRegistry",
                    field(f, "occurredAt")
                      ? "createExhibitionDated"
                      : "createExhibition",
                    [
                      {
                        label: field(f, "label"),
                        title: field(f, "title"),
                        manifestURI: u,
                        contenthash: contentHash(u),
                        custodyStatement: field(f, "statement"),
                      },
                      ...(field(f, "occurredAt")
                        ? [historicalDate(field(f, "occurredAt"))]
                        : []),
                    ],
                  );
                  setMessage("Exhibition created. Open it to invite artists.");
                });
              }}
            >
              <h2>Create exhibition</h2>
              <Input
                label="Exhibition date (optional)"
                name="occurredAt"
                type="date"
                required={false}
                max={today()}
              />
              <p className="fine">
                For a past exhibition, first record the gallery’s establishment
                date. Future dates are not accepted.
              </p>
              <Input label="Exhibition title" name="title" />
              <Input label="Exhibition label" name="label" />
              <Input
                label="Exhibition manifest IPFS URI"
                name="manifest"
                value={config?.localDemo ? defaults.exhibition : ""}
              />
              <Input
                label="Public exhibition statement"
                name="statement"
                required={false}
              />
              <button
                className="button dark"
                disabled={busy || !same(account, galleryOwner)}
              >
                Create exhibition ↗
              </button>
            </form>
          </>
        )}
        {(page === "gallery" || page === "artist") && shows.length > 0 && (
          <>
            <h2>
              {page === "artist" ? "Invited exhibitions" : "Your exhibitions"}
            </h2>
            <div className="catalogue">
              {shows.map((s) => (
                <article className="panel" key={String(s.id)}>
                  <p className="eyebrow">
                    {s.label}.exhibitions.{ctx.galleryName}
                  </p>
                  <h2>{s.title}</h2>
                  <p>
                    {
                      submissions.filter(
                        (x) =>
                          key(x.exhibitionId) === key(s.id) && x.status === 2,
                      ).length
                    }{" "}
                    accepted artworks
                  </p>
                  <a
                    className="button"
                    href={url("/exhibition/", {}, { show: String(s.id) })}
                  >
                    View exhibition ↗
                  </a>
                </article>
              ))}
            </div>
          </>
        )}
        {dataLoading &&
          (page === "artwork" ||
            page === "exhibition" ||
            page === "gallery") && <CollectionSkeleton />}
        {page === "artwork" &&
          !dataLoading &&
          (!selected ? (
            <>
              <h1>Artwork</h1>
              <p>Open an artwork from an artist collection or exhibition.</p>
              <a href="/artist/">Go to artist workspace ↗</a>
            </>
          ) : (
            <>
              <div className="art-layout">
                <div className="art-frame">{image(selected)}</div>
                <div>
                  <p className="eyebrow">PHYSICAL ART · IMMUTABLE GENESIS</p>
                  <h1>{selected.title}</h1>
                  <p>
                    {selected.medium} · {selected.dimensions} · {selected.year}
                  </p>
                  <dl className="facts">
                    <dt>Original artist</dt>
                    <dd>{short(selected.artist)}</dd>
                    <dt>Current owner</dt>
                    <dd>{short(selected.owner)}</dd>
                    <dt>Artist royalty</dt>
                    <dd>
                      {Number(selected.royaltyBps) / 100}% within settlement
                    </dd>
                  </dl>
                  <section
                    className="canonical-terms"
                    aria-label="Canonical artwork terms"
                  >
                    <h2>Standard artwork terms</h2>
                    {selected.termsId ? (
                      <>
                        <p>
                          5% artist resale royalty. 180-day transfer hold after
                          each ownership change. Primary sale is exempt from the
                          hold and royalty.
                        </p>
                        <p role="status">
                          {selected.saleAllowed
                            ? "Available for sale under the standard terms."
                            : "Resale locked until " +
                              new Date(
                                selected.unlockAt * 1000,
                              ).toLocaleString() +
                              ". Exhibitions remain possible."}
                        </p>
                        <details>
                          <summary>Verify on-chain record</summary>
                          <p className="mono">Registry: {selected.address}</p>
                          <p className="mono">
                            Token: {String(selected.tokenId)}
                          </p>
                          <p className="mono">
                            Canonical policy: {selected.termsId}
                          </p>
                          <p>
                            Ownership, policy and unlock date above are read
                            from this registry.
                          </p>
                        </details>
                      </>
                    ) : (
                      <p role="alert">
                        Legacy registry: this artwork does not enforce the
                        standard holding period. Deploy a new registry to use
                        this policy.
                      </p>
                    )}
                  </section>
                  <a
                    href={ipfsURL(selected.manifestURI, config?.ipfsGateway)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Original manifest ↗
                  </a>
                  {selected.direct && (
                    <>
                      <p>
                        {formatEther(selected.direct.price)} test ETH · Direct
                        from owner
                      </p>
                      <button
                        className="button dark"
                        disabled={busy || same(account, selected.owner)}
                        onClick={() =>
                          act(() =>
                            write(
                              selected.settlement,
                              "SimpleSettlement",
                              "buyDirect",
                              [selected.direct.id],
                              selected.direct.price,
                            ),
                          )
                        }
                      >
                        Buy directly ↗
                      </button>
                    </>
                  )}
                </div>
              </div>
              {same(account, selected.owner) && (
                <div className="split">
                  <form
                    className="panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act(async () => {
                        await write(
                          selected.address,
                          "ArtworkRegistry",
                          "setApprovalForAll",
                          [selected.settlement, true],
                        );
                        await write(
                          selected.settlement,
                          "SimpleSettlement",
                          "listDirect",
                          [
                            selected.tokenId,
                            parseEther(field(f, "price")),
                            ttl(),
                          ],
                        );
                        setMessage("Direct listing ready for collectors.");
                      });
                    }}
                  >
                    <h2>Sell directly</h2>
                    <Input
                      label="Direct price (test ETH)"
                      name="price"
                      value="0.01"
                    />
                    <button
                      className="button"
                      disabled={busy || !selected.saleAllowed}
                    >
                      List for direct sale ↗
                    </button>
                    <p>
                      No gallery commission. Approval and listing require
                      separate signatures.
                    </p>
                  </form>
                  <form
                    className="panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act(async () => {
                        if (!isAddress(ctx.galleryRegistry))
                          throw Error(
                            "Open a gallery exhibition invitation first.",
                          );
                        const g = await read(
                          ctx.galleryRegistry,
                          "GalleryRegistry",
                          "gallery",
                        );
                        const h = await write(
                          ctx.mandates,
                          "MandateRegistry",
                          "create",
                          [
                            selected.tokenId,
                            g,
                            parseEther(field(f, "price")),
                            Number(field(f, "commission")),
                            ttl(),
                            BigInt(field(f, "scope") || "273"),
                          ],
                        );
                        const r = await receipt(h);
                        const { decodeEventLog } = await import("viem");
                        let id: bigint | undefined;
                        for (const log of r.logs) {
                          try {
                            if (!same(log.address, ctx.mandates)) continue;
                            const event = decodeEventLog({
                              abi: contracts.MandateRegistry.abi,
                              eventName: "MandateCreated",
                              data: log.data,
                              topics: log.topics,
                            }) as any;
                            id = event.args.id;
                          } catch {}
                        }
                        if (!id) throw Error("Could not read created mandate.");
                        await write(
                          ctx.galleryRegistry,
                          "GalleryRegistry",
                          "submit",
                          [
                            BigInt(field(f, "exhibition")),
                            ctx.mandates,
                            id,
                            selected.settlement,
                          ],
                        );
                        await write(
                          selected.address,
                          "ArtworkRegistry",
                          "setApprovalForAll",
                          [selected.settlement, true],
                        );
                        setMessage(
                          "Submitted. The gallery can accept and list the work; you retain ownership until sale.",
                        );
                      });
                    }}
                  >
                    <h2>Submit to an exhibition</h2>
                    <label>
                      Gallery authority
                      <select name="scope" defaultValue="273">
                        <option value="273">
                          Exhibit and sell within the standard terms
                        </option>
                        <option value="16">
                          Exhibition loan only · no sale authority
                        </option>
                      </select>
                    </label>
                    <p>
                      Loan exhibition and sale authority to this gallery. You
                      retain the NFT until a permitted sale. The standard
                      holding period still applies.
                    </p>
                    <label>
                      Exhibition
                      <select
                        aria-label="Exhibition"
                        name="exhibition"
                        required
                      >
                        <option value="">Choose an exhibition…</option>
                        {shows.map((s) => (
                          <option key={String(s.id)} value={String(s.id)}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input
                      label="Minimum price (test ETH)"
                      name="price"
                      value="0.01"
                    />
                    <Input
                      label="Gallery commission (basis points)"
                      name="commission"
                      value="1000"
                    />
                    <button className="button" disabled={busy || !shows.length}>
                      Submit artwork ↗
                    </button>
                    <p>
                      Permissions expire after seven days. Open the gallery’s
                      invitation link to choose its exhibition.
                    </p>
                  </form>
                </div>
              )}
              <section className="panel">
                <h2>Artwork history</h2>
                {selected.creationDate > 0 && (
                  <p>
                    Created{" "}
                    {new Date(
                      selected.creationDate * 1000,
                    ).toLocaleDateString()}{" "}
                    · minted on chain{" "}
                    {new Date(
                      selected.recordedDate * 1000,
                    ).toLocaleDateString()}
                    .
                  </p>
                )}
                <p>
                  Historical entries are attributed reports, not proof of past
                  on-chain payments. They do not change the current token owner
                  or its holding period.
                </p>
                {selected.historical.map((h: any, i: number) => (
                  <article className="submission" key={i}>
                    <p className="eyebrow">
                      {new Date(
                        Number(h.occurredAt) * 1000,
                      ).toLocaleDateString()}{" "}
                      · reported history
                    </p>
                    <h3>{artworkLabel(h.title)}</h3>
                    <p>{h.detail}</p>
                    <p className="fine">
                      Recorded by {short(h.recordedBy)} on{" "}
                      {new Date(
                        Number(h.recordedAt) * 1000,
                      ).toLocaleDateString()}
                    </p>
                  </article>
                ))}
                {!selected.historical.length && (
                  <p>No historical reports recorded.</p>
                )}
                {selected.creationDate > 0 &&
                  (same(account, selected.artist) ||
                    same(account, selected.owner)) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void act(() =>
                          write(
                            selected.address,
                            "ArtworkRegistry",
                            "recordHistory",
                            [
                              selected.tokenId,
                              {
                                referenceId: keccak256(
                                  stringToHex(
                                    String(Date.now()) + ":" + Math.random(),
                                  ),
                                ),
                                kind: Number(field(f, "kind")),
                                occurredAt: historicalDate(field(f, "date")),
                                title: field(f, "title"),
                                detail: field(f, "detail"),
                              },
                            ],
                          ),
                        );
                      }}
                    >
                      <h3>Add historical record</h3>
                      <label>
                        Event type
                        <select name="kind" defaultValue="3">
                          <option value="1">Creation</option>
                          <option value="2">Exhibition</option>
                          <option value="3">Historical purchase</option>
                        </select>
                      </label>
                      <Input
                        label="Historical event date"
                        name="date"
                        type="date"
                        max={today()}
                      />
                      <Input label="History title" name="title" />
                      <Input label="Historical details" name="detail" />
                      <button className="button" disabled={busy}>
                        Record history
                      </button>
                    </form>
                  )}
              </section>
              <section className="panel">
                <h2>Gallery permissions</h2>
                {submissions
                  .filter(
                    (s) =>
                      same(s.art.address, selected.address) &&
                      key(s.art.id) === key(selected.id),
                  )
                  .map((s) => (
                    <div className="submission" key={String(s.id)}>
                      <p>
                        Gallery {short(s.m.gallery)} ·{" "}
                        {s.active
                          ? "Accepted exhibition authority"
                          : s.m.revoked
                            ? "Revoked"
                            : "Pending or inactive"}
                      </p>
                      <p>
                        {s.m.roles === 16n
                          ? "Exhibition loan only"
                          : "Exhibit, list and sell"}{" "}
                        · minimum {formatEther(s.m.minPrice)} test ETH ·{" "}
                        {Number(s.m.commissionBps) / 100}% gallery commission ·
                        expires{" "}
                        {new Date(Number(s.m.expires) * 1000).toLocaleString()}
                      </p>
                      <p>
                        The gallery cannot change the original artwork record or
                        bypass its holding period.
                      </p>
                      <details>
                        <summary>Verify access controls</summary>
                        <p className="mono">
                          ENSv2 EnhancedAccessControl · mandate resource{" "}
                          {String(s.mandateId)} · bitmap {String(s.m.roles)} ·
                          hasRoles: {String(s.permissions)}
                        </p>
                        <p>
                          Effective exhibition authority: {String(s.active)}.
                          Acceptance, expiry and ownership epoch are checked
                          separately from role assignment.
                        </p>
                      </details>
                      {same(account, selected.owner) && !s.m.revoked && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            void act(() =>
                              write(s.mandates, "MandateRegistry", "revoke", [
                                s.mandateId,
                              ]),
                            )
                          }
                        >
                          Revoke gallery permissions
                        </button>
                      )}
                    </div>
                  ))}
                {!submissions.some(
                  (s) =>
                    same(s.art.address, selected.address) &&
                    key(s.art.id) === key(selected.id),
                ) && (
                  <p>
                    No gallery submissions in the selected exhibition registry.
                  </p>
                )}
              </section>
              <p className="fine">
                Buying the NFT records token ownership. Physical delivery is
                arranged separately.
              </p>
            </>
          ))}
        {page === "exhibition" &&
          !dataLoading &&
          (!currentShow ? (
            <>
              <h1>Exhibition</h1>
              <p>Open an exhibition from a gallery page or invitation link.</p>
            </>
          ) : (
            <>
              <p className="eyebrow">
                {currentShow.label}.exhibitions.{ctx.galleryName}
              </p>
              <h1>{currentShow.title}</h1>
              {!!currentShow.occurredAt && (
                <p>
                  Exhibition date:{" "}
                  {new Date(currentShow.occurredAt * 1000).toLocaleDateString()}{" "}
                  · recorded on chain{" "}
                  {new Date(
                    Number(currentShow.recordedAt) * 1000,
                  ).toLocaleDateString()}
                  .
                </p>
              )}
              <p className="intro">
                {currentShow.custodyStatement ||
                  "An independently curated collection of physical artwork."}
              </p>
              <p>
                Published by {short(currentShow.issuer)}. Exhibition statements
                are attributed to the gallery.
              </p>
              <a className="button" href={invite("/artist/")}>
                Artist: create or select your artwork ↗
              </a>
              <button
                className="button"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(
                      invite("/exhibition/").replace(
                        /^\//,
                        location.origin + "/",
                      ),
                    )
                    .then(() => setMessage("Exhibition invitation copied."))
                    .catch(() =>
                      setMessage("Copy this page URL to invite artists."),
                    );
                  setMessage("Copy this page URL to invite artists.");
                }}
              >
                Share exhibition invitation ↗
              </button>
              <div className="catalogue">
                {submissions
                  .filter(
                    (s) =>
                      key(s.exhibitionId) === key(currentShow.id) &&
                      s.status === 2,
                  )
                  .map((s) => (
                    <article className="panel art-card" key={String(s.id)}>
                      {image(s.art)}
                      <h2>{s.art.title}</h2>
                      {!s.art.saleAllowed && (
                        <p>
                          Resale locked until{" "}
                          {new Date(s.art.unlockAt * 1000).toLocaleDateString()}
                          . Exhibition remains permitted.
                        </p>
                      )}
                      <p>
                        Artist {short(s.art.artist)} · Owner{" "}
                        {short(s.art.owner)}
                      </p>
                      <a
                        href={url(
                          "/artwork/",
                          {
                            artwork: s.art.address,
                            mandates: s.mandates,
                            settlement: s.settlement,
                          },
                          { art: String(s.art.id) },
                        )}
                      >
                        View artwork ↗
                      </a>
                      {s.offer ? (
                        <>
                          <p>{formatEther(s.offer.price)} test ETH</p>
                          <button
                            className="button dark"
                            disabled={
                              busy ||
                              same(account, s.art.owner) ||
                              same(account, galleryOwner)
                            }
                            onClick={() =>
                              act(() =>
                                write(
                                  s.settlement,
                                  "SimpleSettlement",
                                  "buy",
                                  [s.offer.id],
                                  s.offer.price,
                                ),
                              )
                            }
                          >
                            Buy from exhibition ↗
                          </button>
                        </>
                      ) : (
                        same(account, galleryOwner) && (
                          <button
                            className="button"
                            disabled={
                              busy ||
                              !s.art.saleAllowed ||
                              !s.active ||
                              (s.m.roles & 257n) !== 257n
                            }
                            onClick={() =>
                              act(() =>
                                write(
                                  s.settlement,
                                  "SimpleSettlement",
                                  "list",
                                  [s.mandateId, s.m.minPrice],
                                ),
                              )
                            }
                          >
                            List at agreed price ↗
                          </button>
                        )
                      )}
                    </article>
                  ))}
              </div>
              {same(account, galleryOwner) && (
                <section className="panel">
                  <h2>Artist submissions</h2>
                  {submissions
                    .filter(
                      (s) =>
                        key(s.exhibitionId) === key(currentShow.id) &&
                        s.status === 1,
                    )
                    .map((s) => (
                      <div className="submission" key={String(s.id)}>
                        <h3>{s.art.title}</h3>
                        <p>
                          From {short(s.submitter)} · Minimum{" "}
                          {formatEther(s.m.minPrice)} test ETH ·{" "}
                          {Number(s.m.commissionBps) / 100}% commission
                        </p>
                        <button
                          className="button dark"
                          disabled={busy}
                          onClick={() =>
                            act(async () => {
                              if (!s.m.accepted)
                                await write(
                                  s.mandates,
                                  "MandateRegistry",
                                  "accept",
                                  [s.mandateId],
                                );
                              await write(
                                ctx.galleryRegistry,
                                "GalleryRegistry",
                                "decide",
                                [s.id, true],
                              );
                              setMessage(
                                "Artwork accepted into the exhibition.",
                              );
                            })
                          }
                        >
                          Accept submission ↗
                        </button>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            act(() =>
                              write(
                                ctx.galleryRegistry,
                                "GalleryRegistry",
                                "decide",
                                [s.id, false],
                              ),
                            )
                          }
                        >
                          Decline submission
                        </button>
                      </div>
                    ))}
                  {!submissions.some(
                    (s) =>
                      key(s.exhibitionId) === key(currentShow.id) &&
                      s.status === 1,
                  ) && (
                    <p>
                      No pending submissions. Share this exhibition with an
                      artist.
                    </p>
                  )}
                </section>
              )}
            </>
          ))}
        {account && (page === "artist" || page === "gallery") && (
          <section className="panel">
            <h2>Sale proceeds</h2>
            {payouts.length ? (
              payouts.map((p) => (
                <div key={p.address}>
                  <p>
                    {formatEther(p.amount)} test ETH · {short(p.address)}
                  </p>
                  <button
                    className="button"
                    disabled={busy || p.amount === 0n}
                    onClick={() =>
                      act(() =>
                        write(p.address, "SimpleSettlement", "withdraw"),
                      )
                    }
                  >
                    Withdraw proceeds ↗
                  </button>
                </div>
              ))
            ) : (
              <p>No proceeds yet.</p>
            )}
          </section>
        )}
      </main>
      <footer>
        <span>
          ARTWORK COMMONS · Independently owned art and exhibition registries.
        </span>
        <a href="https://github.com/ncrmro/ens-artwork-template">Source ↗</a>
        <span>
          Future: verified custody, logistics, legal execution and universal
          royalty enforcement.
        </span>
      </footer>
    </>
  );
}
