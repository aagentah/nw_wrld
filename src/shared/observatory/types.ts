// Observatory Common Exhibit Contract — shared type vocabulary.
//
// This file is the single seam shared by every surface (operator instrument
// renderer, main-process store, boundary validators, tests). It must stay
// free of Node/Electron imports so it can be consumed by both the webpack
// renderer bundle and the runtime TS lane.

export const OBSERVATORY_CONTRACT_VERSION = 1;

export type NeverPersistClass = "secret" | "token" | "credential" | "key";

/** Event kinds that can exist inside a private evidence graph. */
export type ObservatoryEventKind =
  | "run_start"
  | "run_end"
  | "move"
  | "tool_attempt"
  | "tool_observed"
  | "approval_request"
  | "approval_resolved"
  | "artifact"
  | "outcome"
  | "withheld_at_capture";

/**
 * Kinds an emitter may try to record that the contract refuses as evidence.
 * They never land in a graph.
 */
export type RefusedEventKind = "reasoning" | "thinking";

/** Union accepted at the capture boundary. */
export type IncomingEventKind = ObservatoryEventKind | RefusedEventKind;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type EnvironmentDeclarationInput = {
  repoIdentity: string;
  versions: Record<string, string>;
  capabilityScope: string;
};

export type DeclaredEnvironment = EnvironmentDeclarationInput & {
  startedAt: string | null;
  endedAt: string | null;
};

export type WithheldOccurrence = {
  class: NeverPersistClass;
  path: string;
};

/** What an emitter submits to the capture boundary. */
export type ObservatoryEventInput = {
  kind: IncomingEventKind;
  actor: string;
  summary: string;
  payload?: JsonValue;
  environment?: EnvironmentDeclarationInput;
  at: string;
};

/** What is actually inspectable evidence inside the graph. */
export type ObservatoryEvent = {
  nodeId: string;
  seq: number;
  kind: ObservatoryEventKind;
  actor: string;
  summary: string;
  at: string;
  payload?: JsonValue;
  withheld?: WithheldOccurrence[];
};

export type PrivateEvidenceGraph = {
  identity: {
    sourceRunId: string;
    exhibitId: string;
    contractVersion: number;
    consentState: "private";
  };
  destination: string;
  environment: DeclaredEnvironment | null;
  events: ObservatoryEvent[];
  createdAt: string;
  updatedAt: string;
};

export type ObservatoryRefusalCode =
  | "OPERATOR_CONSENT_REQUIRED"
  | "NOT_INSTRUMENTED"
  | "RUN_NOT_STARTED"
  | "RUN_ALREADY_STARTED"
  | "RUN_ENDED"
  | "ENVIRONMENT_REQUIRED"
  | "HIDDEN_REASONING_NOT_EVIDENCE"
  | "OUTCOME_OPERATOR_OWNED"
  | "OUTCOME_ALREADY_RECORDED"
  | "INVALID_INPUT"
  | "INVALID_EVENT";

export type StartCaptureInput = {
  initiator: string;
  destination: string;
  at: string;
};

export type StartCaptureResult =
  | { ok: true; graph: PrivateEvidenceGraph }
  | { ok: false; code: ObservatoryRefusalCode };

export type ApplyEventResult =
  | { ok: true; graph: PrivateEvidenceGraph; event: ObservatoryEvent }
  | { ok: false; code: ObservatoryRefusalCode };

/** Read-only projection the operator instrument renders. */
export type ObservatoryState = {
  contractVersion: number;
  runs: PrivateEvidenceGraph[];
};
