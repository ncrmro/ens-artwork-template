import fs from "node:fs";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
fs.mkdirSync("public/ipfs", { recursive: true });
async function fixture(bytes) {
  const cid = CID.createV1(0x55, await sha256.digest(bytes)).toString();
  fs.writeFileSync("public/ipfs/" + cid, bytes);
  return "ipfs://" + cid;
}
const image = await fixture(fs.readFileSync("public/blue-mountain.svg"));
const works = [];
for (const [label, title] of [
  ["blue-mountain", "Blue Mountain"],
  ["quiet-tide", "Quiet Tide"],
  ["after-the-rain", "After the Rain"],
]) {
  const manifest = await fixture(
    Buffer.from(
      JSON.stringify({
        name: title,
        description: "Local demo physical artwork; illustrative image.",
        image,
        artist: "EON MUN",
        medium: "Oil on canvas",
        dimensions: "60 × 80 cm",
      }),
    ),
  );
  works.push({ label, title, manifest });
}
const manifest = works[0].manifest;
const exhibition = await fixture(
  Buffer.from(
    JSON.stringify({
      name: "Between Earth & Ether",
      gallery: "Atelier Gallery",
      description: "Local demo exhibition of physical artwork.",
    }),
  ),
);
fs.writeFileSync(
  "src/demo-defaults.json",
  JSON.stringify({ image, manifest, exhibition, works }, null, 2) + "\n",
);
