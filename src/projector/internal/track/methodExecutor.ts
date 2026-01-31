import { forEach } from "lodash";
import { buildMethodOptions } from "../../../shared/utils/methodOptions";
import logger from "../../helpers/logger";

type MethodEntry = { name?: unknown; options?: unknown };

type MethodExecutorContext = {
  debugOverlayActive: boolean;
  logToMain: (message: unknown) => unknown;
  queueDebugLog: (log: string) => unknown;
  methodOptionNoRepeatCache: { get?: (key: string) => unknown; set?: (k: string, v: unknown) => void } | null;

  trackSandboxHost:
    | null
    | {
        token?: unknown;
        setMatrixForInstance?: (args: {
          instanceId: unknown;
          track: unknown;
          moduleSources: unknown;
          assetsBaseUrl: unknown;
          matrixOptions: unknown;
        }) => Promise<unknown>;
        invokeOnInstance?: (
          instanceId: unknown,
          methodName: unknown,
          options: unknown
        ) => Promise<unknown>;
      };
  activeTrack: unknown;
  trackModuleSources: unknown;
  getAssetsBaseUrlForSandboxToken: (token: unknown) => string | null;
};

export async function executeMethods(
  this: MethodExecutorContext,
  methods: unknown,
  instanceId: unknown,
  moduleInstances: unknown,
  isConstructor = false,
  debugContext: Record<string, unknown> = {}
) {
  const debugEnabled = logger.debugEnabled;
  const overlayDebug = debugEnabled && this.debugOverlayActive;

  if (debugEnabled) logger.log(`⏱️ executeMethods start: ${instanceId}`);

  if (overlayDebug) {
    this.logToMain(`${performance.now()}`);
    this.logToMain(`executeMethods: ${instanceId}`);
  }

  let needsMatrixUpdate = false;
  let matrixOptions: unknown = null;
  const otherMethods: unknown[] = [];
  forEach(methods as unknown, (methodRaw) => {
    const method = methodRaw as MethodEntry | null;
    if (method?.name === "matrix") {
      needsMatrixUpdate = true;
      matrixOptions = method.options;
    } else {
      otherMethods.push(methodRaw);
    }
  });

  if (needsMatrixUpdate && this.trackSandboxHost && this.activeTrack) {
    const assetsBaseUrl = this.getAssetsBaseUrlForSandboxToken(
      (this.trackSandboxHost as { token?: unknown } | null)?.token
    );
    const moduleSources = this.trackModuleSources || {};
    if (assetsBaseUrl) {
      const res = await this.trackSandboxHost?.setMatrixForInstance?.({
        instanceId,
        track: this.activeTrack,
        moduleSources,
        assetsBaseUrl,
        matrixOptions,
      });
      if (!res || typeof res !== "object" || (res as { ok?: unknown }).ok !== true) {
        throw new Error(
          String(
            (res as { error?: unknown } | null)?.error || "SANDBOX_SET_MATRIX_FAILED"
          )
        );
      }
    }
  }

  if (debugEnabled) logger.log(`⏱️ Other methods execution start: ${instanceId}`);
  await Promise.all(
    otherMethods.map(async (methodRaw) => {
      const { name: methodName, options: methodOptions } = methodRaw as {
        name?: unknown;
        options?: unknown;
      };
      const options = buildMethodOptions(methodOptions, {
        onInvalidRandomRange: ({ name, min, max, value }) => {
          if (debugEnabled) {
            console.warn(
              `[Projector] Invalid randomRange for "${name}": [${min}, ${max}] - expected numbers. Using value: ${value}`
            );
          }
        },
        onSwapRandomRange: ({ name, min, max }) => {
          if (debugEnabled) {
            console.warn(
              `[Projector] Invalid randomRange for "${name}": min (${min}) > max (${max}). Swapping values.`
            );
          }
        },
        noRepeatCache: this.methodOptionNoRepeatCache || undefined,
        noRepeatKeyPrefix: `${instanceId}:${methodName}`,
      });

      if (overlayDebug) {
        const timestamp = (
          ((debugContext as { timestamp?: unknown } | null)?.timestamp ||
            performance.now() / 1000) as number
        ).toFixed(5);
        let log = `[${timestamp}] Method Execution\n`;
        if ((debugContext as { trackName?: unknown } | null)?.trackName) {
          log += `  Track: ${(debugContext as { trackName?: unknown }).trackName}\n`;
        }
        if ((debugContext as { moduleInfo?: unknown } | null)?.moduleInfo) {
          const mi = (debugContext as { moduleInfo?: unknown }).moduleInfo as
            | { instanceId?: unknown; type?: unknown }
            | null;
          log += `  Module: ${mi?.instanceId} (${mi?.type})\n`;
        }
        log += `  Method: ${methodName}\n`;
        if (options && Object.keys(options).length > 0) {
          log += `  Props: ${JSON.stringify(options, null, 2)}\n`;
        }
        this.queueDebugLog(log);
      }

      if (debugEnabled) {
        logger.log(`⏱️ Method start: ${methodName} for ${instanceId}`);
      }
      if (overlayDebug) {
        this.logToMain(`${JSON.stringify(options)} [${performance.now()}]`);
      }

      const host = this.trackSandboxHost;
      if (!host) return;
      const res = await host.invokeOnInstance?.(instanceId, methodName, options);
      if (!res || typeof res !== "object" || (res as { ok?: unknown }).ok !== true) {
        throw new Error(
          String((res as { error?: unknown } | null)?.error || "SANDBOX_INVOKE_FAILED")
        );
      }

      if (isConstructor) {
        if (debugEnabled) {
          logger.log(
            `Executed constructor method "${methodName}" on module "${instanceId}".`
          );
        }
      } else {
        if (debugEnabled) {
          logger.log(
            `Executed method "${methodName}" with options ${JSON.stringify(
              options
            )} on module "${instanceId}".`
          );
        }
      }
      if (debugEnabled) logger.log(`⏱️ Method end: ${methodName} for ${instanceId}`);
    })
  );
  if (debugEnabled) {
    logger.log(`⏱️ Other methods execution end: ${instanceId}`);
    logger.log(`⏱️ executeMethods end: ${instanceId}`);
  }
}

