import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installProjectorMessageBuffer,
  clearProjectorMessages,
  getProjectorMessages,
} from "../fixtures/projectorMessageBuffer";

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
  try {
    const userDataPath = path.join(projectDir, "nw_wrld_data", "json", "userData.json");
    const raw = await fs.readFile(userDataPath, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const getSetByName = async (projectDir: string, setName: string) => {
  const userData = await readUserData(projectDir);
  if (!isPlainObject(userData)) return null;
  const sets = asArray(userData.sets);
  const set = sets.find((s) => isPlainObject(s) && asString(s.name) === setName) || null;
  return set && isPlainObject(set) ? (set as Record<string, unknown>) : null;
};

const getSetIdByName = async (projectDir: string, setName: string) => {
  const set = await getSetByName(projectDir, setName);
  const id = set ? set.id : null;
  return typeof id === "string" ? id : null;
};

const getTrackByName = async (projectDir: string, setName: string, trackName: string) => {
  const set = await getSetByName(projectDir, setName);
  if (!set) return null;
  const tracks = asArray(set.tracks);
  const track =
    tracks.find((t) => isPlainObject(t) && asString((t as Record<string, unknown>).name) === trackName) ||
    null;
  return track && isPlainObject(track) ? (track as Record<string, unknown>) : null;
};

const getTrackModuleInstanceIds = async (projectDir: string, setName: string, trackName: string) => {
  const track = await getTrackByName(projectDir, setName, trackName);
  if (!track) return null;
  const modules = asArray(track.modules);
  const ids = modules
    .map((m) => (isPlainObject(m) ? asString(m.id) : null))
    .filter((id): id is string => Boolean(id));
  return ids;
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

const getSandboxSnapshot = async (
  app: import("playwright").ElectronApplication
): Promise<{ token: string | null; webContentsId: number | null; instanceIds: string[] }> => {
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
      if (!projectorWin) return { token: null, webContentsId: null, instanceIds: [] };

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
      const webContentsId = wc && typeof wc.id === "number" ? wc.id : null;
      if (!wc || typeof wc.executeJavaScript !== "function") {
        return { token: null, webContentsId, instanceIds: [] };
      }

      const [tokenRaw, instanceIdsRaw] = await Promise.all([
        wc.executeJavaScript(
          `(() => {
            const h = String(window.location.hash || "");
            const m = h.match(/token=([^&]+)/);
            if (!m) return null;
            try { return decodeURIComponent(m[1]); } catch { return m[1]; }
          })()`,
          true
        ),
        wc.executeJavaScript(
          `(() => Array.from(document.querySelectorAll('[data-instance-id]'))
            .map((n) => n && n.getAttribute && n.getAttribute('data-instance-id'))
            .filter((x) => typeof x === 'string' && x.trim().length > 0))()`,
          true
        ),
      ]);

      return {
        token: typeof tokenRaw === "string" ? tokenRaw : null,
        webContentsId,
        instanceIds: Array.isArray(instanceIdsRaw) ? instanceIdsRaw : [],
      };
    } catch {
      return { token: null, webContentsId: null, instanceIds: [] };
    }
  });
};

