# ENS artwork template — Eon Moon

**Your art. Your name. Your storefront.**

An independent artist storefront on Ethereum Sepolia. Each artwork is an ENS v2 subname with immutable IPFS content and artist-selected resale royalties. Burner cards are optional and not required by any core flow.

## Run

Node 24+, npm, and a Tailscale-connected Linux host:

```sh
npm ci
npm run build
npm run dev
```

The launcher binds only the host's Tailscale IPv4, allocates a free port starting at 4325, and records `DEV_URL` in `.env.local`. It serves the built app through Wrangler; run `npm run build` after frontend changes. Both local and deployed instances connect to public Ethereum Sepolia (11155111). No local blockchain is started. `npm test` uses an isolated in-process EVM solely for tests.

## Configure your artist instance

Edit `artist.config.json`: artist name, parent `.eth` name, RPC URL, IPFS gateway, and deployment addresses. `npm run configure` copies the configured Worker name into `wrangler.jsonc`. Do not put wallet keys or secrets in either file. The RPC URL in this example is public.

1. Open **Setup** and connect a wallet funded with Sepolia test ETH.
2. Register/control your parent on [ENS v2 Sepolia](https://app.ens.dev). Mainnet ownership does not establish testnet ownership.
3. Deploy the artist registry/resolver, then the sale contract from your wallet.
4. Link the parent name to your registry. The app refuses to replace a different existing subregistry.
5. Export `artist.config.json`, replace the project config, rebuild and deploy so all visitors see the same instance. A share link carries registry/sale addresses for temporary previews. Partial deployment addresses are retained in browser storage for recovery.
6. Pin artwork and metadata to IPFS independently. Metadata is JSON with `name`, `description`, and `image: ipfs://<CID>`. In **Studio**, enter the artwork CID, metadata URI, royalty wallet, and basis points (750 = 7.5%). Publishing permanently fixes these records.
7. Open a work, approve and list it, then buy with another wallet. Relist from the collector wallet to exercise a resale. Withdraw artist/seller proceeds in Studio.

The initial gallery images are original illustrative SVGs. They are explicitly unpublished previews, not minted artworks or IPFS availability evidence. No IPFS pinning service is configured by default.

## Standalone EVM example

**EVM lab** reads the live Sepolia chain/block. Deploy `EvmExample` from your wallet, save a public message, and read it back. It does not require an ENS parent. Every write links to its transaction on Sepolia Etherscan. No public-chain signer or contract is preconfigured.

## Contracts and trust

- `ArtRegistry`: ENS v2 PermissionedRegistry-derived singleton tokens; only artist publication; no root administrator, proxy upgrades, resolver editing, unregistering, or re-registration path.
- `ArtResolver`: one-time contenthash and metadata records, standard profile interfaces and DNS-encoded extended resolution.
- `ArtSale`: seven-day listings by default, token escrow, cancellation, exact ETH payment, atomic delivery and pull-payment accounting. Primary artist sale goes fully to the artist; subsequent storefront sales pay the immutable royalty recipient.
- Token IDs may change on role changes. Record identity uses canonical label IDs, and listing escrow rejects stale tokens/nonces.
- Parent registration and linkage are still controlled outside these contracts. The parent owner can redirect the namespace. Keep the parent registered and linked.
- Free transfers and outside marketplaces do not guarantee royalties. Token ownership is not copyright transfer or proof of physical fulfillment.

ENS upstream source is vendored at commit `48b3e2d39513b9dd32ef1850877a29009bc807b9`; see `vendor/ens-v2/PROVENANCE.md`. Sepolia addresses come from the official ENS docs snapshot on 2026-09-25, which differs from the repository's development deployment manifest. Both canonical configured addresses were checked for live bytecode.

## Verify and deploy

```sh
npm run contracts:compile
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:wallet
npm exec -- wrangler deploy --dry-run
npm run deploy
```

Browser checks use Chromium (`CHROMIUM_PATH` override supported) and `DEV_URL`; set `BASE_URL` to test the deployed Worker. Tests and screenshots are recorded separately from live-chain acceptance. Contracts are testnet examples, not independently audited production software.

See [requirements](requirements.md), [agent setup](agent-setup.md), [personas](docs/personas.md), and [acceptance record](docs/acceptance.md).
