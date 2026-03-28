import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
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

test("workspace watcher: module change re-initializes active track (no projector page reload)", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  try {
    const suffix = String(Date.now());
    const setName = `E2E Set ${suffix}`;
    const trackName = `E2E Track ${suffix}`;

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

    await expect(dashboard.getByText("SETS", { exact: true })).toBeVisible({ timeout: 15_000 });

    await installDashboardMessageBuffer(dashboard);

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
      const tracksModal = dashboard
        .locator("div.fixed")
        .filter({ hasText: "Select Active Track:" })
        .first();
      if (await tracksModal.isVisible()) {
        await tracksModal.getByText("CLOSE", { exact: true }).click();
      }
      await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();
    }

    await dashboard.getByTestId("track-add-module").click();
    const addTextModule = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="Text"]`
    );
    await expect(addTextModule).toBeVisible({ timeout: 15_000 });
    await addTextModule.click();
    await expect(addTextModule).toBeHidden();

    await expect
      .poll(
        async () => {
          const msgs = await getDashboardMessages(dashboard);
          return msgs.some(
            (m) => m.type === "workspace-modules-loaded" && m.props?.trackName === trackName
          );
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await clearDashboardMessages(dashboard);

    const moduleId = `E2EHotRefresh${String(Date.now())}`;
    const modulePath = path.join(dir, "modules", `${moduleId}.js`);
    await fs.mkdir(path.dirname(modulePath), { recursive: true });

    await fs.writeFile(
      modulePath,
      `/*
@nwWrld name: ${moduleId}
@nwWrld category: Test
@nwWrld imports: ModuleBase
*/

class ${moduleId} extends ModuleBase {
  static methods = [];
  constructor(container) {
    super(container);
    this.name = ${moduleId}.name;
  }
}

export default ${moduleId};
`,
      "utf-8"
    );

    await expect
      .poll(
        async () => {
          const msgs = await getDashboardMessages(dashboard);
          return msgs.some(
            (m) => m.type === "workspace-modules-loaded" && m.props?.trackName === trackName
          );
        },
        { timeout: 20_000 }
      )
      .toBe(true);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

