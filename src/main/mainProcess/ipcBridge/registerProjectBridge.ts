import { ipcMain } from "electron";

import { isExistingDirectory } from "../pathSafety";
import { getProjectDirForEvent } from "./projectContext";

export function registerProjectBridge(): void {
  ipcMain.on("bridge:project:getDir", (event) => {
    event.returnValue = getProjectDirForEvent(event);
  });
  ipcMain.on("bridge:project:isRequired", (event) => {
    event.returnValue = true;
  });
  ipcMain.on("bridge:project:isDirAvailable", (event) => {
    const projectDir = getProjectDirForEvent(event);
    event.returnValue = Boolean(projectDir && isExistingDirectory(projectDir));
  });
}

