import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import { installInputStatusBuffer, getInputStatuses } from "../fixtures/inputStatusBuffer";

const waitForProjectReady = async (page: import("playwright").Page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
    undefined,
    { timeout: 15_000 }
  );
};

const getDashboardAndProjectorWindows = async (app: import("playwright").ElectronApplication) => {
  await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

  const windows = app.windows();
  const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
  const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];
  if (!dashboard || !projector) {
    throw new Error("Expected both dashboard and projector windows to exist.");
  }
  return { dashboard, projector };
};

const readUserData = async (projectDir: string) => {
  const userDataPath = path.join(projectDir, "nw_wrld_data", "json", "userData.json");
  const raw = await fs.readFile(userDataPath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const getNested = (obj: unknown, keys: string[]): unknown => {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
};

const emitNote = async (
  dashboard: import("playwright").Page,
  args: { deviceId: string; note: number; channel: number }
) => {
  await dashboard.evaluate(({ deviceId, note, channel }) => {
    const bridge = (globalThis as unknown as { nwWrldBridge?: unknown }).nwWrldBridge;
    const bridgeObj =
      bridge && typeof bridge === "object" ? (bridge as Record<string, unknown>) : {};
    const testing =
      bridgeObj.testing && typeof bridgeObj.testing === "object"
        ? (bridgeObj.testing as Record<string, unknown>)
        : {};
    const midi =
      testing.midi && typeof testing.midi === "object"
        ? (testing.midi as Record<string, unknown>)
        : {};
    const noteOn =
      typeof midi.noteOn === "function" ? (midi.noteOn as (args: unknown) => void) : null;
    noteOn?.({ deviceId, note, channel, velocity: 1 });
  }, args);
};

test("footer shows last matched track and method input activity in external MIDI mode", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir, env: { NW_WRLD_TEST_MIDI_MOCK: "1" } });

  const midiDeviceId = "e2e-midi-1";
  const trackSelectNote = 90;
  const channelTriggerNote = 91;

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackA = `E2E Track A ${suffix}`;

  try {
    await app.firstWindow();

    const { dashboard, projector } = await getDashboardAndProjectorWindows(app);
    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);

    await installInputStatusBuffer(dashboard);

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await dashboard.locator('label[for="signal-external-midi"]').click();
    const midiSelect = dashboard.locator("#midiDevice");
    await expect(midiSelect).toBeVisible();
    await midiSelect.selectOption(midiDeviceId);

    await expect
      .poll(
        async () => {
          const statuses = await getInputStatuses(dashboard);
          return statuses.some((s) => s.status === "connected");
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await dashboard.getByText("CONFIGURE MAPPINGS", { exact: true }).click();
    await expect(dashboard.getByText("INPUT MAPPINGS", { exact: true })).toBeVisible();
    await dashboard.locator('label[for="input-mappings-midi-exact"]').click();

    const trackRow = dashboard.locator('span:has-text("Track 1:")').first().locator("..");
    await expect(trackRow).toBeVisible();
    await trackRow.locator("select").first().selectOption(String(trackSelectNote));

    const channelRow = dashboard.locator('span:has-text("Ch 1:")').first().locator("..");
    await expect(channelRow).toBeVisible();
    await channelRow.locator("select").first().selectOption(String(channelTriggerNote));

    const mappingsModal = dashboard
      .locator("div.fixed")
      .filter({ hasText: "INPUT MAPPINGS" })
      .first();
    await mappingsModal.getByText("BACK", { exact: true }).click();
    await expect(dashboard.getByText("INPUT MAPPINGS", { exact: true })).toBeHidden();

    if (await dashboard.locator("#midiDevice").isVisible()) {
      await dashboard.getByText("CLOSE", { exact: true }).click();
    }
    await expect(dashboard.locator("#midiDevice")).toBeHidden();

    await expect
      .poll(
        async () => {
          try {
            const ud = await readUserData(dir);
            return getNested(ud, ["config", "trackMappings", "midi", "exactNote", "1"]);
          } catch {
            return null;
          }
        },
        { timeout: 30_000 }
      )
      .toBe(trackSelectNote);

    const userData = await readUserData(dir);
    const trackSelectionChannel = getNested(userData, [
      "config",
      "input",
      "trackSelectionChannel",
    ]) as number;
    const methodTriggerChannel = getNested(userData, [
      "config",
      "input",
      "methodTriggerChannel",
    ]) as number;

    await dashboard.getByText("SETS", { exact: true }).click();
    await dashboard.getByText("Create Set", { exact: true }).click();
    await dashboard.locator("#set-name").fill(setName);
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.getByText("Create Track", { exact: true }).click();
    await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackA);
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();

    const trackReadout = dashboard.getByTestId("input-activity-track");
    const methodReadout = dashboard.getByTestId("input-activity-method");
    await expect(trackReadout).toBeVisible();
    await expect(trackReadout).toHaveText("--");
    await expect(methodReadout).toHaveText("--");

    await emitNote(dashboard, {
      deviceId: midiDeviceId,
      note: trackSelectNote,
      channel: trackSelectionChannel,
    });
    await expect(trackReadout).toHaveText(trackA, { timeout: 20_000 });
    await expect(methodReadout).toHaveText("--");

    await emitNote(dashboard, {
      deviceId: midiDeviceId,
      note: channelTriggerNote,
      channel: methodTriggerChannel,
    });
    await expect(methodReadout).toHaveText("CH 1", { timeout: 20_000 });
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
