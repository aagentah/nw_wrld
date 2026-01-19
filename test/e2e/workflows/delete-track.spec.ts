import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

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

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const asString = (v: unknown): string | null => (typeof v === "string" ? v : null);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const readUserData = async (projectDir: string) => {
  const userDataPath = path.join(projectDir, "nw_wrld_data", "json", "userData.json");
  const raw = await fs.readFile(userDataPath, "utf-8");
  return JSON.parse(raw) as unknown;
};

test("delete track -> persists", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackName = `E2E Track ${suffix}`;

  try {
    await app.firstWindow();

    let windows = app.windows();
    if (windows.length < 2) {
      try {
        await app.waitForEvent("window", { timeout: 15_000 });
      } catch {}
      windows = app.windows();
    }

    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    await waitForProjectReady(dashboard);

    // Create set
    await dashboard.getByText("SETS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Set:")).toBeVisible();
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeVisible();
    await dashboard.locator("#set-name").fill(setName);
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeHidden();

    // Create track
    await dashboard.getByText("TRACKS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeVisible();
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeVisible();
    await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackName);
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();

    // Re-open tracks modal to interact with track list (Create Track closes the modal)
    await dashboard.getByText("TRACKS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeVisible();

    // Verify track exists (UI)
    const trackLabel = dashboard.locator("label").filter({ hasText: trackName }).first();
    await expect(trackLabel).toBeVisible();

    // Delete track (icon-only control via stable testid)
    await trackLabel.locator("..").getByTestId("delete-track").click();
    await dashboard.getByText("Confirm", { exact: true }).click();

    await expect(dashboard.locator("label").filter({ hasText: trackName })).toHaveCount(0);

    // Verify persistence (JSON)
    await expect
      .poll(async () => {
        try {
          const userData = await readUserData(dir);
          if (!isPlainObject(userData)) return false;
          const sets = asArray(userData.sets);
          const set = sets.find((s) => isPlainObject(s) && asString(s.name) === setName) || null;
          if (!set || !isPlainObject(set)) return false;
          const tracks = asArray(set.tracks);
          return !tracks.some((t) => isPlainObject(t) && asString(t.name) === trackName);
        } catch {
          return false;
        }
      })
      .toBe(true);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
