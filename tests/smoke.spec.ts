import { test, expect } from "@playwright/test";

// Smoke tests: verify public surfaces render, manifest serves, service worker file
// is reachable, and no fatal client error occurs on the most-visited routes.
// Wallet-gated flows are intentionally skipped here — those need a funded test
// wallet and a separate harness.

const ROUTES_PUBLIC = ["/", "/contacts", "/history", "/profile", "/request", "/scan", "/send", "/bridge", "/scheduled", "/faucet"];

test.describe("Radius smoke", () => {
  test("manifest is served", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.name).toBe("Radius");
  });

  test("service worker file is reachable", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.ok()).toBeTruthy();
    expect(await res.text()).toContain("STATIC_CACHE");
  });

  for (const path of ROUTES_PUBLIC) {
    test(`route renders: ${path}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.ok()).toBeTruthy();
      // Hydration sanity: the bottom nav (in AppShell) should be present on every screen using AppShell.
      // Routes that don't use AppShell (none here) would skip this assertion.
      await expect(page.locator(".phone-shell")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("nav.bottom-nav")).toBeVisible({ timeout: 10_000 });
      const fatal = consoleErrors.filter((line) => /hydration|cannot read|undefined is not/i.test(line));
      expect(fatal, `fatal client errors on ${path}:\n${fatal.join("\n")}`).toHaveLength(0);
    });
  }
});
