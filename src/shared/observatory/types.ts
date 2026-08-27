// Observatory Common Exhibit Contract — shared type vocabulary.
//
// This file is the single seam shared by every surface (operator instrument
// renderer, main-process store, boundary validators, tests). It must stay
// free of Node/Electron imports so it can be consumed by both the webpack
// renderer bundle and the runtime TS lane.

export const OBSERVATORY_CONTRACT_VERSION = 1;

export const PROGRAM_SLOT_ORDER = [
  "decision-ready-planning",
  "proven-repair",
  "regression-safe-delivery",
  "controlled-service-change",
] as const;

export type OutcomeClass = (typeof PROGRAM_SLOT_ORDER)[number];

export type SourceRunOrigin = "observatory-instrumented" | "demo" | "uninstrumented-reconstruction";

export type SlotOccupancy = "empty" | "presentable-hole" | "filled" | "withdrawn";

export type ProgramSlotOccupant = {
  sourceRunId: string;
  exhibitId: string;
  projectionId: string | null;
  projectionVersion: number | null;
};

export type ProgramSlot = {
  outcomeClass: OutcomeClass;
  occupancy: SlotOccupancy;
  occupant: ProgramSlotOccupant | null;
};

export type NeverPersistClass = "secret" | "token" | "credential" | "key";

export type PrivateOnlyClass =
  | "local-path"
  | "private-repo"
  | "identifier"
  | "raw-tool-io"
  | "local-context-prompt";

export type DisclosureKind = "withheld" | "withheld-at-capture" | "substitution";

export type DisclosureClass = NeverPersistClass | PrivateOnlyClass | "stand-in";

export type EventDisclosure = {
  kind: DisclosureKind;
  class: DisclosureClass;
  reason: string;
  sourceNodeId: string;
  affectedClaimIds: string[];
};

export type DisclosureRecord = EventDisclosure & {
  nodeId: string;
};

export type SealVetoCode =
  | "NEVER_PERSIST_UNPURGED"
  | "CENTRAL_CLAIM_UNSUPPORTED"
  | "PROJECTION_NOT_EFFECT_DISABLED"
  | "PRIVATE_CHAIN_INCOMPLETE"
  | "LEGAL_OR_THIRD_PARTY_CONSTRAINT";

export type GraduationRefusalCode =
  | "OPERATOR_CONSENT_REQUIRED"
  | "NEVER_PERSIST_UNRESTORABLE"
  | "GRADUATION_ABORTED"
  | "NOT_INSTRUMENTED"
  | "INVALID_INPUT"
  | "SEALED"
  | SealVetoCode;

export type OccupancyRefusalCode =
  | "OPERATOR_CONSENT_REQUIRED"
  | "NOT_INSTRUMENTED"
  | "NOT_GRADUATED"
  | "ALREADY_SEALED"
  | "ALREADY_GRADUATED"
  | "INVALID_INPUT";

export type ProvenanceMode =
  | "authentic live"
  | "recorded"
  | "sanitized"
  | "simulated"
  | "fresh re-execution";

export type EffectCapability = "disabled" | "approval-gated" | "enabled";

export type EvidenceKind = "source-observed" | "human-declared" | "ai-declared" | "curator-derived";

export type ClaimSupport = "supported" | "partial" | "unverified" | "contradicted";

export type EffectStageKind =
  | "requested-capability"
  | "granted-scope"
  | "proposal"
  | "approval-or-rejection"
  | "attempt"
  | "observed-effect";

export type EffectStageStatus = "present" | "missing" | "rejected" | "failed" | "unobserved";

export type EffectDisposition = "approved" | "rejected" | "failed" | "abandoned" | "unobserved";

export type EffectStage = {
  kind: EffectStageKind;
  status: EffectStageStatus;
  nodeId: string | null;
  summary: string | null;
};

export type MaterialEffectChain = {
  chainId: string;
  stages: EffectStage[];
  nonResult: boolean;
};

export type RelianceLimitKind =
  | "uncertainty"
  | "scope-bounds"
  | "nondeterminism"
  | "redaction-impact"
  | "unverified-claims";

export type RelianceLimit = {
  kind: RelianceLimitKind;
  summary: string;
};

export type NamedLink = {
  kind: "source" | "wayfinder";
  label: string;
  href: string;
};

export type NodeTrace = {
  evidence: ObservatoryEvent[];
  claims: ObservatoryEvent[];
  sourceEvents: ObservatoryEvent[];
  actors: string[];
  decisions: ObservatoryEvent[];
  links: NamedLink[];
};

export type InspectedNode =
  | {
      ok: true;
      item: ObservatoryEvent;
      relianceLimits: RelianceLimit[];
      orientation: {
        destination: string;
        outcome: string | null;
        provenanceMode: ProvenanceMode;
        effectCapability: EffectCapability;
      };
      traces: NodeTrace;
    }
  | { ok: false };

export type ResolvedLink =
  | { ok: true; item: ObservatoryEvent }
  | { ok: true; link: NamedLink }
  | { ok: false };

