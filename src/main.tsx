import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  formatEther,
  parseEther,
  isAddress,
  zeroAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import {
  client,
  contracts,
  parentAbi,
  wallet,
  receipt,
  contentHash,
  resolveContent,
  validateParent,
  normalize,
  type Config,
} from "./chain";
import "./style.css";

type Art = {
  id: bigint;
  tokenId: bigint;
  label: string;
  title: string;
  metadataURI: string;
  contenthash: Hex;
  recipient: Address;
  bps: number;
  owner: Address;
  listing: { seller: Address; price: bigint; deadline: bigint; nonce: bigint };
  image?: string;
};
const short = (s: string) => (s ? s.slice(0, 6) + "…" + s.slice(-4) : "—");
const explorer = (h: string) =>
  "https://sepolia.etherscan.io/" + (h.length === 66 ? "tx/" : "address/") + h;
const safeLink = (uri: string, gateway: string) =>
  uri.startsWith("ipfs://") ? gateway + uri.slice(7) : "";
const read = async (
  address: Address,
  name: string,
  fn: string,
  args: readonly unknown[] = [],
) =>
  client.readContract({
    address,
    abi: contracts[name].abi,
    functionName: fn,
    args,
  });

function App() {
  const [config, setConfig] = useState<Config>();
  const [tab, setTab] = useState(location.hash.slice(1) || "gallery");
  const [account, setAccount] = useState<Address>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tx, setTx] = useState<Hex>();
  const [registry, setRegistry] = useState("");
  const [sale, setSale] = useState("");
  const [example, setExample] = useState("");
  const [parent, setParent] = useState("eonmoon.eth");
  const [block, setBlock] = useState("");
  const [parentOwner, setParentOwner] = useState("");
  const [linked, setLinked] = useState(false);
  const [arts, setArts] = useState<Art[]>([]);
  const [artist, setArtist] = useState("");
  const [balance, setBalance] = useState("0");
  const [selected, setSelected] = useState<Art>();
  const [networkError, setNetworkError] = useState("");
  const [exampleRead, setExampleRead] = useState("");
  const go = (next: string) => {
    setTab(next);
    location.hash = next;
    setMessage("");
  };
  useEffect(() => {
    const handler = () => setTab(location.hash.slice(1) || "gallery");
    window.addEventListener("hashchange", handler);
    fetch("/api/config")
      .then(async (r) => (await r.json()) as Config)
      .then((c: Config) => {
        if (c.chainId !== 11155111)
          throw Error("This template only supports Ethereum Sepolia.");
        setConfig(c);
        setParent(c.parentName);
        document.title = c.name + " — Art under your name";
        const q = new URLSearchParams(location.search);
        let saved: Record<string, string> = {};
        try {
          saved = JSON.parse(
            localStorage.getItem("eonmoon:" + c.parentName) || "{}",
          );
        } catch {}
        setRegistry(q.get("registry") || c.registry || saved.registry || "");
        setSale(q.get("sale") || c.sale || saved.sale || "");
        setExample(q.get("example") || c.example || saved.example || "");
      })
      .catch((e) => setNetworkError(String(e)));
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (config) {
      refresh().catch((e) => setNetworkError(e.shortMessage || e.message));
    }
  }, [config, registry, sale, account]);
  async function refresh() {
    if (!config) return;
    setNetworkError("");
    if ((await client.getChainId()) !== 11155111)
      throw Error("RPC is not Ethereum Sepolia.");
    setBlock(String(await client.getBlockNumber()));
    const owner = await client.readContract({
      address: config.ens.ETHRegistry,
      abi: parentAbi,
      functionName: "findOwner",
      args: [config.parentName.split(".")[0]],
    });
    setParentOwner(owner);
    const sub = await client.readContract({
      address: config.ens.ETHRegistry,
      abi: parentAbi,
      functionName: "getSubregistry",
      args: [config.parentName.split(".")[0]],
    });
    setLinked(sub.toLowerCase() === registry.toLowerCase());
    if (!isAddress(registry)) return;
    const registryParent = (await read(
      registry,
      "ArtRegistry",
      "getParent",
    )) as [Address, string];
    if (
      registryParent[0].toLowerCase() !==
        config.ens.ETHRegistry.toLowerCase() ||
      registryParent[1] + ".eth" !== config.parentName
    )
      throw Error(
        "Registry does not belong to this configured artist namespace.",
      );
    setArtist((await read(registry, "ArtRegistry", "artist")) as string);
    if (
      isAddress(sale) &&
      ((await read(sale, "ArtSale", "registry")) as string).toLowerCase() !==
        registry.toLowerCase()
    )
      throw Error("Sale contract belongs to another registry.");
    const count = Number(await read(registry, "ArtRegistry", "artworkCount"));
    const all = await Promise.all(
      Array.from({ length: Math.min(count, 100) }, async (_, i) => {
        const id = (await read(registry, "ArtRegistry", "artworkId", [
          BigInt(i),
        ])) as bigint;
        const a = (await read(registry, "ArtRegistry", "artwork", [
          id,
        ])) as Omit<Art, "id" | "tokenId" | "owner" | "listing">;
        const tokenId = (await read(registry, "ArtRegistry", "getTokenId", [
          id,
        ])) as bigint;
        const owner = (await read(registry, "ArtRegistry", "getOwner", [
          id,
        ])) as Address;
        const l = isAddress(sale)
          ? ((await read(sale, "ArtSale", "listings", [tokenId])) as [
              Address,
              bigint,
              bigint,
              bigint,
              bigint,
            ])
          : ([zeroAddress, 0n, 0n, 0n, 0n] as const);
        return {
          ...a,
          bps: Number(a.bps),
          id,
          tokenId,
          owner,
          listing: { seller: l[0], price: l[2], deadline: l[3], nonce: l[4] },
        };
      }),
    );
    setArts(all);
    if (account && isAddress(sale))
      setBalance(
        formatEther(
          (await read(sale, "ArtSale", "proceeds", [account])) as bigint,
        ),
      );
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setTx(undefined);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setMessage(
        (e as { shortMessage?: string; message?: string }).shortMessage ||
          (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    const { account: a } = await wallet();
    setAccount(a);
    setMessage("Wallet connected to Ethereum Sepolia.");
  }
  async function write(
    address: Address,
    name: string,
    fn: string,
    args: readonly unknown[] = [],
    value?: bigint,
  ) {
    const { w, account: a } = await wallet();
    setAccount(a);
    const h = await w.writeContract({
      account: a,
      address,
      abi: contracts[name].abi,
      functionName: fn,
      args,
      value,
    });
    setTx(h);
    setMessage("Waiting for Sepolia confirmation…");
    await receipt(h);
    setMessage("Confirmed on Sepolia.");
  }
  function save(next: { registry?: string; sale?: string; example?: string }) {
    if (!config) return;
    const s = {
      registry: next.registry ?? registry,
      sale: next.sale ?? sale,
      example: next.example ?? example,
    };
    localStorage.setItem("eonmoon:" + config.parentName, JSON.stringify(s));
    setRegistry(s.registry);
    setSale(s.sale);
    setExample(s.example);
  }
  async function deploy(name: string, args: readonly unknown[] = []) {
    const { w, account: a } = await wallet();
    setAccount(a);
    const h = await w.deployContract({ account: a, ...contracts[name], args });
    setTx(h);
    setMessage("Deploying " + name + " on Sepolia…");
    const r = await receipt(h);
    if (!r.contractAddress) throw Error("Missing contract address");
    return r.contractAddress;
  }
  async function setupRegistry() {
    if (!config) return;
    const { account: a } = await wallet();
    const n = validateParent(parent);
    if (n !== config.parentName)
      throw Error(
        "Set the artist parent in artist.config.json before deploying this instance.",
      );
    save({
      registry: await deploy("ArtRegistry", [
        config.ens.LabelStore,
        config.ens.ETHRegistry,
        n.split(".")[0],
        a,
      ]),
      sale: "",
    });
    setMessage(
      "Registry and resolver deployed. Deploy the sale contract next.",
    );
  }
  async function linkParent() {
    if (!config || !isAddress(registry)) return;
    const { w, account: a } = await wallet();
    const label = config.parentName.split(".")[0];
    const owner = await client.readContract({
      address: config.ens.ETHRegistry,
      abi: parentAbi,
      functionName: "findOwner",
      args: [label],
    });
    if (owner.toLowerCase() !== a.toLowerCase())
      throw Error(
        "This wallet does not own " +
          config.parentName +
          " on ENS v2 Sepolia. Register it in the ENS app first.",
      );
    const existing = await client.readContract({
      address: config.ens.ETHRegistry,
      abi: parentAbi,
      functionName: "getSubregistry",
      args: [label],
    });
    if (
      existing !== zeroAddress &&
      existing.toLowerCase() !== registry.toLowerCase()
    )
      throw Error(
        "Parent already has another subregistry. Review that namespace in ENS before replacing it.",
      );
    const h = await w.writeContract({
      account: a,
      address: config.ens.ETHRegistry,
      abi: parentAbi,
      functionName: "setSubregistry",
      args: [BigInt(keccak256(stringToHex(label))), registry],
    });
    setTx(h);
    await receipt(h);
    setMessage("Artist namespace linked.");
  }
  async function publish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act(async () => {
      if (!isAddress(registry))
        throw Error("Deploy or connect the artist registry first.");
      const label = String(f.get("label"));
      if (
        normalize(label) !== label ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label)
      )
        throw Error("Use a lowercase artwork label, without dots.");
      const bps = Number(f.get("bps"));
      if (!Number.isInteger(bps) || bps < 0 || bps > 10000)
        throw Error("Royalty must be 0–10000 basis points.");
      const recipient = String(f.get("recipient"));
      if (!isAddress(recipient) || recipient === zeroAddress)
        throw Error("Enter the artist royalty wallet.");
      const metadata = String(f.get("metadata"));
      contentHash(metadata);
      await write(registry, "ArtRegistry", "publish", [
        label,
        String(f.get("title")),
        metadata,
        contentHash(String(f.get("cid"))),
        recipient,
        bps,
      ]);
    });
  }
  async function list(e: React.FormEvent<HTMLFormElement>, a: Art) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act(async () => {
      if (!isAddress(registry) || !isAddress(sale)) return;
      await write(registry, "ArtRegistry", "setApprovalForAll", [sale, true]);
      await write(sale, "ArtSale", "list", [
        a.tokenId,
        parseEther(String(f.get("price"))),
        BigInt(Math.floor(Date.now() / 1000) + 86400 * 7),
      ]);
      setSelected(undefined);
    });
  }
  const connected = Boolean(account);
  const ready = isAddress(registry) && isAddress(sale) && linked;
  return (
    <>
      <header>
        <a className="brand" href="#gallery" onClick={() => go("gallery")}>
          <span className="brand-mark">◒</span>{" "}
          {(config?.name || "Eon Moon").toUpperCase()}{" "}
          <small>ARTIST EDITION / 001</small>
        </a>
        <nav aria-label="Main navigation">
          {["gallery", "studio", "setup", "evm"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => go(t)}
            >
              {t === "evm" ? "EVM lab" : t}
            </button>
          ))}
        </nav>
        <button className="wallet" disabled={busy} onClick={() => act(connect)}>
          {connected ? short(account!) : "Connect wallet ↗"}
        </button>
      </header>
      <div className="network">
        <span>
          <i /> ETHEREUM SEPOLIA · TESTNET
        </span>
        <span>
          {block
            ? "BLOCK " + Number(block).toLocaleString()
            : "CONNECTING TO SEPOLIA"}{" "}
          <button aria-label="Refresh chain state" onClick={() => act(refresh)}>
            ↻
          </button>
        </span>
      </div>
      <main>
        {networkError && (
          <div className="notice error" role="alert">
            {networkError}
          </div>
        )}
        {(message || busy) && (
          <div className="notice" role="status">
            {busy && <span className="spinner" />}
            {message || "Waiting for your wallet…"}{" "}
            {tx && (
              <a href={explorer(tx)} target="_blank" rel="noreferrer">
                View transaction ↗
              </a>
            )}
          </div>
        )}
        {tab === "gallery" && (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">INDEPENDENT ART. ON YOUR TERMS.</p>
                <h1>
                  Your art.
                  <br />
                  Your name.
                  <br />
                  <em>Your storefront.</em>
                </h1>
                <p className="intro">
                  A collection with a home of its own. Discover artwork under{" "}
                  <strong>{config?.parentName || "eonmoon.eth"}</strong>,
                  collect with your wallet, and let every storefront resale give
                  back to the artist.
                </p>
                <div className="actions">
                  <a
                    className="button dark"
                    href="#collection"
                    onClick={(e) => {
                      e.preventDefault();
                      document
                        .getElementById("collection")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Explore the collection ↓
                  </a>
                  <button className="link" onClick={() => go("studio")}>
                    For artists ↗
                  </button>
                </div>
                <div className="hero-notes">
                  <span>01 / ARTIST-OWNED</span>
                  <span>02 / IPFS CONTENT</span>
                  <span>03 / NO CARD REQUIRED</span>
                </div>
              </div>
              <figure className="featured">
                <img
                  src="/lunar-study.svg"
                  alt="An amber moon above layered blue mountains"
                />
                <figcaption>
                  <span>
                    LUNAR STUDY <small>Illustrative template artwork</small>
                  </span>
                  <span>01 / 02</span>
                </figcaption>
                <div className="art-stamp">
                  {(config?.name || "Eon Moon").toUpperCase()}
                  <br />
                  <span>SEPOLIA EDITION</span>
                </div>
              </figure>
            </section>
            <section id="collection" className="collection">
              <div className="section-head">
                <div>
                  <p className="eyebrow">THE COLLECTION</p>
                  <h2>A name for every work.</h2>
                </div>
                <span className="mono">
                  {arts.length
                    ? arts.length + " ON-CHAIN WORKS"
                    : "TEMPLATE PREVIEW"}
                </span>
              </div>
              {!ready && (
                <div className="notice">
                  Preview artwork is not minted or for sale.{" "}
                  <button className="text-button" onClick={() => go("setup")}>
                    Set up the artist contracts
                  </button>{" "}
                  to publish on Sepolia.
                </div>
              )}
              <div className="art-grid">
                {arts.length
                  ? arts.map((a) => (
                      <button
                        className="art-card"
                        key={String(a.id)}
                        onClick={() => setSelected(a)}
                      >
                        <ArtworkImage art={a} gateway={config!.ipfsGateway} />
                        <div className="card-line">
                          <h3>{a.title}</h3>
                          <span>
                            {a.listing.seller !== zeroAddress
                              ? formatEther(a.listing.price) + " TEST ETH"
                              : "Not listed"}
                          </span>
                        </div>
                        <p>
                          {a.label}.{config?.parentName}
                        </p>
                        <div className="card-bottom">
                          <span>{a.bps / 100}% ARTIST ROYALTY</span>
                          <span>View artwork ↗</span>
                        </div>
                      </button>
                    ))
                  : [
                      ["Lunar Study", "artwork1", "lunar-study.svg"],
                      ["Solar Memory", "artwork2", "solar-study.svg"],
                    ].map(([title, label, img]) => (
                      <article className="art-card" key={label}>
                        <img
                          src={"/" + img}
                          alt={title + " illustrative artwork"}
                        />
                        <div className="card-line">
                          <h3>{title}</h3>
                          <span>UNPUBLISHED</span>
                        </div>
                        <p>
                          {label}.{config?.parentName || "eonmoon.eth"}
                        </p>
                        <div className="card-bottom">
                          <span>ILLUSTRATIVE EXAMPLE</span>
                          <button
                            className="text-button"
                            onClick={() => go("studio")}
                          >
                            Publish your work ↗
                          </button>
                        </div>
                      </article>
                    ))}
              </div>
            </section>
            <section className="principles">
              <div>
                <span>01</span>
                <h3>A place under your name.</h3>
                <p>
                  Every artwork has its own ENS subname. Your collection lives
                  under your artist identity.
                </p>
              </div>
              <div>
                <span>02</span>
                <h3>A share that returns.</h3>
                <p>
                  Choose your royalty before publishing. Resales through your
                  storefront credit your share on chain.
                </p>
              </div>
              <div>
                <span>03</span>
                <h3>Collect your way.</h3>
                <p>
                  Use an ordinary Ethereum wallet. Burner cards are an optional
                  future extension, never a requirement.
                </p>
              </div>
            </section>
          </>
        )}
        {tab === "studio" && (
          <section className="page">
            <p className="eyebrow">THE ARTIST STUDIO</p>
            <h1>
              Give your art
              <br />
              <em>a name.</em>
            </h1>
            <p className="intro">
              Publish a one-of-one work under {config?.parentName}. Content and
              royalty terms are permanent in this registry once published.
            </p>
            <div className="split">
              <form className="panel" onSubmit={publish}>
                <h2>Publish an artwork</h2>
                <label>
                  Artwork title
                  <input
                    name="title"
                    required
                    maxLength={128}
                    placeholder="Lunar Study"
                  />
                </label>
                <label>
                  Subname
                  <input
                    name="label"
                    required
                    maxLength={63}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    placeholder="artwork1"
                  />
                  <small>.{config?.parentName}</small>
                </label>
                <label>
                  Artwork IPFS CID
                  <input name="cid" required placeholder="bafy…" />
                  <small>
                    Pin the artwork first. A CID alone does not ensure
                    availability.
                  </small>
                </label>
                <label>
                  Metadata URI
                  <input name="metadata" required placeholder="ipfs://bafy…" />
                  <small>
                    IPFS JSON with name, description, and image: ipfs://…
                  </small>
                </label>
                <label>
                  Artist royalty recipient
                  <input
                    name="recipient"
                    required
                    placeholder="0x…"
                    defaultValue={account}
                  />
                </label>
                <label>
                  Royalty in basis points
                  <input
                    name="bps"
                    type="number"
                    min="0"
                    max="10000"
                    step="1"
                    defaultValue="750"
                    required
                  />
                  <small>
                    750 = 7.5%. Applies to resales through this storefront.
                  </small>
                </label>
                <button className="button dark" disabled={busy || !ready}>
                  Publish on Sepolia ↗
                </button>
                {!ready && (
                  <p>
                    Complete{" "}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => go("setup")}
                    >
                      artist setup
                    </button>{" "}
                    first.
                  </p>
                )}
              </form>
              <aside>
                <div className="panel tinted">
                  <h2>Your proceeds</h2>
                  <p className="big-number">
                    {balance}
                    <small> TEST ETH</small>
                  </p>
                  <p>
                    Proceeds are held by the sale contract until you withdraw to
                    your wallet.
                  </p>
                  <button
                    className="button"
                    disabled={busy || !isAddress(sale) || !account}
                    onClick={() =>
                      act(() => write(sale as Address, "ArtSale", "withdraw"))
                    }
                  >
                    Withdraw proceeds ↗
                  </button>
                </div>
                <div className="panel">
                  <h3>Before you publish</h3>
                  <p>
                    Check the IPFS files, recipient, and royalty. Published
                    records have no edit or upgrade path in these contracts.
                  </p>
                  <p>
                    Your parent ENS name must stay registered and linked. Its
                    owner can still change that parent link. Token ownership
                    does not confer copyright or physical fulfillment.
                  </p>
                  <a
                    href="https://app.ens.dev"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Manage your Sepolia ENS name ↗
                  </a>
                </div>
              </aside>
            </div>
            <h2>Your collection</h2>
            {arts.map((a) => (
              <div className="work-row" key={String(a.id)}>
                <span>
                  {a.title}
                  <small>
                    {a.label}.{config?.parentName}
                  </small>
                </span>
                <button className="button" onClick={() => setSelected(a)}>
                  Manage / collect ↗
                </button>
              </div>
            ))}
          </section>
        )}
        {tab === "setup" && (
          <section className="page">
            <p className="eyebrow">A STOREFRONT OF YOUR OWN</p>
            <h1>
              Your namespace.
              <br />
              <em>Your contracts.</em>
            </h1>
            <p className="intro">
              Deploy from your wallet on Ethereum Sepolia. This app never asks
              for your private key. No Burner card or WalletConnect project is
              needed.
            </p>
            <div className="split">
              <div className="panel">
                <h2>1. Artist namespace</h2>
                <label>
                  Parent ENS name
                  <input
                    value={parent}
                    onChange={(e) => setParent(e.target.value)}
                  />
                </label>
                <p>
                  Sepolia owner:{" "}
                  {parentOwner === zeroAddress
                    ? "Not registered"
                    : short(parentOwner)}
                </p>
                {parentOwner === zeroAddress && (
                  <p>
                    <a
                      href="https://app.ens.dev"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Register this name in the ENS v2 app ↗
                    </a>
                    . A mainnet name does not give you its Sepolia counterpart.
                  </p>
                )}
                <h2>2. Deploy the contracts</h2>
                <p>
                  Each deployment is a wallet transaction using test ETH.
                  Registry deployment also creates its immutable resolver.
                </p>
                <button
                  className="button dark"
                  disabled={busy || isAddress(registry)}
                  onClick={() => act(setupRegistry)}
                >
                  Deploy registry + resolver ↗
                </button>
                <button
                  className="button"
                  disabled={busy || !isAddress(registry) || isAddress(sale)}
                  onClick={() =>
                    act(async () => {
                      save({ sale: await deploy("ArtSale", [registry]) });
                      setMessage("Sale contract deployed.");
                    })
                  }
                >
                  Deploy sale contract ↗
                </button>
                <h2>3. Link your ENS parent</h2>
                <button
                  className="button"
                  disabled={busy || !isAddress(registry) || linked}
                  onClick={() => act(linkParent)}
                >
                  {linked ? "Namespace linked ✓" : "Link artist namespace ↗"}
                </button>
                <p>
                  The parent owner signs this transaction. The app refuses to
                  replace an existing different subregistry.
                </p>
              </div>
              <aside className="panel">
                <h2>Deployment configuration</h2>
                <p>
                  Connect an existing instance or recover a partially completed
                  setup. Addresses are verified against this artist namespace on
                  Sepolia.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const r = String(f.get("registry")),
                      s = String(f.get("sale"));
                    if (!isAddress(r) || !isAddress(s)) {
                      setMessage("Enter valid registry and sale addresses.");
                      return;
                    }
                    save({ registry: r, sale: s });
                  }}
                >
                  <label>
                    Registry
                    <input
                      name="registry"
                      placeholder="0x…"
                      defaultValue={registry}
                      key={"r" + registry}
                    />
                  </label>
                  <label>
                    Sale contract
                    <input
                      name="sale"
                      placeholder="0x…"
                      defaultValue={sale}
                      key={"s" + sale}
                    />
                  </label>
                  <button className="button" disabled={busy}>
                    Use these addresses
                  </button>
                </form>
                {isAddress(registry) && (
                  <a href={explorer(registry)} target="_blank" rel="noreferrer">
                    Registry on Etherscan ↗
                  </a>
                )}
                <p>
                  Saved in this browser. Export configuration for the Worker so
                  all visitors see the same collection.
                </p>
                <button
                  className="button"
                  onClick={() => {
                    const blob = new Blob(
                      [
                        JSON.stringify(
                          { ...config, registry, sale, example },
                          null,
                          2,
                        ),
                      ],
                      { type: "application/json" },
                    );
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "artist.config.json";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  Export artist.config.json ↓
                </button>
                <button
                  className="button"
                  disabled={!ready}
                  onClick={() => {
                    const q = new URLSearchParams({ registry, sale });
                    window.prompt(
                      "Share this Sepolia collection",
                      location.origin + "/?" + q + "#gallery",
                    );
                  }}
                >
                  Share collection link ↗
                </button>
                <p className="small">
                  No platform custody key. Source-pinned ENS v2 contracts.
                  Testnet code has not been independently audited.
                </p>
              </aside>
            </div>
          </section>
        )}
        {tab === "evm" && (
          <section className="page">
            <p className="eyebrow">LIVE ETHEREUM VIRTUAL MACHINE EXAMPLE</p>
            <h1>
              One small write.
              <br />
              <em>On a real testnet.</em>
            </h1>
            <p className="intro">
              Deploy a tiny message contract, save a message from your wallet,
              and read it back from Ethereum Sepolia. Independent of ENS
              registration.
            </p>
            <div className="split">
              <div className="panel">
                <h2>Sepolia connection</h2>
                <dl>
                  <dt>Network</dt>
                  <dd>Ethereum Sepolia</dd>
                  <dt>Chain ID</dt>
                  <dd>11155111</dd>
                  <dt>Latest block</dt>
                  <dd>{block || "Connecting…"}</dd>
                  <dt>Execution</dt>
                  <dd>Public testnet · no local chain</dd>
                </dl>
                <button
                  className="button dark"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      save({ example: await deploy("EvmExample") });
                      setMessage("EVM example deployed on Sepolia.");
                    })
                  }
                >
                  Deploy example contract ↗
                </button>
                <label>
                  Existing example contract
                  <input
                    value={example}
                    onChange={(e) => save({ example: e.target.value })}
                    placeholder="0x…"
                  />
                </label>
                {isAddress(example) && (
                  <a href={explorer(example)} target="_blank" rel="noreferrer">
                    View contract ↗
                  </a>
                )}
              </div>
              <div className="panel">
                <h2>Write and read</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = String(
                      new FormData(e.currentTarget).get("message"),
                    );
                    act(async () => {
                      if (!isAddress(example))
                        throw Error(
                          "Deploy or enter an example contract first.",
                        );
                      await write(example, "EvmExample", "save", [text]);
                    });
                  }}
                >
                  <label>
                    Your message
                    <textarea
                      name="message"
                      required
                      maxLength={280}
                      defaultValue="Your art. Your name. Your storefront."
                    />
                  </label>
                  <button
                    className="button dark"
                    disabled={busy || !isAddress(example)}
                  >
                    Save on Sepolia ↗
                  </button>
                </form>
                <button
                  className="button"
                  disabled={busy || !isAddress(example)}
                  onClick={() =>
                    act(async () => {
                      const { account: a } = await wallet();
                      setAccount(a);
                      setExampleRead(
                        (await read(
                          example as Address,
                          "EvmExample",
                          "messages",
                          [a],
                        )) as string,
                      );
                      setMessage("Read from Sepolia.");
                    })
                  }
                >
                  Read my message ↗
                </button>
                {exampleRead && <blockquote>{exampleRead}</blockquote>}
                <p>
                  Uses your wallet and test ETH. Transactions are public. Only
                  save text you want visible on chain.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
      <footer>
        <div className="brand">
          ◒ {(config?.name || "Eon Moon").toUpperCase()}
        </div>
        <p>
          An independent artist storefront.
          <br />
          ENS v2 · IPFS · Ethereum Sepolia
        </p>
        <p>
          Royalties apply to storefront sales.
          <br />
          Testnet only. No physical fulfillment promise.
        </p>
        <button className="link" onClick={() => go("setup")}>
          Make it yours ↗
        </button>
      </footer>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(undefined)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              onClick={() => setSelected(undefined)}
              aria-label="Close artwork"
            >
              ×
            </button>
            <p className="eyebrow">
              {selected.label}.{config?.parentName}
            </p>
            <h2>{selected.title}</h2>
            <ArtworkImage art={selected} gateway={config!.ipfsGateway} />
            <p>
              Artist royalty: {selected.bps / 100}% · Owner:{" "}
              <a
                href={explorer(selected.owner)}
                target="_blank"
                rel="noreferrer"
              >
                {short(selected.owner)}
              </a>
            </p>
            <a
              href={safeLink(selected.metadataURI, config!.ipfsGateway)}
              target="_blank"
              rel="noreferrer"
            >
              IPFS metadata ↗
            </a>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const result = await resolveContent(
                    selected.label + "." + config!.parentName,
                  );
                  if (
                    result.toLowerCase() !== selected.contenthash.toLowerCase()
                  )
                    throw Error(
                      "Universal Resolver contenthash does not match; check parent linkage.",
                    );
                  setMessage(
                    "Artwork IPFS contenthash verified through the Sepolia Universal Resolver.",
                  );
                })
              }
            >
              Verify ENS resolution ↗
            </button>
            {selected.listing.seller !== zeroAddress ? (
              <>
                <p className="big-number">
                  {formatEther(selected.listing.price)}
                  <small> TEST ETH</small>
                </p>
                <p>
                  Listing expires{" "}
                  {new Date(
                    Number(selected.listing.deadline) * 1000,
                  ).toLocaleString()}
                </p>
                <button
                  className="button dark"
                  disabled={busy || !ready}
                  onClick={() =>
                    act(async () => {
                      await write(
                        sale as Address,
                        "ArtSale",
                        "buy",
                        [selected.tokenId, selected.listing.nonce],
                        selected.listing.price,
                      );
                      setSelected(undefined);
                    })
                  }
                >
                  Collect artwork ↗
                </button>
                {selected.listing.seller.toLowerCase() ===
                  account?.toLowerCase() && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await write(sale as Address, "ArtSale", "cancel", [
                          selected.tokenId,
                        ]);
                        setSelected(undefined);
                      })
                    }
                  >
                    Cancel listing
                  </button>
                )}
              </>
            ) : selected.owner.toLowerCase() === account?.toLowerCase() ? (
              <form onSubmit={(e) => list(e, selected)}>
                <label>
                  Price in test ETH
                  <input
                    name="price"
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    required
                    defaultValue="0.001"
                  />
                </label>
                <p>
                  Listing escrows this token for sale. Cancel any time to
                  reclaim it. Expires after seven days.
                </p>
                <button className="button dark" disabled={busy || !ready}>
                  Approve and list ↗
                </button>
              </form>
            ) : (
              <p>This artwork is not listed for sale.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
function ArtworkImage({ art, gateway }: { art: Art; gateway: string }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    fetch(safeLink(art.metadataURI, gateway), { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((m) => {
        if (
          active &&
          m &&
          typeof m === "object" &&
          "image" in m &&
          typeof m.image === "string"
        )
          setImage(safeLink(m.image, gateway));
      })
      .catch(() => {});
    return () => {
      active = false;
      abort.abort();
    };
  }, [art.metadataURI, gateway]);
  return image ? (
    <img src={image} alt={art.title} />
  ) : (
    <div className="image-placeholder">
      IPFS ARTWORK<small>Open metadata to inspect content</small>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
