export function escapeRegExpLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidJsIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

export function normalizeGetMethodCodeArgs(
  moduleName: unknown,
  methodName: unknown
): { moduleName: string | null; methodName: string | null } {
  const outModuleName = isNonEmptyString(moduleName) ? moduleName : null;
  if (!isNonEmptyString(methodName)) return { moduleName: outModuleName, methodName: null };
  if (!isValidJsIdentifier(methodName)) return { moduleName: outModuleName, methodName: null };
  return { moduleName: outModuleName, methodName };
}

