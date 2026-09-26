# Shared catalogue → real testnet records

`src/demo-catalogue.json` is the source for both the staged UI and the seed: two artists, two galleries, five works and three exhibitions. Creation dates, gallery establishment dates, exhibition dates and historical reports come from this same file. The historical stories are demonstration data; importing them records attributed statements, not verified historical payments or custody.

The contracts accept past/present dates and reject future dates. They preserve actual recording timestamps. Reported historical purchases cannot change token ownership, pay royalties retroactively or bypass the 180-day transfer hold. Primary NFTs are issued to the original artists. Past exhibitions use exhibition-only mandates; the current exhibition also gets listing/sale permission. Owner-retained works get direct listings.

## Sepolia

1. Compile contracts with `npm run contracts:compile` and generate the bundled fixture content with `npm run seed:assets`.
2. Copy `scripts/seed/sepolia-plan.json` to a local plan and set the registered ENSv2 parent names and public wallet addresses. Example names other than eonmun.eth are placeholders, not a claim of ownership. Each artist/gallery pair must use independent wallets. Wallets need Sepolia ETH and current ENS subregistry permission. Existing linked registries are never replaced; use fresh names if an older contract is already linked.
3. Run `npm run seed:check -- --plan .local/my-sepolia-plan.json`. This is read-only. `SEED_RPC_URL` optionally overrides the configured public read RPC.
4. Expose the configured accounts through an external wallet signer JSON-RPC endpoint supporting `eth_accounts` and `eth_sendTransaction` on Sepolia, then set `SEED_SIGNER_RPC_URL` in your shell. The script accepts no private keys and the website never receives this endpoint. Do not use Anvil's public test keys on Sepolia.
5. Run `npm run seed:sepolia -- --plan .local/my-sepolia-plan.json`. The signer may prompt for transactions. The script deploys and links namespaces, mints dated works, creates dated galleries/exhibitions, submits and accepts works, creates listings and records attributed history.
6. Keep the journal. A second run with the identical plan resumes receipts and emits no duplicate writes. Changed contracts, names, chain or catalogue require a new deployment plan/journal. A reverted transaction stops the run for investigation.
7. Successful receipt and registry readbacks produce `src/browse-index.json`. Review and commit this public index, then rebuild/deploy both websites. Browse reads those ENS namespaces automatically; record contents still come from the chain. Missing/unreadable names do not hide successful names.

The index is discovery metadata, not proof a namespace is deployed. Before seeding it contains candidate names; the UI reports unavailable names. Only a successful seed writes verified addresses and sale references.

Fixture manifests are raw CIDv1 content-addressed files under `public/ipfs/`. The app serves matching bundled bytes for these known CIDs, while other IPFS URIs use the configured gateway. This is not a promise of public IPFS pinning. Run `npm run seed:assets` after changing the catalogue; upload/pin these files separately if public IPFS distribution is needed.

## Local verification and a persistent preview

`npm run seed:verify` registers four independent temporary names on the running official ENSv2 devnet, runs the identical seed, verifies historical records, and reruns it to prove idempotence. It restores a snapshot afterward. Its 31337 receipts are not Sepolia evidence.

`node scripts/seed/verify-local.mjs --keep` keeps the new `catalogue-*.eth` namespaces and adds their index to `.local/demo.json` so local Browse shows the full catalogue. It leaves the original EON MUN/Atelier workflow contracts intact. Restarting the local chain removes these ephemeral records; rerun the persistent seed with a fresh `.local/catalogue` journal after a chain reset.

## Launch from the website

Open `/admin/` on either live site and connect the wallet that owns **ncrmro.eth on Sepolia**. The Admin navigation item appears only for that connected name owner on the configured network. Identity is checked against the ENSv2 registry's current name owner and expiry, not a supplied reverse name or mainnet record.

The page refreshes owned/delegated ENS candidates from the official indexer and directly rechecks known names, including `mfah.eth`, to handle indexer lag. **Refresh and include available names** creates a plan for all available participant names; `ncrmro.eth` is reserved for the admin/index. Known gallery profiles include Louvre, MFAH and Uffizi; Van Gogh and da Vinci have source-attributed public-domain study editions. Other names receive a generic demo edition. These are fictional testnet editions and exhibitions, not claims of museum affiliation or ownership of original paintings.

Populated, foreign-owned or incompatible registries are skipped and reported. A legacy participant registry owned by the admin can be relinked only when both its artwork and exhibition collections are empty. The seed rechecks this immediately before the transaction and records the old registry address in the checkpoint. Old contracts are not modified or destroyed.

