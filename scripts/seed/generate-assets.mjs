import fs from "node:fs";
import { createAssets } from "./assets.mjs";
const assets = await createAssets(
  JSON.parse(fs.readFileSync("src/demo-catalogue.json")),
);
fs.writeFileSync(
  "src/seed-assets.json",
  JSON.stringify(assets, null, 2) + "\n",
);
