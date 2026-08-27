import { app } from "electron";
import * as path from "node:path";

import { ObservatoryStore } from "../../shared/observatory/ObservatoryStore";
import type { ObservatoryState } from "../../shared/observatory/types";
import { state } from "./state";

type ObservatoryWindow = {
  isDestroyed?: () => boolean;
  webContents?: {
    isDestroyed?: () => boolean;
    send?: (channel: string, payload: ObservatoryState) => void;
  };
};

let observatoryStore: ObservatoryStore | null = null;

export function ensureObservatoryStore(): ObservatoryStore {
  if (observatoryStore) return observatoryStore;

  if (state.observatoryStore instanceof ObservatoryStore) {
    observatoryStore = state.observatoryStore;
    return observatoryStore;
  }

  const configuredDir = process.env.NW_WRLD_OBSERVATORY_DIR;
  const rootDir =
    typeof configuredDir === "string" && configuredDir.trim()
      ? configuredDir.trim()
      : path.join(app.getPath("userData"), "observatory");
  const store = new ObservatoryStore(rootDir);
  const loadResult = store.loadAll();
  if (loadResult.skipped > 0) {
    console.error(`[Observatory] Skipped ${loadResult.skipped} graph file(s) while loading.`);
  }

  observatoryStore = store;
  state.observatoryStore = store;
  store.subscribe(broadcastObservatoryState);
  return store;
}

export function broadcastObservatoryState(): void {
  const observatoryWindow = state.observatoryWindow as ObservatoryWindow | null;
  if (!observatoryWindow || observatoryWindow.isDestroyed?.()) return;

  const webContents = observatoryWindow.webContents;
  if (!webContents || webContents.isDestroyed?.() || typeof webContents.send !== "function") return;

  try {
    webContents.send("observatory:state", ensureObservatoryStore().getState());
  } catch (error) {
    console.error("[Observatory] Failed to broadcast state:", error);
  }
}
