export type NwWrldMessaging = {
  sendToDashboard?: (event: string, data: unknown) => unknown;
  onFromDashboard?: (
    handler: (event: unknown, data: unknown) => unknown
  ) => unknown;
  onInputEvent?: (
    handler: (event: unknown, payload: unknown) => unknown
  ) => unknown;
  onWorkspaceModulesChanged?: (handler: () => unknown) => unknown;
};

export type NwWrldSandboxBridge = {
  ensure?: () => Promise<unknown> | unknown;
  request?: (
    token: string,
    type: string,
    props: Record<string, unknown>
  ) => Promise<unknown> | unknown;
  destroy?: () => Promise<unknown> | unknown;
};

export type NwWrldWorkspaceBridge = {
  readModuleWithMeta?: (moduleType: string) => Promise<unknown> | unknown;
  getModuleUrl?: (moduleType: string) => Promise<unknown> | unknown;
};

export type NwWrldBridge = {
  messaging?: NwWrldMessaging;
  sandbox?: NwWrldSandboxBridge;
  workspace?: NwWrldWorkspaceBridge;
};

export const getBridge = (): NwWrldBridge | undefined =>
  (globalThis as typeof globalThis & { nwWrldBridge?: unknown })
    .nwWrldBridge as NwWrldBridge | undefined;

export const getMessaging = (): NwWrldMessaging | undefined => getBridge()?.messaging;

