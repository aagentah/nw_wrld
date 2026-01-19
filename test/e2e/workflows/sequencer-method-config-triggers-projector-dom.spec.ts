import { test, expect } from "@playwright/test";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installDashboardMessageBuffer,
  clearDashboardMessages,
  getDashboardMessages,
} from "../fixtures/dashboardMessageBuffer";
import {
  installProjectorMessageBuffer,
  getProjectorMessages,
  clearProjectorMessages,
} from "../fixtures/projectorMessageBuffer";

const waitForProjectReady = async (page: import("playwright").Page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
    undefined,
    { timeout: 15_000 }
  );
};

test("configure a channel method -> sequencer triggers method (projector DOM changes)", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackName = `E2E Track ${suffix}`;
  const moduleName = "Text";
  const expectedText = "E2E_ONE";

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
    await installDashboardMessageBuffer(dashboard);

    await dashboard.evaluate(() => {
      globalThis.nwWrldBridge?.messaging?.sendToProjector?.("debug-overlay-visibility", {
        isOpen: true,
      });
    });

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

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await dashboard.locator('label[for="signal-sequencer"]').click();
    await dashboard.getByText("CLOSE", { exact: true }).click();

    await dashboard.getByTestId("track-add-module").click();
    const addTextModule = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${moduleName}"]`
    );
    await expect(addTextModule).toBeVisible();
    await addTextModule.click();
    await expect(addTextModule).toBeHidden();

    await dashboard.getByTestId("track-add-channel").click();

    const step = dashboard.locator(
      `[data-testid="sequencer-step"][data-channel-number="1"][data-step-index="0"]`
    );
    await expect(step).toBeVisible();
    await step.click();
    await expect(step).toHaveAttribute("aria-pressed", "true");

    const channelConfig = dashboard.locator(
      `[data-testid="module-channel-config"][data-channel-key="1"]`
    );
    await expect(channelConfig).toBeVisible();
    await channelConfig.click();
    const instanceId = await channelConfig.getAttribute("data-module-instance-id");
    if (!instanceId) throw new Error("Could not resolve module instance id from UI");

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
    await expect(dashboard.locator("text=Text (Channel 1)")).toBeHidden();

    await expect(dashboard.getByTestId("sequencer-play-toggle")).toBeEnabled();
    await clearDashboardMessages(dashboard);
    await dashboard.getByTestId("sequencer-play-toggle").click();

    await expect
      .poll(
        async () => {
          const msgs = await getProjectorMessages(projector);
          const triggers = msgs.filter((m) => m.type === "channel-trigger");
          return triggers.some(
            (m) => m.props?.channelName === "ch1" || m.props?.channelName === "1"
          );
        },
        { timeout: 20_000 }
      )
      .toBe(true);

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

    await dashboard.getByTestId("sequencer-play-toggle").click();
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
