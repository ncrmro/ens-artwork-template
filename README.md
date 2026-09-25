# ENS artwork lifecycle template

**One artwork. One identity. Many participants.**

A reusable artist marketplace template for NFTs associated with physical artwork. **EON MUN** is the example artist using **eonmun.eth**. **Artwork Commons** is a provisional interface title, not the artist's name.

The interface follows one artwork through issuance, gallery delegation, exhibition and collector settlement. Its permanent identity is separate from current ownership and delegated commercial authority.

- Artist interface: https://eonmun-beta.ncrmro.workers.dev
- Independent gallery interface: https://eonmun-gallery-demo.ncrmro.workers.dev
- Local app: http://ncrmro-workstation.mercury:4325
- Public template: https://github.com/ncrmro/ens-artwork-template

## The core demo

1. The artist deploys a participant namespace under artist.eth, attaches an ArtworkRegistry at art.artist.eth, and links their ENS parent.
2. The artist issues blue-mountain.art.artist.eth with title, year, medium, dimensions, original image and manifest, and resale royalty terms. The transaction attributes issuance to the artist. Genesis records have no update path.
3. A different gallery wallet deploys its own namespace and GalleryRegistry at exhibitions.gallery.eth.
4. The artwork owner creates a MandateRegistry record granting a gallery application-specific EAC roles: list, exhibit and/or initiate sale. Each mandate fixes a price floor, commission and expiry. The gallery accepts.
5. The gallery publishes an exhibition referencing the artwork and creates a listing. The artist still owns the NFT. An optional custody statement is an attributed claim, not proof of physical possession.
6. The owner approves SimpleSettlement (never the gallery itself). A collector pays; settlement transfers the NFT directly from owner to collector and credits proceeds. Previous mandates become inactive. Both websites read the same owner, genesis and exhibition history.

Use the shared view URL or export the lifecycle addresses from Setup to configure independent websites. No custom database, indexer or application API is required to reconstruct these records; the Worker provides a replaceable read-only Sepolia RPC proxy.

## Contracts

| Contract | Responsibility |
| --- | --- |
| ParticipantRegistry | ENS registry beneath a participant's parent name; attaches art or exhibitions once |
| ArtworkRegistry | ENS PermissionedRegistry-derived singleton NFTs, immutable physical-art genesis, current-owner presentation records, transfer epochs, ERC-2981 royalty information |
| ArtResolver | Write-once IPFS contenthash and manifest records exposed through ENS resolution |
| MandateRegistry | Separate EnhancedAccessControl resources for each gallery mandate; scope, acceptance, price floor, commission, expiry and revocation |
| GalleryRegistry | Independent ENS exhibition names and append-only attributed references to artwork and mandates |
| SimpleSettlement | Noncustodial gallery listings, buyer settlement, commission/royalty splits, pull withdrawals |

Contracts deploy directly from the participant's wallet; a deployment factory is not needed for this MVP. The existing ArtRegistry, ArtSale and EvmExample are retained as legacy examples with their tests. Their deployment addresses are not compatible with the new lifecycle UI, which uses a separate configuration and browser storage namespace.

Application roles are ROLE_LIST (1), ROLE_EXHIBIT (16), ROLE_SELL (256), defined in MandateRegistry rather than as extra ENS name roles. Raw historical EAC assignments are not sufficient authority: callers must check active(), which validates acceptance, expiry, revocation, current owner, current token version and ownership epoch. No EAC admin roles are granted in that contract.

The artist registry grants token owners ENS transfer authority only. It keeps no root administrative roles or upgrade path. Owner presentation changes cannot mutate genesis. Transfers increment an epoch before receiver callbacks, preventing stale mandates from reviving after ownership round trips. Settlement uses ERC-1155 operator approval; the contract code restricts use to valid paid mandates.

Primary sales from the original artist pay the artist minus gallery commission. Later sales through SimpleSettlement additionally credit the configured royalty. ERC-2981 is informational; direct transfers and outside marketplaces do not guarantee payment.

## Configure and run

Node 24+, npm, Tailscale, Linux:

```sh
npm ci
npm run configure
npm run build
npm run dev
```

Use Setup to choose your artist display name and registered ENS parent. Connect its owning wallet and select Create / resume artist registry. Galleries use the gallery form with their own wallet and ENS name. The site guides up to six artist or four gallery transactions and saves each confirmed deployment so interrupted setup can resume. It never replaces an existing different ENS registry. You can also edit artist.config.json for deployment defaults. Lifecycle contract addresses can be entered in Setup, shared through query parameters, or exported back into this file. Choose your own Worker name before deploying a copy. A gallery uses its own ENS parent and wallet; its registry records reference the artist's contracts.

The local launcher binds to the host's Tailscale address and records DEV_URL in .env.local. It serves built assets through Wrangler; rebuild after frontend changes. Ethereum Sepolia (11155111) is used locally and publicly. No application blockchain runs locally.

The existing local user service is eonmun-beta-local.service and runs from the primary checkout on main. Do not use worktrees. The service is transient; restart npm run dev after reboot.

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:wallet
npm run deploy
npm exec -- wrangler deploy --config wrangler.gallery.jsonc
```

The wallet browser test creates independent artist, gallery and collector contexts, including a separate gallery origin. It uses an isolated EVM and injected test signers, not public Sepolia transactions. Browser smoke tests read live Sepolia and never sign wallet transactions.

## Status and boundaries

The initial Blue Mountain image is an original illustrative SVG, not an issued physical artwork. Sample data is labeled as a preview. The deployed interfaces need participants to deploy/link contracts, pin real IPFS files, issue a work, and perform live transactions before the public-chain demo is complete.

IPFS availability requires continued pinning. ENS resolution depends on parent renewal and registry links; the parent owner retains control of the parent pointer. The UI reads the first 100 records per collection and does not claim a full history of direct transfers outside this settlement.

The immutable issuance can reference an agreement URI and hash. The app does not execute a legal contract or verify its content. Buying the NFT does not itself prove physical possession or perform shipping.

Coming soon: policy-enforced secondary sales across marketplaces, holding periods, right of first refusal, verified custody, logistics, legal execution, museums, conservation, auctions and recovery.

ENS source is pinned with provenance in vendor/ens-v2/PROVENANCE.md. The pinned source and evolving public ENS v2 documentation can differ; our tests target the vendored revision.

See [requirements](requirements.md), [acceptance evidence](docs/acceptance.md), and [architecture](docs/lifecycle.md).

## Artist submissions

Issue artwork in Workspace, then choose Submit to gallery with the gallery wallet, exhibition/sale permissions, expiry and agreed commission. Create a gallery submission link and send it to the gallery. They open that link, connect their wallet, accept the submission, and publish an exhibition in their own registry. Exhibitions and sale receipts appear on the artwork page. Galleries can configure their registry before or after opening the submission link. This MVP works one artist collection at a time; it does not provide a global gallery inbox or multi-artist exhibition curation.
