export interface SdkHelpers {
  assetUrl: (relPath: string) => string | null;
  readText: (relPath: string) => Promise<string | null>;
  loadJson: <T = unknown>(relPath: string) => Promise<T | null>;
}

export interface CreateSdkHelpersOptions {
  assetUrlImpl?: (relPath: string) => string;
  readTextImpl?: (relPath: string) => Promise<string | unknown>;
  normalizeRelPath?: (relPath: string) => string | null;
}

/**
 * Creates SDK helper functions for asset and file operations.
 *
 * @param options - Implementation functions for asset URL, text reading, and path normalization
 * @returns Object containing assetUrl, readText, and loadJson functions
 */
export const createSdkHelpers = ({
  assetUrlImpl,
  readTextImpl,
  normalizeRelPath,
}: CreateSdkHelpersOptions = {}): SdkHelpers => {
  const normalize = (relPath: string): string | null => {
    if (typeof normalizeRelPath === 'function') {
      try {
        return normalizeRelPath(relPath);
      } catch {
        return null;
      }
    }
    return relPath;
  };

  const assetUrl = (relPath: string): string | null => {
    const safe = normalize(relPath);
    if (safe == null) return null;
    if (typeof assetUrlImpl !== 'function') return null;
    try {
      return assetUrlImpl(safe);
    } catch {
      return null;
    }
  };

  const readText = async (relPath: string): Promise<string | null> => {
    const safe = normalize(relPath);
    if (safe == null) return null;
    if (typeof readTextImpl !== 'function') return null;
    try {
      const res = await readTextImpl(safe);
      return typeof res === 'string' ? res : null;
    } catch {
      return null;
    }
  };

  const loadJson = async <T = unknown>(relPath: string): Promise<T | null> => {
    try {
      const text = await readText(relPath);
      if (!text) return null;
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  };

  return { assetUrl, readText, loadJson };
};
