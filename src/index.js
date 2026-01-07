const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  protocol,
  screen,
  nativeImage,
  dialog,
  clipboard,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const InputManager = require("./main/InputManager");
const {
  atomicWriteFile,
  atomicWriteFileSync,
} = require("./shared/json/atomicWrite.cjs");
const {
  ensureWorkspaceStarterModules,
} = require("./main/workspaceStarterModules");
const {
  ensureWorkspaceStarterAssets,
} = require("./main/workspaceStarterAssets");
const { DEFAULT_USER_DATA } = require("./shared/config/defaultConfig");
const { parseNwWrldDocblockMetadata } = require("./shared/nwWrldDocblock");

app.setName("nw_wrld");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "nw-sandbox",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: "nw-assets",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

if (process.platform === "darwin") {
  app.setAboutPanelOptions({
    applicationName: "nw_wrld",
    applicationVersion: app.getVersion(),
  });
}

let projector1Window;
let dashboardWindow;
let inputManager;
let workspaceWatcher = null;
let workspaceWatcherDebounce = null;
let currentWorkspacePath = null;
let currentProjectDir = null;
let didRegisterAppLifecycleHandlers = false;
const webContentsToProjectDir = new Map();
const sandboxTokenToProjectDir = new Map();
const sandboxOwnerWebContentsIdToTokens = new Map(); // ownerWebContentsId -> Set<token>
const sandboxOwnerCleanupHooked = new Set(); // ownerWebContentsId
let sandboxView = null;
let sandboxViewWebContentsId = null;
let activeSandboxToken = null;
let sandboxEnsureInFlight = null;
let projectorDefaultBounds = null;
const pendingSandboxRequests = new Map(); // requestId -> { resolve, timeout }

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForWorkspaceSettle = async (modulesDir, filename) => {
  const maxAttempts = 6;
  const intervalMs = 120;
  const target =
    filename && typeof filename === "string"
      ? path.join(modulesDir, filename)
      : null;

  let prevSig = null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      if (target) {
        const stat = await fs.promises.stat(target);
        const sig = `${stat.size}:${stat.mtimeMs}`;
        if (prevSig && sig === prevSig) return;
        prevSig = sig;
      } else {
        const entries = await fs.promises.readdir(modulesDir);
        const jsFiles = entries.filter((f) => f.endsWith(".js"));
        const stats = await Promise.all(
          jsFiles.map(async (f) => {
            try {
              const s = await fs.promises.stat(path.join(modulesDir, f));
              return `${f}:${s.size}:${s.mtimeMs}`;
            } catch {
              return `${f}:missing`;
            }
          })
        );
        const sig = stats.sort().join("|");
        if (prevSig && sig === prevSig) return;
        prevSig = sig;
      }
    } catch {
      return;
    }
    await delay(intervalMs);
  }
};

const getLegacyJsonDirForMain = () =>
  path.join(__dirname, "..", "src", "shared", "json");

const isExistingDirectory = (dirPath) => {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
};

const resolveWithinDir = (baseDir, relPath) => {
  if (!baseDir || typeof baseDir !== "string") return null;
  if (!relPath || typeof relPath !== "string") return null;
  const safeRel = String(relPath).replace(/^[/\\]+/, "");
  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(resolvedBase, safeRel);
  const baseWithSep = resolvedBase.endsWith(path.sep)
    ? resolvedBase
    : `${resolvedBase}${path.sep}`;
  if (!resolved.startsWith(baseWithSep) && resolved !== resolvedBase) {
    return null;
  }

  try {
    if (fs.existsSync(resolvedBase)) {
      try {
        if (fs.lstatSync(resolvedBase).isSymbolicLink()) return null;
      } catch {
        return null;
      }

      const baseReal = fs.realpathSync(resolvedBase);
      const baseRealWithSep = baseReal.endsWith(path.sep)
        ? baseReal
        : `${baseReal}${path.sep}`;

      const relFromBase = path.relative(resolvedBase, resolved);
      const parts = relFromBase
        .split(path.sep)
        .map((p) => String(p || "").trim())
        .filter(Boolean)
        .filter((p) => p !== ".");

      let cursor = resolvedBase;
      for (const part of parts) {
        cursor = path.join(cursor, part);
        if (!fs.existsSync(cursor)) break;
        try {
          if (fs.lstatSync(cursor).isSymbolicLink()) return null;
        } catch {
          return null;
        }
      }

      if (fs.existsSync(resolved)) {
        const targetReal = fs.realpathSync(resolved);
        if (
          !(targetReal === baseReal || targetReal.startsWith(baseRealWithSep))
        ) {
          return null;
        }
      } else {
        const parent = path.dirname(resolved);
        if (fs.existsSync(parent)) {
          const parentReal = fs.realpathSync(parent);
          if (
            !(parentReal === baseReal || parentReal.startsWith(baseRealWithSep))
          ) {
            return null;
          }
        }
      }
    }
  } catch {
    return null;
  }
  return resolved;
};

const safeModuleName = (moduleName) => {
  const safe = String(moduleName || "").trim();
  if (!safe) return null;
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(safe)) return null;
  return safe;
};

const safeJsonFilename = (filename) => {
  const safe = String(filename || "").trim();
  if (!safe) return null;
  if (
    safe !== "userData.json" &&
    safe !== "appState.json" &&
    safe !== "config.json" &&
    safe !== "recordingData.json"
  ) {
    return null;
  }
  return safe;
};

const getProjectDirForEvent = (event) => {
  try {
    const senderId = event?.sender?.id;
    if (typeof senderId === "number" && webContentsToProjectDir.has(senderId)) {
      return webContentsToProjectDir.get(senderId) || null;
    }
  } catch {}
  return currentProjectDir || null;
};

