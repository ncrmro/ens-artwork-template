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
const state = async (p: Page) =>
  p.evaluate(() =>
    JSON.parse(
      localStorage.getItem("artwork-lifecycle:v1:11155111:eonmun.eth") || "{}",
    ),
  );
const deployed = async (p: Page, button: string, field: string) => {
  await p.getByRole("button", { name: button, exact: true }).click();
  await p.waitForFunction((k) => {
    const s = JSON.parse(
      localStorage.getItem("artwork-lifecycle:v1:11155111:eonmun.eth") || "{}",
    );
    return /^0x[0-9a-fA-F]{40}$/.test(s[k]);
  }, field);
};
const idle = async (p: Page) => {
  await expect(p.locator("header .wallet")).toBeEnabled();
  const alerts = await p.getByRole("alert").allTextContents();
  assert.deepEqual(alerts, []);
};
const share = (origin: string, links: any, view = "artist", tab = "artwork") =>
  origin +
  "/?" +
  new URLSearchParams({ ...links, view }).toString() +
  "#" +
  tab;
const read = async (
  address: string,
  name: string,
  fn: string,
  args: readonly unknown[] = [],
): Promise<any> =>
  pc.readContract({
    address: address as Address,
    abi: contracts[name].abi,
    functionName: fn,
    args,
  });
