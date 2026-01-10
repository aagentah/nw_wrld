import type { JsonValue, MethodBlock } from "./userData";

export type MethodOptionType =
  | "number"
  | "text"
  | "color"
  | "boolean"
  | "select"
  | "matrix"
  | "assetFile"
  | "assetDir";

export interface MethodOptionDefinition {
  name: string;
  defaultVal: JsonValue;
  type: MethodOptionType | (string & {});
  min?: number;
  max?: number;
  values?: string[];
  allowRandomization?: boolean;
  assetBaseDir?: string;
  assetExtensions?: string[];
  allowCustom?: boolean;
}

export interface MethodDefinition {
  name: string;
  executeOnLoad: boolean;
  options: MethodOptionDefinition[];
}

export type ModuleIntrospectOk = {
  moduleId: string;
  ok: true;
  name: string;
  category: string;
  methods: MethodDefinition[];
  mtimeMs: number | null;
};

export type ModuleIntrospectErr = {
  moduleId: string;
  ok: false;
  error: string;
  mtimeMs: number | null;
};

export type ModuleIntrospectResult = ModuleIntrospectOk | ModuleIntrospectErr;

export interface PreviewModuleData {
  constructor: MethodBlock[];
  methods: Record<string, unknown>;
}

