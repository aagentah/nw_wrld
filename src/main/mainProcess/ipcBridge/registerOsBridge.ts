import { clipboard, ipcMain, shell } from "electron";

import { normalizeOpenExternalUrl } from "../../../shared/validation/openExternalValidation";

export function registerOsBridge(): void {
  ipcMain.on("bridge:os:clipboardWriteText", (event, text) => {
    try {
      clipboard.writeText(String(text ?? ""));
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.on("bridge:os:clipboardReadText", (event) => {
    try {
      event.returnValue = clipboard.readText();
    } catch {
      event.returnValue = "";
    }
  });

  ipcMain.on("bridge:os:openExternal", (event, url) => {
    try {
      const normalized = normalizeOpenExternalUrl(url);
      if (!normalized) {
        event.returnValue = false;
        return;
      }
      shell.openExternal(normalized).catch(() => {});
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });
}

