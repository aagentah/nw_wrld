import { getMessaging } from "./bridge";

type WorkspaceEventsContext = {
  workspaceModuleSourceCache: Map<string, unknown>;
  assetsBaseUrl: unknown;
  trackSandboxHost: { destroy?: () => unknown } | null;
  trackModuleSources: unknown;
};

export function initWorkspaceModulesChangedListener(
  this: WorkspaceEventsContext
): void {
  const messaging = getMessaging();
  messaging?.onWorkspaceModulesChanged?.(() => {
    this.workspaceModuleSourceCache.clear();
    this.assetsBaseUrl = null;
    try {
      this.trackSandboxHost?.destroy?.();
    } catch {}
    this.trackSandboxHost = null;
    this.trackModuleSources = null;
  });
}

