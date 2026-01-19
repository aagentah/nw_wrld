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

const getWindows = async (app: import("playwright").ElectronApplication) => {
  let windows = app.windows();
  if (windows.length < 2) {
    try {
      await app.waitForEvent("window", { timeout: 15_000 });
    } catch {}
    windows = app.windows();
  }
  return windows;
};

const getDashboardWindow = async (app: import("playwright").ElectronApplication) => {
  const windows = await getWindows(app);
  return windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
};

const readJson = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as unknown;
};

test("corrupted userData.json (invalid JSON) is backed up and app recovers without crashing", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const jsonDir = path.join(dir, "nw_wrld_data", "json");
  const userDataPath = path.join(jsonDir, "userData.json");
  await fs.mkdir(jsonDir, { recursive: true });
  await fs.writeFile(userDataPath, "{not json", "utf-8");

  const app = await launchNwWrld({ projectDir: dir });
  try {
    await app.firstWindow();
    const dashboard = await getDashboardWindow(app);
    await waitForProjectReady(dashboard);

    const suffix = String(Date.now());
    const setName = `Recovered Set ${suffix}`;

    await dashboard.getByText("SETS", { exact: true }).click();
    await dashboard.getByText("Create Set", { exact: true }).click();
    await dashboard.locator("#set-name").fill(setName);
    await dashboard.getByText("Create Set", { exact: true }).click();
    await expect(dashboard.locator("#set-name")).toBeHidden();

    await expect
      .poll(
        async () => {
          try {
            const files = await fs.readdir(jsonDir);
            return files.some((f) => String(f).startsWith("userData.json.corrupt."));
          } catch {
            return false;
          }
        },
        { timeout: 10_000 }
      )
      .toBe(true);

    await expect
      .poll(
        async () => {
          try {
            const userData = await readJson(userDataPath);
            if (!userData || typeof userData !== "object") return false;
            const sets = (userData as Record<string, unknown>).sets;
            if (!Array.isArray(sets)) return false;
            return sets.some(
              (s) =>
                Boolean(s) &&
                typeof s === "object" &&
                (s as Record<string, unknown>).name === setName
            );
          } catch {
            return false;
          }
        },
        { timeout: 30_000 }
      )
      .toBe(true);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

test("userData.json missing required fields is sanitized and app remains usable", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const jsonDir = path.join(dir, "nw_wrld_data", "json");
  const userDataPath = path.join(jsonDir, "userData.json");
  await fs.mkdir(jsonDir, { recursive: true });
  await fs.writeFile(userDataPath, JSON.stringify({}, null, 2), "utf-8");

  const app = await launchNwWrld({ projectDir: dir });
  try {
    await app.firstWindow();
    const dashboard = await getDashboardWindow(app);
    await waitForProjectReady(dashboard);

    await dashboard.getByText("SETS", { exact: true }).click();
    await expect(dashboard.getByText("Create Set", { exact: true })).toBeVisible();

    const readResult = await dashboard.evaluate(async () => {
      const fallback = { config: {}, sets: [{ id: "set_1", name: "Set 1", tracks: [] }] };
      const g = globalThis as unknown as { nwWrldAppBridge?: { json?: { read?: unknown } } };
      const read = g.nwWrldAppBridge?.json?.read;
      if (typeof read !== "function") return null;
      return await read("userData.json", fallback);
    });
    expect(readResult).toBeTruthy();
    const sets = (readResult as { sets?: unknown }).sets;
    expect(Array.isArray(sets)).toBe(true);
    expect(
      (sets as unknown[]).some(
        (s) =>
          Boolean(s) && typeof s === "object" && (s as Record<string, unknown>).name === "Set 1"
      )
    ).toBe(true);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
