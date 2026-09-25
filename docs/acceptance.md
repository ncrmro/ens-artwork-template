# Acceptance record — 2026-09-25

The primary checkout is /home/ncrmro/repos/ncrmro/ens-artwork-template on main. No worktrees are used.

## Application

- Shared artist/gallery platform: https://eonmun-beta.ncrmro.workers.dev/#setup
- Independent gallery interface: https://eonmun-gallery-demo.ncrmro.workers.dev
- Local: http://ncrmro-workstation.mercury:4325, service eonmun-beta-local.service.
- Both local and deployed interfaces use Ethereum Sepolia, chain ID 11155111.
- Guided wallet setup deploys participant and artwork/exhibition registries, attaches their subdomains, and links the registered parent ENS name. Artists additionally deploy mandates and settlement. Confirmed deployments are saved for resumption and export.
- Artists submit artwork with scoped gallery mandates; galleries accept, publish attributed exhibitions and list. Collectors purchase; proceeds are withdrawn by recipients.

## Verification

Solidity compilation, TypeScript, five contract scenarios and browser smoke checks cover the lifecycle. The wallet integration uses three independent wallets and two browser origins on an isolated EVM. It tests a rejected deployment followed by reload/resume without redeploying the confirmed namespace, both guided setup flows, issuance, artist submission, gallery acceptance, exhibition publication, listing, purchase, shared ownership readback and commission withdrawal. Contract tests additionally exercise authorization, revoked/expired/stale mandates, immutable genesis and resale arithmetic.

These are simulated transaction tests, not live Sepolia receipts. Public sites start with labeled previews until participants deploy and share their real contracts. EON MUN is the example artist; eonmun.eth was registered on ENS v2 Sepolia. Parent ownership is checked live before setup.

## Remaining acceptance

Participants must sign real Sepolia deployment, issuance, submission, acceptance, exhibition and settlement transactions using funded wallets. No signing keys are held by the application or this development session. Pin actual artwork and manifest files to IPFS before publishing. Capture public-chain receipts before claiming a completed public-chain demo.

The MVP loads at most 100 records per collection and displays one artist collection at a time. Exhibition records reference one artwork; multi-artist exhibition curation and a global submissions inbox remain future work. Physical custody, delivery and legal enforcement are not verified by these records. The Tailscale HTTP origin may restrict wallet injection; the deployed app uses HTTPS. The local user service is transient and must be started again after reboot.

## Deployed release evidence

Cloudflare deployment versions: artist/shared platform `95d9157e-4346-42c0-9229-b67569e171bd`; gallery interface `abc9d003-b2e3-4dea-8ef6-9ce3597e04b1`. Both use the same built interface (`index-CYeF527p.js`) and Sepolia configuration. Live desktop/mobile checks verify preview labeling, wallet-missing handling, all views and Sepolia block readback.
