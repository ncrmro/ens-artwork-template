# Acceptance record — 2026-09-25

## Runtime

The application is Next.js 16.3.6 App Router, with static page exports served by the Cloudflare Worker. Vite has been removed. `/artist/`, `/gallery/`, `/artwork/`, `/exhibition/` and `/demo/*` are distinct pages.

- Shared platform: https://eonmun-beta.ncrmro.workers.dev
- Second gallery instance: https://eonmun-gallery-demo.ncrmro.workers.dev/gallery/
- Local: http://ncrmro-workstation.mercury:4325
- Primary checkout: /home/ncrmro/repos/ncrmro/ens-artwork-template, main, no worktrees.

Public live pages use Ethereum Sepolia (11155111); the explicit local-chain mode uses official ENSv2 on Anvil (31337). Demo pages use isolated sessionStorage and never load wallet/chain code. The local service is eonmun-beta-local.service, transient until reboot.

## Verification

- Next.js production export and TypeScript pass; all application routes are generated.
- Seven contract scenarios pass, including gallery-first exhibition creation, owner submissions, acceptance authorization, duplicate rejection, gallery sale, direct primary sale and resale, exact commission/royalty credits, direct cancellation and stale listing rejection.
- Wallet browser integration uses independent artist, gallery and collector wallets and two origins on an isolated EVM. It verifies ENS choice and disabled unauthorized names, silent wallet restoration after reload, rejected deployment and resume without duplicate namespace deployment, both registry setups, artwork creation, exhibition creation, artist submission, gallery acceptance/listing, exhibition purchase, direct purchase and commission withdrawal.
- Demo browser verification creates artwork and an exhibition, submits/accepts work, buys from the exhibition and directly, and verifies persistence after reload. It checks the neutral landing page, absence of the old deployment panel, desktop/mobile layouts, and no browser exceptions.
- Live ENS discovery returned eonmun.eth and ncrmro.eth for the previously registered example wallet. Discovery candidates are verified onchain for current subregistry permission; no name is preselected.

## Public-chain acceptance still required

Unit and injected-wallet tests use an isolated EVM. `npm run local:verify` uses the official running ENSv2 devnet, with real local-chain transactions and snapshot restoration. Neither is live Sepolia. Participants must confirm deployment, issuance, submission, acceptance, listing and purchase transactions in their own funded Sepolia wallets before claiming a complete public-chain demonstration. No private signing keys are collected or held by this application.

The new GalleryRegistry and SimpleSettlement add methods absent from older deployed versions. Those contracts are immutable; incompatible old instances are not silently upgraded. Compatible participant namespaces can be reused without changing their parent pointer.

The UI reads at most 100 records per selected registry/recent listing set. IPFS pinning, name renewal and physical delivery remain participant responsibilities. The Tailscale HTTP origin can restrict wallet injection in some browsers; public instances use HTTPS. Legal execution, independently verified custody and universal royalty enforcement remain future work.

## Cloudflare release

Next.js build ID: `1bmBoP5tQ7EPH-gXsV6XW`. Shared platform version: `0026ffd1-9329-42fd-b453-9131eb7dcce7`. Gallery instance version: `fb5bc4ed-c547-446d-96a7-e0f5fb3385ab`. The deployed name-discovery endpoint returned both names for the example wallet. Production browser checks exercise the same demo creation/submission/acceptance/purchase story and responsive pages as local verification.

## Local ENSv2 demo acceptance — 2026-09-25

The primary checkout now runs the official pinned ENSv2 deployment on Anvil chain 31337. `eonmun.eth` and `atelier.eth` were registered through the registrar and linked to independent artist/gallery registries. Universal Resolver lookups returned contenthash records for `blue-mountain.art.eonmun.eth` and `tokyo.exhibitions.atelier.eth`.

`npm run local:verify` passed actual browser-driven local-chain issuance, exhibition creation, submission, acceptance, listing, exhibition and direct purchases, ownership readback and gallery commission withdrawal. It also checked role restoration and prefilled IPFS fixtures, then restored the seed. Final readback confirmed three artworks, one exhibition and two submissions. The devnet RPC listens only on 127.0.0.1; the app binds the recorded Tailscale address. Its read-only RPC rejects writes and its local wallet endpoint rejects Anvil administrative methods.

Typecheck, seven contract tests, the production build and the existing injected-wallet deployment/resume regression passed. Local test accounts are disposable and unlocked only on the local devnet; no public-chain transactions are claimed.

Final Next.js build: `ddRzLbD8TnlEEweO2AoxH`. Public shared platform version: `6577132e-ccab-401a-bdac-5186850508e6`. Public gallery version: `edffbb44-1592-4f18-bdd9-d2189fa636ef`. Public sites retain Sepolia configuration and receive the mock-demo IPFS form defaults.

## Multi-participant story update

The presentation layer now separates a plain-language homepage from `/docs/`. The story demo contains two artists, two galleries, three exhibitions and a work purchased successively by two collectors. Each artwork has one canonical terms record; gallery listings link back to it. Histories are filtered by artwork or exhibition, preserve artist attribution through purchases, and distinguish exhibitions from ownership changes. Past exhibitions do not offer purchases.

The canonical story terms illustrate a 180-day holding period, a below-threshold artist purchase option and a 5% resale royalty. The interface and docs explicitly distinguish those proposed clauses from current contract enforcement. The real local-chain seed and Solidity contracts are unchanged by this presentation update.

Validation: typecheck, all seven contract tests and the Next.js production build passed. The dedicated story browser checks passed locally and on both public sites, covering artist/gallery filters, successive buyers, artwork-specific history, canonical terms surviving a purchase and refresh, docs navigation, and desktop/mobile layout. The existing demo creation → submission → acceptance → purchase regression also passed on both public sites with zero blockchain writes and no page errors.

Published build: `k7SvcrtxqEnZR0C3p2C-m`. Shared Worker version: `23857a15-54ee-4889-8f99-b80bfc70d1b7`. Gallery Worker version: `49fc2121-c0bf-4f52-aca6-127e6ec76b18`.
