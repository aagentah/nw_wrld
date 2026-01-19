export {};

declare global {
  interface GlobalThis {
    nwWrldBridge?:
      | {
          app?: {
            isPackaged?: () => boolean;
            getKickMp3ArrayBuffer?: () => ArrayBuffer | null;
            getMethodCode?: (moduleName: unknown, methodName: unknown) => unknown;
            getVersion?: () => string | null;
            getRepositoryUrl?: () => string | null;
          };
          messaging?: {
            sendToProjector?: (type: string, props?: Record<string, unknown>) => void;
            sendToDashboard?: (type: string, props?: Record<string, unknown>) => void;
            configureInput?: (payload: unknown) => Promise<unknown>;
            getMidiDevices?: () => Promise<unknown>;
            selectWorkspace?: () => Promise<unknown>;
            onFromProjector?: (handler: (...args: unknown[]) => void) => void | (() => void);
            onFromDashboard?: (handler: (...args: unknown[]) => void) => void | (() => void);
            onInputEvent?: (handler: (...args: unknown[]) => void) => void | (() => void);
            onInputStatus?: (handler: (...args: unknown[]) => void) => void | (() => void);
            onWorkspaceModulesChanged?: (
              handler: (...args: unknown[]) => void
            ) => void | (() => void);
            onWorkspaceLostSync?: (handler: (...args: unknown[]) => void) => void | (() => void);
          };
          testing?: {
            midi?: {
              reset?: (devices: unknown) => Promise<unknown>;
              disconnect?: (deviceId: unknown) => Promise<unknown>;
              reconnect?: (device: unknown) => Promise<unknown>;
            };
          };
        }
      | undefined;
  }
}
