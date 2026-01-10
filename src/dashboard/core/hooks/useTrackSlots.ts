import { useMemo, useCallback } from "react";
import type { Track, InputType, GlobalMappings } from "../../../types";

export interface ConfigWithTrackMappings {
  trackMappings?: GlobalMappings;
}

export interface UseTrackSlotsReturn {
  usedSlots: Set<number>;
  availableSlots: number[];
  getTrigger: (slot: number) => string;
  isSlotAvailable: (slot: number) => boolean;
}

export const useTrackSlots = (
  tracks: Track[],
  globalMappings: ConfigWithTrackMappings | undefined,
  inputType: InputType,
  excludeTrackId: Track["id"] | null = null
): UseTrackSlotsReturn => {
  const usedSlots = useMemo(() => {
    return new Set(
      tracks
        .filter((t) => !excludeTrackId || t.id !== excludeTrackId)
        .map((t) => t.trackSlot)
        .filter((slot): slot is number => slot !== undefined)
    );
  }, [tracks, excludeTrackId]);

  const availableSlots = useMemo(() => {
    const slots: number[] = [];
    for (let i = 1; i <= 10; i++) {
      if (!usedSlots.has(i)) {
        slots.push(i);
      }
    }
    return slots;
  }, [usedSlots]);

  const getTrigger = useCallback(
    (slot: number): string => {
      return globalMappings?.trackMappings?.[inputType]?.[slot] || "";
    },
    [globalMappings, inputType]
  );

  const isSlotAvailable = useCallback(
    (slot: number): boolean => {
      return availableSlots.includes(slot);
    },
    [availableSlots]
  );

  return {
    usedSlots,
    availableSlots,
    getTrigger,
    isSlotAvailable,
  };
};
