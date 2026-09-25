import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";
const self = JSON.parse(
  execFileSync("tailscale", ["status", "--json"], { encoding: "utf8" }),
);
const host = self.Self.DNSName.replace(/\.$/, "");
const ip = self.TailscaleIPs.find((x) => !x.includes(":"));
if (!host || !ip) throw Error("Tailscale hostname and IPv4 required");
const saved = fs.existsSync(".env.local")
  ? fs.readFileSync(".env.local", "utf8")
  : "";
const preferred =
  fs.readFileSync(".env", "utf8").match(/^DEV_PORT=(\d+)$/m)?.[1] || "4325";
let port = Number(saved.match(/^DEV_PORT=(\d+)$/m)?.[1] || preferred);
const busy = (p) =>
  execFileSync("ss", ["-lntH", `sport = :${p}`], { encoding: "utf8" }).trim();
if (busy(port)) {
  const listeners = execFileSync("ss", ["-lptnH", `sport = :${port}`], {
    encoding: "utf8",
  });
  const pids = [...listeners.matchAll(/pid=(\d+)/g)].map((x) => x[1]);
  if (
    pids.some((pid) => {
      try {
        return fs.realpathSync("/proc/" + pid + "/cwd") === process.cwd();
      } catch {
        return false;
      }
    })
  ) {
    console.log("Already running: http://" + host + ":" + port);
    process.exit(0);
  }
  while (busy(port)) port++;
}
const record = `DEV_PORT=${port}\nDEV_HOST=${host}\nDEV_URL=http://${host}:${port}\n`;
fs.writeFileSync(".env.local.tmp", record);
fs.renameSync(".env.local.tmp", ".env.local");
console.log(record);
const child = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--ip",
    ip,
    "--port",
    String(port),
    "--inspector-port",
    "0",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS:
        process.env.NODE_EXTRA_CA_CERTS || "/etc/ssl/certs/ca-certificates.crt",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
