# Artist template
Read requirements.md and docs/personas.md before changes. Use Node 24 and npm ci. Verify npm run typecheck, npm test, npm run build. Public deployments target Ethereum Sepolia. The explicit local-chain demo uses the pinned official ENSv2 devnet on chain 31337; keep its configuration and disposable wallets isolated from public deployments. Unit tests may use an isolated in-process EVM. Never collect keys or PINs. Keep Burner optional.

## Checkout and dev server

Do not create or use Git worktrees for this repository. Work directly in the primary checkout at /home/ncrmro/repos/ncrmro/ens-artwork-template, keeping it on main. This repository-specific rule overrides the parent directory worktree convention.

Start and maintain the primary development server from this checkout only. Use npm run dev and the recorded .env.local DEV_URL; the local app must use the Tailscale hostname. Use npm run local:dev for the seeded local chain; npm run dev targets Sepolia. Stop any older server for this app before replacing it.
