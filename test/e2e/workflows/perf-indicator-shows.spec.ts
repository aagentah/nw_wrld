import { test, expect } from "@playwright/test";
import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installDashboardMessageBuffer,
  clearDashboardMessages,
  getDashboardMessages,
} from "../fixtures/dashboardMessageBuffer";

test("dashboard shows perf indicator after sandbox starts emitting stats", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  try {
    const suffix = String(Date.now());
    const setName = `E2E Set ${suffix}`;
    const trackName = `E2E Track ${suffix}`;

    const waitForProjectReady = async (page: import("playwright").Page) => {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForFunction(
        () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
        undefined,
        { timeout: 15_000 }
      );
    };

    await app.firstWindow();

    let windows = app.windows();
    if (windows.length < 2) {
      try {
        await app.waitForEvent("window", { timeout: 15_000 });
      } catch {}
      windows = app.windows();
    }

    expect(windows.length).toBeGreaterThanOrEqual(2);

    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];

    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);

    await installDashboardMessageBuffer(dashboard);
    await clearDashboardMessages(dashboard);

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
    {
      const tracksModal = dashboard.locator("div.fixed").filter({ hasText: "Select Active Track:" }).first();
      if (await tracksModal.isVisible()) {
        await tracksModal.getByText("CLOSE", { exact: true }).click();
      }
      await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();
    }

    await dashboard.getByTestId("track-add-module").click();
    const addTextModule = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="Text"]`
    );
    await expect(addTextModule).toBeVisible();
    await addTextModule.click();
    await expect(addTextModule).toBeHidden();

    const ensureRes = await projector.evaluate(async () => {
      const ensure = globalThis.nwWrldBridge?.sandbox?.ensure;
      if (typeof ensure !== "function") return null;
      return await ensure();
    });
    expect((ensureRes as { ok?: unknown } | null)?.ok).toBe(true);

    await expect
      .poll(
        async () => {
          const msgs = await getDashboardMessages(dashboard);
          return msgs.some((m) => m.type === "perf:stats");
        },
        { timeout: 60_000 }
      )
      .toBe(true);

    await dashboard.getByText("DEBUG", { exact: true }).click();

    await expect(dashboard.locator('[data-testid="debug-perf-indicator"]')).toHaveText(
      /^FPS\s+\d+\s+·\s+\d+ms$/,
      { timeout: 30_000 }
    );
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

