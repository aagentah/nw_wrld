import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ElectronApplication } from "playwright";

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

const getProjectorContentBounds = async (
  app: ElectronApplication
): Promise<{ width: number; height: number } | null> => {
  return await app.evaluate(({ BrowserWindow }) => {
    try {
      const wins = BrowserWindow.getAllWindows();
      const projector = wins.find((w) => {
        try {
          const url = w.webContents?.getURL?.() || "";
          return url.includes("projector.html") || w.getTitle() === "Projector 1";
        } catch {
          return false;
        }
      });
      if (!projector) return null;
      try {
        const b = projector.getContentBounds();
        return { width: b.width, height: b.height };
      } catch {
        const b = projector.getBounds();
        return { width: b.width, height: b.height };
      }
    } catch {
      return null;
    }
  });
};

const getDashboardAndProjectorWindows = async (app: ElectronApplication) => {
  await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

  const windows = app.windows();
  const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
  const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];
  if (!dashboard || !projector) {
    throw new Error("Expected both dashboard and projector windows to exist.");
  }
  return { dashboard, projector };
};

test("aspect ratio persists to userData.json and applies to projector window bounds (relaunch)", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir });

  const selectedAspectRatioId = "16-9";
  const expectedRatio = 16 / 9;
  const ratioTolerance = 0.02;

  try {
    await app.firstWindow();

    const { dashboard, projector } = await getDashboardAndProjectorWindows(app);
    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    const aspectSelect = dashboard.locator("#aspectRatio");
    await expect(aspectSelect).toBeVisible();
    await aspectSelect.selectOption(selectedAspectRatioId);
    await dashboard.getByText("CLOSE", { exact: true }).click();

    await expect
      .poll(
        async () => {
          try {
            const userData = await readUserData(dir);
            return getNestedString(userData, ["config", "aspectRatio"]);
          } catch {
            return null;
          }
        },
        { timeout: 30_000 }
      )
      .toBe(selectedAspectRatioId);

    await expect
      .poll(
        async () => {
          try {
            const styles = await projector.evaluate(() => {
              return {
                width: document.body.style.width || "",
                height: document.body.style.height || "",
              };
            });
            return `${styles.width}|${styles.height}`;
          } catch {
            return "";
          }
        },
        { timeout: 15_000 }
      )
      .toBe("100vw|56.25vw");

    await expect
      .poll(
        async () => {
          const b = await getProjectorContentBounds(app);
          if (!b || !b.width || !b.height) return null;
          const r = b.width / b.height;
          return Math.abs(r - expectedRatio) <= ratioTolerance;
        },
        { timeout: 15_000 }
      )
      .toBe(true);

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
          const b = await getProjectorContentBounds(app);
          if (!b || !b.width || !b.height) return null;
          const r = b.width / b.height;
          return Math.abs(r - expectedRatio) <= ratioTolerance;
        },
        { timeout: 15_000 }
      )
      .toBe(true);

    await expect
      .poll(
        async () => {
          try {
            const styles = await projector2.evaluate(() => {
              return {
                width: document.body.style.width || "",
                height: document.body.style.height || "",
              };
            });
            return `${styles.width}|${styles.height}`;
          } catch {
            return "";
          }
        },
        { timeout: 15_000 }
      )
      .toBe("100vw|56.25vw");
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
