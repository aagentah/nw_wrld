import { loadJsonFile, saveJsonFile, saveJsonFileSync } from "./jsonFileBase";

export const loadRecordingData = async () => {
  const data = (await loadJsonFile(
    "recordingData.json",
    { recordings: {} },
    "Could not load recordingData.json, initializing with empty data."
  )) as { recordings?: unknown };
  const recordings = (data as { recordings?: unknown }).recordings;
  if (!recordings || typeof recordings !== "object") return {};
  return recordings as Record<string, unknown>;
};

export const saveRecordingData = (recordings: unknown) =>
  saveJsonFile("recordingData.json", { recordings });

export const saveRecordingDataSync = (recordings: unknown) =>
  saveJsonFileSync("recordingData.json", { recordings });

export const getRecordingForTrack = (
  recordings: Record<string, unknown>,
  trackId: string
) => {
  return (recordings as Record<string, unknown>)[trackId] || { channels: [] };
};

export const setRecordingForTrack = (
  recordings: Record<string, unknown>,
  trackId: string,
  recording: unknown
) => {
  return {
    ...recordings,
    [trackId]: recording,
  };
};

export const getSequencerForTrack = (
  recordings: Record<string, unknown>,
  trackId: string
) => {
  const rec = recordings[trackId] as { sequencer?: unknown } | undefined;
  const seq = rec?.sequencer as { bpm?: unknown; pattern?: unknown } | undefined;
  return seq || { bpm: 120, pattern: {} };
};

export const setSequencerForTrack = (
  recordings: Record<string, unknown>,
  trackId: string,
  sequencer: unknown
) => {
  const current = recordings[trackId] as Record<string, unknown> | undefined;
  return {
    ...recordings,
    [trackId]: {
      ...(current || {}),
      sequencer,
    },
  };
};

export const deleteRecordingsForTracks = (
  recordings: Record<string, unknown>,
  trackIds: string[]
) => {
  const updated: Record<string, unknown> = { ...recordings };
  trackIds.forEach((trackId) => {
    delete updated[trackId];
  });
  return updated;
};

