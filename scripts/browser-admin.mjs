import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  zeroAddress,
} from "viem";
import { foundry } from "viem/chains";
const config = JSON.parse(fs.readFileSync(".local/demo.json"));
const base = fs.readFileSync(".env.local", "utf8").match(/^DEV_URL=(.*)$/m)[1];
const pc = createPublicClient({
  chain: foundry,
  transport: http("http://127.0.0.1:8545"),
  pollingInterval: 50,
});
const snapshot = await pc.request({ method: "evm_snapshot" });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || "/etc/profiles/per-user/ncrmro/bin/chromium",
  headless: true,
});
try {
  const accounts = await pc.request({ method: "eth_accounts" });
  let selected = accounts[1];
  let rejectOnce = true;
  let sends = 0;
  const registrar = createWalletClient({
    account: accounts[0],
    chain: foundry,
    transport: http("http://127.0.0.1:8545"),
  });
  for (const label of ["ncrmro", "davinci", "vangogh", "louvre"]) {
    const hash = await registrar.writeContract({
      address: config.ens.ETHRegistry,
      abi: parseAbi([
        "function register(string,address,address,address,uint256,uint64) returns(uint256)",
      ]),
      functionName: "register",
      args: [
        label,
        selected,
        zeroAddress,
        zeroAddress,
        1n << 20n,
        (await pc.getBlock()).timestamp + 365n * 86400n,
      ],
    });
    assert.equal(
      (await pc.waitForTransactionReceipt({ hash })).status,
      "success",
    );
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.exposeFunction("testWalletRPC", async ({ method, params }) => {
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return [selected];
    if (method === "eth_sendTransaction" && ++sends === 9 && rejectOnce) {
      rejectOnce = false;
      throw Error("User rejected request");
    }
    return pc.request({ method, params });
  });
  await page.addInitScript(() => {
    const events = {};
    window.ethereum = {
      request: async (args) => {
        try {
          return await window.testWalletRPC(args);
        } catch (e) {
          if (e.message.includes("User rejected")) e.code = 4001;
          throw e;
        }
      },
      on: (name, fn) => (events[name] ??= []).push(fn),
      removeListener: (name, fn) => {
        events[name] = (events[name] || []).filter((x) => x !== fn);
      },
      emit: (name) => (events[name] || []).forEach((fn) => fn()),
    };
  });
  await page.route("**/api/names?*", (r) =>
    r.fulfill({
      json: {
        names: ["ncrmro.eth", "davinci.eth", "vangogh.eth", "louvre.eth"],
        nextSkip: null,
        nextAfter: null,
      },
    }),
  );
  // Read configuration is real local ENSv2; omit the previous local index to exercise on-chain discovery.
  await page.route("**/api/config", async (r) => {
    const response = await r.fetch();
    const c = await response.json();
    delete c.localDemo;
    await r.fulfill({ json: c });
  });
  await page.goto(base + "/admin/");
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "davinci.eth", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check plan", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Plan ready.", {
    timeout: 30000,
  });
  assert.equal(sends, 0);
  await page
    .getByRole("button", { name: "Launch Sepolia seed", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(/User rejected/, {
    timeout: 120000,
  });
  await page.reload();
  await expect(
    page.getByLabel("Leonardo da Vinci · artist"),
  ).toHaveValue("davinci.eth");
  await page.getByRole("button", { name: "Resume seed", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Browse published artwork ↗" }),
  ).toBeVisible({ timeout: 180000 });
  await expect(page.getByRole("status")).toContainText("Complete", {
    timeout: 10000,
  });
  for (const [kind, count] of [
    ["art", 3],
    ["galleries", 1],
    ["exhibitions", 1],
  ]) {
    await page.goto(base + "/browse/" + kind + "/");
    await expect(page.locator(".art-card")).toHaveCount(count, {
      timeout: 30000,
    });
  }
  await page.goto(base + "/admin/");
  await expect(
    page.getByRole("button", { name: "Resume seed", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "output/admin-seed.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    "No mobile overflow",
  );
  selected = accounts[2];
  await page.evaluate(() => window.ethereum.emit("accountsChanged"));
  await expect(
    page.getByRole("heading", { name: "Admin wallet required" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Resume seed", exact: true }),
  ).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: visible admin link only for name owner; owned-name choices; read-only check; real wallet transactions; rejection/reload/resume; public on-chain catalogue discovery; mobile layout; wallet change hides admin controls.",
  );
} finally {
  await browser.close();
  await pc.request({ method: "evm_revert", params: [snapshot] });
}
