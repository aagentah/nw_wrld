export function normalizeOpenExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.toString();
}

