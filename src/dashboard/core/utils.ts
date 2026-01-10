import { produce } from "immer";
import { migrateToSets, getActiveSet } from "../../shared/utils/setUtils";
import { DEFAULT_GLOBAL_MAPPINGS } from "../../shared/config/defaultConfig";
import {
  getJsonFilePath,
  loadJsonFile,
  saveJsonFile,
  saveJsonFileSync,
} from "../../shared/json/jsonFileBase";
import type {
  SetId,
  UserData,
  NwSet,
  TrackId,
  GlobalMappings,
} from "../../types";

// Types for getMethodsByLayer
export interface MethodMetadata {
  name: string;
}

export interface ModuleMetadata {
  name: string;
  methods?: MethodMetadata[];
}

export interface MethodLayer {
  name: string;
  methods: string[];
}

// Types for getMethodCode
export interface MethodCodeResult {
  code: string | null;
  filePath: string | null;
}

// Types for loadUserData (with internal flags)
export interface UserDataWithFlags extends UserData {
  _isDefaultData?: boolean;
  _loadedSuccessfully?: boolean;
}

// Types for updateUserData callback
export type UpdaterCallback<T> = (draft: T) => void;

/**
 * Categorizes module methods into layers based on base method lists
 */
export const getMethodsByLayer = (
  module: ModuleMetadata | null | undefined,
  moduleBase: string[],
  threeBase: string[]
): MethodLayer[] => {
  if (!module || !module.methods) return [];

  const layers: MethodLayer[] = [];
  const allModuleMethods = module.methods.map((m) => m.name);

  const baseMethodsInModule = allModuleMethods.filter((name) =>
    moduleBase.includes(name)
  );
  if (baseMethodsInModule.length > 0) {
    layers.push({
      name: "Base",
      methods: baseMethodsInModule,
    });
  }

  const threeBaseMethodsOnly = threeBase.filter(
    (name) => !moduleBase.includes(name)
  );
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
  const moduleMethods = allModuleMethods.filter(
    (name) => !allBaseMethods.includes(name)
  );
  if (moduleMethods.length > 0) {
    layers.push({
      name: module.name,
      methods: moduleMethods,
    });
  }

  return layers;
};

/**
 * Retrieves method code from the bridge
 */
export const getMethodCode = (
  moduleName: string,
  methodName: string
): MethodCodeResult => {
  try {
    const bridge = (globalThis as any).nwWrldBridge;
    if (
      !bridge ||
      !bridge.app ||
      typeof bridge.app.getMethodCode !== "function"
    ) {
      return { code: null, filePath: null };
    }
    const res = bridge.app.getMethodCode(moduleName, methodName);
    return {
      code: res?.code || null,
      filePath: res?.filePath || null,
    };
  } catch (error) {
    console.error("Error extracting method code:", error);
    return { code: null, filePath: null };
  }
};

/**
 * Updates user data using immer for immutable updates
 */
export const updateUserData = <T>(
  setUserData: (updater: (prev: T) => T) => void,
  updater: UpdaterCallback<T>
): void => {
  setUserData((prev) =>
    produce(prev, (draft) => {
      updater(draft as T);
    })
  );
};

/**
 * Gets the file path for user data
 */
export const getUserDataPath = (): string => {
  return getJsonFilePath("userData.json");
};

/**
 * Loads user data from JSON file with migration and validation
 */
export const loadUserData = async (): Promise<UserDataWithFlags> => {
  const defaultData: UserDataWithFlags = {
    config: {
      activeSetId: null,
      activeTrackId: null,
      trackMappings: DEFAULT_GLOBAL_MAPPINGS.trackMappings,
      channelMappings: DEFAULT_GLOBAL_MAPPINGS.channelMappings,
      input: {
        type: "midi",
        deviceName: "IAC Driver Bus 1",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      },
      sequencerMode: true,
      sequencerBpm: 120,
    },
    sets: [],
    _isDefaultData: true,
  };

  const parsedData = await loadJsonFile(
    "userData.json",
    defaultData,
    "Could not load userData.json, initializing with empty data."
  );

  const migratedData = migrateToSets(parsedData) as unknown as UserDataWithFlags;

  if (!migratedData.config) {
    migratedData.config = {} as any;
  }
  if (!Array.isArray(migratedData.sets)) {
    migratedData.sets = [];
  }

  if (!migratedData.config.trackMappings) {
    migratedData.config.trackMappings = DEFAULT_GLOBAL_MAPPINGS.trackMappings;
  }
  if (!migratedData.config.channelMappings) {
    migratedData.config.channelMappings =
      DEFAULT_GLOBAL_MAPPINGS.channelMappings;
  }

  migratedData._loadedSuccessfully = !Boolean(migratedData._isDefaultData);
  return migratedData;
};

/**
 * Saves user data to JSON file asynchronously
 */
export const saveUserData = async (data: UserDataWithFlags): Promise<void> => {
  if (data?._isDefaultData) {
    console.warn(
      "Skipping save: data is default empty data returned from loadUserData error. Not overwriting file."
    );
    return;
  }
  if (Array.isArray(data?.sets) && data.sets.length === 0) {
    console.warn(
      "Skipping save: data has empty sets array. Not overwriting file with empty data."
    );
    return;
  }
  try {
    const dataToSave = { ...data };
    delete dataToSave._isDefaultData;
    delete dataToSave._loadedSuccessfully;
    await saveJsonFile("userData.json", dataToSave);
  } catch (error) {
    console.error("Error writing userData to JSON file:", error);
  }
};

/**
 * Saves user data to JSON file synchronously
 */
export const saveUserDataSync = (data: UserDataWithFlags): void => {
  if (data?._isDefaultData) {
    console.warn(
      "Skipping save (sync): data is default empty data returned from loadUserData error. Not overwriting file."
    );
    return;
  }
  if (Array.isArray(data?.sets) && data.sets.length === 0) {
    console.warn(
      "Skipping save (sync): data has empty sets array. Not overwriting file with empty data."
    );
    return;
  }
  try {
    const dataToSave = { ...data };
    delete dataToSave._isDefaultData;
    delete dataToSave._loadedSuccessfully;
    saveJsonFileSync("userData.json", dataToSave);
  } catch (error) {
    console.error("Error writing userData to JSON file (sync):", error);
  }
};

/**
 * Generates an array of track notes for MIDI mapping
 */
export const generateTrackNotes = (): string[] => {
  const channelNotes = [
    "G8",
    "F#8",
    "F8",
    "E8",
    "D#8",
    "D8",
    "C#8",
    "C8",
    "B7",
    "A#7",
    "A7",
    "G#7",
    "G7",
    "F#7",
    "F7",
    "E7",
  ];

  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const octaves = [-1, 0, 1, 2];
  const standardNotes: string[] = [];
  octaves.forEach((oct) => {
    noteNames.forEach((n) => standardNotes.push(`${n}${oct}`));
  });

  return [...channelNotes, ...standardNotes];
};

/**
 * Updates the active set within user data
 */
export const updateActiveSet = (
  setUserData: (updater: (prev: UserDataWithFlags) => UserDataWithFlags) => void,
  activeSetId: SetId | null,
  updater: (activeSet: NwSet, draft: UserDataWithFlags) => void
): void => {
  updateUserData(setUserData, (draft) => {
    const activeSet = getActiveSet(draft, activeSetId);
    if (!activeSet) return;
    updater(activeSet, draft);
  });
};
