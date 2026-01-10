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

// Use centralized types - but for compatibility with buildMidiConfig,
// use UserConfig as GlobalMappings
export type GlobalMappings = UserConfig;

export interface MidiConfig {
  trackTriggersMap: Record<number | string, string>;
  channelTriggersMap: Record<string, unknown>;
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
 * Note: This is a compatibility function that returns the track name.
 *
 * @param track - The track object
 * @param inputType - The input type (e.g., "midi", "osc")
 * @param globalMappings - Global mappings configuration
 * @returns The resolved trigger string (track name)
 */
export function resolveTrackTrigger(
  track: Track | undefined,
  inputType: string,
  globalMappings?: GlobalMappings
): string {
  // For now, just return the track name
  return track?.name || '';
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
  channelSlot: number,
  inputType: string,
  globalMappings?: GlobalMappings
): string {
  if (channelSlot && globalMappings?.channelMappings?.[inputType]) {
    const channelMap = globalMappings.channelMappings[inputType];
    // channelMappings is a MappingTable (Record<string, string>)
    const trigger = (channelMap as Record<string, string>)[String(channelSlot)];
    return trigger || '';
  }
  return '';
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
    channelTriggersMap: {},
  };

  if (!userData || !Array.isArray(userData)) {
    return config;
  }

  userData.forEach((track) => {
    // Use track.name as the key for triggers
    if (!track.name) return;

    // Build track triggers map - for now use track name as placeholder
    // The actual mapping would be done by the globalMappings
    config.trackTriggersMap[track.name] = track.name;

    // Build channel mappings for this track
    // Note: centralized Track has channelMappings?: Record<string, number>
    if (track.channelMappings) {
      config.channelTriggersMap[track.name] = track.channelMappings;
    }
  });

  return config;
}
