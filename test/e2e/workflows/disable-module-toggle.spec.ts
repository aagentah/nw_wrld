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

const getTrackModulesByType = async ({
  projectDir,
  setName,
  trackName,
}: {
  projectDir: string;
  setName: string;
  trackName: string;
}): Promise<Record<string, { id: string; disabled: boolean }>> => {
  const userData = await readUserData(projectDir);
  if (!isPlainObject(userData)) return {};

  const sets = asArray(userData.sets);
  const set = sets.find((s) => isPlainObject(s) && asString(s.name) === setName) || null;
  if (!set || !isPlainObject(set)) return {};

  const tracks = asArray(set.tracks);
  const track =
    tracks.find((t) => isPlainObject(t) && asString((t as Record<string, unknown>).name) === trackName) ||
    null;
  if (!track || !isPlainObject(track)) return {};

  const modules = asArray(track.modules);
  const out: Record<string, { id: string; disabled: boolean }> = {};
  for (const m of modules) {
    if (!isPlainObject(m)) continue;
    const type = asString(m.type);
    const id = asString(m.id);
    if (!type || !id) continue;
    out[type] = { id, disabled: m.disabled === true };
  }
  return out;
};

const getDashboardAndProjectorWindows = async (app: import("playwright").ElectronApplication) => {
  await expect
    .poll(() => app.windows().length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);

  const windows = app.windows();
  const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
  const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];
  if (!dashboard || !projector) throw new Error("Expected both dashboard and projector windows to exist.");
  return { dashboard, projector };
};

const getSandboxInstanceIds = async (
  app: import("playwright").ElectronApplication
): Promise<string[]> => {
  return await app.evaluate(async ({ BrowserWindow }) => {
    try {
      const wins = BrowserWindow.getAllWindows();
      const projectorWin = wins.find((w) => {
        try {
          const url = w.webContents?.getURL?.() || "";
          return url.includes("projector.html") || w.getTitle?.() === "Projector 1";
        } catch {
          return false;
        }
      });
      if (!projectorWin) return [];

      const views = typeof projectorWin.getBrowserViews === "function" ? projectorWin.getBrowserViews() : [];
      const sandboxView = views.find((v) => {
        try {
          const url = v?.webContents?.getURL?.() || "";
          return url.includes("moduleSandbox.html") || url.includes("nw-sandbox://");
        } catch {
          return false;
        }
      });
      const wc = sandboxView?.webContents || null;
      if (!wc || typeof wc.executeJavaScript !== "function") return [];

      const instanceIdsRaw = await wc.executeJavaScript(
        `(() => Array.from(document.querySelectorAll('[data-instance-id]'))
          .map((n) => n && n.getAttribute && n.getAttribute('data-instance-id'))
          .filter((x) => typeof x === 'string' && x.trim().length > 0))()`,
        true
      );
      return Array.isArray(instanceIdsRaw) ? instanceIdsRaw : [];
    } catch {
      return [];
    }
  });
};

test("disable/enable module toggles persistence and sandbox activation", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackName = `E2E Track ${suffix}`;
  const moduleA = "Text";
  const moduleB = "SpinningCube";

  try {
    await app.firstWindow();
    const { dashboard, projector } = await getDashboardAndProjectorWindows(app);
    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);

    await dashboard.getByText("SETS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Set:")).toBeVisible();
    await dashboard.getByText("Create Set", { exact: true }).click();
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
    const trackLabel = dashboard.locator("label").filter({ hasText: trackName }).first();
    await expect(trackLabel).toBeVisible();
    await trackLabel.click();
    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();

    for (const name of [moduleA, moduleB]) {
      await dashboard.getByTestId("track-add-module").click();
      const add = dashboard.locator(`[data-testid="add-module-to-track"][data-module-name="${name}"]`);
      await expect(add).toBeVisible();
      await add.click();
      await expect(add).toBeHidden();
    }

    let modulesByType: Record<string, { id: string; disabled: boolean }> = {};
    await expect
      .poll(async () => {
        try {
          modulesByType = await getTrackModulesByType({ projectDir: dir, setName, trackName });
          return Boolean(modulesByType[moduleA]?.id && modulesByType[moduleB]?.id);
        } catch {
          return false;
        }
      })
      .toBe(true);

    const instA = modulesByType[moduleA].id;
    const instB = modulesByType[moduleB].id;

    await expect
      .poll(async () => {
        const ids = await getSandboxInstanceIds(app);
        return ids.includes(instA) && ids.includes(instB);
      })
      .toBe(true);

    const toggleA = dashboard.locator(
      `[data-testid="module-visibility-toggle"][data-module-instance-id="${instA}"]`
    );
    await expect(toggleA).toBeVisible();
    await toggleA.click();

    await expect
      .poll(async () => {
        const mods = await getTrackModulesByType({ projectDir: dir, setName, trackName });
        return mods[moduleA]?.disabled === true;
      })
      .toBe(true);

    // Press Space (global sequencer play/pause shortcut) and ensure the focused button
    // does not get "activated" again (module should remain disabled).
    await dashboard.keyboard.press("Space");
    await expect
      .poll(async () => {
        const mods = await getTrackModulesByType({ projectDir: dir, setName, trackName });
        return mods[moduleA]?.disabled === true;
      })
      .toBe(true);

    await expect
      .poll(async () => {
        const ids = await getSandboxInstanceIds(app);
        return !ids.includes(instA) && ids.includes(instB);
      })
      .toBe(true);

    await toggleA.click();

    await expect
      .poll(async () => {
        const mods = await getTrackModulesByType({ projectDir: dir, setName, trackName });
        return mods[moduleA]?.disabled === false;
      })
      .toBe(true);

    await expect
      .poll(async () => {
        const ids = await getSandboxInstanceIds(app);
        return ids.includes(instA) && ids.includes(instB);
      })
      .toBe(true);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

