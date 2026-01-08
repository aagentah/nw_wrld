import type { SetId } from "./userData";
import type { ModuleIntrospectResult, PreviewModuleData } from "./moduleMethods";

export type DashboardToProjectorMessageMap = {
  "module-introspect": { moduleId: string };
  "toggleAspectRatioStyle": { name: string };
  "setBg": { value: string };
  "preview-module": {
    moduleName: string;
    moduleData: PreviewModuleData;
    requestId: string | null;
  };
  "clear-preview": Record<string, never>;
  "trigger-preview-method": {
    moduleName: string;
    methodName: string;
    options: Record<string, unknown>;
  };
  "refresh-projector": Record<string, never>;
  "reload-data": { setId: SetId | null; trackName: string | null };
  "set-activate": { setId: SetId | null };
  "track-activate": { trackName: string };
  "channel-trigger": { channelName?: string; channelNumber?: string | number };
  "debug-overlay-visibility": { isOpen: boolean };
};

export type ProjectorToDashboardMessageMap = {
  "debug-log": { log: string };
  "projector-ready": Record<string, never>;
  "module-introspect-result": ModuleIntrospectResult;
  "preview-module-ready": { moduleName: string; requestId: string };
  "preview-module-error": { moduleName: string; requestId: string; error: string };
};

export type TypedMessage<K extends string, P> = { type: K; props: P };

export type DashboardToProjectorMessage = {
  [K in keyof DashboardToProjectorMessageMap]: TypedMessage<K, DashboardToProjectorMessageMap[K]>;
}[keyof DashboardToProjectorMessageMap];

export type ProjectorToDashboardMessage = {
  [K in keyof ProjectorToDashboardMessageMap]: TypedMessage<K, ProjectorToDashboardMessageMap[K]>;
}[keyof ProjectorToDashboardMessageMap];

