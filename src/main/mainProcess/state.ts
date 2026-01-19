import type { FSWatcher } from "node:fs";
import * as path from "node:path";

type SandboxTokenEntry = {
  projectDir: string;
  ownerWebContentsId: number;
  createdAt: number;
};

type PendingSandboxRequestEntry = {
  resolve: (value: unknown) => void;
  timeout: NodeJS.Timeout;
  token: string;
};

export const srcDir = path.resolve(__dirname, "..", "..", "..", "..", "src");

export const state: {
  projector1Window: unknown | null;
  dashboardWindow: unknown | null;
  inputManager: unknown | null;
  workspaceWatcher: FSWatcher | null;
  workspaceWatcherDebounce: NodeJS.Timeout | null;
  currentWorkspacePath: string | null;
  currentProjectDir: string | null;
  didRegisterAppLifecycleHandlers: boolean;
  webContentsToProjectDir: Map<number, string | null>;
  sandboxTokenToProjectDir: Map<string, SandboxTokenEntry>;
  sandboxOwnerWebContentsIdToTokens: Map<number, Set<string>>;
  sandboxOwnerCleanupHooked: Set<number>;
  sandboxView: unknown | null;
  sandboxViewWebContentsId: number | null;
  activeSandboxToken: string | null;
  sandboxEnsureInFlight: Promise<unknown> | null;
  projectorDefaultBounds: unknown | null;
  pendingSandboxRequests: Map<string, PendingSandboxRequestEntry>;
  didRunShutdownCleanup: boolean;
} = {
  projector1Window: null,
  dashboardWindow: null,
  inputManager: null,
  workspaceWatcher: null,
  workspaceWatcherDebounce: null,
  currentWorkspacePath: null,
  currentProjectDir: null,
  didRegisterAppLifecycleHandlers: false,
  webContentsToProjectDir: new Map(),
  sandboxTokenToProjectDir: new Map(),
  sandboxOwnerWebContentsIdToTokens: new Map(),
  sandboxOwnerCleanupHooked: new Set(),
  sandboxView: null,
  sandboxViewWebContentsId: null,
  activeSandboxToken: null,
  sandboxEnsureInFlight: null,
  projectorDefaultBounds: null,
  pendingSandboxRequests: new Map(),
  didRunShutdownCleanup: false,
};
