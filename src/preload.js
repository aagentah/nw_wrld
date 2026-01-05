const { contextBridge, ipcRenderer } = require("electron");

const isTopLevelFrame = () => {
  try {
    return window === window.top;
  } catch {
    return true;
  }
};

const nwWrldAppBridge = {
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

const nwWrldBridge = {
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
  },
  messaging: {
    sendToProjector: (type, props = {}) =>
      ipcRenderer.send("dashboard-to-projector", { type, props }),
    sendToDashboard: (type, props = {}) =>
      ipcRenderer.send("projector-to-dashboard", { type, props }),
    onFromProjector: (handler) => {
      if (typeof handler !== "function") return;
      const wrapped = (event, data) => handler(event, data);
      ipcRenderer.on("from-projector", wrapped);
      return () => ipcRenderer.removeListener("from-projector", wrapped);
    },
    onFromDashboard: (handler) => {
      if (typeof handler !== "function") return;
      const wrapped = (event, data) => handler(event, data);
      ipcRenderer.on("from-dashboard", wrapped);
      return () => ipcRenderer.removeListener("from-dashboard", wrapped);
    },
    onInputEvent: (handler) => {
      if (typeof handler !== "function") return;
      const wrapped = (event, payload) => handler(event, payload);
      ipcRenderer.on("input-event", wrapped);
      return () => ipcRenderer.removeListener("input-event", wrapped);
    },
    onInputStatus: (handler) => {
      if (typeof handler !== "function") return;
      const wrapped = (event, payload) => handler(event, payload);
      ipcRenderer.on("input-status", wrapped);
      return () => ipcRenderer.removeListener("input-status", wrapped);
    },
    onWorkspaceModulesChanged: (handler) => {
      if (typeof handler !== "function") return;
      const wrapped = (event, payload) => handler(event, payload);
      ipcRenderer.on("workspace:modulesChanged", wrapped);
      return () =>
        ipcRenderer.removeListener("workspace:modulesChanged", wrapped);
    },
    onWorkspaceLostSync: (handler) => {
      if (typeof handler !== "function") return;
      const wrapped = (event, payload) => handler(event, payload);
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
