import fs from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { sepolia, foundry } from "viem/chains";
import { createAssets } from "./assets.mjs";
import { seedCatalogue as run } from "../../src/seed-engine.js";
export async function seedCatalogue(options) {
  const { plan, signerUrl, catalogue } = options;
  const chain = plan.chainId === 31337 ? foundry : sepolia;
  return run({
    ...options,
    adapter: {
      async authorize(participants) {
        if (!signerUrl)
          throw Error("Set SEED_SIGNER_RPC_URL to an external wallet signer.");
        const signer = createPublicClient({
          chain,
          transport: http(signerUrl),
        });
        if ((await signer.getChainId()) !== plan.chainId)
          throw Error("Signer chain mismatch");
        const accounts = await signer.request({ method: "eth_accounts" });
        for (const p of participants)
          if (!accounts.some((a) => a.toLowerCase() === p.wallet.toLowerCase()))
            throw Error("Signer does not expose " + p.id + " wallet");
      },
      wallet: (p) =>
        createWalletClient({
          account: p.wallet,
          chain,
          transport: http(signerUrl),
        }),
      loadJournal: () =>
        fs.existsSync(plan.journal)
          ? JSON.parse(fs.readFileSync(plan.journal))
          : null,
      saveJournal: (j) => {
        fs.mkdirSync(
          plan.journal.slice(0, plan.journal.lastIndexOf("/")) || ".",
          { recursive: true },
        );
        fs.writeFileSync(plan.journal + ".tmp", JSON.stringify(j, null, 2));
        fs.renameSync(plan.journal + ".tmp", plan.journal);
      },
      assets: () => createAssets(catalogue),
      publishIndex: (index) =>
        fs.writeFileSync(
          plan.indexOutput,
          JSON.stringify(index, null, 2) + "\n",
        ),
    },
  });
}
