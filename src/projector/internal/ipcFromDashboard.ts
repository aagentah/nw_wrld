import { find, isEqual } from "lodash";
import { getMessaging } from "./bridge";

type IpcMessage = {
  type?: unknown;
  props?: unknown;
};

type IpcProps = Record<string, unknown>;

type DashboardIpcContext = {
  introspectModule: (moduleId: unknown) => Promise<unknown>;
  toggleAspectRatioStyle: (name: unknown) => unknown;
  setBg: (value: unknown) => unknown;
  previewModule: (moduleName: unknown, moduleData: unknown, requestId?: unknown) => unknown;
  clearPreview: () => unknown;
  triggerPreviewMethod: (
    moduleName: unknown,
    methodName: unknown,
    options: unknown
  ) => unknown;
  refreshPage: () => unknown;

  isLoadingTrack: boolean;
  pendingReloadData: unknown;
  activeTrack: { name?: unknown } | null;
  userData: unknown;

  loadUserData: (setId: unknown) => unknown;
  applyConfigSettings: () => unknown;
  deactivateActiveTrack: () => unknown;
  handleTrackSelection: (trackName: unknown) => unknown;
  handleChannelMessage: (channelPath: string) => unknown;

  debugOverlayActive: boolean;
  debugLogTimeout: ReturnType<typeof setTimeout> | null;
  debugLogQueue: unknown[];
};

