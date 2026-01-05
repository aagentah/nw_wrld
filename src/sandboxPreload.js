const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nwSandboxIpc", {
  send: (payload) => {
    try {
      ipcRenderer.send("sandbox:toMain", payload);
    } catch {}
  },
  on: (handler) => {
    if (typeof handler !== "function") return;
    const wrapped = (_event, payload) => handler(payload);
    ipcRenderer.on("sandbox:fromMain", wrapped);
    return () => {
      try {
        ipcRenderer.removeListener("sandbox:fromMain", wrapped);
      } catch {}
    };
  },
});


