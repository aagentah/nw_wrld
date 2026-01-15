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

test("invalid module file handling: syntax error marks module failed; other modules still work", async () => {
  const { dir, cleanup } = await createTestWorkspace();

  const badId = "BadSyntax";
  const badModulePath = path.join(dir, "modules", `${badId}.js`);
  await fs.mkdir(path.dirname(badModulePath), { recursive: true });
  await fs.writeFile(
    badModulePath,
    `/*
@nwWrld name: ${badId}
@nwWrld category: Test
@nwWrld imports: ModuleBase
*/

class ${badId} extends ModuleBase {
  static methods = [];
  constructor(container) {
    super(container);
`,
    "utf-8"
  );

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
    await waitForProjectReady(dashboard);

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
    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();

    await dashboard.getByTestId("track-add-module").click();

    const addBadModule = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${badId}"]`
    );
    await expect(addBadModule).toBeVisible();

    const badRow = dashboard.locator("div.group").filter({ has: addBadModule }).first();
    const badPreviewTarget = badRow
      .locator('[title="Preview module"], [title="Loading preview..."]')
      .first()
      .locator("xpath=..");
    await expect(badPreviewTarget).toBeVisible();

    await clearDashboardMessages(dashboard);
    await badPreviewTarget.hover();

    const failedIcon = dashboard.locator(
      `[data-testid="module-load-failed"][data-module-name="${badId}"]`
    );
    await expect
      .poll(
        async () => {
          const msgs = await getDashboardMessages(dashboard);
          const status = msgs.find((m) => m.type === "module-introspect-result") || null;
          if (!status) return "pending";
          if (status.props?.moduleId === badId && status.props?.ok === false) return "failed";
          return "other";
        },
        { timeout: 20_000 }
      )
      .toBe("failed");

    await expect(failedIcon).toBeVisible({ timeout: 20_000 });

    await failedIcon.hover();
    await expect(
      dashboard.getByText(`Module "${badId}.js" exists in your workspace but failed to load.`, {
        exact: false,
      })
    ).toBeVisible();

    const goodId = "Text";
    const addGoodModule = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${goodId}"]`
    );
    await expect(addGoodModule).toBeVisible();

    const goodRow = dashboard.locator("div.group").filter({ has: addGoodModule }).first();
    const goodPreviewTarget = goodRow
      .locator('[title="Preview module"], [title="Loading preview..."]')
      .first()
      .locator("xpath=..");
    await expect(goodPreviewTarget).toBeVisible();

    await clearDashboardMessages(dashboard);
    await goodPreviewTarget.hover();

    await expect
      .poll(
        async () => {
          const msgs = await getDashboardMessages(dashboard);
          const gotReady = msgs.some(
            (x) => x.type === "preview-module-ready" && x.props?.moduleName === goodId
          );
          const gotError = msgs.some(
            (x) => x.type === "preview-module-error" && x.props?.moduleName === goodId
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
