import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installProjectorMessageBuffer,
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
  const userDataPath = path.join(projectDir, "nw_wrld_data", "json", "userData.json");
  const raw = await fs.readFile(userDataPath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const readAppState = async (projectDir: string) => {
  const appStatePath = path.join(projectDir, "nw_wrld_data", "json", "appState.json");
  const raw = await fs.readFile(appStatePath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const getSetIdByName = async (projectDir: string, setName: string) => {
  const userData = await readUserData(projectDir);
  if (!isPlainObject(userData)) return null;
  const sets = asArray(userData.sets);
  const set =
    sets.find((s) => isPlainObject(s) && asString((s as Record<string, unknown>).name) === setName) ||
    null;
  if (!set || !isPlainObject(set)) return null;
  const id = set.id;
  return typeof id === "string" ? id : null;
};

const getTrackIdByName = async (projectDir: string, setName: string, trackName: string) => {
  const userData = await readUserData(projectDir);
  if (!isPlainObject(userData)) return null;
  const sets = asArray(userData.sets);
  const set =
    sets.find((s) => isPlainObject(s) && asString((s as Record<string, unknown>).name) === setName) ||
    null;
  if (!set || !isPlainObject(set)) return null;
  const tracks = asArray((set as Record<string, unknown>).tracks);
  const track =
    tracks.find(
      (t) => isPlainObject(t) && asString((t as Record<string, unknown>).name) === trackName
    ) || null;
  if (!track || !isPlainObject(track)) return null;
  const id = track.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
};

test("relaunch restores active set/track and mute from appState.json", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackAName = `E2E Track A ${suffix}`;
  const trackBName = `E2E Track B ${suffix}`;

  let setId: string | null = null;
  let trackBId: string | null = null;

  try {
    await app.firstWindow();

    await expect
      .poll(() => app.windows().length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);

    const windows = app.windows();
    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];

    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);

    await dashboard.getByText("SETS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Set:")).toBeVisible();
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeVisible();
    await dashboard.locator("#set-name").fill(setName);
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeHidden();
    {
      const closeButton = dashboard.getByText("CLOSE", { exact: true });
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeVisible();
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeVisible();
    await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackAName);
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeVisible();
    await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackBName);
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    const trackBLabel = dashboard.locator("label").filter({ hasText: trackBName }).first();
    await expect(trackBLabel).toBeVisible();
    await trackBLabel.click();
    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await dashboard.locator('label[for="signal-sequencer"]').click();
    await dashboard.getByText("CLOSE", { exact: true }).click();

    const muteCheckbox = dashboard.locator('label:has-text("Mute") input[type="checkbox"]');
    await expect(muteCheckbox).toBeVisible();
    if (!(await muteCheckbox.isChecked())) {
      await dashboard.locator('label:has-text("Mute")').click();
    }
    await expect(muteCheckbox).toBeChecked();

    await expect
      .poll(
        async () => {
          try {
            setId = await getSetIdByName(dir, setName);
            trackBId = await getTrackIdByName(dir, setName, trackBName);
            if (!setId || !trackBId) return false;

            const appState = await readAppState(dir);
            if (!isPlainObject(appState)) return false;
            const activeSetId = typeof appState.activeSetId === "string" ? appState.activeSetId : null;
            const activeTrackIdRaw = appState.activeTrackId;
            const activeTrackId =
              typeof activeTrackIdRaw === "string" || typeof activeTrackIdRaw === "number"
                ? String(activeTrackIdRaw)
                : null;
            const sequencerMuted = Boolean(appState.sequencerMuted);

            return (
              activeSetId === setId && activeTrackId === trackBId && sequencerMuted === true
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

    await expect
      .poll(() => app.windows().length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
    const windows2 = app.windows();
    const dashboard2 = windows2.find((w) => w.url().includes("dashboard.html")) || windows2[0];
    const projector2 = windows2.find((w) => w.url().includes("projector.html")) || windows2[1];

    await installProjectorMessageBuffer(projector2);
    await waitForProjectReady(dashboard2);
    await waitForProjectReady(projector2);

    const muteCheckbox2 = dashboard2.locator('label:has-text("Mute") input[type="checkbox"]');
    await expect(muteCheckbox2).toBeVisible();
    await expect(muteCheckbox2).toBeChecked();

    await expect
      .poll(
        async () => {
          const msgs = await getProjectorMessages(projector2);
          return msgs.some((m) => m.type === "track-activate" && m.props?.trackName === trackBName);
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

