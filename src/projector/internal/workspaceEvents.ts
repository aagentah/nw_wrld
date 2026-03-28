import { getMessaging } from "./bridge";

type WorkspaceEventsContext = {
  workspaceModuleSourceCache: Map<string, unknown>;
  assetsBaseUrl: unknown;
  trackSandboxHost: { destroy?: () => unknown } | null;
  trackModuleSources: unknown;
  activeTrack: { name?: unknown } | null;
  lastRequestedTrackName: string | null;
  isLoadingTrack: boolean;
  pendingWorkspaceReload: boolean;
  deactivateActiveTrack: () => unknown;
  handleTrackSelection: (trackName: unknown) => unknown;
};

export function initWorkspaceModulesChangedListener(this: WorkspaceEventsContext): void {
  const messaging = getMessaging();
  messaging?.onWorkspaceModulesChanged?.(() => {
    const trackName =
      (this.activeTrack as { name?: unknown } | null)?.name || this.lastRequestedTrackName || null;
    this.workspaceModuleSourceCache.clear();
    this.assetsBaseUrl = null;

    if (!trackName) return;
    if (this.isLoadingTrack) {
      this.pendingWorkspaceReload = true;
      return;
    }
    try {
      this.trackSandboxHost?.destroy?.();
    } catch {}
    this.trackSandboxHost = null;
    this.trackModuleSources = null;
    this.deactivateActiveTrack();
    this.handleTrackSelection(trackName);
  });
}
