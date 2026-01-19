import { test, expect } from "@playwright/test";
import { createTestWorkspace } from "./fixtures/testWorkspace";
import { launchNwWrld } from "./fixtures/launchElectron";
import type { Page } from "playwright";

const expectBridgeProjectDir = async (page: Page, dir: string) => {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.waitForLoadState("load");
      await page.waitForFunction(
        () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
        undefined,
        { timeout: 15_000 }
      );
      const gotDir = await page.evaluate(() => globalThis.nwWrldBridge?.project?.getDir?.());
      expect(gotDir).toBe(dir);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Execution context was destroyed") && attempt < maxAttempts - 1) {
        continue;
      }
      throw err;
    }
  }
};

test("launches with a test workspace dir and exposes it in both windows", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  try {
    await app.firstWindow();

    let windows = app.windows();
    if (windows.length < 2) {
      try {
        await app.waitForEvent("window", { timeout: 15_000 });
      } catch {}
      windows = app.windows();
    }

    expect(windows.length).toBeGreaterThanOrEqual(2);

    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];

    await expectBridgeProjectDir(dashboard, dir);
    await expectBridgeProjectDir(projector, dir);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
