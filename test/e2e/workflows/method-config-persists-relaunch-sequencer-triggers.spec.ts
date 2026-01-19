import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installDashboardMessageBuffer,
  clearDashboardMessages,
  getDashboardMessages,
} from "../fixtures/dashboardMessageBuffer";
import { installProjectorMessageBuffer } from "../fixtures/projectorMessageBuffer";

const waitForProjectReady = async (page: import("playwright").Page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
    undefined,
    { timeout: 15_000 }
  );
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asString = (v: unknown): string | null => (typeof v === "string" ? v : null);

const readUserData = async (projectDir: string) => {
  const userDataPath = path.join(projectDir, "nw_wrld_data", "json", "userData.json");
  const raw = await fs.readFile(userDataPath, "utf-8");
  return JSON.parse(raw) as unknown;
};

test("method config persists to userData.json, survives relaunch, still triggers via sequencer", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  let app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackName = `E2E Track ${suffix}`;
  const moduleName = "Text";
  const expectedOpacity = 0.25;

  let instanceId: string | null = null;

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
    const projector = windows.find((w) => w.url().includes("projector.html")) || windows[1];
    await waitForProjectReady(dashboard);
    await waitForProjectReady(projector);
    await installProjectorMessageBuffer(projector);
    await installDashboardMessageBuffer(dashboard);

    await dashboard.evaluate(() => {
      globalThis.nwWrldBridge?.messaging?.sendToProjector?.("debug-overlay-visibility", {
        isOpen: true,
      });
    });

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

    await dashboard.getByText("SETTINGS", { exact: true }).click();
    await dashboard.locator('label[for="signal-sequencer"]').click();
    await dashboard.getByText("CLOSE", { exact: true }).click();

    await dashboard.getByTestId("track-add-module").click();
    const addTextModule = dashboard.locator(
      `[data-testid="add-module-to-track"][data-module-name="${moduleName}"]`
    );
    await expect(addTextModule).toBeVisible();
    await addTextModule.click();
    await expect(addTextModule).toBeHidden();

    await dashboard.getByTestId("track-add-channel").click();

    const step = dashboard.locator(
      `[data-testid="sequencer-step"][data-channel-number="1"][data-step-index="0"]`
    );
    await expect(step).toBeVisible();
    await step.click();
    await expect(step).toHaveAttribute("aria-pressed", "true");

    const channelConfig = dashboard.locator(
      `[data-testid="module-channel-config"][data-channel-key="1"]`
    );
    await expect(channelConfig).toBeVisible();
    instanceId = await channelConfig.getAttribute("data-module-instance-id");
    if (!instanceId) throw new Error("Could not resolve module instance id from UI");
    await channelConfig.click();

    const addSelect = dashboard
      .getByTestId("method-add-select")
      .filter({ has: dashboard.locator('option[value="opacity"]') })
      .first();
    await expect(addSelect).toBeVisible();
    await addSelect.selectOption("opacity");

    const opacityInput = dashboard.locator(
      `[data-testid="method-option-input"][data-method-name="opacity"][data-option-name="opacity"]`
    );
    await expect(opacityInput).toBeVisible();
    await opacityInput.focus();
    await opacityInput.fill(String(expectedOpacity));
    await opacityInput.press("Enter");

    await dashboard.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard.locator("text=Text (Channel 1)")).toBeHidden();

    await expect
      .poll(
        async () => {
          try {
            const userData = await readUserData(dir);
            if (!isPlainObject(userData)) return false;
            const sets = asArray(userData.sets);

            for (const s of sets) {
              if (!isPlainObject(s)) continue;
              const tracks = asArray(s.tracks);
              for (const t of tracks) {
                if (!isPlainObject(t)) continue;
                const modulesData = t.modulesData;
                if (!isPlainObject(modulesData)) continue;
                const md = modulesData[instanceId as string];
                if (!isPlainObject(md)) continue;
                const methods = md.methods;
                if (!isPlainObject(methods)) continue;
                const ch1 = methods["1"];
                if (!Array.isArray(ch1)) continue;
                const opacityMethod = ch1.find(
                  (m) => isPlainObject(m) && asString(m.name) === "opacity"
                );
                if (!opacityMethod || !isPlainObject(opacityMethod)) continue;

                const options = (opacityMethod as Record<string, unknown>).options;
                if (!Array.isArray(options)) continue;
                const opt = options.find(
                  (o) =>
                    isPlainObject(o) && asString((o as Record<string, unknown>).name) === "opacity"
                ) as Record<string, unknown> | undefined;
                if (!opt) continue;
                const rawVal = opt.value;
                const numVal = typeof rawVal === "number" ? rawVal : Number(String(rawVal));
                return Number.isFinite(numVal) && Math.abs(numVal - expectedOpacity) < 1e-9;
              }
            }

            return false;
          } catch {
            return false;
          }
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    await app.close();
    app = await launchNwWrld({ projectDir: dir });
    await app.firstWindow();

    let windows2 = app.windows();
    if (windows2.length < 2) {
      try {
        await app.waitForEvent("window", { timeout: 15_000 });
      } catch {}
      windows2 = app.windows();
    }

    const dashboard2 = windows2.find((w) => w.url().includes("dashboard.html")) || windows2[0];
    const projector2 = windows2.find((w) => w.url().includes("projector.html")) || windows2[1];
    await waitForProjectReady(dashboard2);
    await waitForProjectReady(projector2);

    await installDashboardMessageBuffer(dashboard2);
    await dashboard2.evaluate(() => {
      globalThis.nwWrldBridge?.messaging?.sendToProjector?.("debug-overlay-visibility", {
        isOpen: true,
      });
    });

    await expect
      .poll(
        async () => {
          try {
            const userData = await readUserData(dir);
            if (!isPlainObject(userData)) return false;
            const sets = asArray(userData.sets);

            for (const s of sets) {
              if (!isPlainObject(s)) continue;
              const tracks = asArray(s.tracks);
              for (const t of tracks) {
                if (!isPlainObject(t)) continue;
                const modulesData = t.modulesData;
                if (!isPlainObject(modulesData)) continue;
                const md = modulesData[instanceId as string];
                if (!isPlainObject(md)) continue;
                const methods = md.methods;
                if (!isPlainObject(methods)) continue;
                const ch1 = methods["1"];
                if (!Array.isArray(ch1)) continue;
                const opacityMethod = ch1.find(
                  (m) => isPlainObject(m) && asString(m.name) === "opacity"
                );
                if (!opacityMethod || !isPlainObject(opacityMethod)) continue;

                const options = (opacityMethod as Record<string, unknown>).options;
                if (!Array.isArray(options)) continue;
                const opt = options.find(
                  (o) =>
                    isPlainObject(o) && asString((o as Record<string, unknown>).name) === "opacity"
                ) as Record<string, unknown> | undefined;
                if (!opt) continue;
                const rawVal = opt.value;
                const numVal = typeof rawVal === "number" ? rawVal : Number(String(rawVal));
                return Number.isFinite(numVal) && Math.abs(numVal - expectedOpacity) < 1e-9;
              }
            }

            return false;
          } catch {
            return false;
          }
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    await dashboard2.getByText("TRACKS", { exact: true }).click();
    const trackLabel2 = dashboard2.locator("label").filter({ hasText: trackName }).first();
    await expect(trackLabel2).toBeVisible();
    await trackLabel2.click();
    await dashboard2.getByText("CLOSE", { exact: true }).click();
    await expect(dashboard2.locator("text=Select Active Track:")).toBeHidden();

    const step2 = dashboard2.locator(
      `[data-testid="sequencer-step"][data-channel-number="1"][data-step-index="0"]`
    );
    await expect(step2).toBeVisible();
    if ((await step2.getAttribute("aria-pressed")) !== "true") {
      await step2.click();
      await expect(step2).toHaveAttribute("aria-pressed", "true");
    }

    await expect(dashboard2.getByTestId("sequencer-play-toggle")).toBeEnabled();
    await clearDashboardMessages(dashboard2);
    await dashboard2.getByTestId("sequencer-play-toggle").click();

    await expect
      .poll(
        async () => {
          const msgs = await getDashboardMessages(dashboard2);
          const logs = msgs.filter((m) => m.type === "debug-log");
          const joined = logs.map((m) => String(m.props?.log || "")).join("\n");
          return joined.includes("Method: opacity") && joined.includes('"opacity": 0.25');
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await dashboard2.getByTestId("sequencer-play-toggle").click();
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});
