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

const getTrackModuleTypes = async ({
  projectDir,
  setName,
  trackName,
}: {
  projectDir: string;
  setName: string;
  trackName: string;
}): Promise<string[] | null> => {
  const userData = await readUserData(projectDir);
  if (!isPlainObject(userData)) return null;

  const sets = asArray(userData.sets);
  const set = sets.find((s) => isPlainObject(s) && asString(s.name) === setName) || null;
  if (!set || !isPlainObject(set)) return null;

  const tracks = asArray(set.tracks);
  const track = tracks.find((t) => isPlainObject(t) && asString(t.name) === trackName) || null;
  if (!track || !isPlainObject(track)) return null;

  const modules = asArray(track.modules);
  const types = modules
    .map((m) => (isPlainObject(m) ? asString(m.type) : null))
    .filter((t): t is string => Boolean(t));

  return types;
};

const dragToTop = async (page: import("playwright").Page, fromIndex: number) => {
  const handles = page.getByTestId("module-drag-handle");
  const source = handles.nth(fromIndex);
  const target = handles.nth(0);

  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const src = await source.boundingBox();
  const dst = await target.boundingBox();
  if (!src || !dst) throw new Error("Could not compute drag handle bounding boxes");

  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 12 });
  await page.mouse.up();
};

test("reorder modules in a track -> persists after relaunch", async () => {
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

    // Ensure active track is the one we created (click label to select/close modal)
    await dashboard.getByText("TRACKS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeVisible();
    const trackLabel = dashboard.locator("label").filter({ hasText: trackName }).first();
    await expect(trackLabel).toBeVisible();
    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();

    // Add 3 modules (open modal each time; it closes after adding)
    for (let i = 0; i < 3; i++) {
      await dashboard.getByText("MODULE", { exact: true }).click();
      const addButtons = dashboard.getByTestId("add-module-to-track");
      await expect(addButtons.nth(i)).toBeVisible();
      await addButtons.nth(i).click();
      await expect(dashboard.getByTestId("add-module-to-track").first()).toBeHidden();
    }

    // Read initial module order from JSON
    let before: string[] = [];
    await expect
      .poll(async () => {
        try {
          const types = await getTrackModuleTypes({ projectDir: dir, setName, trackName });
          before = types || [];
          return before.length;
        } catch {
          before = [];
          return 0;
        }
      })
      .toBeGreaterThanOrEqual(3);

    const movedType = before[before.length - 1];
    const expected = [movedType, ...before.slice(0, before.length - 1)];

    // Reorder: drag last module to the top
    await dragToTop(dashboard, before.length - 1);

    // Verify persistence (JSON updates)
    await expect
      .poll(
        async () => {
          try {
            const types = await getTrackModuleTypes({ projectDir: dir, setName, trackName });
            if (!types) return false;
            if (types.length !== expected.length) return false;
            return types.every((t, idx) => t === expected[idx]);
          } catch {
            return false;
          }
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    // Relaunch and verify order persists
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
          const types = await getTrackModuleTypes({ projectDir: dir, setName, trackName });
          if (!types) return false;
          if (types.length !== expected.length) return false;
          return types.every((t, idx) => t === expected[idx]);
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