const registerSandboxToken = (event, token, projectDir) => {
  const safeToken = String(token || "").trim();
  if (!safeToken) return { ok: false, reason: "INVALID_TOKEN" };
  const ownerWebContentsId =
    typeof event?.sender?.id === "number" ? event.sender.id : null;
  if (ownerWebContentsId == null)
    return { ok: false, reason: "INVALID_SENDER" };

  sandboxTokenToProjectDir.set(safeToken, {
    projectDir,
    ownerWebContentsId,
    createdAt: Date.now(),
  });

  if (!sandboxOwnerWebContentsIdToTokens.has(ownerWebContentsId)) {
    sandboxOwnerWebContentsIdToTokens.set(ownerWebContentsId, new Set());
  }
  sandboxOwnerWebContentsIdToTokens.get(ownerWebContentsId).add(safeToken);

  if (!sandboxOwnerCleanupHooked.has(ownerWebContentsId)) {
    sandboxOwnerCleanupHooked.add(ownerWebContentsId);
    try {
      event.sender.once("destroyed", () => {
        const tokens =
          sandboxOwnerWebContentsIdToTokens.get(ownerWebContentsId);
        if (tokens && tokens.size) {
          for (const t of tokens) {
            try {
              sandboxTokenToProjectDir.delete(t);
            } catch {}
          }
        }
        try {
          sandboxOwnerWebContentsIdToTokens.delete(ownerWebContentsId);
        } catch {}
        try {
          sandboxOwnerCleanupHooked.delete(ownerWebContentsId);
        } catch {}
      });
    } catch {}
  }

  return { ok: true };
};

const unregisterSandboxToken = (token) => {
  const safeToken = String(token || "").trim();
  if (!safeToken) return false;
  const entry = sandboxTokenToProjectDir.get(safeToken) || null;
  const ownerWebContentsId =
    entry && typeof entry.ownerWebContentsId === "number"
      ? entry.ownerWebContentsId
      : null;
  try {
    sandboxTokenToProjectDir.delete(safeToken);
  } catch {}
  if (typeof ownerWebContentsId === "number") {
    const tokens = sandboxOwnerWebContentsIdToTokens.get(ownerWebContentsId);
    if (tokens) {
      try {
        tokens.delete(safeToken);
      } catch {}
      if (tokens.size === 0) {
        try {
          sandboxOwnerWebContentsIdToTokens.delete(ownerWebContentsId);
        } catch {}
      }
    }
  }
  return true;
};

const getFallbackJsonDirForMain = () => path.join(__dirname, "shared", "json");

const getJsonStatusForProject = (projectDir) => {
  if (!projectDir) {
    return { ok: false, reason: "NO_PROJECT_SELECTED", projectDir: null };
  }
  if (!isExistingDirectory(projectDir)) {
    return { ok: false, reason: "PROJECT_DIR_MISSING", projectDir };
  }
  return { ok: true, projectDir };
};

const getJsonDirForBridge = (projectDir) => {
  const status = getJsonStatusForProject(projectDir);
  if (!status.ok) {
    return getFallbackJsonDirForMain();
  }
  return getProjectJsonDirForMain(projectDir) || getFallbackJsonDirForMain();
};

const maybeMigrateLegacyJsonFileForBridge = (projectDir, filename) => {
  const destDir = getProjectJsonDirForMain(projectDir);
  if (!destDir) return;
  const legacyDir = getFallbackJsonDirForMain();
  if (destDir === legacyDir) return;
  const destPath = path.join(destDir, filename);
  if (fs.existsSync(destPath)) return;
  const legacyPath = path.join(legacyDir, filename);
  if (!fs.existsSync(legacyPath)) return;
  try {
    fs.copyFileSync(legacyPath, destPath);
    const legacyBackupPath = `${legacyPath}.backup`;
    const destBackupPath = `${destPath}.backup`;
    if (!fs.existsSync(destBackupPath) && fs.existsSync(legacyBackupPath)) {
      fs.copyFileSync(legacyBackupPath, destBackupPath);
    }
  } catch {}
};

// IPC bridge handlers (preload-safe: preload itself does not use fs/path)
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

ipcMain.on("bridge:sandbox:registerToken", (event, token) => {
  const projectDir = getProjectDirForEvent(event);
  if (!projectDir || !isExistingDirectory(projectDir)) {
    event.returnValue = { ok: false, reason: "PROJECT_DIR_MISSING" };
    return;
  }
  event.returnValue = registerSandboxToken(event, token, projectDir);
});

ipcMain.on("bridge:sandbox:unregisterToken", (event, token) => {
  event.returnValue = unregisterSandboxToken(token);
});

ipcMain.handle("bridge:workspace:listModuleFiles", async (event) => {
  const projectDir = getProjectDirForEvent(event);
  if (!projectDir || !isExistingDirectory(projectDir)) return [];
  const modulesDir = path.join(projectDir, "modules");
  try {
    const entries = await fs.promises.readdir(modulesDir);
    return entries.filter((f) => String(f).endsWith(".js"));
  } catch {
    return [];
  }
});

const MODULE_METADATA_MAX_BYTES = 16 * 1024;
const SANDBOX_ASSET_TEXT_MAX_BYTES = 2 * 1024 * 1024;

const readFileHeadUtf8 = async (filePath, maxBytes) => {
  let fh;
  try {
    fh = await fs.promises.open(filePath, "r");
    const buf = Buffer.alloc(Math.max(0, Number(maxBytes) || 0));
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    return buf.slice(0, bytesRead).toString("utf-8");
  } catch {
    return "";
  } finally {
    try {
      await fh?.close?.();
    } catch {}
  }
};

const readFileUtf8WithLimit = async (filePath, maxBytes) => {
  try {
    const stat = await fs.promises.stat(filePath);
    const limit = Math.max(0, Number(maxBytes) || 0);
    if (limit && stat.size > limit) return null;
    return await fs.promises.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
};

const updateSandboxViewBounds = () => {
  if (!sandboxView || !projector1Window || projector1Window.isDestroyed()) {
    return;
  }
  try {
    const [width, height] = projector1Window.getContentSize();
    sandboxView.setBounds({ x: 0, y: 0, width, height });
  } catch {}
};

const destroySandboxView = () => {
  if (!sandboxView) return;
  try {
    projector1Window?.setBrowserView?.(null);
  } catch {}
  try {
    sandboxView?.webContents?.destroy?.();
  } catch {}
  sandboxView = null;
  sandboxViewWebContentsId = null;
};

const ensureSandboxView = (projectDir) => {
  if (!projector1Window || projector1Window.isDestroyed()) return null;
  if (
    sandboxView &&
    sandboxView.webContents &&
    !sandboxView.webContents.isDestroyed()
  ) {
    try {
      projector1Window.setBrowserView(sandboxView);
      updateSandboxViewBounds();
    } catch {}
    return sandboxView;
  }

  try {
    destroySandboxView();
  } catch {}

  sandboxView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "sandboxPreload.js"),
      enableRemoteModule: false,
      backgroundThrottling: false,
      webgl: true,
      enableHardwareAcceleration: true,
      additionalArguments: [
        "--nwWrldRequireProject=1",
        projectDir && typeof projectDir === "string"
          ? `--nwWrldProjectDir=${projectDir}`
          : null,
      ].filter(Boolean),
    },
  });

  try {
    const wc = sandboxView.webContents;
    sandboxViewWebContentsId = typeof wc?.id === "number" ? wc.id : null;
    wc.on("render-process-gone", () => {
      try {
        if (activeSandboxToken) {
          try {
            unregisterSandboxToken(activeSandboxToken);
          } catch {}
        }
        sandboxViewWebContentsId = null;
        activeSandboxToken = null;
        destroySandboxView();
      } catch {}
    });
    wc.on("unresponsive", () => {
      try {
        if (activeSandboxToken) {
          try {
            unregisterSandboxToken(activeSandboxToken);
          } catch {}
        }
        sandboxViewWebContentsId = null;
        activeSandboxToken = null;
        destroySandboxView();
      } catch {}
    });
  } catch {}

  try {
    projector1Window.setBrowserView(sandboxView);
    updateSandboxViewBounds();
  } catch {}

  return sandboxView;
};

