/**
 * Sandbox preload script for nw_wrld Electron app
 * Exposes limited IPC bridge to sandboxed renderers
 */

const { contextBridge, ipcRenderer } = require("electron");

interface SandboxIpc {
  send: (payload: unknown) => void;
  on: (handler: (payload: unknown) => void) => () => void;
}

contextBridge.exposeInMainWorld("nwSandboxIpc", {
  send: (payload: unknown) => {
    try {
      ipcRenderer.send("sandbox:toMain", payload);
    } catch {
      // Ignore errors
    }
  },
  on: (handler: (payload: unknown) => void) => {
    if (typeof handler !== "function") return () => {};
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => handler(payload);
    ipcRenderer.on("sandbox:fromMain", wrapped);
    return () => {
      try {
        ipcRenderer.removeListener("sandbox:fromMain", wrapped);
      } catch {
        // Ignore errors
      }
    };
  },
});

export {};
