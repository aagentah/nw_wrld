import { ipcMain } from "electron";

import InputManager from "../../InputManager";
import { state } from "../state";
import { normalizeInputConfig } from "../../../shared/validation/inputConfigValidation";

export function registerInputBridge(): void {
  const normalizeBand = (value: unknown): "low" | "medium" | "high" | null => {
    if (value === "low" || value === "medium" || value === "high") return value;
    return null;
  };
  const normalizeVelocity01 = (value: unknown): number | null => {
    if (typeof value !== "number") return null;
    if (!Number.isFinite(value)) return null;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  };

  ipcMain.handle("input:configure", async (event, payload) => {
    if (!state.inputManager) {
      return { success: false, reason: "INPUT_MANAGER_MISSING" };
    }
    const normalized = normalizeInputConfig(payload);
    if (!normalized) {
      return { success: false, reason: "INVALID_INPUT_CONFIG" };
    }
    await (state.inputManager as InputManager).initialize(
      normalized as Parameters<InputManager["initialize"]>[0]
    );
    return { success: true };
  });

  ipcMain.handle("input:get-midi-devices", async () => {
    return await InputManager.getAvailableMIDIDevices();
  });

  ipcMain.handle("input:audio:emitBand", async (_event, payload: unknown) => {
    const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const channelName = normalizeBand(p ? p.channelName : null);
    const velocity = normalizeVelocity01(p ? p.velocity : null);
    if (!channelName) return { ok: false };
    if (velocity == null) return { ok: false };
    if (!state.inputManager) return { ok: false };
    const im = state.inputManager as InputManager;
    const cfg = (im as unknown as { config?: unknown }).config;
    const cfgObj = cfg && typeof cfg === "object" ? (cfg as Record<string, unknown>) : null;
    const currentType = cfgObj && typeof cfgObj.type === "string" ? cfgObj.type : "";
    if (currentType !== "audio") return { ok: false };
    im.broadcast("method-trigger", { source: "audio", channelName, velocity });
    return { ok: true };
  });

  ipcMain.handle("input:file:emitBand", async (_event, payload: unknown) => {
    const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const channelName = normalizeBand(p ? p.channelName : null);
    const velocity = normalizeVelocity01(p ? p.velocity : null);
    if (!channelName) return { ok: false };
    if (velocity == null) return { ok: false };
    if (!state.inputManager) return { ok: false };
    const im = state.inputManager as InputManager;
    const cfg = (im as unknown as { config?: unknown }).config;
    const cfgObj = cfg && typeof cfg === "object" ? (cfg as Record<string, unknown>) : null;
    const currentType = cfgObj && typeof cfgObj.type === "string" ? cfgObj.type : "";
    if (currentType !== "file") return { ok: false };
    im.broadcast("method-trigger", { source: "file", channelName, velocity });
    return { ok: true };
  });
}
