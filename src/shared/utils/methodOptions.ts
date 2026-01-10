export interface MethodOptionEntry<T = unknown> {
  name: string;
  value?: T;
  randomValues?: T[];
  randomRange?: [number, number];
}

export interface MethodOptionsResult {
  [key: string]: unknown;
}

export interface BuildMethodOptionsCallbacks {
  onInvalidRandomRange?: (context: {
    name: string;
    min: unknown;
    max: unknown;
    value: unknown;
  }) => void;
  onSwapRandomRange?: (context: { name: string; min: number; max: number }) => void;
}

export interface BuildMethodOptionsOptions extends BuildMethodOptionsCallbacks {
  noRepeatCache?: Map<string, unknown>;
  noRepeatKeyPrefix?: string;
}

export interface MatrixOptions {
  rows: number;
  cols: number;
  border: boolean;
  excludedCells: number[];
}

export interface MatrixValue {
  rows?: number;
  cols?: number;
  excludedCells?: number[];
}

/**
 * Builds method options from method option entries, handling static values,
 * random value selection, and random range generation.
 *
 * @param methodOptions - Array of method option entries or undefined
 * @param options - Configuration for callbacks and no-repeat behavior
 * @returns Object mapping option names to their resolved values
 */
export const buildMethodOptions = (
  methodOptions: MethodOptionEntry[] | undefined | null,
  {
    onInvalidRandomRange,
    onSwapRandomRange,
    noRepeatCache,
    noRepeatKeyPrefix,
  }: BuildMethodOptionsOptions = {}
): MethodOptionsResult => {
  const out: MethodOptionsResult = {};
  const list = Array.isArray(methodOptions) ? methodOptions : [];
  const canNoRepeat =
    noRepeatCache &&
    typeof noRepeatCache.get === 'function' &&
    typeof noRepeatCache.set === 'function' &&
    typeof noRepeatKeyPrefix === 'string' &&
    noRepeatKeyPrefix.length > 0;

  for (const entry of list) {
    const name = entry?.name;
    if (!name) continue;

    const rv = entry?.randomValues;
    if (Array.isArray(rv) && rv.length > 0) {
      const key = canNoRepeat ? `${noRepeatKeyPrefix}:${name}:rv` : null;
      const last = key ? noRepeatCache.get(key) : undefined;
      const candidates =
        last !== undefined && rv.length > 1 ? rv.filter((v) => v !== last) : rv;
      const picked =
        candidates[Math.floor(Math.random() * Math.max(1, candidates.length))];
      out[name] = picked;
      if (key) noRepeatCache.set(key, picked);
      continue;
    }

    const rr = entry?.randomRange;
    if (rr && Array.isArray(rr) && rr.length === 2) {
      let [min, max] = rr;

      if (typeof min !== 'number' || typeof max !== 'number') {
        if (typeof onInvalidRandomRange === 'function') {
          try {
            onInvalidRandomRange({ name, min, max, value: entry?.value });
          } catch {}
        }
        out[name] = entry?.value;
        continue;
      }

      if (min > max) {
        if (typeof onSwapRandomRange === 'function') {
          try {
            onSwapRandomRange({ name, min, max });
          } catch {}
        }
        [min, max] = [max, min];
      }

      if (Number.isInteger(min) && Number.isInteger(max)) {
        const key = canNoRepeat ? `${noRepeatKeyPrefix}:${name}:rrInt` : null;
        const last = key ? noRepeatCache.get(key) : undefined;
        const range = max - min + 1;
        let picked = Math.floor(Math.random() * range) + min;
        if (key && range > 1 && typeof last === 'number' && picked === last) {
          picked = picked < max ? picked + 1 : min;
        }
        out[name] = picked;
        if (key) noRepeatCache.set(key, picked);
      } else {
        out[name] = Math.random() * (max - min) + min;
      }
      continue;
    }

    out[name] = entry?.value;
  }

  return out;
};

/**
 * Parses matrix-specific options from method options.
 *
 * @param methodOptions - Array of method option entries
 * @returns Parsed matrix configuration with rows, columns, border, and excluded cells
 */
export const parseMatrixOptions = (
  methodOptions: MethodOptionEntry[] | undefined | null
): MatrixOptions => {
  const options = buildMethodOptions(methodOptions);
  const border = Boolean(options.border);
  const m = options.matrix as MatrixValue | [number, number] | undefined;

  let rows = 1;
  let cols = 1;
  let excludedCells: number[] = [];

  if (Array.isArray(m)) {
    rows = m[0] || 1;
    cols = m[1] || 1;
  } else if (m && typeof m === 'object') {
    rows = m.rows || 1;
    cols = m.cols || 1;
    excludedCells = Array.isArray(m.excludedCells) ? m.excludedCells : [];
  }

  return {
    rows: Math.max(1, Math.min(5, Number(rows) || 1)),
    cols: Math.max(1, Math.min(5, Number(cols) || 1)),
    excludedCells,
    border,
  };
};
