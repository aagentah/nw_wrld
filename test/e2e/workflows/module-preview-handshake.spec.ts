import { test, expect } from "@playwright/test";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installProjectorMessageBuffer,
  clearProjectorMessages,
  getProjectorMessages,
} from "../fixtures/projectorMessageBuffer";
import {
  installDashboardMessageBuffer,
  clearDashboardMessages,
  getDashboardMessages,
} from "../fixtures/dashboardMessageBuffer";

const waitForProjectReady = async (page: import("playwright").Page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
    undefined,
    { timeout: 15_000 }
  );
};

test("module preview handshake: dashboard -> projector (preview-module) -> dashboard (preview-module-ready)", async () => {
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

    expect(windows.length).toBeGreaterThanOrEqual(2);

    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];

    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);

    await installProjectorMessageBuffer(projector);
    await installDashboardMessageBuffer(dashboard);
    await clearProjectorMessages(projector);
    await clearDashboardMessages(dashboard);

    // Create set + track (ensures MODULE modal renders in add-to-track mode)
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

    const previewIcon = dashboard.locator('[title="Preview module"]').first();
    await expect(previewIcon).toBeVisible();
    await previewIcon.hover();

    let requestId: string | null = null;
    let moduleName: string | null = null;

    await expect
      .poll(
        async () => {
          const msgs = await getProjectorMessages(projector);
          const m = msgs.find(
            (x) =>
              x.type === "preview-module" &&
              typeof x.props?.requestId === "string" &&
              typeof x.props?.moduleName === "string"
          );
          requestId = (m?.props?.requestId as string) || null;
          moduleName = (m?.props?.moduleName as string) || null;
          return Boolean(requestId && moduleName);
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    if (!requestId || !moduleName) {
      throw new Error("Could not resolve preview-module requestId/moduleName from projector message buffer");
    }

    await expect
      .poll(
        async () => {
          const msgs = await getDashboardMessages(dashboard);
          const gotReady = msgs.some(
            (x) =>
              x.type === "preview-module-ready" &&
              x.props?.requestId === requestId &&
              x.props?.moduleName === moduleName
          );
          const gotError = msgs.some(
            (x) =>
              x.type === "preview-module-error" &&
              x.props?.requestId === requestId &&
              x.props?.moduleName === moduleName
          );
          if (gotError) return "error";
          if (gotReady) return "ready";
          return "pending";
        },
        { timeout: 25_000 }
      )
      .toBe("ready");
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

