import { test, expect } from "@playwright/test";

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

test("Settings external audio meters reflect active track thresholds", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir, env: { NW_WRLD_TEST_AUDIO_MOCK: "1" } });

  try {
    await app.firstWindow();
    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const windows = app.windows();
    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    await waitForProjectReady(dashboard);

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.locator("label").filter({ hasText: "Intermediate" }).first().click();

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await dashboard.locator('label[for="signal-external-audio"]').click();
    await dashboard.getByText("CLOSE", { exact: true }).click();

    await dashboard.getByTestId("dashboard-edit-track").click();
    await expect(dashboard.getByText("Close", { exact: true })).toBeVisible();
    await dashboard.getByTestId("track-audio-threshold-low").fill("0.21");
    await dashboard.getByTestId("track-audio-threshold-medium").fill("0.32");
    await dashboard.getByTestId("track-audio-threshold-high").fill("0.43");
    await dashboard.getByText("Close", { exact: true }).click();
    await expect(dashboard.locator("text=EDIT TRACK")).toBeHidden();

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await dashboard.locator('label[for="signal-external-audio"]').click();
    await expect(dashboard.getByTestId("settings-audio-threshold-meter-low")).toBeVisible();
    await expect(dashboard.getByTestId("settings-audio-threshold-value-low")).toHaveText("thr 0.21");
    await expect(dashboard.getByTestId("settings-audio-threshold-value-medium")).toHaveText(
      "thr 0.32"
    );
    await expect(dashboard.getByTestId("settings-audio-threshold-value-high")).toHaveText(
      "thr 0.43"
    );
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

test("Settings file meters reflect active track thresholds", async () => {
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

    await dashboard.getByText("TRACKS", { exact: true }).click();
    await dashboard.locator("label").filter({ hasText: "Intermediate" }).first().click();

    await dashboard.getByTestId("dashboard-edit-track").click();
    await expect(dashboard.getByText("Close", { exact: true })).toBeVisible();
    await dashboard.getByTestId("track-file-threshold-low").fill("0.44");
    await dashboard.getByTestId("track-file-threshold-medium").fill("0.55");
    await dashboard.getByTestId("track-file-threshold-high").fill("0.66");
    await dashboard.getByText("Close", { exact: true }).click();
    await expect(dashboard.locator("text=EDIT TRACK")).toBeHidden();

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await dashboard.locator('label[for="signal-file-upload"]').click();
    await expect(dashboard.getByTestId("settings-file-threshold-meter-low")).toBeVisible();
    await expect(dashboard.getByTestId("settings-file-threshold-value-low")).toHaveText("thr 0.44");
    await expect(dashboard.getByTestId("settings-file-threshold-value-medium")).toHaveText(
      "thr 0.55"
    );
    await expect(dashboard.getByTestId("settings-file-threshold-value-high")).toHaveText(
      "thr 0.66"
    );
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