try {
  const a = await createPage(artist.account.address, base);
  await a.goto(base + "/#setup");
  await a.getByRole("button", { name: "Connect / refresh account" }).click();
  await idle(a);
  console.log("Artist namespace and protocol deployment");
  await a
    .getByRole("button", {
      name: "Create / resume artist registry ↗",
      exact: true,
    })
    .click();
  await expect(a.getByRole("alert")).toBeVisible();
  const checkpoint = await state(a);
  assert.ok(checkpoint.namespace);
  assert.equal(checkpoint.artwork, "");
  await a.reload();
  await deployed(a, "Create / resume artist registry ↗", "settlement");
  assert.equal((await state(a)).namespace, checkpoint.namespace);
  await idle(a);
  await expect(a.getByText(/Namespace linked ✓/)).toBeVisible();
  let links = await state(a);
  const g = await createPage(gallery.account.address, galleryBase);
  await g.goto(share(galleryBase, links, "gallery", "setup"));
  await g.getByRole("button", { name: "Connect / refresh account" }).click();
  await idle(g);
  await g.getByLabel("Gallery ENS parent", { exact: true }).fill("gallery.eth");
  console.log("Independent gallery namespace deployment");
  await deployed(g, "Create / resume gallery registry ↗", "galleryRegistry");
  await idle(g);
  await expect(
    g.getByText("Gallery namespace linked ✓", { exact: true }),
  ).toBeVisible();
  links = await state(g);
  await a.goto(share(base, links, "artist", "workspace"));
  await a.getByRole("button", { name: "Connect wallet" }).click();
  await idle(a);
  console.log("Issue physical artwork and immutable genesis");
  for (const [label, value] of [
    ["Title", "Blue Mountain"],
    ["Artwork label", "blue-mountain"],
    ["Dimensions", "48 x 116 in"],
    ["Medium", "Acrylic and gold leaf on linen"],
    [
      "Canonical image IPFS URI",
      "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    ],
    [
      "Artwork manifest IPFS URI",
      "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    ],
  ]) {
    await a.getByLabel(label, { exact: true }).fill(value);
  }
  await a.getByRole("button", { name: "Issue & lock genesis" }).click();
  await expect(
    a.getByRole("heading", { name: "Blue Mountain", exact: true }),
  ).toBeVisible();
  await idle(a);
  await a.getByRole("button", { name: "Workspace", exact: true }).click();
  await a
    .getByLabel("Gallery wallet", { exact: true })
    .fill(gallery.account.address);
  await a.getByLabel("Minimum price (test ETH)", { exact: true }).fill("1");
  await a.getByRole("button", { name: "Submit to gallery" }).click();
  await expect(
    a.getByText("AWAITING ACCEPTANCE", { exact: true }),
  ).toBeVisible();
  await idle(a);
  await a
    .getByRole("button", { name: "Approve settlement", exact: false })
    .click();
  await expect(
    a.getByRole("button", { name: "Revoke settlement approval" }),
  ).toBeVisible();
  await idle(a);
  console.log("Gallery accepts, exhibits and lists without owning the token");
  await g.goto(share(galleryBase, links, "gallery", "workspace"));
  await g.getByRole("button", { name: "Connect wallet" }).click();
  await idle(g);
  await g.getByRole("button", { name: "Accept submission #1" }).click();
  await expect(g.getByText("ACTIVE", { exact: true })).toBeVisible();
  await idle(g);
  await g.getByLabel("Exhibition title", { exact: true }).fill("Tokyo 2026");
  await g.getByLabel("Exhibition label", { exact: true }).fill("tokyo-2026");
  await g
    .getByLabel("Exhibition manifest URI", { exact: true })
    .fill("ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
  await g
    .getByLabel("Custody statement (unverified)", { exact: true })
    .fill("Gallery reports receiving the painting for exhibition.");
  await g.getByRole("button", { name: "Publish exhibition #1" }).click();
  await expect
    .poll(() => read(links.galleryRegistry, "GalleryRegistry", "recordCount"))
    .toBe(1n);
  await idle(g);
  await g.getByRole("button", { name: "List artwork #1" }).click();
  await expect
    .poll(() => read(links.settlement, "SimpleSettlement", "count"))
    .toBe(1n);
  await idle(g);
  const id = await read(links.artwork, "ArtworkRegistry", "recordId", [0n]);
  assert.equal(
    (
      await read(links.artwork, "ArtworkRegistry", "getOwner", [id])
    ).toLowerCase(),
    artist.account.address,
  );
  const c = await createPage(collector.account.address, base);
  await c.goto(share(base, links, "collector"));
  await expect(
    c.getByRole("heading", { name: "Tokyo 2026", exact: true }),
  ).toBeVisible();
  await c.getByRole("button", { name: "Collect artwork" }).click();
  await expect
    .poll(async () =>
      String(
        await read(links.artwork, "ArtworkRegistry", "getOwner", [id]),
      ).toLowerCase(),
    )
    .toBe(collector.account.address);
  await idle(c);
  for (const p of [a, g, c]) {
    await p.goto(
      share(
        p === g ? galleryBase : base,
        links,
        p === g ? "gallery" : "collector",
      ),
    );
    await p.reload();
    await expect(
      p
        .locator(".facts")
        .getByText(
          new RegExp(
            collector.account.address.slice(0, 6) +
              "…" +
              collector.account.address.slice(-4),
            "i",
          ),
        ),
    ).toBeVisible();
    await expect(
      p.getByRole("heading", { name: "Tokyo 2026", exact: true }),
    ).toBeVisible();
  }
  assert.equal(
    await read(links.mandates, "MandateRegistry", "active", [1n, 257n]),
    false,
  );
  assert.equal(
    await read(links.settlement, "SimpleSettlement", "proceeds", [
      gallery.account.address,
    ]),
    parseEther(".1"),
  );
  await g.getByRole("button", { name: "Workspace", exact: true }).click();
  await g.getByRole("button", { name: "Connect wallet" }).click();
  await idle(g);
  await g.getByRole("button", { name: "Withdraw proceeds" }).click();
  await expect
    .poll(() =>
      read(links.settlement, "SimpleSettlement", "proceeds", [
        gallery.account.address,
      ]),
    )
    .toBe(0n);
  await idle(g);
  fs.mkdirSync("output", { recursive: true });
  await c.screenshot({
    path: "output/lifecycle-wallet-proof.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      proof: "isolated EVM and injected wallets; not public-chain receipts",
      independentOrigins: [base, galleryBase],
      namespaceDeployment: true,
      immutableGenesis: true,
      galleryMandate: true,
      exhibition: true,
      noncustodialListing: true,
      collectorSettlement: true,
      sharedOwnershipAcrossSites: true,
      commissionWithdrawal: true,
      errors,
    }),
  );
} finally {
  await browser.close();
  await conn.close();
}
