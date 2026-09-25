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
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base);
await page
  .getByRole("heading", { name: "Your art. Your name. Your storefront." })
  .waitFor();
await page.waitForFunction(
  () => document.querySelector(".network")?.textContent?.includes("BLOCK"),
  { timeout: 30000 },
);
fs.mkdirSync("output", { recursive: true });
await page.screenshot({ path: "output/gallery-desktop.png", fullPage: true });
await page.getByRole("button", { name: "EVM lab", exact: true }).click();
await page
  .getByRole("heading", { name: "One small write. On a real testnet." })
  .waitFor();
await page.getByRole("button", { name: "Deploy example contract" }).click();
await page
  .getByRole("status")
  .filter({ hasText: "Open this page in a wallet browser" })
  .waitFor();
await page.getByRole("button", { name: "setup", exact: true }).click();
await page
  .getByRole("heading", { name: "Your namespace. Your contracts." })
  .waitFor();
await page.getByRole("button", { name: "studio", exact: true }).click();
await page
  .getByRole("button", { name: "Publish on Sepolia" })
  .isDisabled()
  .then((disabled) => {
    if (!disabled) throw Error("Unconfigured publish must be disabled");
  });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "gallery", exact: true }).click();
await page.screenshot({ path: "output/gallery-mobile.png", fullPage: true });
if (
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
)
  throw Error("Mobile horizontal overflow");
if (errors.length) throw Error(errors.join("\n"));
console.log(
  JSON.stringify({
    base,
    desktop: true,
    mobile: true,
    liveSepolia: true,
    missingWalletHandled: true,
    errors,
  }),
);
await browser.close();
