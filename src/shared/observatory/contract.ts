// Observatory Common Exhibit Contract — pure capture logic.
//
// Deep module over the private evidence graph: opt-in consent, the
// run-window state machine, never-persist scrubbing, and the one-outcome
// rule. No Node/Electron imports; both the renderer bundle and the runtime
// TS lane consume this file. Validation of untrusted shapes happens once at
// the true boundaries (IPC handlers, graph file loader) — never here.

import type {
  ApplyEventResult,
  ClaimSupport,
  DeclaredEnvironment,
  EffectStage,
  EffectStageKind,
  EffectStageStatus,
  EvidenceKind,
  InspectedNode,
  ExhibitOverview,
  JsonValue,
  MaterialEffectChain,
  NamedLink,
  NeverPersistClass,
  NodeTrace,
  ObservatoryEvent,
  ObservatoryEventInput,
  PrivateEvidenceGraph,
  ResolvedLink,
  StartCaptureInput,
  StartCaptureResult,
  WithheldOccurrence,
} from "./types";
import { OBSERVATORY_CONTRACT_VERSION } from "./types";

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export { OBSERVATORY_CONTRACT_VERSION } from "./types";
/** Opaque, stable id fragment. Uniqueness matters; secrecy does not. */
export function randomId(length = 12): string {
  let out = "";
  const cryptoObj = (
    globalThis as {
      crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < length; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
    return out;
  }
  for (let i = 0; i < length; i++) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return out;
}

// --- Never-persist classification -----------------------------------------
//
// A key names never-persist material when one of its tokens (split on
// non-alphanumerics AND camelCase, lowercased) exactly matches a known
// marker. Token equality — not substring — keeps `keyboard`, `monkey`,
// `tokenize`, and `author` intact.

const KEY_TOKEN_TO_CLASS: ReadonlyArray<readonly [string, NeverPersistClass]> = [
  ["token", "token"],
  ["secret", "secret"],
  ["password", "secret"],
  ["passwd", "secret"],
  ["pwd", "secret"],
  ["credential", "credential"],
  ["credentials", "credential"],
  ["authorization", "credential"],
  ["auth", "credential"],
  ["apikey", "key"],
  ["key", "key"],
];

export function neverPersistClassForKey(key: string): NeverPersistClass | null {
  const tokens = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  for (const [marker, klass] of KEY_TOKEN_TO_CLASS) {
    if (tokens.includes(marker)) return klass;
  }
  return null;
}

const isJsonObject = (value: JsonValue): value is { [key: string]: JsonValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type ScrubResult = {
  value: JsonValue;
  withheld: WithheldOccurrence[];
};

/**
 * Replaces every value living under a never-persist class key with a typed
 * withheld-at-capture marker. The whole value under a matching key is
 * withheld — a `credentials` object is credential material. Sibling data
 * outside the matching key survives.
 */
export function scrubNeverPersist(value: JsonValue): ScrubResult {
  const withheld: WithheldOccurrence[] = [];
  const walk = (v: JsonValue, path: string): JsonValue => {
    if (Array.isArray(v)) {
      return v.map((item, i) => walk(item, `${path}[${i}]`));
    }
    if (isJsonObject(v)) {
      const out: { [key: string]: JsonValue } = {};
      for (const [k, val] of Object.entries(v)) {
        const keyPath = path ? `${path}.${k}` : k;
        const klass = neverPersistClassForKey(k);
        if (klass) {
          withheld.push({ class: klass, path: keyPath });
          out[k] = { withheldAtCapture: true, class: klass };
        } else {
          out[k] = walk(val, keyPath);
        }
      }
      return out;
    }
    return v;
  };
  return { value: walk(value, ""), withheld };
}

const EVIDENCE_KIND_BY_ACTOR: Record<string, EvidenceKind> = {
  source: "source-observed",
  operator: "human-declared",
  curator: "curator-derived",
};

function evidenceKindFor(
  input: ObservatoryEventInput,
  kind: ObservatoryEvent["kind"]
): EvidenceKind {
  if (kind === "withheld_at_capture") return "source-observed";
  if (input.evidenceKind) return input.evidenceKind;
  return EVIDENCE_KIND_BY_ACTOR[input.actor] ?? "ai-declared";
}


// --- Opt-in ----------------------------------------------------------------

/**
 * Capture starts only on an explicit Operator act. Any other initiator —
 * including a programmatic/AI attempt — is refused observably and leaves no
 * session behind: there is no graph to record into, so an in-flight
 * uninstrumented run cannot be retroactively instrumented.
 */
export function startCapture(input: StartCaptureInput): StartCaptureResult {
  if (input.initiator !== "operator") {
    return { ok: false, code: "OPERATOR_CONSENT_REQUIRED" };
  }
  const graph: PrivateEvidenceGraph = {
    identity: {
      sourceRunId: `sr_${randomId(16)}`,
      exhibitId: `ex_${randomId(16)}`,
      contractVersion: OBSERVATORY_CONTRACT_VERSION,
      consentState: "private",
      provenanceMode: "authentic live",
      effectCapability: "approval-gated",
    },
    destination: input.destination,
    environment: null,
    events: [],
    createdAt: input.at,
    updatedAt: input.at,
  };
  return { ok: true, graph };
}

// --- Event recording --------------------------------------------------------

/**
 * Appends one event to a private evidence graph, enforcing the capture
 * contract. Pure: returns a new graph or a typed refusal; never mutates the
 * input graph.
 */
export function applyEvent(
  graph: PrivateEvidenceGraph,
  input: ObservatoryEventInput
): ApplyEventResult {
  const started = graph.environment !== null;
  const ended = graph.environment !== null && graph.environment.endedAt !== null;

  // Reserved: withheld nodes are derived by capture, never submitted.
  if (input.kind === "withheld_at_capture") {
    return { ok: false, code: "INVALID_EVENT" };
  }
  // Hidden reasoning is not inspectable evidence.
  if (input.kind === "reasoning" || input.kind === "thinking") {
    return { ok: false, code: "HIDDEN_REASONING_NOT_EVIDENCE" };
  }

  if (input.kind === "run_start") {
    if (started) return { ok: false, code: "RUN_ALREADY_STARTED" };
    if (!input.environment) return { ok: false, code: "ENVIRONMENT_REQUIRED" };
  } else {
    if (ended) return { ok: false, code: "RUN_ENDED" };
    if (!started) return { ok: false, code: "RUN_NOT_STARTED" };
  }

  if (
    input.kind === "outcome" &&
    (input.actor !== "operator" || graph.events.some((e) => e.kind === "outcome"))
  ) {
    return {
      ok: false,
      code: input.actor !== "operator" ? "OUTCOME_OPERATOR_OWNED" : "OUTCOME_ALREADY_RECORDED",
    };
  }

  const scrub = input.payload === undefined ? null : scrubNeverPersist(input.payload);
  const appended: ObservatoryEvent[] = [];
  const pushEvent = (
    kind: ObservatoryEvent["kind"],
    summary: string,
    payload?: JsonValue,
    withheld?: WithheldOccurrence[]
  ) => {
    appended.push({
      nodeId: `n${graph.events.length + appended.length}-${randomId(6)}`,
      seq: graph.events.length + appended.length,
      kind,
      actor: input.actor,
      summary,
      at: input.at,
      evidenceKind: evidenceKindFor(input, kind),
      ...(payload !== undefined ? { payload } : {}),
      ...(withheld && withheld.length ? { withheld } : {}),
      ...(kind === "claim" && input.central ? { central: true } : {}),
      ...(kind === "claim" && input.supports && input.supports.length
        ? { supports: [...input.supports] }
        : {}),
      ...(kind === "claim" && input.contradicts && input.contradicts.length
        ? { contradicts: [...input.contradicts] }
        : {}),
      ...(input.chainId ? { chainId: input.chainId } : {}),
      ...(input.disposition ? { disposition: input.disposition } : {}),
      ...(kind !== "withheld_at_capture" && input.relianceLimits && input.relianceLimits.length
        ? {
            relianceLimits: input.relianceLimits.map((limit) => ({ ...limit })),
          }
        : {}),
      ...(kind !== "withheld_at_capture" && input.links && input.links.length
        ? { links: input.links.map((link) => ({ ...link })) }
        : {}),
    });
  };

  pushEvent(input.kind, input.summary, scrub ? scrub.value : undefined);

  if (scrub && scrub.withheld.length > 0) {
    const classes = scrub.withheld.map((w) => w.class);
    const uniqueClasses = [...new Set(classes)];
    pushEvent(
      "withheld_at_capture",
      `Never-persist material used (${uniqueClasses.join(", ")})`,
      undefined,
      scrub.withheld
    );
  }

  let environment: DeclaredEnvironment | null = graph.environment;
  if (input.kind === "run_start" && input.environment) {
    environment = {
      ...input.environment,
      versions: { ...input.environment.versions },
      startedAt: input.at,
      endedAt: null,
    };
  } else if (input.kind === "run_end" && graph.environment) {
    environment = { ...graph.environment, endedAt: input.at };
  }

  const nextGraph: PrivateEvidenceGraph = {
    ...graph,
    environment,
    events: [...graph.events, ...appended],
    updatedAt: input.at,
  };

  return { ok: true, graph: nextGraph, event: appended[0] };
}

function eventById(graph: PrivateEvidenceGraph, nodeId: string): ObservatoryEvent | undefined {
  return graph.events.find((event) => event.nodeId === nodeId);
}

function raisingEvidence(
  graph: PrivateEvidenceGraph,
  nodeIds: readonly string[] | undefined
): { present: ObservatoryEvent[]; missing: boolean } {
  const ids = nodeIds ?? [];
  const present: ObservatoryEvent[] = [];
  let missing = false;
  for (const nodeId of ids) {
    const event = eventById(graph, nodeId);
    if (!event) {
      missing = true;
      continue;
    }
    if (event.evidenceKind !== "curator-derived") present.push(event);
  }
  return { present, missing };
}

/** Support earned by visible non-curator evidence linked to a claim. */
export function claimSupport(graph: PrivateEvidenceGraph, nodeId: string): ClaimSupport | null {
  const claim = eventById(graph, nodeId);
  if (!claim || claim.kind !== "claim") return null;
  const supports = raisingEvidence(graph, claim.supports);
  const contradicts = raisingEvidence(graph, claim.contradicts);
  if (contradicts.present.length > 0) return "contradicted";
  if (supports.present.length === 0) return "unverified";
  if (supports.missing || supports.present.length < (claim.supports ?? []).length) return "partial";
  return "supported";
}

const EFFECT_STAGE_ORDER: readonly EffectStageKind[] = [
  "requested-capability",
  "granted-scope",
  "proposal",
  "approval-or-rejection",
  "attempt",
  "observed-effect",
];

const EVENT_KIND_TO_STAGE: Partial<Record<ObservatoryEvent["kind"], EffectStageKind>> = {
  capability_request: "requested-capability",
  scope_granted: "granted-scope",
  approval_request: "proposal",
  approval_resolved: "approval-or-rejection",
  tool_attempt: "attempt",
  tool_observed: "observed-effect",
};

/** Groups material effect events into complete six-stage chains. */
export function effectChains(graph: PrivateEvidenceGraph): MaterialEffectChain[] {
  const eventsByChainId = new Map<string, ObservatoryEvent[]>();
  for (const event of graph.events) {
    if (!event.chainId) continue;
    const events = eventsByChainId.get(event.chainId);
    if (events) events.push(event);
    else eventsByChainId.set(event.chainId, [event]);
  }
  return [...eventsByChainId.entries()].map(([chainId, events]) => {
    const stages: EffectStage[] = EFFECT_STAGE_ORDER.map((kind) =>
      stageFromEvents(kind, events)
    );
    const nonResult =
      events.some((event) => event.disposition === "abandoned") ||
      stages.some(
        (stage) =>
          stage.status === "rejected" ||
          stage.status === "failed" ||
          stage.status === "unobserved"
      );
    return { chainId, stages, nonResult };
  });
}

function stageFromEvents(kind: EffectStageKind, events: ObservatoryEvent[]): EffectStage {
  const event = events.find((candidate) => EVENT_KIND_TO_STAGE[candidate.kind] === kind);
  if (!event) {
    if (
      kind === "observed-effect" &&
      events.some((candidate) => candidate.kind === "tool_attempt")
    ) {
      return { kind, status: "unobserved", nodeId: null, summary: null };
    }
    return { kind, status: "missing", nodeId: null, summary: null };
  }
  let status: EffectStageStatus = "present";
  if (kind === "approval-or-rejection" && event.disposition === "rejected") status = "rejected";
  else if (kind === "attempt" && event.disposition === "failed") status = "failed";
  else if (kind === "observed-effect" && event.disposition === "unobserved") status = "unobserved";
  return { kind, status, nodeId: event.nodeId, summary: event.summary };
}

/** Read-only inspection of one graph node. Never changes effect capability. */
export function inspectNode(graph: PrivateEvidenceGraph, nodeId: string): InspectedNode {
  if (nodeId.startsWith("actor:")) {
    const actor = nodeId.slice("actor:".length);
    const item = graph.events.find((event) => event.actor === actor);
    if (!item || !actor) return { ok: false };
    return inspectEvent(graph, item);
  }
  const item = eventById(graph, nodeId);
  if (!item) return { ok: false };
  return inspectEvent(graph, item);
}

function inspectEvent(graph: PrivateEvidenceGraph, item: ObservatoryEvent): InspectedNode {
  const outcome = graph.events.find((event) => event.kind === "outcome");
  return {
    ok: true,
    item,
    relianceLimits: item.relianceLimits ? item.relianceLimits.map((limit) => ({ ...limit })) : [],
    orientation: {
      destination: graph.destination,
      outcome: outcome ? outcome.summary : null,
      provenanceMode: graph.identity.provenanceMode,
      effectCapability: graph.identity.effectCapability,
    },
    traces: tracesFor(graph, item),
  };
}

export function resolveLink(graph: PrivateEvidenceGraph, link: NamedLink): ResolvedLink {
  const label = link.label.trim();
  const href = link.href.trim();
  if (!label || !href || (link.kind !== "source" && link.kind !== "wayfinder")) {
    return { ok: false };
  }
  const target = eventById(graph, href);
  if (target) return { ok: true, item: target };
  return { ok: true, link: { kind: link.kind, label, href } };
}

function tracesFor(graph: PrivateEvidenceGraph, item: ObservatoryEvent): NodeTrace {
  const citingClaims = graph.events.filter(
    (event) =>
      event.kind === "claim" &&
      ((event.supports ?? []).includes(item.nodeId) ||
        (event.contradicts ?? []).includes(item.nodeId) ||
        event.nodeId === item.nodeId)
  );
  const linkedIds = [...(item.supports ?? []), ...(item.contradicts ?? [])];
  const evidence =
    item.kind === "claim"
      ? linkedIds
          .map((nodeId) => eventById(graph, nodeId))
          .filter((event): event is ObservatoryEvent => Boolean(event))
      : [];
  const claims = item.kind === "claim" ? [] : citingClaims;
  const links = item.links ? item.links.map((link) => ({ ...link })) : [];
  const decisions = links
    .filter((link) => link.kind === "wayfinder")
    .map((link) => eventById(graph, link.href))
    .filter((event): event is ObservatoryEvent => Boolean(event));
  const sourceEvents = evidence.filter((event) => event.evidenceKind === "source-observed");
  const actors: string[] = [];
  for (const actor of [item.actor, ...evidence.map((event) => event.actor)]) {
    if (!actors.includes(actor)) actors.push(actor);
  }
  return { evidence, claims, sourceEvents, actors, decisions, links };
}

const SUPPORT_RANK: Record<ClaimSupport, number> = {
  contradicted: 0,
  unverified: 1,
  partial: 2,
  supported: 3,
};

/** Contract facts a surface must make legible before drill-down. */
export function exhibitOverview(graph: PrivateEvidenceGraph): ExhibitOverview {
  const outcome = graph.events.find((event) => event.kind === "outcome");
  const beforeEvent = graph.events.find(
    (event) =>
      event.evidenceKind === "source-observed" &&
      event.kind !== "run_start" &&
      event.kind !== "run_end" &&
      event.kind !== "withheld_at_capture"
  );
  const centralClaims = graph.events.filter((event) => event.kind === "claim" && event.central);
  let centralClaimSupport: ClaimSupport = "unverified";
  if (centralClaims.length > 0) {
    centralClaimSupport = "supported";
    for (const claim of centralClaims) {
      const support = claimSupport(graph, claim.nodeId) ?? "unverified";
      if (SUPPORT_RANK[support] < SUPPORT_RANK[centralClaimSupport]) {
        centralClaimSupport = support;
      }
    }
  }
  const chains = effectChains(graph);
  const effectGateStatus = chains.map((chain) => ({
    chainId: chain.chainId,
    status: chain.stages.find((stage) => stage.kind === "approval-or-rejection")?.status ?? "missing",
    nonResult: chain.nonResult,
  }));

  const limitations: ExhibitOverview["limitations"] = [];
  const drillTargets: ExhibitOverview["drillTargets"] = [];
  const seenActors = new Set<string>();

  for (const event of graph.events) {
    if (!seenActors.has(event.actor)) {
      seenActors.add(event.actor);
      drillTargets.push({ id: `actor:${event.actor}`, kind: "actor" });
    }
    if (event.kind === "move") drillTargets.push({ id: event.nodeId, kind: "move" });
    if (event.kind === "claim") drillTargets.push({ id: event.nodeId, kind: "claim" });
    if (event.kind === "outcome") drillTargets.push({ id: event.nodeId, kind: "result" });
    if (EVENT_KIND_TO_STAGE[event.kind] && event.nodeId) {
      drillTargets.push({ id: event.nodeId, kind: "effect" });
    }
    for (const limit of event.relianceLimits ?? []) {
      limitations.push({ hostNodeId: event.nodeId, kind: limit.kind, summary: limit.summary });
      drillTargets.push({ id: event.nodeId, kind: "limitation" });
    }
  }

  return {
    humanGoal: graph.destination,
    result: {
      before: beforeEvent ? beforeEvent.summary : null,
      after: outcome ? outcome.summary : null,
    },
    materialAiContribution: graph.events
      .filter((event) => event.kind === "move" && event.evidenceKind === "ai-declared")
      .map((event) => ({ nodeId: event.nodeId, actor: event.actor, summary: event.summary })),
    centralClaimSupport,
    effectGateStatus,
    limitations,
    provenanceMode: graph.identity.provenanceMode,
    effectCapability: graph.identity.effectCapability,
    drillTargets,
  };
}