export type DrillTargetKind = "actor" | "move" | "claim" | "effect" | "result" | "limitation";

export type DrillTarget = {
  id: string;
  kind: DrillTargetKind;
};

export type ExhibitOverview = {
  humanGoal: string;
  result: { before: string | null; after: string | null };
  materialAiContribution: Array<{ nodeId: string; actor: string; summary: string }>;
  centralClaimSupport: ClaimSupport;
  effectGateStatus: Array<{ chainId: string; status: EffectStageStatus; nonResult: boolean }>;
  limitations: Array<{ hostNodeId: string; kind: RelianceLimitKind; summary: string }>;
  provenanceMode: ProvenanceMode;
  effectCapability: EffectCapability;
  drillTargets: DrillTarget[];
};

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
  | "withheld_at_capture"
  | "withheld"
  | "substitution"
  | "claim"
  | "capability_request"
  | "scope_granted";

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
  evidenceKind?: EvidenceKind;
  central?: boolean;
  supports?: string[];
  contradicts?: string[];
  chainId?: string;
  disposition?: EffectDisposition;
  relianceLimits?: RelianceLimit[];
  links?: NamedLink[];
};

/** What is actually inspectable evidence inside the graph. */
export type ObservatoryEvent = {
  nodeId: string;
  seq: number;
  kind: ObservatoryEventKind;
  actor: string;
  summary: string;
  at: string;
  evidenceKind: EvidenceKind;
  payload?: JsonValue;
  withheld?: WithheldOccurrence[];
  central?: boolean;
  supports?: string[];
  contradicts?: string[];
  chainId?: string;
  disposition?: EffectDisposition;
  relianceLimits?: RelianceLimit[];
  links?: NamedLink[];
  disclosure?: EventDisclosure;
};

export type PrivateEvidenceGraph = {
  identity: {
    sourceRunId: string;
    exhibitId: string;
    contractVersion: number;
    consentState: "private" | "presentable" | "sealed";
    provenanceMode: ProvenanceMode;
    effectCapability: EffectCapability;
    outcomeClass: OutcomeClass | null;
    origin: SourceRunOrigin;
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
  outcomeClass?: OutcomeClass | null;
  origin?: SourceRunOrigin;
};

export type StartCaptureResult =
  | { ok: true; graph: PrivateEvidenceGraph }
  | { ok: false; code: ObservatoryRefusalCode };

export type ApplyEventResult =
  | { ok: true; graph: PrivateEvidenceGraph; event: ObservatoryEvent }
  | { ok: false; code: ObservatoryRefusalCode };

/** Read-only projection the operator instrument renders. */
export type SubstitutionInput = {
  sourceNodeId: string;
  summary: string;
  reason: string;
};

export type GraduationOptions = {
  restoreNodeIds?: readonly string[];
  narrowedClaimIds?: readonly string[];
  substitutions?: readonly SubstitutionInput[];
  legalOrThirdPartyConstraint?: boolean;
  privateChainInspectable?: boolean;
  effectCapability?: EffectCapability;
  aestheticFit?: boolean;
  previousProjections?: readonly PresentableProjection[];
};

export type GraduateInput = GraduationOptions & {
  initiator: string;
  at: string;
  abort?: boolean;
};

export type ClaimDowngrade = {
  claimId: string;
  before: ClaimSupport;
  after: ClaimSupport;
};

export type WithholdDowngradeReport = {
  disclosures: DisclosureRecord[];
  downgrades: ClaimDowngrade[];
  restorableNodeIds: string[];
  provenanceMode: "sanitized" | "simulated" | "recorded";
  effectCapability: "disabled";
  presentableClaim: "recorded-playback";
  vetoes: SealVetoCode[];
};

export type PresentableProjection = {
  identity: {
    sourceRunId: string;
    exhibitId: string;
    projectionId: string;
    projectionVersion: number;
    contractVersion: number;
    consentState: "presentable" | "sealed";
    provenanceMode: ProvenanceMode;
    effectCapability: "disabled";
    presentableClaim: "recorded-playback";
    outcomeClass: OutcomeClass | null;
    origin: SourceRunOrigin;
  };
  destination: string;
  environment: DeclaredEnvironment | null;
  events: ObservatoryEvent[];
  createdAt: string;
  sourceCreatedAt: string;
  withdrawnAt: string | null;
};

export type GraduationPreview = {
  report: WithholdDowngradeReport;
  projection: PresentableProjection;
};

export type GraduateResult =
  | {
      ok: true;
      projection: PresentableProjection;
      withdrawn: PresentableProjection[];
      report: WithholdDowngradeReport;
    }
  | {
      ok: false;
      code: GraduationRefusalCode;
      vetoes?: SealVetoCode[];
      report?: WithholdDowngradeReport;
    };

export type ObservatoryState = {
  contractVersion: number;
  runs: PrivateEvidenceGraph[];
  projections: PresentableProjection[];
};
