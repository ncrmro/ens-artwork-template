"use client";
import defaults from "./demo-defaults.json";
import React, { useState } from "react";
type Terms = {
  id: string;
  royaltyBps: number;
  holdDays: number;
};
type HistoryEvent = {
  workId: string;
  date: string;
  title: string;
  detail: string;
  showId?: string;
};
const artists = ["EON MUN", "Mika Sato"];
const galleries = ["Atelier Gallery", "Harbour Gallery"];
const event = (
  workId: string,
  title: string,
  detail: string,
  showId?: string,
): HistoryEvent => ({
  workId,
  title,
  detail,
  showId,
  date: new Date().toISOString().slice(0, 10),
});
type Work = {
  id: string;
  artist: string;
  termsId: string;
  resaleAfter?: string;
  title: string;
  medium: string;
  dimensions: string;
  price: string;
  owner: string;
  variant: number;
  imageURI?: string;
  manifestURI?: string;
};
type Show = {
  id: string;
  gallery: string;
  dates: string;
  status: "past" | "current";
  title: string;
  description: string;
  manifestURI?: string;
  works: string[];
};
type DemoState = {
  works: Work[];
  shows: Show[];
  submissions: { work: string; show: string; accepted: boolean }[];
  terms: Record<string, Terms>;
  history: HistoryEvent[];
};
const store = "artwork-commons:demo:v3";
const makeTerms = (id: string): Terms => ({
  id,
  royaltyBps: 500,
  holdDays: 180,
});
const initial: DemoState = {
  works: [
    {
      id: "blue-mountain",
      artist: "EON MUN",
      termsId: "standard-artwork-v1",
      title: "Blue Mountain",
      medium: "Acrylic and gold leaf on linen",
      dimensions: "48 × 116 inches",
      price: "0.5",
      owner: "Rowan Ellis",
      resaleAfter: "2027-01-06",
      variant: 0,
    },
    {
      id: "quiet-tide",
      artist: "EON MUN",
      termsId: "standard-artwork-v1",
      title: "Quiet Tide",
      medium: "Oil on canvas",
      dimensions: "60 × 80 cm",
      price: "0.3",
      owner: "EON MUN",
      variant: 1,
    },
    {
      id: "after-the-rain",
      artist: "EON MUN",
      termsId: "standard-artwork-v1",
      title: "After the Rain",
      medium: "Pigment and graphite on paper",
      dimensions: "42 × 60 cm",
      price: "0.2",
      owner: "EON MUN",
      variant: 2,
    },
    {
      id: "folded-light",
      artist: "Mika Sato",
      termsId: "standard-artwork-v1",
      title: "Folded Light",
      medium: "Porcelain and glaze",
      dimensions: "32 × 18 × 18 cm",
      price: "0.35",
      owner: "Alex Chen",
      resaleAfter: "2026-12-01",
      variant: 1,
    },
    {
      id: "red-earth",
      artist: "Mika Sato",
      termsId: "standard-artwork-v1",
      title: "Red Earth",
      medium: "Mineral pigment on paper",
      dimensions: "40 × 60 cm",
      price: "0.25",
      owner: "Mika Sato",
      variant: 2,
    },
  ],
  terms: { "standard-artwork-v1": makeTerms("standard-artwork-v1") },
  shows: [
    {
      id: "tokyo",
      gallery: "Atelier Gallery",
      dates: "May–June 2026",
      status: "past",
      title: "Between Earth & Ether",
      description:
        "Physical works, independent identities. A Tokyo exhibition exploring landscape, material and memory.",
      works: ["blue-mountain", "quiet-tide", "folded-light"],
    },
    {
      id: "harbour",
      gallery: "Harbour Gallery",
      dates: "July–August 2026",
      status: "past",
      title: "Material & Memory",
      description: "A travelling conversation between landscape and sculpture.",
      works: ["blue-mountain", "folded-light"],
    },
    {
      id: "common-ground",
      gallery: "Atelier Gallery",
      dates: "September–October 2026",
      status: "current",
      title: "Common Ground",
      description:
        "Works by independent artists, brought together with their histories intact.",
      works: ["blue-mountain", "red-earth"],
    },
  ],
  submissions: [],
  history: [
    {
      workId: "blue-mountain",
      date: "2025-11-08",
      title: "Created by EON MUN",
      detail: "Original artist and one canonical terms record established.",
    },
    {
      workId: "blue-mountain",
      date: "2026-01-04",
      title: "Purchased by Alex Chen",
      detail: "EON MUN → Alex Chen · 0.6 demo ETH · direct primary sale.",
    },
    {
      workId: "blue-mountain",
      date: "2026-05-01",
      title: "Exhibited at Atelier Gallery",
      detail:
        "Between Earth & Ether · alongside works by Mika Sato. Alex retained ownership.",
      showId: "tokyo",
    },
    {
      workId: "blue-mountain",
      date: "2026-07-01",
      title: "Exhibited at Harbour Gallery",
      detail: "Material & Memory · a new gallery, the same artwork and terms.",
      showId: "harbour",
    },
    {
      workId: "blue-mountain",
      date: "2026-07-10",
      title: "Purchased by Rowan Ellis",
      detail:
        "Alex Chen → Rowan Ellis · 0.8 demo ETH · 0.04 artist royalty · 0.08 gallery commission · 0.68 seller proceeds.",
      showId: "harbour",
    },
    {
      workId: "blue-mountain",
      date: "2026-09-01",
      title: "Exhibited again at Atelier Gallery",
      detail:
        "Common Ground · loaned by Rowan Ellis. Ownership did not change.",
      showId: "common-ground",
    },
    {
      workId: "folded-light",
      date: "2026-02-12",
      title: "Created by Mika Sato",
      detail: "Original artist and independent terms record established.",
    },
    {
      workId: "folded-light",
      date: "2026-05-01",
      title: "Exhibited at Atelier Gallery",
      detail: "Between Earth & Ether · shown alongside EON MUN.",
      showId: "tokyo",
    },
    {
      workId: "folded-light",
      date: "2026-06-04",
      title: "Purchased by Alex Chen",
      detail: "Mika Sato → Alex Chen · 0.35 demo ETH · gallery primary sale.",
      showId: "tokyo",
    },
    {
      workId: "folded-light",
      date: "2026-07-01",
      title: "Exhibited at Harbour Gallery",
      detail: "Material & Memory · loaned by Alex Chen.",
      showId: "harbour",
    },
    {
      workId: "red-earth",
      date: "2026-08-20",
      title: "Created by Mika Sato",
      detail: "Available directly from its original artist.",
    },
    {
      workId: "red-earth",
      date: "2026-09-01",
      title: "Exhibited at Atelier Gallery",
      detail: "Common Ground · shown alongside EON MUN.",
      showId: "common-ground",
    },
    {
      workId: "quiet-tide",
      date: "2026-04-12",
      title: "Created by EON MUN",
      detail: "Original artist retains ownership.",
    },
    {
      workId: "quiet-tide",
      date: "2026-05-01",
      title: "Exhibited at Atelier Gallery",
      detail: "Between Earth & Ether.",
      showId: "tokyo",
    },
    {
      workId: "after-the-rain",
      date: "2026-08-10",
      title: "Created by EON MUN",
      detail: "Available directly from its original artist.",
    },
  ],
};
function input(label: string, name: string, value = "", type = "text") {
  return (
    <label>
      {label}
      <input name={name} type={type} defaultValue={value} required />
    </label>
  );
}
export default function Demo({ page }: { page: string }) {
  const [state, setState] = useState<DemoState>(() => {
    try {
      return (
        JSON.parse(sessionStorage.getItem(store) || "null") ||
        structuredClone(initial)
      );
    } catch {
      return structuredClone(initial);
    }
  });
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(false);
  const [artistFilter, setArtistFilter] = useState("all");
  const [galleryFilter, setGalleryFilter] = useState("all");
  const q = new URLSearchParams(location.search);
  const work = state.works.find((w) => w.id === q.get("id")) || state.works[0];
  const show = state.shows.find((s) => s.id === q.get("id")) || state.shows[0];
  function update(next: DemoState, message: string) {
    sessionStorage.setItem(store, JSON.stringify(next));
    setState(next);
    setNotice(message);
  }
  function buy(w: Work, via: string, showId?: string) {
    if (w.resaleAfter && new Date(w.resaleAfter).getTime() > Date.now()) {
      setNotice(
        "Standard terms: resale locked until " +
          w.resaleAfter +
          ". This is simulated; the local contract demo enforces the same 180-day period on chain.",
      );
      return;
    }
    if (w.owner !== w.artist) {
      setNotice(
        "This work is in a private collection. Its history and canonical terms remain available.",
      );
      return;
    }
    update(
      {
        ...state,
        works: state.works.map((x) =>
          x.id === w.id
            ? {
                ...x,
                owner: "You (demo collector)",
                resaleAfter: new Date(
                  Date.now() + state.terms[x.termsId].holdDays * 86400000,
                )
                  .toISOString()
                  .slice(0, 10),
              }
            : x,
        ),
        history: [
          ...state.history,
          event(
            w.id,
            "Purchased by You (demo collector)",
            `${w.owner} → You (demo collector) · ${w.price} demo ETH ${via}. Original artist remains ${w.artist}.`,
            showId,
          ),
        ],
      },
      "Demo purchase complete. Ownership updated locally; no payment was made.",
    );
  }
  const artImage = (w: Work) => (
    <div className={"demo-image variant-" + w.variant}>
      <img src="/blue-mountain.svg" alt={"Illustration for " + w.title} />
    </div>
  );
  const card = (w: Work) => (
    <article className="panel art-card" key={w.id}>
      <a href={"/demo/artwork/?id=" + w.id}>{artImage(w)}</a>
      <p className="eyebrow">
        {w.artist} · {w.medium}
      </p>
      <h2>{w.title}</h2>
      <p>
        {w.owner === w.artist ? w.price + " demo ETH" : "Collected"} · Owner:{" "}
        {w.owner}
      </p>
      <a className="button" href={"/demo/artwork/?id=" + w.id}>
        View artwork ↗
      </a>
    </article>
  );
  return (
    <>
      <header>
        <a className="brand" href="/">
          <span className="brand-symbol">◈</span>
          <span>
            ARTWORK COMMONS<small>THE LIFE OF AN ARTWORK</small>
          </span>
        </a>
        <nav>
          <a href="/demo/artist/">Demo artist</a>
          <a href="/demo/gallery/">Demo gallery</a>
          <a href="/docs/">How it works</a>
          <a href="/">Exit demo</a>
        </nav>
      </header>
      <div className="demo-banner">
        <strong>DEMO MODE</strong>
        <span>
          Mock artwork, exhibitions and purchases. Saved in this tab. No wallet
          or blockchain transactions.
        </span>
        <button
          onClick={() => {
            update(structuredClone(initial), "Demo reset.");
            setForm(false);
          }}
        >
          Reset demo
        </button>
      </div>
      <main className="page">
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {page === "artist" && (
          <>
            <p className="eyebrow">INDEPENDENT ARTISTS · SHARED COLLECTION</p>
            <div className="page-heading">
              <div>
                <h1>Artists & their work</h1>
                <p className="intro">
                  Discover work by EON MUN and Mika Sato.
                  <br />
                  Follow each work through exhibitions, collections and sales.
                </p>
              </div>
              <button className="button dark" onClick={() => setForm(!form)}>
                Create artwork ↗
              </button>
            </div>
            <div className="profile-strip">
              <span>Original artist always credited</span>
              <span>One lasting artwork record</span>
              <span>5% artist resale royalty</span>
            </div>
            {form && (
              <form
                className="panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const title = String(f.get("title"));
                  const w: Work = {
                    id:
                      Date.now().toString(36) +
                      Math.random().toString(36).slice(2),
                    title,
                    artist: String(f.get("artist")),
                    termsId: "",
                    medium: String(f.get("medium")),
                    dimensions: String(f.get("dimensions")),
                    price: String(f.get("price")),
                    owner: String(f.get("artist")),
                    variant: state.works.length % 3,
                    imageURI: String(f.get("image")),
                    manifestURI: String(f.get("manifest")),
                  };
                  w.termsId = "standard-artwork-v1";
                  update(
                    {
                      ...state,
                      terms: {
                        ...state.terms,
                        [w.termsId]: makeTerms(w.termsId),
                      },
                      works: [...state.works, w],
                      history: [
                        ...state.history,
                        event(
                          w.id,
                          `Created by ${w.artist}`,
                          `${title} issued with one canonical terms record.`,
                        ),
                      ],
                    },
                    "Demo artwork created. It appears in your collection.",
                  );
                  setForm(false);
                }}
              >
                <h2>New demo artwork</h2>
                <div className="config-grid">
                  <label>
                    Artist
                    <select name="artist" aria-label="Artist">
                      {artists.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                  {input("Artwork title", "title", "Blue Mountain Study")}
                  {input("Image IPFS URI", "image", defaults.image)}
                  {input("Manifest IPFS URI", "manifest", defaults.manifest)}
                  {input("Medium", "medium", "Oil on canvas")}
                  {input("Dimensions", "dimensions", "60 × 80 cm")}
                  {input("Price (demo ETH)", "price", "0.1")}
                </div>
                <p>
                  Prefilled IPFS values reference bundled illustrative fixtures.
                  These are sample records, not uploads or public pinning.
                </p>
                <button className="button dark">Create demo artwork</button>
              </form>
            )}
            <label>
              Browse artist
              <select
                value={artistFilter}
                onChange={(e) => setArtistFilter(e.target.value)}
              >
                <option value="all">All artists</option>
                {artists.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <div className="catalogue">
              {state.works
                .filter(
                  (w) => artistFilter === "all" || w.artist === artistFilter,
                )
                .map(card)}
            </div>
          </>
        )}
        {page === "gallery" && (
          <>
            <p className="eyebrow">
              INDEPENDENT GALLERIES · PAST & PRESENT EXHIBITIONS
            </p>
            <div className="page-heading">
              <div>
                <h1>Galleries & exhibitions</h1>
                <p className="intro">
                  A space for art and the relationships around it.
                  <br />
                  Curated exhibitions. Artist-owned work.
                </p>
              </div>
              <button className="button dark" onClick={() => setForm(!form)}>
                Create exhibition ↗
              </button>
            </div>
            {form && (
              <form
                className="panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const s: Show = {
                    id:
                      Date.now().toString(36) +
                      Math.random().toString(36).slice(2),
                    title: String(f.get("title")),
                    gallery: String(f.get("gallery")),
                    dates: "New exhibition",
                    status: "current",
                    description: String(f.get("description")),
                    manifestURI: String(f.get("manifest")),
                    works: [],
                  };
                  update(
                    { ...state, shows: [...state.shows, s] },
                    "Demo exhibition created. Artists can now submit artwork.",
                  );
                  setForm(false);
                }}
              >
                <h2>New demo exhibition</h2>
                <label>
                  Gallery
                  <select name="gallery" aria-label="Gallery">
                    {galleries.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                {input("Exhibition title", "title", "Between Earth & Ether")}
                {input(
                  "Exhibition manifest IPFS URI",
                  "manifest",
                  defaults.exhibition,
                )}
                {input(
                  "Exhibition description",
                  "description",
                  "Physical art, shared history.",
                )}
                <button className="button dark">Create demo exhibition</button>
              </form>
            )}
            <label>
              Browse gallery
              <select
                value={galleryFilter}
                onChange={(e) => setGalleryFilter(e.target.value)}
              >
                <option value="all">All galleries</option>
                {galleries.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <div className="catalogue">
              {state.shows
                .filter(
                  (s) => galleryFilter === "all" || s.gallery === galleryFilter,
                )
                .map((s) => (
                  <article className="panel art-card" key={s.id}>
                    {artImage(
                      state.works.find((w) => w.id === s.works[0]) ||
                        state.works[0],
                    )}
                    <p className="eyebrow">
                      {s.gallery} · {s.status} · {s.works.length} WORKS
                    </p>
                    <p>{s.dates}</p>
                    <h2>{s.title}</h2>
                    <p>{s.description}</p>
                    <a className="button" href={"/demo/exhibition/?id=" + s.id}>
                      View exhibition ↗
                    </a>
                  </article>
                ))}
            </div>
            <section className="panel">
              <h2>Artist submissions</h2>
              {state.submissions
                .filter((s) => !s.accepted)
                .map((s, i) => {
                  const w = state.works.find((w) => w.id === s.work)!;
                  return (
                    <div className="submission" key={s.work + s.show}>
                      <h3>{w.title}</h3>
                      <p>
                        {w.artist} →{" "}
                        {state.shows.find((x) => x.id === s.show)?.title} · 10%
                        gallery commission
                      </p>
                      <button
                        className="button dark"
                        onClick={() =>
                          update(
                            {
                              ...state,
                              submissions: state.submissions.map((x) =>
                                x === s ? { ...x, accepted: true } : x,
                              ),
                              shows: state.shows.map((x) =>
                                x.id === s.show
                                  ? {
                                      ...x,
                                      works: [...new Set([...x.works, s.work])],
                                    }
                                  : x,
                              ),
                              history: [
                                ...state.history,
                                event(
                                  w.id,
                                  `Exhibited at ${state.shows.find((x) => x.id === s.show)?.gallery}`,
                                  `${state.shows.find((x) => x.id === s.show)?.title}. Ownership remains with ${w.owner}.`,
                                  s.show,
                                ),
                              ],
                            },
                            "Accepted. Artwork is now displayed in the exhibition.",
                          )
                        }
                      >
                        Accept {w.title} ↗
                      </button>
                    </div>
                  );
                })}
              {!state.submissions.some((s) => !s.accepted) && (
                <p>
                  No pending submissions. Visit the demo artist, open a work and
                  submit it to an exhibition.
                </p>
              )}
            </section>
          </>
        )}
        {page === "artwork" && (
          <>
            <div className="art-layout">
              <div>{artImage(work)}</div>
              <div>
                <p className="eyebrow">PHYSICAL ARTWORK · DEMO</p>
                <h1>{work.title}</h1>
                <p>
                  {work.medium} · {work.dimensions}
                </p>
                <dl className="facts">
                  <dt>Original artist</dt>
                  <dd>{work.artist}</dd>
                  <dt>Current owner</dt>
                  <dd>{work.owner}</dd>
                  <dt>Image IPFS URI</dt>
                  <dd>{work.imageURI || defaults.image}</dd>
                  <dt>Manifest IPFS URI</dt>
                  <dd>{work.manifestURI || defaults.manifest}</dd>
                  <dt>Genesis</dt>
                  <dd>Locked at issuance</dd>
                  <dt>Price</dt>
                  <dd>{work.price} demo ETH</dd>
                </dl>
                <button
                  className="button dark"
                  disabled={work.owner !== work.artist}
                  onClick={() => buy(work, "directly from the artist")}
                >
                  {work.owner === work.artist
                    ? "Buy directly from artist ↗"
                    : "Collected ✓"}
                </button>
              </div>
            </div>
            <section className="panel" id="terms">
              <h2>Terms that travel with this artwork</h2>
              <TermsView work={work} terms={state.terms[work.termsId]} />
            </section>
            <section className="panel">
              <h2>Exhibition history</h2>
              {state.shows
                .filter((s) => s.works.includes(work.id))
                .map((s) => (
                  <p key={s.id}>
                    <a href={"/demo/exhibition/?id=" + s.id}>{s.title}</a> ·{" "}
                    {s.gallery} · {s.dates}
                  </p>
                ))}
            </section>
            <form
              className="panel"
              onSubmit={(e) => {
                e.preventDefault();
                const show = String(new FormData(e.currentTarget).get("show"));
                if (
                  state.submissions.some(
                    (s) => s.show === show && s.work === work.id,
                  ) ||
                  state.shows
                    .find((s) => s.id === show)
                    ?.works.includes(work.id)
                ) {
                  setNotice("This artwork is already submitted or exhibited.");
                  return;
                }
                update(
                  {
                    ...state,
                    submissions: [
                      ...state.submissions,
                      { work: work.id, show, accepted: false },
                    ],
                    history: [
                      ...state.history,
                      event(
                        work.id,
                        "Submitted to an exhibition",
                        `${work.owner} submitted ${work.title} to ${state.shows.find((s) => s.id === show)?.gallery}.`,
                        show,
                      ),
                    ],
                  },
                  "Submitted. Switch to Demo gallery to accept it.",
                );
              }}
            >
              <h2>Submit to an exhibition</h2>
              <label>
                Choose demo exhibition
                <select
                  aria-label="Choose demo exhibition"
                  name="show"
                  required
                >
                  {state.shows
                    .filter((s) => s.status === "current")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </select>
              </label>
              <p>
                Gallery receives exhibition and sale authority with 10%
                commission. Ownership stays with the current owner until
                purchase.
              </p>
              <button className="button" disabled={work.owner !== work.artist}>
                Submit demo artwork ↗
              </button>
            </form>
          </>
        )}
        {page === "exhibition" && (
          <>
            <p className="eyebrow">
              {show.gallery} · {show.status} DEMO EXHIBITION · {show.dates}
            </p>
            <h1>{show.title}</h1>
            <p className="intro">{show.description}</p>
            <div className="catalogue">
              {show.works
                .map((id) => state.works.find((w) => w.id === id)!)
                .map((w) => (
                  <article className="panel art-card" key={w.id}>
                    {artImage(w)}
                    <h2>{w.title}</h2>
                    <p>
                      Artist: {w.artist} · Owner: {w.owner}
                    </p>
                    <p>{w.price} demo ETH · Gallery commission: 10%</p>
                    <a href={"/demo/artwork/?id=" + w.id}>Artwork identity ↗</a>
                    <p>
                      <a href={"/demo/artwork/?id=" + w.id + "#terms"}>
                        Canonical artwork terms ↗
                      </a>{" "}
                      · {state.terms[w.termsId].royaltyBps / 100}% artist resale
                      royalty
                    </p>
                    <button
                      className="button dark"
                      disabled={show.status === "past" || w.owner !== w.artist}
                      onClick={() => buy(w, "through " + show.gallery, show.id)}
                    >
                      {show.status === "past"
                        ? "Past exhibition"
                        : w.owner === w.artist
                          ? "Buy from exhibition ↗"
                          : "Collected ✓"}
                    </button>
                  </article>
                ))}
            </div>
            {!show.works.length && (
              <p>
                This exhibition is open for submissions. Visit the demo artist
                to submit a work.
              </p>
            )}
          </>
        )}
        <section className="panel">
          <h2>One continuous history</h2>
          <ol>
            {state.history
              .filter((h) =>
                page === "artwork"
                  ? h.workId === work.id
                  : page === "exhibition"
                    ? h.showId === show.id
                    : true,
              )
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((h, i) => (
                <li className="history-event" key={i}>
                  <time dateTime={h.date}>{h.date}</time>
                  <h3>{h.title}</h3>
                  <p>{h.detail}</p>
                  <a href={"/demo/artwork/?id=" + h.workId}>
                    {state.works.find((w) => w.id === h.workId)?.title}
                  </a>
                  {h.showId && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={"/demo/exhibition/?id=" + h.showId}>
                        View exhibition
                      </a>
                    </>
                  )}
                </li>
              ))}
          </ol>
          <p className="fine">
            Illustrative demo records; Mika Sato, Harbour Gallery and the
            collectors are fictional. Physical delivery, legal execution and
            universal royalty enforcement are outside this demo.
          </p>
        </section>
      </main>
      <footer>
        <span>
          EON MUN is the example artist. Artwork Commons is the platform.
        </span>
        <a href="/docs/">Contracts, records & enforcement ↗</a>
        <a href="/">Return to the platform ↗</a>
      </footer>
    </>
  );
}

function TermsView({ work, terms }: { work: Work; terms: Terms }) {
  return (
    <>
      <p>
        One canonical record: <code>{terms.id}</code>. Exhibitions and sales
        refer back to these terms; they do not create new versions.
      </p>
      <dl className="facts">
        <dt>Artist resale royalty</dt>
        <dd>
          {terms.royaltyBps / 100}% to {work.artist} on supported resales.
        </dd>
        <dt>Holding period</dt>
        <dd>
          {terms.holdDays} days after purchase.
          {work.resaleAfter
            ? " Next permitted resale date: " + work.resaleAfter + "."
            : " Starts after the first purchase."}
        </dd>
      </dl>
      <p>
        Every work uses the same fixed policy: 180 days between ownership
        changes and 5% artist royalty on supported resales. This page simulates
        the policy; the local contract demo enforces it on chain. Primary sales
        are exempt. Gallery commission is agreed separately. These artwork terms
        cannot be customized.
      </p>
      <a href="/docs/#terms">See how terms and enforcement work ↗</a>
    </>
  );
}
