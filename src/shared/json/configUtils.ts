import type { AppConfig } from '../../types';
import { loadJsonFile, loadJsonFileSync } from './jsonFileBase';
import type { InputConfig } from '../../types/userData';

// Define the minimal type needed for config operations
interface ConfigSettings {
  aspectRatios: Array<{
    id: string;
    label: string;
    width: string;
    height: string;
  }>;
  backgroundColors: Array<{
    id: string;
    label: string;
    value: string;
  }>;
  autoRefresh: boolean;
  input?: InputConfig;
}

const DEFAULT_SETTINGS: ConfigSettings = {
  aspectRatios: [
    {
      id: 'default',
      label: 'Default',
      width: '100vw',
      height: '100vh',
    },
    {
      id: '16-9',
      label: '16:9 (landscape)',
      width: '100vw',
      height: '100vh',
    },
    {
      id: '9-16',
      label: '9:16 (portrait)',
      width: '56.25vh',
      height: '100vh',
    },
    {
      id: '4-5',
      label: '4:5 (portrait)',
      width: '80vh',
      height: '100vh',
    },
  ],
  backgroundColors: [{ id: 'grey', label: 'Grey', value: '#151715' }],
  autoRefresh: false,
};

/**
 * Loads application settings from config.json.
 *
 * @returns Promise resolving to the loaded settings or defaults
 */
export const loadSettings = (): Promise<ConfigSettings> =>
  loadJsonFile<ConfigSettings>(
    'config.json',
    DEFAULT_SETTINGS,
    'Could not load config.json, using defaults.'
  );

/**
 * Loads application settings synchronously.
 *
 * @returns The loaded settings or defaults
 */
export const loadSettingsSync = (): ConfigSettings =>
  loadJsonFileSync<ConfigSettings>(
    'config.json',
    DEFAULT_SETTINGS,
    'Error loading config.json:'
  );
