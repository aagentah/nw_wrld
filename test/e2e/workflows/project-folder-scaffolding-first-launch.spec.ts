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

const isDirectory = async (p: string) => {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
};

const isFile = async (p: string) => {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
};

test("project folder scaffolding on first launch into an empty dir", async () => {
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

    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    await waitForProjectReady(dashboard);

    const modulesDir = path.join(dir, "modules");

    const assetsDir = path.join(dir, "assets");
    const assetsJsonDir = path.join(assetsDir, "json");
    const assetsImagesDir = path.join(assetsDir, "images");
    const assetsModelsDir = path.join(assetsDir, "models");
    const assetsFontsDir = path.join(assetsDir, "fonts");

    const projectJsonDir = path.join(dir, "nw_wrld_data", "json");

    const readmePath = path.join(dir, "README.md");
    const moduleDevGuidePath = path.join(dir, "MODULE_DEVELOPMENT.md");

    await expect
      .poll(async () => {
        const ok =
          (await isDirectory(modulesDir)) &&
          (await isDirectory(assetsDir)) &&
          (await isDirectory(assetsJsonDir)) &&
          (await isDirectory(assetsImagesDir)) &&
          (await isDirectory(assetsModelsDir)) &&
          (await isDirectory(assetsFontsDir)) &&
          (await isDirectory(projectJsonDir)) &&
          (await isFile(readmePath)) &&
          (await isFile(moduleDevGuidePath));
        if (!ok) return false;

        try {
          const moduleEntries = await fs.readdir(modulesDir);
          const jsCount = moduleEntries.filter((f) => f.endsWith(".js")).length;
          if (jsCount <= 0) return false;

          const assetEntries = await Promise.all([
            fs.readdir(assetsJsonDir),
            fs.readdir(assetsImagesDir),
            fs.readdir(assetsModelsDir),
            fs.readdir(assetsFontsDir),
          ]);
          const anyAsset = assetEntries.some((x) => x.length > 0);
          return anyAsset;
        } catch {
          return false;
        }
      })
      .toBe(true);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

