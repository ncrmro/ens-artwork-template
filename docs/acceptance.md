# Acceptance record — 2026-09-25

## Running application

- Public Worker: https://eonmoon-beta.ncrmro.workers.dev
- Local Tailscale URL: http://ncrmro-workstation.mercury:4325
- Local user service: `eonmoon-beta-local.service` (active).
- Local checkout: `/home/ncrmro/repos/ncrmro/ens-artwork-template`, branch `main`.
- Both instances: Ethereum Sepolia, chain ID 11155111; actual RPC response `0xaa36a7` verified independently through each Worker.
- Application routes: Gallery, Studio, Setup, EVM lab. Wallet-driven registry/resolver/sale deployment, ENS parent linkage, publication, listing, purchase, resale, proceeds withdrawal, and standalone message-contract deployment/write/read are implemented.

## Verification performed

- Solidity compilation: passed; registry runtime below the EIP-170 size limit.
- TypeScript: passed.
- Three transaction test scenarios: primary/resale payment arithmetic and withdrawal; authorization, duplicate prevention, immutable records, cancellation, stale nonce, expired parent; mutable token identity, 0/100% royalty boundaries, and independent EVM example.
- Browser wallet integration: deploy registry and resolver; deploy sale; link mock ENS parent; publish; list; buy; relist; buy with another wallet; verify 1.075 test ETH artist balance and 0.925 seller balance after two 1 ETH sales; withdraw; deploy/write/read EVM message contract.
- That wallet integration uses an isolated in-process EVM and explicitly injected test wallets. It is not a live Sepolia transaction record.
- Local and public browser checks: desktop and mobile layouts, no horizontal overflow, no page exceptions, live Sepolia block, graceful missing-wallet message, and disabled publication until deployment configuration exists. Screenshots saved in ignored `output/`; deployed desktop screenshot visually inspected.
- API: both instances report Sepolia and reject `eth_sendRawTransaction` through the read-only proxy.
- Dependency audit: zero reported vulnerabilities after pinning the patched `tmp` build dependency.
- Local outbound TLS uses the system CA bundle; verification remains enabled.

## Still required for a public-chain artwork demo

No wallet/signer was supplied in this session. No public-chain registry, sale, or EVM example contract has been deployed by this session. The canonical ENS v2 Sepolia registry reported `eonmoon.eth` unowned when checked. Its control must be established by the artist.

The site therefore starts with clearly labeled unpublished artwork previews and functional wallet setup. Complete Setup using a funded Sepolia wallet, pin actual artwork/metadata to IPFS, publish and buy/resell, then capture real public-chain receipts and withdrawal balances. An independent second-artist deployment and real Burner hardware remain unverified. No claim of a completed M1 artwork acceptance or mainnet readiness is made.

## Operator commands

```sh
systemctl --user status eonmoon-beta-local
systemctl --user restart eonmoon-beta-local
systemctl --user stop eonmoon-beta-local
```

The user service is transient and survives this terminal session, not a machine reboot. Run `npm run dev` after reboot, or establish a persistent service in the host configuration separately.

## Remaining limitations

The gallery currently reads up to the first 100 published works per instance. IPFS pinning and public-chain signing remain artist-operated. The local HTTP Tailscale URL is not a trusted HTTPS origin; wallet extension behavior on it depends on the browser. Use the deployed HTTPS app if a wallet restricts injection locally.
