import { produce } from "immer";
import { migrateToSets, getActiveSet } from "../../shared/utils/setUtils";
import {
  DEFAULT_GLOBAL_MAPPINGS,
  DEFAULT_INPUT_CONFIG,
} from "../../shared/config/defaultConfig";
import { loadJsonFile, saveJsonFile, saveJsonFileSync } from "../../shared/json/jsonFileBase";

export const getBridge = () => globalThis.nwWrldBridge;

export const randomIdSuffix = () => Math.random().toString(36).slice(2, 11);

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

export const isValidHexColor = (value: string): boolean => /^#([0-9A-F]{3}){1,2}$/i.test(value);

export const normalizeHexColor = (value: unknown): string | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (!isValidHexColor(withHash)) return null;
  const hex = withHash.toLowerCase();
  if (hex.length === 4) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return hex;
};

const getMethodsByLayer = (module: unknown, moduleBase: string[], threeBase: string[]) => {
  const m = module as { methods?: Array<{ name?: unknown }>; name?: unknown } | null;
  if (!m || !Array.isArray(m.methods)) return [];

  const layers: Array<{ name: string; methods: string[] }> = [];
  const allModuleMethods = m.methods.map((mm) => String(mm?.name || ""));

  const baseMethodsInModule = allModuleMethods.filter((name) => moduleBase.includes(name));
  if (baseMethodsInModule.length > 0) {
    layers.push({
      name: "Base",
      methods: baseMethodsInModule,
    });
  }

  const threeBaseMethodsOnly = threeBase.filter((name) => !moduleBase.includes(name));
  const threeMethodsInModule = allModuleMethods.filter((name) =>
    threeBaseMethodsOnly.includes(name)
  );
  if (threeMethodsInModule.length > 0) {
    layers.push({
      name: "Three.js Base",
      methods: threeMethodsInModule,
    });
  }

  const allBaseMethods = [...moduleBase, ...threeBase];
  const moduleMethods = allModuleMethods.filter((name) => !allBaseMethods.includes(name));
  if (moduleMethods.length > 0) {
    layers.push({
      name: String(m.name || ""),
      methods: moduleMethods,
    });
  }

  return layers;
};

type UserDataState = { config: Record<string, unknown>; sets: unknown[] } & Record<string, unknown>;
type SetStateAction<T> = T | ((prev: T) => T);
export type SetUserData = (action: SetStateAction<UserDataState>) => void;

const updateUserData = (setUserData: SetUserData, updater: (draft: UserDataState) => void) => {
  setUserData((prev) =>
    produce(prev, (draft) => {
      updater(draft as unknown as UserDataState);
    }) as unknown as UserDataState
  );
};

