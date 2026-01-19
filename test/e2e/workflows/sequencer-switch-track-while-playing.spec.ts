import { test, expect } from "@playwright/test";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installProjectorMessageBuffer,
  clearProjectorMessages,
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

const selectActiveTrack = async (page: import("playwright").Page, trackName: string) => {
  await page.getByText("TRACKS", { exact: true }).click();
  const label = page.locator("label").filter({ hasText: trackName }).first();
  await expect(label).toBeVisible();
  await label.click();
};

const addModuleAndTwoChannels = async (page: import("playwright").Page) => {
  await page.getByText("MODULE", { exact: true }).click();
  const addButtons = page.getByTestId("add-module-to-track");
  await expect(addButtons.first()).toBeVisible();
  await addButtons.first().click();
  await expect(page.getByTestId("add-module-to-track").first()).toBeHidden();

  await page.getByTestId("track-add-channel").click();
  await page.getByTestId("track-add-channel").click();

  await expect(
    page.locator(`[data-testid="sequencer-step"][data-channel-number="2"][data-step-index="0"]`)
  ).toBeVisible();
};

const enableSequencerMode = async (page: import("playwright").Page) => {
  await page.getByText("SETTINGS", { exact: true }).click();
  await page.locator('label[for="signal-sequencer"]').click();
  await page.getByText("CLOSE", { exact: true }).click();
};

test("switch active track while playing reroutes sequencer triggers", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackA = `E2E Track A ${suffix}`;
  const trackB = `E2E Track B ${suffix}`;

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
    const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];
    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);
    await installProjectorMessageBuffer(projector);

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

    await enableSequencerMode(dashboard);

    await selectActiveTrack(dashboard, trackA);
    await addModuleAndTwoChannels(dashboard);
    await dashboard
      .locator(`[data-testid="sequencer-step"][data-channel-number="1"][data-step-index="0"]`)
      .click();

    await selectActiveTrack(dashboard, trackB);
    await addModuleAndTwoChannels(dashboard);
    await dashboard
      .locator(`[data-testid="sequencer-step"][data-channel-number="2"][data-step-index="0"]`)
      .click();

    await selectActiveTrack(dashboard, trackA);
    await clearProjectorMessages(projector);
    await expect(dashboard.getByTestId("sequencer-play-toggle")).toBeEnabled();
    await dashboard.getByTestId("sequencer-play-toggle").click();

    await expect
      .poll(
        async () => {
          const msgs = await getProjectorMessages(projector);
          const triggers = msgs.filter((m) => m.type === "channel-trigger");
          return triggers.some((m) => m.props?.channelName === "1");
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await clearProjectorMessages(projector);
    await selectActiveTrack(dashboard, trackB);

    await expect
      .poll(
        async () => {
          const msgs = await getProjectorMessages(projector);
          const triggers = msgs.filter((m) => m.type === "channel-trigger");
          if (triggers.length === 0) return null;
          const has1 = triggers.some((m) => m.props?.channelName === "1");
          const has2 = triggers.some((m) => m.props?.channelName === "2");
          return { has1, has2 };
        },
        { timeout: 20_000 }
      )
      .toEqual({ has1: false, has2: true });

    await dashboard.getByTestId("sequencer-play-toggle").click();
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
