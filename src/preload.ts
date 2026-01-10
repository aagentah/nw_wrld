/**
 * Preload script for nw_wrld Electron app
 * Exposes secure IPC bridges to renderer processes via contextBridge
 */

const { contextBridge, ipcRenderer } = require("electron");

// Type definitions for the bridges
interface JsonBridge {
  read: (filename: string, defaultValue?: unknown) => Promise<unknown>;
  readSync: (filename: string, defaultValue?: unknown) => unknown;
  write: (filename: string, data: unknown) => Promise<unknown>;
  writeSync: (filename: string, data: unknown) => unknown;
}

interface AppBridge {
  logToMain: (message: string) => void;
  json: JsonBridge;
}

interface ProjectBridge {
  getDir: () => string;
  isRequired: () => boolean;
  isDirAvailable: () => boolean;
}

interface SandboxBridge {
  registerToken: (token: string) => void;
  unregisterToken: (token: string) => void;
  ensure: () => Promise<{ ok: boolean; token?: string }>;
  request: (token: string, type: string, props: Record<string, unknown>) => Promise<{ ok: boolean }>;
  destroy: () => Promise<void>;
}

interface WorkspaceBridge {
  listModuleFiles: () => Promise<string[]>;
  listModuleSummaries: () => Promise<Array<{ name: string; summary?: string }>>;
  getModuleUrl: (moduleName: string) => Promise<{ mtimeMs: number }>;
  readModuleText: (moduleName: string) => Promise<string>;
  readModuleWithMeta: (moduleName: string) => Promise<{ text: string; mtimeMs: number }>;
  writeModuleTextSync: (moduleName: string, text: string) => boolean;
  moduleExists: (moduleName: string) => boolean;
  showModuleInFolder: (moduleName: string) => void;
  assetUrl: (relPath: string) => string | null;
  listAssets: (relDir?: string) => Promise<string[]>;
  readAssetText: (relPath: string) => Promise<string>;
}

interface AppMethodsBridge {
  getBaseMethodNames: () => string[];
  getMethodCode: (moduleName: string, methodName: string) => string;
  getKickMp3ArrayBuffer: () => ArrayBuffer;
  isPackaged: () => boolean;
}

type IpcEventHandler = (event: Electron.IpcRendererEvent, data: unknown) => void;

interface MessagingBridge {
  sendToProjector: (type: string, props?: Record<string, unknown>) => void;
  sendToDashboard: (type: string, props?: Record<string, unknown>) => void;
  onFromProjector: (handler: IpcEventHandler) => () => void;
  onFromDashboard: (handler: IpcEventHandler) => () => void;
  onInputEvent: (handler: IpcEventHandler) => () => void;
  onInputStatus: (handler: IpcEventHandler) => () => void;
  onWorkspaceModulesChanged: (handler: IpcEventHandler) => () => void;
  onWorkspaceLostSync: (handler: IpcEventHandler) => () => void;
  configureInput: (payload: Record<string, unknown>) => Promise<void>;
  getMidiDevices: () => Promise<Array<{ id: string; name: string }>>;
  selectWorkspace: () => Promise<void>;
}

interface NwWrldBridge {
  project: ProjectBridge;
  sandbox: SandboxBridge;
  workspace: WorkspaceBridge;
  app: AppMethodsBridge;
  messaging: MessagingBridge;
}

const isTopLevelFrame = (): boolean => {
  try {
    return window === window.top;
  } catch {
    return true;
  }
};

const nwWrldAppBridge: AppBridge = {
  json: {
    read: (filename, defaultValue) =>
      ipcRenderer.invoke("bridge:json:read", filename, defaultValue),
    readSync: (filename, defaultValue) =>
      ipcRenderer.sendSync("bridge:json:readSync", filename, defaultValue),
    write: (filename, data) =>
      ipcRenderer.invoke("bridge:json:write", filename, data),
    writeSync: (filename, data) =>
      ipcRenderer.sendSync("bridge:json:writeSync", filename, data),
  },
  logToMain: (message) => ipcRenderer.send("log-to-main", message),
};

