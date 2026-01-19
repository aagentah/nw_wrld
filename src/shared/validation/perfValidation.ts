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

function asFiniteNumber(value: Jsonish): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampFiniteNumber(value: number, min: number, max: number): number {
  const v = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, v));
}

export type SandboxPerfStats = {
  fps: number;
  frameMsAvg: number;
  longFramePct: number;
  at: number;
};

export function normalizeSandboxPerfStats(value: unknown): SandboxPerfStats | null {
  const v = value as Jsonish;
  if (!isPlainObject(v)) return null;

  const fpsRaw = asFiniteNumber(v.fps);
  const frameMsAvgRaw = asFiniteNumber(v.frameMsAvg);
  if (fpsRaw == null || frameMsAvgRaw == null) return null;

  const longFramePctRaw = asFiniteNumber(v.longFramePct) ?? 0;
  const atRaw = asFiniteNumber(v.at);
  if (atRaw == null) return null;

  const fps = clampFiniteNumber(fpsRaw, 0, 240);
  const frameMsAvg = clampFiniteNumber(frameMsAvgRaw, 0, 10_000);
  const longFramePct = clampFiniteNumber(longFramePctRaw, 0, 100);
  const at = clampFiniteNumber(atRaw, 0, 9_999_999_999_999);

  return { fps, frameMsAvg, longFramePct, at };
}

