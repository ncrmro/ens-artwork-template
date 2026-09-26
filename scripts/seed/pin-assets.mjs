import fs from "node:fs";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
const endpoint = process.env.IPFS_API_URL;
if (!endpoint)
  throw Error(
    "Set IPFS_API_URL to your own Kubo API endpoint (for example http://127.0.0.1:5001). No API credentials are stored by this script.",
  );
const uris = new Set();
function collect(x) {
  if (typeof x === "string" && x.startsWith("ipfs://")) uris.add(x);
  else if (x && typeof x === "object") Object.values(x).forEach(collect);
}
for (const file of ["src/seed-assets.json", "src/named-assets.json"])
  collect(JSON.parse(fs.readFileSync(file)));
for (const uri of uris) {
  const cid = uri.slice(7);
  const bytes = fs.readFileSync("public/ipfs/" + cid);
  const actual = CID.createV1(0x55, await sha256.digest(bytes)).toString();
  if (cid !== actual) throw Error("CID mismatch: " + cid);
  const form = new FormData();
  form.append("file", new Blob([bytes]), cid);
  const url = new URL("/api/v0/block/put", endpoint);
  url.search = new URLSearchParams({
    format: "raw",
    mhtype: "sha2-256",
    pin: "true",
  });
  const r = await fetch(url, { method: "POST", body: form });
  if (!r.ok) throw Error("IPFS block import failed: " + r.status);
  const result = await r.json();
  if (result.Key !== cid) throw Error("IPFS returned a different CID");
  console.log("Pinned " + cid);
}