const isProjectorEvent = (event) => {
  try {
    const senderId = event?.sender?.id;
    return (
      typeof senderId === "number" &&
      projector1Window &&
      !projector1Window.isDestroyed() &&
      projector1Window.webContents &&
      !projector1Window.webContents.isDestroyed() &&
      senderId === projector1Window.webContents.id
    );
  } catch {
    return false;
  }
};

const sandboxRequestAllowedTypes = new Set([
  "initTrack",
  "invokeOnInstance",
  "introspectModule",
  "destroyTrack",
  "setMatrixForInstance",
]);

const sendToSandbox = (payload) => {
  if (
    !sandboxView ||
    !sandboxView.webContents ||
    sandboxView.webContents.isDestroyed()
  ) {
    return false;
  }
  try {
    sandboxView.webContents.send("sandbox:fromMain", payload);
    return true;
  } catch {
    return false;
  }
};

const destroySandboxForProjector = (ownerWebContentsId) => {
  if (activeSandboxToken) {
    try {
      unregisterSandboxToken(activeSandboxToken);
    } catch {}
    activeSandboxToken = null;
  }

  if (typeof ownerWebContentsId === "number") {
    const tokens = sandboxOwnerWebContentsIdToTokens.get(ownerWebContentsId);
    if (tokens && tokens.size) {
      for (const t of tokens) {
        try {
          unregisterSandboxToken(t);
        } catch {}
      }
    }
  }

  for (const [requestId, entry] of pendingSandboxRequests.entries()) {
    try {
      clearTimeout(entry.timeout);
    } catch {}
    try {
      entry.resolve({ ok: false, error: "SANDBOX_DESTROYED" });
    } catch {}
    pendingSandboxRequests.delete(requestId);
  }

  try {
    destroySandboxView();
  } catch {}
};

