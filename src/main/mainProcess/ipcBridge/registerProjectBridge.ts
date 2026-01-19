import { ipcMain } from "electron";

import { isExistingDirectory } from "../pathSafety";
import { getProjectDirForEvent, type SenderEvent } from "./projectContext";

export function registerProjectBridge(): void {
  ipcMain.on("bridge:project:getDir", (event) => {
    event.returnValue = getProjectDirForEvent(event as unknown as SenderEvent);
  });
  ipcMain.on("bridge:project:isRequired", (event) => {
    event.returnValue = true;
  });
  ipcMain.on("bridge:project:isDirAvailable", (event) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    event.returnValue = Boolean(projectDir && isExistingDirectory(projectDir));
  });
}

