/**
 * Set utilities for nw_wrld
 * Manages track sets and migration from old data format
 */

import type {
  UserData,
  Track,
  NwSet,
} from "../../types";

// Re-export for backward compatibility
export type { Track, NwSet as Set };

// Flexible UserData config for migration purposes
export interface UserDataConfig {
  activeSetId?: string | null;
  [key: string]: unknown;
}

// Flexible UserData for migration purposes
export interface FlexibleUserData {
  config: UserDataConfig;
  sets: NwSet[];
  tracks?: Track[]; // Deprecated, for migration
  [key: string]: unknown;
}

export const getActiveSet = (userData: UserData | FlexibleUserData | null, activeSetId?: string): NwSet | null => {
  if (
    !userData ||
    !Array.isArray(userData.sets) ||
    userData.sets.length === 0
  ) {
    return null;
  }

  if (activeSetId) {
    const activeSet = userData.sets.find((set) => set.id === activeSetId);
    if (activeSet) {
      return activeSet;
    }
  }

  return userData.sets[0];
};

export const getActiveSetTracks = (userData: UserData | FlexibleUserData | null, activeSetId?: string): Track[] => {
  const activeSet = getActiveSet(userData, activeSetId);
  if (!activeSet || !Array.isArray(activeSet.tracks)) {
    return [];
  }
  return activeSet.tracks;
};

/**
 * Migrates legacy userData format to the new sets-based format.
 *
 * @param userData - The user data to migrate
 * @returns Migrated user data with sets
 */
export const migrateToSets = (userData: FlexibleUserData | UserData | null): FlexibleUserData => {
  if (!userData) {
    return {
      config: { activeSetId: null },
      sets: [],
    };
  }

  if (Array.isArray(userData.sets)) {
    return userData as FlexibleUserData;
  }

  if (Array.isArray((userData as any).tracks)) {
    const migratedData: FlexibleUserData = {
      ...(userData as any),
      config: {
        ...(userData as any).config || {},
        activeSetId: "set_1",
      },
      sets: [
        {
          id: "set_1",
          name: "Set 1",
          tracks: (userData as any).tracks || [],
        },
      ],
    };
    delete (migratedData as any).tracks;
    return migratedData;
  }

  return {
    ...(userData as any),
    config: {
      ...(userData as any).config || {},
      activeSetId: null,
    },
    sets: [],
  } as FlexibleUserData;
};
