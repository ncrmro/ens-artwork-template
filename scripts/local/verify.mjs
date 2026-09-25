import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import {
  createPublicClient,
  http,
  parseEther,
  parseAbi,
  namehash,
  encodeFunctionData,
  decodeFunctionResult,
  toHex,
} from "viem";
import { packetToBytes } from "viem/ens";
import { foundry } from "viem/chains";
const base = fs.readFileSync(".env.local", "utf8").match(/^DEV_URL=(.*)$/m)[1];
const config = await (await fetch(base + "/api/config")).json();
assert.equal(config.chainId, 31337);
const { context: ctx, accounts } = config.localDemo;
const contracts = JSON.parse(fs.readFileSync("src/generated/contracts.json"));
const pc = createPublicClient({
  chain: foundry,
  transport: http("http://127.0.0.1:8545"),
});
const read = (address, kind, functionName, args = []) =>
  pc.readContract({ address, abi: contracts[kind].abi, functionName, args });
const contentAbi = parseAbi([
  "function contenthash(bytes32) view returns(bytes)",
]);
for (const name of [
  "blue-mountain.art.eonmun.eth",
  "tokyo.exhibitions.atelier.eth",
]) {
  const [data] = await pc.readContract({
    address: config.ens.UniversalResolver,
    abi: parseAbi([
      "function resolve(bytes,bytes) view returns(bytes,address)",
    ]),
    functionName: "resolve",
    args: [
      toHex(packetToBytes(name)),
      encodeFunctionData({
        abi: contentAbi,
        functionName: "contenthash",
        args: [namehash(name)],
      }),
    ],
  });
  assert.match(
    decodeFunctionResult({
      abi: contentAbi,
      functionName: "contenthash",
      data,
    }),
    /^0xe301/,
  );
}
const snapshot = await pc.request({ method: "evm_snapshot" });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || "/etc/profiles/per-user/ncrmro/bin/chromium",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function idle() {
  await expect(
    page.getByRole("button", { name: "Use artist", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  await expect(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  ).toHaveCount(0);
}
try {
  await page.goto(base + "/artist/");
  await expect(
    page.getByRole("heading", { name: "Your collection" }),
  ).toBeVisible();
  assert.match(
    await page.getByLabel("Image IPFS URI").inputValue(),
    /^ipfs:\/\/baf/,
  );
  const fixture = await page
    .getByLabel("Manifest IPFS URI", { exact: true })
    .inputValue();
  assert.equal((await fetch(base + "/ipfs/" + fixture.slice(7))).status, 200);
  await page.getByRole("button", { name: "Issue & lock genesis" }).click();
  await idle();
  await expect(
    page.getByRole("heading", { name: "Mountain Study", exact: true }),
  ).toBeVisible();
  assert.equal(await read(ctx.artwork, "ArtworkRegistry", "recordCount"), 4n);
  await page
    .locator(".art-card")
    .filter({
      has: page.getByRole("heading", { name: "Mountain Study", exact: true }),
    })
    .getByRole("link", { name: "View artwork" })
    .click();
  await page
    .getByLabel("Exhibition", { exact: true })
    .selectOption({ label: "Between Earth & Ether" });
  await page
    .getByRole("button", { name: "Submit artwork ↗", exact: true })
    .click();
  await idle();
  assert.equal(
    await read(ctx.galleryRegistry, "GalleryRegistry", "submissionCount"),
    3n,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Use artist", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto(base + "/gallery/");
  await page.getByRole("button", { name: "Use gallery", exact: true }).click();
  await idle();
  await page
    .getByLabel("Exhibition title", { exact: true })
    .fill("Local browser exhibition");
  await page
    .getByLabel("Exhibition label", { exact: true })
    .fill("browser-show");
  assert.match(
    await page.getByLabel("Exhibition manifest IPFS URI").inputValue(),
    /^ipfs:\/\/baf/,
  );
  await page
    .getByRole("button", { name: "Create exhibition ↗", exact: true })
    .click();
  await idle();
  assert.equal(
    await read(ctx.galleryRegistry, "GalleryRegistry", "recordCount"),
    2n,
  );
  await page
    .locator(".catalogue article")
    .filter({
      has: page.getByRole("heading", {
        name: "Between Earth & Ether",
        exact: true,
      }),
    })
    .getByRole("link", { name: "View exhibition" })
    .click();
  await page.getByRole("button", { name: "Accept submission" }).first().click();
  await idle();
  assert.equal(
    (
      await read(ctx.galleryRegistry, "GalleryRegistry", "submissions", [2n])
    )[5],
    2,
  );
  await page.getByRole("button", { name: "List at agreed price" }).click();
  await idle();
  await page
    .getByRole("button", { name: "Use collector", exact: true })
    .click();
  await idle();
  await page
    .getByRole("button", { name: "Buy from exhibition" })
    .first()
    .click();
  await idle();
  const token = await read(ctx.artwork, "ArtworkRegistry", "recordId", [0n]);
  assert.equal(
    (
      await read(ctx.artwork, "ArtworkRegistry", "getOwner", [token])
    ).toLowerCase(),
    accounts.collector.toLowerCase(),
  );
  assert.equal(
    await read(ctx.settlement, "SimpleSettlement", "proceeds", [
      accounts.gallery,
    ]),
    parseEther("0.01"),
  );
  await page.goto(base + "/artist/");
  await page
    .locator(".art-card")
    .filter({
      has: page.getByRole("heading", { name: "After the Rain", exact: true }),
    })
    .getByRole("link", { name: "View artwork" })
    .click();
  await page.getByRole("button", { name: "Buy directly" }).click();
  await idle();
  const direct = await read(ctx.artwork, "ArtworkRegistry", "recordId", [2n]);
  assert.equal(
    (
      await read(ctx.artwork, "ArtworkRegistry", "getOwner", [direct])
    ).toLowerCase(),
    accounts.collector.toLowerCase(),
  );
  await page.goto(base + "/gallery/");
  await page.getByRole("button", { name: "Use gallery", exact: true }).click();
  await idle();
  await page.getByRole("button", { name: "Withdraw proceeds" }).click();
  await idle();
  assert.equal(
    await read(ctx.settlement, "SimpleSettlement", "proceeds", [
      accounts.gallery,
    ]),
    0n,
  );
  await page.screenshot({ path: "output/local-gallery.png", fullPage: true });
  await page.goto(base + "/demo/artist/");
  await page
    .getByRole("button", { name: "Create artwork ↗", exact: true })
    .click();
  assert.match(
    await page.getByLabel("Image IPFS URI").inputValue(),
    /^ipfs:\/\/baf/,
  );
  await page
    .getByRole("button", { name: "Create demo artwork", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Blue Mountain Study", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Blue Mountain Study", exact: true }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real ENS local chain; artist issuance; exhibition creation; gallery acceptance and listing; gallery and direct purchases; owner readback; commission withdrawal; role refresh; IPFS fixtures; mock form persistence.",
  );
} catch (error) {
  await page.screenshot({ path: "output/local-failure.png", fullPage: true });
  fs.writeFileSync(
    "output/local-failure.txt",
    await page.locator("body").innerText(),
  );
  throw error;
} finally {
  await browser.close();
  await pc.request({ method: "evm_revert", params: [snapshot] });
}
