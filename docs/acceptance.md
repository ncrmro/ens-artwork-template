# Acceptance record — 2026-09-25

## Runtime

The application is Next.js 16.3.6 App Router, with static page exports served by the Cloudflare Worker. Vite has been removed. `/artist/`, `/gallery/`, `/artwork/`, `/exhibition/` and `/demo/*` are distinct pages.

- Shared platform: https://eonmun-beta.ncrmro.workers.dev
- Second gallery instance: https://eonmun-gallery-demo.ncrmro.workers.dev/gallery/
- Local: http://ncrmro-workstation.mercury:4325
- Primary checkout: /home/ncrmro/repos/ncrmro/ens-artwork-template, main, no worktrees.

Live pages use Ethereum Sepolia (11155111). Demo pages use isolated sessionStorage and never load wallet/chain code. The local service is eonmun-beta-local.service, transient until reboot.

## Verification

- Next.js production export and TypeScript pass; all application routes are generated.
- Seven contract scenarios pass, including gallery-first exhibition creation, owner submissions, acceptance authorization, duplicate rejection, gallery sale, direct primary sale and resale, exact commission/royalty credits, direct cancellation and stale listing rejection.
- Wallet browser integration uses independent artist, gallery and collector wallets and two origins on an isolated EVM. It verifies ENS choice and disabled unauthorized names, silent wallet restoration after reload, rejected deployment and resume without duplicate namespace deployment, both registry setups, artwork creation, exhibition creation, artist submission, gallery acceptance/listing, exhibition purchase, direct purchase and commission withdrawal.
- Demo browser verification creates artwork and an exhibition, submits/accepts work, buys from the exhibition and directly, and verifies persistence after reload. It checks the neutral landing page, absence of the old deployment panel, desktop/mobile layouts, and no browser exceptions.
- Live ENS discovery returned eonmun.eth and ncrmro.eth for the previously registered example wallet. Discovery candidates are verified onchain for current subregistry permission; no name is preselected.

## Public-chain acceptance still required

Tests that sign transactions use an isolated EVM, not live Sepolia. Participants must confirm deployment, issuance, submission, acceptance, listing and purchase transactions in their own funded Sepolia wallets before claiming a complete public-chain demonstration. No private signing keys are collected or held by this application.

The new GalleryRegistry and SimpleSettlement add methods absent from older deployed versions. Those contracts are immutable; incompatible old instances are not silently upgraded. Compatible participant namespaces can be reused without changing their parent pointer.

The UI reads at most 100 records per selected registry/recent listing set. IPFS pinning, name renewal and physical delivery remain participant responsibilities. The Tailscale HTTP origin can restrict wallet injection in some browsers; public instances use HTTPS. Legal execution, independently verified custody and universal royalty enforcement remain future work.

## Cloudflare release

Next.js build ID: `1bmBoP5tQ7EPH-gXsV6XW`. Shared platform version: `0026ffd1-9329-42fd-b453-9131eb7dcce7`. Gallery instance version: `fb5bc4ed-c547-446d-96a7-e0f5fb3385ab`. The deployed name-discovery endpoint returned both names for the example wallet. Production browser checks exercise the same demo creation/submission/acceptance/purchase story and responsive pages as local verification.
