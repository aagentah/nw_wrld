import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import { installInputStatusBuffer, clearInputStatuses, getInputStatuses } from "../fixtures/inputStatusBuffer";
import { installInputEventBuffer, clearInputEvents, getInputEvents } from "../fixtures/inputEventBuffer";

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

const makeWavSilence = (durationMs = 100, sampleRate = 44100) => {
  const numSamples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const bytesPerSample = 2;
  const numChannels = 1;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");

  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buf.writeUInt16LE(numChannels * bytesPerSample, 32);
  buf.writeUInt16LE(16, 34);

  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);

  return buf;
};

test("File Upload config persists across relaunch and mock file emits input-event", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir, env: { NW_WRLD_TEST_FILE_MOCK: "1" } });

  try {
    await app.firstWindow();
    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const windows = app.windows();
    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    await waitForProjectReady(dashboard);

    await installInputStatusBuffer(dashboard);
    await installInputEventBuffer(dashboard);

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await expect(dashboard.locator("#signal-file-upload")).toBeVisible();
    await dashboard.locator('label[for="signal-file-upload"]').click();

    await expect
      .poll(
        async () => {
          const statuses = await getInputStatuses(dashboard);
          return statuses.some((s) => s.status === "connected" && typeof s.message === "string" && s.message.includes("File"));
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    const wavPath = path.join(dir, "e2e-upload.wav");
    await fs.writeFile(wavPath, makeWavSilence());
    await dashboard.locator('[data-testid="file-upload-input"]').setInputFiles(wavPath);

    await expect
      .poll(
        async () => {
          try {
            const ud = await readUserData(dir);
            return {
              type: getNested(ud, ["config", "input", "type"]),
              sequencerMode: getNested(ud, ["config", "sequencerMode"]),
              relPath: getNested(ud, ["config", "input", "fileAssetRelPath"]),
            };
          } catch {
            return null;
          }
        },
        { timeout: 30_000 }
      )
      .toMatchObject({ type: "file", sequencerMode: false });

    const udAfter = await readUserData(dir);
    const relPath = getNested(udAfter, ["config", "input", "fileAssetRelPath"]);
    if (typeof relPath !== "string" || !relPath) {
      throw new Error("Expected config.input.fileAssetRelPath to be set");
    }
    const assetFullPath = path.join(dir, "assets", ...relPath.split("/"));
    await expect.poll(async () => {
      try {
        const st = await fs.stat(assetFullPath);
        return st.isFile();
      } catch {
        return false;
      }
    }, { timeout: 30_000 }).toBe(true);

    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("#signal-file-upload")).toBeHidden();

    // Spacebar should toggle file playback (same ergonomics as sequencer mode).
    const playToggle = dashboard.getByTestId("file-play-toggle");
    await expect(playToggle).toBeVisible();
    await expect(playToggle).toContainText("PLAY");

    await dashboard.keyboard.press("Space");
    await expect(playToggle).toContainText("STOP");

    await dashboard.keyboard.press("Space");
    await expect(playToggle).toContainText("PLAY");

    await clearInputEvents(dashboard);
    await clearInputStatuses(dashboard);

    await dashboard.evaluate(() => {
      globalThis.nwWrldBridge?.testing?.file?.emitBand?.({ channelName: "low", velocity: 1 });
    });

    await expect
      .poll(
        async () => {
          const events = await getInputEvents(dashboard);
          return events.some((e) => {
            if (e.type !== "method-trigger") return false;
            const d = e.data && typeof e.data === "object" ? (e.data as Record<string, unknown>) : null;
            return d?.source === "file" && d?.channelName === "low";
          });
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await app.close();
    app = await launchNwWrld({ projectDir: dir, env: { NW_WRLD_TEST_FILE_MOCK: "1" } });
    await app.firstWindow();

    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const windows2 = app.windows();
    const dashboard2 = windows2.find((w) => w.url().includes("dashboard.html")) || windows2[0];
    await waitForProjectReady(dashboard2);

    await dashboard2.getByText("SETTINGS", { exact: true }).click();
    await expect(dashboard2.locator("#signal-file-upload")).toBeVisible();
    await expect(dashboard2.locator("#signal-file-upload")).toBeChecked();
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

