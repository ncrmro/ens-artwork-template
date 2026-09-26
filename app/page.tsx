import SiteHeader from "../src/SiteHeader";
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="page home-page">
        <section className="page-heading">
          <div>
            <p className="eyebrow">
              FOR THE PEOPLE WHO MAKE, SHOW AND COLLECT ART
            </p>
            <h1>
              Art has a life.
              <br />
              <em>Give it an identity.</em>
            </h1>
            <p className="intro">
              Give every physical artwork a lasting record: who made it, where
              it has been exhibited, who has collected it, and the terms that
              travel with it.
            </p>
            <div className="actions">
              <a className="button dark" href="/demo/artwork/?id=blue-mountain">
                Follow one artwork’s story ↗
              </a>
              <a className="button" href="/demo/gallery/">
                Explore the exhibitions ↗
              </a>
            </div>
          </div>
        </section>
        <div className="split">
          <article className="panel">
            <p className="eyebrow">FOR ARTISTS</p>
            <h2>Your work. Your terms.</h2>
            <p>
              Create a collection under your own name. Offer work directly or
              submit it to a gallery. Your attribution stays with the artwork as
              it moves between exhibitions and collectors.
            </p>
            <a className="button" href="/artist/">
              Create an art registry ↗
            </a>
          </article>
          <article className="panel">
            <p className="eyebrow">FOR GALLERIES</p>
            <h2>Bring artists together.</h2>
            <p>
              Build exhibitions with work from different artists. Agree the
              commission, accept submissions and sell on an owner’s behalf,
              while keeping each work connected to its original record.
            </p>
            <a className="button" href="/gallery/">
              Create a gallery registry ↗
            </a>
          </article>
        </div>
        <section className="section">
          <h2>A shared history, wherever the work goes.</h2>
          <div className="life-steps">
            <div>
              <span>01 · CREATE</span>
              <h3>The artist begins the record.</h3>
              <p>
                A title, an image, the materials and one set of artwork terms.
              </p>
            </div>
            <div>
              <span>02 · EXHIBIT</span>
              <h3>Galleries add context.</h3>
              <p>
                Each exhibition becomes part of the story. Showing a work does
                not change its owner.
              </p>
            </div>
            <div>
              <span>03 · COLLECT</span>
              <h3>A new owner joins the story.</h3>
              <p>
                The sale records a change of ownership and accounts for the
                agreed payments.
              </p>
            </div>
            <div>
              <span>04 · CONTINUE</span>
              <h3>The record stays together.</h3>
              <p>
                Future galleries and collectors can follow the same work back to
                its artist.
              </p>
            </div>
          </div>
        </section>
        <section className="panel">
          <h2>Understand the terms before you buy.</h2>
          <p>
            See the artwork’s canonical terms alongside its history: the
            artist’s resale royalty, any proposed holding period, and any
            proposed artist purchase option. Every exhibition links to that same
            record.
          </p>
          <p>
            Our demo shows how these clauses would be presented. Holding periods
            and artist purchase options are not yet enforced by the platform.
          </p>
          <a href="/docs/#terms">See what is supported today ↗</a>
        </section>
        <section className="closing">
          <h2>Start with the story.</h2>
          <p>
            Meet two artists, visit two galleries and follow an artwork through
            successive collections. The example records are illustrative; no
            wallet is needed.
          </p>
          <a className="button dark" href="/demo/artist/">
            Explore the complete demo ↗
          </a>
          <a className="button" href="/docs/">
            How it works ↗
          </a>
        </section>
      </main>
      <footer>
        <span>ARTWORK COMMONS · A lasting record for physical art.</span>
        <a href="/docs/">Technical documentation</a>
      </footer>
    </>
  );
}
