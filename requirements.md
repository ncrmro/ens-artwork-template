# Requirements — ENS artwork lifecycle template

The terms MUST, MUST NOT, SHOULD, and MAY are interpreted as defined in RFC 2119.

1. The template MUST let independent artists and galleries deploy and configure their own ENS v2 registries on Ethereum Sepolia. EON MUN at eonmun.eth MUST be presented as the example artist, not the project name.
2. An artist MUST be able to issue a physical artwork as an ERC-1155 singleton at artwork.art.artist.eth. Its artist, title, year, medium, dimensions, image URI, manifest contenthash and royalty terms MUST remain immutable after issuance.
3. A gallery MUST control a separate exhibitions.gallery.eth registry whose attributed exhibition records reference the artist's artwork registry and token.
4. The current artwork owner MUST be able to grant and revoke scoped gallery mandates with expiry, minimum sale price and commission. Gallery acceptance MUST be recorded. Mandates MUST use application EAC separately from ENS name permissions.
5. A gallery mandate MUST NOT confer token ownership, arbitrary transfer power, or genesis editing. Revoked, expired, consumed or stale mandates MUST NOT authorize new actions.
6. A paid settlement MUST atomically transfer the token from its current owner to the collector and credit seller proceeds, gallery commission and applicable artist resale royalty. The owner MUST retain the token before settlement. Recipients MUST be able to withdraw.
7. A change of token ownership MUST invalidate prior mandates, including after a transfer back to the former owner. Owner-derived presentation edits MUST require the current owner.
8. Independent artist, gallery and collector interfaces MUST resolve the same contracts and records without a central application database. The interface MUST distinguish attributable claims from independently verified physical custody.
9. The UI MUST label previews and unconfigured deployments, use ordinary wallets with Burner optional, and MUST NOT collect wallet keys.
10. The UI MUST mark universal royalty enforcement, holding periods, right of first refusal, verified custody/logistics, legal execution, museum and conservator workflows as future work. It MUST distinguish simulated test evidence from live Sepolia acceptance.