ipcMain.handle("sandbox:ensure", async (event) => {
  if (!isProjectorEvent(event)) return { ok: false, reason: "FORBIDDEN" };
  const projectDir = getProjectDirForEvent(event);
  if (!projectDir || !isExistingDirectory(projectDir)) {
    return { ok: false, reason: "PROJECT_DIR_MISSING" };
  }

  if (sandboxEnsureInFlight) {
    try {
      await sandboxEnsureInFlight;
    } catch {}
  }

  const view = ensureSandboxView(projectDir);
  if (!view || !view.webContents || view.webContents.isDestroyed()) {
    return { ok: false, reason: "SANDBOX_VIEW_UNAVAILABLE" };
  }

  if (activeSandboxToken) {
    const entry = sandboxTokenToProjectDir.get(activeSandboxToken) || null;
    if (entry?.projectDir === projectDir) {
      return { ok: true, token: activeSandboxToken };
    }
    try {
      unregisterSandboxToken(activeSandboxToken);
    } catch {}
    activeSandboxToken = null;
  }

  const p = (async () => {
    const token = `nw_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    const reg = registerSandboxToken(event, token, projectDir);
    if (!reg || reg.ok !== true) {
      return { ok: false, reason: reg?.reason || "TOKEN_REGISTER_FAILED" };
    }

    const url = `nw-sandbox://app/moduleSandbox.html#token=${encodeURIComponent(
      token
    )}`;
    try {
      await view.webContents.loadURL(url);
    } catch (e) {
      unregisterSandboxToken(token);
      return { ok: false, reason: "SANDBOX_LOAD_FAILED" };
    }

    activeSandboxToken = token;
    return { ok: true, token };
  })();

  sandboxEnsureInFlight = p;
  try {
    return await p;
  } finally {
    if (sandboxEnsureInFlight === p) sandboxEnsureInFlight = null;
  }
});

ipcMain.handle("sandbox:destroy", async (event) => {
  if (!isProjectorEvent(event)) return { ok: false, reason: "FORBIDDEN" };
  const ownerId =
    typeof event?.sender?.id === "number" ? event.sender.id : null;
  destroySandboxForProjector(ownerId);
  return { ok: true };
});

ipcMain.handle("sandbox:request", async (event, payload) => {
  if (!isProjectorEvent(event)) return { ok: false, error: "FORBIDDEN" };
  const ownerId =
    typeof event?.sender?.id === "number" ? event.sender.id : null;
  const token = String(payload?.token || "").trim();
  const type = String(payload?.type || "").trim();
  const props = payload?.props || {};
  if (!token) return { ok: false, error: "INVALID_TOKEN" };
  if (!type || !sandboxRequestAllowedTypes.has(type)) {
    return { ok: false, error: "INVALID_TYPE" };
  }
  const entry = sandboxTokenToProjectDir.get(token) || null;
  if (!entry || entry.ownerWebContentsId !== ownerId) {
    return { ok: false, error: "TOKEN_NOT_OWNED" };
  }

  const requestId = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const sent = sendToSandbox({
    __nwWrldSandbox: true,
    token,
    type,
    requestId,
    props,
  });
  if (!sent) return { ok: false, error: "SANDBOX_UNAVAILABLE" };

  return await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!pendingSandboxRequests.has(requestId)) return;
      pendingSandboxRequests.delete(requestId);
      resolve({ ok: false, error: "TIMEOUT" });
    }, 8000);
    pendingSandboxRequests.set(requestId, { resolve, timeout, token });
  });
});

ipcMain.on("sandbox:toMain", async (event, payload) => {
  const senderId =
    typeof event?.sender?.id === "number" ? event.sender.id : null;
  if (!senderId || senderId !== sandboxViewWebContentsId) return;
  const data = payload;
  if (!data || typeof data !== "object") return;

  const token = String(data.token || "").trim();
  const requestId = String(data.requestId || "").trim();
  if (!token || !requestId) return;

  if (data.__nwWrldSandboxResult) {
    const pending = pendingSandboxRequests.get(requestId);
    if (!pending) return;
    if (pending.token !== token) return;
    pendingSandboxRequests.delete(requestId);
    try {
      clearTimeout(pending.timeout);
    } catch {}
    try {
      pending.resolve(data.result);
    } catch {}
    return;
  }

  if (data.__nwWrldSandbox && data.type === "sdk:readAssetText") {
    if (!activeSandboxToken || token !== activeSandboxToken) {
      return;
    }
    const entry = sandboxTokenToProjectDir.get(token) || null;
    const projectDir = entry?.projectDir || null;
    const relPath = String(data.props?.relPath || "");
    let result = { ok: false, text: null };
    if (projectDir && isExistingDirectory(projectDir)) {
      const assetsDir = path.join(projectDir, "assets");
      const fullPath = resolveWithinDir(assetsDir, relPath);
      if (fullPath) {
        const text = await readFileUtf8WithLimit(
          fullPath,
          SANDBOX_ASSET_TEXT_MAX_BYTES
        );
        if (typeof text === "string") {
          result = { ok: true, text };
        }
      }
    }
    sendToSandbox({
      __nwWrldSandboxResult: true,
      token,
      requestId,
      result,
    });
  }
});

ipcMain.handle("bridge:workspace:listModuleSummaries", async (event) => {
  const projectDir = getProjectDirForEvent(event);
  if (!projectDir || !isExistingDirectory(projectDir)) return [];
  const modulesDir = path.join(projectDir, "modules");

  let entries = [];
  try {
    entries = await fs.promises.readdir(modulesDir);
  } catch {
    entries = [];
  }

  const jsFiles = entries.filter((f) => String(f).endsWith(".js"));

  const summaries = await Promise.all(
    jsFiles.map(async (file) => {
      const filename = String(file);
      const moduleId = filename.replace(/\.js$/i, "");
      const safe = safeModuleName(moduleId);
      if (!safe) return null;
      const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
      if (!fullPath) return null;

      const head = await readFileHeadUtf8(fullPath, MODULE_METADATA_MAX_BYTES);
      const meta = parseNwWrldDocblockMetadata(head, MODULE_METADATA_MAX_BYTES);

      return {
        file: filename,
        id: safe,
        name: meta.name,
        category: meta.category,
        hasMetadata: meta.hasMetadata,
      };
    })
  );

  return summaries.filter(Boolean);
});

ipcMain.handle(
  "bridge:workspace:readModuleWithMeta",
  async (event, moduleName) => {
    const projectDir = getProjectDirForEvent(event);
    if (!projectDir || !isExistingDirectory(projectDir)) return null;
    const safe = safeModuleName(moduleName);
    if (!safe) return null;
    const modulesDir = path.join(projectDir, "modules");
    const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
    if (!fullPath) return null;
    try {
      const [stat, text] = await Promise.all([
        fs.promises.stat(fullPath),
        fs.promises.readFile(fullPath, "utf-8"),
      ]);
      return { text, mtimeMs: stat.mtimeMs };
    } catch {
      return null;
    }
  }
);

ipcMain.handle("bridge:workspace:getModuleUrl", async (event, moduleName) => {
  const projectDir = getProjectDirForEvent(event);
  if (!projectDir || !isExistingDirectory(projectDir)) return null;
  const safe = safeModuleName(moduleName);
  if (!safe) return null;
  const modulesDir = path.join(projectDir, "modules");
  const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
  if (!fullPath) return null;
  try {
    const stat = await fs.promises.stat(fullPath);
    const url = `${pathToFileURL(fullPath).href}?t=${stat.mtimeMs}`;
    return { url, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
});

ipcMain.handle("bridge:workspace:readModuleText", async (event, moduleName) => {
  const projectDir = getProjectDirForEvent(event);
  if (!projectDir || !isExistingDirectory(projectDir)) return null;
  const safe = safeModuleName(moduleName);
  if (!safe) return null;
  const modulesDir = path.join(projectDir, "modules");
  const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
  if (!fullPath) return null;
  try {
    return await fs.promises.readFile(fullPath, "utf-8");
  } catch {
    return null;
  }
});

ipcMain.on(
  "bridge:workspace:writeModuleTextSync",
  (event, moduleName, text) => {
    const projectDir = getProjectDirForEvent(event);
    if (!projectDir || !isExistingDirectory(projectDir)) {
      event.returnValue = { ok: false, reason: "PROJECT_DIR_MISSING" };
      return;
    }
    const safe = safeModuleName(moduleName);
    if (!safe) {
      event.returnValue = { ok: false, reason: "INVALID_MODULE_NAME" };
      return;
    }
    const modulesDir = path.join(projectDir, "modules");
    const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
    if (!fullPath) {
      event.returnValue = { ok: false, reason: "INVALID_MODULE_PATH" };
      return;
    }
    try {
      try {
        fs.mkdirSync(modulesDir, { recursive: true });
      } catch {}
      atomicWriteFileSync(fullPath, String(text ?? ""));
      event.returnValue = { ok: true, path: fullPath };
    } catch (e) {
      event.returnValue = { ok: false, reason: e?.message || "WRITE_FAILED" };
    }
  }
);

ipcMain.on("bridge:workspace:moduleExists", (event, moduleName) => {
  const projectDir = getProjectDirForEvent(event);
  if (!projectDir || !isExistingDirectory(projectDir)) {
    event.returnValue = false;
    return;
  }
  const safe = safeModuleName(moduleName);
  if (!safe) {
    event.returnValue = false;
    return;
  }
  const modulesDir = path.join(projectDir, "modules");
  const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
  if (!fullPath) {
    event.returnValue = false;
    return;
  }
  try {
    event.returnValue = fs.existsSync(fullPath);
  } catch {
    event.returnValue = false;
  }
});

ipcMain.on("bridge:workspace:showModuleInFolder", (event, moduleName) => {
  const projectDir = getProjectDirForEvent(event);
  if (!projectDir || !isExistingDirectory(projectDir)) return;
  const safe = safeModuleName(moduleName);
  if (!safe) return;
  const modulesDir = path.join(projectDir, "modules");
  const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
  if (!fullPath) return;
  try {
    shell.showItemInFolder(fullPath);
  } catch {}
});

ipcMain.on("bridge:workspace:assetUrl", (event, relPath) => {
  const projectDir = getProjectDirForEvent(event);
  if (!projectDir || !isExistingDirectory(projectDir)) {
    event.returnValue = null;
    return;
  }
  const assetsDir = path.join(projectDir, "assets");
  const fullPath = resolveWithinDir(assetsDir, String(relPath || ""));
  if (!fullPath) {
    event.returnValue = null;
    return;
  }
  try {
    event.returnValue = pathToFileURL(fullPath).href;
  } catch {
    event.returnValue = null;
  }
});

ipcMain.handle("bridge:workspace:readAssetText", async (event, relPath) => {
  const projectDir = getProjectDirForEvent(event);
  if (!projectDir || !isExistingDirectory(projectDir)) return null;
  const assetsDir = path.join(projectDir, "assets");
  const fullPath = resolveWithinDir(assetsDir, String(relPath || ""));
  if (!fullPath) return null;
  try {
    return await fs.promises.readFile(fullPath, "utf-8");
  } catch {
    return null;
  }
});

ipcMain.handle("bridge:json:read", async (event, filename, defaultValue) => {
  const projectDir = getProjectDirForEvent(event);
  const safeName = safeJsonFilename(filename);
  if (!safeName) return defaultValue;
  if (projectDir && isExistingDirectory(projectDir)) {
    try {
      maybeMigrateLegacyJsonFileForBridge(projectDir, safeName);
    } catch {}
  }
  const dir = getJsonDirForBridge(projectDir);
  const filePath = path.join(dir, safeName);
  try {
    const data = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    try {
      const backupPath = `${filePath}.backup`;
      const backupData = await fs.promises.readFile(backupPath, "utf-8");
      return JSON.parse(backupData);
    } catch {
      return defaultValue;
    }
  }
});

ipcMain.on("bridge:json:readSync", (event, filename, defaultValue) => {
  const projectDir = getProjectDirForEvent(event);
  const safeName = safeJsonFilename(filename);
  if (!safeName) {
    event.returnValue = defaultValue;
    return;
  }
  if (projectDir && isExistingDirectory(projectDir)) {
    try {
      maybeMigrateLegacyJsonFileForBridge(projectDir, safeName);
    } catch {}
  }
  const dir = getJsonDirForBridge(projectDir);
  const filePath = path.join(dir, safeName);
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    event.returnValue = JSON.parse(data);
  } catch {
    try {
      const backupPath = `${filePath}.backup`;
      const backupData = fs.readFileSync(backupPath, "utf-8");
      event.returnValue = JSON.parse(backupData);
    } catch {
      event.returnValue = defaultValue;
    }
  }
});

ipcMain.handle("bridge:json:write", async (event, filename, data) => {
  const projectDir = getProjectDirForEvent(event);
  const safeName = safeJsonFilename(filename);
  if (!safeName) return { ok: false, reason: "INVALID_FILENAME" };
  const status = getJsonStatusForProject(projectDir);
  if (!status.ok) return status;
  const dir = getJsonDirForBridge(projectDir);
  const filePath = path.join(dir, safeName);
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await atomicWriteFile(filePath, JSON.stringify(data, null, 2));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "WRITE_FAILED" };
  }
});

ipcMain.on("bridge:json:writeSync", (event, filename, data) => {
  const projectDir = getProjectDirForEvent(event);
  const safeName = safeJsonFilename(filename);
  if (!safeName) {
    event.returnValue = { ok: false, reason: "INVALID_FILENAME" };
    return;
  }
  const status = getJsonStatusForProject(projectDir);
  if (!status.ok) {
    event.returnValue = status;
    return;
  }
  const dir = getJsonDirForBridge(projectDir);
  const filePath = path.join(dir, safeName);
  try {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    } catch {}
    atomicWriteFileSync(filePath, JSON.stringify(data, null, 2));
    event.returnValue = { ok: true };
  } catch (e) {
    event.returnValue = { ok: false, reason: e?.message || "WRITE_FAILED" };
  }
});

ipcMain.on("bridge:app:getBaseMethodNames", (event) => {
  try {
    const moduleBasePath = path.join(
      __dirname,
      "projector",
      "helpers",
      "moduleBase.js"
    );
    const threeBasePath = path.join(
      __dirname,
      "projector",
      "helpers",
      "threeBase.js"
    );
    const moduleBaseContent = fs.readFileSync(moduleBasePath, "utf-8");
    const threeBaseContent = fs.readFileSync(threeBasePath, "utf-8");
    const methodRegex = /{\s*name:\s*"([^"]+)",\s*executeOnLoad:/g;
    const moduleBaseMatches = [...moduleBaseContent.matchAll(methodRegex)];
    const threeBaseMatches = [...threeBaseContent.matchAll(methodRegex)];
    event.returnValue = {
      moduleBase: moduleBaseMatches.map((m) => m[1]),
      threeBase: threeBaseMatches.map((m) => m[1]),
    };
  } catch {
    event.returnValue = { moduleBase: [], threeBase: [] };
  }
});

ipcMain.on("bridge:app:isPackaged", (event) => {
  try {
    event.returnValue = Boolean(app.isPackaged);
  } catch {
    event.returnValue = true;
  }
});

ipcMain.on("bridge:app:getMethodCode", (event, moduleName, methodName) => {
  try {
    const moduleBasePath = path.join(
      __dirname,
      "projector",
      "helpers",
      "moduleBase.js"
    );
    const threeBasePath = path.join(
      __dirname,
      "projector",
      "helpers",
      "threeBase.js"
    );

    let filePath = null;
    let fileContent = null;
    const searchOrder = [];

    // Prefer workspace modules (project folder) when available.
    const projectDir = getProjectDirForEvent(event);
    const safeModule = safeModuleName(moduleName);
    if (projectDir && isExistingDirectory(projectDir) && safeModule) {
      const modulesDir = path.join(projectDir, "modules");
      const workspaceModulePath = resolveWithinDir(
        modulesDir,
        `${safeModule}.js`
      );
      if (workspaceModulePath && fs.existsSync(workspaceModulePath)) {
        searchOrder.push(workspaceModulePath);
      }
    }

    if (fs.existsSync(moduleBasePath)) searchOrder.push(moduleBasePath);
    if (fs.existsSync(threeBasePath)) searchOrder.push(threeBasePath);

    for (const p of searchOrder) {
      const content = fs.readFileSync(p, "utf-8");
      const classMethodRegex = new RegExp(
        `\\s+${methodName}\\s*\\([^)]*\\)\\s*\\{`,
        "m"
      );
      if (classMethodRegex.test(content)) {
        filePath = p;
        fileContent = content;
        break;
      }
    }

    if (!fileContent || !filePath) {
      event.returnValue = { code: null, filePath: null };
      return;
    }

    const methodNamePattern = new RegExp(`\\s+${methodName}\\s*\\(`, "m");
    const methodNameMatch = fileContent.match(methodNamePattern);
    if (!methodNameMatch) {
      event.returnValue = { code: null, filePath };
      return;
    }

    const startIndex = fileContent.indexOf(methodNameMatch[0]);
    if (startIndex === -1) {
      event.returnValue = { code: null, filePath };
      return;
    }

    let parenCount = 0;
    let braceCount = 0;
    let inString = false;
    let stringChar = null;
    let foundMethodBody = false;
    let i = startIndex + methodNameMatch[0].indexOf("(");

    while (i < fileContent.length) {
      const char = fileContent[i];
      const prevChar = i > 0 ? fileContent[i - 1] : null;

      if (!inString && (char === '"' || char === "'" || char === "`")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== "\\") {
        inString = false;
        stringChar = null;
      } else if (!inString) {
        if (char === "(") parenCount++;
        if (char === ")") parenCount--;
        if (char === "{") {
          if (parenCount === 0 && !foundMethodBody) {
            foundMethodBody = true;
            braceCount = 1;
          } else {
            braceCount++;
          }
        }
        if (char === "}") {
          braceCount--;
          if (foundMethodBody && braceCount === 0) {
            const code = fileContent.substring(startIndex, i + 1);
            event.returnValue = { code: code.trim(), filePath };
            return;
          }
        }
      }
      i++;
    }

    event.returnValue = { code: null, filePath };
  } catch {
    event.returnValue = { code: null, filePath: null };
  }
});

