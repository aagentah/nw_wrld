import { test, expect } from "@playwright/test";
import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installDashboardMessageBuffer,
  clearDashboardMessages,
  getDashboardMessages,
} from "../fixtures/dashboardMessageBuffer";
import {
  installProjectorMessageBuffer,
  clearProjectorMessages,
  getProjectorMessages,
} from "../fixtures/projectorMessageBuffer";

test("dashboard shows perf indicator after sandbox starts emitting stats", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  try {
    const suffix = String(Date.now());
    const setName = `E2E Set ${suffix}`;
    const trackName = `E2E Track ${suffix}`;

    const waitForProjectReady = async (page: import("playwright").Page) => {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForFunction(
        () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
        undefined,
        { timeout: 15_000 }
      );
    };

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

    await installDashboardMessageBuffer(dashboard);
    await installProjectorMessageBuffer(projector);
    await clearDashboardMessages(dashboard);
    await clearProjectorMessages(projector);

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

    await dashboard.getByText("MODULE", { exact: true }).click();
    const previewIcons = dashboard.locator('[title="Preview module"]');
    await expect(previewIcons.first()).toBeVisible();

    let didPreview = false;
    for (let i = 0; i < 5; i++) {
      await clearDashboardMessages(dashboard);
      await clearProjectorMessages(projector);

      await previewIcons.nth(i).hover();

      let requestId: string | null = null;
      let moduleName: string | null = null;

      await expect
        .poll(
          async () => {
            const msgs = await getProjectorMessages(projector);
            const m = msgs.find(
              (x) =>
                x.type === "preview-module" &&
                typeof x.props?.requestId === "string" &&
                typeof x.props?.moduleName === "string"
            );
            requestId = (m?.props?.requestId as string) || null;
            moduleName = (m?.props?.moduleName as string) || null;
            return Boolean(requestId && moduleName);
          },
          { timeout: 20_000 }
        )
        .toBe(true);

      if (!requestId || !moduleName) continue;

      await dashboard.waitForFunction(
        ({ requestId, moduleName }) => {
          const anyGlobal = globalThis as unknown as {
            __nwWrldE2EDashboard?: { messages?: unknown[] };
          };
          const msgs = Array.isArray(anyGlobal.__nwWrldE2EDashboard?.messages)
            ? anyGlobal.__nwWrldE2EDashboard?.messages
            : [];
          const gotReady = msgs.some((m) => {
            if (!m || typeof m !== "object") return false;
            return (
              (m as { type?: unknown }).type === "preview-module-ready" &&
              (m as { props?: { requestId?: unknown; moduleName?: unknown } }).props?.requestId ===
                requestId &&
              (m as { props?: { requestId?: unknown; moduleName?: unknown } }).props?.moduleName ===
                moduleName
            );
          });
          const gotError = msgs.some((m) => {
            if (!m || typeof m !== "object") return false;
            return (
              (m as { type?: unknown }).type === "preview-module-error" &&
              (m as { props?: { requestId?: unknown; moduleName?: unknown } }).props?.requestId ===
                requestId &&
              (m as { props?: { requestId?: unknown; moduleName?: unknown } }).props?.moduleName ===
                moduleName
            );
          });
          return gotReady || gotError;
        },
        { requestId, moduleName },
        { timeout: 25_000 }
      );

      const status = await dashboard.evaluate(
        ({ requestId, moduleName }) => {
          const anyGlobal = globalThis as unknown as {
            __nwWrldE2EDashboard?: { messages?: unknown[] };
          };
          const msgs = Array.isArray(anyGlobal.__nwWrldE2EDashboard?.messages)
            ? anyGlobal.__nwWrldE2EDashboard?.messages
            : [];
          const gotReady = msgs.some((m) => {
            if (!m || typeof m !== "object") return false;
            return (
              (m as { type?: unknown }).type === "preview-module-ready" &&
              (m as { props?: { requestId?: unknown; moduleName?: unknown } }).props?.requestId ===
                requestId &&
              (m as { props?: { requestId?: unknown; moduleName?: unknown } }).props?.moduleName ===
                moduleName
            );
          });
          if (gotReady) return "ready";
          const gotError = msgs.some((m) => {
            if (!m || typeof m !== "object") return false;
            return (
              (m as { type?: unknown }).type === "preview-module-error" &&
              (m as { props?: { requestId?: unknown; moduleName?: unknown } }).props?.requestId ===
                requestId &&
              (m as { props?: { requestId?: unknown; moduleName?: unknown } }).props?.moduleName ===
                moduleName
            );
          });
          return gotError ? "error" : "pending";
        },
        { requestId, moduleName }
      );

      if (status === "ready") {
        didPreview = true;
        break;
      }
    }

    expect(didPreview).toBe(true);

    await expect
      .poll(
        async () => {
          const msgs = await getDashboardMessages(dashboard);
          return msgs.some((m) => m.type === "perf:stats");
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(previewIcons.first()).toBeHidden();

    await dashboard.getByText("DEBUG", { exact: true }).click();

    await expect(dashboard.locator('[data-testid="debug-perf-indicator"]')).toHaveText(
      /^FPS\s+\d+\s+·\s+\d+ms$/,
      { timeout: 30_000 }
    );
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

