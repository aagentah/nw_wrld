import { useCallback, useEffect } from "react";
import type {
  DashboardToProjectorMessageMap,
  ProjectorToDashboardMessageMap,
  InputEventPayload,
  InputStatusPayload,
} from "../../../types";
import type { NwWrldBridge } from "../../../types/bridge";
import type { TypedMessage } from "../../../types/messaging";

const getMessaging = () =>
  (globalThis.nwWrldBridge as NwWrldBridge | undefined)?.messaging;

type IPCChannel = "dashboard-to-projector" | "projector-to-dashboard";
type IPCListenerChannel =
  | "from-projector"
  | "from-dashboard"
  | "input-event"
  | "input-status"
  | "workspace:modulesChanged"
  | "workspace:lostSync";
type IPCInvokeChannel =
  | "input:configure"
  | "input:get-midi-devices"
  | "workspace:select";

export const useIPCSend = (
  channel: IPCChannel = "dashboard-to-projector"
) => {
  return useCallback(
    <K extends keyof DashboardToProjectorMessageMap>(
      type: K,
      props: DashboardToProjectorMessageMap[K]
    ) => {
      const messaging = getMessaging();
      if (!messaging) return;

      if (channel === "dashboard-to-projector") {
        if (typeof messaging.sendToProjector !== "function") return;
        messaging.sendToProjector(type, props);
        return;
      }

      if (channel === "projector-to-dashboard") {
        // Cast the type to the correct map for this channel
        if (typeof messaging.sendToDashboard !== "function") return;
        const typedProps = props as any;
        messaging.sendToDashboard(type as any, typedProps);
      }
    },
    [channel]
  );
};

export const useIPCInvoke = () => {
  return useCallback(
    async (channel: IPCInvokeChannel, ...args: unknown[]): Promise<unknown> => {
      const messaging = getMessaging();
      if (!messaging) return null;

      if (channel === "input:configure") {
        return typeof messaging.configureInput === "function"
          ? await messaging.configureInput(args[0] as any)
          : null;
      }

      if (channel === "input:get-midi-devices") {
        return typeof messaging.getMidiDevices === "function"
          ? await messaging.getMidiDevices()
          : null;
      }

      if (channel === "workspace:select") {
        return typeof messaging.selectWorkspace === "function"
          ? await messaging.selectWorkspace()
          : null;
      }

      return null;
    },
    []
  );
};

export const useIPCListener = (
  channel: IPCListenerChannel,
  handler: (event: unknown, data: unknown) => void,
  deps: React.DependencyList = []
) => {
  useEffect(() => {
    const messaging = getMessaging();
    if (!messaging) return;

    let cleanup: (() => void) | undefined | void;

    if (channel === "from-projector") {
      cleanup = messaging.onFromProjector?.(handler as any);
    } else if (channel === "from-dashboard") {
      cleanup = messaging.onFromDashboard?.(handler as any);
    } else if (channel === "input-event") {
      cleanup = messaging.onInputEvent?.(handler as any);
    } else if (channel === "input-status") {
      cleanup = messaging.onInputStatus?.(handler as any);
    } else if (channel === "workspace:modulesChanged") {
      cleanup = messaging.onWorkspaceModulesChanged?.(handler);
    } else if (channel === "workspace:lostSync") {
      cleanup = messaging.onWorkspaceLostSync?.(handler);
    } else {
      return;
    }

    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [channel, handler, ...deps]);
};