ipcMain.on("bridge:app:getKickMp3ArrayBuffer", (event) => {
  try {
    const kickPath = path.join(
      __dirname,
      "dashboard",
      "assets",
      "audio",
      "kick.mp3"
    );
    const buf = fs.readFileSync(kickPath);
    event.returnValue = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength
    );
  } catch {
    event.returnValue = null;
  }
});

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
    shell.openExternal(String(url));
    event.returnValue = true;
  } catch {
    event.returnValue = false;
  }
});
const getProjectJsonDirForMain = (projectDir) => {
  if (!projectDir || typeof projectDir !== "string") return null;
  if (!isExistingDirectory(projectDir)) return null;
  const dir = path.join(projectDir, "nw_wrld_data", "json");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
};

const maybeMigrateJsonIntoProject = (projectDir) => {
  if (!projectDir || typeof projectDir !== "string") return;
  const destDir = getProjectJsonDirForMain(projectDir);
  if (!destDir) return;
  const legacyDir = getLegacyJsonDirForMain();

  [
    "userData.json",
    "appState.json",
    "config.json",
    "recordingData.json",
  ].forEach((filename) => {
    const destPath = path.join(destDir, filename);
    if (fs.existsSync(destPath)) return;

    const srcCandidates = [path.join(legacyDir, filename)];
    const srcPath = srcCandidates.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
    if (!srcPath) return;

    try {
      fs.copyFileSync(srcPath, destPath);
    } catch {}

    const srcBackupPath = `${srcPath}.backup`;
    const destBackupPath = `${destPath}.backup`;
    try {
      if (!fs.existsSync(destBackupPath) && fs.existsSync(srcBackupPath)) {
        fs.copyFileSync(srcBackupPath, destBackupPath);
      }
    } catch {}
  });
};

