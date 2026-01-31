type InputType = "midi" | "osc" | "audio" | "file";

export type NoteMatchMode = "pitchClass" | "exactNote";

type AudioBand = "low" | "medium" | "high";

export interface InputConfig {
  type: InputType;
  deviceId?: string;
  deviceName?: string;
  trackSelectionChannel: number;
  methodTriggerChannel: number;
  velocitySensitive: boolean;
  noteMatchMode?: NoteMatchMode | string;
  port: number;
  audioThresholds?: Partial<Record<AudioBand, number>>;
  audioMinIntervalMs?: number;
  fileThresholds?: Partial<Record<AudioBand, number>>;
  fileMinIntervalMs?: number;
  fileAssetRelPath?: string;
  fileAssetName?: string;
}
