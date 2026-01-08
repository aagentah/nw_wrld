import type {
  ListAssetsResult,
  WorkspaceModuleSummary,
  WorkspaceModuleTextWithMeta,
  WorkspaceModuleUrl,
} from "./workspace";
import type { SandboxEnsureResult, SandboxRequestType } from "./sandbox";
import type { InputConfig } from "./userData";
import type {
  InputEventPayload,
  InputStatusPayload,
  MidiDeviceInfo,
} from "./input";
import type {
  DashboardToProjectorMessageMap,
  ProjectorToDashboardMessageMap,
  DashboardToProjectorMessage,
  ProjectorToDashboardMessage,
} from "./messaging";

export interface NwWrldBridge {
  project: {
    getDir: () => string | null;
    isRequired: () => boolean;
    isDirAvailable: () => boolean;
  };
  sandbox: {
    registerToken: (
      token: string
    ) => { ok: boolean; reason?: string } | unknown;
    unregisterToken: (token: string) => boolean | unknown;
    ensure: () => Promise<SandboxEnsureResult>;
    request: (
      token: string,
      type: SandboxRequestType | string,
      props?: unknown
    ) => Promise<unknown>;
    destroy: () => Promise<{ ok: boolean; reason?: string } | unknown>;
  };
  workspace: {
    listModuleFiles: () => Promise<string[]>;
    listModuleSummaries: () => Promise<WorkspaceModuleSummary[]>;
    getModuleUrl: (moduleName: string) => Promise<WorkspaceModuleUrl | null>;
    readModuleText: (moduleName: string) => Promise<string | null>;
    readModuleWithMeta: (
      moduleName: string
    ) => Promise<WorkspaceModuleTextWithMeta | null>;
    writeModuleTextSync: (
      moduleName: string,
      text: string
    ) => { ok: boolean; reason?: string; path?: string } | unknown;
    moduleExists: (moduleName: string) => boolean;
    showModuleInFolder: (moduleName: string) => void;
    assetUrl: (relPath: string) => string | null;
    listAssets: (relDir: string) => Promise<ListAssetsResult>;
    readAssetText: (relPath: string) => Promise<string | null>;
  };
  app: {
    getBaseMethodNames: () => { moduleBase: string[]; threeBase: string[] };
    getMethodCode: (
      moduleName: string,
      methodName: string
    ) => {
      code: string | null;
      filePath: string | null;
    };
    getKickMp3ArrayBuffer: () => ArrayBuffer | null;
    isPackaged: () => boolean;
  };
  messaging: {
    sendToProjector: <T extends keyof DashboardToProjectorMessageMap>(
      type: T,
      props: DashboardToProjectorMessageMap[T]
    ) => void;
    sendToDashboard: <T extends keyof ProjectorToDashboardMessageMap>(
      type: T,
      props: ProjectorToDashboardMessageMap[T]
    ) => void;
    onFromProjector: (
      handler: (event: unknown, data: ProjectorToDashboardMessage) => void
    ) => void | (() => void);
    onFromDashboard: (
      handler: (event: unknown, data: DashboardToProjectorMessage) => void
    ) => void | (() => void);
    onInputEvent: (
      handler: (event: unknown, payload: InputEventPayload) => void
    ) => void | (() => void);
    onInputStatus: (
      handler: (event: unknown, payload: InputStatusPayload) => void
    ) => void | (() => void);
    onWorkspaceModulesChanged: (
      handler: (event: unknown, payload: unknown) => void
    ) => void | (() => void);
    onWorkspaceLostSync: (
      handler: (event: unknown, payload: unknown) => void
    ) => void | (() => void);
    configureInput: (payload: InputConfig) => Promise<{ success: true }>;
    getMidiDevices: () => Promise<MidiDeviceInfo[]>;
    selectWorkspace: () => Promise<unknown>;
  };
}

export interface NwWrldAppBridge {
  json: {
    read: <T = unknown>(filename: string, defaultValue: T) => Promise<T>;
    readSync: <T = unknown>(filename: string, defaultValue: T) => T;
    write: (filename: string, data: unknown) => Promise<unknown>;
    writeSync: (filename: string, data: unknown) => unknown;
  };
  logToMain: (message: unknown) => void;
}

export interface NwSandboxIpc {
  send: (payload: unknown) => void;
  on: (handler: (payload: unknown) => void) => void | (() => void);
}
