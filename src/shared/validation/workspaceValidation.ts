type Jsonish =
  | string
  | number
  | boolean
  | null
  | undefined
  | Jsonish[]
  | { [k: string]: Jsonish };

function isPlainObject(value: Jsonish): value is Record<string, Jsonish> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function asTrimmedString(value: Jsonish): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function isFiniteNumber(value: Jsonish): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export type ModuleSummary = {
  file: string;
  id: string;
  name?: string;
  category?: string;
  hasMetadata: boolean;
};

export function normalizeModuleSummaries(value: Jsonish): ModuleSummary[] {
  const list = Array.isArray(value) ? value : [];
  const out: ModuleSummary[] = [];
  for (const item of list) {
    if (!isPlainObject(item)) continue;
    const file = asTrimmedString(item.file);
    const id = asTrimmedString(item.id);
    if (!file || !id) continue;
    const name = asTrimmedString(item.name);
    const category = asTrimmedString(item.category);
    const hasMetadata = item.hasMetadata === true;
    const row: ModuleSummary = { file, id, hasMetadata };
    if (name) row.name = name;
    if (category) row.category = category;
    out.push(row);
  }
  return out;
}

export type SkippedWorkspaceModule = {
  file: string;
  reason: string;
};

export function normalizeSkippedWorkspaceModules(value: Jsonish): SkippedWorkspaceModule[] {
  const list = Array.isArray(value) ? value : [];
  const out: SkippedWorkspaceModule[] = [];
  for (const item of list) {
    if (!isPlainObject(item)) continue;
    const file = asTrimmedString(item.file);
    const reason = asTrimmedString(item.reason);
    if (!file || !reason) continue;
    out.push({ file, reason });
  }
  return out;
}

export type WorkspaceModuleScanResult = {
  summaries: ModuleSummary[];
  skipped: SkippedWorkspaceModule[];
};

export function normalizeWorkspaceModuleScanResult(value: Jsonish): WorkspaceModuleScanResult {
  if (!isPlainObject(value)) return { summaries: [], skipped: [] };
  const summaries = normalizeModuleSummaries(value.summaries);
  const skipped = normalizeSkippedWorkspaceModules(value.skipped);
  return { summaries, skipped };
}

export type ModuleWithMeta = { text: string; mtimeMs: number };

export function normalizeModuleWithMeta(value: Jsonish): ModuleWithMeta | null {
  if (!isPlainObject(value)) return null;
  const text = typeof value.text === "string" ? value.text : null;
  const mtimeMs = isFiniteNumber(value.mtimeMs) ? value.mtimeMs : null;
  if (text == null || mtimeMs == null) return null;
  return { text, mtimeMs };
}

export type ModuleUrlResult = { url: string; mtimeMs: number };

export function normalizeModuleUrlResult(
  value: Jsonish
): ModuleUrlResult | null {
  if (!isPlainObject(value)) return null;
  const url = asTrimmedString(value.url);
  const mtimeMs = isFiniteNumber(value.mtimeMs) ? value.mtimeMs : null;
  if (!url || mtimeMs == null) return null;
  return { url, mtimeMs };
}
