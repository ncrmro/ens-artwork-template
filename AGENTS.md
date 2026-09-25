# Artist template
Read requirements.md and docs/personas.md before changes. Use Node 24 and npm ci. Verify npm run typecheck, npm test, npm run build. Both local and deployed app target Ethereum Sepolia, not Base Sepolia or a local chain. Unit tests may use an isolated in-process EVM. Never collect keys or PINs. Keep Burner optional.

## Checkout and dev server

Do not create or use Git worktrees for this repository. Work directly in the primary checkout at /home/ncrmro/repos/ncrmro/ens-artwork-template, keeping it on main. This repository-specific rule overrides the parent directory worktree convention.

Start and maintain the primary development server from this checkout only. Use npm run dev and the recorded .env.local DEV_URL; the local app must use the Tailscale hostname and Ethereum Sepolia. Stop any older server for this app before replacing it.
