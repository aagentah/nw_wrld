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

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asString = (v: unknown): string | null => (typeof v === "string" ? v : null);

const getChannelState = async ({
  projectDir,
  setName,
  trackName,
  fromKey,
  toKey,
}: {
  projectDir: string;
  setName: string;
  trackName: string;
  fromKey: string;
  toKey: string;
}): Promise<{
  hasFromMapping: boolean;
  hasToMapping: boolean;
  hasFromMethods: boolean;
  hasToMethods: boolean;
  toHasTextMethod: boolean;
  textModuleInstanceId: string | null;
} | null> => {
  const ud = await readUserData(projectDir);
  if (!isPlainObject(ud)) return null;
  const sets = asArray(ud.sets);
  const set = sets.find((s) => isPlainObject(s) && asString(s.name) === setName) || null;
  if (!set || !isPlainObject(set)) return null;
  const tracks = asArray(set.tracks);
  const track = tracks.find((t) => isPlainObject(t) && asString(t.name) === trackName) || null;
  if (!track || !isPlainObject(track)) return null;

  const channelMappings = isPlainObject(track.channelMappings) ? track.channelMappings : {};
  const hasFromMapping = Object.prototype.hasOwnProperty.call(channelMappings, fromKey);
  const hasToMapping = Object.prototype.hasOwnProperty.call(channelMappings, toKey);

  const modules = asArray(track.modules);
  const textModuleInstanceId =
    modules
      .map((m) => {
        if (!isPlainObject(m)) return null;
        const type = asString(m.type);
        const id = asString(m.id);
        if (!id) return null;
        if (type === "Text") return id;
        return null;
      })
      .find((x): x is string => Boolean(x)) || null;

  const modulesData = isPlainObject(track.modulesData) ? track.modulesData : null;
  const textData =
    textModuleInstanceId && modulesData && isPlainObject(modulesData[textModuleInstanceId])
      ? (modulesData[textModuleInstanceId] as Record<string, unknown>)
      : null;
  const methods = textData && isPlainObject(textData.methods) ? (textData.methods as Record<string, unknown>) : {};

  const hasFromMethods = Object.prototype.hasOwnProperty.call(methods, fromKey);
  const hasToMethods = Object.prototype.hasOwnProperty.call(methods, toKey);
  const toVal = methods[toKey];
  const toHasTextMethod =
    Array.isArray(toVal) &&
    toVal.some(
      (m) =>
        isPlainObject(m) &&
        asString(m.name) === "text" &&
        Array.isArray(m.options) &&
        (m.options as unknown[]).some(
          (o) => isPlainObject(o) && asString(o.name) === "text" && typeof o.value === "string"
        )
    );

  return {
    hasFromMapping,
    hasToMapping,
    hasFromMethods,
    hasToMethods,
    toHasTextMethod,
    textModuleInstanceId,
  };
};

test("edit channel number migrates method config from old key to new key", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir });

  const suffix = String(Date.now());
  const setName = `E2E Set ${suffix}`;
  const trackName = `E2E Track ${suffix}`;
  const expectedText = `E2E_EDIT_CH_${suffix}`;

  const fromKey = "1";
  const toKey = "5";

  try {
    await app.firstWindow();
    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const windows = app.windows();
    const dashboard = windows.find((w) => w.url().includes("dashboard.html")) || windows[0];
    await waitForProjectReady(dashboard);

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

    await dashboard.getByTestId("track-add-module").click();
    const addTextModule = dashboard.locator('[data-testid="add-module-to-track"][data-module-name="Text"]');
    await expect(addTextModule).toBeVisible();
    await addTextModule.click();
    await expect(addTextModule).toBeHidden();

    await dashboard.getByTestId("track-add-channel").click();

    const channelConfig = dashboard.locator('[data-testid="module-channel-config"][data-channel-key="1"]');
    await expect(channelConfig).toBeVisible();
    await channelConfig.click();

    const addSelect = dashboard
      .getByTestId("method-add-select")
      .filter({ has: dashboard.locator('option[value="text"]') })
      .first();
    await expect(addSelect).toBeVisible();
    await addSelect.selectOption("text");

    const textInput = dashboard.locator(
      '[data-testid="method-option-input"][data-method-name="text"][data-option-name="text"]'
    );
    await expect(textInput).toBeVisible();
    await textInput.fill(expectedText);

    await expect
      .poll(
        async () => {
          try {
            const state = await getChannelState({
              projectDir: dir,
              setName,
              trackName,
              fromKey,
              toKey,
            });
            if (!state) return null;
            if (!state.textModuleInstanceId) return null;
            if (!state.hasFromMapping) return null;
            if (!state.hasFromMethods) return null;
            return "ready";
          } catch {
            return null;
          }
        },
        { timeout: 30_000 }
      )
      .toBe("ready");

    await dashboard.getByText("EDIT CHANNEL", { exact: true }).click();

    const editChannelModal = dashboard.locator("div.fixed").filter({ hasText: "EDIT CHANNEL" }).first();
    await expect(editChannelModal).toBeVisible();
    await expect(editChannelModal.getByText("New Channel Number", { exact: true })).toBeVisible();

    const newChannelSelect = editChannelModal.locator("select").first();
    await expect(newChannelSelect).toBeVisible();
    await newChannelSelect.selectOption(toKey);

    await editChannelModal.getByText("Save Changes", { exact: true }).click();
    await expect(editChannelModal).toBeHidden();

    await expect
      .poll(
        async () => {
          try {
            const state = await getChannelState({
              projectDir: dir,
              setName,
              trackName,
              fromKey,
              toKey,
            });
            if (!state) return null;
            if (!state.textModuleInstanceId) return null;
            return {
              hasFromMapping: state.hasFromMapping,
              hasToMapping: state.hasToMapping,
              hasFromMethods: state.hasFromMethods,
              hasToMethods: state.hasToMethods,
              toHasTextMethod: state.toHasTextMethod,
            };
          } catch {
            return null;
          }
        },
        { timeout: 30_000 }
      )
      .toEqual({
        hasFromMapping: false,
        hasToMapping: true,
        hasFromMethods: false,
        hasToMethods: true,
        toHasTextMethod: true,
      });
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

