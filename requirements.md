# Requirements — Eon Moon ENS v2

The terms MUST, MUST NOT, SHOULD, and MAY are interpreted as defined in RFC 2119. These requirements describe the initial Sepolia release.

1. The template MUST let each artist use their own ENS parent name, contracts, payout wallet, and Cloudflare Worker through configuration without source-code edits.
2. The initial instance MUST target Ethereum Sepolia, use `eonmoon.eth`, and run on a separate Worker named `eonmoon-beta`.
3. Each artwork MUST have a unique ENS v2 subname whose custom resolver returns its IPFS contenthash through the Universal Resolver.
4. Collectors MUST be able to purchase and resell the artwork's ENS subname token using ordinary wallets. Publication, purchase, and resale MUST work with Burner disabled; Burner integration MAY be added separately.
5. The artist MUST set a royalty recipient and percentage before listing. Artwork content and royalty terms MUST remain unchanged after listing and across ownership transfers.
6. Each storefront resale MUST atomically transfer the token and credit the configured artist share and remaining seller proceeds. Recipients MUST be able to withdraw those proceeds.
7. Sales MUST reject unauthorized, expired, cancelled, replayed, or stale listings. Token-ID changes MUST NOT lose artwork identity or royalty terms.
8. The application MUST NOT collect wallet private keys or Burner PINs. It MUST disclose retained administrative powers and dependence on the parent ENS name.
9. Product copy MUST identify the Sepolia testnet and MUST NOT promise royalty enforcement outside the storefront, physical fulfillment, or unverified Burner compatibility.
10. Acceptance MUST demonstrate IPFS resolution, purchase, resale, correct withdrawals, and unchanged artwork content with Burner disabled, plus an independent second-artist setup. Transaction and browser evidence MUST support the marketing demo.
