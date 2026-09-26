import { eonmunAssets } from "./eonmun-import.js";
import bundled from "./named-assets.json";
export function assetsForCatalogue(catalogue: any) {
  const works: Record<string, { image: string; manifest: string }> = {};
  const shows: Record<string, { manifest: string }> = {};
  for (const w of catalogue.works) {
    const existing = (bundled.works as any)[w.id];
    const reference = Object.values(bundled.works).find(
      (a) => a.image === (bundled.images as any)[w.sourceImage],
    );
    works[w.id] = (eonmunAssets as any)[w.id] || existing || reference!;
  }
  for (const s of catalogue.shows)
    shows[s.id] =
      (bundled.shows as any)[s.id] || Object.values(bundled.shows)[0];
  return { works, shows };
}
