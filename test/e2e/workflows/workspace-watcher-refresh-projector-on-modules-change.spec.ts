import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

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

test("workspace watcher: module change triggers dashboard -> projector refresh-projector", async () => {
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
    const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];

    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);

    await expect(dashboard.getByText("SETS", { exact: true })).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(
        async () => {
          await installProjectorMessageBuffer(projector);
          return await projector.evaluate(() => {
            const anyGlobal = globalThis as unknown as {
              __nwWrldE2EProjector?: { installed?: unknown };
            };
            return anyGlobal.__nwWrldE2EProjector?.installed === true;
          });
        },
        { timeout: 15_000 }
      )
      .toBe(true);

    await clearProjectorMessages(projector);

    await dashboard.getByTestId("track-add-module").click();
    await expect(dashboard.getByTestId("add-module-to-track").first()).toBeVisible({
      timeout: 15_000,
    });

    await clearProjectorMessages(projector);

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
          const msgs = await getProjectorMessages(projector);
          return msgs.some((m) => m.type === "refresh-projector");
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

