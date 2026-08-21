import { getBridge } from "../bridge";

type EnsureSandboxOk = { ok: true; token: string };
// ensureSandbox only RETURNS ok:false for DISPOSED; every other failure throws.
// Widening this union invites callers to if-check failures that never return.
type EnsureSandboxErr = { ok: false; reason: "DISPOSED" };

const STALE_TOKEN_ERRORS = new Set(["TOKEN_NOT_OWNED", "INVALID_TOKEN", "SANDBOX_UNAVAILABLE"]);

const isStaleTokenResult = (res: unknown): boolean =>
  Boolean(
    res &&
      typeof res === "object" &&
      (res as { ok?: unknown }).ok !== true &&
      STALE_TOKEN_ERRORS.has(String((res as { error?: unknown }).error || ""))
  );

export class TrackSandboxHost {
  modulesContainer: unknown;
  token: string | null;
  disposed: boolean;

  constructor(modulesContainer: unknown) {
    this.modulesContainer = modulesContainer;
    this.token = null;
    this.disposed = false;
  }

  async ensureSandbox(): Promise<EnsureSandboxOk | EnsureSandboxErr> {
    if (this.disposed) {
      return { ok: false, reason: "DISPOSED" };
    }
    const bridge = getBridge();
    const ensure = bridge?.sandbox?.ensure;
    if (typeof ensure !== "function") {
      throw new Error(`[Projector] Sandbox bridge is unavailable.`);
    }
    const res = await ensure();
    const token = String((res as { token?: unknown } | null)?.token || "").trim();
    if (!res || (res as { ok?: unknown }).ok !== true || !token) {
      throw new Error(
        ((res as { reason?: unknown } | null)?.reason as string) ||
          "SANDBOX_ENSURE_FAILED"
      );
    }
    this.token = token;
    return { ok: true, token };
  }

  async request(type: string, props: Record<string, unknown> | null) {
    if (!this.token) {
      await this.ensureSandbox();
    }
    const bridge = getBridge();
    const req = bridge?.sandbox?.request;
    if (typeof req !== "function") {
      return { ok: false, error: "SANDBOX_BRIDGE_UNAVAILABLE" };
    }
    const res = await req(this.token as string, type, props || {});
    if (this.disposed || !isStaleTokenResult(res)) {
      return res;
    }
    // Token invalidated out-of-band (sandbox crash/respawn): re-ensure and resend once.
    this.token = null;
    const ensured = await this.ensureSandbox();
    return await req(ensured.ok === true ? ensured.token : "", type, props || {});
  }

  initTrack({
    track,
    moduleSources,
    assetsBaseUrl,
  }: {
    track: unknown;
    moduleSources: unknown;
    assetsBaseUrl: unknown;
  }) {
    return this.request("initTrack", {
      track,
      moduleSources,
      assetsBaseUrl,
    });
  }

  setMatrixForInstance({
    instanceId,
    track,
    moduleSources,
    assetsBaseUrl,
    matrixOptions,
  }: {
    instanceId: unknown;
    track: unknown;
    moduleSources: unknown;
    assetsBaseUrl: unknown;
    matrixOptions: unknown;
  }) {
    return this.request("setMatrixForInstance", {
      instanceId,
      track,
      moduleSources,
      assetsBaseUrl,
      matrixOptions,
    });
  }

  invokeOnInstance(instanceId: unknown, methodName: unknown, options: unknown) {
    return this.request("invokeOnInstance", {
      instanceId,
      methodName,
      options,
    });
  }

  introspectModule(moduleType: unknown, sourceText: unknown) {
    return this.request("introspectModule", { moduleType, sourceText });
  }

  destroyTrack() {
    return this.request("destroyTrack", {});
  }

  async destroy(): Promise<void> {
    this.disposed = true;
    try {
      await getBridge()?.sandbox?.destroy?.();
    } catch {}
    this.token = null;
  }
}

