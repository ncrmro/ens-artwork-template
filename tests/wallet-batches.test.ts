import test from "node:test";
import assert from "node:assert/strict";
import { walletBatches } from "../src/wallet-batches.js";
const make = (request: any, pc: any = {}) =>
  walletBatches({
    w: { request },
    pc,
    account: "0x0000000000000000000000000000000000000001",
    chainId: 11155111,
    contracts: {},
    guard: async () => {},
    status: () => {},
  });
test("batching refuses unsupported wallets and does not silently send individual transactions", async () => {
  const methods: string[] = [];
  const adapter = make(async ({ method }: any) => {
    methods.push(method);
    return { "0xaa36a7": { atomic: { status: "unsupported" } } };
  });
  await assert.rejects(() => adapter.check(), /unavailable/);
  assert.deepEqual(methods, ["wallet_getCapabilities"]);
});
test("batch receipt must be successful and atomic before marking operations completed", async () => {
  await assert.rejects(
    () => make(async () => ({ status: 500 })).wait("batch-id"),
    /failed/,
  );
  await assert.rejects(
    () =>
      make(async () => ({
        status: 200,
        atomic: false,
        receipts: [{ transactionHash: "0x1" }],
      })).wait("batch-id"),
    /atomic receipt/,
  );
  await assert.rejects(
    () =>
      make(
        async () => ({
          status: 200,
          atomic: true,
          receipts: [{ transactionHash: "0x1" }],
        }),
        {
          waitForTransactionReceipt: async () => ({
            status: "reverted",
            transactionHash: "0x1",
          }),
        },
      ).wait("batch-id"),
    /reverted/,
  );
});
