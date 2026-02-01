import { test, expect } from "@playwright/test";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";

const waitForProjectReady = async (page: import("playwright").Page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
    undefined,
    { timeout: 15_000 }
  );
};

test("workspace assets bridge blocks path traversal outside assets/", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  try {
    await app.firstWindow();
    await expect
      .poll(() => app.windows().length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);

    const windows = app.windows();
    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    await waitForProjectReady(dashboard);

    const attemptedRead = await dashboard.evaluate(async () => {
      return await globalThis.nwWrldBridge?.workspace?.readAssetText?.(
        "../nw_wrld_data/json/userData.json"
      );
    });
    expect(attemptedRead).toBeNull();

    const attemptedUrl = await dashboard.evaluate(() => {
      return globalThis.nwWrldBridge?.workspace?.assetUrl?.("../nw_wrld_data/json/userData.json");
    });
    expect(attemptedUrl).toBeNull();

    const meteorText = await dashboard.evaluate(async () => {
      return await globalThis.nwWrldBridge?.workspace?.readAssetText?.("json/meteor.json");
    });
    expect(typeof meteorText).toBe("string");
    const parsed = JSON.parse(String(meteorText)) as unknown;
    expect(parsed).not.toBeNull();
    expect(typeof parsed).toBe("object");
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

