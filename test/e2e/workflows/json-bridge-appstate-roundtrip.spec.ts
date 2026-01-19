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

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

test("JSON bridge write/read roundtrip persists to disk (appState.json)", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  try {
    await app.firstWindow();
    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

    const windows = app.windows();
    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    await waitForProjectReady(dashboard);

    const projectDirFromBridge = await dashboard.evaluate(() => {
      const v = globalThis.nwWrldBridge?.project?.getDir?.();
      return typeof v === "string" ? v : null;
    });
    expect(projectDirFromBridge).toBe(dir);

    const defaultValue = {
      activeTrackId: null,
      activeSetId: null,
      sequencerMuted: false,
      workspacePath: null,
    };
    const suffix = String(Date.now());
    const payload = {
      activeTrackId: 42,
      activeSetId: `e2e_set_${suffix}`,
      sequencerMuted: true,
      workspacePath: dir,
    };

    const writeRes = await dashboard.evaluate(async ({ filename, data }) => {
      return await globalThis.nwWrldAppBridge?.json?.write?.(filename, data);
    }, { filename: "appState.json", data: payload });
    expect(isPlainObject(writeRes)).toBe(true);
    expect((writeRes as { ok?: unknown }).ok).toBe(true);

    const readBack = await dashboard.evaluate(async ({ filename, def }) => {
      return await globalThis.nwWrldAppBridge?.json?.read?.(filename, def);
    }, { filename: "appState.json", def: defaultValue });
    expect(readBack).toEqual(payload);

    const appStatePath = path.join(dir, "nw_wrld_data", "json", "appState.json");
    await expect
      .poll(
        async () => {
          try {
            const raw = await fs.readFile(appStatePath, "utf-8");
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        },
        { timeout: 10_000 }
      )
      .toMatchObject(payload);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

