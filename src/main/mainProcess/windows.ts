import { BrowserWindow, app, screen } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import InputManager from "../InputManager";
import { DEFAULT_INPUT_CONFIG, DEFAULT_USER_DATA } from "../../shared/config/defaultConfig";
import { sanitizeJsonForBridge } from "../../shared/validation/jsonBridgeValidation";
import { normalizeDashboardProjectorMessage } from "../../shared/validation/dashboardProjectorIpcValidation";
import { srcDir, state } from "./state";
import { getProjectJsonDirForMain, startWorkspaceWatcher } from "./workspace";
import { destroySandboxView, updateSandboxViewBounds } from "./sandbox";

type WebContentsWithId = { id?: unknown };
type SenderEvent = { sender?: WebContentsWithId };
type Jsonish = string | number | boolean | null | undefined | object;

const isTestHeadless = process.env.NW_WRLD_TEST_HEADLESS === "1";

const getProjectorAspectRatioValue = (aspectRatioId: unknown): number => {
  const id = String(aspectRatioId || "").trim();
  if (!id || id === "default" || id === "landscape") return 0;
  if (id === "16-9") return 16 / 9;
  if (id === "9-16") return 9 / 16;
  if (id === "4-5") return 4 / 5;
  return 0;
};

export const applyProjectorWindowAspectRatio = (aspectRatioId: unknown): void => {
  const win = state.projector1Window as {
    isDestroyed?: unknown;
    setAspectRatio?: unknown;
    getBounds?: unknown;
    setBounds?: unknown;
  } | null;
  if (!win || typeof win.isDestroyed !== "function" || win.isDestroyed()) return;

  const id = String(aspectRatioId || "").trim();

  try {
    if (typeof win.setAspectRatio === "function") {
      win.setAspectRatio(getProjectorAspectRatioValue(aspectRatioId));
    }
  } catch {}

  if (id === "fullscreen") {
    try {
      if (typeof win.getBounds === "function" && typeof win.setBounds === "function") {
        const bounds = win.getBounds();
        const display = screen.getDisplayMatching(bounds as Electron.Rectangle);
        const workArea = (display as { workArea?: unknown })?.workArea || bounds;
        win.setBounds(
          {
            x: (workArea as Electron.Rectangle).x,
            y: (workArea as Electron.Rectangle).y,
            width: (workArea as Electron.Rectangle).width,
            height: (workArea as Electron.Rectangle).height,
          },
          false
        );
      }
    } catch {}
    return;
  }

  const ratio = getProjectorAspectRatioValue(aspectRatioId);

  if (!ratio) {
    if ((id === "default" || id === "landscape" || !id) && state.projectorDefaultBounds) {
      try {
        if (typeof win.setBounds === "function") {
          win.setBounds(state.projectorDefaultBounds as Electron.Rectangle, false);
        }
      } catch {}
    }
    return;
  }

  try {
    if (typeof win.getBounds !== "function" || typeof win.setBounds !== "function") return;
    const bounds = win.getBounds() as Electron.Rectangle;
    const display = screen.getDisplayMatching(bounds);
    const workArea = (display as { workArea?: unknown })?.workArea || bounds;

    const available = {
      x: (workArea as Electron.Rectangle).x,
      y: (workArea as Electron.Rectangle).y,
      width: (workArea as Electron.Rectangle).width,
      height: (workArea as Electron.Rectangle).height,
    };

    const MIN_SIZE = 200;
    const safeAvailWidth = Math.max(MIN_SIZE, Math.floor(available.width || 0));
    const safeAvailHeight = Math.max(MIN_SIZE, Math.floor(available.height || 0));

    let nextWidth: number;
    let nextHeight: number;

    if (ratio >= 1) {
      nextWidth = Math.max(MIN_SIZE, safeAvailWidth);
      nextHeight = Math.max(MIN_SIZE, Math.floor(nextWidth / ratio));
      if (nextHeight > safeAvailHeight) {
        nextHeight = Math.max(MIN_SIZE, safeAvailHeight);
        nextWidth = Math.max(MIN_SIZE, Math.floor(nextHeight * ratio));
      }
    } else {
      nextHeight = Math.max(MIN_SIZE, safeAvailHeight);
      nextWidth = Math.max(MIN_SIZE, Math.floor(nextHeight * ratio));
      if (nextWidth > safeAvailWidth) {
        nextWidth = Math.max(MIN_SIZE, safeAvailWidth);
        nextHeight = Math.max(MIN_SIZE, Math.floor(nextWidth / ratio));
      }
    }

    const centerX = available.x + Math.round(available.width / 2);
    const centerY = available.y + Math.round(available.height / 2);

    const maxX = available.x + safeAvailWidth - nextWidth;
    const maxY = available.y + safeAvailHeight - nextHeight;

    let nextX = ratio < 1 ? maxX : centerX - Math.round(nextWidth / 2);
    let nextY = centerY - Math.round(nextHeight / 2);

    nextX = Math.max(available.x, Math.min(nextX, maxX));
    nextY = Math.max(available.y, Math.min(nextY, maxY));

    win.setBounds(
      {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      },
      false
    );
  } catch {}
};

