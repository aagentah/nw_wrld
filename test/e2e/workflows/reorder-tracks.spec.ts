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

const getSetTrackNames = async ({
  projectDir,
  setName,
}: {
  projectDir: string;
  setName: string;
}): Promise<string[] | null> => {
  const userData = await readUserData(projectDir);
  if (!isPlainObject(userData)) return null;

  const sets = asArray(userData.sets);
  const set = sets.find((s) => isPlainObject(s) && asString(s.name) === setName) || null;
  if (!set || !isPlainObject(set)) return null;

  const tracks = asArray(set.tracks);
  const names = tracks
    .map((t) => (isPlainObject(t) ? asString(t.name) : null))
    .filter((n): n is string => Boolean(n));

  return names;
};

const dragToTop = async (
  page: import("playwright").Page,
  fromIndex: number,
  listRoot: import("playwright").Locator
) => {
  const handles = listRoot.locator("span.cursor-move");
  const source = handles.nth(fromIndex);
  const target = handles.nth(0);

  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const src = await source.boundingBox();
  const dst = await target.boundingBox();
  if (!src || !dst) throw new Error("Could not compute track drag handle bounding boxes");

  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 12 });
  await page.mouse.up();
};

test("reorder tracks in a set -> persists after relaunch", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackNames = [`E2E Track A ${suffix}`, `E2E Track B ${suffix}`, `E2E Track C ${suffix}`];

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

    for (const trackName of trackNames) {
      await dashboard.getByText("TRACKS", { exact: true }).click();
      await expect(dashboard.locator("text=Select Active Track:")).toBeVisible();
      await dashboard.getByText("Create Track", { exact: true }).click();
      await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeVisible();
      await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackName);
      await dashboard.getByText("Create Track", { exact: true }).click();
      await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();
    }

    let before: string[] = [];
    await expect
      .poll(async () => {
        try {
          const names = await getSetTrackNames({ projectDir: dir, setName });
          before = names || [];
          return before.length;
        } catch {
          before = [];
          return 0;
        }
      })
      .toBeGreaterThanOrEqual(3);

    const moved = before[before.length - 1];
    const expected = [moved, ...before.slice(0, before.length - 1)];

    await dashboard.getByText("TRACKS", { exact: true }).click();
    const trackListRoot = dashboard.getByText("Select Active Track:").locator("../..");
    await expect(trackListRoot).toBeVisible();

    await dragToTop(dashboard, before.length - 1, trackListRoot);

    await expect
      .poll(async () => {
        try {
          const names = await getSetTrackNames({ projectDir: dir, setName });
          if (!names) return false;
          if (names.length !== expected.length) return false;
          return names.every((n, idx) => n === expected[idx]);
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
          const names = await getSetTrackNames({ projectDir: dir, setName });
          if (!names) return false;
          if (names.length !== expected.length) return false;
          return names.every((n, idx) => n === expected[idx]);
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
