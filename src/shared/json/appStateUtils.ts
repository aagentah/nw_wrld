import {
  loadJsonFile,
  loadJsonFileSync,
  saveJsonFile,
  saveJsonFileSync,
} from "./jsonFileBase";

const DEFAULT_APP_STATE = {
  activeTrackId: null,
  activeSetId: null,
  sequencerMuted: false,
  workspacePath: null,
};

export const loadAppState = () =>
  loadJsonFile(
    "appState.json",
    DEFAULT_APP_STATE,
    "Could not load appState.json, initializing with defaults."
  );

export const saveAppState = (state: unknown) => saveJsonFile("appState.json", state);

export const saveAppStateSync = (state: unknown) =>
  saveJsonFileSync("appState.json", state);

export const loadAppStateSync = () =>
  loadJsonFileSync(
    "appState.json",
    DEFAULT_APP_STATE,
    "Could not load appState.json, initializing with defaults."
  );

