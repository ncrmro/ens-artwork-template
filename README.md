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
6. A collector buys from the exhibition, or buys an owner's direct listing on the artwork page. Settlement transfers the NFT and credits proceeds atomically. Gallery sales pay commission; direct sales do not. Resales through this settlement credit the standard 5% artist royalty.

The creator and genesis remain unchanged after purchase. Gallery exhibition records remain attributed history. Prior commercial mandates become inactive when ownership changes.

## Pages and demo

Next.js App Router provides `/`, `/artist/`, `/gallery/`, `/artwork/`, `/exhibition/`, and corresponding `/demo/` pages. The app is statically exported by Next.js and served by a Cloudflare Worker. Configuration, ENS discovery and read-only RPC endpoints stay in the Worker; no Node SSR server is required. Vite is not used.

Demo mode is isolated from wallet and chain code. Mock artwork creation, exhibition creation, submissions, acceptance and purchases persist in sessionStorage across refreshes and pages in the same tab. Reset restores the seed story. It is not onchain evidence.

Wallet restoration calls `eth_accounts` silently on each page load. The current artist/gallery tenant is stored in localStorage, scoped by wallet, chain and local seed run. Account changes reload that account's saved tenant; keys are never stored. Workspace navigation uses clean URLs. Shared record and invitation links never replace the managed tenant. Live contracts and demo data use separate storage. Public artwork and invitation URLs carry contract references; the deployment-address/export panel has been removed.

## Run and verify

Node 24+, npm, Linux and Tailscale:

```sh
npm ci
npm run build
npm run dev
```

The local launcher records its Tailscale address and port in `.env.local`. It serves Next.js's `out/` through Wrangler. Run `npm run build:web` and restart the local service after frontend changes. This default mode and public deployments use Ethereum Sepolia, chain ID 11155111. For the seeded real local chain (31337), use `npm run local:dev`; see the local demo walkthrough below.

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

Royalties apply inside these settlement contracts; ERC-2981 does not enforce royalties on outside marketplaces. Physical custody, delivery, legal execution, right of first refusal, museums and conservation remain future work. An exhibition statement does not prove possession.

See [requirements](requirements.md), [acceptance](docs/acceptance.md), and [architecture](docs/lifecycle.md). Transaction tests use an isolated EVM; real Sepolia receipts still require participant signatures.

## Seeded local ENSv2 demo

Run the real artist → gallery → collector flow on chain 31337 with `eonmun.eth` and `atelier.eth`. See [local demo setup and walkthrough](docs/local-demo.md). The primary local app uses the recorded Tailscale URL; public deployments continue to use Sepolia. Both the local-chain forms and the separate mock demo have sample IPFS defaults.

## Presentation story and technical guide

The homepage explains the platform for artists, galleries and collectors. `/docs/` is the technical companion: contract responsibilities, ENSv2 namespace resolution, canonical terms, settlement and the difference between recorded clauses and implemented enforcement.

The wallet-free `/demo/` story now includes EON MUN and fictional artist Mika Sato, Atelier and Harbour galleries, three exhibitions and successive collectors Alex Chen and Rowan Ellis. Blue Mountain keeps the same artist and terms record as it moves between collections and exhibitions. Artwork pages scope the timeline to that work; exhibition cards link to the same canonical terms.

This narrative is fictional demonstration data shared with the real-chain catalogue seed. On-chain historical entries are attributed reports; they do not represent retroactive settlement. New local registries enforce the shared 180-day transfer hold and 5% resale royalty policy. The story demo simulates the same fixed policy. Artist purchase options remain future work. Run `npm run test:story` against the recorded local URL or set `BASE_URL` for a deployed site.

New artwork registries reject custom clauses. Every first sale is immediately available; subsequent ownership transfers wait 180 days. The interface shows live unlock dates and gallery permissions. `npm run local:verify:policy` verifies successful and reverted transactions on the official ENSv2 devnet, restoring a snapshot afterward. Older Sepolia registries require redeployment to gain the policy.

Public browsing is separate from management: `/browse/art/`, `/browse/galleries/`, and `/browse/exhibitions/` read ENS registries without connecting a wallet or selecting a tenant. The local chain supplies its seeded names; public Sepolia browsing automatically checks the maintained namespace index and also supports looking up a name. The header namespace selector switches between `art.<name>` artist management and `exhibitions.<name>` gallery management for names the connected wallet can access. `/workspace/` resumes the last management mode.

## Shared historical catalogue and Sepolia seed

The staged UI and real seed use `src/demo-catalogue.json`. `npm run seed:check` validates a Sepolia plan; `npm run seed:sepolia` uses an external signer to publish the catalogue and export the hardcoded ENS namespace index. See [the seed walkthrough](docs/sepolia-seed.md) for wallet/name prerequisites, resumability and evidence boundaries.

New contracts support backdated artwork creation, gallery establishment, exhibitions and attributed historical purchase reports. Future dates are rejected; actual recording timestamps are retained. A historical report does not fake settlement or alter ownership/holding periods. Old deployed registries need replacement deployments to expose these new methods.

The live `/admin/` page is available to the connected owner of **ncrmro.eth on Sepolia**. It refreshes owned ENS names, checks an explicit seed plan, and runs/resumes wallet-signed catalogue transactions. Its completed index is published on-chain for both sites to discover automatically. See [admin seeding](docs/sepolia-seed.md#launch-from-the-website). Demo participant accounts are separate contracts controlled by this one administrator; production artist/gallery wallets remain independent.
