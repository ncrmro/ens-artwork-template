import {
  chromium,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { network } from "hardhat";
import "@nomicfoundation/hardhat-viem";
import fs from "node:fs";
import assert from "node:assert/strict";
import { parseEther, type Abi, type Hex, type Address } from "viem";
import artifacts from "../src/generated/contracts.json";
import config from "../artist.config.json";
const contracts = artifacts as Record<string, { abi: Abi; bytecode: Hex }>;
const conn = await network.connect("unit");
const pc = await conn.viem.getPublicClient();
const [artist, gallery, collector] = await conn.viem.getWalletClients();
const deploy = async (name: string) => {
  const hash = await artist.deployContract({ ...contracts[name] });
  return (await pc.waitForTransactionReceipt({ hash })).contractAddress!;
};
const store = await deploy("TestLabelStore"),
  root = await deploy("TestLifecycleParent");
for (const [label, owner] of [
  ["eonmun", artist.account.address],
  ["gallery", gallery.account.address],
]) {
  const h = await artist.writeContract({
    address: root,
    abi: contracts.TestLifecycleParent.abi,
    functionName: "setOwner",
    args: [label, owner],
  });
  await pc.waitForTransactionReceipt({ hash: h });
}
const base = fs.readFileSync(".env.local", "utf8").match(/^DEV_URL=(.*)$/m)![1];
const galleryBase = "http://independent-gallery.test";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || "/etc/profiles/per-user/ncrmro/bin/chromium",
  headless: true,
});
const errors: string[] = [];
async function createPage(signer: Address, origin: string): Promise<Page> {
  const context = await browser.newContext();
  if (origin !== base)
    await context.route(origin + "/**", async (r) => {
      const u = new URL(r.request().url());
      const response = await r.fetch({ url: base + u.pathname + u.search });
      await r.fulfill({ response });
    });
  await context.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        ...config,
        ens: { ETHRegistry: root, LabelStore: store },
        lifecycle: {
          namespace: "",
          artwork: "",
          mandates: "",
          settlement: "",
          galleryNamespace: "",
          galleryRegistry: "",
          galleryParentName: "",
        },
        siteView: origin === base ? "artist" : "gallery",
      },
    }),
  );
  await context.route("**/api/names?*", (r) =>
    r.fulfill({
      json: {
        names: ["eonmun.eth", "gallery.eth"],
        nextSkip: null,
        nextAfter: null,
      },
    }),
  );
  await context.route("**/api/rpc", async (route) => {
    const data = route.request().postDataJSON();
    const execute = async (c: any) => {
      try {
        return {
          jsonrpc: "2.0",
          id: c.id,
          result: await conn.provider.request({
            method: c.method,
            params: c.params,
          }),
        };
      } catch (e: any) {
        return {
          jsonrpc: "2.0",
          id: c.id,
          error: { code: -32000, message: e.message },
        };
      }
    };
    await route.fulfill({
      json: Array.isArray(data)
        ? await Promise.all(data.map(execute))
        : await execute(data),
    });
  });
  await context.route("https://ipfs.io/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: fs.readFileSync("public/blue-mountain.svg", "utf8"),
    }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(String(e)));
  let sends = 0;
  await page.exposeFunction(
    "walletRpc",
    async ({ method, params }: { method: string; params: any[] }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts")
        return [signer];
      if (
        method === "eth_sendTransaction" &&
        signer === artist.account.address &&
        ++sends === 2
      )
        throw Error("User rejected test transaction");
      return conn.provider.request({ method, params });
    },
  );
  await page.addInitScript(
    "Object.defineProperty(window,'ethereum',{value:{request:function(args){return window.walletRpc(args)}}});",
  );
  return page;
}
const ipfs =
  "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const state = (p: Page, a: Address) =>
  p.evaluate(
    (a) =>
      JSON.parse(
        localStorage.getItem(
          "artwork-platform:v3:11155111:" + a.toLowerCase() + ":public",
        ) || "{}",
      ),
    a,
  );
const idle = async (p: Page) => {
  await expect(p.locator("header .wallet")).toBeEnabled();
  assert.deepEqual(
    await p
      .locator("[role=alert]:not(#__next-route-announcer__)")
      .allTextContents(),
    [],
  );
};
const link = (origin: string, path: string, c: any) =>
  origin +
  path +
  "?" +
  new URLSearchParams(
    Object.fromEntries(Object.entries(c).filter(([, v]) => v)) as Record<
      string,
      string
    >,
  );
