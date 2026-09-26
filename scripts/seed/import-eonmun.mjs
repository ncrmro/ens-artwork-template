import fs from "node:fs";
import { createPublicClient, http, parseAbi } from "viem";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
const address = "0xf5521d34bd29f942523a7c125ffe0e06b6d41836";
const pc = createPublicClient({
  transport: http("https://ethereum-rpc.publicnode.com"),
});
const works = [];
for (const tokenId of [0, 1, 2, 3, 4]) {
  const uri = await pc.readContract({
    address,
    abi: parseAbi(["function tokenURI(uint256) view returns(string)"]),
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  });
  const metadata = JSON.parse(uri.slice(uri.indexOf(",") + 1));
  const source = `https://opensea.io/item/ethereum/${address}/${tokenId}`;
  const image = metadata.image.replace("ar://", "https://arweave.net/");
  const bytes = Buffer.from(
    JSON.stringify({
      ...metadata,
      image,
      source,
      originalImage: metadata.image,
    }),
  );
  const cid = CID.createV1(0x55, await sha256.digest(bytes)).toString();
  fs.writeFileSync("public/ipfs/" + cid, bytes);
  works.push({
    id: "eonmun-original-" + tokenId,
    title: metadata.name,
    description: metadata.description,
    medium: metadata.attributes
      .filter((a) => a.trait_type === "medium")
      .map((a) => a.value)
      .join(", "),
    dimensions: "",
    price: "0.001",
    variant: tokenId,
    termsId: "standard-artwork-v1",
    createdAt:
      metadata.attributes.find((a) => a.trait_type === "year").value + "-01-01",
    imageURI: image,
    manifestURI: "ipfs://" + cid,
    source,
    attributes: metadata.attributes,
  });
}
fs.writeFileSync(
  "src/eonmun-import.json",
  JSON.stringify(works, null, 2) + "\n",
);
console.log(
  "Imported titles and image URLs:",
  works.map((w) => w.title),
);
