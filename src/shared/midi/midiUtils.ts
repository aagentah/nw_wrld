// Shared MIDI utilities

import type {
  Track,
  UserConfig,
} from "../../types";

export const MIDI_INPUT_NAME = 'IAC Driver Bus 1';

// Legacy channel notes mapping for MIDI file parsing: E7 to G8 → ch1 to ch16
// Note: These ch1-ch16 values are only used when parsing MIDI files for visualization
export const CHANNEL_NOTES: Record<string, string> = {
  G8: 'ch1',
  'F#8': 'ch2',
  F8: 'ch3',
  E8: 'ch4',
  'D#8': 'ch5',
  D8: 'ch6',
  'C#8': 'ch7',
  C8: 'ch8',
  B7: 'ch9',
  'A#7': 'ch10',
  A7: 'ch11',
  'G#7': 'ch12',
  G7: 'ch13',
  'F#7': 'ch14',
  F7: 'ch15',
  E7: 'ch16',
};

// Reverse mapping: channel → note name
export const NOTE_TO_CHANNEL: Record<string, string> = Object.fromEntries(
  Object.entries(CHANNEL_NOTES).map(([note, channel]) => [channel, note])
);

// MIDI Utility Functions
export const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

const PITCH_CLASS_NAMES_SHARP = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

// Type definitions for note matching modes
export type NoteMatchMode = 'pitchClass' | 'exactNote';

// Use centralized types - but for compatibility with buildMidiConfig,
// use UserConfig as GlobalMappings
export type GlobalMappings = UserConfig;

export interface MidiConfig {
  trackTriggersMap: Record<number | string, string>;
  channelMappings: Record<string, Record<number | string, number[]>>;
}

/**
 * Converts a MIDI note number to a pitch class (0-11).
 *
 * @param noteNumber - The MIDI note number (0-127)
 * @returns The pitch class (0-11) or null if invalid
 */
export function noteNumberToPitchClass(noteNumber: unknown): number | null {
  if (typeof noteNumber !== 'number' || Number.isNaN(noteNumber)) return null;
  const n = Math.trunc(noteNumber);
  if (n < 0 || n > 127) return null;
  return ((n % 12) + 12) % 12;
}

/**
 * Normalizes note match mode to ensure valid value.
 *
 * @param noteMatchMode - The note match mode
 * @returns Normalized mode ('pitchClass' or 'exactNote')
 */
export function normalizeNoteMatchMode(noteMatchMode: unknown): NoteMatchMode {
  return noteMatchMode === 'exactNote' ? 'exactNote' : 'pitchClass';
}

/**
 * Converts a MIDI note number to a trigger key based on the matching mode.
 *
 * @param noteNumber - The MIDI note number (0-127)
 * @param noteMatchMode - The note matching mode
 * @returns The trigger key (pitch class 0-11 or exact note number) or null
 */
export function noteNumberToTriggerKey(
  noteNumber: unknown,
  noteMatchMode: unknown
): number | null {
  if (typeof noteNumber !== 'number' || Number.isNaN(noteNumber)) return null;
  const n = Math.trunc(noteNumber);
  if (n < 0 || n > 127) return null;
  const mode = normalizeNoteMatchMode(noteMatchMode);
  return mode === 'exactNote' ? n : noteNumberToPitchClass(n);
}

/**
 * Converts a pitch class (0-11) to its note name.
 *
 * @param pitchClass - The pitch class (0-11)
 * @returns The note name (e.g., 'C', 'F#') or null if invalid
 */
export function pitchClassToName(pitchClass: unknown): string | null {
  if (typeof pitchClass !== 'number' || Number.isNaN(pitchClass)) return null;
  const pc = Math.trunc(pitchClass);
  if (pc < 0 || pc > 11) return null;
  return PITCH_CLASS_NAMES_SHARP[pc] || null;
}

/**
 * Extracts pitch class from a note name (with or without octave).
 * Accepts "G", "G#", "Gb", "G7", "G#7", "Gb7" (octave ignored if present).
 *
 * @param noteName - The note name
 * @returns The pitch class (0-11) or null if invalid
 */
