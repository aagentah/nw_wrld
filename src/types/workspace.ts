import type { ModuleMetadata } from "./moduleMetadata";

export interface WorkspaceModuleSummary {
  file: string;
  id: string;
  name: ModuleMetadata["name"];
  category: ModuleMetadata["category"];
  hasMetadata: boolean;
}

export interface WorkspaceModuleUrl {
  url: string;
  mtimeMs: number;
}

export interface WorkspaceModuleTextWithMeta {
  text: string;
  mtimeMs: number;
}

export interface ListAssetsResult {
  ok: boolean;
  files: string[];
  dirs: string[];
}
