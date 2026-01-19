import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

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

test("workspace watcher hot-reload: new module file appears in MODULE list without relaunch", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

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

    const moduleId = "E2EHot";
    const modulePath = path.join(dir, "modules", `${moduleId}.js`);
    await fs.mkdir(path.dirname(modulePath), { recursive: true });

    await dashboard.getByText("MODULES", { exact: true }).click();

    const e2eHotAddButton = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${moduleId}"]`
    );
    await expect(e2eHotAddButton).toHaveCount(0);

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
      .poll(async () => (await e2eHotAddButton.count()) > 0, { timeout: 20_000 })
      .toBe(true);

    await expect(e2eHotAddButton.first()).toBeVisible();
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

