import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";

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

const makeWavSilence = (durationMs = 120, sampleRate = 44100) => {
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

test("File Upload settings are stored per track (independent assets + tuning)", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  try {
    await app.firstWindow();
    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const windows = app.windows();
    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    await waitForProjectReady(dashboard);

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await dashboard.locator('label[for="signal-file-upload"]').click();
    await dashboard.getByText("CLOSE", { exact: true }).click();

    const wavAPath = path.join(dir, "e2e-upload-a.wav");
    const wavBPath = path.join(dir, "e2e-upload-b.wav");
    await fs.writeFile(wavAPath, makeWavSilence(80));
    await fs.writeFile(wavBPath, makeWavSilence(160));

    const configureTrack = async ({
      trackName,
      wavPath,
      cooldownMs,
      low,
      medium,
      high,
    }: {
      trackName: string;
      wavPath: string;
      cooldownMs: number;
      low: number;
      medium: number;
      high: number;
    }) => {
      await dashboard.getByText("TRACKS", { exact: true }).click();
      const row = dashboard.locator("label").filter({ hasText: trackName }).first().locator("..");
      await row.getByTestId("edit-track").click();
      await expect(dashboard.getByText("Close", { exact: true })).toBeVisible();
      await dashboard.getByTestId("track-file-cooldown").fill(String(cooldownMs));
      await dashboard.getByTestId("track-file-threshold-low").fill(String(low));
      await dashboard.getByTestId("track-file-threshold-medium").fill(String(medium));
      await dashboard.getByTestId("track-file-threshold-high").fill(String(high));
      await dashboard.getByTestId("track-file-upload-input").setInputFiles(wavPath);
      await expect(dashboard.getByText(path.basename(wavPath), { exact: true })).toBeVisible();
      await dashboard.getByText("Close", { exact: true }).click();
      await expect(dashboard.locator("text=EDIT TRACK")).toBeHidden();
      await dashboard.getByRole("button", { name: "CLOSE" }).click();
    };

    await configureTrack({
      trackName: "Intermediate",
      wavPath: wavAPath,
      cooldownMs: 111,
      low: 0.11,
      medium: 0.22,
      high: 0.33,
    });
    await configureTrack({
      trackName: "Starter",
      wavPath: wavBPath,
      cooldownMs: 222,
      low: 0.44,
      medium: 0.55,
      high: 0.66,
    });

    const playToggle = dashboard.getByTestId("file-play-toggle");
    await expect(playToggle).toBeVisible();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.locator("label").filter({ hasText: "Intermediate" }).first().click();
    await expect(playToggle).toBeEnabled();

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.locator("label").filter({ hasText: "Starter" }).first().click();
    await expect(playToggle).toBeEnabled();

    await expect
      .poll(
        async () => {
          try {
            const ud = await readUserData(dir);
            const tA = findTrackByName(ud, "Intermediate");
            const tB = findTrackByName(ud, "Starter");
            const relA = getNested(tA, ["signal", "file", "assetRelPath"]);
            const relB = getNested(tB, ["signal", "file", "assetRelPath"]);
            if (typeof relA !== "string" || !relA) return false;
            if (typeof relB !== "string" || !relB) return false;
            if (relA === relB) return false;

            const fA = getNested(tA, ["signal", "file"]);
            const fB = getNested(tB, ["signal", "file"]);
            if (!fA || typeof fA !== "object") return false;
            if (!fB || typeof fB !== "object") return false;

            const a = fA as Record<string, unknown>;
            const b = fB as Record<string, unknown>;

            const thrA = a.thresholds as Record<string, unknown>;
            const thrB = b.thresholds as Record<string, unknown>;
            if (!thrA || typeof thrA !== "object") return false;
            if (!thrB || typeof thrB !== "object") return false;

            return (
              a.minIntervalMs === 111 &&
              thrA.low === 0.11 &&
              thrA.medium === 0.22 &&
              thrA.high === 0.33 &&
              a.assetRelPath === relA &&
              a.assetName === "e2e-upload-a.wav" &&
              b.minIntervalMs === 222 &&
              thrB.low === 0.44 &&
              thrB.medium === 0.55 &&
              thrB.high === 0.66 &&
              b.assetRelPath === relB &&
              b.assetName === "e2e-upload-b.wav"
            );
          } catch {
            return false;
          }
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    const ud = await readUserData(dir);
    const tA = findTrackByName(ud, "Intermediate");
    const tB = findTrackByName(ud, "Starter");
    const relA = getNested(tA, ["signal", "file", "assetRelPath"]);
    const relB = getNested(tB, ["signal", "file", "assetRelPath"]);
    expect(typeof relA).toBe("string");
    expect(typeof relB).toBe("string");
    expect(relA).not.toBe(relB);
    expect(getNested(tA, ["signal", "file"])).toEqual({
      thresholds: { low: 0.11, medium: 0.22, high: 0.33 },
      minIntervalMs: 111,
      assetRelPath: relA,
      assetName: "e2e-upload-a.wav",
    });
    expect(getNested(tB, ["signal", "file"])).toEqual({
      thresholds: { low: 0.44, medium: 0.55, high: 0.66 },
      minIntervalMs: 222,
      assetRelPath: relB,
      assetName: "e2e-upload-b.wav",
    });

    if (typeof relA === "string" && relA) {
      await expect
        .poll(
          async () => {
            try {
              const st = await fs.stat(path.join(dir, "assets", ...relA.split("/")));
              return st.isFile();
            } catch {
              return false;
            }
          },
          { timeout: 30_000 }
        )
        .toBe(true);
    }
    if (typeof relB === "string" && relB) {
      await expect
        .poll(
          async () => {
            try {
              const st = await fs.stat(path.join(dir, "assets", ...relB.split("/")));
              return st.isFile();
            } catch {
              return false;
            }
          },
          { timeout: 30_000 }
        )
        .toBe(true);
    }
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
