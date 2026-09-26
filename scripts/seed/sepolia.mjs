import fs from "node:fs";
import { seedCatalogue } from "./run.mjs";
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : args[i + 1];
};
try {
  const plan = JSON.parse(
    fs.readFileSync(arg("--plan", "scripts/seed/sepolia-plan.json")),
  );
  const config = JSON.parse(
    fs.readFileSync(arg("--config", "artist.config.json")),
  );
  const catalogue = JSON.parse(fs.readFileSync("src/demo-catalogue.json"));
  const contracts = JSON.parse(fs.readFileSync("src/generated/contracts.json"));
  const result = await seedCatalogue({
    plan,
    config,
    catalogue,
    contracts,
    rpcUrl: process.env.SEED_RPC_URL || config.rpcUrl,
    signerUrl: process.env.SEED_SIGNER_RPC_URL,
    apply: args.includes("--apply"),
    allowLocal: args.includes("--local"),
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.issues?.length) process.exitCode = 1;
} catch (e) {
  console.error(e.shortMessage || e.message);
  process.exitCode = 1;
}
