import { test, expect } from "@playwright/test";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";

const waitForProjectReady = async (page: import("playwright").Page) => {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.waitForLoadState("load");
      await page.waitForFunction(
        () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
        undefined,
        { timeout: 15_000 }
      );
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

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

test("Workspace assets bridge can list + read starter assets", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  try {
    await app.firstWindow();
    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

    const windows = app.windows();
    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    await waitForProjectReady(dashboard);

    const rootListing = await dashboard.evaluate(async () => {
      return await globalThis.nwWrldBridge?.workspace?.listAssets?.(".");
    });
    expect(isPlainObject(rootListing)).toBe(true);
    expect((rootListing as { ok?: unknown }).ok).toBe(true);
    const rootDirs = Array.isArray((rootListing as { dirs?: unknown }).dirs)
      ? ((rootListing as { dirs: unknown[] }).dirs as unknown[])
          .map((d) => (typeof d === "string" ? d : null))
          .filter((d): d is string => Boolean(d))
      : [];
    expect(rootDirs).toEqual(
      expect.arrayContaining(["json", "images", "models", "fonts"])
    );

    const jsonListing = await dashboard.evaluate(async () => {
      return await globalThis.nwWrldBridge?.workspace?.listAssets?.("json");
    });
    expect(isPlainObject(jsonListing)).toBe(true);
    expect((jsonListing as { ok?: unknown }).ok).toBe(true);
    const jsonFiles = Array.isArray((jsonListing as { files?: unknown }).files)
      ? ((jsonListing as { files: unknown[] }).files as unknown[])
          .map((f) => (typeof f === "string" ? f : null))
          .filter((f): f is string => Boolean(f))
      : [];
    expect(jsonFiles).toEqual(expect.arrayContaining(["meteor.json"]));

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

