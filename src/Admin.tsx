"use client";
import { withEonmunArtworks, eonmunAssets } from "./eonmun-import";
import { artworkLabel } from "./artwork-label";
import { useEffect, useRef, useState } from "react";
import SiteHeader from "./SiteHeader";
import { adminClient, adminIdentity, sameAddress } from "./admin-chain";
import { configureChain, wallet, contracts, type Config } from "./chain";
import { runAdminSeed, emptyOwnedParticipant } from "./admin-seed";
import baseCatalogue from "./demo-catalogue.json";
import { namedCatalogue, knownNames } from "./named-catalogue";
import imageSources from "./artwork-sources.json";
import namedAssets from "./named-assets.json";
import { assetsForCatalogue } from "./named-assets";
import { zeroAddress } from "viem";
import { parentAbi } from "./chain";
import assets from "./seed-assets.json";
const defaults = Object.fromEntries(
  baseCatalogue.participants.map((p) => [p.id, p.id + ".ncrmro.eth"]),
);
export default function Admin() {
  const [catalogue, setCatalogue] = useState<any>(baseCatalogue);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [allNamesMode, setAllNamesMode] = useState(false);
  const [config, setConfig] = useState<Config>();
  const [account, setAccount] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [parents, setParents] = useState<Record<string, string>>(defaults);
  const [message, setMessage] = useState(
    "Connect the wallet that owns ncrmro.eth on Sepolia.",
  );
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [locked, setLocked] = useState(false);
  const active = useRef(false);
  const storageKey = (c: Config, a: string) =>
    `artwork-admin-seed:v1:${c.chainId}:${c.ens.ETHRegistry.toLowerCase()}:${a.toLowerCase()}`;
  async function refreshNames(a: string, c?: Config) {
    const found = new Set<string>();
    let skip: number | null = 0,
      after: string | null = null;
    for (let page = 0; page < 100; page++) {
      const q: URLSearchParams = new URLSearchParams({
        address: a,
        skip: String(skip ?? 10000),
      });
      if (after) q.set("after", after);
      const r: Response = await fetch("/api/names?" + q);
      const data = (await r.json()) as {
        names: string[];
        nextSkip: number | null;
        nextAfter: string | null;
        error?: string;
      };
      if (!r.ok) throw Error(data.error || "Name discovery unavailable");
      for (const n of data.names) found.add(n);
      skip = data.nextSkip;
      after = data.nextAfter;
      if (skip === null && after === null) break;
    }
    if (c) {
      const pc = adminClient(c);
      for (const name of knownNames) {
        try {
          const owner = await pc.readContract({
            address: c.ens.ETHRegistry,
            abi: parentAbi,
            functionName: "findOwner",
            args: [name.split(".")[0]],
          });
          if (sameAddress(owner, a)) found.add(name);
        } catch {}
      }
    }
    const result = [...found].sort();
    setNames(result);
    return result;
  }
  async function useAvailable(
    c: Config,
    a: string,
    available: string[],
    saved: any,
  ) {
    const selected: string[] = [],
      notes: string[] = [];
    const pc = adminClient(c);
    for (const name of available) {
      if (name === "ncrmro.eth") {
        notes.push(name + " — admin and discovery index");
        continue;
      }
      const current = await pc.readContract({
        address: c.ens.ETHRegistry,
        abi: parentAbi,
        functionName: "getSubregistry",
        args: [name.split(".")[0]],
      });
      const known = saved.catalogue?.participants?.find(
        (p: any) => p.parent === name,
      );
      const registry =
        known &&
        saved.catalogueJournal?.deployments?.[
          known.id + ".ParticipantRegistry"
        ];
      if (current !== zeroAddress && !sameAddress(current, registry)) {
        if (await emptyOwnedParticipant(pc, current, a, contracts)) {
          notes.push(
            name +
              " — empty legacy registry will be relinked; previous address saved in checkpoint",
          );
        } else {
          notes.push(name + " — populated or incompatible registry preserved");
          continue;
        }
      }
      selected.push(name);
    }

    // Retain completed participants and stable IDs when more names become available.
    if (saved.allNamesMode && saved.catalogue) {
      for (const p of saved.catalogue.participants) {
        if (!selected.includes(p.parent)) selected.push(p.parent);
      }
    }
    const full = namedCatalogue(selected, imageSources);
    if (
      !full.participants.some((p: any) => p.kind === "artist") ||
      !full.participants.some((p: any) => p.kind === "gallery")
    ) {
      setSkipped(notes);
      return;
    }
    setCatalogue(full);
    setParents(
      Object.fromEntries(full.participants.map((p: any) => [p.id, p.parent])),
    );
    setSkipped(notes);
    setAllNamesMode(true);
  }
  useEffect(() => {
    let gone = false;
    const provider = (window as any).ethereum;
    async function restore() {
      setAllowed(false);
      try {
        const r = await fetch("/api/config");
        if (!r.ok) throw Error("Configuration unavailable");
        const c = (await r.json()) as Config;
        if (gone) return;
        setConfig(c);
        configureChain(c);
        if (!provider) return;
        const accounts = await provider.request({ method: "eth_accounts" });
        const chain = await provider.request({ method: "eth_chainId" });
        if (gone) return;
        setAccount(accounts[0] || "");
        if (!accounts[0] || Number(chain) !== c.chainId) return;
        const owner = await adminIdentity(adminClient(c), c.ens.ETHRegistry);
        if (gone) return;
        const ok = sameAddress(owner, accounts[0]);
        setAllowed(ok);
        if (!ok) {
          setMessage(
            "Admin access requires the current owner of ncrmro.eth on Sepolia.",
          );
          return;
        }
        const saved = JSON.parse(
          localStorage.getItem(storageKey(c, accounts[0])) || "{}",
        );
        if (saved.parents) setParents(saved.parents);
        if (saved.catalogue) setCatalogue(withEonmunArtworks(saved.catalogue));
        if (saved.allNamesMode) setAllNamesMode(true);
        setLocked(!!saved.bootstrap);
        setComplete(!!saved.index);
        setMessage(
          saved.index
            ? "Catalogue already published. Resume to verify it."
            : "Admin connected. Refresh names, check the plan, then launch the seed.",
        );
        const found = await refreshNames(accounts[0], c);
        if (!saved.bootstrap) await useAvailable(c, accounts[0], found, saved);
      } catch (e: any) {
        if (!gone) setMessage(e.shortMessage || e.message);
      }
    }
    void restore();
    provider?.on?.("accountsChanged", restore);
    provider?.on?.("chainChanged", restore);
    const walletRefreshed = () => {
      if (!active.current) void restore();
    };
    window.addEventListener("artwork-wallet-changed", walletRefreshed);
    return () => {
      gone = true;
      provider?.removeListener?.("accountsChanged", restore);
      provider?.removeListener?.("chainChanged", restore);
      window.removeEventListener("artwork-wallet-changed", walletRefreshed);
    };
  }, []);
  async function connect() {
    try {
      if (!config) return;
      configureChain(config);
      await wallet();
    } catch (e: any) {
      setMessage(e.shortMessage || e.message);
    }
  }
  async function run(checkOnly: boolean) {
    if (active.current || !allowed || !config) return;
    active.current = true;
    setBusy(true);
    try {
      configureChain(config);
      const { w, account: a } = await wallet();
      if (!sameAddress(a, account))
        throw Error("Wallet changed. Reconnect and retry.");
      const key = storageKey(config, a);
      let saved = JSON.parse(localStorage.getItem(key) || "{}");
      if (
        saved.parents &&
        Object.entries(saved.parents).some(
          ([id, name]) => parents[id] !== name,
        ) &&
        saved.bootstrap
      )
        throw Error("Resume the saved name selections.");
      saved.parents = parents;
      saved.catalogue = catalogue;
      saved.allNamesMode = allNamesMode;
      localStorage.setItem(key, JSON.stringify(saved));
      const options = {
        pc: adminClient(config),
        w,
        account: a,
        config,
        catalogue,
        contracts,
        assets: {
          ...(allNamesMode ? assetsForCatalogue(catalogue) : assets),
          works: {
            ...(allNamesMode
              ? assetsForCatalogue(catalogue).works
              : assets.works),
            ...eonmunAssets,
          },
        },
        parents,
        load: (part: string) =>
          saved[part === "catalogue" ? "catalogueJournal" : part],
        save: (part: string, value: any) => {
          saved[part === "catalogue" ? "catalogueJournal" : part] = value;
          localStorage.setItem(key, JSON.stringify(saved));
          if (part === "bootstrap") setLocked(true);
          if (part === "index") setComplete(true);
        },
        status: (s: string) => setMessage(s),
        checkOnly,
      };
      await runAdminSeed(options);
      if (checkOnly)
        setMessage(
          "Plan ready. No transactions sent. Launch will request wallet confirmations for real Sepolia transactions.",
        );
    } catch (e: any) {
      setMessage(e.shortMessage || e.message);
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  function download() {
    if (!config) return;
    const value = localStorage.getItem(storageKey(config, account));
    if (!value) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([value], { type: "application/json" }),
    );
    a.download = "artwork-admin-seed-checkpoint.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <>
      <SiteHeader />
      <main className="page">
        <p className="eyebrow">
          ADMIN · {config?.chainId === 31337 ? "LOCAL DEVNET" : "SEPOLIA"}
        </p>
        {config?.chainId === 31337 && (
          <p>
            This local blockchain does not contain your Sepolia registrations.{" "}
            <a href="https://eonmun-beta.ncrmro.workers.dev/admin/">
              Open the live Sepolia admin page ↗
            </a>
          </p>
        )}
        <h1>Seed the live catalogue</h1>
        <p className="intro">
          Publish the shared demonstration artwork and exhibition history with
          real contracts and wallet-signed transactions.
        </p>
        <p
          role="status"
          aria-live="polite"
          style={{ overflowWrap: "anywhere" }}
        >
          {message}
        </p>
        {!allowed ? (
          <section className="panel">
            <h2>Admin wallet required</h2>
            <p>
              Only the current owner of ncrmro.eth on Sepolia can open these
              controls. No mainnet ownership is required.
            </p>
            <button className="button" onClick={connect} disabled={!config}>
              Connect admin wallet
            </button>
          </section>
        ) : (
          <>
            <section className="panel">
              <h2>Your Sepolia ENS names</h2>
              <p>
                Fresh registrations appear here once indexed. A registered name
                does not yet contain artworks or exhibitions.
              </p>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  refreshNames(account, config).catch((e) =>
                    setMessage(e.message),
                  )
                }
              >
                Refresh names
              </button>
              <ul>
                {names.map((n) => (
                  <li key={n}>
                    <a href={"/browse/art/?name=" + encodeURIComponent(n)}>
                      {n}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h2>Seed all available names</h2>
              <button
                className="button"
                disabled={busy || !config}
                onClick={async () => {
                  try {
                    if (!config) return;
                    const found = await refreshNames(account, config);
                    const saved = JSON.parse(
                      localStorage.getItem(storageKey(config, account)) || "{}",
                    );
                    await useAvailable(config, account, found, saved);
                  } catch (e: any) {
                    setMessage(e.message);
                  }
                }}
              >
                Refresh and include available names
              </button>
              {skipped.length > 0 && (
                <ul>
                  {skipped.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <p>
                Defaults use demo subdomains of ncrmro.eth. You can choose newly
                registered .eth names instead. Populated registries are
                preserved. Empty registries owned by this wallet can be relinked
                to the new contracts, with their old addresses retained in the
                checkpoint. These records describe fictional demo participants,
                not the real institutions or artists whose names you may choose.
              </p>
              <div className="config-grid">
                {catalogue.participants.map((p: any) => (
                  <label key={p.id}>
                    {artworkLabel(p.name)} · {p.kind}
                    <select
                      disabled={busy || locked}
                      value={parents[p.id]}
                      onChange={(e) =>
                        setParents({ ...parents, [p.id]: e.target.value })
                      }
                    >
                      {[
                        ...new Set([
                          defaults[p.id] || p.parent,
                          parents[p.id],
                          ...names.filter((n) => n !== "ncrmro.eth"),
                        ]),
                      ].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p>
                The plan contains {catalogue.participants.length} separate demo
                contract accounts, {catalogue.works.length} artworks and{" "}
                {catalogue.shows.length} exhibitions, with gallery permissions,
                listings and attributed history. All demo accounts are
                controlled by your wallet. Historical purchases do not fabricate
                past token transfers.
              </p>
              <p>
                Each deployment and write requires a Sepolia wallet confirmation
                (multiple transactions per participant and artwork). Artworks
                are minted first, after each artist’s ENS setup; galleries,
                loans and sales follow. You can reject a prompt and resume later
                from this browser. Keep your checkpoint backup. The completed
                index is published on-chain beneath ncrmro.eth and is read by
                both live websites automatically.
              </p>
              <div className="config-grid">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => run(true)}
                >
                  Check plan
                </button>
                <button
                  className="button dark"
                  disabled={busy}
                  onClick={() => run(false)}
                >
                  {busy
                    ? "Waiting for wallet / receipt…"
                    : locked
                      ? "Resume seed"
                      : "Launch Sepolia seed"}
                </button>
                <button className="button" disabled={busy} onClick={download}>
                  Download checkpoint
                </button>
              </div>
              <label>
                Restore checkpoint
                <input
                  type="file"
                  accept="application/json"
                  disabled={busy}
                  onChange={async (e) => {
                    try {
                      const file = e.target.files?.[0];
                      if (!file || !config) return;
                      if (file.size > 1000000)
                        throw Error("Checkpoint too large");
                      if (localStorage.getItem(storageKey(config, account)))
                        throw Error(
                          "A checkpoint already exists in this browser. Use another browser to restore a backup.",
                        );
                      const s = JSON.parse(await file.text());
                      if (!s.parents || !s.bootstrap?.fingerprint)
                        throw Error("Invalid checkpoint");
                      localStorage.setItem(
                        storageKey(config, account),
                        JSON.stringify(s),
                      );
                      location.reload();
                    } catch (err: any) {
                      setMessage(err.message);
                    }
                  }}
                />
              </label>
              {complete && (
                <p>
                  <a className="button" href="/browse/art/">
                    Browse published artwork ↗
                  </a>
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
