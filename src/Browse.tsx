"use client";
import { artworkLabel } from "./artwork-label";
import { useEffect, useRef, useState } from "react";
import { isAddress, zeroAddress, type Address } from "viem";
import {
  publicNamespaces,
  resolveParticipant,
  type NamespaceEntry,
} from "./discovery";
import { ipfsURL } from "./ipfs";
import SiteHeader from "./SiteHeader";
import { CollectionSkeleton } from "./PageSkeleton";
import {
  client,
  configureChain,
  contracts,
  parentAbi,
  validateParent,
  type Config,
} from "./chain";
type Entry = {
  type: "art" | "gallery" | "exhibition";
  name: string;
  title: string;
  image?: string;
  href: string;
  detail: string;
};
export default function Browse({ kind }: { kind: string }) {
  const [config, setConfig] = useState<Config>();
  const namespaces = useRef<NamespaceEntry[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const request = useRef(0);
  const read = (
    address: string,
    contract: string,
    functionName: string,
    args: unknown[] = [],
  ): Promise<any> =>
    client.readContract({
      address: address as Address,
      abi: contracts[contract].abi,
      functionName,
      args,
    });
  async function load(c: Config, names: string[]) {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const rows: Entry[] = [];
      const unavailable: string[] = [];
      const waiting: string[] = [];
      for (const parent of [...new Set(names)]) {
        try {
          const name = parent.toLowerCase();
          const ns = await resolveParticipant(client, c.ens.ETHRegistry, name);
          if (ns === zeroAddress) {
            if (name.split(".").length === 2) {
              const expiry = await client.readContract({
                address: c.ens.ETHRegistry,
                abi: parentAbi,
                functionName: "findExpiry",
                args: [name.split(".")[0]],
              });
              if (expiry > (await client.getBlock()).timestamp) {
                waiting.push(name);
                continue;
              }
            }
            unavailable.push(name);
            continue;
          }
          const art = await read(ns, "ParticipantRegistry", "getSubregistry", [
            "art",
          ]);
          const gallery = await read(
            ns,
            "ParticipantRegistry",
            "getSubregistry",
            ["exhibitions"],
          );
          if (isAddress(art) && art !== zeroAddress) {
            const count = Number(
              await read(art, "ArtworkRegistry", "recordCount"),
            );
            for (let i = 0; i < Math.min(count, 100); i++) {
              const token = await read(art, "ArtworkRegistry", "recordId", [
                BigInt(i),
              ]);
              const g = await read(art, "ArtworkRegistry", "genesis", [token]);
              const q = new URLSearchParams({
                registry: art,
                art: String(token),
              });
              // Known sale references are optional; never borrow the visitor's managed tenant.
              const local = c.localDemo?.context;
              if (
                local?.artwork?.toLowerCase() === art.toLowerCase() &&
                local.settlement
              )
                q.set("sale", local.settlement);
              else if (
                c.lifecycle.artwork?.toLowerCase() === art.toLowerCase() &&
                c.lifecycle.settlement
              )
                q.set("sale", c.lifecycle.settlement);
              const indexed = namespaces.current.find(
                (n) => n.name === "art." + name,
              );
              if (indexed?.settlement && isAddress(indexed.settlement)) {
                const linked = await read(
                  indexed.settlement,
                  "SimpleSettlement",
                  "artwork",
                );
                if (linked.toLowerCase() === art.toLowerCase())
                  q.set("sale", indexed.settlement);
              }
              rows.push({
                type: "art",
                name: g.label + ".art." + name,
                title: artworkLabel(g.title),
                image: g.imageURI,
                href: "/artwork/?" + q,
                detail: g.medium + " · " + g.year,
              });
            }
          }
          if (isAddress(gallery) && gallery !== zeroAddress) {
            const count = Number(
              await read(gallery, "GalleryRegistry", "recordCount"),
            );
            let established = "";
            try {
              const date = Number(
                await read(gallery, "GalleryRegistry", "establishedAt"),
              );
              established =
                " · Established " + new Date(date * 1000).toLocaleDateString();
            } catch {}
            rows.push({
              type: "gallery",
              name: "exhibitions." + name,
              title:
                namespaces.current.find((n) => n.name === "exhibitions." + name)
                  ?.displayName || name,
              href: "/browse/exhibitions/?name=" + encodeURIComponent(name),
              detail: count + " exhibitions" + established,
            });
            for (let i = 0; i < Math.min(count, 100); i++) {
              const token = await read(gallery, "GalleryRegistry", "recordId", [
                BigInt(i),
              ]);
              const show = await read(
                gallery,
                "GalleryRegistry",
                "exhibition",
                [token],
              );
              rows.push({
                type: "exhibition",
                name: show.label + ".exhibitions." + name,
                title: show.title,
                href:
                  "/exhibition/?" +
                  new URLSearchParams({
                    registry: gallery,
                    show: String(token),
                  }),
                detail: "Presented by " + name,
              });
            }
          }
        } catch {
          unavailable.push(parent);
        }
      }
      if (id === request.current) {
        if (unavailable.length)
          setError(
            "Some indexed namespaces are not deployed or could not be read: " +
              unavailable.join(", "),
          );
        setEntries(rows);
        setPending(waiting);
        setSearched(names.length > 0);
      }
    } catch (e: any) {
      if (id === request.current) setError(e.shortMessage || e.message);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    let gone = false;
    fetch("/api/config")
      .then(async (r) => {
        if (!r.ok) throw Error("Configuration unavailable");
        return (await r.json()) as Config;
      })
      .then(async (c) => {
        if (gone) return;
        configureChain(c);
        setConfig(c);
        namespaces.current = await publicNamespaces(client, c);
        if (gone) return;
        const name = new URLSearchParams(location.search).get("name");
        const local = c.localDemo?.context;
        void load(
          c,
          name
            ? [name]
            : local
              ? c.localDemo?.catalogueIndex?.map((n) =>
                  n.name.split(".").slice(1).join("."),
                ) || [local.parent, local.galleryName].filter(Boolean)
              : namespaces.current.map((n) =>
                  n.name.split(".").slice(1).join("."),
                ),
        );
      })
      .catch((e) => {
        if (!gone) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      gone = true;
      ++request.current;
    };
  }, []);
  const type =
    kind === "galleries"
      ? "gallery"
      : kind === "exhibitions"
        ? "exhibition"
        : "art";
  const visible = entries.filter((e) => e.type === type);
  return (
    <>
      <SiteHeader />
      <main className="page">
        <p className="eyebrow">DISCOVER · NO WALLET REQUIRED</p>
        <h1>
          {kind === "galleries"
            ? "Galleries"
            : kind === "exhibitions"
              ? "Exhibitions"
              : "Explore artwork"}
        </h1>
        <p className="intro">
          Discover artwork and exhibitions from our indexed artist and gallery
          namespaces. Records are read from the connected blockchain. You can
          also look up an ENS name.
        </p>
        <nav className="browse-tabs" aria-label="Browse collections">
          {[
            ["art", "Art"],
            ["galleries", "Galleries"],
            ["exhibitions", "Exhibitions"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={"/browse/" + id + "/"}
              aria-current={kind === id ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <form
          className="panel browse-search"
          onSubmit={(e) => {
            e.preventDefault();
            if (config)
              void load(config, [
                String(new FormData(e.currentTarget).get("name")),
              ]);
          }}
        >
          <label>
            Artist or gallery ENS name
            <input name="name" required placeholder="artist.eth" />
          </label>
          <button className="button" disabled={!config || loading}>
            Explore name ↗
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        {!loading && pending.length > 0 && (
          <section className="panel">
            <h2>Registered names awaiting setup</h2>
            <p>
              These Sepolia ENS names are registered. No artwork or exhibition
              registry has been attached yet.
            </p>
            <ul>
              {pending.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        )}
        {loading ? (
          <CollectionSkeleton />
        ) : (
          <div className="catalogue">
            {visible.map((e) => (
              <article className="panel art-card" key={e.name}>
                {e.image?.startsWith("ipfs://") && (
                  <img
                    src={ipfsURL(e.image, config?.ipfsGateway)}
                    alt={artworkLabel(e.title)}
                  />
                )}
                <p className="eyebrow">{e.name}</p>
                <h2>{artworkLabel(e.title)}</h2>
                <p>{e.detail}</p>
                <a className="button" href={e.href}>
                  {type === "gallery" ? "View exhibitions" : "View " + type} ↗
                </a>
              </article>
            ))}
          </div>
        )}
        {!loading && !visible.length && (
          <p>
            {searched
              ? "No matching records in this namespace."
              : "Enter an ENS name to explore its published records. This is a name lookup, not a complete index of every registry."}
          </p>
        )}
      </main>
    </>
  );
}
