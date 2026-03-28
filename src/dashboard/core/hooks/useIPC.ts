import { useCallback, useEffect } from "react";

const getMessaging = () => globalThis.nwWrldBridge?.messaging;

export const useIPCSend = (
  channel: "dashboard-to-projector" | "projector-to-dashboard" = "dashboard-to-projector"
) => {
  return useCallback(
    (type: string, props: Record<string, unknown> = {}) => {
      const messaging = getMessaging();
      if (!messaging) return;
      if (channel === "dashboard-to-projector") {
        if (typeof messaging.sendToProjector !== "function") return;
        messaging.sendToProjector(type, props);
        return;
      }
      if (channel === "projector-to-dashboard") {
        if (typeof messaging.sendToDashboard !== "function") return;
        messaging.sendToDashboard(type, props);
      }
    },
    [channel]
  );
};

export const useIPCInvoke = () => {
  return useCallback(async (channel: string, ...args: unknown[]) => {
    const messaging = getMessaging();
    if (!messaging) return null;
    if (channel === "input:configure") {
      return typeof messaging.configureInput === "function"
        ? await messaging.configureInput(args[0])
        : null;
    }
    if (channel === "input:get-midi-devices") {
      return typeof messaging.getMidiDevices === "function"
        ? await messaging.getMidiDevices()
        : null;
    }
    if (channel === "input:audio:emitBand") {
      return typeof (messaging as unknown as { emitAudioBand?: unknown }).emitAudioBand === "function"
        ? await (messaging as unknown as { emitAudioBand: (payload: unknown) => Promise<unknown> }).emitAudioBand(args[0])
        : null;
    }
    if (channel === "input:file:emitBand") {
      return typeof (messaging as unknown as { emitFileBand?: unknown }).emitFileBand === "function"
        ? await (messaging as unknown as { emitFileBand: (payload: unknown) => Promise<unknown> }).emitFileBand(args[0])
        : null;
    }
    if (channel === "workspace:select") {
      return typeof messaging.selectWorkspace === "function"
        ? await messaging.selectWorkspace()
        : null;
    }
    return null;
  }, []);
};

export const useIPCListener = (
  channel: string,
  handler: (...args: unknown[]) => void,
  deps: ReadonlyArray<unknown> = []
) => {
  useEffect(() => {
    const messaging = getMessaging();
    if (!messaging) return;
    let cleanup: void | (() => void);
    if (channel === "from-projector") {
      cleanup = messaging.onFromProjector?.(handler);
    } else if (channel === "from-dashboard") {
      cleanup = messaging.onFromDashboard?.(handler);
    } else if (channel === "input-event") {
      cleanup = messaging.onInputEvent?.(handler);
    } else if (channel === "input-status") {
      cleanup = messaging.onInputStatus?.(handler);
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

