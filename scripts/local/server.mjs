// Local only. This server is never bundled into the Cloudflare Worker.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const host = process.env.LOCAL_BIND;
const port = Number(process.env.LOCAL_PORT);
if (!host || !port) throw Error("Start with npm run local:dev");
const config = () => JSON.parse(fs.readFileSync(".local/demo.json", "utf8"));
if (config().chainId !== 31337)
  throw Error("Only local chain 31337 is permitted");
const readonly = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_call",
  "eth_getCode",
  "eth_getBalance",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_getBlockByNumber",
  "eth_getTransactionCount",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
]);
async function rpc(payload) {
  const res = await fetch("http://127.0.0.1:8545", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  return await res.json();
}
const server = http.createServer(async (req, res) => {
  const json = (status, data) => {
    res.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  try {
    const url = new URL(req.url, "http://" + req.headers.host);
    if (
      ![host, process.env.LOCAL_HOSTNAME, "localhost", "127.0.0.1"].includes(
        url.hostname,
      )
    )
      return json(403, { error: "Host rejected" });
    const c = config();
    if (url.pathname === "/api/config")
      return json(200, { ...c, rpcUrl: url.origin + "/api/rpc" });
    if (url.pathname === "/api/health")
      return json(200, {
        chainId: 31337,
        network: "Local ENSv2",
        runId: c.localDemo.runId,
      });
    if (url.pathname === "/api/names") {
      const a = (url.searchParams.get("address") || "").toLowerCase();
      const names = Object.entries({
        "eonmun.eth": c.localDemo.accounts.artist,
        "atelier.eth": c.localDemo.accounts.gallery,
      })
        .filter(([, owner]) => owner.toLowerCase() === a)
        .map(([name]) => name);
      return json(200, { names, nextSkip: null, nextAfter: null });
    }
    if (["/api/rpc", "/api/local-wallet"].includes(url.pathname)) {
      if (req.method !== "POST") return json(405, { error: "POST required" });
      if (req.headers.origin && req.headers.origin !== url.origin)
        return json(403, { error: "Origin rejected" });
      if (req.headers["sec-fetch-site"] === "cross-site")
        return json(403, { error: "Cross-site request rejected" });
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return json(415, { error: "JSON required" });
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 32768)
          return json(413, { error: "Request too large" });
      }
      const payload = JSON.parse(body),
        calls = Array.isArray(payload) ? payload : [payload];
      if (!calls.length || calls.length > 10)
        return json(400, { error: "Invalid batch" });
      const sending = url.pathname === "/api/local-wallet";
      for (const call of calls) {
        if (
          !readonly.has(call.method) &&
          !(sending && call.method === "eth_sendTransaction")
        )
          return json(400, { error: "Method unavailable" });
        if (
          call.method === "eth_sendTransaction" &&
          !Object.values(c.localDemo.accounts).some(
            (a) => a.toLowerCase() === call.params?.[0]?.from?.toLowerCase(),
          )
        )
          return json(403, { error: "Use a disposable demo account" });
      }
      const check = await rpc({
        jsonrpc: "2.0",
        id: 0,
        method: "eth_chainId",
        params: [],
      });
      if (check.result !== "0x7a69")
        return json(503, { error: "Local chain 31337 required" });
      return json(200, await rpc(payload));
    }
    if (url.pathname.startsWith("/api/"))
      return json(404, { error: "Not found" });
    if (!["GET", "HEAD"].includes(req.method))
      return json(405, { error: "GET required" });
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    let file = path.resolve("out", relative);
    if (!file.startsWith(path.resolve("out") + "/"))
      file = path.resolve("out/index.html");
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, "index.html");
    if (!fs.existsSync(file)) return json(404, { error: "Not found" });
    const ext = path.extname(file);
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".json": "application/json",
      ".woff2": "font/woff2",
    };
    let type = types[ext] || "application/octet-stream";
    if (relative.startsWith("ipfs/"))
      type = fs.readFileSync(file, "utf8").trimStart().startsWith("<")
        ? "image/svg+xml"
        : "application/json";
    res.writeHead(200, {
      "content-type": type,
      "cache-control": relative.startsWith("ipfs/")
        ? "public,max-age=31536000,immutable"
        : "no-store",
      "x-content-type-options": "nosniff",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(file).pipe(res);
  } catch (error) {
    json(502, { error: error.message });
  }
});
server.listen(port, host, () =>
  console.log(`Local ENSv2 app: http://${process.env.LOCAL_HOSTNAME}:${port}`),
);
