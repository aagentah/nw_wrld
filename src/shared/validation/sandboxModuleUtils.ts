const WORKSPACE_MODULE_ALLOWED_IMPORTS = new Set([
  "ModuleBase",
  "BaseThreeJsModule",
  "assetUrl",
  "readText",
  "loadJson",
  "listAssets",
  "THREE",
  "p5",
  "d3",
  "Noise",
  "OBJLoader",
  "PLYLoader",
  "PCDLoader",
  "GLTFLoader",
  "STLLoader",
]);

export const getTokenFromLocationHash = (hash: unknown): string | null => {
  try {
    const h = String(hash || "");
    const raw = h.startsWith("#") ? h.slice(1) : h;
    const params = new URLSearchParams(raw);
    const token = params.get("token");
    return token ? String(token) : null;
  } catch {
    return null;
  }
};

export const safeAssetRelPath = (relPath: unknown): string | null => {
  const raw = String((relPath ?? "") as unknown).trim();
  if (!raw) return null;
  if (raw.includes(":")) return null;
  if (raw.startsWith("/") || raw.startsWith("\\")) return null;
  if (/^[A-Za-z]:[\\/]/.test(raw)) return null;
  if (raw.includes("\\")) return null;
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length) return null;
  for (const p of parts) {
    if (p === "." || p === "") continue;
    if (p === "..") return null;
  }
  return parts.join("/");
};

export const ensureTrailingSlash = (url: unknown): string => {
  const s = String(url || "");
  return s.endsWith("/") ? s : `${s}/`;
};

export const buildWorkspaceImportPreamble = (
  moduleId: unknown,
  importsList: unknown
): string => {
  const safeModuleId = String(moduleId || "");
  const requested = Array.isArray(importsList) ? importsList : [];
  if (!requested.length) {
    throw new Error(
      `[Sandbox] Workspace module "${safeModuleId}" missing required @nwWrld imports.`
    );
  }
  for (const token of requested) {
    if (typeof token !== "string" || !WORKSPACE_MODULE_ALLOWED_IMPORTS.has(token)) {
      throw new Error(
        `[Sandbox] Workspace module "${safeModuleId}" requested unknown import "${String(
          token
        )}".`
      );
    }
  }

  const sdkImports = requested.filter(
    (t) =>
      t === "ModuleBase" ||
      t === "BaseThreeJsModule" ||
      t === "assetUrl" ||
      t === "readText" ||
      t === "loadJson" ||
      t === "listAssets"
  );
  const globalImports = requested.filter((t) => !sdkImports.includes(t));

  const lines: string[] = [];
  if (sdkImports.length) {
    lines.push(`const { ${sdkImports.join(", ")} } = globalThis.nwWrldSdk || {};`);
  }
  for (const g of globalImports) {
    lines.push(`const ${g} = globalThis.${g};`);
  }
  for (const token of requested) {
    lines.push(`if (!${token}) { throw new Error("Missing required import: ${token}"); }`);
  }
  return `${lines.join("\n")}\n`;
};

