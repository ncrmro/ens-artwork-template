"use client";
import { useEffect, useState } from "react";
import type { Config } from "./chain";
import { adminClient, adminIdentity, sameAddress } from "./admin-chain";
export default function AdminLink() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let gone = false,
      generation = 0;
    const provider = (window as any).ethereum;
    async function refresh() {
      const id = ++generation;
      setAllowed(false);
      try {
        if (!provider) return;
        const [accounts, network, config] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" }),
          fetch("/api/config").then(async (r) => (await r.json()) as Config),
        ]);
        if (!accounts[0] || Number(network) !== config.chainId) return;
        const owner = await adminIdentity(
          adminClient(config),
          config.ens.ETHRegistry,
        );
        if (!gone && id === generation)
          setAllowed(sameAddress(accounts[0], owner));
      } catch {}
    }
    void refresh();
    provider?.on?.("accountsChanged", refresh);
    provider?.on?.("chainChanged", refresh);
    window.addEventListener("artwork-wallet-changed", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      gone = true;
      ++generation;
      clearInterval(timer);
      provider?.removeListener?.("accountsChanged", refresh);
      provider?.removeListener?.("chainChanged", refresh);
      window.removeEventListener("artwork-wallet-changed", refresh);
    };
  }, []);
  return allowed ? <a href="/admin/">Admin</a> : null;
}
