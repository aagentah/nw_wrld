type ElectronApp = {
  on(event: "before-quit", handler: (event: { preventDefault(): void }) => void): void;
  on(event: "activate", handler: () => void): void;
  quit(): void;
};

type ElectronBrowserWindowStatic = {
  getAllWindows(): unknown[];
};

const { app, BrowserWindow } = require("electron") as {
  app: ElectronApp;
  BrowserWindow: ElectronBrowserWindowStatic;
};

import { state } from "./state";

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
