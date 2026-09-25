import config from "../artist.config.json";
const methods = new Set([
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
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    };
    if (url.pathname === "/api/config")
      return Response.json(config, { headers });
    if (url.pathname === "/api/health")
      return Response.json(
        {
          app: "eonmoon-beta",
          chainId: 11155111,
          network: "Ethereum Sepolia",
          burnerRequired: false,
        },
        { headers },
      );
    if (url.pathname === "/api/rpc") {
      if (request.method !== "POST")
        return new Response("POST required", { status: 405, headers });
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        return new Response("Origin rejected", { status: 403, headers });
      try {
        const reader = request.body?.getReader();
        if (!reader) return new Response("Missing body", { status: 400 });
        let total = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > 32768) {
            await reader.cancel();
            return new Response("Request too large", { status: 413 });
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          bytes.set(c, offset);
          offset += c.length;
        }
        const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
        const calls = Array.isArray(payload) ? payload : [payload];
        if (
          calls.length === 0 ||
          calls.length > 10 ||
          calls.some(
            (c) => !c || typeof c !== "object" || !methods.has(c.method),
          )
        )
          return Response.json(
            { error: "Read-only Sepolia RPC methods only" },
            { status: 400, headers },
          );
        const upstream = await fetch(config.rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { ...headers, "content-type": "application/json" },
        });
      } catch {
        return Response.json(
          { error: "Sepolia RPC unavailable" },
          { status: 502, headers },
        );
      }
    }
    if (url.pathname.startsWith("/api/"))
      return Response.json({ error: "Not found" }, { status: 404, headers });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
