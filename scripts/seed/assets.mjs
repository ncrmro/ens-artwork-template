import fs from "node:fs";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { bytesToHex } from "viem";
export const contenthash = (uri) =>
  bytesToHex(new Uint8Array([0xe3, 1, ...CID.parse(uri.slice(7)).bytes]));
export async function createAssets(catalogue, directory = "public/ipfs") {
  fs.mkdirSync(directory, { recursive: true });
  const assets = { works: {}, shows: {} };
  async function put(bytes) {
    const cid = CID.createV1(0x55, await sha256.digest(bytes)).toString();
    fs.writeFileSync(directory + "/" + cid, bytes);
    return "ipfs://" + cid;
  }
  const image = await put(fs.readFileSync("public/blue-mountain.svg"));
  for (const w of catalogue.works) {
    const manifest = await put(
      Buffer.from(
        JSON.stringify({
          name: w.title,
          artist: w.artist,
          medium: w.medium,
          dimensions: w.dimensions,
          createdAt: w.createdAt,
          image,
          description:
            "Testnet demonstration of physical artwork. Image is an illustrative fixture.",
          canonicalTerms: "standard-artwork-v1",
        }),
      ),
    );
    assets.works[w.id] = { image, manifest };
  }
  for (const s of catalogue.shows) {
    const manifest = await put(
      Buffer.from(
        JSON.stringify({
          name: s.title,
          gallery: s.gallery,
          description: s.description,
          works: s.works,
          occurredAt: s.occurredAt,
          displayDates: s.dates,
          notice:
            "Historical dates are gallery-reported. Recording and submissions have current blockchain timestamps.",
        }),
      ),
    );
    assets.shows[s.id] = { manifest };
  }
  return assets;
}
