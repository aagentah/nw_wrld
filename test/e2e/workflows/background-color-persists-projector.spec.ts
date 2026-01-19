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

const readUserData = async (projectDir: string) => {
  const userDataPath = path.join(projectDir, "nw_wrld_data", "json", "userData.json");
  const raw = await fs.readFile(userDataPath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const getNestedString = (obj: unknown, keys: string[]): string | null => {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "string" ? cur : null;
};

const parseRgb = (s: string): [number, number, number] | null => {
  const m = String(s || "").match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

const getDashboardAndProjectorWindows = async (app: import("playwright").ElectronApplication) => {
  await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

  const windows = app.windows();
  const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
  const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];
  if (!dashboard || !projector) {
    throw new Error("Expected both dashboard and projector windows to exist.");
  }
  return { dashboard, projector };
};

test("background color persists to userData.json and applies to projector DOM (relaunch)", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir });

  const selectedBgColorId = "black";
  const expectedRgb: [number, number, number] = [0, 0, 0];

  try {
    await app.firstWindow();

    const { dashboard, projector } = await getDashboardAndProjectorWindows(app);
    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    const bgSelect = dashboard.locator("#bgColor");
    await expect(bgSelect).toBeVisible();
    await expect(bgSelect.locator('option[value="black"]')).toHaveCount(1);
    await bgSelect.selectOption(selectedBgColorId);
    await dashboard.getByText("CLOSE", { exact: true }).click();

    await expect
      .poll(
        async () => {
          try {
            const userData = await readUserData(dir);
            return getNestedString(userData, ["config", "bgColor"]);
          } catch {
            return null;
          }
        },
        { timeout: 30_000 }
      )
      .toBe(selectedBgColorId);

    await expect
      .poll(
        async () => {
          try {
            const color = await projector.evaluate(() => {
              return getComputedStyle(document.documentElement).backgroundColor || "";
            });
            const rgb = parseRgb(color);
            return rgb ? rgb.join(",") : null;
          } catch {
            return null;
          }
        },
        { timeout: 15_000 }
      )
      .toBe(expectedRgb.join(","));

    await app.close();
    app = await launchNwWrld({ projectDir: dir });
    await app.firstWindow();

    const { dashboard: dashboard2, projector: projector2 } =
      await getDashboardAndProjectorWindows(app);
    await waitForProjectReady(dashboard2);
    await waitForProjectReady(projector2);

    await expect
      .poll(
        async () => {
          try {
            const userData = await readUserData(dir);
            return getNestedString(userData, ["config", "bgColor"]);
          } catch {
            return null;
          }
        },
        { timeout: 30_000 }
      )
      .toBe(selectedBgColorId);

    await expect
      .poll(
        async () => {
          try {
            const color = await projector2.evaluate(() => {
              return getComputedStyle(document.documentElement).backgroundColor || "";
            });
            const rgb = parseRgb(color);
            return rgb ? rgb.join(",") : null;
          } catch {
            return null;
          }
        },
        { timeout: 15_000 }
      )
      .toBe(expectedRgb.join(","));
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