export const getProjectDirForEvent = (event: SenderEvent): string | null => {
  try {
    const senderId = event?.sender?.id;
    if (typeof senderId === "number" && state.webContentsToProjectDir.has(senderId)) {
      return state.webContentsToProjectDir.get(senderId) || null;
    }
  } catch {}
  return state.currentProjectDir || null;
};

export function loadConfig(projectDir: string | null): unknown {
  const baseDir = getProjectJsonDirForMain(projectDir);
  if (!baseDir) return DEFAULT_USER_DATA;
  const configPath = path.join(baseDir, "userData.json");

  try {
    const data = fs.readFileSync(configPath, "utf-8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch (parseErr) {
      const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error("[Main] JSON parse error - config file is corrupted:", message);
      try {
        const corruptPath = `${configPath}.corrupt.${Date.now()}`;
        fs.writeFileSync(corruptPath, data, "utf-8");
      } catch {}
      try {
        const backupData = fs.readFileSync(`${configPath}.backup`, "utf-8");
        const backupParsed = JSON.parse(backupData) as unknown;
        return sanitizeJsonForBridge(
          "userData.json",
          backupParsed as Jsonish,
          DEFAULT_USER_DATA as unknown as Jsonish
        );
      } catch {}
      console.error("[Main] Using default configuration");
      return DEFAULT_USER_DATA;
    }

    try {
      return sanitizeJsonForBridge(
        "userData.json",
        parsed as Jsonish,
        DEFAULT_USER_DATA as unknown as Jsonish
      );
    } catch (sanitizeErr) {
      const message = sanitizeErr instanceof Error ? sanitizeErr.message : String(sanitizeErr);
      console.error("[Main] Config sanitization error:", message);
      console.error("[Main] Using default configuration");
      return DEFAULT_USER_DATA;
    }
  } catch (readErr) {
    const code =
      readErr && typeof readErr === "object" && "code" in readErr
        ? (readErr as { code?: unknown }).code
        : null;
    if (code === "ENOENT") {
      console.warn("[Main] Config file not found, using defaults");
    } else {
      const message = readErr instanceof Error ? readErr.message : String(readErr);
      console.error("[Main] Failed to read config file:", message);
    }
    return DEFAULT_USER_DATA;
  }
}

export function registerMessagingIpc({ ipcMain }: { ipcMain: Electron.IpcMain }): void {
  const messageChannels: Record<string, (data: unknown) => void> = {
    "dashboard-to-projector": (data) => {
      const msg = normalizeDashboardProjectorMessage(data);
      if (!msg) return;
      try {
        if (msg.type === "toggleAspectRatioStyle") {
          applyProjectorWindowAspectRatio((msg.props as { name?: unknown } | null)?.name);
        }
      } catch {}
      const projector = state.projector1Window as {
        isDestroyed?: unknown;
        webContents?: { isDestroyed?: unknown; send?: unknown };
      } | null;
      if (
        projector &&
        typeof projector.isDestroyed === "function" &&
        !projector.isDestroyed() &&
        projector.webContents &&
        typeof projector.webContents.isDestroyed === "function" &&
        !projector.webContents.isDestroyed() &&
        typeof projector.webContents.send === "function"
      ) {
        projector.webContents.send("from-dashboard", msg);
      }
    },
    "projector-to-dashboard": (data) => {
      const dashboard = state.dashboardWindow as {
        isDestroyed?: unknown;
        webContents?: { isDestroyed?: unknown; send?: unknown };
      } | null;
      if (
        dashboard &&
        typeof dashboard.isDestroyed === "function" &&
        !dashboard.isDestroyed() &&
        dashboard.webContents &&
        typeof dashboard.webContents.isDestroyed === "function" &&
        !dashboard.webContents.isDestroyed() &&
        typeof dashboard.webContents.send === "function"
      ) {
        dashboard.webContents.send("from-projector", data);
      }
    },
  };

  Object.entries(messageChannels).forEach(([channel, handler]) => {
    ipcMain.on(channel, (event, data) => {
      handler(data);
    });
  });
}

