// Copied into the pinned upstream script directory by local:prepare.
import { setupDevnet } from "./setup.js";
import { registerTestNames } from "./testNames.js";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const root = process.env.ARTWORK_PROJECT!;
if (!root) throw Error("ARTWORK_PROJECT is required");
fs.rmSync(root + "/.local/demo.json", { force: true });
const env = await setupDevnet({
  port: 8545,
  chainId: 31337,
  extraTime: 86401,
  quiet: false,
});
try {
  await registerTestNames(env, ["eonmun"], {
    account: env.namedAccounts.owner,
    durationInDays: 365,
  });
  await registerTestNames(env, ["atelier"], {
    account: env.namedAccounts.user,
    durationInDays: 365,
  });
  await env.sync({ warpSec: "local" });
  const { seed } = await import(
    pathToFileURL(root + "/scripts/local/seed.mjs").href
  );
  await seed(env, root);
  console.log("ARTWORK LOCAL DEMO READY");
} catch (error) {
  await env.shutdown();
  throw error;
}
for (const sig of ["SIGTERM", "SIGINT"])
  process.on(sig, async () => {
    await env.shutdown();
    process.exit(0);
  });
setInterval(() => {}, 60000);