const broadcastWorkspaceModulesChanged = () => {
  if (
    dashboardWindow &&
    !dashboardWindow.isDestroyed() &&
    dashboardWindow.webContents &&
    !dashboardWindow.webContents.isDestroyed()
  ) {
    dashboardWindow.webContents.send("workspace:modulesChanged", {});
  }
  if (
    projector1Window &&
    !projector1Window.isDestroyed() &&
    projector1Window.webContents &&
    !projector1Window.webContents.isDestroyed()
  ) {
    projector1Window.webContents.send("workspace:modulesChanged", {});
  }
};

const broadcastWorkspaceLostSync = (workspacePath) => {
  const payload = { workspacePath: workspacePath || null };
  if (
    dashboardWindow &&
    !dashboardWindow.isDestroyed() &&
    dashboardWindow.webContents &&
    !dashboardWindow.webContents.isDestroyed()
  ) {
    dashboardWindow.webContents.send("workspace:lostSync", payload);
  }
  if (
    projector1Window &&
    !projector1Window.isDestroyed() &&
    projector1Window.webContents &&
    !projector1Window.webContents.isDestroyed()
  ) {
    projector1Window.webContents.send("workspace:lostSync", payload);
  }
};

const startWorkspaceWatcher = (workspacePath) => {
  if (!workspacePath || typeof workspacePath !== "string") {
    currentWorkspacePath = null;
    if (workspaceWatcher) {
      try {
        workspaceWatcher.close();
      } catch {}
      workspaceWatcher = null;
    }
    return;
  }

  if (workspacePath === currentWorkspacePath && workspaceWatcher) {
    return;
  }

  if (!isExistingDirectory(workspacePath)) {
    currentWorkspacePath = null;
    if (workspaceWatcher) {
      try {
        workspaceWatcher.close();
      } catch {}
      workspaceWatcher = null;
    }
    broadcastWorkspaceLostSync(workspacePath);
    return;
  }

  currentWorkspacePath = workspacePath;

  if (workspaceWatcher) {
    try {
      workspaceWatcher.close();
    } catch {}
    workspaceWatcher = null;
  }

  const modulesDir = path.join(workspacePath, "modules");
  try {
    fs.mkdirSync(modulesDir, { recursive: true });
  } catch {}

  try {
    workspaceWatcher = fs.watch(modulesDir, (eventType, filename) => {
      if (filename && !String(filename).endsWith(".js")) return;
      if (workspaceWatcherDebounce) {
        clearTimeout(workspaceWatcherDebounce);
      }
      workspaceWatcherDebounce = setTimeout(async () => {
        workspaceWatcherDebounce = null;
        try {
          await waitForWorkspaceSettle(modulesDir, filename);
        } catch {}
        broadcastWorkspaceModulesChanged();
      }, 350);
    });
    workspaceWatcher.on("error", () => {
      try {
        workspaceWatcher.close();
      } catch {}
      workspaceWatcher = null;
      broadcastWorkspaceLostSync(workspacePath);
    });
  } catch {
    workspaceWatcher = null;
  }
};

