import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  formatEther,
  isAddress,
  keccak256,
  namehash,
  parseEther,
  stringToHex,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from "viem";
import {
  client,
  contracts,
  contentHash,
  wallet,
  receipt,
  parentAbi,
  validateParent,
  resolveContent,
  type Config,
  type Lifecycle,
} from "./chain";
import "./style.css";

type Genesis = {
  label: string;
  title: string;
  year: number;
  medium: string;
  dimensions: string;
  imageURI: string;
  manifestURI: string;
  contenthash: Hex;
  agreementURI: string;
  agreementHash: Hex;
  artist: Address;
  royaltyRecipient: Address;
  royaltyBps: number;
};
type Art = Genesis & {
  id: bigint;
  tokenId: bigint;
  owner: Address;
  issuedAt: bigint;
  presentation: {
    publicLocation: string;
    ownerWebsite: string;
    author: Address;
    timestamp: bigint;
  };
};
type Mandate = {
  id: bigint;
  tokenId: bigint;
  epoch: bigint;
  owner: Address;
  gallery: Address;
  minPrice: bigint;
  commissionBps: number;
  expires: bigint;
  roles: bigint;
  accepted: boolean;
  revoked: boolean;
  active: boolean;
  canExhibit: boolean;
};
type Exhibition = {
  id: bigint;
  label: string;
  title: string;
  manifestURI: string;
  artwork: Address;
  artworkId: bigint;
  mandates: Address;
  mandateId: bigint;
  issuer: Address;
  recordedAt: bigint;
  custodyStatement: string;
};
type Listing = {
  id: bigint;
  mandateId: bigint;
  price: bigint;
  createdAt: bigint;
  sold: boolean;
  sale: [Address, Address, bigint, bigint, bigint, bigint, bigint];
};
const empty: Lifecycle = {
  namespace: "",
  artwork: "",
  mandates: "",
  settlement: "",
  galleryNamespace: "",
  galleryRegistry: "",
  galleryParentName: "",
};
const short = (s: string) =>
  s ? s.slice(0, 6) + "…" + s.slice(-4) : "Not connected";
const same = (a?: string, b?: string) =>
  Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const key = (id: bigint) => id & ~0xffffffffn;
const date = (n: bigint) => new Date(Number(n) * 1000).toLocaleDateString();
const explorer = (v: string) =>
  "https://sepolia.etherscan.io/" + (v.length === 66 ? "tx/" : "address/") + v;
const storage = (c: Config) =>
  "artwork-lifecycle:v1:" + c.chainId + ":" + c.parentName;
