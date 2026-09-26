# The life of an artwork

The supplied narrative and hackathon scope are the basis for this implementation. The core is an artist, gallery and collector interacting with independently controlled ENS records. Artwork Commons is a working title; EON MUN is the example artist.

## Namespace

eonmun.eth → ParticipantRegistry → art → ArtworkRegistry → blue-mountain → ArtResolver

gallery.eth → ParticipantRegistry → exhibitions → GalleryRegistry → tokyo-2026 → ArtResolver

Both collections extend the pinned ENS v2 PermissionedRegistry. ParticipantRegistry attaches only art and exhibitions; neither attachment has an update path in that contract. A parent ENS owner can still replace the participant registry pointer at the .eth level.

## Authority

- Genesis: written once by the original artist. Resolver data, metadata, artist and royalty settings have no setter after issuance.
- Owner-derived: current owner is read from ArtworkRegistry. Only that owner can grant/revoke mandates and edit public presentation.
- Delegated: each mandate is a distinct EAC resource with custom list/exhibit/sell roles. Its role assignment is historical; effective authority also requires active acceptance, unexpired/unrevoked terms, matching token version, matching owner and matching ownership epoch.
- Gallery records: the gallery publishes to its own registry under an active exhibit mandate. The record anchors issuer, timestamp, artwork address/token, mandate and manifest. Issuer attribution is provided by the signed Ethereum transaction, not an additional offchain EIP-712 signature.
- Settlement: the gallery proposes a listing within accepted terms. The owner authorizes the settlement contract with ERC-1155 approval. A buyer pays exactly the listed amount. The contract credits payment splits and transfers the NFT atomically without first taking custody.
- Ownership change: single and batch transfer entry points increment ownership epochs. Old mandates remain historical but are ineffective, even if the NFT returns to its earlier owner.

Gallery contracts are independently deployed. The artist site filters exhibition references to the configured artwork and mandate contracts. The configured gallery parent, registry linkage and namespace hash are checked independently. A gallery statement is not proof that the painting exists or was delivered.

## Deployment and interoperability

Each participant signs their own deployments. A factory is deferred to keep deployment and ownership explicit in the MVP. Setup records partial progress in versioned browser storage; no old storefront address is automatically migrated.

Shared URLs carry public contract addresses and gallery parent names. Both Workers run the same interface, with artist/gallery defaults. Either website can reconstruct genesis, mandates, exhibitions, listings and settlement receipts from public contract getters using its own RPC endpoint.

## MVP evidence

Contract tests cover issuance, resolver immutability, gallery scope, independent registries, primary sale, resale royalties, commission, withdrawal, revocation, expiry, ownership round trips, parent unlink and former-owner rejection.

Browser tests exercise the actual deployment/issuance/delegation/exhibition/purchase UI with separate wallet contexts and independent website origins. These tests use an isolated EVM. Public-chain acceptance still requires funded human wallets and real ENS/IPFS setup.

## Future work

Physical handoff, verified custody, legal execution, ROFR, cross-market royalty enforcement, museum workflows and conservator dashboards are explicitly outside this build.

## Sources

- https://docs.ens.domains/ensv2/permissioned-registry/
- https://docs.ens.domains/ensv2/enhanced-access-control/
- https://docs.ens.domains/ensv2/erc1155-singleton/
- https://eips.ethereum.org/EIPS/eip-2981

## Next.js platform and exhibition-first flow

The platform now uses Next.js App Router static exports on the existing Worker. Artist and gallery setup are distinct pages; artwork and exhibition links carry public references. The ENS beta indexer at https://staging-graphql.ens.dev/ supplies owned and role-associated candidate names (the same endpoint used by https://app.ens.dev/). Candidate access is checked using the configured ETHRegistry's current resource, ROLE_SET_SUBREGISTRY and expiry before setup. See [ENS enumeration guidance](https://docs.ens.domains/ensv2/tutorial-app-developers/) and [indexing events](https://docs.ens.domains/ensv2/indexing/).

GalleryRegistry.createExhibition creates the immutable exhibition identity before submissions. submit binds an exhibition to a current-owner mandate and its matching settlement. The gallery separately accepts the mandate then decides the submission. acceptedSubmissions provides the accepted set without a centralized application database. Multiple artists can submit through their own mandate and settlement contracts.

SimpleSettlement adds direct owner listings with expiry, cancellation, current token/version and ownership epoch validation. Direct and gallery settlements share royalty accounting. The website remains a reference interface, while contracts are the live system of record. Demo pages import a separate local component with sessionStorage and no wallet or chain access.

## Standard artwork policy

New ArtworkRegistry deployments use a fixed 180-day hold after every ownership transfer and a 5% original-artist royalty on supported resales. The first transfer is immediately permitted. Single, batch and operator transfers enforce the hold, while exhibition mandates retain token ownership. Terms are constants, not user configuration. SimpleSettlement identifies primary sales using the registry ownership epoch, so deploying a second settlement cannot reset primary-sale eligibility.
