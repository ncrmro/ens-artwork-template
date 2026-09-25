import fs from "node:fs";
import { execFileSync } from "node:child_process";
const revision = "48b3e2d39513b9dd32ef1850877a29009bc807b9";
const upstream = ".local/ens-v2";
fs.mkdirSync(".local", { recursive: true });
const run = (cmd, args, cwd = process.cwd()) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
if (!fs.existsSync(upstream + "/.git"))
  run("git", [
    "clone",
    "--filter=blob:none",
    "https://github.com/ensdomains/contracts-v2.git",
    upstream,
  ]);
run("git", ["checkout", revision], upstream);
run("git", ["submodule", "update", "--init", "--recursive"], upstream);
run("bun", ["install", "--frozen-lockfile"], upstream);
run("bun", ["run", "compile"], upstream + "/contracts");
fs.copyFileSync(
  "scripts/local/ens.ts",
  upstream + "/contracts/script/artworkDemo.ts",
);