try {
  const a = await createPage(artist.account.address, base);
  await a.goto(base + "/artist/");
  await expect(a.locator("header .wallet")).toContainText(
    artist.account.address.slice(0, 6),
    { ignoreCase: true },
  );
  await a.getByLabel("ENS name", { exact: true }).selectOption("eonmun.eth");
  await expect(
    a
      .getByLabel("ENS name", { exact: true })
      .locator('option[value="gallery.eth"]'),
  ).toHaveAttribute("disabled", "");
  await a
    .getByRole("button", { name: "Create / resume artist registry" })
    .click();
  await expect(
    a.locator("[role=alert]:not(#__next-route-announcer__)"),
  ).toBeVisible();
  const first = await state(a, artist.account.address);
  assert.ok(first.namespace);
  assert.ok(!first.artwork);
  await a.reload();
  await a.getByLabel("ENS name", { exact: true }).selectOption("eonmun.eth");
  await a
    .getByRole("button", { name: "Create / resume artist registry" })
    .click();
  await expect(
    a.getByRole("heading", { name: "Create artwork", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await idle(a);
  assert.equal(
    (await state(a, artist.account.address)).namespace,
    first.namespace,
  );
  console.log(
    "ENS selection, authorized wallet restoration, rejected deployment and resume passed",
  );
  const g = await createPage(gallery.account.address, galleryBase);
  await g.goto(galleryBase + "/gallery/");
  await g.getByLabel("ENS name", { exact: true }).selectOption("gallery.eth");
  await g
    .getByRole("button", { name: "Create / resume gallery registry" })
    .click();
  await expect(
    g.getByRole("heading", { name: "Create exhibition", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await idle(g);
  await g.getByLabel("Exhibition title", { exact: true }).fill("Tokyo 2026");
  await g.getByLabel("Exhibition label", { exact: true }).fill("tokyo-2026");
  await g.getByLabel("Exhibition manifest IPFS URI").fill(ipfs);
  await g
    .getByRole("button", { name: "Create exhibition ↗", exact: true })
    .click();
  await idle(g);
  await g.getByRole("link", { name: "View exhibition ↗" }).click();
  await expect(
    g.getByRole("heading", { name: "Tokyo 2026", exact: true }),
  ).toBeVisible();
  const gc = await state(g, gallery.account.address);
  const invitation = {
    galleryName: gc.galleryName,
    galleryNamespace: gc.galleryNamespace,
    galleryRegistry: gc.galleryRegistry,
  };
  await a.goto(link(base, "/artist/", invitation));
  for (const [title, label] of [
    ["Blue Mountain", "blue-mountain"],
    ["Quiet Tide", "quiet-tide"],
  ]) {
    await a.getByLabel("Title", { exact: true }).fill(title);
    await a.getByLabel("Artwork label", { exact: true }).fill(label);
    await a.getByLabel("Medium", { exact: true }).fill("Oil on canvas");
    await a.getByLabel("Dimensions", { exact: true }).fill("60 x 80 cm");
    await a.getByLabel("Image IPFS URI").fill(ipfs);
    await a.getByLabel("Manifest IPFS URI", { exact: true }).fill(ipfs);
    await a.getByRole("button", { name: "Issue & lock genesis" }).click();
    await idle(a);
    await expect(
      a.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await a
    .locator(".art-card")
    .filter({
      has: a.getByRole("heading", { name: "Blue Mountain", exact: true }),
    })
    .getByRole("link", { name: "View artwork" })
    .click();
  await a.locator("main h1").waitFor();
  await a
    .getByLabel("Exhibition", { exact: true })
    .selectOption({ label: "Tokyo 2026" });
  await a.getByLabel("Minimum price (test ETH)").fill("1");
  await a.getByRole("button", { name: "Submit artwork ↗" }).click();
  await idle(a);
  await g.reload();
  await expect(
    g.getByRole("heading", { name: "Blue Mountain", exact: true }),
  ).toBeVisible();
  await g.getByRole("button", { name: "Accept submission" }).click();
  await idle(g);
  await g.getByRole("button", { name: "List at agreed price" }).click();
  await idle(g);
  const c = await createPage(collector.account.address, base);
  await c.goto(g.url().replace(galleryBase, base));
  await c.getByRole("button", { name: "Buy from exhibition" }).click();
  await idle(c);
  await expect(
    c.getByRole("button", { name: "Buy from exhibition" }),
  ).toHaveCount(0);
  await a.goto(base + "/artist/");
  await a
    .locator(".art-card")
    .filter({
      has: a.getByRole("heading", { name: "Quiet Tide", exact: true }),
    })
    .getByRole("link", { name: "View artwork" })
    .click();
  await a.getByLabel("Direct price (test ETH)").fill("2");
  await a.getByRole("button", { name: "List for direct sale" }).click();
  await idle(a);
  const directUrl = a.url();
  await c.goto(directUrl);
  await c.getByRole("button", { name: "Buy directly" }).click();
  await idle(c);
  await expect(c.getByRole("button", { name: "Buy directly" })).toHaveCount(0);
  await g.goto(galleryBase + "/gallery/");
  await expect(
    g.getByRole("button", { name: "Withdraw proceeds" }),
  ).toBeEnabled();
  await g.getByRole("button", { name: "Withdraw proceeds" }).click();
  await idle(g);
  await a.reload();
  await expect(a.locator("header .wallet")).toContainText(
    artist.account.address.slice(0, 6),
    { ignoreCase: true },
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      nextPages: true,
      walletRestored: true,
      ensChoices: true,
      resumableSetup: true,
      emptyExhibition: true,
      submission: true,
      galleryAcceptance: true,
      exhibitionPurchase: true,
      directPurchase: true,
      commissionWithdrawal: true,
      proof: "isolated EVM and injected wallets, not public Sepolia receipts",
    }),
  );
} finally {
  await browser.close();
  await conn.close();
}
