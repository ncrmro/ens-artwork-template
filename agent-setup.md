# Agent setup

Read README.md, requirements.md, AGENTS.md, and docs/personas.md. Canonical planning lives in `/home/ncrmro/notes/wiki/projects/eth-tokyo-eonmoon-v2/`.

Work directly in the primary checkout on main; do not create or use worktrees. Keep the old ETH Tokyo project untouched. This session authorizes implementation, Cloudflare deployment, and a persistent local Tailscale server. The earlier documentation-only limit is superseded.

Node 24 / npm is the declared environment. No global installation. Build contracts before tests, then typecheck, transaction tests, build, and browser checks. ENS source and npm dependencies are pinned. Never claim fixture EVM tests as public Sepolia transactions.

Public Workers target Ethereum Sepolia, chain 11155111. The local-chain application uses official pinned ENSv2 contracts on Anvil chain 31337; see docs/local-demo.md. Its separate local server exposes only disposable test accounts and is never shipped to Cloudflare. Unit tests also use an isolated in-process EVM. The artist deploys through their wallet; no private keys or Burner PINs enter the app. Register/link the parent before claiming ENS resolution is live.

Use `npm run local:dev` for the seeded local-chain demo or `npm run dev` for Sepolia, both with port allocation and Tailscale binding. The running session uses user service `eonmun-beta-local`; inspect it before starting another instance. Stop with `systemctl --user stop eonmun-beta-local` when requested.

The current app implements the physical-art lifecycle in docs/lifecycle.md: immutable genesis, independent gallery registries, application EAC mandates, and direct owner-to-collector settlement. EON MUN is the example artist, never the template name. Do not reuse legacy ArtRegistry/ArtSale addresses for lifecycle configuration. Both public sites must be updated for UI changes.

The UI is now Next.js App Router, exported to out/ and served by the Worker; Vite has been removed. Use npm run build:web for UI-only builds. Artist/gallery onboarding, artwork and exhibition views are separate real routes. Demo pages are wallet-free sessionStorage simulations. ENS discovery uses the official beta app's indexer, followed by live role checks. GalleryRegistry and SimpleSettlement now support exhibition-first submissions and direct sales; older deployed instances lack these methods.