export function noteNameToPitchClass(noteName: unknown): number | null {
  if (typeof noteName !== 'string') return null;
  const trimmed = noteName.trim();
  if (!trimmed) return null;
  // Accept "G", "G#", "Gb", "G7", "G#7", "Gb7" (octave ignored if present)
  const match = trimmed.match(/^([A-G](?:#|b)?)(?:-?\d+)?$/);
  if (!match) return null;
  const note = match[1];
  const semitone = NOTE_OFFSETS[note];
  if (semitone === undefined) return null;
  return semitone;
}

/**
 * Parses input as a pitch class (0-11).
 * Accepts numbers 0-11 or note names (C, C#, D, etc.).
 *
 * @param input - The input to parse (number or string)
 * @returns The pitch class (0-11) or null if invalid
 */
export function parsePitchClass(input: unknown): number | null {
  if (typeof input === 'number') {
    const pc = Math.trunc(input);
    return pc >= 0 && pc <= 11 ? pc : null;
  }
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Numeric pitch class (0..11)
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) && n >= 0 && n <= 11 ? n : null;
  }
  return noteNameToPitchClass(trimmed);
}

/**
 * Parses input as a MIDI trigger value based on the note matching mode.
 *
 * @param input - The input to parse (number or string)
 * @param noteMatchMode - The note matching mode
 * @returns The trigger value or null if invalid
 */
export function parseMidiTriggerValue(
  input: unknown,
  noteMatchMode: unknown
): number | null {
  const mode = normalizeNoteMatchMode(noteMatchMode);
  if (mode === 'exactNote') {
    if (typeof input === 'number') {
      const n = Math.trunc(input);
      return n >= 0 && n <= 127 ? n : null;
    }
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (!/^\d+$/.test(trimmed)) return null;
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) && n >= 0 && n <= 127 ? n : null;
  }

  if (typeof input === 'number') {
    const n = Math.trunc(input);
    if (n >= 0 && n <= 11) return n;
    if (n >= 0 && n <= 127) return noteNumberToPitchClass(n);
    return null;
  }
  if (typeof input !== 'string') return null;
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

/**
 * Converts a note name (e.g., "C4", "F#5") to a MIDI note number.
 * Ableton uses C0 = MIDI 24 (not MIDI 12).
 *
 * @param noteName - The note name to convert
 * @returns The MIDI note number or null if invalid
 */
export function noteNameToNumber(noteName: unknown): number | null {
  if (typeof noteName !== 'string') return null;
  const match = noteName.trim().match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!match) return null;
  const note = match[1];
  const octave = parseInt(match[2], 10);
  const semitone = NOTE_OFFSETS[note];
  if (semitone === undefined || Number.isNaN(octave)) return null;
  // Ableton uses C0 = MIDI 24 (not MIDI 12)
  // So we need (octave + 2) * 12 to match Ableton's octave notation
  return (octave + 2) * 12 + semitone;
}

/**
 * Builds a map of MIDI note numbers to channel names.
 *
 * @returns Map of note numbers to channel names
 */
export function buildChannelNotesMap(): Record<number, string> {
  const map: Record<number, string> = {};
  Object.entries(CHANNEL_NOTES).forEach(([noteName, channelName]) => {
    const num = noteNameToNumber(noteName);
    if (num !== null) map[num] = channelName;
  });
  return map;
}

/**
 * Resolves the trigger for a track based on its slot and input type.
 *
 * @param track - The track object
 * @param inputType - The input type (e.g., "midi", "osc")
 * @param globalMappings - Global mappings configuration
 * @returns The resolved trigger string
 */
export function resolveTrackTrigger(
  track: Track | undefined,
  inputType: string,
  globalMappings?: GlobalMappings
): string {
  if (track?.trackSlot && globalMappings?.trackMappings?.[inputType]) {
    if (inputType === 'midi') {
      const mode = normalizeNoteMatchMode(globalMappings?.input?.noteMatchMode);
      const midiMappings = globalMappings.trackMappings.midi;
      if (midiMappings && typeof midiMappings === 'object') {
        const byMode = (midiMappings as Record<string, unknown>)?.[mode];
        if (byMode && typeof byMode === 'object') {
          return (byMode as Record<string, unknown>)[track.trackSlot] as string || '';
        }
      }
    }
    return (globalMappings.trackMappings[inputType] as Record<string, unknown>)[track.trackSlot] as string || '';
  }
  return track?.trackTrigger || track?.trackNote || '';
}

/**
 * Resolves the trigger for a channel based on its slot and input type.
 *
 * @param channelSlot - The channel slot number
 * @param inputType - The input type (e.g., "midi", "osc")
 * @param globalMappings - Global mappings configuration
 * @returns The resolved trigger string
 */
