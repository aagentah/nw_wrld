export interface JsonBridge {
  read: <T = unknown>(filename: string, defaultValue: T) => Promise<T>;
  readSync: <T = unknown>(filename: string, defaultValue: T) => T;
  write: (filename: string, data: unknown) => Promise<WriteResult | undefined>;
  writeSync: (filename: string, data: unknown) => WriteResult | undefined;
}

export interface WriteResult {
  ok: boolean;
  reason?: string;
}

export interface AppBridge {
  json?: JsonBridge;
  project?: {
    getDir: () => string | null;
  };
}

declare global {
  var nwWrldAppBridge: AppBridge | undefined;
}

const getBridge = (): AppBridge | undefined => globalThis.nwWrldAppBridge;

/**
 * Gets the JSON directory (always returns null in base implementation).
 *
 * @returns null
 */
export const getJsonDir = (): null => null;

/**
 * Gets the JSON file path (returns filename as-is in base implementation).
 *
 * @param filename - The filename to process
 * @returns The filename unchanged
 */
export const getJsonFilePath = (filename: string): string => filename;

/**
 * Loads a JSON file asynchronously.
 *
 * @param filename - The filename to load
 * @param defaultValue - The default value to return if loading fails
 * @param warningMsg - Optional warning message to log on failure
 * @returns The loaded JSON data or default value
 */
export const loadJsonFile = async <T = unknown>(
  filename: string,
  defaultValue: T,
  warningMsg?: string
): Promise<T> => {
  const bridge = getBridge();
  if (!bridge || !bridge.json || typeof bridge.json.read !== 'function') {
    if (warningMsg) console.warn(warningMsg);
    return defaultValue;
  }
  try {
    return await bridge.json.read<T>(filename, defaultValue);
  } catch (e) {
    if (warningMsg) console.warn(warningMsg, e);
    return defaultValue;
  }
};

/**
 * Loads a JSON file synchronously.
 *
 * @param filename - The filename to load
 * @param defaultValue - The default value to return if loading fails
 * @param errorMsg - Optional error message to log on failure
 * @returns The loaded JSON data or default value
 */
export const loadJsonFileSync = <T = unknown>(
  filename: string,
  defaultValue: T,
  errorMsg?: string
): T => {
  const bridge = getBridge();
  if (!bridge || !bridge.json || typeof bridge.json.readSync !== 'function') {
    if (errorMsg) console.error(errorMsg);
    return defaultValue;
  }
  try {
    return bridge.json.readSync<T>(filename, defaultValue);
  } catch (e) {
    if (errorMsg) console.error(errorMsg, e);
    return defaultValue;
  }
};

/**
 * Saves a JSON file asynchronously.
 *
 * @param filename - The filename to save to
 * @param data - The data to save
 */
export const saveJsonFile = async (filename: string, data: unknown): Promise<void> => {
  const bridge = getBridge();
  if (!bridge || !bridge.json || typeof bridge.json.write !== 'function') {
    console.error(`Refusing to write ${filename}: json bridge is unavailable.`);
    return;
  }
  const res = await bridge.json.write(filename, data);
  if (res && res.ok === false) {
    console.error(
      `Refusing to write ${filename}: project folder is not available (${res.reason}).`
    );
  }
};

/**
 * Saves a JSON file synchronously.
 *
 * @param filename - The filename to save to
 * @param data - The data to save
 */
export const saveJsonFileSync = (filename: string, data: unknown): void => {
  const bridge = getBridge();
  if (!bridge || !bridge.json || typeof bridge.json.writeSync !== 'function') {
    console.error(
      `Refusing to write ${filename} (sync): json bridge is unavailable.`
    );
    return;
  }
  const res = bridge.json.writeSync(filename, data);
  if (res && res.ok === false) {
    console.error(
      `Refusing to write ${filename} (sync): project folder is not available (${res.reason}).`
    );
  }
};
