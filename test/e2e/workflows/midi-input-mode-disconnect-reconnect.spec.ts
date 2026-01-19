import { test, expect } from "@playwright/test";

import { createTestWorkspace } from "../fixtures/testWorkspace";
import { launchNwWrld } from "../fixtures/launchElectron";
import {
  installInputStatusBuffer,
  clearInputStatuses,
  getInputStatuses,
} from "../fixtures/inputStatusBuffer";

const waitForProjectReady = async (page: import("playwright").Page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => globalThis.nwWrldBridge?.project?.isDirAvailable?.() === true,
    undefined,
    { timeout: 15_000 }
  );
};

test("switch to External MIDI, handle device disconnect, then reconnect with input-status updates", async () => {
  const { dir, cleanup } = await createTestWorkspace();
  const app = await launchNwWrld({ projectDir: dir, env: { NW_WRLD_TEST_MIDI_MOCK: "1" } });

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
    await installInputStatusBuffer(dashboard);

    await dashboard.getByText("SETTINGS", { exact: true }).click();

    await dashboard.locator('label[for="signal-sequencer"]').click();
    await dashboard.locator('label[for="signal-external-midi"]').click();

    const midiSelect = dashboard.locator("#midiDevice");
    await expect(midiSelect).toBeVisible();
    await midiSelect.selectOption("e2e-midi-1");

    await expect
      .poll(
        async () => {
          const statuses = await getInputStatuses(dashboard);
          return statuses.some(
            (s) => s.status === "connected" && typeof s.message === "string" && s.message.includes("E2E MIDI Device")
          );
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await clearInputStatuses(dashboard);
    await dashboard.evaluate(() => globalThis.nwWrldBridge?.testing?.midi?.disconnect?.("e2e-midi-1"));

    await expect
      .poll(
        async () => {
          const statuses = await getInputStatuses(dashboard);
          return statuses.some((s) => s.status === "disconnected");
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await clearInputStatuses(dashboard);
    await dashboard.evaluate(() =>
      globalThis.nwWrldBridge?.testing?.midi?.reconnect?.({
        id: "e2e-midi-1",
        name: "E2E MIDI Device",
        manufacturer: "nw_wrld",
      })
    );

    await expect
      .poll(
        async () => {
          const statuses = await getInputStatuses(dashboard);
          return statuses.some((s) => s.status === "connected");
        },
        { timeout: 20_000 }
      )
      .toBe(true);
  } finally {
    try {
      await app.close();
    } catch {}
    await cleanup();
  }
});

