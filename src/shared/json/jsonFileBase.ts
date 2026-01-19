type WriteResult = { ok?: unknown; reason?: unknown } | null | undefined;

function getJsonBridge(): {
  read?: (filename: string, defaultValue: unknown) => Promise<unknown>;
  readSync?: (filename: string, defaultValue: unknown) => unknown;
  write?: (filename: string, data: unknown) => Promise<unknown>;
  writeSync?: (filename: string, data: unknown) => unknown;
} | null {
  const bridge = (globalThis as unknown as { nwWrldAppBridge?: unknown }).nwWrldAppBridge;
  if (!bridge || typeof bridge !== "object") return null;

  const json = (bridge as { json?: unknown }).json;
  if (!json || typeof json !== "object") return null;

  const j = json as {
    read?: unknown;
    readSync?: unknown;
    write?: unknown;
    writeSync?: unknown;
  };

  return {
    read:
      typeof j.read === "function"
        ? (j.read as (filename: string, defaultValue: unknown) => Promise<unknown>)
        : undefined,
    readSync:
      typeof j.readSync === "function"
        ? (j.readSync as (filename: string, defaultValue: unknown) => unknown)
        : undefined,
    write:
      typeof j.write === "function"
        ? (j.write as (filename: string, data: unknown) => Promise<unknown>)
        : undefined,
    writeSync:
      typeof j.writeSync === "function"
        ? (j.writeSync as (filename: string, data: unknown) => unknown)
        : undefined,
  };
}

export const getJsonDir = (): null => null;

export const getJsonFilePath = (filename: string): string => filename;

export const loadJsonFile = async <T>(
  filename: string,
  defaultValue: T,
  warningMsg?: string
): Promise<T> => {
  const bridge = getJsonBridge();
  if (!bridge || !bridge.read) {
    if (warningMsg) console.warn(warningMsg);
    return defaultValue;
  }
  try {
    return (await bridge.read(filename, defaultValue)) as T;
  } catch (e) {
    if (warningMsg) console.warn(warningMsg, e);
    return defaultValue;
  }
};

export const loadJsonFileSync = <T>(filename: string, defaultValue: T, errorMsg?: string): T => {
  const bridge = getJsonBridge();
  if (!bridge || !bridge.readSync) {
    if (errorMsg) console.error(errorMsg);
    return defaultValue;
  }
  try {
    return bridge.readSync(filename, defaultValue) as T;
  } catch (e) {
    if (errorMsg) console.error(errorMsg, e);
    return defaultValue;
  }
};

export const saveJsonFile = async (filename: string, data: unknown): Promise<void> => {
  const bridge = getJsonBridge();
  if (!bridge || !bridge.write) {
    console.error(`Refusing to write ${filename}: json bridge is unavailable.`);
    return;
  }
  try {
    const res = (await bridge.write(filename, data)) as WriteResult;
    if (res && (res as { ok?: unknown }).ok === false) {
      console.error(
        `Refusing to write ${filename}: project folder is not available (${
          (res as { reason?: unknown }).reason
        }).`
      );
    }
  } catch (e) {
    console.error(`Error writing ${filename}:`, e);
  }
};

export const saveJsonFileSync = (filename: string, data: unknown): void => {
  const bridge = getJsonBridge();
  if (!bridge || !bridge.writeSync) {
    console.error(`Refusing to write ${filename} (sync): json bridge is unavailable.`);
    return;
  }
  try {
    const res = bridge.writeSync(filename, data) as WriteResult;
    if (res && (res as { ok?: unknown }).ok === false) {
      console.error(
        `Refusing to write ${filename} (sync): project folder is not available (${
          (res as { reason?: unknown }).reason
        }).`
      );
    }
  } catch (e) {
    console.error(`Error writing ${filename} (sync):`, e);
  }
};