test("set switching deactivates old modules and activates new ones", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setAName = `E2E Set A ${suffix}`;
  const trackAName = `E2E Track A ${suffix}`;
  const moduleAName = "Text";

  const setBName = `E2E Set B ${suffix}`;
  const trackBName = `E2E Track B ${suffix}`;
  const moduleBName = "SpinningCube";

  let setAId: string | null = null;
  let setBId: string | null = null;
  let instA: string | null = null;
  let instB: string | null = null;

  try {
    await app.firstWindow();
    const { dashboard, projector } = await getDashboardAndProjectorWindows(app);
    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);
    await installProjectorMessageBuffer(projector);

    await dashboard.getByText("SETS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Set:")).toBeVisible();
    await dashboard.getByText("Create Set", { exact: true }).click();
    await dashboard.locator("#set-name").fill(setAName);
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.getByText("Create Track", { exact: true }).click();
    await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackAName);
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    const trackALabel = dashboard.locator("label").filter({ hasText: trackAName }).first();
    await expect(trackALabel).toBeVisible();
    await trackALabel.click();
    await dashboard.getByText("CLOSE", { exact: true }).click();

    await dashboard.getByText("MODULE", { exact: true }).click();
    const addModuleA = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${moduleAName}"]`
    );
    await expect(addModuleA).toBeVisible();
    await addModuleA.click();
    await expect(addModuleA).toBeHidden();

    await expect
      .poll(async () => {
        try {
          setAId = await getSetIdByName(dir, setAName);
          const ids = await getTrackModuleInstanceIds(dir, setAName, trackAName);
          instA = ids && ids.length ? ids[0] : null;
          return Boolean(setAId && instA);
        } catch {
          setAId = null;
          instA = null;
          return false;
        }
      })
      .toBe(true);

    if (!instA) throw new Error("Could not resolve module instance id for Set A");

    let tokenA: string | null = null;
    await expect
      .poll(
        async () => {
          const snap = await getSandboxSnapshot(app);
          tokenA = snap.token;
          return snap.instanceIds.includes(instA as string);
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    await dashboard.getByText("SETS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Set:")).toBeVisible();
    await dashboard.getByText("Create Set", { exact: true }).click();
    await dashboard.locator("#set-name").fill(setBName);
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.getByText("Create Track", { exact: true }).click();
    await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackBName);
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    const trackBLabel = dashboard.locator("label").filter({ hasText: trackBName }).first();
    await expect(trackBLabel).toBeVisible();
    await trackBLabel.click();
    await dashboard.getByText("CLOSE", { exact: true }).click();

    await dashboard.getByText("MODULE", { exact: true }).click();
    const addModuleB = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${moduleBName}"]`
    );
    await expect(addModuleB).toBeVisible();
    await addModuleB.click();
    await expect(addModuleB).toBeHidden();

    await expect
      .poll(async () => {
        try {
          setBId = await getSetIdByName(dir, setBName);
          const ids = await getTrackModuleInstanceIds(dir, setBName, trackBName);
          instB = ids && ids.length ? ids[0] : null;
          return Boolean(setBId && instB);
        } catch {
          setBId = null;
          instB = null;
          return false;
        }
      })
      .toBe(true);

    if (!instB) throw new Error("Could not resolve module instance id for Set B");

    let tokenB: string | null = null;
    await expect
      .poll(
        async () => {
          const snap = await getSandboxSnapshot(app);
          tokenB = snap.token;
          return (
            snap.instanceIds.includes(instB as string) &&
            !snap.instanceIds.includes(instA as string) &&
            (tokenA ? snap.token !== tokenA : Boolean(snap.token))
          );
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    if (!setAId || !setBId || !tokenA || !tokenB) {
      throw new Error("Could not resolve set ids and sandbox tokens");
    }

    await clearProjectorMessages(projector);
    await dashboard.getByText("SETS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Set:")).toBeVisible();
    const setALabel = dashboard.locator("label").filter({ hasText: setAName }).first();
    await expect(setALabel).toBeVisible();
    await setALabel.click();

    await expect
      .poll(
        async () => {
          const msgs = await getProjectorMessages(projector);
          const hasSet = msgs.some((m) => m.type === "set-activate" && m.props?.setId === setAId);
          const hasTrack = msgs.some((m) => m.type === "track-activate");
          return hasSet && hasTrack;
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await expect
      .poll(
        async () => {
          const snap = await getSandboxSnapshot(app);
          return snap.instanceIds.includes(instA as string) && !snap.instanceIds.includes(instB as string);
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    await clearProjectorMessages(projector);
    await dashboard.getByText("SETS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Set:")).toBeVisible();
    const setBLabel = dashboard.locator("label").filter({ hasText: setBName }).first();
    await expect(setBLabel).toBeVisible();
    await setBLabel.click();

    await expect
      .poll(
        async () => {
          const msgs = await getProjectorMessages(projector);
          const hasSet = msgs.some((m) => m.type === "set-activate" && m.props?.setId === setBId);
          const hasTrack = msgs.some((m) => m.type === "track-activate");
          return hasSet && hasTrack;
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await expect
      .poll(
        async () => {
          const snap = await getSandboxSnapshot(app);
          return snap.instanceIds.includes(instB as string) && !snap.instanceIds.includes(instA as string);
        },
        { timeout: 30_000 }
      )
      .toBe(true);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

