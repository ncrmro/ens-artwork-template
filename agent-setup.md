# Agent setup

Read README.md, requirements.md, AGENTS.md, and docs/personas.md. Canonical planning lives in `/home/ncrmro/notes/wiki/projects/eth-tokyo-eonmoon-v2/`.

Work directly in the primary checkout on main; do not create or use worktrees. Keep the old ETH Tokyo project untouched. This session authorizes implementation, Cloudflare deployment, and a persistent local Tailscale server. The earlier documentation-only limit is superseded.

Node 24 / npm is the declared environment. No global installation. Build contracts before tests, then typecheck, transaction tests, build, and browser checks. ENS source and npm dependencies are pinned. Never claim fixture EVM tests as public Sepolia transactions.

App and Worker always target Ethereum Sepolia, chain 11155111. Unit tests use an isolated in-process EVM; there is no local-chain application mode. The artist deploys through their wallet; no private keys or Burner PINs enter the app. Register/link the parent before claiming ENS resolution is live.

Use `npm run dev` for port allocation and Tailscale binding. The running session uses user service `eonmun-beta-local`; inspect it before starting another instance. Stop with `systemctl --user stop eonmun-beta-local` when requested.
