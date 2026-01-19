import { app, ipcMain } from "electron";

import { setupApp } from "./appSetup";
import { registerIpcBridge } from "./ipcBridge";
import { registerLifecycle, registerActivate } from "./lifecycle";
import { registerProtocols } from "./protocols";
import { registerSandboxIpc } from "./sandbox";
import { state } from "./state";
import { createWindow, registerMessagingIpc } from "./windows";
import {
  ensureWorkspaceScaffold,
  maybeMigrateJsonIntoProject,
  registerWorkspaceSelectionIpc,
} from "./workspace";
import { isExistingDirectory } from "./pathSafety";

const getTestProjectDir = (): string | null => {
  const raw = process.env.NW_WRLD_TEST_PROJECT_DIR;
  if (!raw || typeof raw !== "string") return null;
  const dir = raw.trim();
  if (!dir) return null;
  if (!isExistingDirectory(dir)) return null;
  return dir;
};

export function start() {
  setupApp();

  registerIpcBridge();
  registerSandboxIpc();
  registerMessagingIpc({ ipcMain });
  registerWorkspaceSelectionIpc({ createWindow });
  registerLifecycle({ createWindow });

  app.whenReady().then(async () => {
    registerProtocols();
    const testProjectDir = getTestProjectDir();
    if (testProjectDir) {
      state.currentProjectDir = testProjectDir;
      try {
        await ensureWorkspaceScaffold(testProjectDir);
      } catch {}
      try {
        maybeMigrateJsonIntoProject(testProjectDir);
      } catch {}
    } else {
      state.currentProjectDir = null;
    }
    registerActivate({ createWindow });
    createWindow(testProjectDir);
  });
}