const nwWrldBridge: NwWrldBridge = {
  project: {
    getDir: () => ipcRenderer.sendSync("bridge:project:getDir"),
    isRequired: () => ipcRenderer.sendSync("bridge:project:isRequired"),
    isDirAvailable: () => ipcRenderer.sendSync("bridge:project:isDirAvailable"),
  },
  sandbox: {
    registerToken: (token) =>
      ipcRenderer.sendSync("bridge:sandbox:registerToken", token),
    unregisterToken: (token) =>
      ipcRenderer.sendSync("bridge:sandbox:unregisterToken", token),
    ensure: () => ipcRenderer.invoke("sandbox:ensure"),
    request: (token, type, props) =>
      ipcRenderer.invoke("sandbox:request", { token, type, props }),
    destroy: () => ipcRenderer.invoke("sandbox:destroy"),
  },
  workspace: {
    listModuleFiles: () =>
      ipcRenderer.invoke("bridge:workspace:listModuleFiles"),
    listModuleSummaries: () =>
      ipcRenderer.invoke("bridge:workspace:listModuleSummaries"),
    getModuleUrl: (moduleName) =>
      ipcRenderer.invoke("bridge:workspace:getModuleUrl", moduleName),
    readModuleText: (moduleName) =>
      ipcRenderer.invoke("bridge:workspace:readModuleText", moduleName),
    readModuleWithMeta: (moduleName) =>
      ipcRenderer.invoke("bridge:workspace:readModuleWithMeta", moduleName),
    writeModuleTextSync: (moduleName, text) =>
      ipcRenderer.sendSync(
        "bridge:workspace:writeModuleTextSync",
        moduleName,
        text
      ),
    moduleExists: (moduleName) =>
      ipcRenderer.sendSync("bridge:workspace:moduleExists", moduleName),
    showModuleInFolder: (moduleName) =>
      ipcRenderer.send("bridge:workspace:showModuleInFolder", moduleName),
    assetUrl: (relPath) =>
      ipcRenderer.sendSync("bridge:workspace:assetUrl", relPath),
    listAssets: (relDir) =>
      ipcRenderer.invoke("bridge:workspace:listAssets", relDir),
    readAssetText: (relPath) =>
      ipcRenderer.invoke("bridge:workspace:readAssetText", relPath),
  },
  app: {
    getBaseMethodNames: () =>
      ipcRenderer.sendSync("bridge:app:getBaseMethodNames"),
    getMethodCode: (moduleName, methodName) =>
      ipcRenderer.sendSync("bridge:app:getMethodCode", moduleName, methodName),
    getKickMp3ArrayBuffer: () =>
      ipcRenderer.sendSync("bridge:app:getKickMp3ArrayBuffer"),
    isPackaged: () => ipcRenderer.sendSync("bridge:app:isPackaged"),
  },
  messaging: {
    sendToProjector: (type, props = {}) =>
      ipcRenderer.send("dashboard-to-projector", { type, props }),
    sendToDashboard: (type, props = {}) =>
      ipcRenderer.send("projector-to-dashboard", { type, props }),
    onFromProjector: (handler) => {
      if (typeof handler !== "function") return () => {};
      const wrapped = (event: Electron.IpcRendererEvent, data: unknown) => handler(event, data);
      ipcRenderer.on("from-projector", wrapped);
      return () => ipcRenderer.removeListener("from-projector", wrapped);
    },
    onFromDashboard: (handler) => {
      if (typeof handler !== "function") return () => {};
      const wrapped = (event: Electron.IpcRendererEvent, data: unknown) => handler(event, data);
      ipcRenderer.on("from-dashboard", wrapped);
      return () => ipcRenderer.removeListener("from-dashboard", wrapped);
    },
    onInputEvent: (handler) => {
      if (typeof handler !== "function") return () => {};
      const wrapped = (event: Electron.IpcRendererEvent, payload: unknown) => handler(event, payload);
      ipcRenderer.on("input-event", wrapped);
      return () => ipcRenderer.removeListener("input-event", wrapped);
    },
    onInputStatus: (handler) => {
      if (typeof handler !== "function") return () => {};
      const wrapped = (event: Electron.IpcRendererEvent, payload: unknown) => handler(event, payload);
      ipcRenderer.on("input-status", wrapped);
      return () => ipcRenderer.removeListener("input-status", wrapped);
    },
    onWorkspaceModulesChanged: (handler) => {
      if (typeof handler !== "function") return () => {};
      const wrapped = (event: Electron.IpcRendererEvent, payload: unknown) => handler(event, payload);
      ipcRenderer.on("workspace:modulesChanged", wrapped);
      return () =>
        ipcRenderer.removeListener("workspace:modulesChanged", wrapped);
    },
    onWorkspaceLostSync: (handler) => {
      if (typeof handler !== "function") return () => {};
      const wrapped = (event: Electron.IpcRendererEvent, payload: unknown) => handler(event, payload);
      ipcRenderer.on("workspace:lostSync", wrapped);
      return () => ipcRenderer.removeListener("workspace:lostSync", wrapped);
    },
    configureInput: (payload) => ipcRenderer.invoke("input:configure", payload),
    getMidiDevices: () => ipcRenderer.invoke("input:get-midi-devices"),
    selectWorkspace: () => ipcRenderer.invoke("workspace:select"),
  },
};

if (isTopLevelFrame()) {
  contextBridge.exposeInMainWorld("nwWrldBridge", nwWrldBridge);
  contextBridge.exposeInMainWorld("nwWrldAppBridge", nwWrldAppBridge);
}

export {};