// Performance-focused command line switches
app.commandLine.appendSwitch("max-webgl-contexts", "64");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");

// Register IPC handlers ONCE at module level (outside createWindow)
const getProjectorAspectRatioValue = (aspectRatioId) => {
  const id = String(aspectRatioId || "").trim();
  if (!id || id === "default" || id === "landscape") return 0;
  if (id === "16-9") return 16 / 9;
  if (id === "9-16") return 9 / 16;
  if (id === "4-5") return 4 / 5;
  return 0;
};

const applyProjectorWindowAspectRatio = (aspectRatioId) => {
  if (!projector1Window || projector1Window.isDestroyed()) return;

  const id = String(aspectRatioId || "").trim();
  const ratio = getProjectorAspectRatioValue(aspectRatioId);

  try {
    projector1Window.setAspectRatio(ratio || 0);
  } catch {}

  if (!ratio) {
    if (
      (id === "default" || id === "landscape" || !id) &&
      projectorDefaultBounds
    ) {
      try {
        projector1Window.setBounds(projectorDefaultBounds, false);
      } catch {}
    }
    return;
  }

  try {
    const bounds = projector1Window.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const workArea = display?.workArea || bounds;

    const nextWidth = Math.max(200, Math.round(bounds.height * ratio));
    const centerX = bounds.x + Math.round(bounds.width / 2);
    let nextX = centerX - Math.round(nextWidth / 2);

    if (typeof workArea.x === "number" && typeof workArea.width === "number") {
      nextX = Math.max(
        workArea.x,
        Math.min(nextX, workArea.x + workArea.width - nextWidth)
      );
    }

    projector1Window.setBounds(
      {
        x: nextX,
        y: bounds.y,
        width: nextWidth,
        height: bounds.height,
      },
      false
    );
  } catch {}
};

const messageChannels = {
  "dashboard-to-projector": (data) => {
    try {
      if (data?.type === "toggleAspectRatioStyle") {
        applyProjectorWindowAspectRatio(data?.props?.name);
      }
    } catch {}
    if (
      projector1Window &&
      !projector1Window.isDestroyed() &&
      projector1Window.webContents &&
      !projector1Window.webContents.isDestroyed()
    ) {
      projector1Window.webContents.send("from-dashboard", data);
    }
  },
  "projector-to-dashboard": (data) => {
    if (
      dashboardWindow &&
      !dashboardWindow.isDestroyed() &&
      dashboardWindow.webContents &&
      !dashboardWindow.webContents.isDestroyed()
    ) {
      dashboardWindow.webContents.send("from-projector", data);
    }
  },
};

Object.entries(messageChannels).forEach(([channel, handler]) => {
  ipcMain.on(channel, (event, data) => {
    handler(data);
  });
});

ipcMain.handle("input:configure", async (event, payload) => {
  if (inputManager) {
    await inputManager.initialize(payload);
  }
  return { success: true };
});

ipcMain.handle("input:get-midi-devices", async () => {
  return await InputManager.getAvailableMIDIDevices();
});

ipcMain.on("log-to-main", (event, message) => {
  console.log(message);
});

const ensureWorkspaceScaffold = async (workspacePath) => {
  if (!workspacePath || typeof workspacePath !== "string") return;

  try {
    fs.mkdirSync(workspacePath, { recursive: true });
  } catch {}
  if (!isExistingDirectory(workspacePath)) return;

  const modulesDir = path.join(workspacePath, "modules");
  try {
    fs.mkdirSync(modulesDir, { recursive: true });
  } catch {}

  try {
    ensureWorkspaceStarterAssets(workspacePath);
  } catch {}

  try {
    fs.mkdirSync(path.join(workspacePath, "nw_wrld_data", "json"), {
      recursive: true,
    });
  } catch {}

  const readmePath = path.join(workspacePath, "README.md");
  if (!fs.existsSync(readmePath)) {
    try {
      fs.writeFileSync(
        readmePath,
        [
          "# nw_wrld Modules Workspace",
          "",
          "Edit files in `modules/` and nw_wrld will reload them automatically.",
          "",
        ].join("\n"),
        "utf-8"
      );
    } catch {}
  }

  const moduleDevGuidePath = path.join(workspacePath, "MODULE_DEVELOPMENT.md");
  if (!fs.existsSync(moduleDevGuidePath)) {
    try {
      const sourcePath = path.join(__dirname, "..", "MODULE_DEVELOPMENT.md");
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, moduleDevGuidePath);
      }
    } catch {}
  }

  try {
    ensureWorkspaceStarterModules(modulesDir);
  } catch {}
};

ipcMain.handle("workspace:select", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { cancelled: true };
  }
  const workspacePath = result.filePaths[0];
  await ensureWorkspaceScaffold(workspacePath);
  maybeMigrateJsonIntoProject(workspacePath);
  currentProjectDir = workspacePath;

  if (inputManager) {
    try {
      await inputManager.disconnect();
    } catch {}
    inputManager = null;
  }

  const closeWindow = (win) =>
    new Promise((resolve) => {
      if (!win || win.isDestroyed()) return resolve();
      win.once("closed", () => resolve());
      try {
        win.close();
      } catch {
        resolve();
      }
    });

  await Promise.all([
    closeWindow(dashboardWindow),
    closeWindow(projector1Window),
  ]);
  dashboardWindow = null;
  projector1Window = null;

  createWindow(workspacePath);
  return { cancelled: false, workspacePath };
});

function loadConfig(projectDir) {
  const baseDir = getProjectJsonDirForMain(projectDir);
  if (!baseDir) return DEFAULT_USER_DATA;
  const configPath = path.join(baseDir, "userData.json");

  try {
    const data = fs.readFileSync(configPath, "utf-8");

    try {
      const parsed = JSON.parse(data);
      return parsed;
    } catch (parseErr) {
      console.error(
        "[Main] JSON parse error - config file is corrupted:",
        parseErr.message
      );
      console.error("[Main] Using default configuration");
      return DEFAULT_USER_DATA;
    }
  } catch (readErr) {
    if (readErr.code === "ENOENT") {
      console.warn("[Main] Config file not found, using defaults");
    } else {
      console.error("[Main] Failed to read config file:", readErr.message);
    }
    return DEFAULT_USER_DATA;
  }
}

