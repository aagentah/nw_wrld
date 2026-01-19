import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("nwSandboxIpc", {
  send: (payload: unknown) => {
    try {
      ipcRenderer.send("sandbox:toMain", payload);
    } catch {}
  },
  on: (handler: (payload: unknown) => void) => {
    if (typeof handler !== "function") return undefined;
    const wrapped = (_event: IpcRendererEvent, payload: unknown) => handler(payload);
    ipcRenderer.on("sandbox:fromMain", wrapped);
    return () => {
      try {
        ipcRenderer.removeListener("sandbox:fromMain", wrapped);
      } catch {}
    };
  },
});
