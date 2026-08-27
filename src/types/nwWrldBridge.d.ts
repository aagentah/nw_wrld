import type {
  ApplyEventResult,
  GraduateResult,
  ObservatoryRefusalCode,
  ObservatoryState,
  StartCaptureResult,
} from "../shared/observatory/types";

type ObservatoryBridgeResult = { ok: true } | { ok: false; code: ObservatoryRefusalCode };

type ObservatoryGetStateResult =
  | { ok: true; state: ObservatoryState }
  | { ok: false; code: ObservatoryRefusalCode };

export {};

declare global {
  interface GlobalThis {
    nwWrldBridge?:
      | {
          app?: {
            isPackaged?: () => boolean;
            getKickMp3ArrayBuffer?: () => ArrayBuffer | null;
            getVersion?: () => string | null;
            openProjectorDevTools?: () => void;
            getRepositoryUrl?: () => string | null;
          };
          observatory?: {
            getState?: () => Promise<ObservatoryGetStateResult>;
            startCapture?: (payload: unknown) => Promise<StartCaptureResult>;
            runTestEmitter?: (payload: unknown) => Promise<ObservatoryBridgeResult>;
            declareOutcome?: (payload: unknown) => Promise<ApplyEventResult>;
            endRun?: (payload: unknown) => Promise<ApplyEventResult>;
            graduate?: (payload: unknown) => Promise<GraduateResult>;
            onState?: (handler: (state: ObservatoryState) => void) => void | (() => void);
          };
          messaging?: {
            sendToProjector?: (type: string, props?: Record<string, unknown>) => void;
            sendToDashboard?: (type: string, props?: Record<string, unknown>) => void;
            configureInput?: (payload: unknown) => Promise<unknown>;
            getMidiDevices?: () => Promise<unknown>;
            selectWorkspace?: () => Promise<unknown>;
            emitFileBand?: (payload: unknown) => Promise<unknown>;
            onFromProjector?: (handler: (...args: unknown[]) => void) => void | (() => void);
            onFromDashboard?: (handler: (...args: unknown[]) => void) => void | (() => void);
            onInputEvent?: (handler: (...args: unknown[]) => void) => void | (() => void);
            onInputStatus?: (handler: (...args: unknown[]) => void) => void | (() => void);
            onWorkspaceModulesChanged?: (
              handler: (...args: unknown[]) => void
            ) => void | (() => void);
            onWorkspaceLostSync?: (handler: (...args: unknown[]) => void) => void | (() => void);
            emitAudioBand?: (payload: unknown) => Promise<unknown>;
          };
          workspace?: {
            assetUrl?: (relPath: unknown) => unknown;
            listAssets?: (relDir: unknown) => Promise<unknown>;
            readAssetText?: (relPath: unknown) => Promise<unknown>;
            readAssetArrayBuffer?: (relPath: unknown) => Promise<ArrayBuffer | null>;
            writeAudioAsset?: (payload: unknown) => Promise<unknown>;
          };
          testing?: {
            midi?: {
              reset?: (devices: unknown) => Promise<unknown>;
              disconnect?: (deviceId: unknown) => Promise<unknown>;
              reconnect?: (device: unknown) => Promise<unknown>;
              noteOn?: (payload: unknown) => Promise<unknown>;
            };
            audio?: {
              emitBand?: (payload: unknown) => Promise<unknown>;
            };
            file?: {
              emitBand?: (payload: unknown) => Promise<unknown>;
            };
          };
        }
      | undefined;
  }
}
