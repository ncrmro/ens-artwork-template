# Artwork Commons — ENS art platform template

A Next.js platform for artists and galleries to deploy their own ENS v2 registries, issue physical-art NFTs, curate exhibitions, and sell artwork. EON MUN is the example artist in demo mode, not the platform name or a preselected live account.

- [Live platform](https://eonmun-beta.ncrmro.workers.dev)
- [Artist](https://eonmun-beta.ncrmro.workers.dev/artist/) · [Gallery](https://eonmun-beta.ncrmro.workers.dev/gallery/)
- [Demo artist](https://eonmun-beta.ncrmro.workers.dev/demo/artist/) · [Demo gallery](https://eonmun-beta.ncrmro.workers.dev/demo/gallery/)
- Local: http://ncrmro-workstation.mercury:4325
- [Public GitHub template](https://github.com/ncrmro/ens-artwork-template)

## One artwork's life

1. Choose **Artist** or **Gallery** before seeing setup forms. Connect a wallet; choose one of its available ENS v2 Sepolia names. Candidate names come from the ENS beta indexer; the app checks current onchain subregistry permissions, including delegated access, before enabling setup.
2. An artist deploys `art.artist.eth`, then issues `blue-mountain.art.artist.eth`. Title, creator, year, material, dimensions, image, manifest and royalty terms are fixed at issuance.
3. A gallery deploys `exhibitions.gallery.eth` and creates an exhibition before receiving any artwork. It shares the exhibition invitation with artists.
4. An artist opens that invitation, selects their own work, and submits it with a scoped, expiring gallery mandate and agreed commission. NFT ownership stays with the artist.
5. The gallery accepts the mandate and submission, then lists at the agreed minimum price. An exhibition can accept works from different artists and settlement contracts.
6. A collector buys from the exhibition, or buys an owner's direct listing on the artwork page. Settlement transfers the NFT and credits proceeds atomically. Gallery sales pay commission; direct sales do not. Resales through this settlement credit the configured artist royalty.

The creator and genesis remain unchanged after purchase. Gallery exhibition records remain attributed history. Prior commercial mandates become inactive when ownership changes.

## Pages and demo

Next.js App Router provides `/`, `/artist/`, `/gallery/`, `/artwork/`, `/exhibition/`, and corresponding `/demo/` pages. The app is statically exported by Next.js and served by a Cloudflare Worker. Configuration, ENS discovery and read-only RPC endpoints stay in the Worker; no Node SSR server is required. Vite is not used.

Demo mode is isolated from wallet and chain code. Mock artwork creation, exhibition creation, submissions, acceptance and purchases persist in sessionStorage across refreshes and pages in the same tab. Reset restores the seed story. It is not onchain evidence.

Wallet restoration calls `eth_accounts` silently on each page load. Account changes reload that account's saved deployment context; keys are never stored. Live contracts and demo data use separate storage. Public artwork and invitation URLs carry contract references; the deployment-address/export panel has been removed.

## Run and verify

Node 24+, npm, Linux and Tailscale:

```sh
npm ci
npm run build
npm run dev
```

The local launcher records its Tailscale address and port in `.env.local`. It serves Next.js's `out/` through Wrangler. Run `npm run build:web` and restart the local service after frontend changes. Both local and deployed live pages use Ethereum Sepolia, chain ID 11155111.

```sh
npm run typecheck
npm test
npm run test:browser
npm run test:wallet
npm run deploy
npm exec -- wrangler deploy --config wrangler.gallery.jsonc
```

Work in the primary checkout on `main`; do not create worktrees. The transient user service is `eonmun-beta-local.service` and must be started again after a reboot.

## Contracts and boundaries

- ParticipantRegistry attaches `art` and `exhibitions` namespaces once. Setup can reuse a compatible namespace owned by the connected wallet and will not replace an unrelated ENS registry.
- ArtworkRegistry provides ERC-1155 singleton ownership, immutable genesis, owner presentation, transfer epochs and ERC-2981 royalty information. ArtResolver publishes immutable IPFS records.
- MandateRegistry uses application EAC, separate from ENS name roles. Acceptance, expiry, revocation, owner and ownership epoch are checked before commercial authority is used.
- GalleryRegistry creates exhibitions and records owner submissions and gallery decisions. Accepted references retain each artwork's own registry and settlement.
- SimpleSettlement supports gallery-mediated and direct sales, cancellation of direct listings, exact payment, stale-owner checks, royalty/commission accounting and pull withdrawals.

Legacy ArtRegistry/ArtSale/EvmExample contracts remain as examples with their tests. Older GalleryRegistry/SimpleSettlement deployments do not implement the new exhibition/direct-sale methods and cannot be upgraded in place. The deploy flow uses the current artifacts. Do not reuse incompatible contract addresses.

The UI reads at most 100 artworks, exhibitions, submissions and recent listings per selected registry. ENS discovery is an indexer dependency and can lag; a manual name check verifies new names onchain. It currently supports normalized ASCII second-level .eth parents. IPFS content must be pinned. Parent renewal and pointer control remain the parent owner's responsibility.

Royalties apply inside these settlement contracts; ERC-2981 does not enforce royalties on outside marketplaces. Physical custody, delivery, legal execution, holding periods, right of first refusal, museums and conservation remain future work. An exhibition statement does not prove possession.

See [requirements](requirements.md), [acceptance](docs/acceptance.md), and [architecture](docs/lifecycle.md). Transaction tests use an isolated EVM; real Sepolia receipts still require participant signatures.
