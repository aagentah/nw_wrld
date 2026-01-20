import { ipcMain } from "electron";

import InputManager from "../../InputManager";
import { state } from "../state";

export function registerTestFileBridge(): void {
  const isTest = process.env.NODE_ENV === "test";
  const isMockFile = process.env.NW_WRLD_TEST_FILE_MOCK === "1";
  if (!isTest || !isMockFile) return;

  ipcMain.handle("test:file:emitBand", async (_event, payload: unknown) => {
    const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const channelName = p && typeof p.channelName === "string" ? p.channelName : "";
    const velocity = p && typeof p.velocity === "number" ? p.velocity : 1;
    if (channelName !== "low" && channelName !== "medium" && channelName !== "high") {
      return { ok: false };
    }
    if (!Number.isFinite(velocity)) {
      return { ok: false };
    }
    if (!state.inputManager) return { ok: false };
    (state.inputManager as InputManager).broadcast("method-trigger", {
      source: "file",
      channelName,
      velocity,
    });
    return { ok: true };
  });
}

