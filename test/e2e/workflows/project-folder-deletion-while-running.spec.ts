import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";

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

const waitForProjectLost = async (page: import("playwright").Page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === false,
    undefined,
    { timeout: 15_000 }
  );
};

const reloadWithRetry = async (page: import("playwright").Page) => {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
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

test("deleting the project folder while running prompts on reload (no crash)", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  let movedDir: string | null = null;

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

    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      movedDir = `${dir}-moved`;
      try {
        await fs.rename(dir, movedDir);
      } catch {
        movedDir = null;
      }
    }

    await reloadWithRetry(dashboard);
    await waitForProjectLost(dashboard);

    await expect(dashboard.getByText("PROJECT FOLDER NOT FOUND", { exact: true })).toBeVisible();
    await expect(dashboard.getByText("REOPEN PROJECT", { exact: true })).toBeVisible();

    const isAvailable = await dashboard.evaluate(
      () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() ?? null
    );
    expect(isAvailable).toBe(false);
  } finally {
    try {
      await app.close();
    } catch {}
    if (movedDir) {
      try {
        await fs.rm(movedDir, { recursive: true, force: true });
      } catch {}
    }
    await cleanup();
  }
});

