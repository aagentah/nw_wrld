export function decodeUrlPathSegment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded) return null;
    if (decoded.includes("\u0000")) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function decodeUrlPathSegmentNoSeparators(value: unknown): string | null {
  const decoded = decodeUrlPathSegment(value);
  if (!decoded) return null;
  if (decoded.includes("/") || decoded.includes("\\")) return null;
  return decoded;
}
