// state.ts - Jotai atoms and custom hooks for state management

import { atom, useAtom } from "jotai";
import { useRef, useCallback, useEffect } from "react";
import type {
  UserData,
} from "../../types";

// Re-export UserData for convenience
export type { UserData };
import type { Recordings } from "../../shared/json/recordingUtils";

// =========================
// Recording State Types (from input.ts)
// =========================

export interface RecordingState {
  [channelName: string]: {
    isRecording: boolean;
    startTime: number;
  };
}

// =========================
// Jotai Atoms
// =========================

export const userDataAtom = atom<UserData>({ config: {
  input: {
    type: "midi",
    deviceName: "",
    trackSelectionChannel: 1,
    methodTriggerChannel: 2,
    velocitySensitive: false,
    port: 8000,
  },
  trackMappings: { midi: {}, osc: {} },
  channelMappings: { midi: {}, osc: {} },
  activeSetId: null,
  activeTrackId: null,
  sequencerMode: false,
  sequencerBpm: 120,
}, sets: [] });
export const recordingDataAtom = atom<Recordings>({});
export const activeTrackIdAtom = atom<number | null>(null);
export const activeSetIdAtom = atom<string | null>(null);
export const selectedChannelAtom = atom<{
  trackIndex: number;
  channelNumber: string;
  instanceId?: string;
  moduleType?: string;
  isConstructor?: boolean;
} | null>(null);
export const flashingChannelsAtom = atom<Set<string>>(new Set<string>());
export const flashingConstructorsAtom = atom<Set<string>>(new Set<string>());
export const recordingStateAtom = atom<RecordingState>({});
export const helpTextAtom = atom<string>("");

// =========================
// Custom Hooks
// =========================

export const useFlashingChannels = (): [
  Set<string>,
  (channelName: string, duration?: number) => void
] => {
  const [flashingChannels, setFlashingChannels] = useAtom(flashingChannelsAtom);
  const activeFlashesRef = useRef<Set<string>>(new Set());
  const pendingUpdatesRef = useRef<Set<string>>(new Set());
  const rafIdRef = useRef<number | null>(null);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return;

    rafIdRef.current = requestAnimationFrame(() => {
      const hasChanges = pendingUpdatesRef.current.size > 0;
      pendingUpdatesRef.current.clear();
      rafIdRef.current = null;

      if (hasChanges) {
        setFlashingChannels(new Set(activeFlashesRef.current));
      }
    });
  }, [setFlashingChannels]);

  const flashChannel = useCallback(
    (channelName: string, duration: number = 100) => {
      const isAlreadyFlashing = activeFlashesRef.current.has(channelName);

      const existingTimeout = timeoutsRef.current.get(channelName);
      if (existingTimeout !== undefined) {
        clearTimeout(existingTimeout);
      }

      if (!isAlreadyFlashing) {
        activeFlashesRef.current.add(channelName);
        pendingUpdatesRef.current.add(channelName);
        scheduleUpdate();
      }

      const timeoutId = setTimeout(() => {
        activeFlashesRef.current.delete(channelName);
        pendingUpdatesRef.current.add(channelName);
        timeoutsRef.current.delete(channelName);
        scheduleUpdate();
      }, duration) as unknown as number;

      timeoutsRef.current.set(channelName, timeoutId);
    },
    [scheduleUpdate]
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutsRef.current.clear();
    };
  }, []);

  return [flashingChannels, flashChannel];
};
