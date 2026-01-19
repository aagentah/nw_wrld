type ImplFn = (value: unknown) => unknown;
type AsyncImplFn = (value: unknown) => Promise<unknown>;

type CreateSdkHelpersArgs = {
  assetUrlImpl?: ImplFn;
  readTextImpl?: AsyncImplFn;
  normalizeRelPath?: ImplFn;
};

export const createSdkHelpers = (
  { assetUrlImpl, readTextImpl, normalizeRelPath }: CreateSdkHelpersArgs = {}
) => {
  const normalize = (relPath: unknown) => {
    if (typeof normalizeRelPath === "function") {
      try {
        return normalizeRelPath(relPath);
      } catch {
        return null;
      }
    }
    return relPath;
  };

  const assetUrl = (relPath: unknown) => {
    const safe = normalize(relPath);
    if (safe == null) return null;
    if (typeof assetUrlImpl !== "function") return null;
    try {
      return assetUrlImpl(safe);
    } catch {
      return null;
    }
  };

  const readText = async (relPath: unknown) => {
    const safe = normalize(relPath);
    if (safe == null) return null;
    if (typeof readTextImpl !== "function") return null;
    try {
      const res = await readTextImpl(safe);
      return typeof res === "string" ? res : null;
    } catch {
      return null;
    }
  };

  const loadJson = async (relPath: unknown) => {
    try {
      const text = await readText(relPath);
      if (!text) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  return { assetUrl, readText, loadJson };
};

