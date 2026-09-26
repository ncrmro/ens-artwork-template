# Requirements — ENS artwork lifecycle template

The terms MUST, MUST NOT, SHOULD, and MAY are interpreted as defined in RFC 2119.

1. The template MUST let independent artists and galleries deploy and configure their own ENS v2 registries on Ethereum Sepolia. EON MUN at eonmun.eth MUST be presented as the example artist, not the project name.
2. An artist MUST be able to issue a physical artwork as an ERC-1155 singleton at artwork.art.artist.eth. Its artist, title, year, medium, dimensions, image URI, manifest contenthash and royalty terms MUST remain immutable after issuance. New registries MUST use one non-configurable standard policy: 5% original-artist resale royalty and a 180-day transfer hold after each ownership change, with the initial artist sale exempt.
3. A gallery MUST control a separate exhibitions.gallery.eth registry whose attributed exhibition records reference the artist's artwork registry and token.
4. The current artwork owner MUST be able to grant and revoke scoped gallery mandates with expiry, minimum sale price and commission. Gallery acceptance MUST be recorded. Mandates MUST use application EAC separately from ENS name permissions.
5. A gallery mandate MUST NOT confer token ownership, arbitrary transfer power, or genesis editing. Revoked, expired, consumed or stale mandates MUST NOT authorize new actions.
6. A paid settlement MUST atomically transfer the token from its current owner to the collector and credit seller proceeds, gallery commission and applicable artist resale royalty. The owner MUST retain the token before settlement. Recipients MUST be able to withdraw.
7. A change of token ownership MUST invalidate prior mandates, including after a transfer back to the former owner. Owner-derived presentation edits MUST require the current owner.
8. Independent artist, gallery and collector interfaces MUST resolve the same contracts and records without a central application database. The interface MUST distinguish attributable claims from independently verified physical custody.
9. The UI MUST label previews and unconfigured deployments, use ordinary wallets with Burner optional, and MUST NOT collect wallet keys.
10. The UI MUST mark universal royalty enforcement, right of first refusal, verified custody/logistics, legal execution, museum and conservator workflows as future work. It MUST distinguish simulated test evidence from live Sepolia acceptance.
11. The platform MUST use Next.js with distinct artist, gallery, artwork and exhibition pages. Visitors MUST choose an artist or gallery flow before setup forms; live pages MUST NOT preselect an example ENS name.
12. Setup MUST list wallet-owned or delegated ENS v2 names, verify current subregistry permission before deployment, and restore previously authorized wallet accounts without prompting on refresh.
13. Galleries MUST be able to create exhibitions before submissions. Current artwork owners MUST be able to submit to a named exhibition, and only the gallery MUST be able to accept or decline submissions.
14. Collectors MUST be able to buy through an exhibition or an owner's direct listing. Direct listings MUST NOT charge a gallery commission, and stale, cancelled or expired listings MUST NOT settle.
15. Demo mode MUST label mocked records and purchases, MUST persist local edits across page navigation and refresh, and MUST NOT request wallet signatures or send blockchain transactions.

16. The local-chain demo MUST use the pinned official ENSv2 deployment on chain 31337, seed independent artist and gallery ENS names and a collector account, and support real issuance, submissions, acceptance and purchases. It MUST isolate configuration and disposable accounts from Sepolia and offer reproducible reset.
17. Demo creation forms MUST prefill valid sample IPFS image and manifest URIs. Local-chain fixtures MUST resolve without a public gateway; the interface MUST distinguish fixtures from uploaded or publicly pinned content.

18. The story demo MUST include multiple artists, galleries, exhibitions and successive collectors, with artwork-specific histories and a single canonical terms record per artwork. Listings MUST reference that record and distinguish artwork terms from gallery commission.
19. The homepage MUST explain participant outcomes in ordinary language. A dedicated docs page MUST explain contracts, ENS resolution, data provenance and the distinction between illustrated clauses and implemented enforcement.

20. Both settlement listing paths and all ERC-1155 ownership transfers MUST enforce the standard holding period. Exhibition loans MUST NOT transfer token ownership or bypass artwork terms.
21. Live workspaces MUST show permission-checked managed namespaces, retain per-name setup state, and use route-specific Suspense skeletons and contract-data loading states.

22. The current tenant MUST be restored from localStorage scoped by wallet, network and local demo instance. URL parameters MUST NOT select or overwrite the tenant. Shared artwork, exhibition and invitation links MAY identify records without changing the managed tenant.

23. The namespace selector MUST switch between accessible artist and gallery management workspaces. Public art, gallery and exhibition browsing MUST be separate, require no wallet, and MUST NOT change the managed tenant.
