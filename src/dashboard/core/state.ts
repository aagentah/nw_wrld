import { atom, useAtom } from "jotai";
import { useRef, useCallback, useEffect } from "react";

export const userDataAtom = atom<{ config: Record<string, unknown>; sets: unknown[] }>({
  config: {},
  sets: [],
});
export const recordingDataAtom = atom<Record<string, unknown>>({});
export const activeTrackIdAtom = atom<string | number | null>(null);
export const activeSetIdAtom = atom<string | null>(null);
export const selectedChannelAtom = atom<unknown>(null);
export const flashingChannelsAtom = atom<Set<string>>(new Set<string>());
export const flashingConstructorsAtom = atom<Set<string>>(new Set<string>());
export const recordingStateAtom = atom<Record<string, { startTime: number; isRecording: boolean }>>(
  {}
);
export const helpTextAtom = atom<string>("");

export const useFlashingChannels = (): [
  Set<string>,
  (channelName: string, duration?: number) => void,
] => {
  const [flashingChannels, setFlashingChannels] = useAtom(flashingChannelsAtom);
  const activeFlashesRef = useRef<Set<string>>(new Set());
  const pendingUpdatesRef = useRef<Set<string>>(new Set());
  const rafIdRef = useRef<number | null>(null);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
    (channelName: string, duration = 100) => {
      const isAlreadyFlashing = activeFlashesRef.current.has(channelName);

      const existingTimeout = timeoutsRef.current.get(channelName);
      if (existingTimeout) {
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
      }, duration);

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
