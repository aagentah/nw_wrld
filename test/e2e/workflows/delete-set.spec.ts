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

const readRecordingData = async (projectDir: string) => {
  const recordingPath = path.join(projectDir, "nw_wrld_data", "json", "recordingData.json");
  const raw = await fs.readFile(recordingPath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const readAppState = async (projectDir: string) => {
  const appStatePath = path.join(projectDir, "nw_wrld_data", "json", "appState.json");
  const raw = await fs.readFile(appStatePath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const getSetIdsByName = async ({
  projectDir,
  keepSetName,
  deleteSetName,
}: {
  projectDir: string;
  keepSetName: string;
  deleteSetName: string;
}): Promise<{ keepSetId: string; deleteSetId: string } | null> => {
  const userData = await readUserData(projectDir);
  if (!isPlainObject(userData)) return null;

  const sets = asArray(userData.sets);
  const findId = (name: string) => {
    const s = sets.find((ss) => isPlainObject(ss) && asString(ss.name) === name) || null;
    const rawId = s && isPlainObject(s) ? s.id : null;
    return typeof rawId === "string" ? rawId : null;
  };

  const keepSetId = findId(keepSetName);
  const deleteSetId = findId(deleteSetName);
  if (!keepSetId || !deleteSetId) return null;
  return { keepSetId, deleteSetId };
};

const getSetTrackIds = async ({
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
  const ids = tracks
    .map((t) => (isPlainObject(t) ? t.id : null))
    .map((id) => (typeof id === "string" || typeof id === "number" ? String(id) : null))
    .filter((id): id is string => Boolean(id));

  return ids;
};

const writeRecordingData = async ({
  projectDir,
  trackIds,
}: {
  projectDir: string;
  trackIds: string[];
}) => {
  const jsonDir = path.join(projectDir, "nw_wrld_data", "json");
  await fs.mkdir(jsonDir, { recursive: true });
  const recordingPath = path.join(jsonDir, "recordingData.json");

  const recordings: Record<string, unknown> = {};
  for (const id of trackIds) {
    recordings[id] = {
      channels: [
        {
          name: "ch1",
          sequences: [{ time: 0, duration: 0.2 }],
        },
      ],
    };
  }

  await fs.writeFile(recordingPath, JSON.stringify({ recordings }, null, 2), "utf-8");
};

test("delete set -> recordings cleanup + persistence", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const keepSetName = `E2E Keep Set ${suffix}`;
  const deleteSetName = `E2E Delete Set ${suffix}`;
  const trackNames = [`E2E Track 1 ${suffix}`, `E2E Track 2 ${suffix}`];

  let deletedTrackIds: string[] = [];
  let keepSetId: string | null = null;
  let deleteSetId: string | null = null;

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
    await dashboard.locator("#set-name").fill(keepSetName);
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeHidden();

    await dashboard.getByText("SETS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Set:")).toBeVisible();
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeVisible();
    await dashboard.locator("#set-name").fill(deleteSetName);
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

    await expect
      .poll(async () => {
        try {
          const ids = await getSetTrackIds({ projectDir: dir, setName: deleteSetName });
          deletedTrackIds = ids || [];
          const setIds = await getSetIdsByName({
            projectDir: dir,
            keepSetName,
            deleteSetName,
          });
          keepSetId = setIds?.keepSetId || null;
          deleteSetId = setIds?.deleteSetId || null;
          return deletedTrackIds.length && keepSetId && deleteSetId ? deletedTrackIds.length : 0;
        } catch {
          deletedTrackIds = [];
          keepSetId = null;
          deleteSetId = null;
          return 0;
        }
      })
      .toBeGreaterThanOrEqual(2);

    if (!keepSetId || !deleteSetId) {
      throw new Error("Could not resolve keep/delete set ids");
    }

    await app.close();

    await writeRecordingData({ projectDir: dir, trackIds: deletedTrackIds });

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

    await dashboard2.getByText("SETS", { exact: true }).click();
    await expect(dashboard2.locator("text=Select Active Set:")).toBeVisible();
    const setLabel = dashboard2.locator("label").filter({ hasText: deleteSetName }).first();
    await expect(setLabel).toBeVisible();
    const setRow = setLabel.locator("..");
    const deleteButton = setRow.locator("button").last();
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await dashboard2.getByText("Confirm", { exact: true }).click();

    await expect
      .poll(
        async () => {
          try {
            const userData = await readUserData(dir);
            if (!isPlainObject(userData)) return false;
            const sets = asArray(userData.sets);
            const stillThere = sets.some(
              (s) => isPlainObject(s) && asString(s.name) === deleteSetName
            );
            if (stillThere) return false;
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await expect
      .poll(
        async () => {
          try {
            const rec = await readRecordingData(dir);
            if (!isPlainObject(rec)) return false;
            const recordings = rec.recordings;
            if (!isPlainObject(recordings)) return false;
            return !deletedTrackIds.some((id) =>
              Object.prototype.hasOwnProperty.call(recordings, id)
            );
          } catch {
            return false;
          }
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await app.close();

    app = await launchNwWrld({ projectDir: dir });
    await app.firstWindow();

    let windows3 = app.windows();
    if (windows3.length < 2) {
      try {
        await app.waitForEvent("window", { timeout: 15_000 });
      } catch {}
      windows3 = app.windows();
    }
    const dashboard3 = windows3.find((w) => w.url().includes("dashboard.html")) || windows3[0];
    await waitForProjectReady(dashboard3);

    await expect
      .poll(
        async () => {
          try {
            const appState = await readAppState(dir);
            if (!isPlainObject(appState)) return false;
            const activeSetId = appState.activeSetId;
            const activeTrackId = appState.activeTrackId;

            if (activeSetId === deleteSetId) return false;

            if (activeTrackId == null) return true;
            const activeTrackIdStr =
              typeof activeTrackId === "string" || typeof activeTrackId === "number"
                ? String(activeTrackId)
                : null;
            if (!activeTrackIdStr) return false;
            return !deletedTrackIds.includes(activeTrackIdStr);
          } catch {
            return false;
          }
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await expect
      .poll(async () => {
        try {
          const userData = await readUserData(dir);
          if (!isPlainObject(userData)) return false;
          const sets = asArray(userData.sets);
          const stillThere = sets.some(
            (s) => isPlainObject(s) && asString(s.name) === deleteSetName
          );
          if (stillThere) return false;
          return true;
        } catch {
          return false;
        }
      })
      .toBe(true);

    await expect
      .poll(async () => {
        try {
          const rec = await readRecordingData(dir);
          if (!isPlainObject(rec)) return false;
          const recordings = rec.recordings;
          if (!isPlainObject(recordings)) return false;
          return !deletedTrackIds.some((id) =>
            Object.prototype.hasOwnProperty.call(recordings, id)
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
