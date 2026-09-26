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
export const eonmunAssets = Object.fromEntries(
  originals.map((w) => [w.id, { image: w.imageURI, manifest: w.manifestURI }]),
);
