const MODULE_METADATA_MAX_BYTES_DEFAULT = 16 * 1024;

const normalizeDocblockValue = (value) => {
  const raw = String(value || "")
    .trim()
    .replace(/\*\/\s*$/, "")
    .trim();
  const m = raw.match(/^["'](.*)["']$/);
  return m ? m[1] : raw;
};

const parseImportsList = (raw) => {
  const normalized = normalizeDocblockValue(raw);
  if (!normalized) return [];
  const tokens = normalized
    .split(",")
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
};

const parseNwWrldDocblockMetadata = (text, maxBytes) => {
  const head = String(text || "").slice(
    0,
    Math.max(0, Number(maxBytes) || MODULE_METADATA_MAX_BYTES_DEFAULT)
  );
  const nameMatch = head.match(/@nwWrld\s+name\s*:\s*([^\r\n]+)/i);
  const categoryMatch = head.match(/@nwWrld\s+category\s*:\s*([^\r\n]+)/i);
  const importsMatch = head.match(/@nwWrld\s+imports\s*:\s*([^\r\n]+)/i);

  const name = nameMatch ? normalizeDocblockValue(nameMatch[1]) : null;
  const category = categoryMatch
    ? normalizeDocblockValue(categoryMatch[1])
    : null;
  const imports = importsMatch ? parseImportsList(importsMatch[1]) : [];

  const hasMetadata = Boolean(name && category && imports.length > 0);
  return { name, category, imports, hasMetadata };
};

module.exports = {
  normalizeDocblockValue,
  parseNwWrldDocblockMetadata,
};
