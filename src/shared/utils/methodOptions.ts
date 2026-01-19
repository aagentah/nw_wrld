type Jsonish = string | number | boolean | null | undefined | object;

type CacheLike = {
  get?: (key: string) => unknown;
  set?: (key: string, value: unknown) => void;
};

type MethodOption = {
  name?: unknown;
  value?: unknown;
  randomValues?: unknown;
  randomRange?: unknown;
};

type BuildMethodOptionsArgs = {
  onInvalidRandomRange?: (info: {
    name: unknown;
    min: unknown;
    max: unknown;
    value: unknown;
  }) => void;
  onSwapRandomRange?: (info: { name: unknown; min: unknown; max: unknown }) => void;
  noRepeatCache?: CacheLike;
  noRepeatKeyPrefix?: unknown;
};

export const buildMethodOptions = (
  methodOptions: unknown,
  {
    onInvalidRandomRange,
    onSwapRandomRange,
    noRepeatCache,
    noRepeatKeyPrefix,
  }: BuildMethodOptionsArgs = {}
) => {
  const out: Record<string, unknown> = {};
  const list = Array.isArray(methodOptions) ? (methodOptions as unknown[]) : [];
  const canNoRepeat =
    Boolean(noRepeatCache) &&
    typeof noRepeatCache?.get === "function" &&
    typeof noRepeatCache?.set === "function" &&
    typeof noRepeatKeyPrefix === "string" &&
    noRepeatKeyPrefix.length > 0;

  for (const entryRaw of list) {
    const entry = entryRaw as MethodOption | null;
    const name = entry?.name;
    if (!name) continue;
    const keyName = String(name);
    if (!keyName) continue;

    const rv = entry?.randomValues;
    if (Array.isArray(rv) && rv.length > 0) {
      const key = canNoRepeat ? `${noRepeatKeyPrefix}:${keyName}:rv` : null;
      const last = key ? (noRepeatCache as CacheLike).get?.(key) : undefined;
      const candidates = last !== undefined && rv.length > 1 ? rv.filter((v) => v !== last) : rv;
      const picked = candidates[Math.floor(Math.random() * Math.max(1, candidates.length))];
      out[keyName] = picked;
      if (key) (noRepeatCache as CacheLike).set?.(key, picked);
      continue;
    }

    const rr = entry?.randomRange;
    if (rr && Array.isArray(rr) && rr.length === 2) {
      const minRaw = rr[0];
      const maxRaw = rr[1];

      if (typeof minRaw !== "number" || typeof maxRaw !== "number") {
        if (typeof onInvalidRandomRange === "function") {
          try {
            onInvalidRandomRange({
              name,
              min: minRaw,
              max: maxRaw,
              value: entry?.value,
            });
          } catch {}
        }
        out[keyName] = entry?.value;
        continue;
      }

      let min = minRaw;
      let max = maxRaw;

      if (min > max) {
        if (typeof onSwapRandomRange === "function") {
          try {
            onSwapRandomRange({ name, min, max });
          } catch {}
        }
        const t = min;
        min = max;
        max = t;
      }

      if (Number.isInteger(min) && Number.isInteger(max)) {
        const key = canNoRepeat ? `${noRepeatKeyPrefix}:${keyName}:rrInt` : null;
        const last = key ? (noRepeatCache as CacheLike).get?.(key) : undefined;
        const range = max - min + 1;
        let picked = Math.floor(Math.random() * range) + min;
        if (key && range > 1 && typeof last === "number" && picked === last) {
          picked = picked < max ? picked + 1 : min;
        }
        out[keyName] = picked;
        if (key) (noRepeatCache as CacheLike).set?.(key, picked);
      } else {
        out[keyName] = Math.random() * (max - min) + min;
      }
      continue;
    }

    out[keyName] = entry?.value;
  }

  return out;
};

export const parseMatrixOptions = (methodOptions: unknown) => {
  const options = buildMethodOptions(methodOptions) as Record<string, unknown>;
  const border = Boolean(options.border);
  const m = options.matrix as Jsonish;

  let rows: unknown = 1;
  let cols: unknown = 1;
  let excludedCells: unknown = [];

  if (Array.isArray(m)) {
    rows = m[0] ?? 1;
    cols = m[1] ?? 1;
  } else if (m && typeof m === "object") {
    const mm = m as { rows?: unknown; cols?: unknown; excludedCells?: unknown };
    rows = mm.rows ?? 1;
    cols = mm.cols ?? 1;
    excludedCells = mm.excludedCells ?? [];
  }

  return {
    rows: Math.max(1, Math.min(5, Number(rows) || 1)),
    cols: Math.max(1, Math.min(5, Number(cols) || 1)),
    excludedCells: Array.isArray(excludedCells) ? excludedCells : [],
    border,
  };
};
