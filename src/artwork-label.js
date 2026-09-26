// Keep legacy seed/checkpoint identifiers intact while removing presentation suffixes.
export function artworkLabel(value) {
  return value
    .replace(/\s+[—·]\s+demo editions?$/i, "")
    .replace(/\s+·\s+testnet demo$/i, "")
    .replace(/^Created demo edition$/i, "Created artwork");
}
