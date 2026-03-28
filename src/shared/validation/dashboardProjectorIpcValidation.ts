type IpcProps = Record<string, unknown>;

export type DashboardProjectorIpcMessage = {
  type: string;
  props: IpcProps;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function asNonEmptyString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  if (Number.isFinite(maxLen) && maxLen > 0 && s.length > maxLen) return null;
  return s;
}

export function normalizeDashboardProjectorMessage(
  value: unknown
): DashboardProjectorIpcMessage | null {
  if (!isPlainObject(value)) return null;
  const type = asNonEmptyString(value.type, 128);
  if (!type) return null;
  const props = isPlainObject(value.props) ? (value.props as IpcProps) : ({} as IpcProps);
  return { type, props };
}
