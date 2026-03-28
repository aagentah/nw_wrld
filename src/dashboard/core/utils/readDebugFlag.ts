export function readDebugFlag(key: string): boolean {
  try {
    const ls = (globalThis as unknown as { localStorage?: Storage }).localStorage;
    if (!ls) return false;
    return ls.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function readLocalStorageNumber(key: string, fallback: number): number {
  try {
    const ls = (globalThis as unknown as { localStorage?: Storage }).localStorage;
    if (!ls) return fallback;
    const raw = ls.getItem(key);
    if (raw == null) return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