export function initDashboardIpc(this: DashboardIpcContext) {
  const messaging = getMessaging();
  if (messaging && typeof messaging.onFromDashboard === "function") {
    messaging.onFromDashboard((event: unknown, data: unknown) => {
      try {
        if (!data || typeof data !== "object") {
          console.error("❌ [PROJECTOR-IPC] Invalid IPC message received:", data);
          return;
        }

        const msg = data as IpcMessage;
        const type = msg.type;
        const propsRaw = msg.props;
        const props =
          propsRaw && typeof propsRaw === "object" ? (propsRaw as IpcProps) : ({} as IpcProps);

        if (!type) {
          console.error("❌ [PROJECTOR-IPC] Message missing type field:", data);
          return;
        }

        if (type === "module-introspect") {
          const moduleId = (props as { moduleId?: unknown } | null)?.moduleId || null;
          if (!moduleId) return;
          this.introspectModule(moduleId).then((result) => {
            const messaging = getMessaging();
            messaging?.sendToDashboard?.("module-introspect-result", result);
          }).catch((error) => {
            const messaging = getMessaging();
            messaging?.sendToDashboard?.("module-introspect-result", {
              moduleId,
              ok: false,
              error: (error as { message?: unknown } | null)?.message || "INTROSPECTION_ERROR"
            });
          });
          return;
        }

        if (type === "toggleAspectRatioStyle") {
          if (!(props as { name?: unknown } | null)?.name) {
            console.error("❌ [PROJECTOR-IPC] toggleAspectRatioStyle missing name");
            return;
          }
          return this.toggleAspectRatioStyle((props as { name?: unknown }).name);
        }

        if (type === "setBg") {
          if (!(props as { value?: unknown } | null)?.value) {
            console.error("❌ [PROJECTOR-IPC] setBg missing value");
            return;
          }
          return this.setBg((props as { value?: unknown }).value);
        }

        if (type === "preview-module") {
          if (!(props as { moduleName?: unknown } | null)?.moduleName) {
            console.error("❌ [PROJECTOR-IPC] preview-module missing moduleName");
            return;
          }
          return this.previewModule(
            (props as { moduleName?: unknown }).moduleName,
            (props as { moduleData?: unknown }).moduleData,
            ((props as { requestId?: unknown }).requestId as unknown) || null
          );
        }

        if (type === "clear-preview") {
          return this.clearPreview();
        }

        if (type === "trigger-preview-method") {
          if (
            !(props as { moduleName?: unknown } | null)?.moduleName ||
            !(props as { methodName?: unknown } | null)?.methodName
          ) {
            console.error(
              "❌ [PROJECTOR-IPC] trigger-preview-method missing moduleName or methodName"
            );
            return;
          }
          return this.triggerPreviewMethod(
            (props as { moduleName?: unknown }).moduleName,
            (props as { methodName?: unknown }).methodName,
            ((props as { options?: unknown }).options as unknown) || {}
          );
        }

        if (type === "refresh-projector") {
          return this.refreshPage();
        }

        if (type === "reload-data") {
          if (this.isLoadingTrack) {
            this.pendingReloadData = {
              setId: (props as { setId?: unknown }).setId,
              trackName:
                (props as { trackName?: unknown }).trackName ||
                (this.activeTrack as { name?: unknown } | null)?.name,
            };
            return;
          }

          const currentTrackName =
            (props as { trackName?: unknown }).trackName ||
            (this.activeTrack as { name?: unknown } | null)?.name;
          this.loadUserData((props as { setId?: unknown }).setId);
          this.applyConfigSettings();

          if (currentTrackName) {
            const nextTrack = find(this.userData as never, { name: currentTrackName } as never);
            if (
              this.activeTrack &&
              this.activeTrack.name === currentTrackName &&
              nextTrack
            ) {
              const activeModules = Array.isArray((this.activeTrack as { modules?: unknown }).modules)
                ? ((this.activeTrack as { modules?: unknown[] }).modules as unknown[]).filter((m: unknown) => {
                    const mm = m as { disabled?: boolean } | null;
                    return !mm?.disabled;
                  })
                : [];
              const nextModules = Array.isArray((nextTrack as { modules?: unknown }).modules)
                ? ((nextTrack as { modules?: unknown[] }).modules as unknown[]).filter((m: unknown) => {
                    const mm = m as { disabled?: boolean } | null;
                    return !mm?.disabled;
                  })
                : [];
              if (
                isEqual(
                  {
                    name: this.activeTrack.name,
                    modules: activeModules,
                    modulesData: (this.activeTrack as { modulesData?: unknown }).modulesData,
                    channelMappings: (this.activeTrack as { channelMappings?: unknown })
                      .channelMappings,
                  },
                  {
                    name: (nextTrack as { name?: unknown }).name,
                    modules: nextModules,
                    modulesData: (nextTrack as { modulesData?: unknown }).modulesData,
                    channelMappings: (nextTrack as { channelMappings?: unknown }).channelMappings,
                  }
                )
              ) {
                return;
              }
            }
            this.deactivateActiveTrack();
            return this.handleTrackSelection(currentTrackName);
          }
          return;
        }

        if (type === "set-activate") {
          this.loadUserData((props as { setId?: unknown }).setId);
          this.deactivateActiveTrack();
          return;
        }

        if (type === "track-activate") {
          if (!(props as { trackName?: unknown } | null)?.trackName) {
            console.error("❌ [PROJECTOR-IPC] track-activate missing trackName");
            return;
          }
          return this.handleTrackSelection((props as { trackName?: unknown }).trackName);
        }

        if (type === "channel-trigger") {
          let channelNumber = (props as { channelNumber?: unknown }).channelNumber;

          if (!channelNumber && (props as { channelName?: unknown }).channelName) {
            const match = String((props as { channelName?: unknown }).channelName).match(
              /^ch(\d+)$/i
            );
            channelNumber = match ? match[1] : (props as { channelName?: unknown }).channelName;
          }

          if (!channelNumber) {
            console.error(
              "❌ [PROJECTOR-IPC] channel-trigger missing channelNumber/channelName"
            );
            return;
          }

          console.log("🎵 [PROJECTOR-IPC] Channel trigger:", channelNumber);
          return this.handleChannelMessage(`/Ableton/${channelNumber}`);
        }

        if (type === "debug-overlay-visibility") {
          if (typeof (props as { isOpen?: unknown } | null)?.isOpen !== "boolean") {
            console.error(
              "❌ [PROJECTOR-IPC] debug-overlay-visibility missing isOpen"
            );
            return;
          }
          const isOpen = (props as { isOpen: boolean }).isOpen;
          this.debugOverlayActive = isOpen;
          if (!isOpen) {
            if (this.debugLogTimeout) {
              clearTimeout(this.debugLogTimeout);
              this.debugLogTimeout = null;
            }
            this.debugLogQueue = [];
          }
          return;
        }
      } catch (error) {
        console.error("❌ [PROJECTOR-IPC] Error processing IPC message:", error);
        console.error(
          "❌ [PROJECTOR-IPC] Error stack:",
          (error as { stack?: unknown } | null)?.stack
        );
        console.error("❌ [PROJECTOR-IPC] Message that caused error:", data);
      }
    });
  }
}