async function read(
  address: string,
  name: string,
  fn: string,
  args: readonly unknown[] = [],
): Promise<any> {
  return client.readContract({
    address: address as Address,
    abi: contracts[name].abi,
    functionName: fn,
    args,
  });
}
const sample: Art = {
  id: 0n,
  tokenId: 0n,
  label: "blue-mountain",
  title: "Blue Mountain",
  year: 2026,
  medium: "Acrylic and gold leaf on linen",
  dimensions: "48 × 116 in",
  imageURI: "",
  manifestURI: "",
  contenthash: "0x",
  agreementURI: "",
  agreementHash: zeroHash,
  artist: zeroAddress,
  royaltyRecipient: zeroAddress,
  royaltyBps: 500,
  owner: zeroAddress,
  issuedAt: 0n,
  presentation: {
    publicLocation: "",
    ownerWebsite: "",
    author: zeroAddress,
    timestamp: 0n,
  },
};
function Field({
  label,
  name,
  placeholder = "",
  value,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  placeholder?: string;
  value?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={value}
        required={required}
      />
    </label>
  );
}
function App() {
  const [config, setConfig] = useState<Config>();
  const [links, setLinks] = useState<Lifecycle>(empty);
  const [tab, setTab] = useState(location.hash.slice(1) || "artwork");
  const [view, setView] = useState("artist");
  const [account, updateAccount] = useState<Address>();
  const accountRef = useRef<Address | undefined>(undefined);
  function setAccount(a: Address | undefined) {
    accountRef.current = a;
    updateAccount(a);
  }
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState<Hex>();
  const [block, setBlock] = useState("");
  const [parentOwner, setParentOwner] = useState("");
  const [linked, setLinked] = useState(false);
  const linksRef = useRef(links);
  linksRef.current = links;
  const [galleryLinked, setGalleryLinked] = useState(false);
  const [arts, setArts] = useState<Art[]>([]);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [registryArtist, setRegistryArtist] = useState("");
  const [selected, setSelected] = useState("");
  const [proceeds, setProceeds] = useState(0n);
  const [approved, setApproved] = useState(false);
  const [copied, setCopied] = useState(false);
  const art = arts.find((a) => String(a.id) === selected) || arts[0] || sample;
  const live = art.id !== 0n;
  const artistName = config?.name || "EON MUN";
  const parent = config?.parentName || "eonmun.eth";
  const fullName = art.label + ".art." + parent;
  const relatedMandates = mandates.filter(
    (m) => key(m.tokenId) === key(art.id),
  );
  const relatedExhibitions = exhibitions.filter(
    (e) => same(e.artwork, links.artwork) && key(e.artworkId) === key(art.id),
  );
  const artListings = listings.filter((l) =>
    relatedMandates.some((m) => m.id === l.mandateId),
  );
  const offer = artListings.find(
    (l) =>
      !l.sold && relatedMandates.some((m) => m.id === l.mandateId && m.active),
  );
  const owner = same(account, art.owner);
  const creator = same(account, art.artist);
  const go = (t: string) => {
    setTab(t);
    location.hash = t;
    setMessage("");
    setError("");
  };
  useEffect(() => {
    const f = () => setTab(location.hash.slice(1) || "artwork");
    window.addEventListener("hashchange", f);
    fetch("/api/config")
      .then(async (r) => (await r.json()) as Config)
      .then((c: Config) => {
        if (c.chainId !== 11155111)
          throw Error("Ethereum Sepolia is required.");
        const q = new URLSearchParams(location.search);
        if (q.has("parentName")) {
          const chosen = validateParent(q.get("parentName")!);
          if (chosen !== c.parentName) c.lifecycle = { ...empty };
          c.parentName = chosen;
          c.name = q.get("artistName") || chosen;
        }
        setConfig(c);
        let saved = {};
        try {
          saved = JSON.parse(localStorage.getItem(storage(c)) || "{}");
        } catch {}
        const n = { ...empty, ...c.lifecycle, ...saved } as Lifecycle;
        for (const k of Object.keys(empty) as (keyof Lifecycle)[])
          if (q.has(k)) n[k] = q.get(k)!;
        setLinks(n);
        setView(q.get("view") || c.siteView || "artist");
      })
      .catch((e) => setError(e.message));
    return () => window.removeEventListener("hashchange", f);
  }, []);
  useEffect(() => {
    const p = (window as any).ethereum;
    if (!p?.on) return;
    const f = (accounts: string[]) => {
      setAccount(accounts[0] as Address | undefined);
      setMessage("Wallet account changed. Review your role before signing.");
    };
    p.on("accountsChanged", f);
    return () => p.removeListener?.("accountsChanged", f);
  }, []);
  useEffect(() => {
    if (config && !busy)
      void refresh().catch((e) => setError(e.shortMessage || e.message));
  }, [config, links, account]);
  async function refresh() {
    const account = accountRef.current;
    const links = linksRef.current;
    if (!config) return;
    setError("");
    if ((await client.getChainId()) !== 11155111)
      throw Error("RPC network mismatch");
    setBlock(String(await client.getBlockNumber()));
    const root = config.ens.ETHRegistry;
    const pOwner = await client.readContract({
      address: root,
      abi: parentAbi,
      functionName: "findOwner",
      args: [parent.split(".")[0]],
    });
    setParentOwner(pOwner);
    const sub = await client.readContract({
      address: root,
      abi: parentAbi,
      functionName: "getSubregistry",
      args: [parent.split(".")[0]],
    });
    let aLinked = false;
    if (isAddress(links.namespace) && isAddress(links.artwork)) {
      const [actualParent, label] = await read(
        links.namespace,
        "ParticipantRegistry",
        "getParent",
      );
      const [ns, child] = await read(
        links.artwork,
        "ArtworkRegistry",
        "getParent",
      );
      if (
        !same(actualParent, root) ||
        label !== parent.split(".")[0] ||
        !same(ns, links.namespace) ||
        child !== "art"
      )
        throw Error("Artist contracts do not belong to this ENS namespace.");
      if (
        (await read(links.artwork, "ArtworkRegistry", "namespaceNode")) !==
        namehash("art." + parent)
      )
        throw Error("Artwork namespace hash mismatch.");
      aLinked =
        same(sub, links.namespace) &&
        same(
          await read(links.namespace, "ParticipantRegistry", "getSubregistry", [
            "art",
          ]),
          links.artwork,
        );
    }
    setLinked(aLinked);
    let loaded: Art[] = [];
    if (isAddress(links.artwork)) {
      setRegistryArtist(await read(links.artwork, "ArtworkRegistry", "artist"));
      const n = Number(
        await read(links.artwork, "ArtworkRegistry", "recordCount"),
      );
      for (let i = 0; i < Math.min(n, 100); i++) {
        const id = await read(links.artwork, "ArtworkRegistry", "recordId", [
          BigInt(i),
        ]);
        loaded.push({
          ...(await read(links.artwork, "ArtworkRegistry", "genesis", [id])),
          id,
          tokenId: await read(links.artwork, "ArtworkRegistry", "getTokenId", [
            id,
          ]),
          owner: await read(links.artwork, "ArtworkRegistry", "getOwner", [id]),
          issuedAt: await read(links.artwork, "ArtworkRegistry", "issuedAt", [
            key(id),
          ]),
          presentation: await read(
            links.artwork,
            "ArtworkRegistry",
            "presentation",
            [id],
          ),
        });
      }
    }
    setArts(loaded);
    const ms: Mandate[] = [];
    if (isAddress(links.mandates)) {
      if (
        !same(
          await read(links.mandates, "MandateRegistry", "artwork"),
          links.artwork,
        )
      )
        throw Error("Mandates target a different artwork registry.");
      const n = Number(await read(links.mandates, "MandateRegistry", "count"));
      for (let i = 1; i <= Math.min(n, 100); i++) {
        const id = BigInt(i);
        ms.push({
          ...(await read(links.mandates, "MandateRegistry", "get", [id])),
          id,
          active: await read(links.mandates, "MandateRegistry", "active", [
            id,
            257n,
          ]),
          canExhibit: await read(links.mandates, "MandateRegistry", "active", [
            id,
            16n,
          ]),
        });
      }
    }
    setMandates(ms);
    const ls: Listing[] = [];
    if (isAddress(links.settlement)) {
      if (
        !same(
          await read(links.settlement, "SimpleSettlement", "mandates"),
          links.mandates,
        )
      )
        throw Error("Settlement targets different mandates.");
      const n = Number(
        await read(links.settlement, "SimpleSettlement", "count"),
      );
      for (let i = 1; i <= Math.min(n, 100); i++) {
        const id = BigInt(i);
        const [mandateId, price, createdAt, sold] = await read(
          links.settlement,
          "SimpleSettlement",
          "listings",
          [id],
        );
        ls.push({
          id,
          mandateId,
          price,
          createdAt,
          sold,
          sale: await read(
            links.settlement,
            "SimpleSettlement",
            "saleReceipt",
            [id],
          ),
        });
      }
      setProceeds(
        account
          ? await read(links.settlement, "SimpleSettlement", "proceeds", [
              account,
            ])
          : 0n,
      );
    }
    setListings(ls);
    const es: Exhibition[] = [];
    setGalleryLinked(false);
    if (
      isAddress(links.galleryRegistry) &&
      isAddress(links.galleryNamespace) &&
      links.galleryParentName
    ) {
      const gn = validateParent(links.galleryParentName);
      const [gr, gl] = await read(
        links.galleryNamespace,
        "ParticipantRegistry",
        "getParent",
      );
      const [gParent, gChild] = await read(
        links.galleryRegistry,
        "GalleryRegistry",
        "getParent",
      );
      if (
        !same(gr, root) ||
        gl !== gn.split(".")[0] ||
        !same(gParent, links.galleryNamespace) ||
        gChild !== "exhibitions" ||
        (await read(
          links.galleryRegistry,
          "GalleryRegistry",
          "namespaceNode",
        )) !== namehash("exhibitions." + gn)
      )
        throw Error("Gallery namespace mismatch.");
      const gSub = await client.readContract({
        address: root,
        abi: parentAbi,
        functionName: "getSubregistry",
        args: [gn.split(".")[0]],
      });
      setGalleryLinked(
        same(gSub, links.galleryNamespace) &&
          same(
            await read(
              links.galleryNamespace,
              "ParticipantRegistry",
              "getSubregistry",
              ["exhibitions"],
            ),
            links.galleryRegistry,
          ),
      );
      const n = Number(
        await read(links.galleryRegistry, "GalleryRegistry", "recordCount"),
      );
      for (let i = 0; i < Math.min(n, 100); i++) {
        const id = await read(
          links.galleryRegistry,
          "GalleryRegistry",
          "recordId",
          [BigInt(i)],
        );
        const e = await read(
          links.galleryRegistry,
          "GalleryRegistry",
          "exhibition",
          [id],
        );
        if (same(e.artwork, links.artwork) && same(e.mandates, links.mandates))
          es.push({ ...e, id });
      }
    }
    setExhibitions(es);
    if (account && isAddress(links.artwork) && isAddress(links.settlement))
      setApproved(
        await read(links.artwork, "ArtworkRegistry", "isApprovedForAll", [
          account,
          links.settlement,
        ]),
      );
    else setApproved(false);
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setError("");
    setTx(undefined);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(e.shortMessage || e.message);
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    const { account: a } = await wallet();
    setAccount(a);
    setMessage("Connected to Ethereum Sepolia: " + a);
  }
  async function write(
    address: string,
    name: string,
    fn: string,
    args: readonly unknown[] = [],
    value?: bigint,
  ) {
    const { w, account: a } = await wallet();
    setAccount(a);
    const hash = await w.writeContract({
      account: a,
      address: address as Address,
      abi: contracts[name].abi,
      functionName: fn,
      args,
      value,
    });
    setTx(hash);
    setMessage("Waiting for Sepolia confirmation…");
    await receipt(hash);
    setMessage("Confirmed on Ethereum Sepolia.");
    return hash;
  }
  function save(patch: Partial<Lifecycle>) {
    const n = { ...links, ...patch };
    linksRef.current = n;
    setLinks(n);
    if (config) localStorage.setItem(storage(config), JSON.stringify(n));
    return n;
  }
  async function setupWallet(gallery: boolean, requestedName: string) {
    if (!config) throw Error("Configuration loading");
    const name = validateParent(requestedName);
    const { w, account: a } = await wallet();
    setAccount(a);
    const root = config.ens.ETHRegistry;
    const label = name.split(".")[0];
    const owner = await client.readContract({
      address: root,
      abi: parentAbi,
      functionName: "findOwner",
      args: [label],
    });
    if (!same(owner, a))
      throw Error(
        "Connect the wallet that owns " +
          name +
          " on ENS v2 Sepolia. Register that name first if needed.",
      );
    let n = { ...links };
    if (
      gallery &&
      n.galleryParentName &&
      n.galleryParentName !== name &&
      n.galleryNamespace
    )
      throw Error(
        "Import or clear the gallery configuration before switching its ENS name.",
      );
    const checkpoint = (patch: Partial<Lifecycle>) => {
      n = { ...n, ...patch };
      save(n);
    };
    const guard = async () => {
      if (
        (await w.getChainId()) !== 11155111 ||
        !same((await w.getAddresses())[0], a)
      )
        throw Error(
          "Wallet or network changed. Reconnect the original wallet and resume setup.",
        );
    };
    const transact = async (
      contract: string,
      args: readonly unknown[],
      target?: string,
      fn?: string,
    ) => {
      await guard();
      setMessage(
        "Confirm in your wallet: " +
          (fn || "deploy " + contract) +
          ". Completed steps are saved.",
      );
      const hash = target
        ? await w.writeContract({
            account: a,
            address: target as Address,
            abi: contracts[contract].abi,
            functionName: fn!,
            args,
          })
        : await w.deployContract({ account: a, ...contracts[contract], args });
      setTx(hash);
      const r = await receipt(hash);
      return r.contractAddress!;
    };
    const nsKey = gallery ? "galleryNamespace" : "namespace";
    const childKey = gallery ? "galleryRegistry" : "artwork";
    const childLabel = gallery ? "exhibitions" : "art";
    const childContract = gallery ? "GalleryRegistry" : "ArtworkRegistry";
    const existing = await client.readContract({
      address: root,
      abi: parentAbi,
      functionName: "getSubregistry",
      args: [label],
    });
    if (existing !== zeroAddress && !same(existing, n[nsKey]))
      throw Error(
        "This ENS name already points to a registry. Import its compatible addresses before resuming; setup will not overwrite it.",
      );
    if (!isAddress(n[nsKey]))
      checkpoint({
        [nsKey]: await transact("ParticipantRegistry", [
          config.ens.LabelStore,
          root,
          label,
          a,
        ]),
        ...(gallery ? { galleryParentName: name } : {}),
      });
    const ns = n[nsKey];
    const relation = await read(ns, "ParticipantRegistry", "getParent");
    if (
      !same(await read(ns, "ParticipantRegistry", "participant"), a) ||
      !same(relation[0], root) ||
      relation[1] !== label
    )
      throw Error(
        "Saved namespace does not belong to this wallet and ENS name.",
      );
    if (!isAddress(n[childKey]))
      checkpoint({
        [childKey]: await transact(childContract, [
          config.ens.LabelStore,
          ns,
          namehash(childLabel + "." + name),
          a,
        ]),
      });
    const child = n[childKey];
    const childParent = await read(child, childContract, "getParent");
    if (
      !same(
        await read(child, childContract, gallery ? "gallery" : "artist"),
        a,
      ) ||
      !same(childParent[0], ns) ||
      childParent[1] !== childLabel ||
      (await read(child, childContract, "namespaceNode")) !==
        namehash(childLabel + "." + name)
    )
      throw Error("Saved collection does not match this wallet and namespace.");
    const attached = await read(ns, "ParticipantRegistry", "getSubregistry", [
      childLabel,
    ]);
    if (attached !== zeroAddress && !same(attached, child))
      throw Error("Namespace already has a different collection.");
    if (!same(attached, child))
      await transact("ParticipantRegistry", [childLabel, child], ns, "attach");
    if (!same(existing, ns))
      await transact(
        "ParticipantRegistry",
        [BigInt(keccak256(stringToHex(label))), ns],
        root,
        "setSubregistry",
      );
    if (!gallery) {
      if (!isAddress(n.mandates))
        checkpoint({ mandates: await transact("MandateRegistry", [child]) });
      if (!same(await read(n.mandates, "MandateRegistry", "artwork"), child))
        throw Error("Mandates reference a different artwork registry.");
      if (!isAddress(n.settlement))
        checkpoint({
          settlement: await transact("SimpleSettlement", [n.mandates]),
        });
      if (
        !same(
          await read(n.settlement, "SimpleSettlement", "mandates"),
          n.mandates,
        )
      )
        throw Error("Settlement references different mandates.");
    }
    setView(gallery ? "gallery" : "artist");
    setMessage(
      (gallery ? "Gallery" : "Artist") +
        " setup complete. Open Workspace to " +
        (gallery
          ? "accept artist submissions and publish exhibitions."
          : "issue artwork and submit it to a gallery."),
    );
  }
  const field = (f: FormData, k: string) => String(f.get(k) || "");
  const uri = (s: string) => "ipfs://" + s.replace(/^ipfs:\/\//, "");
  async function issue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act(async () => {
      const { account: a } = await wallet();
      const imageURI = uri(field(f, "image"));
      const manifestURI = uri(field(f, "manifest"));
      contentHash(imageURI);
      const agreementURI = field(f, "agreement");
      const agreementHash = field(f, "agreementHash") || zeroHash;
      if (agreementURI) contentHash(agreementURI);
      await write(links.artwork, "ArtworkRegistry", "issue", [
        {
          label: field(f, "label"),
          title: field(f, "title"),
          year: Number(field(f, "year")),
          medium: field(f, "medium"),
          dimensions: field(f, "dimensions"),
          imageURI,
          manifestURI,
          contenthash: contentHash(manifestURI),
          agreementURI,
          agreementHash,
          artist: a,
          royaltyRecipient: field(f, "recipient") || a,
          royaltyBps: Number(field(f, "bps")),
        },
      ]);
      setMessage("Artwork issued. Genesis records are permanently locked.");
      go("artwork");
    });
  }
  async function createMandate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act(async () => {
      const roles = (f.has("sale") ? 257n : 0n) | (f.has("exhibit") ? 16n : 0n);
      await write(links.mandates, "MandateRegistry", "create", [
        art.tokenId,
        field(f, "gallery"),
        parseEther(field(f, "price") || "0"),
        Number(field(f, "commission")),
        BigInt(Math.floor(new Date(field(f, "expires")).getTime() / 1000)),
        roles,
      ]);
    });
  }
  function share(perspective = view) {
    const url = new URL(location.href);
    url.search = "";
    for (const [k, v] of Object.entries(links))
      if (v) url.searchParams.set(k, v);
    url.searchParams.set("parentName", parent);
    url.searchParams.set("artistName", artistName);
    url.searchParams.set("view", perspective);
    return url.toString();
  }
  const gateway = (u: string) =>
    u.startsWith("ipfs://")
      ? (config?.ipfsGateway || "https://ipfs.io/ipfs/") + u.slice(7)
      : "";
  const canIssue = isAddress(links.artwork) && same(account, registryArtist);
  const steps = [
    ["01", "Issue", "An artist gives a physical work an identity."],
    ["02", "Delegate", "A gallery receives authority, not ownership."],
    ["03", "Exhibit", "An independent registry records the exhibition."],
    ["04", "Collect", "Ownership changes. The original record stays."],
  ];
  return (
    <>
      <header>
        <a className="brand" href="#artwork" onClick={() => go("artwork")}>
          <span className="brand-symbol">◈</span>
          <span>
            {(config?.projectName || "Artwork Commons").toUpperCase()}
            <small>AN OPEN ARTIST MARKETPLACE TEMPLATE</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {[
            ["artwork", "The artwork"],
            ["workspace", "Workspace"],
            ["setup", "Setup"],
            ["roadmap", "What’s next"],
          ].map(([t, l]) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => go(t)}
            >
              {l}
            </button>
          ))}
        </nav>
        <button className="wallet" onClick={() => act(connect)} disabled={busy}>
          {account ? short(account) : "Connect wallet ↗"}
        </button>
      </header>
      <div className="network">
        <span>
          <i /> ETHEREUM SEPOLIA <span className="muted">/ TESTNET</span>
        </span>
        <span>
          {block ? "BLOCK " + Number(block).toLocaleString() : "CONNECTING…"}{" "}
          <button aria-label="Refresh chain state" onClick={() => act(refresh)}>
            ↻
          </button>
        </span>
      </div>
      <main>
        {(error || message || busy) && (
          <div
            className={"notice " + (error ? "error" : "")}
            role={error ? "alert" : "status"}
          >
            {error || message || (busy ? "Waiting for wallet…" : "")}
            {tx && (
              <a target="_blank" rel="noreferrer" href={explorer(tx)}>
                View transaction ↗
              </a>
            )}
          </div>
        )}
        {tab === "artwork" && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">ONE ARTWORK. A CONTINUOUS HISTORY.</p>
                <h1>
                  Art has a life.
                  <br />
                  <em>Give it an identity.</em>
                </h1>
                <p className="intro">
                  Created by an artist. Shown by a gallery. Collected by someone
                  new.
                  <br />
                  One name connects every chapter.
                </p>
              </div>
              <div className="perspectives">
                <span className="eyebrow">VIEW AS</span>
                {["artist", "gallery", "collector"].map((v) => (
                  <button
                    className={view === v ? "chosen" : ""}
                    onClick={() => setView(v)}
                    key={v}
                  >
                    {v} <span>↗</span>
                  </button>
                ))}
                <small>
                  Perspectives change the view.
                  <br />
                  Your wallet determines authority.
                </small>
              </div>
            </div>
            <section className="art-layout">
              <div className="art-visual">
                <div className="art-frame">
                  <img
                    src={live ? gateway(art.imageURI) : "/blue-mountain.svg"}
                    alt={art.title}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement?.setAttribute(
                        "data-unavailable",
                        "Image unavailable from IPFS",
                      );
                    }}
                    onLoad={(e) => {
                      e.currentTarget.style.display = "block";
                      e.currentTarget.parentElement?.removeAttribute(
                        "data-unavailable",
                      );
                    }}
                  />
                </div>
                <div className="caption">
                  <span>
                    {live
                      ? "ARTWORK REFERENCE IMAGE"
                      : "ILLUSTRATIVE PHYSICAL-ART EXAMPLE"}
                  </span>
                  <span>
                    {live ? "IPFS CONTENT" : "NOT ISSUED · NOT FOR SALE"}
                  </span>
                </div>
              </div>
              <div className="art-summary">
                <div className="tags">
                  <span className="tag">
                    {live ? "GENESIS LOCKED" : "PREVIEW"}
                  </span>
                  <span className="tag outline">PHYSICAL ARTWORK</span>
                </div>
                {arts.length > 1 && (
                  <label>
                    Select artwork
                    <select
                      value={String(art.id)}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {arts.map((a) => (
                        <option key={String(a.id)} value={String(a.id)}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <h2>{art.title}</h2>
                <p className="byline">
                  By {artistName} <span>·</span> {art.year}
                </p>
                <p className="nameplate">{fullName}</p>
                <dl className="facts">
                  <div>
                    <dt>Medium</dt>
                    <dd>{art.medium}</dd>
                  </div>
                  <div>
                    <dt>Dimensions</dt>
                    <dd>{art.dimensions}</dd>
                  </div>
                  <div>
                    <dt>Original creator</dt>
                    <dd>
                      {live ? (
                        <a href={explorer(art.artist)}>{short(art.artist)} ↗</a>
                      ) : (
                        artistName
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Current token owner</dt>
                    <dd>
                      {live ? (
                        <a href={explorer(art.owner)}>{short(art.owner)} ↗</a>
                      ) : (
                        "Not yet issued"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Authorized gallery</dt>
                    <dd>
                      {relatedMandates.find((m) => m.active || m.canExhibit)
                        ? short(
                            relatedMandates.find(
                              (m) => m.active || m.canExhibit,
                            )!.gallery,
                          )
                        : "No active mandate"}
                    </dd>
                  </div>
                  {live && art.presentation.publicLocation && (
                    <div>
                      <dt>Location statement</dt>
                      <dd>
                        {art.presentation.publicLocation}
                        <small>By {short(art.presentation.author)}</small>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>Artist resale royalty</dt>
                    <dd>
                      {Number(art.royaltyBps) / 100}%{" "}
                      <small>through this settlement</small>
                    </dd>
                  </div>
                </dl>
                {offer ? (
                  <div className="purchase">
                    <span>LISTED FOR</span>
                    <strong>
                      {formatEther(offer.price)} <small>TEST ETH</small>
                    </strong>
                    <button
                      className="button dark"
                      disabled={busy || !linked}
                      onClick={() =>
                        act(async () => {
                          await write(
                            links.settlement,
                            "SimpleSettlement",
                            "buy",
                            [offer.id],
                            offer.price,
                          );
                        })
                      }
                    >
                      Collect artwork ↗
                    </button>
                    <p>
                      Transfers the NFT. Physical delivery is arranged
                      separately under the artist’s terms.
                    </p>
                  </div>
                ) : (
                  <div className="purchase">
                    <p>
                      {live
                        ? "No active sale. Ownership remains with the current owner."
                        : "Follow one artwork from issuance to its first collector."}
                    </p>
                    <button
                      className="button dark"
                      onClick={() =>
                        go(isAddress(links.artwork) ? "workspace" : "setup")
                      }
                    >
                      {live ? "Open workspace" : "Set up your artist registry"}{" "}
                      ↗
                    </button>
                  </div>
                )}
              </div>
            </section>
            <section className="section">
              <div className="section-top">
                <div>
                  <p className="eyebrow">THE LIFE OF AN ARTWORK</p>
                  <h2>One identity. Many participants.</h2>
                </div>
                <p>
                  Every action has an author.
                  <br />
                  Every relationship has a scope.
                </p>
              </div>
              <div className="life-steps">
                {steps.map(([n, t, d]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="section record-grid">
              <div>
                <p className="eyebrow">PERMANENT IDENTITY</p>
                <h2>
                  Ownership changes.
                  <br />
                  <em>History stays.</em>
                </h2>
                <p>
                  The original artist, reference image, manifest and royalty
                  terms are fixed when the artwork is issued.
                </p>
                <div className="record-links">
                  {live ? (
                    <>
                      <a
                        href={gateway(art.manifestURI)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Original manifest ↗
                      </a>
                      <a
                        href={gateway(art.imageURI)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Canonical image ↗
                      </a>
                      <button
                        onClick={() =>
                          act(async () => {
                            const result = await resolveContent(fullName);
                            if (result !== art.contenthash)
                              throw Error(
                                "Resolved contenthash differs from genesis.",
                              );
                            setMessage(
                              "Universal Resolver verified the immutable artwork contenthash.",
                            );
                          })
                        }
                      >
                        Verify ENS resolution ↗
                      </button>
                      {art.agreementURI && (
                        <a
                          href={gateway(art.agreementURI)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Referenced sale agreement ↗
                        </a>
                      )}
                    </>
                  ) : (
                    <span>Records become available after issuance.</span>
                  )}
                </div>
                <p className="fine">
                  A wallet transaction attributes issuance to the artist. This
                  does not independently authenticate the physical object or
                  execute a legal agreement.
                </p>
              </div>
              <div className="timeline">
                <h3>Provenance</h3>
                {!live ? (
                  <div className="timeline-item">
                    <span className="dot" />
                    <strong>Waiting for the first chapter</strong>
                    <p>No onchain history is claimed for this preview.</p>
                  </div>
                ) : (
                  <>
                    {[
                      {
                        time: art.issuedAt,
                        title: "Issued by the artist",
                        body: short(art.artist) + " · Genesis locked",
                      },
                      ...relatedExhibitions.map((e) => ({
                        time: e.recordedAt,
                        title: "Exhibited · " + e.title,
                        body: short(e.issuer) + " · Gallery-authored statement",
                      })),
                      ...artListings
                        .filter((l) => l.sold)
                        .map((l) => ({
                          time: l.sale[6],
                          title: "Collected by " + short(l.sale[0]),
                          body:
                            formatEther(l.sale[3]) +
                            " test ETH · " +
                            formatEther(l.sale[5]) +
                            " artist royalty",
                        })),
                    ]
                      .sort((a, b) => Number(a.time - b.time))
                      .map((h, i) => (
                        <div className="timeline-item" key={i}>
                          <span className="dot" />
                          <small>{date(h.time)}</small>
                          <strong>{h.title}</strong>
                          <p>{h.body}</p>
                        </div>
                      ))}
                    <div className="timeline-item">
                      <span className="dot current" />
                      <strong>Current owner · {short(art.owner)}</strong>
                      <p>Read directly from the artwork registry.</p>
                    </div>
                  </>
                )}
              </div>
            </section>
            <section className="section">
              <div className="section-top">
                <div>
                  <p className="eyebrow">INDEPENDENT RECORDS</p>
                  <h2>A gallery adds its chapter.</h2>
                </div>
                <span className="tag outline">
                  {galleryLinked
                    ? "GALLERY ENS LINK VERIFIED"
                    : "GALLERY NAMESPACE NOT LINKED"}
                </span>
              </div>
              {relatedExhibitions.length ? (
                relatedExhibitions.map((e) => (
                  <article className="exhibition-card" key={String(e.id)}>
                    <span className="exhibition-number">↗</span>
                    <div>
                      <h3>{e.title}</h3>
                      <p className="mono">
                        {e.label}.exhibitions.{links.galleryParentName}
                      </p>
                      <p>
                        {e.custodyStatement || "No custody statement supplied."}
                      </p>
                      <small>
                        Statement by {short(e.issuer)}. Physical custody is not
                        independently verified.
                      </small>
                    </div>
                    <a
                      href={gateway(e.manifestURI)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Manifest ↗
                    </a>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  No exhibition records yet. An authorized gallery can publish
                  one from its own registry.
                </div>
              )}
            </section>
            <section className="closing">
              <p className="eyebrow">
                THE INTERFACE IS A WINDOW. THE RECORDS ARE SHARED.
              </p>
              <h2>Your website is one way in.</h2>
              <p>
                Artist sites, gallery sites and collector views can read the
                same Sepolia contracts.
                <br />
                No central gallery database owns the artwork’s history.
              </p>
              <button
                className="button"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(share())
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError("Copy the page URL from the address bar."),
                    );
                }}
              >
                {copied
                  ? "Link copied ✓"
                  : "Copy this collection’s shared view ↗"}
              </button>
              <a
                className="button"
                href={share()
                  .replace(
                    location.origin,
                    config?.gallerySiteUrl ||
                      "https://eonmun-gallery-demo.ncrmro.workers.dev",
                  )
                  .replace(/view=artist|view=collector/, "view=gallery")}
                target="_blank"
                rel="noreferrer"
              >
                Open independent gallery site ↗
              </a>
            </section>
          </>
        )}
        {tab === "workspace" && (
          <section className="page">
            <p className="eyebrow">THREE PARTICIPANTS. DISTINCT AUTHORITY.</p>
            <h1>
              The working
              <br />
              <em>life of art.</em>
            </h1>
            <div className="role-tabs">
              {["artist", "gallery", "collector"].map((v) => (
                <button
                  key={v}
                  className={view === v ? "chosen" : ""}
                  onClick={() => setView(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="wallet-context">
              Signing account:{" "}
              <code>{account || "Connect a wallet to act"}</code> · Ethereum
              Sepolia
            </div>
            <div className="permissions">
              <div>
                <strong>Immutable</strong>
                <p>Genesis, original artist, manifest, reference image.</p>
                <small>Editable by nobody after issuance.</small>
              </div>
              <div>
                <strong>Owner-derived</strong>
                <p>Mandates, presentation and settlement approval.</p>
                <small>{live ? short(art.owner) : "Current token owner"}</small>
              </div>
              <div>
                <strong>Delegated</strong>
                <p>Exhibition and sale, within an accepted mandate.</p>
                <small>Expires, can be revoked, ends on transfer.</small>
              </div>
            </div>
            {view === "artist" && (
              <div className="split">
                <form className="panel" onSubmit={issue}>
                  <h2>Issue a physical artwork</h2>
                  <p>
                    Its genesis is permanent. Pin the image and JSON manifest to
                    IPFS before issuing.
                  </p>
                  <Field
                    label="Title"
                    name="title"
                    placeholder="Blue Mountain"
                  />
                  <Field
                    label="Artwork label"
                    name="label"
                    placeholder="blue-mountain"
                  />
                  <small className="mono">.art.{parent}</small>
                  <div className="form-row">
                    <Field
                      label="Year"
                      name="year"
                      type="number"
                      value="2026"
                    />
                    <Field
                      label="Dimensions"
                      name="dimensions"
                      placeholder="48 × 116 in"
                    />
                  </div>
                  <Field
                    label="Medium"
                    name="medium"
                    placeholder="Acrylic and gold leaf on linen"
                  />
                  <Field
                    label="Canonical image IPFS URI"
                    name="image"
                    placeholder="ipfs://bafy…"
                  />
                  <Field
                    label="Artwork manifest IPFS URI"
                    name="manifest"
                    placeholder="ipfs://bafy…"
                  />
                  <div className="form-row">
                    <Field
                      label="Royalty basis points"
                      name="bps"
                      type="number"
                      value="500"
                    />
                    <Field
                      label="Royalty recipient"
                      name="recipient"
                      value={account}
                      required={false}
                      placeholder="Defaults to artist"
                    />
                  </div>
                  <details>
                    <summary>
                      Reference a physical sale agreement (optional)
                    </summary>
                    <Field
                      label="Agreement IPFS URI"
                      name="agreement"
                      required={false}
                    />
                    <Field
                      label="Agreement keccak256 hash"
                      name="agreementHash"
                      required={false}
                      placeholder="0x…"
                    />
                    <p>
                      This anchors a document reference. Legal execution and
                      delivery are not implemented.
                    </p>
                  </details>
                  <button className="button dark" disabled={busy || !canIssue}>
                    Issue & lock genesis ↗
                  </button>
                  {!canIssue && (
                    <p>
                      Connect the artist wallet and complete{" "}
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => go("setup")}
                      >
                        setup
                      </button>{" "}
                      first.
                    </p>
                  )}
                </form>
                <aside className="panel tinted">
                  <p className="eyebrow">WHAT ISSUANCE MEANS</p>
                  <h2>
                    A physical work.
                    <br />
                    An enduring record.
                  </h2>
                  <p>
                    The NFT identifies the work through its artist, title,
                    material, dimensions and original reference files.
                  </p>
                  <p>
                    The owner can change public presentation details, but cannot
                    rewrite what the artist originally issued.
                  </p>
                  <p className="fine">
                    NFT ownership and physical possession are distinct. Custody
                    statements are attributable claims, not proof of delivery.
                  </p>
                </aside>
              </div>
            )}
            {(view === "collector" || view === "artist") && live && (
              <div className="split">
                <form className="panel" onSubmit={createMandate}>
                  <h2>Submit artwork to a gallery</h2>
                  <p>{fullName}</p>
                  <Field
                    label="Gallery wallet"
                    name="gallery"
                    placeholder="0x…"
                  />
                  <div className="form-row">
                    <Field
                      label="Minimum price (test ETH)"
                      name="price"
                      value="0.01"
                    />
                    <Field
                      label="Commission basis points"
                      name="commission"
                      type="number"
                      value="1000"
                    />
                  </div>
                  <Field
                    label="Mandate expiry"
                    name="expires"
                    type="datetime-local"
                    value={new Date(Date.now() + 7 * 86400000)
                      .toISOString()
                      .slice(0, 16)}
                  />
                  <label className="check">
                    <input type="checkbox" name="sale" defaultChecked /> May
                    list and initiate a sale
                  </label>
                  <label className="check">
                    <input type="checkbox" name="exhibit" defaultChecked /> May
                    publish an exhibition
                  </label>
                  <button
                    className="button dark"
                    disabled={busy || !owner || !isAddress(links.mandates)}
                  >
                    Submit to gallery ↗
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={!isAddress(links.mandates)}
                    onClick={() => {
                      const u = new URL(share("gallery"));
                      u.hash = "workspace";
                      history.replaceState(null, "", u.toString());
                      setMessage(
                        "Copy the address bar URL and send it to your gallery. They open it, connect their wallet, and accept the submission in Workspace.",
                      );
                    }}
                  >
                    Create gallery submission link ↗
                  </button>
                  <p className="fine">
                    Share this workspace using the deployment link below Setup.
                    The gallery must accept your submission before exhibiting or
                    selling. It receives no token ownership or unrestricted
                    transfer approval.
                  </p>
                </form>
                <div className="panel">
                  <h2>Owner presentation</h2>
                  <p>
                    The current owner can update these fields. The genesis
                    remains locked.
                  </p>
                  <form
                    key={String(art.id) + account}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act(async () => {
                        await write(
                          links.artwork,
                          "ArtworkRegistry",
                          "setPresentation",
                          [
                            art.tokenId,
                            field(f, "location"),
                            field(f, "website"),
                          ],
                        );
                      });
                    }}
                  >
                    <Field
                      label="Public location"
                      name="location"
                      value={art.presentation.publicLocation}
                      required={false}
                    />
                    <Field
                      label="Owner website"
                      name="website"
                      value={art.presentation.ownerWebsite}
                      required={false}
                    />
                    <button className="button" disabled={busy || !owner}>
                      Update presentation ↗
                    </button>
                  </form>
                  <h3>Settlement approval</h3>
                  <p>
                    Approve the settlement contract to transfer a token only
                    when a valid sale is paid. Do not approve the gallery
                    itself.
                  </p>
                  <button
                    className="button"
                    disabled={busy || !owner || !isAddress(links.settlement)}
                    onClick={() =>
                      act(async () => {
                        await write(
                          links.artwork,
                          "ArtworkRegistry",
                          "setApprovalForAll",
                          [links.settlement, !approved],
                        );
                      })
                    }
                  >
                    {approved
                      ? "Revoke settlement approval"
                      : "Approve settlement"}{" "}
                    ↗
                  </button>
                  <p className="fine">
                    ERC-1155 approval covers all your tokens in this collection.
                    The settlement contract restricts its use to accepted
                    mandates.
                  </p>
                </div>
              </div>
            )}
            {view === "collector" && !live && (
              <div className="empty-state">
                The collector view becomes active after the artist issues a
                work. Until then, explore the illustrative artwork.
              </div>
            )}
            <section className="section">
              <h2>Gallery mandates</h2>
              {relatedMandates.length ? (
                relatedMandates.map((m) => (
                  <div className="mandate panel" key={String(m.id)}>
                    <div className="section-top">
                      <h3>
                        Mandate #{String(m.id)} · {short(m.gallery)}
                      </h3>
                      <span className="tag">
                        {m.revoked
                          ? "REVOKED"
                          : m.active || m.canExhibit
                            ? "ACTIVE"
                            : m.accepted
                              ? "INACTIVE / ENDED"
                              : "AWAITING ACCEPTANCE"}
                      </span>
                    </div>
                    <p>
                      Owner {short(m.owner)} · Minimum {formatEther(m.minPrice)}{" "}
                      test ETH · {Number(m.commissionBps) / 100}% commission ·
                      Expires{" "}
                      {new Date(Number(m.expires) * 1000).toLocaleString()}
                    </p>
                    <p>
                      Exhibit {m.roles & 16n ? "✓" : "—"} · List and sell{" "}
                      {(m.roles & 257n) === 257n ? "✓" : "—"} · Edit genesis ✕ ·
                      Transfer arbitrarily ✕
                    </p>
                    <div className="actions">
                      {!m.accepted &&
                        !m.revoked &&
                        same(account, m.gallery) && (
                          <button
                            className="button"
                            disabled={busy}
                            onClick={() =>
                              act(async () => {
                                await write(
                                  links.mandates,
                                  "MandateRegistry",
                                  "accept",
                                  [m.id],
                                );
                              })
                            }
                          >
                            Accept submission #{String(m.id)} ↗
                          </button>
                        )}
                      {owner && !m.revoked && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            act(async () => {
                              await write(
                                links.mandates,
                                "MandateRegistry",
                                "revoke",
                                [m.id],
                              );
                            })
                          }
                        >
                          Revoke mandate #{String(m.id)}
                        </button>
                      )}
                    </div>
                    {view === "gallery" &&
                      same(account, m.gallery) &&
                      m.active && (
                        <form
                          className="inline-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void act(async () => {
                              await write(
                                links.settlement,
                                "SimpleSettlement",
                                "list",
                                [m.id, parseEther(field(f, "price"))],
                              );
                            });
                          }}
                        >
                          <Field
                            label={"Listing price for mandate " + String(m.id)}
                            name="price"
                            value={formatEther(m.minPrice)}
                          />
                          <button
                            className="button dark"
                            disabled={
                              busy || !linked || !isAddress(links.settlement)
                            }
                          >
                            List artwork #{String(m.id)} ↗
                          </button>
                        </form>
                      )}
                    {view === "gallery" &&
                      same(account, m.gallery) &&
                      m.canExhibit && (
                        <form
                          className="exhibit-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void act(async () => {
                              const manifest = uri(field(f, "manifest"));
                              await write(
                                links.galleryRegistry,
                                "GalleryRegistry",
                                "publish",
                                [
                                  {
                                    label: field(f, "label"),
                                    title: field(f, "title"),
                                    manifestURI: manifest,
                                    contenthash: contentHash(manifest),
                                    custodyStatement: field(f, "custody"),
                                  },
                                  links.mandates,
                                  m.id,
                                ],
                              );
                            });
                          }}
                        >
                          <h3>Publish an exhibition</h3>
                          <Field
                            label="Exhibition title"
                            name="title"
                            placeholder="Tokyo 2026"
                          />
                          <Field
                            label="Exhibition label"
                            name="label"
                            placeholder="tokyo-2026"
                          />
                          <Field
                            label="Exhibition manifest URI"
                            name="manifest"
                            placeholder="ipfs://bafy…"
                          />
                          <Field
                            label="Custody statement (unverified)"
                            name="custody"
                            required={false}
                            placeholder="Gallery reports receiving the painting on…"
                          />
                          <button
                            className="button"
                            disabled={busy || !galleryLinked}
                          >
                            Publish exhibition #{String(m.id)} ↗
                          </button>
                          {!galleryLinked && (
                            <p>
                              Deploy and link your gallery registry in Setup.
                            </p>
                          )}
                        </form>
                      )}
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  No mandates for this artwork yet. The current owner creates
                  the first one.
                </div>
              )}
            </section>
            <div className="panel proceeds">
              <div>
                <p className="eyebrow">YOUR SETTLEMENT PROCEEDS</p>
                <h2>
                  {formatEther(proceeds)} <small>test ETH</small>
                </h2>
                <p>
                  Sales credit the seller, gallery commission, and artist resale
                  royalty. Withdraw to your connected wallet.
                </p>
              </div>
              <button
                className="button dark"
                disabled={busy || proceeds === 0n}
                onClick={() =>
                  act(async () => {
                    await write(
                      links.settlement,
                      "SimpleSettlement",
                      "withdraw",
                    );
                  })
                }
              >
                Withdraw proceeds ↗
              </button>
            </div>
          </section>
        )}
        {tab === "setup" && (
          <section className="page">
            <p className="eyebrow">YOUR NAME. YOUR REGISTRY. YOUR WEBSITE.</p>
            <h1>
              Start your
              <br />
              <em>own chapter.</em>
            </h1>
            <p className="intro">
              Deploy independent registries on Ethereum Sepolia. Your wallet
              signs every action.
              <br />
              EON MUN is the example artist. This template is for any artist and
              gallery.
            </p>
            <div className="wallet-context">
              Connected: <code>{account || "No wallet"}</code>
              <button className="text-button" onClick={() => act(connect)}>
                Connect / refresh account ↗
              </button>
            </div>
            <div className="split">
              <div className="panel">
                <span className="tag">ARTIST</span>
                <h2>art.{parent}</h2>
                <p>
                  ENS owner:{" "}
                  {parentOwner === zeroAddress
                    ? "Not registered"
                    : short(parentOwner)}{" "}
                  · {linked ? "Namespace linked ✓" : "Not linked yet"}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void act(async () => {
                      const chosen = validateParent(field(f, "parent"));
                      const u = new URL(location.href);
                      u.search = new URLSearchParams({
                        parentName: chosen,
                        artistName: field(f, "artist") || chosen,
                      }).toString();
                      u.hash = "setup";
                      location.assign(u.toString());
                    });
                  }}
                >
                  <Field
                    label="Artist ENS parent"
                    name="parent"
                    value={parent}
                  />
                  <Field
                    label="Artist display name"
                    name="artist"
                    value={artistName}
                  />
                  <button className="button" disabled={busy}>
                    Use this artist name
                  </button>
                </form>
                <p>
                  Your connected wallet owns the namespace and artwork
                  collection. Setup also deploys gallery permissions and
                  settlement contracts.
                </p>
                <button
                  className="button dark"
                  disabled={busy}
                  onClick={() => act(() => setupWallet(false, parent))}
                >
                  Create / resume artist registry ↗
                </button>
                <p className="fine">
                  Up to six Sepolia transactions, each confirmed in your wallet.
                  Completed deployments are saved in this browser. You can
                  resume after declining a transaction.
                </p>
                <p>
                  {isAddress(links.namespace) ? "Namespace ✓ · " : ""}
                  {isAddress(links.artwork) ? "Artwork registry ✓ · " : ""}
                  {isAddress(links.mandates) ? "Permissions ✓ · " : ""}
                  {isAddress(links.settlement) ? "Settlement ✓" : ""}
                </p>
              </div>
              <div className="panel">
                <span className="tag">GALLERY</span>
                <h2>A registry of your own.</h2>
                <p>
                  Connect the gallery’s wallet and ENS name. The gallery keeps
                  its exhibition records in an independent contract.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void act(() =>
                      setupWallet(true, validateParent(field(f, "name"))),
                    );
                  }}
                >
                  <Field
                    label="Gallery ENS parent"
                    name="name"
                    value={links.galleryParentName}
                    placeholder="your-gallery.eth"
                  />
                  <button className="button" disabled={busy}>
                    Create / resume gallery registry ↗
                  </button>
                </form>
                <p className="mono">
                  {links.galleryParentName
                    ? "exhibitions." + links.galleryParentName
                    : "exhibitions.your-gallery.eth"}
                </p>
                <p>
                  {galleryLinked
                    ? "Gallery namespace linked ✓"
                    : "Up to four Sepolia transactions. Your wallet owns the gallery registry; completed steps are saved."}
                </p>
                <div className="callout">
                  <strong>Authority without ownership</strong>
                  <p>
                    The artist submits an artwork with scoped permission to the
                    gallery wallet. The gallery accepts and lists. The NFT stays
                    with its owner until a collector pays.
                  </p>
                </div>
              </div>
            </div>
            <details className="panel" open>
              <summary>Deployment addresses & independent websites</summary>
              <p>
                Contract addresses are public. Share them across websites, or
                export this configuration into your own template deployment. The
                earlier storefront contracts are not compatible with this
                lifecycle version.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(async () => {
                    const n = { ...empty };
                    for (const k of Object.keys(empty) as (keyof Lifecycle)[]) {
                      const v = field(f, k);
                      if (v && k !== "galleryParentName" && !isAddress(v))
                        throw Error("Invalid address: " + k);
                      n[k] = v;
                    }
                    if (n.galleryParentName)
                      validateParent(n.galleryParentName);
                    save(n);
                    setMessage("Saved. Checking contract relationships…");
                  });
                }}
              >
                <div className="config-grid">
                  {Object.entries(links).map(([k, v]) => (
                    <Field
                      key={k + v}
                      label={k}
                      name={k}
                      value={v}
                      required={false}
                    />
                  ))}
                </div>
                <button className="button" disabled={busy}>
                  Use deployment addresses
                </button>
              </form>
              <div className="actions">
                <button
                  className="button"
                  onClick={() => {
                    const b = new Blob(
                      [
                        JSON.stringify(
                          { ...config, lifecycle: links },
                          null,
                          2,
                        ),
                      ],
                      { type: "application/json" },
                    );
                    const u = URL.createObjectURL(b);
                    const a = document.createElement("a");
                    a.href = u;
                    a.download = "artist.config.json";
                    a.click();
                    URL.revokeObjectURL(u);
                  }}
                >
                  Export configuration ↓
                </button>
                <button
                  className="button"
                  onClick={() => {
                    history.replaceState(null, "", share());
                    setMessage(
                      "The address bar now contains the shareable collection URL.",
                    );
                  }}
                >
                  Create shareable URL ↗
                </button>
              </div>
            </details>
            <p className="fine">
              ENS parent ownership retains control of the parent registry link.
              Keep the name renewed. IPFS files need continued pinning.
              Addresses are saved in this browser until you export them into the
              deployed configuration.
            </p>
          </section>
        )}
        {tab === "roadmap" && (
          <section className="page">
            <p className="eyebrow">A FOCUSED PROTOCOL DEMO</p>
            <h1>
              A first chapter.
              <br />
              <em>A longer horizon.</em>
            </h1>
            <p className="intro">
              The core build connects artist, gallery and collector through
              independently controlled records.
            </p>
            <div className="split">
              <div className="panel">
                <span className="tag">
                  IMPLEMENTED · SEPOLIA WALLET SETUP REQUIRED
                </span>
                <h2>The lifecycle demo</h2>
                <ul className="feature-list">
                  {[
                    "Artist and gallery ENS registry deployment",
                    "Artwork subname as a singleton NFT",
                    "Immutable physical-art genesis records",
                    "Scoped, expiring gallery mandates using EAC",
                    "Exhibition and custody statements attributed to a gallery",
                    "Owner-to-collector settlement with payment splits",
                    "Shared contract reads across independent websites",
                  ].map((t) => (
                    <li key={t}>↗ {t}</li>
                  ))}
                </ul>
                <p className="fine">
                  Implementation and simulated tests are not a completed
                  public-chain demonstration. Live contracts, artwork files and
                  transactions must be supplied through Setup and Workspace.
                </p>
              </div>
              <div className="panel tinted">
                <span className="tag outline">COMING SOON</span>
                <h2>The next chapters</h2>
                <ul className="feature-list">
                  {[
                    "Policy-enforced secondary sales across marketplaces",
                    "Holding periods and right of first refusal",
                    "Verified custody, logistics and insured delivery",
                    "Legally reviewed agreements and execution",
                    "Museum lending and conservator workflows",
                    "Auctions, recovery and inheritance",
                  ].map((t) => (
                    <li key={t}>○ {t}</li>
                  ))}
                </ul>
                <p className="fine">
                  The current settlement pays configured royalties on its own
                  sales. It does not enforce them on outside transfers.
                </p>
              </div>
            </div>
            <div className="closing">
              <h2>
                One artwork. One identity.
                <br />
                Many participants.
              </h2>
              <p>
                ENS provides names. ERC-1155 provides token ownership.
                <br />
                Application EAC scopes gallery authority. Each participant
                authors their own records.
              </p>
              <a
                className="button"
                href="https://github.com/ncrmro/ens-artwork-template"
                target="_blank"
                rel="noreferrer"
              >
                Use the open template ↗
              </a>
            </div>
          </section>
        )}
      </main>
      <footer>
        <span>
          ARTWORK COMMONS{" "}
          <small>Working title · Open artist marketplace template</small>
        </span>
        <span>
          Example artist: <strong>EON MUN</strong> · {parent}
          <br />
          <small>
            Ethereum Sepolia · Physical-art records, independently owned.
          </small>
        </span>
        <a href="https://github.com/ncrmro/ens-artwork-template">Source ↗</a>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
