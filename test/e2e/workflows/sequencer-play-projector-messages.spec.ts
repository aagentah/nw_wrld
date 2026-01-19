import { test, expect } from "@playwright/test";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installProjectorMessageBuffer,
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

test("sequencer PLAY triggers dashboard-to-projector channel-trigger messaging", async () => {
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
    await dashboard.locator('input[placeholder="My Performance Track"]').fill(trackName);
    await dashboard.getByText("Create Track", { exact: true }).click();
    await expect(dashboard.locator('input[placeholder="My Performance Track"]')).toBeHidden();

    await dashboard.getByText("MODULE", { exact: true }).click();
    const addButtons = dashboard.getByTestId("add-module-to-track");
    await expect(addButtons.first()).toBeVisible();
    await addButtons.first().click();
    await expect(dashboard.getByTestId("add-module-to-track").first()).toBeHidden();

    await dashboard.getByTestId("track-add-channel").click();

    await expect(
      dashboard.locator(
        `[data-testid="sequencer-step"][data-channel-number="1"][data-step-index="0"]`
      )
    ).toBeVisible();

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await dashboard.locator('label[for="signal-sequencer"]').click();
    await dashboard.getByText("CLOSE", { exact: true }).click();

    const step = dashboard.locator(
      `[data-testid="sequencer-step"][data-channel-number="1"][data-step-index="0"]`
    );
    await step.click();
    await expect(step).toHaveAttribute("aria-pressed", "true");

    await expect(dashboard.getByTestId("sequencer-play-toggle")).toBeEnabled();
    await dashboard.getByTestId("sequencer-play-toggle").click();

    await expect
      .poll(
        async () => {
          const msgs = await getProjectorMessages(projector);
          return msgs.some(
            (m) => m.type === "channel-trigger" && m.props && m.props.channelName === "1"
          );
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await dashboard.getByTestId("sequencer-play-toggle").click();
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
