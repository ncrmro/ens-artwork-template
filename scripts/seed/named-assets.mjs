import fs from "node:fs";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { namedCatalogue, knownNames } from "../../src/named-catalogue.js";
const sources = JSON.parse(fs.readFileSync("src/artwork-sources.json"));
const catalogue = namedCatalogue(knownNames, sources);
const assets = { works: {}, shows: {}, images: {} };
async function put(bytes) {
  const cid = CID.createV1(0x55, await sha256.digest(bytes)).toString();
  fs.writeFileSync("public/ipfs/" + cid, bytes);
  return "ipfs://" + cid;
}
for (const s of sources)
  assets.images[s.id] = await put(fs.readFileSync(s.path));
for (const w of catalogue.works)
  assets.works[w.id] = {
    image: assets.images[w.sourceImage],
    manifest: await put(
      Buffer.from(
        JSON.stringify({
          name: w.title,
          medium: w.medium,
          image: assets.images[w.sourceImage],
          imageArtist: w.imageArtist,
          originalDate: w.originalDate,
          imageSource: w.imageSource,
          imageLicense: w.imageLicense,
          notice: w.description,
        }),
      ),
    ),
  };
for (const s of catalogue.shows)
  assets.shows[s.id] = {
    manifest: await put(
      Buffer.from(
        JSON.stringify({
          name: "Open Collection — testnet demonstration",
          notice:
            "Gallery identity and accepted artworks are read from the gallery contract; this is a fictional testnet exhibition.",
        }),
      ),
    ),
  };
fs.writeFileSync(
  "src/named-assets.json",
  JSON.stringify(assets, null, 2) + "\n",
);
console.log(
  "Generated public-domain image and metadata CIDs. Bundled content is not a public pin.",
);
