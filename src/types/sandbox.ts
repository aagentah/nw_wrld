export type SandboxRequestType =
  | "initTrack"
  | "invokeOnInstance"
  | "introspectModule"
  | "destroyTrack"
  | "setMatrixForInstance";

export interface SandboxEnsureOk {
  ok: true;
  token: string;
}

export interface SandboxEnsureErr {
  ok: false;
  reason: string;
}

export type SandboxEnsureResult = SandboxEnsureOk | SandboxEnsureErr;

export interface SandboxRequestErr {
  ok: false;
  error: string;
}

export type SandboxRequestResult =
  | { ok: true }
  | SandboxRequestErr
  | Record<string, unknown>;
