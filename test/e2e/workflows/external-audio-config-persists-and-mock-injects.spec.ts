import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installInputStatusBuffer,
  clearInputStatuses,
  getInputStatuses,
} from "../fixtures/inputStatusBuffer";
import {
  installInputEventBuffer,
  clearInputEvents,
  getInputEvents,
} from "../fixtures/inputEventBuffer";

const waitForProjectReady = async (page: import("playwright").Page) => {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.waitForLoadState("load");
      await page.waitForFunction(
        () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
        undefined,
        { timeout: 15_000 }
      );
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Execution context was destroyed") && attempt < maxAttempts - 1) {
        continue;
      }
      throw err;
    }
  }
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

const findTrackByName = (ud: unknown, name: string) => {
  const sets = getNested(ud, ["sets"]);
  if (!Array.isArray(sets) || sets.length === 0) return null;
  const set0 = sets[0];
  if (!set0 || typeof set0 !== "object") return null;
  const tracks = (set0 as Record<string, unknown>).tracks;
  if (!Array.isArray(tracks)) return null;
  return (
    tracks.find(
      (t) => t && typeof t === "object" && (t as Record<string, unknown>).name === name
    ) || null
  );
};

test("External Audio config persists across relaunch and mock audio emits input-event", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir, env: { NW_WRLD_TEST_AUDIO_MOCK: "1" } });

  try {
    await app.firstWindow();

    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const windows = app.windows();
    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    await waitForProjectReady(dashboard);

    await installInputStatusBuffer(dashboard);
    await installInputEventBuffer(dashboard);

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await expect(dashboard.locator("#signal-external-audio")).toBeVisible();
    await dashboard.locator('label[for="signal-external-audio"]').click();
    await expect(dashboard.getByTestId("settings-audio-threshold-meter-low")).toBeVisible();
    await expect(dashboard.getByTestId("settings-audio-threshold-meter-medium")).toBeVisible();
    await expect(dashboard.getByTestId("settings-audio-threshold-meter-high")).toBeVisible();

    await expect
      .poll(
        async () => {
          const statuses = await getInputStatuses(dashboard);
          return statuses.some(
            (s) =>
              s.status === "connected" &&
              typeof s.message === "string" &&
              s.message.includes("Audio")
          );
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("#signal-external-audio")).toBeHidden();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    const intermediateRow = dashboard
      .locator("label")
      .filter({ hasText: "Intermediate" })
      .first()
      .locator("..");
    await intermediateRow.getByTestId("edit-track").click();
    await expect(dashboard.getByText("Close", { exact: true })).toBeVisible();
    await dashboard.getByTestId("track-audio-cooldown").fill("250");
    await dashboard.getByTestId("track-audio-threshold-low").fill("0.2");
    await dashboard.getByTestId("track-audio-threshold-medium").fill("0.3");
    await dashboard.getByTestId("track-audio-threshold-high").fill("0.4");
    await dashboard.getByText("Close", { exact: true }).click();
    await expect(dashboard.locator("text=EDIT TRACK")).toBeHidden();
    await dashboard.getByRole("button", { name: "CLOSE" }).click();

    await expect
      .poll(
        async () => {
          try {
            const ud = await readUserData(dir);
            return {
              type: getNested(ud, ["config", "input", "type"]),
              sequencerMode: getNested(ud, ["config", "sequencerMode"]),
              audioSignal: getNested(findTrackByName(ud, "Intermediate"), ["signal", "audio"]),
            };
          } catch {
            return null;
          }
        },
        { timeout: 30_000 }
      )
      .toEqual({
        type: "audio",
        sequencerMode: false,
        audioSignal: { thresholds: { low: 0.2, medium: 0.3, high: 0.4 }, minIntervalMs: 250 },
      });

    await clearInputEvents(dashboard);
    await clearInputStatuses(dashboard);

    await dashboard.evaluate(() => {
      globalThis.nwWrldBridge?.testing?.audio?.emitBand?.({ channelName: "low", velocity: 1 });
    });

    await expect
      .poll(
        async () => {
          const events = await getInputEvents(dashboard);
          return events.some((e) => {
            if (e.type !== "method-trigger") return false;
            const d =
              e.data && typeof e.data === "object" ? (e.data as Record<string, unknown>) : null;
            return d?.source === "audio" && d?.channelName === "low";
          });
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await app.close();
    app = await launchNwWrld({ projectDir: dir, env: { NW_WRLD_TEST_AUDIO_MOCK: "1" } });
    await app.firstWindow();

    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const windows2 = app.windows();
    const dashboard2 = windows2.find((w) => w.url().includes("dashboard.html")) || windows2[0];
    await waitForProjectReady(dashboard2);

    await dashboard2.getByText("SETTINGS", { exact: true }).click();
    await expect(dashboard2.locator("#signal-external-audio")).toBeVisible();
    await expect(dashboard2.locator("#signal-external-audio")).toBeChecked();
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
