# Real local ENSv2 demo

This mode runs the official ENSv2 contracts at revision `48b3e2d39513b9dd32ef1850877a29009bc807b9`, with Anvil chain **31337**. It registers names through the real registrar commit/reveal flow, then deploys this platform's contracts. Public Cloudflare deployments remain on Sepolia. `/demo/*` remains the separate, labelled session-storage mock experience.

Prerequisites: Node 24+, npm dependencies (`npm ci`), Bun, Foundry (`forge` and `anvil`), Git, and Tailscale. On NixOS, run the preparation and chain commands inside `nix shell nixpkgs#bun nixpkgs#foundry`.

```sh
npm run local:prepare
npm run build
npm run local:chain
# In another terminal, stop the old app server first:
npm run local:dev
```

Use `DEV_URL` in `.env.local`. The runner binds the app to the Tailscale IP and records its hostname; Anvil stays on loopback. The local web server is separate from the Cloudflare Worker and cannot be deployed by `wrangler deploy`.

The seed creates:

- `eonmun.eth`, owned by the artist, with `art.eonmun.eth`, three artwork NFTs, immutable IPFS genesis records, 5% resale royalties, mandates and settlement.
- `atelier.eth`, owned by Atelier Gallery, with `exhibitions.atelier.eth` and the **Between Earth & Ether** exhibition.
- Blue Mountain accepted and listed through the gallery at 0.1 test ETH with 10% commission; Quiet Tide pending gallery acceptance; After the Rain listed directly at 0.2 test ETH.
- Three funded, disposable accounts: artist, gallery and collector. The local role buttons use Anvil's unlocked test accounts, without asking for personal wallet credentials. Anyone who can reach this local app can operate these shared demo accounts.

## Presentation walkthrough

1. Open `/artist/`. EON MUN's three works are on-chain. The creation form has sample IPFS image and manifest defaults. Issue another artwork.
2. Open `/gallery/`, choose **Use gallery**, and create an exhibition with the prefilled IPFS manifest.
3. Choose **Use artist**, open an artwork, and submit it to an exhibition. The artist retains ownership.
4. Choose **Use gallery**, open the exhibition, accept the submission, then list it at the agreed price. The seeded Tokyo exhibition also has a pending submission ready to accept.
5. Choose **Use collector** and buy from the exhibition. The NFT owner changes and proceeds are credited to the artist and gallery.
6. Buy After the Rain directly from its artwork page. That sale has no gallery commission.
7. Choose **Use gallery** and withdraw the earned commission.

The role persists in localStorage across refresh, navigation and browser sessions, scoped to the seed run. Local contract context is isolated by chain and seed run ID. ENS discovery lists the seeded name owned by the current role and the UI verifies its permissions on-chain; this is not a general-purpose local ENS indexer. Collectors own no seeded ENS name.

## Fixtures and reset

`npm run local:fixtures` generates valid raw-block IPFS CIDs from bundled SVG and JSON files. `/ipfs/<CID>` serves those exact bytes without depending on public gateways or a remote pinning provider. This is a local fixture gateway, not a public IPFS node or upload service. Sample manifest defaults should be replaced with an artwork's own metadata for real publication.

Stop and restart `local:chain` for a fresh deterministic deployment and seed. Wait for **ARTWORK LOCAL DEMO READY**, then refresh the app. The Anvil chain is ephemeral; restarting the app alone retains chain state. The new seed run ID invalidates saved contexts from the previous run.

`npm run local:verify` performs browser transactions against the running app: artwork creation, exhibition creation, gallery acceptance/listing, gallery and direct purchases, ownership and payout readback, withdrawal, refresh and IPFS defaults. It snapshots the chain and restores it afterward. Run it when nobody else is using the demo, since restoration discards transactions made during verification.

On this checkout the primary app is managed by `eonmun-beta-local.service` and the chain by `eonmun-local-chain.service` (user systemd services). Restart the chain service to reset the seed; monitor `journalctl --user -u eonmun-local-chain.service -f` for readiness.

## Canonical policy and real permission evidence

All newly deployed artwork registries use the same immutable `TERMS_ID`: 180 days between ownership transfers and 5% artist royalties on supported resales. Artists cannot choose alternative terms. The initial sale is immediate; gallery loans retain token ownership and do not reset the clock. Single, batch and operator transfers all enforce the hold. Right of first refusal remains future work.

The seed now includes **Collected Study**, actually bought by the collector and locked on chain. Other works remain available for the live artist → exhibition → gallery acceptance → collector purchase flow. Expand **Seed transaction evidence** for mint/deployment/purchase hashes. The artwork page reads its owner, unlock time and scoped gallery permissions from the contracts.

`npm run local:verify:policy` sends real successful and reverting transactions against the official local ENSv2 deployment. It verifies role escalation rejection, holding-period enforcement, an exhibition loan during the hold, a sale after advancing local block time, 5% royalty accounting, invalidation and revocation. It snapshots and restores the visible demo; verification receipts are diagnostic and cease to exist after the revert. Seed receipts remain available. The web API does not expose time-travel methods.

Select an accessible name in the top-right namespace control. Artist and gallery pages maintain distinct workspaces; the selector verifies current ENS subregistry permission. Switching demo accounts does not imply control of the displayed collection.
