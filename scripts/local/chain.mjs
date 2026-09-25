import fs from "node:fs";
import { spawn } from "node:child_process";
const target = ".local/ens-v2/contracts";
if (!fs.existsSync(target + "/generated/artifacts"))
  throw Error("Run npm run local:prepare first (requires Bun and Foundry).");
fs.copyFileSync("scripts/local/ens.ts", target + "/script/artworkDemo.ts");
const child = spawn("bun", ["./script/artworkDemo.ts"], {
  cwd: target,
  stdio: "inherit",
  env: {
    ...process.env,
    ARTWORK_PROJECT: process.cwd(),
    ANVIL_IP_ADDR: "127.0.0.1",
  },
});
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 1));
