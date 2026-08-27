import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ElectronApplication, Page } from "playwright";
import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";

const ELECTRON_ARGS = { NW_WRLD_ELECTRON_ARGS: "--no-sandbox,--disable-gpu" };
const DESTINATION = "Prove-atlas-renders-live-private-run";
const OUTCOME = "Atlas-live-private-run-complete";

type ObservatoryBridgeResult = { ok: boolean; code?: string; state?: { runs: unknown[] } };

const callObservatory = (
  page: Page,
  method: "getState" | "startCapture",
  payload?: unknown
): Promise<ObservatoryBridgeResult | undefined> =>
  page.evaluate(
    (arg: { method: string; payload?: unknown }) => {
      const observatory = (
        globalThis.nwWrldBridge as unknown as {
          observatory?: Record<string, (payload?: unknown) => Promise<unknown>>;
        }
      )?.observatory;
      return observatory?.[arg.method]?.(arg.payload);
    },
    { method, payload }
  ) as Promise<ObservatoryBridgeResult | undefined>;

const findWindow = async (app: ElectronApplication, urlPart: string): Promise<Page> => {
  await expect
    .poll(() => app.windows().find((w) => w.url().includes(urlPart)) ?? null, {
      timeout: 20_000,
    })
    .not.toBeNull();
  const page = app.windows().find((w) => w.url().includes(urlPart));
  if (!page) throw new Error(`timed out waiting for window matching ${urlPart}`);
  return page;
};

test("observatory atlas: opt-in, live run, operator outcome, end, restart reload", async () => {
  test.setTimeout(120_000);
  const { dir, cleanup } = await createTestWorkspace();
  const obsDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "nw-obs-e2e-"));
  let app: ElectronApplication | null = null;

  try {
    app = await launchNwWrld({
      projectDir: dir,
      env: { ...ELECTRON_ARGS, NW_WRLD_OBSERVATORY_DIR: obsDir },
    });
    await app.firstWindow();
    const atlas = await findWindow(app, "atlas.html");

    await atlas.waitForFunction(() => globalThis.nwWrldBridge !== undefined);
    await expect
      .poll(() => fs.existsSync(path.join(obsDir, "graphs")), { timeout: 10_000 })
      .toBe(false);

    const initial = await callObservatory(atlas, "getState");
    expect(initial?.ok).toBe(true);
    expect(initial?.state?.runs).toHaveLength(0);

    await atlas.fill("#destination-input", DESTINATION, { force: true });
    await atlas.click('[data-testid="opt-in"]', { force: true });
    await expect(atlas.locator('[data-testid="destination"]')).toHaveText(DESTINATION);

    await atlas.click('[data-testid="run-emitter"]', { force: true });
    await expect(atlas.locator("#status-line")).toContainText(/test emitter started|refused:/, {
      timeout: 20_000,
    });
    await expect
      .poll(() => atlas.locator('[data-testid="spine-node"]').count(), { timeout: 20_000 })
      .toBe(15);
    await expect(atlas.locator('[data-testid="outcome-card"]')).toContainText(/OUTCOME PENDING/i);

    const graphFiles = fs
      .readdirSync(path.join(obsDir, "graphs"))
      .filter((name) => name.endsWith(".json"));
    expect(graphFiles).toHaveLength(1);
    const rawGraph = fs.readFileSync(path.join(obsDir, "graphs", graphFiles[0]), "utf-8");
    expect(rawGraph).not.toContain("sk-live");
    expect(rawGraph).toContain("withheld_at_capture");

    const programStart = await callObservatory(atlas, "startCapture", {
      initiator: "program",
      destination: "ai-tries-to-start-capture",
    });
    expect(programStart).toEqual({ ok: false, code: "OPERATOR_CONSENT_REQUIRED" });

    const inspection = await atlas.evaluate(() => {
      const node = document.querySelector('[data-testid="spine-node"]') as HTMLElement | null;
      if (!node) throw new Error("missing spine node");
      node.click();
      const inspector = document.querySelector('[data-testid="inspector"]');
      const breadcrumb = document.querySelector('[data-testid="breadcrumb"]');
      const cell = document.querySelectorAll('[data-testid="chrono-cell"]')[2] as
        | HTMLElement
        | undefined;
      if (cell) cell.click();
      return {
        inspector: inspector?.textContent || "",
        breadcrumb: breadcrumb?.textContent || "",
      };
    });
    expect(inspection.inspector).toMatch(/run_start|"seq"/);
    expect(inspection.breadcrumb).toMatch(/OUTCOME PENDING|OUTCOME:/);

    const declareResult = await atlas.evaluate(async (outcome) => {
      const observatory = (
        globalThis.nwWrldBridge as unknown as {
          observatory: {
            getState: () => Promise<{
              ok: boolean;
              state?: { runs: Array<{ identity: { sourceRunId: string } }> };
            }>;
            declareOutcome: (payload: unknown) => Promise<{ ok: boolean; code?: string }>;
          };
        }
      ).observatory;
      const state = await observatory.getState();
      const sourceRunId = state.state?.runs[0]?.identity.sourceRunId;
      if (!sourceRunId) return { ok: false, code: "NO_RUN" };
      return observatory.declareOutcome({ sourceRunId, outcome });
    }, OUTCOME);
    expect(declareResult?.ok).toBe(true);
    await expect
      .poll(() => atlas.locator('[data-testid="spine-node"]').count(), { timeout: 20_000 })
      .toBe(16);
    await expect(atlas.locator("body")).toContainText(OUTCOME, { timeout: 20_000 });

    await atlas.evaluate(async () => {
      const observatory = (
        globalThis.nwWrldBridge as unknown as {
          observatory: {
            getState: () => Promise<{
              ok: boolean;
              state?: { runs: Array<{ identity: { sourceRunId: string } }> };
            }>;
            endRun: (payload: unknown) => Promise<{ ok: boolean; code?: string }>;
          };
        }
      ).observatory;
      const state = await observatory.getState();
      const sourceRunId = state.state?.runs[0]?.identity.sourceRunId;
      if (!sourceRunId) throw new Error("missing source run");
      const result = await observatory.endRun({ sourceRunId });
      if (!result.ok) throw new Error(result.code || "end-run refused");
    });
    await expect
      .poll(() => atlas.locator("body").evaluate((el) => el.textContent || ""), { timeout: 20_000 })
      .toMatch(/Run ended/i);

    await app.close();
    app = null;

    app = await launchNwWrld({
      projectDir: dir,
      env: { ...ELECTRON_ARGS, NW_WRLD_OBSERVATORY_DIR: obsDir },
    });
    await app.firstWindow();
    const atlas2 = await findWindow(app, "atlas.html");
    await expect
      .poll(() => atlas2.locator('[data-testid="spine-node"]').count(), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(16);
    await expect(atlas2.locator("body")).toContainText(OUTCOME, { timeout: 20_000 });
    await expect(atlas2.locator('[data-testid="destination"]')).toHaveText(DESTINATION);
  } finally {
    if (app) {
      try {
        await app.close();
      } catch {}
    }
    await cleanup();
    await fs.promises.rm(obsDir, { recursive: true, force: true }).catch(() => {});
  }
});
