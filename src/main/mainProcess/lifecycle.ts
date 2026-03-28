import { state } from "./state";

import { app, BrowserWindow } from "electron";

export function registerLifecycle({
  createWindow: _createWindow,
}: {
  createWindow: (projectDir: string | null) => void;
}) {
  app.on("before-quit", (event) => {
    if (state.didRunShutdownCleanup) return;
    state.didRunShutdownCleanup = true;
    event.preventDefault();

    (async () => {
      if (state.inputManager) {
        try {
          await (state.inputManager as { disconnect?: () => Promise<void> }).disconnect?.();
        } catch (e) {
          console.error("[Main] Failed to disconnect InputManager on quit:", e);
        }
      }
    })()
      .catch(() => {})
      .finally(() => {
        try {
          app.quit();
        } catch {}
      });
  });
}

export function registerActivate({
  createWindow,
}: {
  createWindow: (projectDir: string | null) => void;
}) {
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      state.currentProjectDir = null;
      createWindow(null);
    }
  });
}
