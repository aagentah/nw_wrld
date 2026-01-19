type Bridge = {
  app?: {
    getBaseMethodNames?: () => unknown;
  };
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

const asBaseMethodNames = (
  value: unknown
): { moduleBase: string[]; threeBase: string[] } | null => {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!isStringArray(v.moduleBase)) return null;
  if (!isStringArray(v.threeBase)) return null;
  return { moduleBase: v.moduleBase, threeBase: v.threeBase };
};

export const getBaseMethodNames = (): { moduleBase: string[]; threeBase: string[] } => {
  try {
    const bridge = globalThis.nwWrldBridge as unknown as Bridge;
    const fn = bridge?.app?.getBaseMethodNames;
    if (typeof fn !== "function") {
      return { moduleBase: [], threeBase: [] };
    }
    const res = fn();
    return asBaseMethodNames(res) || { moduleBase: [], threeBase: [] };
  } catch (error) {
    console.error("Error reading base files:", error);
    return { moduleBase: [], threeBase: [] };
  }
};

