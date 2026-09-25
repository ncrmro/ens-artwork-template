"use client";
import React, { useState } from "react";
type Work = {
  id: string;
  title: string;
  medium: string;
  dimensions: string;
  price: string;
  owner: string;
  variant: number;
};
type Show = { id: string; title: string; description: string; works: string[] };
type DemoState = {
  works: Work[];
  shows: Show[];
  submissions: { work: string; show: string; accepted: boolean }[];
  history: string[];
};
const store = "artwork-commons:demo:v1";
const initial: DemoState = {
  works: [
    {
      id: "blue-mountain",
      title: "Blue Mountain",
      medium: "Acrylic and gold leaf on linen",
      dimensions: "48 × 116 inches",
      price: "0.5",
      owner: "EON MUN",
      variant: 0,
    },
    {
      id: "quiet-tide",
      title: "Quiet Tide",
      medium: "Oil on canvas",
      dimensions: "60 × 80 cm",
      price: "0.3",
      owner: "EON MUN",
      variant: 1,
    },
    {
      id: "after-the-rain",
      title: "After the Rain",
      medium: "Pigment and graphite on paper",
      dimensions: "42 × 60 cm",
      price: "0.2",
      owner: "EON MUN",
      variant: 2,
    },
  ],
  shows: [
    {
      id: "tokyo",
      title: "Between Earth & Ether",
      description:
        "Physical works, independent identities. A Tokyo exhibition exploring landscape, material and memory.",
      works: ["blue-mountain", "quiet-tide"],
    },
  ],
  submissions: [],
  history: [
    "EON MUN issued Blue Mountain. Genesis locked.",
    "Atelier Gallery accepted Blue Mountain for Between Earth & Ether.",
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
  const q = new URLSearchParams(location.search);
  const work = state.works.find((w) => w.id === q.get("id")) || state.works[0];
  const show = state.shows.find((s) => s.id === q.get("id")) || state.shows[0];
  function update(next: DemoState, message: string) {
    sessionStorage.setItem(store, JSON.stringify(next));
    setState(next);
    setNotice(message);
  }
  function buy(w: Work, via: string) {
    update(
      {
        ...state,
        works: state.works.map((x) =>
          x.id === w.id ? { ...x, owner: "You (demo collector)" } : x,
        ),
        history: [
          ...state.history,
          `Demo collector purchased ${w.title} ${via}. Original artist remains EON MUN.`,
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
      <p className="eyebrow">EON MUN · {w.medium}</p>
      <h2>{w.title}</h2>
      <p>
        {w.owner === "EON MUN" ? w.price + " demo ETH" : "Collected"} · Owner:{" "}
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
            <p className="eyebrow">EXAMPLE ARTIST · ART.EONMUN.ETH</p>
            <div className="page-heading">
              <div>
                <h1>EON MUN</h1>
                <p className="intro">
                  Landscapes held in pigment, light and memory.
                  <br />
                  Physical artworks with a permanent digital identity.
                </p>
              </div>
              <button className="button dark" onClick={() => setForm(!form)}>
                Create artwork ↗
              </button>
            </div>
            <div className="profile-strip">
              <span>Independent artist registry ✓</span>
              <span>Immutable genesis ✓</span>
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
                    medium: String(f.get("medium")),
                    dimensions: String(f.get("dimensions")),
                    price: String(f.get("price")),
                    owner: "EON MUN",
                    variant: state.works.length % 3,
                  };
                  update(
                    {
                      ...state,
                      works: [...state.works, w],
                      history: [
                        ...state.history,
                        `EON MUN issued ${title}. Demo genesis locked.`,
                      ],
                    },
                    "Demo artwork created. It appears in your collection.",
                  );
                  setForm(false);
                }}
              >
                <h2>New demo artwork</h2>
                <div className="config-grid">
                  {input("Artwork title", "title")}
                  {input("Medium", "medium", "Oil on canvas")}
                  {input("Dimensions", "dimensions", "60 × 80 cm")}
                  {input("Price (demo ETH)", "price", "0.1")}
                </div>
                <p>
                  Demo uses an illustrative image. Live artwork requires your
                  own pinned IPFS image and manifest.
                </p>
                <button className="button dark">Create demo artwork</button>
              </form>
            )}
            <div className="catalogue">{state.works.map(card)}</div>
          </>
        )}
        {page === "gallery" && (
          <>
            <p className="eyebrow">EXAMPLE GALLERY · EXHIBITIONS.ATELIER.ETH</p>
            <div className="page-heading">
              <div>
                <h1>Atelier Gallery</h1>
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
                    description: String(f.get("description")),
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
                {input("Exhibition title", "title")}
                {input("Exhibition description", "description")}
                <button className="button dark">Create demo exhibition</button>
              </form>
            )}
            <div className="catalogue">
              {state.shows.map((s) => (
                <article className="panel art-card" key={s.id}>
                  {artImage(
                    state.works.find((w) => w.id === s.works[0]) ||
                      state.works[0],
                  )}
                  <p className="eyebrow">EXHIBITION · {s.works.length} WORKS</p>
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
                        EON MUN →{" "}
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
                                `Atelier Gallery accepted ${w.title}. The artist retains ownership.`,
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
                  <dd>EON MUN</dd>
                  <dt>Current owner</dt>
                  <dd>{work.owner}</dd>
                  <dt>Genesis</dt>
                  <dd>Locked at issuance</dd>
                  <dt>Price</dt>
                  <dd>{work.price} demo ETH</dd>
                </dl>
                <button
                  className="button dark"
                  disabled={work.owner !== "EON MUN"}
                  onClick={() => buy(work, "directly from the artist")}
                >
                  {work.owner === "EON MUN"
                    ? "Buy directly from artist ↗"
                    : "Collected ✓"}
                </button>
              </div>
            </div>
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
                      `EON MUN submitted ${work.title} to Atelier Gallery.`,
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
                  {state.shows.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Gallery receives exhibition and sale authority with 10%
                commission. Ownership stays with the artist until purchase.
              </p>
              <button className="button" disabled={work.owner !== "EON MUN"}>
                Submit demo artwork ↗
              </button>
            </form>
          </>
        )}
        {page === "exhibition" && (
          <>
            <p className="eyebrow">ATELIER GALLERY · DEMO EXHIBITION</p>
            <h1>{show.title}</h1>
            <p className="intro">{show.description}</p>
            <div className="catalogue">
              {show.works
                .map((id) => state.works.find((w) => w.id === id)!)
                .map((w) => (
                  <article className="panel art-card" key={w.id}>
                    {artImage(w)}
                    <h2>{w.title}</h2>
                    <p>Artist: EON MUN · Owner: {w.owner}</p>
                    <p>{w.price} demo ETH · Gallery commission: 10%</p>
                    <a href={"/demo/artwork/?id=" + w.id}>Artwork identity ↗</a>
                    <button
                      className="button dark"
                      disabled={w.owner !== "EON MUN"}
                      onClick={() => buy(w, "through Atelier Gallery")}
                    >
                      {w.owner === "EON MUN"
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
            {state.history.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
          <p className="fine">
            Illustrative demo records. Physical delivery, legal execution and
            universal royalty enforcement are outside this demo.
          </p>
        </section>
      </main>
      <footer>
        <span>
          EON MUN is the example artist. Artwork Commons is the platform.
        </span>
        <a href="/">Return to live Sepolia platform ↗</a>
      </footer>
    </>
  );
}
