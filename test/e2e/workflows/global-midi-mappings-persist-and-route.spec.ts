import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import { installInputStatusBuffer, getInputStatuses } from "../fixtures/inputStatusBuffer";
import {
  installProjectorMessageBuffer,
  clearProjectorMessages,
  getProjectorMessages,
} from "../fixtures/projectorMessageBuffer";
import {
  installDashboardMessageBuffer,
  clearDashboardMessages,
  getDashboardMessages,
} from "../fixtures/dashboardMessageBuffer";

const waitForProjectReady = async (page: import("playwright").Page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
    undefined,
    { timeout: 15_000 }
  );
};

const getDashboardAndProjectorWindows = async (
  app: import("playwright").ElectronApplication
) => {
  await expect
    .poll(() => app.windows().length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);

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

test("global MIDI mappings persist to userData.json and route input-event correctly (track + channel)", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir, env: { NW_WRLD_TEST_MIDI_MOCK: "1" } });

  const midiDeviceId = "e2e-midi-1";
  const trackSelectNote = 90;
  const channelTriggerNote = 91;

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackA = `E2E Track A ${suffix}`;
  const trackB = `E2E Track B ${suffix}`;
  const moduleName = "Text";
  const expectedText = "E2E_GLOBAL_MAPPING";

  try {
    await app.firstWindow();

    const { dashboard, projector } = await getDashboardAndProjectorWindows(app);
    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);

    await installInputStatusBuffer(dashboard);
    await installProjectorMessageBuffer(projector);
    await installDashboardMessageBuffer(dashboard);

    await dashboard.evaluate(() => {
      globalThis.nwWrldBridge?.messaging?.sendToProjector?.("debug-overlay-visibility", {
        isOpen: true,
      });
    });

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
    const trackSelect = trackRow.locator("select").first();
    await expect(trackSelect).toBeVisible();
    await trackSelect.selectOption(String(trackSelectNote));

    const channelRow = dashboard.locator('span:has-text("Ch 1:")').first().locator("..");
    await expect(channelRow).toBeVisible();
    const channelSelect = channelRow.locator("select").first();
    await expect(channelSelect).toBeVisible();
    await channelSelect.selectOption(String(channelTriggerNote));

    const mappingsModal = dashboard.locator("div.fixed").filter({ hasText: "INPUT MAPPINGS" }).first();
    await expect(mappingsModal).toBeVisible();
    await mappingsModal.getByText("CLOSE", { exact: true }).click();
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
            return {
              noteMatchMode: getNested(ud, ["config", "input", "noteMatchMode"]),
              track1: getNested(ud, ["config", "trackMappings", "midi", "exactNote", "1"]),
              channel1: getNested(ud, ["config", "channelMappings", "midi", "exactNote", "1"]),
            };
          } catch {
            return null;
          }
        },
        { timeout: 30_000 }
      )
      .toEqual({
        noteMatchMode: "exactNote",
        track1: trackSelectNote,
        channel1: channelTriggerNote,
      });

    const userDataAfterMappings = await readUserData(dir);
    const trackSelectionChannelRaw = getNested(userDataAfterMappings, ["config", "input", "trackSelectionChannel"]);
    const methodTriggerChannelRaw = getNested(userDataAfterMappings, ["config", "input", "methodTriggerChannel"]);
    if (typeof trackSelectionChannelRaw !== "number" || trackSelectionChannelRaw < 1 || trackSelectionChannelRaw > 16) {
      throw new Error(`Invalid trackSelectionChannel in userData: ${String(trackSelectionChannelRaw)}`);
    }
    if (typeof methodTriggerChannelRaw !== "number" || methodTriggerChannelRaw < 1 || methodTriggerChannelRaw > 16) {
      throw new Error(`Invalid methodTriggerChannel in userData: ${String(methodTriggerChannelRaw)}`);
    }
    const trackSelectionChannel = trackSelectionChannelRaw;
    const methodTriggerChannel = methodTriggerChannelRaw;

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

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.getByText("Create Track", { exact: true }).click();
    await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackB);
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    const trackALabel = dashboard.locator("label").filter({ hasText: trackA }).first();
    await expect(trackALabel).toBeVisible();
    await trackALabel.click();
    {
      const tracksModal = dashboard.locator("div.fixed").filter({ hasText: "Select Active Track:" }).first();
      if (await tracksModal.isVisible()) {
        await tracksModal.getByText("CLOSE", { exact: true }).click();
      }
      await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();
    }

    await dashboard.getByTestId("track-add-module").click();
    const addTextModule = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${moduleName}"]`
    );
    await expect(addTextModule).toBeVisible();
    await addTextModule.click();
    await expect(addTextModule).toBeHidden();

    await dashboard.getByTestId("track-add-channel").click();

    const channelConfig = dashboard.locator(
      `[data-testid="module-channel-config"][data-channel-key="1"]`
    );
    await expect(channelConfig).toBeVisible();
    await channelConfig.click();

    const addSelect = dashboard
      .getByTestId("method-add-select")
      .filter({ has: dashboard.locator('option[value="text"]') })
      .first();
    await expect(addSelect).toBeVisible();

    await clearProjectorMessages(projector);

    await addSelect.selectOption("text");
    const textInput = dashboard.locator(
      `[data-testid="method-option-input"][data-method-name="text"][data-option-name="text"]`
    );
    await expect(textInput).toBeVisible();
    await textInput.fill(expectedText);

    await expect
      .poll(
        async () => {
          const msgs = await getProjectorMessages(projector);
          return msgs.some((m) => m.type === "reload-data");
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    await dashboard.getByText("CLOSE", { exact: true }).click();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    const trackBLabel = dashboard.locator("label").filter({ hasText: trackB }).first();
    await expect(trackBLabel).toBeVisible();
    await trackBLabel.click();
    {
      const tracksModal = dashboard.locator("div.fixed").filter({ hasText: "Select Active Track:" }).first();
      if (await tracksModal.isVisible()) {
        await tracksModal.getByText("CLOSE", { exact: true }).click();
      }
      await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();
    }

    await clearProjectorMessages(projector);
    await clearDashboardMessages(dashboard);

    await dashboard.evaluate(
      ({ deviceId, note, channel }) => {
        const bridge = (globalThis as unknown as { nwWrldBridge?: unknown }).nwWrldBridge;
        const bridgeObj = bridge && typeof bridge === 'object' ? bridge as Record<string, unknown> : {};
        const testing = bridgeObj.testing && typeof bridgeObj.testing === 'object' ? bridgeObj.testing as Record<string, unknown> : {};
        const midi = testing.midi && typeof testing.midi === 'object' ? testing.midi as Record<string, unknown> : {};
        const noteOn = typeof midi.noteOn === 'function' ? midi.noteOn as (args: unknown) => void : null;
        noteOn?.({
          deviceId,
          note,
          channel,
          velocity: 1,
        });
      },
      { deviceId: midiDeviceId, note: trackSelectNote, channel: trackSelectionChannel }
    );

    await expect
      .poll(
        async () => {
          const msgs = await getProjectorMessages(projector);
          return msgs.some((m) => m.type === "track-activate" && m.props?.trackName === trackA);
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await expect
      .poll(
        async () => {
          const msgs = await getDashboardMessages(dashboard);
          return msgs.some((m) => m.type === "projector-ready");
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await clearDashboardMessages(dashboard);

    await dashboard.evaluate(
      ({ deviceId, note, channel }) => {
        const bridge = (globalThis as unknown as { nwWrldBridge?: unknown }).nwWrldBridge;
        const bridgeObj = bridge && typeof bridge === 'object' ? bridge as Record<string, unknown> : {};
        const testing = bridgeObj.testing && typeof bridgeObj.testing === 'object' ? bridgeObj.testing as Record<string, unknown> : {};
        const midi = testing.midi && typeof testing.midi === 'object' ? testing.midi as Record<string, unknown> : {};
        const noteOn = typeof midi.noteOn === 'function' ? midi.noteOn as (args: unknown) => void : null;
        noteOn?.({
          deviceId,
          note,
          channel,
          velocity: 1,
        });
      },
      { deviceId: midiDeviceId, note: channelTriggerNote, channel: methodTriggerChannel }
    );

    await expect
      .poll(
        async () => {
          const msgs = await getDashboardMessages(dashboard);
          const logs = msgs.filter((m) => m.type === "debug-log");
          const joined = logs.map((m) => String(m.props?.log || "")).join("\n");
          return joined.includes("Method: text") && joined.includes(expectedText);
        },
        { timeout: 20_000 }
      )
      .toBe(true);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

