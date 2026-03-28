import { test, expect } from "@playwright/test";

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

test("randomization dice shows for number option when allowRandomization is true", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackName = `E2E Track ${suffix}`;
  const moduleName = "SpinningCube";

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

    await dashboard.getByText("TRACKS", { exact: true }).click();
    const trackLabel = dashboard.locator("label").filter({ hasText: trackName }).first();
    await expect(trackLabel).toBeVisible();
    await trackLabel.click();
    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();

    await dashboard.getByTestId("track-add-module").click();
    const addModule = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${moduleName}"]`
    );
    await expect(addModule).toBeVisible();
    await addModule.click();
    await expect(addModule).toBeHidden();

    await dashboard.getByTestId("track-add-channel").click();

    const channelConfig = dashboard.locator(
      `[data-testid="module-channel-config"][data-channel-key="1"]`
    );
    await expect(channelConfig).toBeVisible();
    await channelConfig.click();

    const addSelect = dashboard
      .getByTestId("method-add-select")
      .filter({ has: dashboard.locator('option[value="zoomLevel"]') })
      .first();
    await expect(addSelect).toBeVisible();
    await addSelect.selectOption("zoomLevel");

    const zoomInput = dashboard.locator(
      `[data-testid="method-option-input"][data-method-name="zoomLevel"][data-option-name="zoomLevel"]`
    );
    await expect(zoomInput).toBeVisible();

    const zoomOptionRow = zoomInput.locator("xpath=ancestor::div[1]");
    await expect(
      zoomOptionRow.locator('svg:has(title:has-text("Toggle Randomization"))')
    ).toBeVisible();
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

