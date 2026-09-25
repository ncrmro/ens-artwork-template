import { chromium } from "@playwright/test";
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
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Art has a life. Give it an identity." })
    .waitFor();
  await page.waitForFunction(() =>
    document.querySelector(".network")?.textContent?.includes("BLOCK"),
  );
  await page
    .getByText("ILLUSTRATIVE PHYSICAL-ART EXAMPLE", { exact: true })
    .waitFor();
  fs.mkdirSync("output", { recursive: true });
  await page.screenshot({
    path: "output/lifecycle-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Connect wallet", exact: false })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Open this page in a wallet browser" })
    .waitFor();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator(".role-tabs").getByRole("button", { name: "artist", exact: true }).click();
  if (
    !(await page
      .getByRole("button", { name: "Issue & lock genesis" })
      .isDisabled())
  )
    throw Error("Unconfigured issue must be disabled");
  await page.getByRole("button", { name: "What’s next", exact: true }).click();
  await page.getByText("COMING SOON", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page
    .getByRole("heading", { name: "art.eonmun.eth", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["The artwork", "Workspace", "Setup", "What’s next"]) {
    await page.getByRole("button", { name, exact: true }).click();
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error("Mobile overflow: " + name);
  }
  await page.getByRole("button", { name: "The artwork", exact: true }).click();
  await page.screenshot({
    path: "output/lifecycle-mobile.png",
    fullPage: true,
  });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    JSON.stringify({
      base,
      desktop: true,
      mobile: true,
      liveSepolia: true,
      unpublishedPreview: true,
      missingWalletHandled: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
