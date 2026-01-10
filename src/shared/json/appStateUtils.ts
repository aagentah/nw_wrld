import type { AppState } from '../../types';
import {
  loadJsonFile,
  loadJsonFileSync,
  saveJsonFile,
  saveJsonFileSync,
} from './jsonFileBase';

const DEFAULT_APP_STATE: AppState = {
  activeTrackId: null,
  activeSetId: null,
  sequencerMuted: false,
  workspacePath: null,
};

/**
 * Loads the application state from appState.json.
 *
 * @returns Promise resolving to the loaded app state or defaults
 */
export const loadAppState = (): Promise<AppState> =>
  loadJsonFile<AppState>(
    'appState.json',
    DEFAULT_APP_STATE,
    'Could not load appState.json, initializing with defaults.'
  );

/**
 * Saves the application state to appState.json.
 *
 * @param state - The app state to save
 * @returns Promise that resolves when save is complete
 */
export const saveAppState = (state: AppState): Promise<void> =>
  saveJsonFile('appState.json', state);

/**
 * Saves the application state synchronously.
 *
 * @param state - The app state to save
 */
export const saveAppStateSync = (state: AppState): void =>
  saveJsonFileSync('appState.json', state);

/**
 * Loads the application state synchronously.
 *
 * @returns The loaded app state or defaults
 */
export const loadAppStateSync = (): AppState =>
  loadJsonFileSync<AppState>(
    'appState.json',
    DEFAULT_APP_STATE,
    'Could not load appState.json, initializing with defaults.'
  );
