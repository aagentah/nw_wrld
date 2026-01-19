export const MIDI_INPUT_NAME = "IAC Driver Bus 1";

export const CHANNEL_NOTES: Record<string, string> = {
  G8: "ch1",
  "F#8": "ch2",
  F8: "ch3",
  E8: "ch4",
  "D#8": "ch5",
  D8: "ch6",
  "C#8": "ch7",
  C8: "ch8",
  B7: "ch9",
  "A#7": "ch10",
  A7: "ch11",
  "G#7": "ch12",
  G7: "ch13",
  "F#7": "ch14",
  F7: "ch15",
  E7: "ch16",
};

export const NOTE_TO_CHANNEL: Record<string, string> = Object.fromEntries(
  Object.entries(CHANNEL_NOTES).map(([note, channel]) => [channel, note])
);

export const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const PITCH_CLASS_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteNumberToPitchClass(noteNumber: unknown): number | null {
  if (typeof noteNumber !== "number" || Number.isNaN(noteNumber)) return null;
  const n = Math.trunc(noteNumber);
  if (n < 0 || n > 127) return null;
  return ((n % 12) + 12) % 12;
}

export function normalizeNoteMatchMode(noteMatchMode: unknown): "exactNote" | "pitchClass" {
  return noteMatchMode === "exactNote" ? "exactNote" : "pitchClass";
}

export function noteNumberToTriggerKey(noteNumber: unknown, noteMatchMode: unknown): number | null {
  if (typeof noteNumber !== "number" || Number.isNaN(noteNumber)) return null;
  const n = Math.trunc(noteNumber);
  if (n < 0 || n > 127) return null;
  const mode = normalizeNoteMatchMode(noteMatchMode);
  return mode === "exactNote" ? n : noteNumberToPitchClass(n);
}

export function pitchClassToName(pitchClass: unknown): string | null {
  if (typeof pitchClass !== "number" || Number.isNaN(pitchClass)) return null;
  const pc = Math.trunc(pitchClass);
  if (pc < 0 || pc > 11) return null;
  return PITCH_CLASS_NAMES_SHARP[pc] || null;
}

export function noteNameToPitchClass(noteName: unknown): number | null {
  if (typeof noteName !== "string") return null;
  const trimmed = noteName.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([A-G](?:#|b)?)(?:-?\d+)?$/);
  if (!match) return null;
  const note = match[1];
  const semitone = NOTE_OFFSETS[note];
  if (semitone === undefined) return null;
  return semitone;
}

export function parsePitchClass(input: unknown): number | null {
  if (typeof input === "number") {
    const pc = Math.trunc(input);
    return pc >= 0 && pc <= 11 ? pc : null;
  }
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) && n >= 0 && n <= 11 ? n : null;
  }
  return noteNameToPitchClass(trimmed);
}

export function parseMidiTriggerValue(input: unknown, noteMatchMode: unknown): number | null {
  const mode = normalizeNoteMatchMode(noteMatchMode);
  if (mode === "exactNote") {
    if (typeof input === "number") {
      const n = Math.trunc(input);
      return n >= 0 && n <= 127 ? n : null;
    }
    if (typeof input !== "string") return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (!/^\d+$/.test(trimmed)) return null;
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) && n >= 0 && n <= 127 ? n : null;
  }

  if (typeof input === "number") {
    const n = Math.trunc(input);
    if (n >= 0 && n <= 11) return n;
    if (n >= 0 && n <= 127) return noteNumberToPitchClass(n);
    return null;
  }
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n)) return null;
    if (n >= 0 && n <= 11) return n;
    if (n >= 0 && n <= 127) return noteNumberToPitchClass(n);
    return null;
  }
  return noteNameToPitchClass(trimmed);
}

export function noteNameToNumber(noteName: unknown): number | null {
  if (typeof noteName !== "string") return null;
  const match = noteName.trim().match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!match) return null;
  const note = match[1];
  const octave = parseInt(match[2], 10);
  const semitone = NOTE_OFFSETS[note];
  if (semitone === undefined || Number.isNaN(octave)) return null;
  return (octave + 2) * 12 + semitone;
}

export function buildChannelNotesMap(): Record<number, string> {
  const map: Record<number, string> = {};
  Object.entries(CHANNEL_NOTES).forEach(([noteName, channelName]) => {
    const num = noteNameToNumber(noteName);
    if (num !== null) map[num] = channelName;
  });
  return map;
}

export function resolveTrackTrigger(
  track: unknown,
  inputType: unknown,
  globalMappings: unknown
): unknown {
  const t = track && typeof track === "object" ? (track as Record<string, unknown>) : null;
  const trackSlot = t?.trackSlot;
  const inputTypeKey = typeof inputType === "string" ? inputType : String(inputType);

  const gm =
    globalMappings && typeof globalMappings === "object"
      ? (globalMappings as Record<string, unknown>)
      : null;
  const trackMappingsRaw = gm?.trackMappings;
  const trackMappings =
    trackMappingsRaw && typeof trackMappingsRaw === "object"
      ? (trackMappingsRaw as Record<string, unknown>)
      : null;
  const byInput = trackMappings ? trackMappings[inputTypeKey] : undefined;

  if (trackSlot && byInput) {
    if (inputTypeKey === "midi") {
      const inputRaw = gm?.input;
      const inputObj =
        inputRaw && typeof inputRaw === "object" ? (inputRaw as Record<string, unknown>) : null;
      const mode = normalizeNoteMatchMode(inputObj?.noteMatchMode);

      const midiMappingsRaw = trackMappings ? trackMappings.midi : undefined;
      const midiMappings =
        midiMappingsRaw && typeof midiMappingsRaw === "object"
          ? (midiMappingsRaw as Record<string, unknown>)
          : null;
      const byModeRaw = midiMappings ? midiMappings[mode] : undefined;
      const byMode =
        byModeRaw && typeof byModeRaw === "object" ? (byModeRaw as Record<string, unknown>) : null;
      if (byMode) {
        return byMode[String(trackSlot)];
      }
    }

    if (byInput && typeof byInput === "object") {
      return (byInput as Record<string, unknown>)[String(trackSlot)];
    }
  }

  return (t?.trackTrigger as unknown) || (t?.trackNote as unknown) || "";
}

