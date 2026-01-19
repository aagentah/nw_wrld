import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";

const waitForProjectReady = async (page: import("playwright").Page) => {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.waitForLoadState("load");
      await page.waitForFunction(
        () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
        undefined,
        { timeout: 15_000 }
      );
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Execution context was destroyed") && attempt < maxAttempts - 1) {
        continue;
      }
      throw err;
    }
  }
};

const readUserData = async (projectDir: string) => {
  const userDataPath = path.join(projectDir, "nw_wrld_data", "json", "userData.json");
  const raw = await fs.readFile(userDataPath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const getNested = (obj: unknown, keys: string[]): unknown => {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
};

test("External OSC config persists across relaunch (type + port)", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir });

  const oscPort = 9123;

  try {
    await app.firstWindow();

    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const windows = app.windows();
    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];

    await waitForProjectReady(dashboard);

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await expect(dashboard.locator("#signal-external-osc")).toBeVisible();
    await dashboard.locator('label[for="signal-external-osc"]').click();
    await expect(dashboard.locator("#oscPort")).toBeVisible();
    await dashboard.locator("#oscPort").fill(String(oscPort));

    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("#oscPort")).toBeHidden();

    await expect
      .poll(
        async () => {
          try {
            const ud = await readUserData(dir);
            if (!isPlainObject(ud)) return null;
            const type = getNested(ud, ["config", "input", "type"]);
            const port = getNested(ud, ["config", "input", "port"]);
            const sequencerMode = getNested(ud, ["config", "sequencerMode"]);
            return { type, port, sequencerMode };
          } catch {
            return null;
          }
        },
        { timeout: 30_000 }
      )
      .toEqual({ type: "osc", port: oscPort, sequencerMode: false });

    await app.close();
    app = await launchNwWrld({ projectDir: dir });
    await app.firstWindow();

    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const windows2 = app.windows();
    const dashboard2 = windows2.find((w) => w.url().includes("dashboard.html")) || windows2[0];
    await waitForProjectReady(dashboard2);

    await dashboard2.getByText("SETTINGS", { exact: true }).click();
    await expect(dashboard2.locator("#signal-external-osc")).toBeVisible();
    await expect(dashboard2.locator("#signal-external-osc")).toBeChecked();
    await expect(dashboard2.locator("#oscPort")).toHaveValue(String(oscPort));
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

