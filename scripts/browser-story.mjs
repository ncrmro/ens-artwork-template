import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const base =
  process.env.BASE_URL ||
  fs.readFileSync(".env.local", "utf8").match(/^DEV_URL=(.*)$/m)[1];
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || "/etc/profiles/per-user/ncrmro/bin/chromium",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/");
  await expect(
    page.getByRole("heading", { name: "Art has a life. Give it an identity." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("ENSv2");
  await page.goto(base + "/demo/artwork/?id=blue-mountain");
  await expect(
    page.getByRole("heading", { name: "Purchased by Alex Chen", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Purchased by Rowan Ellis",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("#terms")).toContainText("standard-artwork-v1");
  await expect(page.locator("#terms")).toContainText("180 days");
  await expect(page.locator("#terms")).not.toContainText(
    "Artist purchase option",
  );
  await expect(page.locator("#terms")).toContainText("5%");
  await expect(
    page.getByRole("heading", { name: "Created by Mika Sato", exact: true }),
  ).toHaveCount(0);
  const shows = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Exhibition history",
      exact: true,
    }),
  });
  await expect(shows.getByRole("link")).toHaveCount(3);
  await shows
    .getByRole("link", { name: "Material & Memory", exact: true })
    .click();
  await expect(page.locator(".art-card")).toHaveCount(2);
  await expect(
    page.locator(".art-card").filter({ hasText: "Folded Light" }),
  ).toContainText("Artist: Mika Sato");
  await page
    .locator(".art-card")
    .filter({ hasText: "Blue Mountain" })
    .getByRole("link", { name: "Canonical artwork terms" })
    .click();
  await expect(page.locator("#terms")).toContainText("standard-artwork-v1");
  await page.goto(base + "/demo/artist/");
  await page.getByLabel("Browse artist").selectOption("Mika Sato");
  await expect(page.locator(".art-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Create artwork ↗", exact: true })
    .click();
  await page.getByLabel("Artist", { exact: true }).selectOption("Mika Sato");
  await page.getByLabel("Artwork title").fill("Paper Horizon");
  await page
    .getByRole("button", { name: "Create demo artwork", exact: true })
    .click();
  await page
    .locator(".art-card")
    .filter({ hasText: "Paper Horizon" })
    .getByRole("link", { name: "View artwork" })
    .click();
  const terms = await page.locator("#terms code").innerText();
  await page.getByRole("button", { name: "Buy directly from artist" }).click();
  await page.reload();
  await expect(page.locator("#terms code")).toHaveText(terms);
  await expect(
    page.getByRole("heading", {
      name: "Purchased by You (demo collector)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".facts").first()).toContainText("Mika Sato");
  await page.goto(base + "/demo/gallery/");
  await page.getByLabel("Browse gallery").selectOption("Harbour Gallery");
  await expect(page.locator(".art-card")).toHaveCount(1);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/docs/",
      "/demo/artwork/?id=blue-mountain",
      "/demo/gallery/",
      "/demo/exhibition/?id=harbour",
    ]) {
      await page.goto(base + path);
      await page.locator("main h1").waitFor();
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )
      )
        throw Error("Overflow " + width + " " + path);
    }
  }
  await page.goto(base + "/docs/");
  await expect(
    page.getByRole("heading", { name: "The contract map" }),
  ).toBeVisible();
  await expect(page.locator("#terms")).toContainText(
    "ArtworkRegistry rejects single, batch and operator transfers",
  );
  fs.mkdirSync("output", { recursive: true });
  await page.screenshot({ path: "output/story-docs.png", fullPage: true });
  await page.goto(base + "/demo/artwork/?id=blue-mountain");
  await page.locator("#terms").waitFor();
  await page.screenshot({ path: "output/story-artwork.png", fullPage: true });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    JSON.stringify({
      base,
      multipleArtists: true,
      multipleGalleries: true,
      successiveBuyers: true,
      artworkScopedHistory: true,
      canonicalTermsStable: true,
      docs: true,
      mobile: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
