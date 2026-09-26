export default function SiteHeader() {
  return (
    <header>
      <a className="brand" href="/">
        <span className="brand-symbol">◈</span>
        <span>
          ARTWORK COMMONS<small>THE LIFE OF AN ARTWORK</small>
        </span>
      </a>
      <nav aria-label="Main navigation">
        <a href="/artist/">Artists</a>
        <a href="/gallery/">Galleries</a>
        <a href="/demo/artist/">Explore demo</a>
        <a href="/docs/">How it works</a>
      </nav>
    </header>
  );
}
