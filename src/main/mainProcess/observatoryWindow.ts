import { BrowserWindow } from "electron";
import * as path from "node:path";

import { srcDir, state } from "./state";

let didCreateObservatoryWindow = false;

export function createObservatoryWindow(): BrowserWindow | null {
  if (didCreateObservatoryWindow) {
    return state.observatoryWindow as BrowserWindow | null;
  }

  didCreateObservatoryWindow = true;
  const observatoryWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(srcDir, "..", "dist", "runtime", "preload.js"),
      enableRemoteModule: false,
      backgroundThrottling: false,
    } as unknown as Electron.WebPreferences,
    width: 1280,
    height: 840,
    title: "Observatory — Route Atlas",
    show: false,
    paintWhenInitiallyHidden: true,
  });

  observatoryWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  observatoryWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:") && url !== "about:blank") event.preventDefault();
  });
  observatoryWindow.webContents.on("will-redirect", (event, url) => {
    if (!url.startsWith("file:") && url !== "about:blank") event.preventDefault();
  });

  state.observatoryWindow = observatoryWindow;
  state.observatoryWindowWebContentsId = observatoryWindow.webContents.id;

  observatoryWindow.once("ready-to-show", () => {
    if (process.env.NW_WRLD_TEST_HEADLESS !== "1" && !observatoryWindow.isDestroyed()) {
      observatoryWindow.show();
    }
  });

  observatoryWindow.loadFile(path.join(srcDir, "observatory", "views", "atlas.html"));
  observatoryWindow.on("closed", () => {
    state.observatoryWindow = null;
    state.observatoryWindowWebContentsId = null;
  });

  return observatoryWindow;
}
