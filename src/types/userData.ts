export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type InputType = "midi" | "osc";

export interface InputConfig {
  type: InputType;
  deviceName?: string;
  trackSelectionChannel: number;
  methodTriggerChannel: number;
  velocitySensitive: boolean;
  port: number;
}

export type MappingTable = Record<string, string>;

export interface GlobalMappings {
  midi: MappingTable;
  osc: MappingTable;
}

export type InstanceId = string;
export type ModuleType = string;
export type SetId = string;
export type TrackId = number;

export interface AspectRatioConfig {
  id: "default" | "landscape" | "16-9" | "9-16" | "4-5" | (string & {});
}

export interface UserConfig {
  input: InputConfig;
  trackMappings: GlobalMappings;
  channelMappings: GlobalMappings;
  autoRefresh?: boolean;
  activeSetId: SetId | null;
  activeTrackId: TrackId | null;
  sequencerMode: boolean;
  sequencerBpm: number;
  sequencerMuted?: boolean;
  aspectRatio?: AspectRatioConfig["id"];
  bgColor?: string;
}

export interface ModuleRef {
  id: InstanceId;
  type: ModuleType;
}

export interface MethodOption {
  name: string;
  value: JsonValue;
  randomValues?: JsonValue[];
  randomRange?:
    | [number, number]
    | [string, string]
    | [number | string, number | string];
  randomizeFromUserColors?: boolean;
}

export interface MethodBlock {
  name: string;
  options: MethodOption[];
}

export interface ModuleInstanceData {
  constructor: MethodBlock[];
  methods: Record<string, JsonValue[]>;
}

export interface Track {
  id: TrackId;
  name: string;
  trackSlot?: number;
  bpm?: number;
  channelMappings?: Record<string, number>;
  modules: ModuleRef[];
  modulesData: Record<InstanceId, ModuleInstanceData>;
}

export interface NwSet {
  id: SetId;
  name: string;
  tracks: Track[];
}

export interface UserData {
  config: UserConfig;
  sets: NwSet[];
}
