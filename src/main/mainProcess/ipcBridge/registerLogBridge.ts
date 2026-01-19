import { ipcMain } from "electron";

export function registerLogBridge(): void {
  ipcMain.on("log-to-main", (event, message) => {
    console.log(message);
  });
}

