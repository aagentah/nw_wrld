import type { InputConfig } from "../../types/userData";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.prototype.toString.call(v) === "[object Object]";

const asNonEmptyStringPreserve = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  return v.trim() ? v : null;
};

const asIntInRange = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (!Number.isInteger(v)) return null;
  if (v < min || v > max) return null;
  return v;
};

export function normalizeInputConfig(value: unknown): InputConfig | null {
  if (value == null) return null;
  if (!isPlainObject(value)) return null;

  const rawType = asNonEmptyStringPreserve(value.type);
  const type =
    rawType === "midi" || rawType === "osc" || rawType === "audio" || rawType === "file"
      ? rawType
      : null;
  if (!type) return null;

  const trackSelectionChannel = asIntInRange(value.trackSelectionChannel, 1, 16);
  const methodTriggerChannel = asIntInRange(value.methodTriggerChannel, 1, 16);
  const port = asIntInRange(value.port, 1, 65535);
  if (trackSelectionChannel == null || methodTriggerChannel == null || port == null) {
    return null;
  }

  if (typeof value.velocitySensitive !== "boolean") return null;
  const velocitySensitive = value.velocitySensitive;

  const deviceId = asNonEmptyStringPreserve(value.deviceId) || undefined;
  const deviceName = asNonEmptyStringPreserve(value.deviceName) || undefined;
  const noteMatchMode = asNonEmptyStringPreserve(value.noteMatchMode) || undefined;

  let changed = false;
  if (value.type !== type) changed = true;
  if (value.trackSelectionChannel !== trackSelectionChannel) changed = true;
  if (value.methodTriggerChannel !== methodTriggerChannel) changed = true;
  if (value.velocitySensitive !== velocitySensitive) changed = true;
  if (value.port !== port) changed = true;
  if ((value.deviceId ?? undefined) !== (deviceId ?? undefined)) changed = true;
  if ((value.deviceName ?? undefined) !== (deviceName ?? undefined)) changed = true;
  if ((value.noteMatchMode ?? undefined) !== (noteMatchMode ?? undefined)) changed = true;

  if (!changed) return value as unknown as InputConfig;

  const out = { ...(value as Record<string, unknown>) } as Record<string, unknown>;
  out.type = type;
  out.trackSelectionChannel = trackSelectionChannel;
  out.methodTriggerChannel = methodTriggerChannel;
  out.velocitySensitive = velocitySensitive;
  out.port = port;

  if (deviceId) out.deviceId = deviceId;
  else delete out.deviceId;

  if (deviceName) out.deviceName = deviceName;
  else delete out.deviceName;

  if (noteMatchMode) out.noteMatchMode = noteMatchMode;
  else delete out.noteMatchMode;

  return out as unknown as InputConfig;
}
