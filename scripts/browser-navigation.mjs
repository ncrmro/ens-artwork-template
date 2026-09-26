import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
const base =
  process.env.BASE_URL ||
  fs.readFileSync(".env.local", "utf8").match(/^DEV_URL=(.*)$/m)[1];
const b = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || "/etc/profiles/per-user/ncrmro/bin/chromium",
  headless: true,
});
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
try {
  await p.goto(base + "/artist/");
  await expect(p.getByLabel("Managed namespace")).toHaveValue(
    "artist:eonmun.eth",
  );
  await expect(p.locator(".workspace-nav")).toHaveCount(0);
  await expect(
    p.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(1);
  await expect(p.locator("header nav")).not.toContainText("Artist");
  await p.getByLabel("Managed namespace").selectOption("gallery:eonmun.eth");
  await expect(p).toHaveURL(base + "/gallery/");
  await expect(p.getByLabel("Managed namespace")).toHaveValue(
    "gallery:eonmun.eth",
  );
  await expect(
    p.getByRole("heading", { name: "Your exhibitions. Your name." }),
  ).toBeVisible();
  await p.goto(base + "/workspace/");
  await expect(p).toHaveURL(base + "/gallery/");
  await p.getByLabel("Managed namespace").selectOption("artist:eonmun.eth");
  await expect(p).toHaveURL(base + "/artist/");
  await expect(
    p.getByRole("heading", { name: "Create artwork", exact: true }),
  ).toBeVisible();
  const before = await p.evaluate(() => JSON.stringify(localStorage));
  for (const [kind, title, count] of [
    ["art", "Explore artwork", 4],
    ["galleries", "Galleries", 1],
    ["exhibitions", "Exhibitions", 1],
  ]) {
    await p.goto(base + "/browse/" + kind + "/");
    await expect(
      p.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(p.locator(".art-card")).toHaveCount(count);
    await expect(p.getByLabel("Managed namespace")).toHaveCount(0);
    await expect(
      p.getByRole("button", { name: /Create exhibition|Issue & lock genesis/ }),
    ).toHaveCount(0);
    assert.equal(await p.evaluate(() => JSON.stringify(localStorage)), before);
  }
  await p
    .getByRole("link", { name: "View exhibition", exact: false })
    .last()
    .click();
  await expect(
    p.getByRole("heading", { name: "Between Earth & Ether", exact: true }),
  ).toBeVisible();
  for (const width of [390, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    for (const path of [
      "/artist/",
      "/gallery/",
      "/browse/art/",
      "/browse/galleries/",
      "/browse/exhibitions/",
    ]) {
      await p.goto(base + path);
      await p.locator("main h1").waitFor();
      if (
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )
      )
        throw Error("Overflow " + path + " " + width);
    }
  }
  await p.goto(base + "/artist/");
  await expect(
    p.getByRole("heading", { name: "Create artwork", exact: true }),
  ).toBeVisible();
  await p.screenshot({ path: "output/navigation-artist.png", fullPage: false });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: one top nav; namespace selects artist/gallery mode and persists; public chain-backed browsing leaves tenant unchanged; shared exhibition links; mobile layout.",
  );
} finally {
  await b.close();
}
