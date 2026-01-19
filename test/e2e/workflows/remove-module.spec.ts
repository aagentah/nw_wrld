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

const getTrackModulesSnapshot = async ({
  projectDir,
  setName,
  trackName,
}: {
  projectDir: string;
  setName: string;
  trackName: string;
}): Promise<{
  moduleIds: string[];
  modulesDataKeys: string[];
} | null> => {
  const userData = await readUserData(projectDir);
  if (!isPlainObject(userData)) return null;

  const sets = asArray(userData.sets);
  const set = sets.find((s) => isPlainObject(s) && asString(s.name) === setName) || null;
  if (!set || !isPlainObject(set)) return null;

  const tracks = asArray(set.tracks);
  const track = tracks.find((t) => isPlainObject(t) && asString(t.name) === trackName) || null;
  if (!track || !isPlainObject(track)) return null;

  const modules = asArray(track.modules);
  const moduleIds = modules
    .map((m) => (isPlainObject(m) ? asString(m.id) : null))
    .filter((id): id is string => Boolean(id));

  const modulesData = track.modulesData;
  const modulesDataKeys = isPlainObject(modulesData) ? Object.keys(modulesData) : [];

  return { moduleIds, modulesDataKeys };
};

test("remove module from track -> persists + no orphan modulesData", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir });

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

    await dashboard.getByText("SETS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Set:")).toBeVisible();
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeVisible();
    await dashboard.locator("#set-name").fill(setName);
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeVisible();
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeVisible();
    await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackName);
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeVisible();
    const trackLabel = dashboard.locator("label").filter({ hasText: trackName }).first();
    await expect(trackLabel).toBeVisible();
    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();

    for (let i = 0; i < 2; i++) {
      await dashboard.getByText("MODULE", { exact: true }).click();
      const addButtons = dashboard.getByTestId("add-module-to-track");
      await expect(addButtons.nth(i)).toBeVisible();
      await addButtons.nth(i).click();
      await expect(dashboard.getByTestId("add-module-to-track").first()).toBeHidden();
    }

    let removeInstanceId: string | null = null;
    await expect
      .poll(async () => {
        try {
          const snap = await getTrackModulesSnapshot({
            projectDir: dir,
            setName,
            trackName,
          });
          if (!snap) return false;
          if (snap.moduleIds.length < 2) return false;
          if (snap.modulesDataKeys.length < 2) return false;
          removeInstanceId = snap.moduleIds[0];
          return true;
        } catch {
          removeInstanceId = null;
          return false;
        }
      })
      .toBe(true);

    if (!removeInstanceId) throw new Error("Could not resolve module instanceId to remove");

    const moduleHeaderActions = dashboard
      .locator(
        `[data-testid="module-drag-handle"][data-module-instance-id="${removeInstanceId}"]`
      )
      .locator("..");
    const removeButton = moduleHeaderActions.locator('[title="Remove Module"]');
    await expect(removeButton).toBeVisible();
    await removeButton.click();
    await dashboard.getByText("Confirm", { exact: true }).click();

    await expect
      .poll(async () => {
        try {
          const snap = await getTrackModulesSnapshot({
            projectDir: dir,
            setName,
            trackName,
          });
          if (!snap) return false;
          return (
            !snap.moduleIds.includes(removeInstanceId) &&
            !snap.modulesDataKeys.includes(removeInstanceId)
          );
        } catch {
          return false;
        }
      })
      .toBe(true);

    await app.close();
    app = await launchNwWrld({ projectDir: dir });
    await app.firstWindow();

    let windows2 = app.windows();
    if (windows2.length < 2) {
      try {
        await app.waitForEvent("window", { timeout: 15_000 });
      } catch {}
      windows2 = app.windows();
    }
    const dashboard2 = windows2.find((w) => w.url().includes("dashboard.html")) || windows2[0];
    await waitForProjectReady(dashboard2);

    await expect
      .poll(async () => {
        try {
          const snap = await getTrackModulesSnapshot({
            projectDir: dir,
            setName,
            trackName,
          });
          if (!snap) return false;
          return (
            !snap.moduleIds.includes(removeInstanceId) &&
            !snap.modulesDataKeys.includes(removeInstanceId)
          );
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