export function createWindow(projectDir: string | null): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const { x: screenX, y: screenY } = primaryDisplay.workArea;

  const halfWidth = Math.floor(screenWidth / 2);
  const additionalArgs = ["--nwWrldRequireProject=1"];
  if (projectDir && typeof projectDir === "string") {
    additionalArgs.push(`--nwWrldProjectDir=${projectDir}`);
  }

  state.projector1Window = new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(srcDir, "..", "dist", "runtime", "preload.js"),
      enableRemoteModule: false,
      backgroundThrottling: false,
      webgl: true,
      enableHardwareAcceleration: true,
      additionalArguments: additionalArgs,
      pageVisibility: true,
      autoplayPolicy: "no-user-gesture-required",
    } as unknown as Electron.WebPreferences,
    x: screenX + halfWidth,
    y: screenY,
    width: halfWidth,
    height: screenHeight,
    title: "Projector 1",
    show: false,
    paintWhenInitiallyHidden: true,
    frame: false,
  });

  try {
    const win = state.projector1Window as { getBounds?: unknown };
    if (typeof win.getBounds === "function") {
      state.projectorDefaultBounds = win.getBounds();
    }
  } catch {}

  try {
    const initialConfig = loadConfig(projectDir) as { config?: { aspectRatio?: unknown } };
    applyProjectorWindowAspectRatio(initialConfig?.config?.aspectRatio);
  } catch {}

  try {
    const win = state.projector1Window as { once?: unknown; show?: unknown };
    if (typeof win.once === "function" && typeof win.show === "function") {
      win.once("ready-to-show", () => {
        if (!isTestHeadless) {
          (state.projector1Window as { show: () => void }).show();
        }
      });
    }
  } catch {}

  (state.projector1Window as BrowserWindow).loadFile(
    path.join(srcDir, "projector", "views", "projector.html")
  );
  (state.projector1Window as BrowserWindow).on("resize", () => {
    updateSandboxViewBounds();
  });
  (state.projector1Window as BrowserWindow).on("closed", () => {
    try {
      destroySandboxView();
    } catch {}
  });

  state.dashboardWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(srcDir, "..", "dist", "runtime", "preload.js"),
      enableHardwareAcceleration: true,
      backgroundThrottling: false,
      additionalArguments: additionalArgs,
    } as unknown as Electron.WebPreferences,
    x: screenX,
    y: screenY,
    width: halfWidth,
    height: screenHeight,
    title: "nw_wrld",
    show: false,
    paintWhenInitiallyHidden: true,
  });

  try {
    const win = state.dashboardWindow as { once?: unknown; show?: unknown };
    if (typeof win.once === "function" && typeof win.show === "function") {
      win.once("ready-to-show", () => {
        if (!isTestHeadless) {
          (state.dashboardWindow as { show: () => void }).show();
        }
      });
    }
  } catch {}

  try {
    const wcId = (state.dashboardWindow as { webContents?: { id?: unknown } })?.webContents?.id;
    if (wcId != null) {
      state.webContentsToProjectDir.set(wcId as number, projectDir || null);
      (state.dashboardWindow as BrowserWindow).on("closed", () => {
        try {
          state.webContentsToProjectDir.delete(wcId as number);
        } catch {}
      });
    }
  } catch {}

  try {
    const wcId = (state.projector1Window as { webContents?: { id?: unknown } })?.webContents?.id;
    if (wcId != null) {
      state.webContentsToProjectDir.set(wcId as number, projectDir || null);
      (state.projector1Window as BrowserWindow).on("closed", () => {
        try {
          state.webContentsToProjectDir.delete(wcId as number);
        } catch {}
      });
    }
  } catch {}

  (state.dashboardWindow as BrowserWindow).loadFile(
    path.join(srcDir, "dashboard", "views", "dashboard.html")
  );

  (state.dashboardWindow as BrowserWindow).webContents.once("did-finish-load", () => {
    const fullConfig = loadConfig(projectDir) as { config?: unknown };
    state.inputManager = new InputManager(
      state.dashboardWindow as unknown as ConstructorParameters<typeof InputManager>[0],
      state.projector1Window as unknown as ConstructorParameters<typeof InputManager>[1]
    );
    const cfg =
      fullConfig && typeof fullConfig === "object" && "config" in fullConfig
        ? (fullConfig as { config?: unknown }).config
        : null;
    const inputConfigRaw =
      cfg && typeof cfg === "object" && "input" in cfg
        ? (cfg as { input?: unknown }).input
        : undefined;
    const sequencerMode =
      cfg && typeof cfg === "object" && "sequencerMode" in cfg
        ? (cfg as { sequencerMode?: unknown }).sequencerMode
        : null;
    const inputConfig = (inputConfigRaw ?? DEFAULT_INPUT_CONFIG) as Parameters<
      InputManager["initialize"]
    >[0];
    if (sequencerMode !== true) {
      (state.inputManager as InputManager).initialize(inputConfig).catch((err) => {
        console.error("[Main] Failed to initialize InputManager:", err);
      });
    }
  });

  if (projectDir && typeof projectDir === "string") {
    startWorkspaceWatcher(projectDir);
  }

  if (!state.didRegisterAppLifecycleHandlers) {
    state.didRegisterAppLifecycleHandlers = true;
    app.on("window-all-closed", function () {
      if (process.platform !== "darwin") app.quit();
    });
  }
}
