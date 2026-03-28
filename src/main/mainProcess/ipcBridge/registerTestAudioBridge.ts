import { ipcMain } from "electron";

import InputManager from "../../InputManager";
import { state } from "../state";

export function registerTestAudioBridge(): void {
  const isTest = process.env.NODE_ENV === "test";
  const isMockAudio = process.env.NW_WRLD_TEST_AUDIO_MOCK === "1";
  if (!isTest || !isMockAudio) return;

  ipcMain.handle("test:audio:emitBand", async (_event, payload: unknown) => {
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
      source: "audio",
      channelName,
      velocity,
    });
    return { ok: true };
  });
}

