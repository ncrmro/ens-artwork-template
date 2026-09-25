import fs from "node:fs";
import {parse} from "jsonc-parser";
import { isAddress } from "viem";
import { normalize } from "viem/ens";
const config = JSON.parse(fs.readFileSync("artist.config.json", "utf8"));
if (config.chainId !== 11155111)
  throw Error("Only Ethereum Sepolia is supported");
if (
  !/^[a-z0-9]+(?:-[a-z0-9]+)*\.eth$/.test(config.parentName) ||
  normalize(config.parentName) !== config.parentName
)
  throw Error("Use a normalized lowercase .eth parent");
if (!/^[a-z0-9][a-z0-9-]{1,61}$/.test(config.workerName))
  throw Error("Invalid Worker name");
for (const key of ["registry", "sale", "example"])
  if (config[key] && !isAddress(config[key]))
    throw Error("Invalid " + key + " address");
for (const key of ["ETHRegistry", "LabelStore"])
  if (!isAddress(config.ens[key])) throw Error("Invalid ENS " + key);
for (const [key, value] of Object.entries(config.lifecycle || {})) {
  if (!value) continue;
  if (key === "galleryParentName") {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.eth$/.test(value)) throw Error("Invalid gallery ENS parent");
  } else if (!isAddress(value)) throw Error("Invalid lifecycle address: " + key);
}
for (const key of ["rpcUrl", "ipfsGateway", "gallerySiteUrl"])
  if (new URL(config[key]).protocol !== "https:")
    throw Error(key + " must use HTTPS");
const wrangler = parse(fs.readFileSync("wrangler.jsonc", "utf8"));
wrangler.name = config.workerName;
fs.writeFileSync("wrangler.jsonc", JSON.stringify(wrangler, null, 2) + "\n");
console.log(
  "Configured " +
    config.workerName +
    " for " +
    config.parentName +
    " on Ethereum Sepolia",
);
