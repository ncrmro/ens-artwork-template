import { encodeFunctionData } from "viem";
export function walletBatches({
  w,
  pc,
  account,
  chainId,
  contracts,
  guard,
  status,
}) {
  return {
    async check() {
      let capabilities;
      try {
        capabilities = await w.request({
          method: "wallet_getCapabilities",
          params: [account, ["0x" + chainId.toString(16)]],
        });
      } catch {
        throw Error(
          "This wallet does not expose batching. Disable “Batch confirmations” to use individual transactions.",
        );
      }
      const mode = capabilities["0x" + chainId.toString(16)]?.atomic?.status;
      if (!["supported", "ready"].includes(mode))
        throw Error(
          "Atomic batching is unavailable on this wallet/network. Disable “Batch confirmations” to continue individually.",
        );
    },
    async send(operations) {
      await guard();
      const calls = [];
      for (const op of operations) {
        const request = {
          account,
          address: op.p.wallet,
          abi: contracts.DemoAccount.abi,
          functionName: "execute",
          args: [
            op.address,
            encodeFunctionData({
              abi: contracts[op.kind].abi,
              functionName: op.functionName,
              args: op.args,
            }),
          ],
        };
        await pc.simulateContract(request);
        calls.push({
          to: request.address,
          data: encodeFunctionData(request),
          value: "0x0",
        });
      }
      status(
        `Confirm batch of ${calls.length} operations: ${operations.map((o) => o.key).join(", ")}`,
      );
      const result = await w.request({
        method: "wallet_sendCalls",
        params: [
          {
            version: "2.0.0",
            chainId: "0x" + chainId.toString(16),
            from: account,
            atomicRequired: true,
            calls,
          },
        ],
      });
      const id = typeof result === "string" ? result : result.id;
      if (!id)
        throw Error(
          "Wallet returned no batch ID. Stop and inspect wallet activity before retrying.",
        );
      return id;
    },
    async wait(id) {
      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        const result = await w.request({
          method: "wallet_getCallsStatus",
          params: [id],
        });
        const code = Number(result.status);
        if (code >= 400)
          throw Error(
            `Batch ${id} failed (status ${code}). Its checkpoint is retained; no automatic resubmission.`,
          );
        if (code === 200) {
          if (result.atomic !== true || result.receipts?.length !== 1)
            throw Error(
              "Wallet did not return a single atomic receipt. Stop and inspect batch activity.",
            );
          const receipt = await pc.waitForTransactionReceipt({
            hash: result.receipts[0].transactionHash,
            timeout: 180000,
          });
          if (receipt.status !== "success")
            throw Error(
              "Batch transaction reverted: " + receipt.transactionHash,
            );
          return receipt;
        }
        status("Waiting for batch confirmation: " + id);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      throw Error(
        "Batch still pending. Resume to check the saved batch; it will not be resubmitted.",
      );
    },
  };
}
