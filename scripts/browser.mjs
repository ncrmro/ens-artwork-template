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
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  let writes = 0;
  page.on("request", (r) => {
    if (
      r.url().includes("/api/rpc") &&
      /eth_send|eth_sign/.test(r.postData() || "")
    )
      writes++;
  });
  await page.goto(base + "/");
  await expect(
    page.getByRole("heading", { name: "Art has a life. Give it an identity." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("eonmun.eth");
  await expect(page.locator("form")).toHaveCount(0);
  await page.getByRole("link", { name: "Create an art registry" }).click();
  await expect(page).toHaveURL(/\/artist\//);
  await expect(
    page.getByRole("heading", { name: "Choose your ENS name" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Deployment addresses");
  await page.locator("header .wallet").click();
  await expect(
    page.locator("[role=alert]:not(#__next-route-announcer__)"),
  ).toContainText("wallet");
  await page.goto(base + "/demo/artist/");
  await expect(page.getByText("DEMO MODE", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Create artwork ↗", exact: true })
    .click();
  await page.getByLabel("Artwork title").fill("New Demo Work");
  await page
    .getByRole("button", { name: "Create demo artwork", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "New Demo Work", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "New Demo Work", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Demo gallery", exact: true }).click();
  await page
    .getByRole("button", { name: "Create exhibition ↗", exact: true })
    .click();
  await page.getByLabel("Exhibition title").fill("New Demo Exhibition");
  await page
    .getByLabel("Exhibition description")
    .fill("A new place for new work.");
  await page
    .getByRole("button", { name: "Create demo exhibition", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "New Demo Exhibition", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Demo artist", exact: true }).click();
  await page
    .locator(".art-card")
    .filter({
      has: page.getByRole("heading", { name: "New Demo Work", exact: true }),
    })
    .getByRole("link", { name: "View artwork" })
    .click();
  await page
    .getByLabel("Choose demo exhibition")
    .selectOption({ label: "New Demo Exhibition" });
  await page.getByRole("button", { name: "Submit demo artwork" }).click();
  await expect(page.getByRole("status")).toContainText("Submitted");
  await page.getByRole("link", { name: "Demo gallery", exact: true }).click();
  await page.getByRole("button", { name: "Accept New Demo Work" }).click();
  await page
    .locator(".art-card")
    .filter({
      has: page.getByRole("heading", {
        name: "New Demo Exhibition",
        exact: true,
      }),
    })
    .getByRole("link", { name: "View exhibition" })
    .click();
  await page.getByRole("button", { name: "Buy from exhibition" }).click();
  await expect(
    page.getByText("Artist: EON MUN · Owner: You (demo collector)"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Collected ✓" }),
  ).toBeDisabled();
  await page.goto(base + "/demo/artwork/?id=after-the-rain");
  await page.getByRole("button", { name: "Buy directly from artist" }).click();
  await expect(
    page.getByRole("button", { name: "Collected ✓" }),
  ).toBeDisabled();
  fs.mkdirSync("output", { recursive: true });
  await page.goto(base + "/demo/artist/");
  await page.locator("main h1").waitFor();
  await page.screenshot({
    path: "output/next-demo-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/artist/",
      "/gallery/",
      "/demo/artist/",
      "/demo/gallery/",
      "/demo/exhibition/",
    ]) {
      await page.goto(base + path);
      await page.locator("main h1").waitFor();
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )
      )
        throw Error("Horizontal overflow: " + path + " " + width);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/demo/gallery/");
  await page.locator("main h1").waitFor();
  await page.screenshot({
    path: "output/next-demo-mobile.png",
    fullPage: true,
  });
  if (errors.length) throw Error(errors.join("\n"));
  if (writes) throw Error("Demo made a blockchain write");
  console.log(
    JSON.stringify({
      base,
      nextRoutes: true,
      neutralLanding: true,
      distinctRoles: true,
      demoCreateSubmitAcceptBuy: true,
      demoRefreshPersistence: true,
      demoBlockchainWrites: writes,
      desktop: true,
      mobile: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
