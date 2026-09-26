import assets from "./seed-assets.json";
const bundled = new Set(
  Object.values(assets.works)
    .flatMap((a) => [a.image, a.manifest])
    .concat(Object.values(assets.shows).map((a) => a.manifest)),
);
export function ipfsURL(uri: string, gateway = "https://ipfs.io/ipfs/") {
  return uri.startsWith("ipfs://")
    ? (bundled.has(uri) ? "/ipfs/" : gateway) + uri.slice(7)
    : uri;
}
