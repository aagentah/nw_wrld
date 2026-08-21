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

const findSet = (userData: unknown, setName: string): Record<string, unknown> | null => {
  if (!isPlainObject(userData)) return null;
  const set = asArray(userData.sets).find(
    (s) => isPlainObject(s) && asString(s.name) === setName
  );
  return isPlainObject(set) ? set : null;
};

test("duplicate track, module, and set copy data under fresh ids", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackName = `E2E Track ${suffix}`;
  const moduleName = "Text";

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
    await dashboard.getByText("Create Set", { exact: true }).click();
    await dashboard.locator("#set-name").fill(setName);
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.getByText("Create Track", { exact: true }).click();
    await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackName);
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();

    await dashboard.getByTestId("track-add-module").click();
    const addTextModule = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${moduleName}"]`
    );
    await expect(addTextModule).toBeVisible();
    await addTextModule.click();
    await expect(addTextModule).toBeHidden();

    // Duplicate the module instance on the track
    await expect(dashboard.getByTestId("module-duplicate")).toHaveCount(1);
    await dashboard.getByTestId("module-duplicate").click();
    await expect(dashboard.getByTestId("module-duplicate")).toHaveCount(2);

    await expect
      .poll(async () => {
        try {
          const set = findSet(await readUserData(dir), setName);
          if (!set) return null;
          const track = asArray(set.tracks).find(
            (t) => isPlainObject(t) && asString(t.name) === trackName
          );
          if (!isPlainObject(track)) return null;
          const modules = asArray(track.modules).filter(isPlainObject);
          const ids = modules.map((m) => asString(m.id)).filter(Boolean);
          const modulesData = isPlainObject(track.modulesData) ? track.modulesData : {};
          return {
            count: modules.length,
            uniqueIds: new Set(ids).size,
            types: modules.map((m) => asString(m.type)),
            dataKeys: ids.every((id) => id !== null && id in modulesData),
          };
        } catch {
          return null;
        }
      })
      .toEqual({ count: 2, uniqueIds: 2, types: [moduleName, moduleName], dataKeys: true });

    // Duplicate the track
    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.getByTestId("duplicate-track").first().click();
    await expect(
      dashboard.locator("label").filter({ hasText: `${trackName} (Copy)` }).first()
    ).toBeVisible();
    await dashboard.getByText("CLOSE", { exact: true }).click();

    await expect
      .poll(async () => {
        try {
          const set = findSet(await readUserData(dir), setName);
          if (!set) return null;
          const tracks = asArray(set.tracks).filter(isPlainObject);
          const source = tracks.find((t) => asString(t.name) === trackName);
          const copy = tracks.find((t) => asString(t.name) === `${trackName} (Copy)`);
          if (!source || !copy) return null;
          const sourceModuleIds = asArray(source.modules)
            .filter(isPlainObject)
            .map((m) => asString(m.id));
          const copyModuleIds = asArray(copy.modules)
            .filter(isPlainObject)
            .map((m) => asString(m.id));
          return {
            distinctTrackIds: String(source.id) !== String(copy.id),
            distinctSlots: source.trackSlot !== copy.trackSlot,
            moduleCount: copyModuleIds.length,
            freshModuleIds: copyModuleIds.every((id) => id && !sourceModuleIds.includes(id)),
          };
        } catch {
          return null;
        }
      })
      .toEqual({ distinctTrackIds: true, distinctSlots: true, moduleCount: 2, freshModuleIds: true });

    // Duplicate the set
    await dashboard.getByText("SETS", { exact: true }).click();
    const setRow = dashboard
      .locator("div.flex.items-center.gap-3")
      .filter({ has: dashboard.locator("label", { hasText: setName }) })
      .first();
    await expect(setRow).toBeVisible();
    await setRow.getByTestId("duplicate-set").click();
    await expect(
      dashboard.locator("label").filter({ hasText: `${setName} (Copy)` }).first()
    ).toBeVisible();
    await dashboard.getByText("CLOSE", { exact: true }).click();

    await expect
      .poll(async () => {
        try {
          const userData = await readUserData(dir);
          const source = findSet(userData, setName);
          const copy = findSet(userData, `${setName} (Copy)`);
          if (!source || !copy) return null;
          const sourceTrackIds = asArray(source.tracks)
            .filter(isPlainObject)
            .map((t) => String(t.id));
          const copyTracks = asArray(copy.tracks).filter(isPlainObject);
          return {
            distinctSetIds: String(source.id) !== String(copy.id),
            trackCount: copyTracks.length,
            freshTrackIds: copyTracks.every((t) => !sourceTrackIds.includes(String(t.id))),
            namesPreserved: copyTracks.some((t) => asString(t.name) === trackName),
          };
        } catch {
          return null;
        }
      })
      .toEqual({ distinctSetIds: true, trackCount: 2, freshTrackIds: true, namesPreserved: true });
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
