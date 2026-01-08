import type { NwSandboxIpc, NwWrldAppBridge, NwWrldBridge } from "./bridge";

export {};

declare global {
  interface Window {
    nwWrldBridge?: NwWrldBridge;
    nwWrldAppBridge?: NwWrldAppBridge;
    nwSandboxIpc?: NwSandboxIpc;
  }
}
