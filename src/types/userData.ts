type InputType = "midi" | "osc" | "audio" | "file";

export type NoteMatchMode = "pitchClass" | "exactNote";

export type AudioBand = "low" | "medium" | "high";

export type AudioBandThresholds = Record<AudioBand, number>;

export type TrackSignalBandThresholds = {
  low: number;
  medium: number;
  high: number;
};

export type TrackAudioSignalSettings = {
  thresholds: TrackSignalBandThresholds;
  minIntervalMs: number;
};

export type TrackFileSignalSettings = {
  thresholds: TrackSignalBandThresholds;
  minIntervalMs: number;
  assetRelPath: string;
  assetName: string;
};

export type TrackSignalSettings = {
  audio: TrackAudioSignalSettings;
  file: TrackFileSignalSettings;
};

export interface InputConfig {
  type: InputType;
  deviceId?: string;
  deviceName?: string;
  trackSelectionChannel: number;
  methodTriggerChannel: number;
  velocitySensitive: boolean;
  noteMatchMode?: NoteMatchMode | string;
  port: number;
}
