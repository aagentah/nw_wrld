type OptionType = "number" | "select" | "color" | "boolean" | "text" | "matrix" | string;

type OptionDefinition = {
  name?: unknown;
  defaultVal?: unknown;
  type?: unknown;
  min?: unknown;
  max?: unknown;
  values?: unknown;
};

type MethodDefinition = {
  name?: unknown;
  options?: unknown;
};

type _MethodOptionValue = {
  name?: unknown;
  value?: unknown;
  randomRange?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
  }
  return null;
}

export const validateOptionValue = (option: OptionDefinition, value: unknown): unknown => {
  const type: OptionType = typeof option.type === "string" ? option.type : "";
  const min = asNumber(option.min);
  const max = asNumber(option.max);
  const values = option.values;

  switch (type) {
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        return option.defaultVal;
      }

      if (min !== null && value < min) {
        return min;
      }

      if (max !== null && value > max) {
        return max;
      }

      return value;

    case "select":
      if (Array.isArray(values) && !values.includes(value) && value !== "random") {
        return option.defaultVal;
      }
      return value;

    case "color":
      if (!/^#([0-9A-F]{3}){1,2}$/i.test(String(value))) {
        return option.defaultVal;
      }
      return value;

    case "boolean":
      if (typeof value !== "boolean") {
        return option.defaultVal;
      }
      return value;

    case "text":
      if (typeof value !== "string") {
        return String(value);
      }
      return value;

    case "matrix":
      if (typeof value !== "object" || value === null) {
        return option.defaultVal;
      }

      {
        const v = value as Record<string, unknown>;
        const rows = v.rows;
        const cols = v.cols;
        const excludedCells = v.excludedCells;

        if (typeof rows !== "number" || Number.isNaN(rows) || rows < 1 || rows > 5) {
          return option.defaultVal;
        }

        if (typeof cols !== "number" || Number.isNaN(cols) || cols < 1 || cols > 5) {
          return option.defaultVal;
        }

        if (!Array.isArray(excludedCells)) {
          return { ...(value as Record<string, unknown>), excludedCells: [] };
        }

        return value;
      }

    default:
      return value;
  }
};

export const validateRandomRange = (
  option: OptionDefinition,
  randomRange: unknown
): [number, number] | null => {
  if (!Array.isArray(randomRange) || randomRange.length !== 2) {
    return null;
  }

  const min = asNumber(randomRange[0]);
  const max = asNumber(randomRange[1]);

  if (min === null || max === null) {
    return null;
  }

  if (min > max) {
    return [max, min];
  }

  const optMin = asNumber(option.min);
  const optMax = asNumber(option.max);

  if (optMin !== null && max < optMin) {
    const m = optMin;
    return [m, m];
  }

  if (optMax !== null && min > optMax) {
    const m = optMax;
    return [m, m];
  }

  return [min, max];
};

export const validateMethodOptions = (
  methodDefinition: MethodDefinition,
  optionsToValidate: unknown
): unknown[] => {
  if (!Array.isArray(optionsToValidate)) {
    return [];
  }

  const defsRaw = isRecord(methodDefinition) ? methodDefinition.options : null;
  const defs: unknown[] = Array.isArray(defsRaw) ? defsRaw : [];

  return optionsToValidate.map((rawOption) => {
    if (!isRecord(rawOption)) return rawOption;
    const optionName = rawOption.name;

    const optionDefRaw =
      defs.find((o) => isRecord(o) && (o as Record<string, unknown>).name === optionName) || null;

    if (!optionDefRaw) {
      return rawOption;
    }

    const optionDef = optionDefRaw as OptionDefinition;
    const validated: Record<string, unknown> = { ...rawOption };

    if (validated.value !== undefined) {
      validated.value = validateOptionValue(optionDef, validated.value);
    }

    if (validated.randomRange !== undefined) {
      const validatedRange = validateRandomRange(optionDef, validated.randomRange);
      if (validatedRange === null) {
        delete validated.randomRange;
      } else {
        validated.randomRange = validatedRange;
      }
    }

    return validated;
  });
};
