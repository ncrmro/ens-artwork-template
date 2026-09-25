import { chromium } from "@playwright/test";
import { network } from "hardhat";
import "@nomicfoundation/hardhat-viem";
import fs from "node:fs";
import assert from "node:assert/strict";
import { type Abi, type Hex, parseEther } from "viem";
import artifacts from "../src/generated/contracts.json";
import config from "../artist.config.json";
const contracts = artifacts as Record<string, { abi: Abi; bytecode: Hex }>;
const conn = await network.connect("unit");
const pc = await conn.viem.getPublicClient();
const [artist, a, b] = await conn.viem.getWalletClients();
let signer = artist.account.address;
const deploy = async (name: string) => {
  const hash = await artist.deployContract({ ...contracts[name] });
  const r = await pc.waitForTransactionReceipt({ hash });
  return r.contractAddress!;
};
const store = await deploy("TestLabelStore"),
  parent = await deploy("TestParent");
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || "/etc/profiles/per-user/ncrmro/bin/chromium",
  headless: true,
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("BROWSER", m.text());
  });
  await page.exposeFunction(
    "walletRpc",
    async ({ method, params }: { method: string; params: unknown[] }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts")
        return [signer];
      return conn.provider.request({ method, params });
    },
  );
  await page.addInitScript(
    "Object.defineProperty(window,'ethereum',{value:{request:function(args){return window.walletRpc(args)}}});",
  );
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        ...config,
        ens: { ETHRegistry: parent, LabelStore: store },
        registry: "",
        sale: "",
        example: "",
      },
    }),
  );
  await page.route("**/api/rpc", async (route) => {
    const payload = route.request().postDataJSON();
    async function execute(c: {
      id: number;
      method: string;
      params: unknown[];
    }) {
      try {
        return {
          jsonrpc: "2.0",
          id: c.id,
          result: await conn.provider.request({
            method: c.method,
            params: c.params,
          }),
        };
      } catch (e) {
        return {
          jsonrpc: "2.0",
          id: c.id,
          error: { code: -32000, message: (e as Error).message },
        };
      }
    }
    await route.fulfill({
      json: Array.isArray(payload)
        ? await Promise.all(payload.map(execute))
        : await execute(payload),
    });
  });
  await page.route("https://ipfs.io/**", (r) =>
    r.fulfill({
      json: {
        name: "Test Lunar",
        image:
          "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      },
    }),
  );
  const base = fs
    .readFileSync(".env.local", "utf8")
    .match(/^DEV_URL=(.*)$/m)![1];
  console.log("STEP: open setup");
  await page.goto(base + "/#setup");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  console.log("STEP: deploy registry");
  await page
    .getByRole("button", { name: "Deploy registry + resolver" })
    .click();
  await page.getByRole("button", { name: "Deploy sale contract" }).waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (b) => b.textContent?.includes("Deploy sale contract") && !b.disabled,
    ),
  );
  console.log("STEP: deploy sale");
  await page.getByRole("button", { name: "Deploy sale contract" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Sale contract deployed" })
    .waitFor();
  console.log("STEP: link ENS");
  await page.getByRole("button", { name: "Link artist namespace" }).click();
  await page.getByRole("button", { name: "Namespace linked" }).waitFor();
  await page.getByRole("button", { name: "studio", exact: true }).click();
  await page.getByLabel("Artwork title").fill("Test Lunar");
  await page.getByLabel("Subname").fill("testlunar");
  const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  await page.getByLabel("Artwork IPFS CID").fill(cid);
  await page.getByLabel("Metadata URI").fill("ipfs://" + cid);
  await page
    .getByLabel("Artist royalty recipient")
    .fill(artist.account.address);
  console.log("STEP: publish");
  await page.getByRole("button", { name: "Publish on Sepolia" }).click();
  await page.locator(".work-row").filter({ hasText: "Test Lunar" }).waitFor();
  const addresses = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("eonmun:eonmun.eth")!),
  );
  async function openArt() {
    await page.getByRole("button", { name: "studio", exact: true }).click();
    await page
      .locator(".work-row")
      .filter({ hasText: "Test Lunar" })
      .getByRole("button")
      .click();
  }
  async function list() {
    await openArt();
    await page.getByLabel("Price in test ETH").fill("1");
    await page.getByRole("button", { name: "Approve and list" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  async function switchTo(address: typeof signer) {
    signer = address;
    await page.locator("button.wallet").click();
    await page
      .getByRole("status")
      .filter({ hasText: "Wallet connected" })
      .waitFor();
  }
  console.log("STEP: primary listing");
  await list();
  await switchTo(a.account.address);
  await openArt();
  await page.getByRole("button", { name: "Collect artwork" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  console.log("STEP: resale listing");
  await list();
  await switchTo(b.account.address);
  await openArt();
  await page.getByRole("button", { name: "Collect artwork" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const read = async (
    address: Hex,
    name: string,
    fn: string,
    args: unknown[],
  ) =>
    pc.readContract({
      address,
      abi: contracts[name].abi,
      functionName: fn,
      args,
    });
  assert.equal(
    await read(addresses.sale, "ArtSale", "proceeds", [artist.account.address]),
    parseEther("1.075"),
  );
  assert.equal(
    await read(addresses.sale, "ArtSale", "proceeds", [a.account.address]),
    parseEther(".925"),
  );
  await switchTo(artist.account.address);
  await page.getByRole("button", { name: "Withdraw proceeds" }).click();
  await page.getByRole("status").filter({ hasText: "Confirmed" }).waitFor();
  assert.equal(
    await read(addresses.sale, "ArtSale", "proceeds", [artist.account.address]),
    0n,
  );
  await page.getByRole("button", { name: "EVM lab" }).click();
  await page.getByRole("button", { name: "Deploy example contract" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "EVM example deployed" })
    .waitFor();
  await page.getByRole("button", { name: "Save on Sepolia" }).click();
  await page.getByRole("status").filter({ hasText: "Confirmed" }).waitFor();
  await page.getByRole("button", { name: "Read my message" }).click();
  await page
    .locator("blockquote")
    .filter({ hasText: "Your art. Your name. Your storefront." })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      proof:
        "isolated EVM + injected browser wallet, not live Sepolia transactions",
      registryDeployment: true,
      parentLink: true,
      publish: true,
      primaryPurchase: true,
      resale: true,
      artistWithdrawal: true,
      evmExample: true,
      errors,
    }),
  );
} finally {
  await browser.close();
  await conn.close();
}
