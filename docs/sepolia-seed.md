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
