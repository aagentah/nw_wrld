import type { InputConfig } from "./userData";

export interface LabeledOption {
  id: string;
  label: string;
}

export interface AspectRatioOption extends LabeledOption {
  width: string;
  height: string;
}

export interface BackgroundColorOption extends LabeledOption {
  value: string;
}

export interface AppConfig {
  input: InputConfig;
  aspectRatios: AspectRatioOption[];
  backgroundColors: BackgroundColorOption[];
  autoRefresh: boolean;
}
