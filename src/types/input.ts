import type { InputConfig } from "./userData";

export type InputStatus = "disconnected" | "connecting" | "connected" | "error";

export interface InputStatusData {
  status: InputStatus;
  message: string;
  config: InputConfig | null;
}

export interface InputStatusPayload {
  type: "input-status";
  data: InputStatusData;
}

export type InputSource = "midi" | "osc" | "audio" | "file";

export interface InputEventBase {
  timestamp: number;
  source: InputSource;
}

export interface MidiTrackSelectionEvent extends InputEventBase {
  source: "midi";
  note: number;
  channel: number;
  velocity: number;
}

export interface OscTrackSelectionEvent extends InputEventBase {
  source: "osc";
  identifier: string;
  address: string;
}

export interface MidiMethodTriggerEvent extends InputEventBase {
  source: "midi";
  note: number;
  channel: number;
  velocity: number;
}

export interface OscMethodTriggerEvent extends InputEventBase {
  source: "osc";
  channelName: string;
  velocity: number;
  address: string;
}

export interface AudioMethodTriggerEvent extends InputEventBase {
  source: "audio";
  channelName: string;
  velocity: number;
}

export interface FileMethodTriggerEvent extends InputEventBase {
  source: "file";
  channelName: string;
  velocity: number;
}

export type TrackSelectionEventData =
  | MidiTrackSelectionEvent
  | OscTrackSelectionEvent;
export type MethodTriggerEventData =
  | MidiMethodTriggerEvent
  | OscMethodTriggerEvent
  | AudioMethodTriggerEvent
  | FileMethodTriggerEvent;

export type InputEventPayload =
  | { type: "track-selection"; data: TrackSelectionEventData }
  | { type: "method-trigger"; data: MethodTriggerEventData };

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer?: string;
}
