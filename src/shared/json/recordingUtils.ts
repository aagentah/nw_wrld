import {
  loadJsonFile,
  saveJsonFile,
  saveJsonFileSync,
} from './jsonFileBase';

export interface SequencerPattern {
  [key: number]: number;
}

export interface TrackSequencer {
  bpm: number;
  pattern: SequencerPattern;
}

export interface TrackRecording {
  channels: unknown[];
  sequencer?: TrackSequencer;
}

export interface Recordings {
  [trackId: string]: TrackRecording;
}

export interface RecordingData {
  recordings: Recordings;
}

/**
 * Loads recording data from recordingData.json.
 *
 * @returns Promise resolving to the recordings object
 */
export const loadRecordingData = async (): Promise<Recordings> => {
  const data = await loadJsonFile<RecordingData>(
    'recordingData.json',
    { recordings: {} },
    'Could not load recordingData.json, initializing with empty data.'
  );
  return data.recordings || {};
};

/**
 * Saves recording data to recordingData.json.
 *
 * @param recordings - The recordings object to save
 * @returns Promise that resolves when save is complete
 */
export const saveRecordingData = (recordings: Recordings): Promise<void> =>
  saveJsonFile('recordingData.json', { recordings });

/**
 * Saves recording data synchronously.
 *
 * @param recordings - The recordings object to save
 */
export const saveRecordingDataSync = (recordings: Recordings): void =>
  saveJsonFileSync('recordingData.json', { recordings });

/**
 * Gets the recording for a specific track.
 *
 * @param recordings - The recordings object
 * @param trackId - The track ID to get recording for
 * @returns The track recording or empty recording
 */
export const getRecordingForTrack = (
  recordings: Recordings,
  trackId: string
): TrackRecording => {
  return recordings[trackId] || { channels: [] };
};

/**
 * Sets the recording for a specific track.
 *
 * @param recordings - The recordings object
 * @param trackId - The track ID to set recording for
 * @param recording - The recording data
 * @returns Updated recordings object
 */
export const setRecordingForTrack = (
  recordings: Recordings,
  trackId: string,
  recording: TrackRecording
): Recordings => {
  return {
    ...recordings,
    [trackId]: recording,
  };
};

/**
 * Gets the sequencer for a specific track.
 *
 * @param recordings - The recordings object
 * @param trackId - The track ID to get sequencer for
 * @returns The track sequencer or default sequencer
 */
export const getSequencerForTrack = (
  recordings: Recordings,
  trackId: string
): TrackSequencer => {
  return recordings[trackId]?.sequencer || { bpm: 120, pattern: {} };
};

/**
 * Sets the sequencer for a specific track.
 *
 * @param recordings - The recordings object
 * @param trackId - The track ID to set sequencer for
 * @param sequencer - The sequencer data
 * @returns Updated recordings object
 */
export const setSequencerForTrack = (
  recordings: Recordings,
  trackId: string,
  sequencer: TrackSequencer
): Recordings => {
  return {
    ...recordings,
    [trackId]: {
      ...recordings[trackId],
      sequencer,
    },
  };
};

/**
 * Deletes recordings for multiple tracks.
 *
 * @param recordings - The recordings object
 * @param trackIds - Array of track IDs to delete recordings for
 * @returns Updated recordings object
 */
export const deleteRecordingsForTracks = (
  recordings: Recordings,
  trackIds: string[]
): Recordings => {
  const updated = { ...recordings };
  trackIds.forEach((trackId) => {
    delete updated[trackId];
  });
  return updated;
};
