import { test, expect } from "@playwright/test";

import * as fs from "node:fs";
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

test("randomization range respects option min/max and allows negatives when unbounded", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const modulesDir = path.join(dir, "modules");
  await fs.promises.mkdir(modulesDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(modulesDir, "BoundedRandomNumber.js"),
    `/*
@nwWrld name: BoundedRandomNumber
@nwWrld category: Test
@nwWrld imports: ModuleBase
*/

class BoundedRandomNumber extends ModuleBase {
  static methods = [
    ...ModuleBase.methods,
    {
      name: "bounded",
      executeOnLoad: false,
      options: [
        {
          name: "n",
          defaultVal: 0.5,
          type: "number",
          min: 0,
          max: 1,
          allowRandomization: true,
        },
      ],
    },
    {
      name: "unbounded",
      executeOnLoad: false,
      options: [
        {
          name: "x",
          defaultVal: 0,
          type: "number",
          allowRandomization: true,
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
  }
}

export default BoundedRandomNumber;
`,
    "utf-8"
  );
  const app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackName = `E2E Track ${suffix}`;
  const moduleName = "BoundedRandomNumber";

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

    await dashboard.getByText("TRACKS", { exact: true }).click();
    const trackLabel = dashboard.locator("label").filter({ hasText: trackName }).first();
    await expect(trackLabel).toBeVisible();
    await trackLabel.click();
    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("text=Select Active Track:")).toBeHidden();

    await dashboard.getByTestId("track-add-module").click();
    const addModule = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${moduleName}"]`
    );
    await expect(addModule).toBeVisible();
    await addModule.click();
    await expect(addModule).toBeHidden();

    await dashboard.getByTestId("track-add-channel").click();

    const channelConfig = dashboard.locator(
      `[data-testid="module-channel-config"][data-channel-key="1"]`
    );
    await expect(channelConfig).toBeVisible();
    await channelConfig.click();

    const addBoundedSelect = dashboard
      .getByTestId("method-add-select")
      .filter({ has: dashboard.locator('option[value="bounded"]') })
      .first();
    await expect(addBoundedSelect).toBeVisible();
    await addBoundedSelect.selectOption("bounded");

    const addUnboundedSelect = dashboard
      .getByTestId("method-add-select")
      .filter({ has: dashboard.locator('option[value="unbounded"]') })
      .first();
    await expect(addUnboundedSelect).toBeVisible();
    await addUnboundedSelect.selectOption("unbounded");

    const boundedValueInput = dashboard.locator(
      `[data-testid="method-option-input"][data-method-name="bounded"][data-option-name="n"]`
    );
    await expect(boundedValueInput).toBeVisible();
    const boundedRow = boundedValueInput.locator("xpath=ancestor::div[1]");
    await boundedRow.locator('svg:has(title:has-text("Toggle Randomization"))').click();

    const boundedRandomMin = dashboard.locator(
      `[data-testid="method-option-input"][data-method-name="bounded"][data-option-name="n:randomMin"]`
    );
    const boundedRandomMax = dashboard.locator(
      `[data-testid="method-option-input"][data-method-name="bounded"][data-option-name="n:randomMax"]`
    );
    await expect(boundedRandomMin).toBeVisible();
    await expect(boundedRandomMax).toBeVisible();

    await boundedRandomMin.fill("-1");
    await boundedRandomMin.press("Enter");
    await expect(boundedRandomMin).toHaveValue("0");

    await boundedRandomMax.fill("2");
    await boundedRandomMax.press("Enter");
    await expect(boundedRandomMax).toHaveValue("1");

    const unboundedValueInput = dashboard.locator(
      `[data-testid="method-option-input"][data-method-name="unbounded"][data-option-name="x"]`
    );
    await expect(unboundedValueInput).toBeVisible();
    const unboundedRow = unboundedValueInput.locator("xpath=ancestor::div[1]");
    await unboundedRow.locator('svg:has(title:has-text("Toggle Randomization"))').click();

    const unboundedRandomMin = dashboard.locator(
      `[data-testid="method-option-input"][data-method-name="unbounded"][data-option-name="x:randomMin"]`
    );
    await expect(unboundedRandomMin).toBeVisible();
    await unboundedRandomMin.fill("-10");
    await unboundedRandomMin.press("Enter");
    await expect(unboundedRandomMin).toHaveValue("-10");
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