const loadUserData = async () => {
  const defaultData = {
    config: {
      activeSetId: "set_1",
      trackMappings: DEFAULT_GLOBAL_MAPPINGS.trackMappings,
      channelMappings: DEFAULT_GLOBAL_MAPPINGS.channelMappings,
      input: DEFAULT_INPUT_CONFIG,
    },
    sets: [
      {
        id: "set_1",
        name: "Set 1",
        tracks: [],
      },
    ],
    _isDefaultData: true,
  };

  const parsedData = await loadJsonFile(
    "userData.json",
    defaultData,
    "Could not load userData.json, initializing with empty data."
  );

  const migratedData = migrateToSets(parsedData as unknown) as Record<string, unknown>;

  if (!migratedData.config) {
    migratedData.config = {};
  }
  if (!Array.isArray(migratedData.sets)) {
    migratedData.sets = [];
  }

  if (!(migratedData.config as Record<string, unknown>).trackMappings) {
    (migratedData.config as Record<string, unknown>).trackMappings =
      DEFAULT_GLOBAL_MAPPINGS.trackMappings;
  } else if ((migratedData.config as Record<string, unknown>).trackMappings) {
    const tm = (migratedData.config as Record<string, unknown>).trackMappings as Record<
      string,
      unknown
    >;
    if (tm?.midi) {
      const currentMidi = tm.midi as unknown;
      if (
        typeof currentMidi === "object" &&
        currentMidi !== null &&
        !("pitchClass" in (currentMidi as Record<string, unknown>)) &&
        !("exactNote" in (currentMidi as Record<string, unknown>))
      ) {
        tm.midi = {
          pitchClass: currentMidi,
          exactNote: { ...DEFAULT_GLOBAL_MAPPINGS.trackMappings.midi.exactNote },
        };
      }
    }
  }

  if (!(migratedData.config as Record<string, unknown>).channelMappings) {
    (migratedData.config as Record<string, unknown>).channelMappings =
      DEFAULT_GLOBAL_MAPPINGS.channelMappings;
  } else if ((migratedData.config as Record<string, unknown>).channelMappings) {
    const cm = (migratedData.config as Record<string, unknown>).channelMappings as Record<
      string,
      unknown
    >;
    if (cm?.midi) {
      const currentMidi = cm.midi as unknown;
      if (
        typeof currentMidi === "object" &&
        currentMidi !== null &&
        !("pitchClass" in (currentMidi as Record<string, unknown>)) &&
        !("exactNote" in (currentMidi as Record<string, unknown>))
      ) {
        cm.midi = {
          pitchClass: currentMidi,
          exactNote: { ...DEFAULT_GLOBAL_MAPPINGS.channelMappings.midi.exactNote },
        };
      }
    }
  }

  if (!(migratedData.config as Record<string, unknown>).input) {
    (migratedData.config as Record<string, unknown>).input = DEFAULT_INPUT_CONFIG;
  } else {
    (migratedData.config as Record<string, unknown>).input = {
      ...DEFAULT_INPUT_CONFIG,
      ...((migratedData.config as Record<string, unknown>).input as Record<string, unknown>),
    };
  }

  (migratedData as Record<string, unknown>)._loadedSuccessfully = !(migratedData as Record<string, unknown>)._isDefaultData;
  return migratedData as unknown;
};

const saveUserData = async (data: unknown) => {
  const d = data as Record<string, unknown> | null;
  if (d?._isDefaultData) {
    console.warn(
      "Skipping save: data is default empty data returned from loadUserData error. Not overwriting file."
    );
    return;
  }
  if (Array.isArray(d?.sets) && d.sets.length === 0) {
    console.warn("Skipping save: data has empty sets array. Not overwriting file with empty data.");
    return;
  }
  try {
    const dataToSave = { ...(d || {}) };
    delete (dataToSave as Record<string, unknown>)._isDefaultData;
    delete (dataToSave as Record<string, unknown>)._loadedSuccessfully;
    await saveJsonFile("userData.json", dataToSave);
  } catch (error) {
    console.error("Error writing userData to JSON file:", error);
  }
};

const saveUserDataSync = (data: unknown) => {
  const d = data as Record<string, unknown> | null;
  if (d?._isDefaultData) {
    console.warn(
      "Skipping save (sync): data is default empty data returned from loadUserData error. Not overwriting file."
    );
    return;
  }
  if (Array.isArray(d?.sets) && d.sets.length === 0) {
    console.warn(
      "Skipping save (sync): data has empty sets array. Not overwriting file with empty data."
    );
    return;
  }
  try {
    const dataToSave = { ...(d || {}) };
    delete (dataToSave as Record<string, unknown>)._isDefaultData;
    delete (dataToSave as Record<string, unknown>)._loadedSuccessfully;
    saveJsonFileSync("userData.json", dataToSave);
  } catch (error) {
    console.error("Error writing userData to JSON file (sync):", error);
  }
};

const updateActiveSet = (
  setUserData: SetUserData,
  activeSetId: unknown,
  updater: (activeSet: unknown, draft: UserDataState) => void
) => {
  updateUserData(setUserData, (draft) => {
    const activeSet = getActiveSet(draft as unknown, activeSetId as unknown);
    if (!activeSet) return;
    updater(activeSet, draft);
  });
};

export {
  getMethodsByLayer,
  updateUserData,
  loadUserData,
  saveUserData,
  saveUserDataSync,
  updateActiveSet,
};