Click **Check plan**, then **Launch Sepolia seed**. Each deployment and write requires a separate wallet confirmation; the total scales with participants and exhibition submissions. No keys are created or collected. Separate `DemoAccount` contracts provide artist/gallery addresses, all controlled by the administrator. Contract access control restricts account execution and index publication. Successful steps are journaled by stable participant/artwork/event IDs. Adding names keeps old deployments, adds missing records, and publishes a new index. Rerunning an unchanged plan sends no new transactions. Existing seeded records cannot be silently redefined.

A protected `DemoNamespace` is attached beneath the previously unused `ncrmro.eth` subregistry. After receipt and record verification, the complete index is stored in its `catalogue()` record. Both sites read that record automatically, resolve the selected ENS namespaces, verify sale references and read the actual artwork/exhibition contracts. No Git commit or site redeployment is needed after seeding.

Keep the browser open while confirming transactions. Rejection or interruption stops further sends; **Resume seed** uses saved hashes and receipts. Download the checkpoint before moving browsers. Restore a backup only into a browser without an existing checkpoint. Checkpoints contain public addresses and transaction hashes, never keys. Do not clear browser storage mid-run without a backup. Changing wallet or network stops new transactions; a transaction already signed may still mine. Restoring a checkpoint does not bypass current-name ownership checks. Participant controllers remain the original admin address even if ENS name ownership later changes.

The local development site uses a separate blockchain and cannot display Sepolia registrations. Use the live `/admin/` page for the real Sepolia run. `npm run seed:verify:admin` and `npm run test:admin` exercise the same engine on the official local ENSv2 devnet, including an interrupted run and unauthorized calls, restoring a chain snapshot afterward. They do not establish Sepolia receipt evidence.

## Public-domain images and IPFS

The named demo catalogue and staged pages share images and provenance from `src/artwork-sources.json`:

- [Mona Lisa, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_natural_color.jpg): public-domain painting reproduction, resized source image.
- [Self-Portrait with a Straw Hat, The Met](https://www.metmuseum.org/art/collection/search/436532): CC0/Open Access.
- [Wheat Field with Cypresses, The Met](https://www.metmuseum.org/art/collection/search/436535): CC0/Open Access.

Source artist/date/license/URL are retained in fixture metadata. The demo edition's creation date is 2026; it does not pretend that today's NFT was minted in 1503 or 1887. Real image bytes and manifests are stored as raw SHA-256 CIDv1 files; `npm run seed:assets:named` regenerates them. The website serves the exact bundled bytes for these CIDs, so previews work before public pinning.

For actual IPFS availability, run `IPFS_API_URL=http://127.0.0.1:5001 npm run seed:pin` against your own Kubo node. The script verifies every CID before import, checks the returned CID and pins every block. Keep the node online or replicate its pins to a pinning service. No public pinning service is configured in this repository; a content hash alone is not evidence of network availability.

## Published IPFS assets

The catalogue's 26 referenced content blocks, including all five imported EON MUN images and their metadata, were uploaded to the Filebase IPFS bucket `ncrmro-eonmun-artwork-ipfs` on 2026-09-26. CAR imports preserve the raw CIDs already used by the contracts. Filebase reported every block as pinned. No contract changes or remints are needed.

Repeat publishing with `scripts/seed/pin-filebase.mjs`. Configure AWS credentials outside the repository, set `FILEBASE_BUCKET`, and set `IPFS_BIN` and `IPFS_PATH` to an initialized Kubo repository. The script verifies input hashes, skips existing uploads, checks returned CIDs, and writes `output/filebase-pins.json`. Use Filebase's IPFS S3 endpoint `https://s3.filebase.com`, rather than its general object-storage endpoint.

The public gateway is `https://ipfs.filebase.io/ipfs/<CID>`. Cloudflare's bundled copies remain a fallback. Pin persistence depends on maintaining the Filebase account and its pins.

## Wallet batching

The admin page enables “Batch confirmations” by default. It checks the connected wallet's Sepolia `atomic` capability via EIP-5792 before sending writes. Unsupported wallets stop with an explanation; explicitly disable batching to use individual transactions.

Exhibitions, loan creation, acceptance/submission, approval/listing, and direct listings/history execute in dependency phases, with at most eight operations per batch. Setup and minting retain their individual transaction flow. Each call is simulated before requesting an atomic wallet batch. The checkpoint saves the wallet batch ID before waiting, then maps its successful receipt to every operation key. Refreshing resumes pending batch status rather than resubmitting calls; failed batches stop without automatic retry. Existing single-transaction checkpoints remain compatible.

`npm run seed:verify:batch` validates real atomic EVM execution on the isolated local chain using a test wallet execution harness, including interrupted status polling, multiple events per receipt, incremental catalogue growth, and duplicate-free resume. This is not a claim of end-to-end MetaMask acceptance; the live wallet performs its own capability and confirmation flow.
