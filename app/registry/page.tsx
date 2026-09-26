import SiteHeader from "../../src/SiteHeader";
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <p className="eyebrow">CREATE A NEW REGISTRY</p>
        <h1>A home for your art or exhibitions.</h1>
        <p className="intro">
          Choose what you want to manage. Next, connect your wallet and select
          an ENS name you control.
        </p>
        <div className="split">
          <a className="panel choice-card" href="/registry/artist/">
            <span className="tag">FOR ARTISTS</span>
            <h2>Artwork registry ↗</h2>
            <p>
              Create a permanent record for each physical artwork under your
              name. Build your collection, sell directly, and loan artwork to
              galleries for exhibitions and sales.
            </p>
          </a>
          <a className="panel choice-card" href="/registry/gallery/">
            <span className="tag">FOR GALLERIES</span>
            <h2>Gallery registry ↗</h2>
            <p>
              Create exhibitions under your gallery’s name. Invite artists,
              accept artwork submissions, and sell on their behalf while they
              retain ownership until purchase.
            </p>
          </a>
        </div>
      </main>
    </>
  );
}
