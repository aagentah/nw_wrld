type Jsonish =
  | string
  | number
  | boolean
  | null
  | undefined
  | Jsonish[]
  | { [k: string]: Jsonish };

function isPlainObject(value: Jsonish): value is Record<string, Jsonish> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function isFiniteNumber(value: Jsonish): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function asString(value: Jsonish): string | null {
  if (typeof value === "string") {
    const s = value.trim();
    return s ? s : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function asNonEmptyString(value: Jsonish): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function isSafeModuleType(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(value);
}

function normalizeModuleSources(
  value: Jsonish
): Record<string, Jsonish> | null {
  if (!isPlainObject(value)) return null;
  const out: Record<string, Jsonish> = {};
  for (const [k, v] of Object.entries(value)) {
    const key = asNonEmptyString(k);
    if (!key || !isSafeModuleType(key)) continue;
    if (!isPlainObject(v)) continue;
    const text = typeof v.text === "string" ? v.text : null;
    if (text == null) continue;
    out[key] = { text };
  }
  return out;
}

function normalizeTrackModules(value: Jsonish): Jsonish[] | null {
  const list = Array.isArray(value) ? value : null;
  if (!list) return null;
  const out: Jsonish[] = [];
  for (const m of list) {
    if (!isPlainObject(m)) continue;
    const id = asNonEmptyString(m.id);
    const type = asNonEmptyString(m.type);
    if (!id || !type || !isSafeModuleType(type)) continue;
    out.push({ id, type });
  }
  return out;
}

export function normalizeSandboxRequestProps(
  type: string,
  props: Jsonish
): { ok: true; props: Record<string, Jsonish> } | { ok: false; error: string } {
  const t = String(type || "").trim();
  const p = isPlainObject(props) ? props : {};

  if (t === "destroyTrack") {
    return { ok: true, props: {} };
  }

  if (t === "invokeOnInstance") {
    const instanceId = asNonEmptyString(p.instanceId);
    const methodName = asNonEmptyString(p.methodName);
    const options = isPlainObject(p.options) ? p.options : {};
    if (!instanceId) return { ok: false, error: "INVALID_INSTANCE_ID" };
    if (!methodName) return { ok: false, error: "INVALID_METHOD_NAME" };
    return { ok: true, props: { instanceId, methodName, options } };
  }

  if (t === "introspectModule") {
    const moduleType = asNonEmptyString(p.moduleType);
    const sourceText = typeof p.sourceText === "string" ? p.sourceText : null;
    if (!moduleType || !isSafeModuleType(moduleType)) {
      return { ok: false, error: "INVALID_MODULE_TYPE" };
    }
    if (sourceText == null) return { ok: false, error: "INVALID_SOURCE_TEXT" };
    return { ok: true, props: { moduleType, sourceText } };
  }

  if (t === "initTrack" || t === "setMatrixForInstance") {
    const assetsBaseUrl = asNonEmptyString(p.assetsBaseUrl);
    if (!assetsBaseUrl) return { ok: false, error: "INVALID_ASSETS_BASE_URL" };

    if (!isPlainObject(p.track)) return { ok: false, error: "INVALID_TRACK" };
    const track = p.track as Record<string, Jsonish>;
    const modules = normalizeTrackModules(track.modules);
    if (!modules) return { ok: false, error: "INVALID_TRACK_MODULES" };

    const moduleSources = normalizeModuleSources(p.moduleSources);
    if (!moduleSources) return { ok: false, error: "INVALID_MODULE_SOURCES" };

    const neededTypes = new Set(
      modules
        .map((m) => (isPlainObject(m) ? asNonEmptyString(m.type) : null))
        .filter((v): v is string => Boolean(v))
    );
    for (const mt of neededTypes) {
      if (!Object.prototype.hasOwnProperty.call(moduleSources, mt)) {
        return { ok: false, error: `MISSING_MODULE_SOURCE:${mt}` };
      }
    }

    const modulesData = isPlainObject(track.modulesData)
      ? track.modulesData
      : {};
    const safeTrack: Record<string, Jsonish> = {
      ...track,
      modules,
      modulesData,
    };

    if (t === "initTrack") {
      return {
        ok: true,
        props: { track: safeTrack, moduleSources, assetsBaseUrl },
      };
    }

    const instanceId = asNonEmptyString(p.instanceId);
    if (!instanceId) return { ok: false, error: "INVALID_INSTANCE_ID" };
    const matrixOptions = isPlainObject(p.matrixOptions) ? p.matrixOptions : {};
    return {
      ok: true,
      props: {
        instanceId,
        track: safeTrack,
        moduleSources,
        assetsBaseUrl,
        matrixOptions,
      },
    };
  }

  return { ok: false, error: "INVALID_TYPE" };
}

function normalizeOkEnvelope(
  result: Jsonish
): { ok: boolean; error?: string; moduleType?: string } {
  if (!isPlainObject(result)) return { ok: false, error: "INVALID_RESULT" };
  const ok = result.ok;
  const okBool = typeof ok === "boolean" ? ok : false;
  if (okBool) return { ok: true };
  const err = asString(result.error) || "SANDBOX_ERROR";
  const moduleTypeRaw = asNonEmptyString(result.moduleType);
  const moduleType = moduleTypeRaw && isSafeModuleType(moduleTypeRaw) ? moduleTypeRaw : null;
  if (moduleType) return { ok: false, error: err, moduleType };
  return { ok: false, error: err };
}

function normalizeIntrospectionResult(result: Jsonish): Jsonish {
  const env = normalizeOkEnvelope(result);
  if (env.ok !== true) return env;
  if (!isPlainObject(result)) return { ok: false, error: "INVALID_RESULT" };

  const name = asString(result.name) || null;
  const category = asString(result.category) || null;
  const callableRaw = Array.isArray(result.callableMethods)
    ? result.callableMethods
    : [];
  const callableMethods = callableRaw
    .map((v) => asString(v))
    .filter((v): v is string => Boolean(v));

  const methodsRaw = Array.isArray(result.methods) ? result.methods : [];
  const methods = methodsRaw.filter((m) => isPlainObject(m)) as Jsonish[];

  const out: Record<string, Jsonish> = { ok: true, methods, callableMethods };
  if (name) out.name = name;
  if (category) out.category = category;
  return out;
}

function normalizeInitTrackResult(result: Jsonish): Jsonish {
  return normalizeOkEnvelope(result);
}

function normalizeInvokeResult(result: Jsonish): Jsonish {
  return normalizeOkEnvelope(result);
}

function normalizeSetMatrixResult(result: Jsonish): Jsonish {
  return normalizeOkEnvelope(result);
}

function normalizeDestroyTrackResult(result: Jsonish): Jsonish {
  return normalizeOkEnvelope(result);
}

export function normalizeSandboxResult(type: string, result: Jsonish): Jsonish {
  const t = String(type || "").trim();
  if (t === "introspectModule") return normalizeIntrospectionResult(result);
  if (t === "initTrack") return normalizeInitTrackResult(result);
  if (t === "invokeOnInstance") return normalizeInvokeResult(result);
  if (t === "setMatrixForInstance") return normalizeSetMatrixResult(result);
  if (t === "destroyTrack") return normalizeDestroyTrackResult(result);

  if (isPlainObject(result) && typeof result.ok === "boolean") {
    if (result.ok === true) return result;
    const err = asString(result.error) || "SANDBOX_ERROR";
    return { ok: false, error: err };
  }
  return normalizeOkEnvelope(result);
}

export function normalizeSandboxTimeoutMs(value: Jsonish, fallback: number) {
  const ms = isFiniteNumber(value) ? value : fallback;
  if (!Number.isFinite(ms) || ms <= 0) return fallback;
  return Math.min(Math.max(1, Math.floor(ms)), 60_000);
}
