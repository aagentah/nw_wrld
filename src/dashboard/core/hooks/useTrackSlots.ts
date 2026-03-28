import { useMemo, useCallback } from "react";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type InputType = string;

type TrackLike = {
  id?: string | number | null;
  trackSlot?: number | null;
};

type GlobalMappingsLike = {
  input?: {
    noteMatchMode?: unknown;
  } | null;
  trackMappings?: unknown;
} | null;

export const useTrackSlots = (
  tracks: TrackLike[],
  globalMappings: GlobalMappingsLike,
  inputType: InputType,
  excludeTrackId: string | number | null = null
) => {
  const usedSlots = useMemo(() => {
    const excludeId = excludeTrackId == null ? null : String(excludeTrackId);
    return new Set(
      tracks
        .filter((t) => {
          if (!excludeId) return true;
          const id = t?.id == null ? null : String(t.id);
          return id !== excludeId;
        })
        .map((t) => t.trackSlot)
        .filter(Boolean) as number[]
    );
  }, [tracks, excludeTrackId]);

  const availableSlots = useMemo(() => {
    const maxSlots = inputType === "midi" ? 12 : 10;
    const slots: number[] = [];
    for (let i = 1; i <= maxSlots; i++) {
      if (!usedSlots.has(i)) {
        slots.push(i);
      }
    }
    return slots;
  }, [usedSlots, inputType]);

  const getTrigger = useCallback(
    (slot: number | null | undefined) => {
      if (!slot) return "";
      const mappingsUnknown = globalMappings?.trackMappings;

      if (inputType === "midi") {
        const mode =
          globalMappings?.input?.noteMatchMode === "exactNote" ? "exactNote" : "pitchClass";

        const mappings = isRecord(mappingsUnknown) ? mappingsUnknown : null;
        const midiMappingsUnknown = mappings ? mappings["midi"] : null;
        const midiMappings = isRecord(midiMappingsUnknown)
          ? (midiMappingsUnknown as JsonRecord)
          : null;

        const byModeUnknown = midiMappings ? midiMappings[mode] : null;
        const byMode = isRecord(byModeUnknown) ? (byModeUnknown as JsonRecord) : null;
        if (byMode) {
          return (byMode[slot] ?? "") as string;
        }
        if (midiMappings) {
          return (midiMappings[slot] ?? "") as string;
        }
        return "";
      }

      const mappings = isRecord(mappingsUnknown) ? mappingsUnknown : null;
      const byTypeUnknown = mappings ? mappings[inputType] : null;
      const byType = isRecord(byTypeUnknown) ? (byTypeUnknown as JsonRecord) : null;
      return (byType?.[slot] ?? "") as string;
    },
    [globalMappings, inputType]
  );

  const isSlotAvailable = useCallback(
    (slot: number) => {
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
