/**
 * Validates option values against their type definitions with lenient error handling
 * Returns the validated value (or a safe fallback) and logs warnings for invalid inputs
 */

export type OptionType = 'number' | 'select' | 'color' | 'boolean' | 'text' | 'matrix';

export interface OptionDefinition {
  name: string;
  type: OptionType;
  defaultVal: unknown;
  min?: number;
  max?: number;
  values?: unknown[];
}

export interface MatrixValue {
  rows: number;
  cols: number;
  excludedCells: number[];
}

export interface MethodOption {
  name: string;
  value?: unknown;
  randomRange?: [number, number];
}

export interface MethodDefinition {
  name?: string;
  options?: OptionDefinition[];
}

export const validateOptionValue = (option: OptionDefinition, value: unknown): unknown => {
  const { type, min, max, values } = option;

  switch (type) {
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        console.warn(`[Validator] Invalid number value for "${option.name}": ${value}. Using default: ${option.defaultVal}`);
        return option.defaultVal;
      }

      if (min !== undefined && value < min) {
        console.warn(`[Validator] Value ${value} below min ${min} for "${option.name}". Clamping to min.`);
        return min;
      }

      if (max !== undefined && value > max) {
        console.warn(`[Validator] Value ${value} above max ${max} for "${option.name}". Clamping to max.`);
        return max;
      }

      return value;

    case 'select':
      if (values && !values.includes(value) && value !== 'random') {
        console.warn(`[Validator] Invalid select value "${value}" for "${option.name}". Using default: ${option.defaultVal}`);
        return option.defaultVal;
      }
      return value;

    case 'color':
      if (typeof value !== 'string' || !/^#([0-9A-F]{3}){1,2}$/i.test(value)) {
        console.warn(`[Validator] Invalid hex color "${value}" for "${option.name}". Using default: ${option.defaultVal}`);
        return option.defaultVal;
      }
      return value;

    case 'boolean':
      if (typeof value !== 'boolean') {
        console.warn(`[Validator] Invalid boolean value "${value}" for "${option.name}". Using default: ${option.defaultVal}`);
        return option.defaultVal;
      }
      return value;

    case 'text':
      if (typeof value !== 'string') {
        console.warn(`[Validator] Invalid text value for "${option.name}". Converting to string.`);
        return String(value);
      }
      return value;

    case 'matrix':
      // Validate matrix object structure
      if (typeof value !== 'object' || value === null || !('rows' in value) || !('cols' in value) || !('excludedCells' in value)) {
        console.warn(`[Validator] Invalid matrix value for "${option.name}". Using default: ${JSON.stringify(option.defaultVal)}`);
        return option.defaultVal;
      }

      const matrixValue = value as MatrixValue;
      const { rows, cols, excludedCells } = matrixValue;

      if (typeof rows !== 'number' || rows < 1 || rows > 5) {
        console.warn(`[Validator] Invalid matrix rows (${rows}) for "${option.name}". Using default.`);
        return option.defaultVal;
      }

      if (typeof cols !== 'number' || cols < 1 || cols > 5) {
        console.warn(`[Validator] Invalid matrix cols (${cols}) for "${option.name}". Using default.`);
        return option.defaultVal;
      }

      if (!Array.isArray(excludedCells)) {
        console.warn(`[Validator] Invalid matrix excludedCells for "${option.name}". Using empty array.`);
        return { ...value, excludedCells: [] };
      }

      return value;

    default:
      // Unknown type, return as-is
      return value;
  }
};

/**
 * Validates randomRange values for an option
 * Returns validated range or null if invalid
 */
export const validateRandomRange = (option: OptionDefinition, randomRange: unknown): [number, number] | null => {
  if (!Array.isArray(randomRange) || randomRange.length !== 2) {
    console.warn(`[Validator] Invalid randomRange structure for "${option.name}". Expected array of length 2.`);
    return null;
  }

  const [min, max] = randomRange as [unknown, unknown];

  if (typeof min !== 'number' || typeof max !== 'number') {
    console.warn(`[Validator] Invalid randomRange values for "${option.name}": [${min}, ${max}]. Expected numbers.`);
    return null;
  }

  if (min > max) {
    console.warn(`[Validator] Invalid randomRange for "${option.name}": min (${min}) > max (${max}). Swapping values.`);
    return [max, min];
  }

  // Validate against option constraints if present
  if (option.min !== undefined && max < option.min) {
    console.warn(`[Validator] RandomRange max (${max}) below option min (${option.min}) for "${option.name}". Adjusting.`);
    return [option.min, option.min];
  }

  if (option.max !== undefined && min > option.max) {
    console.warn(`[Validator] RandomRange min (${min}) above option max (${option.max}) for "${option.name}". Adjusting.`);
    return [option.max, option.max];
  }

  return [min, max];
};

/**
 * Validates all options in a method definition
 * Returns a validated copy of the options array
 */
export const validateMethodOptions = (
  methodDefinition: MethodDefinition,
  optionsToValidate: unknown[]
): MethodOption[] => {
  if (!Array.isArray(optionsToValidate)) {
    console.warn(`[Validator] Invalid options array for method "${methodDefinition?.name}"`);
    return [];
  }

  return optionsToValidate.map((option): MethodOption => {
    const opt = option as Record<string, unknown>;
    const optionDef = methodDefinition.options?.find(o => o.name === opt.name);

    if (!optionDef) {
      console.warn(`[Validator] Unknown option "${opt.name}" for method "${methodDefinition?.name}"`);
      return option as MethodOption;
    }

    const validated = { ...opt } as unknown as MethodOption;

    // Validate value
    if (validated.value !== undefined) {
      validated.value = validateOptionValue(optionDef, validated.value);
    }

    // Validate randomRange if present
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
