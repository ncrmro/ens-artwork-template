import type { ReactNode } from "react";
export default function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="site-header">
      <a className="brand" href="/">
        <span className="brand-symbol">◈</span>
        <span>
          ARTWORK COMMONS<small>THE LIFE OF AN ARTWORK</small>
        </span>
      </a>
      <nav aria-label="Main navigation">
        <a href="/browse/art/">Browse</a>
        <a href="/docs/">How it works</a>
        <a href="/demo/artist/">Demo</a>
      </nav>
      {children || (
        <a className="button" href="/workspace/">
          My workspace ↗
        </a>
      )}
    </header>
  );
}
