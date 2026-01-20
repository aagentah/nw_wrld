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

test("channels: min 3 prevents delete; max 12 disables add button", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackName = `E2E Track ${suffix}`;

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

    const channelConfig1 = dashboard.locator(
      `[data-testid="module-channel-config"][data-channel-key="1"]`
    );
    await expect(channelConfig1).toBeVisible();
    await channelConfig1.click();

    await expect(
      dashboard.locator('[aria-disabled="true"]', { hasText: "DELETE CHANNEL" })
    ).toBeVisible();

    const addChannelButton = dashboard.getByTestId("track-add-channel");
    await expect(addChannelButton).not.toHaveAttribute("aria-disabled", "true");

    await dashboard.getByText("CLOSE", { exact: true }).click();

    for (let i = 0; i < 9; i++) {
      await addChannelButton.click();
    }

    await expect(
      dashboard.locator(`[data-testid="module-channel-config"][data-channel-key="12"]`)
    ).toBeVisible();

    await expect(addChannelButton).toHaveAttribute("aria-disabled", "true");

    await addChannelButton.click();

    await expect(
      dashboard.locator(`[data-testid="module-channel-config"][data-channel-key="13"]`)
    ).toHaveCount(0);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

