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

const _asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const readJson = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const readUserData = async (projectDir: string) => {
  return await readJson(path.join(projectDir, "nw_wrld_data", "json", "userData.json"));
};

const readRecordingData = async (projectDir: string) => {
  return await readJson(path.join(projectDir, "nw_wrld_data", "json", "recordingData.json"));
};

test("sequencer pattern persists (recordingData.json) and BPM persists (userData.json) across relaunch", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackName = `E2E Track ${suffix}`;
  const bpm = 93;

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

    await dashboard.getByText("MODULE", { exact: true }).click();
    const addButtons = dashboard.getByTestId("add-module-to-track");
    await expect(addButtons.first()).toBeVisible();
    await addButtons.first().click();
    await expect(dashboard.getByTestId("add-module-to-track").first()).toBeHidden();

    await dashboard.getByTestId("track-add-channel").click();
    await dashboard.getByTestId("track-add-channel").click();

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await dashboard.locator('label[for="signal-sequencer"]').click();
    const bpmInput = dashboard.getByTestId("sequencer-bpm-input");
    await expect(bpmInput).toBeVisible();
    await bpmInput.fill(String(bpm));
    await dashboard.getByText("CLOSE", { exact: true }).click();

    const t10 = dashboard.locator(
      `[data-testid="sequencer-step"][data-channel-number="1"][data-step-index="0"]`
    );
    const t15 = dashboard.locator(
      `[data-testid="sequencer-step"][data-channel-number="1"][data-step-index="5"]`
    );
    const t22 = dashboard.locator(
      `[data-testid="sequencer-step"][data-channel-number="2"][data-step-index="2"]`
    );
    await expect(t10).toBeVisible();
    await t10.click();
    await t15.click();
    await t22.click();
    await expect(t10).toHaveAttribute("aria-pressed", "true");
    await expect(t15).toHaveAttribute("aria-pressed", "true");
    await expect(t22).toHaveAttribute("aria-pressed", "true");

    const expectedPattern: Record<string, number[]> = {
      "1": [0, 5],
      "2": [2],
    };

    await expect
      .poll(
        async () => {
          try {
            const rec = await readRecordingData(dir);
            if (!isPlainObject(rec)) return false;
            const recordings = isPlainObject(rec.recordings) ? rec.recordings : null;
            if (!recordings) return false;

            const matchAnyTrack = Object.values(recordings).some((trackRec) => {
              if (!isPlainObject(trackRec)) return false;
              const sequencer = isPlainObject(trackRec.sequencer) ? trackRec.sequencer : null;
              if (!sequencer) return false;
              const pattern = isPlainObject(sequencer.pattern) ? sequencer.pattern : null;
              if (!pattern) return false;
              const p1 = pattern["1"];
              const p2 = pattern["2"];
              if (!Array.isArray(p1) || !Array.isArray(p2)) return false;
              const got1 = [...p1].sort((a, b) => a - b);
              const got2 = [...p2].sort((a, b) => a - b);
              return (
                got1.length === expectedPattern["1"].length &&
                got1.every((n, i) => n === expectedPattern["1"][i]) &&
                got2.length === expectedPattern["2"].length &&
                got2.every((n, i) => n === expectedPattern["2"][i])
              );
            });

            return matchAnyTrack;
          } catch {
            return false;
          }
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    await expect
      .poll(
        async () => {
          try {
            const userData = await readUserData(dir);
            if (!isPlainObject(userData)) return false;
            const config = isPlainObject(userData.config) ? userData.config : null;
            return Boolean(config && config.sequencerBpm === bpm);
          } catch {
            return false;
          }
        },
        { timeout: 30_000 }
      )
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

    const r10 = dashboard2.locator(
      `[data-testid="sequencer-step"][data-channel-number="1"][data-step-index="0"]`
    );
    const r15 = dashboard2.locator(
      `[data-testid="sequencer-step"][data-channel-number="1"][data-step-index="5"]`
    );
    const r22 = dashboard2.locator(
      `[data-testid="sequencer-step"][data-channel-number="2"][data-step-index="2"]`
    );
    await expect(r10).toHaveAttribute("aria-pressed", "true");
    await expect(r15).toHaveAttribute("aria-pressed", "true");
    await expect(r22).toHaveAttribute("aria-pressed", "true");

    await dashboard2.getByText("SETTINGS", { exact: true }).click();
    await expect(dashboard2.getByTestId("sequencer-bpm-input")).toHaveValue(String(bpm));
    await dashboard2.getByText("CLOSE", { exact: true }).click();
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