export function resolveChannelTrigger(
  channelSlot: unknown,
  inputType: unknown,
  globalMappings: unknown
): unknown {
  const inputTypeKey = typeof inputType === "string" ? inputType : String(inputType);

  const gm =
    globalMappings && typeof globalMappings === "object"
      ? (globalMappings as Record<string, unknown>)
      : null;
  const channelMappingsRaw = gm?.channelMappings;
  const channelMappings =
    channelMappingsRaw && typeof channelMappingsRaw === "object"
      ? (channelMappingsRaw as Record<string, unknown>)
      : null;
  const byInput = channelMappings ? channelMappings[inputTypeKey] : undefined;

  if (channelSlot && byInput && typeof byInput === "object") {
    if (inputTypeKey === "midi") {
      const inputRaw = gm?.input;
      const inputObj =
        inputRaw && typeof inputRaw === "object" ? (inputRaw as Record<string, unknown>) : null;
      const mode = normalizeNoteMatchMode(inputObj?.noteMatchMode);

      const midiMappingsRaw = channelMappings ? channelMappings.midi : undefined;
      const midiMappings =
        midiMappingsRaw && typeof midiMappingsRaw === "object"
          ? (midiMappingsRaw as Record<string, unknown>)
          : null;
      const byModeRaw = midiMappings ? midiMappings[mode] : undefined;
      const byMode =
        byModeRaw && typeof byModeRaw === "object" ? (byModeRaw as Record<string, unknown>) : null;
      if (byMode) {
        return byMode[String(channelSlot)];
      }
    }

    return (byInput as Record<string, unknown>)[String(channelSlot)];
  }

  return "";
}

export function buildTrackNotesMapFromTracks(
  tracks: unknown,
  globalMappings: unknown,
  currentInputType: unknown = "midi"
): Record<number, unknown> {
  const map: Record<number, unknown> = {};
  if (!Array.isArray(tracks)) {
    return map;
  }

  tracks.forEach((track) => {
    const t = track && typeof track === "object" ? (track as Record<string, unknown>) : null;
    const trackTrigger = resolveTrackTrigger(track, currentInputType, globalMappings);

    if (
      t &&
      trackTrigger !== "" &&
      trackTrigger !== null &&
      trackTrigger !== undefined &&
      t.id &&
      currentInputType === "midi"
    ) {
      const pc = parsePitchClass(trackTrigger);
      if (pc !== null) map[pc] = t.id;
    }
  });

  return map;
}

export function buildMidiConfig(
  userData: unknown,
  globalMappings: unknown,
  currentInputType: unknown = "midi"
): { trackTriggersMap: Record<string, unknown>; channelMappings: Record<string, unknown> } {
  const config: {
    trackTriggersMap: Record<string, unknown>;
    channelMappings: Record<string, unknown>;
  } = {
    trackTriggersMap: {},
    channelMappings: {},
  };

  if (!userData || !Array.isArray(userData)) {
    return config;
  }

  const gm =
    globalMappings && typeof globalMappings === "object"
      ? (globalMappings as Record<string, unknown>)
      : null;
  const inputRaw = gm?.input;
  const inputObj =
    inputRaw && typeof inputRaw === "object" ? (inputRaw as Record<string, unknown>) : null;
  const noteMatchMode = normalizeNoteMatchMode(inputObj?.noteMatchMode);

  userData.forEach((track) => {
    const t = track && typeof track === "object" ? (track as Record<string, unknown>) : null;
    const trackTrigger = resolveTrackTrigger(track, currentInputType, globalMappings);
    const trackName = t?.name;

    if (trackName && trackTrigger !== "" && trackTrigger !== null && trackTrigger !== undefined) {
      const trackNameKey = String(trackName);
      if (currentInputType === "midi") {
        const key = parseMidiTriggerValue(trackTrigger, noteMatchMode);
        if (key !== null) config.trackTriggersMap[String(key)] = trackNameKey;
      } else {
        config.trackTriggersMap[String(trackTrigger)] = trackNameKey;
      }
    }

    const channelMappings = t?.channelMappings;
    if (trackName && channelMappings && typeof channelMappings === "object") {
      const trackNameKey = String(trackName);
      config.channelMappings[trackNameKey] = {};

      Object.entries(channelMappings as Record<string, unknown>).forEach(
        ([channelNumber, slotOrTrigger]) => {
          const channelTrigger =
            typeof slotOrTrigger === "number"
              ? resolveChannelTrigger(slotOrTrigger, currentInputType, globalMappings)
              : slotOrTrigger;

          if (channelTrigger !== "" && channelTrigger !== null && channelTrigger !== undefined) {
            let key: unknown = channelTrigger;
            if (currentInputType === "midi") {
              const nextKey = parseMidiTriggerValue(channelTrigger, noteMatchMode);
              if (nextKey !== null) key = nextKey;
              else return;
            }

            const perTrack = config.channelMappings[trackNameKey] as Record<string, unknown>;
            const k = String(key);
            if (!perTrack[k]) {
              perTrack[k] = [];
            }
            (perTrack[k] as unknown[]).push(channelNumber);
          }
        }
      );
    }
  });

  return config;
}