function createWindow(projectDir) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;
  const { x: screenX, y: screenY } = primaryDisplay.workArea;

  const halfWidth = Math.floor(screenWidth / 2);
  const additionalArgs = ["--nwWrldRequireProject=1"];
  if (projectDir && typeof projectDir === "string") {
    additionalArgs.push(`--nwWrldProjectDir=${projectDir}`);
  }

  // Create Projector 1 Window with optimized preferences
  projector1Window = new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      enableRemoteModule: false,
      backgroundThrottling: false,
      webgl: true,
      enableHardwareAcceleration: true,
      additionalArguments: additionalArgs,
      // Additional performance optimizations
      pageVisibility: true, // Prevents throttling when page isn't visible
      autoplayPolicy: "no-user-gesture-required", // Helps with audio processing
    },
    x: screenX + halfWidth,
    y: screenY,
    width: halfWidth,
    height: screenHeight,
    title: "Projector 1",
    // Additional window optimizations
    show: false, // Don't show until ready
    paintWhenInitiallyHidden: true, // Start rendering before window is shown
    frame: false,
  });

  try {
    projectorDefaultBounds = projector1Window.getBounds();
  } catch {}

  try {
    const initialConfig = loadConfig(projectDir);
    applyProjectorWindowAspectRatio(initialConfig?.config?.aspectRatio);
  } catch {}

  // Show window when ready to prevent white flash
  projector1Window.once("ready-to-show", () => {
    projector1Window.show();
  });

  projector1Window.loadFile(
    path.join(__dirname, "projector", "views", "projector.html")
  );
  projector1Window.on("resize", () => {
    updateSandboxViewBounds();
  });
  projector1Window.on("closed", () => {
    try {
      destroySandboxView();
    } catch {}
  });

  // Create Dashboard Window with appropriate optimizations
  dashboardWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      enableHardwareAcceleration: true, // Enable for dashboard too
      backgroundThrottling: false, // Prevent throttling
      additionalArguments: additionalArgs,
    },
    x: screenX,
    y: screenY,
    width: halfWidth,
    height: screenHeight,
    title: "nw_wrld",
    show: false,
    // frame: false,
  });

  dashboardWindow.once("ready-to-show", () => {
    dashboardWindow.show();
  });

  try {
    if (dashboardWindow?.webContents?.id != null) {
      webContentsToProjectDir.set(
        dashboardWindow.webContents.id,
        projectDir || null
      );
      dashboardWindow.on("closed", () => {
        try {
          webContentsToProjectDir.delete(dashboardWindow.webContents.id);
        } catch {}
      });
    }
  } catch {}

  try {
    if (projector1Window?.webContents?.id != null) {
      webContentsToProjectDir.set(
        projector1Window.webContents.id,
        projectDir || null
      );
      projector1Window.on("closed", () => {
        try {
          webContentsToProjectDir.delete(projector1Window.webContents.id);
        } catch {}
      });
    }
  } catch {}

  dashboardWindow.loadFile(
    path.join(__dirname, "dashboard", "views", "dashboard.html")
  );

  dashboardWindow.webContents.once("did-finish-load", () => {
    const fullConfig = loadConfig(projectDir);
    inputManager = new InputManager(dashboardWindow, projector1Window);
    const { DEFAULT_INPUT_CONFIG } = require("./shared/config/defaultConfig");
    const inputConfig = fullConfig.config?.input || DEFAULT_INPUT_CONFIG;
    if (fullConfig.config?.sequencerMode !== true) {
      inputManager.initialize(inputConfig).catch((err) => {
        console.error("[Main] Failed to initialize InputManager:", err);
      });
    }
  });

  if (projectDir && typeof projectDir === "string") {
    startWorkspaceWatcher(projectDir);
  }

  if (!didRegisterAppLifecycleHandlers) {
    didRegisterAppLifecycleHandlers = true;
    app.on("window-all-closed", function () {
      if (process.platform !== "darwin") app.quit();
    });
  }
}

// Handle app ready state
app.whenReady().then(() => {
  try {
    protocol.registerFileProtocol("nw-sandbox", (request, callback) => {
      try {
        const u = new URL(request.url);
        const pathname = u.pathname || "/";
        const allowed = new Map([
          [
            "/moduleSandbox.html",
            app.isPackaged
              ? path.join(
                  __dirname,
                  "projector",
                  "views",
                  "moduleSandbox.prod.html"
                )
              : path.join(
                  __dirname,
                  "projector",
                  "views",
                  "moduleSandbox.html"
                ),
          ],
          [
            "/moduleSandbox.js",
            path.join(__dirname, "..", "dist", "moduleSandbox.js"),
          ],
          [
            "/moduleSandbox.js.map",
            path.join(__dirname, "..", "dist", "moduleSandbox.js.map"),
          ],
        ]);

        const filePath = allowed.get(pathname);
        if (!filePath) return callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
        return callback({ path: filePath });
      } catch {
        return callback({ error: -2 }); // net::FAILED
      }
    });
  } catch {}

  try {
    protocol.registerFileProtocol("nw-assets", (request, callback) => {
      try {
        const u = new URL(request.url);
        const pathname = u.pathname || "/";
        const raw = pathname.startsWith("/") ? pathname.slice(1) : pathname;
        const parts = raw.split("/").filter(Boolean);
        const token = parts.length ? decodeURIComponent(parts[0]) : null;
        const relPath =
          parts.length > 1
            ? parts
                .slice(1)
                .map((p) => decodeURIComponent(p))
                .join("/")
            : "";

        if (!token || !sandboxTokenToProjectDir.has(token)) {
          return callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
        }

        if (!relPath) {
          return callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
        }

        const entry = sandboxTokenToProjectDir.get(token) || null;
        const projectDir = entry?.projectDir || null;
        if (!projectDir || !isExistingDirectory(projectDir)) {
          return callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
        }

        const assetsDir = path.join(projectDir, "assets");
        const fullPath = resolveWithinDir(assetsDir, relPath);
        if (!fullPath) {
          return callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
        }
        return callback({ path: fullPath });
      } catch {
        return callback({ error: -2 }); // net::FAILED
      }
    });
  } catch {}

  if (process.platform === "darwin" && !app.isPackaged) {
    try {
      const iconPath = path.join(
        __dirname,
        "assets",
        "images",
        "blueprint.png"
      );
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon);
      }
    } catch (err) {
      console.error("[Main] Failed to set dock icon:", err?.message || err);
    }
  }

  currentProjectDir = null;
  createWindow(null);

  // Handle app activation (macOS)
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      currentProjectDir = null;
      createWindow(null);
    }
  });
});

app.on("before-quit", async () => {
  if (inputManager) {
    await inputManager.disconnect();
  }
});