export function resolveChannelTrigger(
  channelSlot: number | string,
  inputType: string,
  globalMappings?: GlobalMappings
): string {
  if (channelSlot && globalMappings?.channelMappings?.[inputType]) {
    if (inputType === 'midi') {
      const mode = normalizeNoteMatchMode(globalMappings?.input?.noteMatchMode);
      const midiMappings = globalMappings.channelMappings.midi;
      if (midiMappings && typeof midiMappings === 'object') {
        const byMode = (midiMappings as Record<string, unknown>)?.[mode];
        if (byMode && typeof byMode === 'object') {
          return (byMode as Record<string, unknown>)[String(channelSlot)] as string || '';
        }
      }
    }
    return (globalMappings.channelMappings[inputType] as Record<string, unknown>)[String(channelSlot)] as string || '';
  }
  return '';
}

/**
 * Builds a map of pitch classes to track IDs from tracks array.
 *
 * @param tracks - Array of track objects
 * @param globalMappings - Global mappings configuration
 * @param currentInputType - The current input type (default: "midi")
 * @returns Map of pitch classes to track IDs
 */
export function buildTrackNotesMapFromTracks(
  tracks: Track[] | undefined,
  globalMappings?: GlobalMappings,
  currentInputType = 'midi'
): Record<number, string> {
  const map: Record<number, string> = {};
  if (!Array.isArray(tracks)) {
    return map;
  }

  tracks.forEach((track) => {
    const trackTrigger = resolveTrackTrigger(
      track,
      currentInputType,
      globalMappings
    );

    if (
      track &&
      trackTrigger !== '' &&
      trackTrigger !== null &&
      trackTrigger !== undefined &&
      track.id &&
      currentInputType === 'midi'
    ) {
      const pc = parsePitchClass(trackTrigger);
      if (pc !== null) map[pc] = track.id;
    }
  });

  return map;
}

/**
 * Builds MIDI configuration from user data and global mappings.
 *
 * @param userData - Array of track objects
 * @param globalMappings - Global mappings configuration (UserConfig)
 * @param currentInputType - The current input type (default: "midi")
 * @returns MIDI configuration with track triggers and channel mappings
 */
export function buildMidiConfig(
  userData: Track[] | undefined,
  globalMappings?: GlobalMappings,
  currentInputType = 'midi'
): MidiConfig {
  const config: MidiConfig = {
    trackTriggersMap: {},
    channelMappings: {},
  };

  if (!userData || !Array.isArray(userData)) {
    return config;
  }

  const noteMatchMode = normalizeNoteMatchMode(
    globalMappings?.input?.noteMatchMode
  );

  userData.forEach((track) => {
    const trackTrigger = resolveTrackTrigger(
      track,
      currentInputType,
      globalMappings
    );

    // Build track triggers map
    if (
      track.name &&
      trackTrigger !== '' &&
      trackTrigger !== null &&
      trackTrigger !== undefined
    ) {
      if (currentInputType === 'midi') {
        const key = parseMidiTriggerValue(trackTrigger, noteMatchMode);
        if (key !== null) config.trackTriggersMap[key] = track.name;
      } else {
        config.trackTriggersMap[trackTrigger] = track.name;
      }
    }

    // Build channel mappings for this track (trigger → array of channel numbers)
    if (track.channelMappings) {
      config.channelMappings[track.name] = {};

      Object.entries(track.channelMappings).forEach(
        ([channelNumber, slotOrTrigger]) => {
          const channelTrigger =
            typeof slotOrTrigger === 'number'
              ? resolveChannelTrigger(
                  slotOrTrigger,
                  currentInputType,
                  globalMappings
                )
              : slotOrTrigger;

          if (
            channelTrigger !== '' &&
            channelTrigger !== null &&
            channelTrigger !== undefined
          ) {
            let key = channelTrigger;
            if (currentInputType === 'midi') {
              const nextKey = parseMidiTriggerValue(
                channelTrigger,
                noteMatchMode
              );
              if (nextKey !== null) key = nextKey;
              else return;
            }

            if (!config.channelMappings[track.name][key]) {
              config.channelMappings[track.name][key] = [];
            }
            config.channelMappings[track.name][key].push(Number(channelNumber));
          }
        }
      );
    }
  });

  return config;
}
