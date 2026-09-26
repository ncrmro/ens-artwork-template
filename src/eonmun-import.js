import ipfsAssets from "./eonmun-ipfs-assets.json" with { type: "json" };
import { keccak256, stringToHex } from "viem";
import originals from "./eonmun-import.json" with { type: "json" };
// Append only: existing checkpoint records, metadata pins and transaction keys stay intact.
export function withEonmunArtworks(catalogue) {
  const artist = catalogue.participants.find((p) => p.parent === "eonmun.eth");
  if (!artist) return catalogue;
  const additions = originals.filter(
    (w) => !catalogue.works.some((existing) => existing.id === w.id),
  );
  return {
    ...catalogue,
    works: [
      ...catalogue.works,
      ...additions.map((w) => ({
        ...w,
        artist: artist.name,
        owner: artist.name,
      })),
    ],
  };
}
export const legacyEonmunAssets = Object.fromEntries(
  originals.map((w) => [w.id, { image: w.imageURI, manifest: w.manifestURI }]),
);

export const eonmunAssets = ipfsAssets;
// Only repair the known invalid media pin before a mint has been submitted.
export function repairEonmunMediaPins(journal) {
  if (!journal) return journal;
  const digest = value => keccak256(stringToHex(JSON.stringify(value)));
  for (const [id, legacy] of Object.entries(legacyEonmunAssets)) {
    const key = "media:" + id;
    if (!journal.transactions?.["mint." + id]?.hash && journal.pins?.[key] === digest(legacy)) {
      journal.pins[key] = digest(eonmunAssets[id]);
    }
  }
  return journal;
}
