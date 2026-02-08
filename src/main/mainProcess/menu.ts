import { Menu, ipcMain, BrowserWindow } from "electron";

import { state } from "./state";

const { app } = require("electron") as { app: { name: string } };

// Module-level handler functions for menu actions
function openSettingsHandler() {
  try {
    const dashboard = state.dashboardWindow as BrowserWindow | null;
    if (dashboard && !dashboard.isDestroyed()) {
      dashboard.show();
      dashboard.focus();
      dashboard.webContents.send("menu:openSettings");
    }
  } catch {}
}

function setAspectRatioHandler(aspectRatioId: string) {
  try {
    ipcMain.emit("dashboard-to-projector", null, {
      type: "toggleAspectRatioStyle",
      props: { name: aspectRatioId },
    });
  } catch {}
}

export function registerMenuHandlers(): void {
  // Handler to open settings modal
  ipcMain.on("menu:openSettings", () => {
    openSettingsHandler();
  });

  // Handler to set aspect ratio
  ipcMain.on("menu:setAspectRatio", (_event, aspectRatioId: string) => {
    setAspectRatioHandler(aspectRatioId);
  });
}

export function createApplicationMenu(): void {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    // Window menu
    {
      label: "Window",
      submenu: [
        {
          label: "Settings...",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            openSettingsHandler();
          },
        },
        { type: "separator" as const },
        {
          label: "Set Pane Size",
          submenu: [
            {
              label: "Default",
              click: () => {
                setAspectRatioHandler("default");
              },
            },
            {
              label: "16:9 (Landscape)",
              click: () => {
                setAspectRatioHandler("16-9");
              },
            },
            {
              label: "9:16 (Vertical)",
              click: () => {
                setAspectRatioHandler("9-16");
              },
            },
            {
              label: "4:5 (Portrait)",
              click: () => {
                setAspectRatioHandler("4-5");
              },
            },
            { type: "separator" as const },
            {
              label: "Fullscreen",
              click: () => {
                setAspectRatioHandler("fullscreen");
              },
            },
          ],
        },
        { type: "separator" as const },
        { role: "reload" as const },
        { role: "forceReload" as const },
        { role: "toggleDevTools" as const },
        ...(isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const },
            ]
          : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
