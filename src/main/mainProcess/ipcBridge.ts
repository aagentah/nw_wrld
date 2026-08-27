import { registerAppBridge } from "./ipcBridge/registerAppBridge";
import { registerInputBridge } from "./ipcBridge/registerInputBridge";
import { registerJsonBridge } from "./ipcBridge/registerJsonBridge";
import { registerLogBridge } from "./ipcBridge/registerLogBridge";
import { registerOsBridge } from "./ipcBridge/registerOsBridge";
import { registerObservatoryBridge } from "./ipcBridge/registerObservatoryBridge";
import { registerProjectBridge } from "./ipcBridge/registerProjectBridge";
import { registerTestAudioBridge } from "./ipcBridge/registerTestAudioBridge";
import { registerTestFileBridge } from "./ipcBridge/registerTestFileBridge";
import { registerTestMidiBridge } from "./ipcBridge/registerTestMidiBridge";
import { registerWorkspaceBridge } from "./ipcBridge/registerWorkspaceBridge";

export function registerIpcBridge(): void {
  registerProjectBridge();
  registerWorkspaceBridge();
  registerJsonBridge();
  registerAppBridge();
  registerOsBridge();
  registerObservatoryBridge();
  registerInputBridge();
  registerTestMidiBridge();
  registerTestAudioBridge();
  registerTestFileBridge();
  registerLogBridge();
}
