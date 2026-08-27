import { neverPersistClassForKey } from "../observatory/contract";
import {
  OBSERVATORY_CONTRACT_VERSION,
  type DeclaredEnvironment,
  type DisclosureClass,
  type DisclosureKind,
  type EffectCapability,
  type EffectDisposition,
  type EventDisclosure,
  type EvidenceKind,
  type JsonValue,
  type NamedLink,
  type ObservatoryEvent,
  type ObservatoryEventKind,
  type PresentableProjection,
  type PrivateEvidenceGraph,
  type ProvenanceMode,
  type RelianceLimit,
  type RelianceLimitKind,
  type WithheldOccurrence,
} from "../observatory/types";
type PlainObject = Record<string, unknown>;

const ID_PATTERN = /^[a-z0-9_:-]{8,80}$/;
const EVENT_KINDS: Record<ObservatoryEventKind, true> = {
  run_start: true,
  run_end: true,
  move: true,
  tool_attempt: true,
  tool_observed: true,
  approval_request: true,
  approval_resolved: true,
  artifact: true,
  outcome: true,
  withheld_at_capture: true,
  withheld: true,
  substitution: true,
  claim: true,
  capability_request: true,
  scope_granted: true,
};
const WITHHELD_CLASSES: Record<WithheldOccurrence["class"], true> = {
  secret: true,
  token: true,
  credential: true,
  key: true,
};
const DISCLOSURE_KINDS: Record<DisclosureKind, true> = {
  withheld: true,
  "withheld-at-capture": true,
  substitution: true,
};
const DISCLOSURE_CLASSES: Record<DisclosureClass, true> = {
  secret: true,
  token: true,
  credential: true,
  key: true,
  "local-path": true,
  "private-repo": true,
  identifier: true,
  "raw-tool-io": true,
  "local-context-prompt": true,
  "stand-in": true,
};
const PROVENANCE_MODES: Record<ProvenanceMode, true> = {
  "authentic live": true,
  recorded: true,
  sanitized: true,
  simulated: true,
  "fresh re-execution": true,
};
const EFFECT_CAPABILITIES: Record<EffectCapability, true> = {
  disabled: true,
  "approval-gated": true,
  enabled: true,
};
const EVIDENCE_KINDS: Record<EvidenceKind, true> = {
  "source-observed": true,
  "human-declared": true,
  "ai-declared": true,
  "curator-derived": true,
};
const RELIANCE_LIMIT_KINDS: Record<RelianceLimitKind, true> = {
  uncertainty: true,
  "scope-bounds": true,
  nondeterminism: true,
  "redaction-impact": true,
  "unverified-claims": true,
};
const LINK_KINDS: Record<NamedLink["kind"], true> = {
  source: true,
  wayfinder: true,
};
const EFFECT_DISPOSITIONS: Record<EffectDisposition, true> = {
  approved: true,
  rejected: true,
  failed: true,
  abandoned: true,
  unobserved: true,
};
function isPlainObject(value: unknown): value is PlainObject {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseJsonValue(value: unknown): JsonValue | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value;
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const parsed: JsonValue[] = [];
    for (const item of value) {
      const next = parseJsonValue(item);
      if (next === undefined) return undefined;
      parsed.push(next);
    }
    return parsed;
  }
  if (!isPlainObject(value)) return undefined;

  const parsed: { [key: string]: JsonValue } = {};
  for (const [key, item] of Object.entries(value)) {
    const neverPersistClass = neverPersistClassForKey(key);
    if (neverPersistClass) {
      if (
        !isPlainObject(item) ||
        Object.keys(item).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(item, "withheldAtCapture") ||
        !Object.prototype.hasOwnProperty.call(item, "class") ||
        item.withheldAtCapture !== true ||
        item.class !== neverPersistClass
      ) {
        return undefined;
      }
      parsed[key] = { withheldAtCapture: true, class: neverPersistClass };
      continue;
    }
    const next = parseJsonValue(item);
    if (next === undefined) return undefined;
    parsed[key] = next;
  }
  return parsed;
}

function parseIdentity(value: unknown): PrivateEvidenceGraph["identity"] | null {
  if (!isPlainObject(value)) return null;
  const sourceRunId = asNonEmptyString(value.sourceRunId);
  const exhibitId = asNonEmptyString(value.exhibitId);
  const provenanceMode =
    value.provenanceMode === undefined
      ? "authentic live"
      : typeof value.provenanceMode === "string" &&
          PROVENANCE_MODES[value.provenanceMode as ProvenanceMode]
        ? (value.provenanceMode as ProvenanceMode)
        : null;
  const effectCapability =
    value.effectCapability === undefined
      ? "approval-gated"
      : typeof value.effectCapability === "string" &&
          EFFECT_CAPABILITIES[value.effectCapability as EffectCapability]
        ? (value.effectCapability as EffectCapability)
        : null;
  if (
    !sourceRunId ||
    !exhibitId ||
    !ID_PATTERN.test(sourceRunId) ||
    !ID_PATTERN.test(exhibitId) ||
    sourceRunId === exhibitId ||
    value.contractVersion !== OBSERVATORY_CONTRACT_VERSION ||
    value.consentState !== "private" ||
    !provenanceMode ||
    !effectCapability
  ) {
    return null;
  }
  return {
    sourceRunId,
    exhibitId,
    contractVersion: OBSERVATORY_CONTRACT_VERSION,
    consentState: "private",
    provenanceMode,
    effectCapability,
  };
}

function parseEnvironment(value: unknown): DeclaredEnvironment | null | undefined {
  if (value === null) return null;
  if (!isPlainObject(value) || !isPlainObject(value.versions)) return undefined;

  const repoIdentity = asNonEmptyString(value.repoIdentity);
  const capabilityScope = asNonEmptyString(value.capabilityScope);
  const startedAt = asNonEmptyString(value.startedAt);
  const endedAt = value.endedAt === null ? null : (asNonEmptyString(value.endedAt) ?? undefined);
  if (!repoIdentity || !capabilityScope || !startedAt || endedAt === undefined) return undefined;

  const versions: Record<string, string> = {};
  for (const [name, version] of Object.entries(value.versions)) {
    const versionValue = asNonEmptyString(version);
    if (!asNonEmptyString(name) || !versionValue) return undefined;
    versions[name] = versionValue;
  }
  if (Object.keys(versions).length === 0) return undefined;
  return { repoIdentity, versions, capabilityScope, startedAt, endedAt };
}

function parseDisclosure(value: unknown): EventDisclosure | null {
  if (!isPlainObject(value)) return null;
  const reason = asNonEmptyString(value.reason);
  const sourceNodeId = asNonEmptyString(value.sourceNodeId);
  const affectedClaimIds = Object.prototype.hasOwnProperty.call(value, "affectedClaimIds")
    ? (parseNodeIds(value.affectedClaimIds) ?? [])
    : [];
  if (
    !reason ||
    !sourceNodeId ||
    typeof value.kind !== "string" ||
    !DISCLOSURE_KINDS[value.kind as DisclosureKind] ||
    typeof value.class !== "string" ||
    !DISCLOSURE_CLASSES[value.class as DisclosureClass] ||
    (Object.prototype.hasOwnProperty.call(value, "affectedClaimIds") &&
      !Array.isArray(value.affectedClaimIds))
  ) {
    return null;
  }
  if (
    Object.prototype.hasOwnProperty.call(value, "affectedClaimIds") &&
    Array.isArray(value.affectedClaimIds) &&
    value.affectedClaimIds.length > 0 &&
    affectedClaimIds.length === 0
  ) {
    return null;
  }
  return {
    kind: value.kind as DisclosureKind,
    class: value.class as DisclosureClass,
    reason,
    sourceNodeId,
    affectedClaimIds,
  };
}

function parseWithheld(value: unknown): WithheldOccurrence[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const withheld: WithheldOccurrence[] = [];
  for (const occurrence of value) {
    if (!isPlainObject(occurrence)) return undefined;
    const path = asNonEmptyString(occurrence.path);
    if (
      !path ||
      typeof occurrence.class !== "string" ||
      !WITHHELD_CLASSES[occurrence.class as WithheldOccurrence["class"]]
    ) {
      return undefined;
    }
    withheld.push({ class: occurrence.class as WithheldOccurrence["class"], path });
  }
  return withheld;
}

function parseNodeIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const nodeIds: string[] = [];
  for (const item of value) {
    const nodeId = asNonEmptyString(item);
    if (!nodeId) return undefined;
    nodeIds.push(nodeId);
  }
  return nodeIds;
}

function parseRelianceLimits(value: unknown): RelianceLimit[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const limits: RelianceLimit[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) return undefined;
    const summary = asNonEmptyString(item.summary);
    if (
      !summary ||
      typeof item.kind !== "string" ||
      !RELIANCE_LIMIT_KINDS[item.kind as RelianceLimitKind]
    ) {
      return undefined;
    }
    limits.push({ kind: item.kind as RelianceLimitKind, summary });
  }
  return limits;
}
function parseNamedLinks(value: unknown): NamedLink[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const links: NamedLink[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) return undefined;
    const label = asNonEmptyString(item.label);
    const href = asNonEmptyString(item.href);
    if (
      !label ||
      !href ||
      typeof item.kind !== "string" ||
      !LINK_KINDS[item.kind as NamedLink["kind"]]
    ) {
      return undefined;
    }
    links.push({ kind: item.kind as NamedLink["kind"], label, href });
  }
  return links;
}

function evidenceKindFromRaw(raw: PlainObject, kind: ObservatoryEventKind): EvidenceKind | null {
  if (Object.prototype.hasOwnProperty.call(raw, "evidenceKind")) {
    if (typeof raw.evidenceKind === "string" && EVIDENCE_KINDS[raw.evidenceKind as EvidenceKind]) {
      return raw.evidenceKind as EvidenceKind;
    }
    return null;
  }
  if (kind === "withheld_at_capture") return "source-observed";
  if (raw.actor === "operator") return "human-declared";
  if (raw.actor === "source") return "source-observed";
  if (raw.actor === "curator") return "curator-derived";
  return "ai-declared";
}

function parseEvents(value: unknown): ObservatoryEvent[] | null {
  if (!Array.isArray(value)) return null;
  const events: ObservatoryEvent[] = [];
  let hasStarted = false;
  let hasEnded = false;
  let hasOutcome = false;

  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!isPlainObject(raw)) return null;
    const nodeId = asNonEmptyString(raw.nodeId);
    const actor = asNonEmptyString(raw.actor);
    const summary = asNonEmptyString(raw.summary);
    const at = asNonEmptyString(raw.at);
    if (
      !nodeId ||
      !actor ||
      !summary ||
      !at ||
      !Number.isInteger(raw.seq) ||
      raw.seq !== index ||
      typeof raw.kind !== "string" ||
      !EVENT_KINDS[raw.kind as ObservatoryEventKind]
    ) {
      return null;
    }

    const kind = raw.kind as ObservatoryEventKind;
    if (kind === "run_start") {
      if (hasStarted || hasEnded || index !== 0) return null;
      hasStarted = true;
    } else if (!hasStarted || hasEnded) {
      return null;
    }
    if (kind === "run_end") {
      if (hasEnded) return null;
      hasEnded = true;
    }
    if (kind === "outcome") {
      if (hasOutcome || actor !== "operator") return null;
      hasOutcome = true;
    }

    const evidenceKind = evidenceKindFromRaw(raw, kind);
    if (!evidenceKind) return null;
    const event: ObservatoryEvent = {
      nodeId,
      seq: index,
      kind,
      actor,
      summary,
      at,
      evidenceKind,
    };
    if (Object.prototype.hasOwnProperty.call(raw, "disclosure")) {
      const disclosure = parseDisclosure(raw.disclosure);
      if (!disclosure) return null;
      event.disclosure = disclosure;
    }
    if ((kind === "withheld" || kind === "substitution") && !event.disclosure) {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(raw, "payload")) {
      const payload = parseJsonValue(raw.payload);
      if (payload === undefined) return null;
      event.payload = payload;
    }
    if (Object.prototype.hasOwnProperty.call(raw, "withheld")) {
      const withheld = parseWithheld(raw.withheld);
      if (!withheld) return null;
      event.withheld = withheld;
    }
    if (kind === "withheld_at_capture" && (!event.withheld || event.payload !== undefined)) {
      return null;
    }
    if (kind === "claim") {
      if (raw.central === true) event.central = true;
      else if (Object.prototype.hasOwnProperty.call(raw, "central")) return null;
      if (Object.prototype.hasOwnProperty.call(raw, "supports")) {
        const supports = parseNodeIds(raw.supports);
        if (!supports) return null;
        event.supports = supports;
      }
      if (Object.prototype.hasOwnProperty.call(raw, "contradicts")) {
        const contradicts = parseNodeIds(raw.contradicts);
        if (!contradicts) return null;
        event.contradicts = contradicts;
      }
    } else if (
      Object.prototype.hasOwnProperty.call(raw, "central") ||
      Object.prototype.hasOwnProperty.call(raw, "supports") ||
      Object.prototype.hasOwnProperty.call(raw, "contradicts")
    ) {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(raw, "chainId")) {
      const chainId = asNonEmptyString(raw.chainId);
      if (!chainId) return null;
      event.chainId = chainId;
    }
    if (Object.prototype.hasOwnProperty.call(raw, "disposition")) {
      if (
        typeof raw.disposition !== "string" ||
        !EFFECT_DISPOSITIONS[raw.disposition as EffectDisposition]
      ) {
        return null;
      }
      event.disposition = raw.disposition as EffectDisposition;
    }
    if (Object.prototype.hasOwnProperty.call(raw, "relianceLimits")) {
      const relianceLimits = parseRelianceLimits(raw.relianceLimits);
      if (!relianceLimits) return null;
      event.relianceLimits = relianceLimits;
    }
    if (Object.prototype.hasOwnProperty.call(raw, "links")) {
      const links = parseNamedLinks(raw.links);
      if (!links) return null;
      event.links = links;
    }
    events.push(event);
  }
  return events;
}

/**
 * Validates one JSON graph at the disk boundary. Unknown contract versions,
 * malformed run windows, and any never-persist key fail closed.
 */
export function parseObservatoryGraphFile(value: unknown): PrivateEvidenceGraph | null {
  if (!isPlainObject(value)) return null;

  const identity = parseIdentity(value.identity);
  const destination = typeof value.destination === "string" ? value.destination : null;
  const environment = parseEnvironment(value.environment);
  const events = parseEvents(value.events);
  const createdAt = asNonEmptyString(value.createdAt);
  const updatedAt = asNonEmptyString(value.updatedAt);
  if (
    !identity ||
    destination === null ||
    environment === undefined ||
    !events ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  if ((environment === null) !== (events.length === 0)) return null;
  if (
    environment !== null &&
    (events[0]?.kind !== "run_start" ||
      (environment.endedAt === null && events.some((event) => event.kind === "run_end")) ||
      (environment.endedAt !== null && events.at(-1)?.kind !== "run_end"))
  ) {
    return null;
  }

  if (events.some((event) => event.kind === "withheld" || event.kind === "substitution")) {
    return null;
  }
  return { identity, destination, environment, events, createdAt, updatedAt };
}

function parseProjectionIdentity(value: unknown): PresentableProjection["identity"] | null {
  if (!isPlainObject(value)) return null;
  const sourceRunId = asNonEmptyString(value.sourceRunId);
  const exhibitId = asNonEmptyString(value.exhibitId);
  const projectionId = asNonEmptyString(value.projectionId);
  const provenanceMode =
    value.provenanceMode === "recorded" ||
    value.provenanceMode === "sanitized" ||
    value.provenanceMode === "simulated"
      ? value.provenanceMode
      : null;
  if (
    !sourceRunId ||
    !exhibitId ||
    !projectionId ||
    !ID_PATTERN.test(sourceRunId) ||
    !ID_PATTERN.test(exhibitId) ||
    !ID_PATTERN.test(projectionId) ||
    sourceRunId === exhibitId ||
    value.contractVersion !== OBSERVATORY_CONTRACT_VERSION ||
    (value.consentState !== "presentable" && value.consentState !== "sealed") ||
    !Number.isInteger(value.projectionVersion) ||
    (value.projectionVersion as number) < 1 ||
    value.effectCapability !== "disabled" ||
    value.presentableClaim !== "recorded-playback" ||
    !provenanceMode
  ) {
    return null;
  }
  return {
    sourceRunId,
    exhibitId,
    projectionId,
    projectionVersion: value.projectionVersion as number,
    contractVersion: OBSERVATORY_CONTRACT_VERSION,
    consentState: value.consentState,
    provenanceMode,
    effectCapability: "disabled",
    presentableClaim: "recorded-playback",
  };
}

/**
 * Validates one JSON presentable projection at the disk boundary.
 */
export function parseObservatoryProjectionFile(value: unknown): PresentableProjection | null {
  if (!isPlainObject(value)) return null;
  const identity = parseProjectionIdentity(value.identity);
  const destination = typeof value.destination === "string" ? value.destination : null;
  const environment = parseEnvironment(value.environment);
  const events = parseEvents(value.events);
  const createdAt = asNonEmptyString(value.createdAt);
  const withdrawnAt =
    value.withdrawnAt === null ? null : (asNonEmptyString(value.withdrawnAt) ?? undefined);
  if (
    !identity ||
    destination === null ||
    environment === undefined ||
    !events ||
    !createdAt ||
    withdrawnAt === undefined
  ) {
    return null;
  }
  if (identity.consentState === "sealed" && withdrawnAt === null) return null;
  if (identity.consentState === "presentable" && withdrawnAt !== null) return null;
  for (const event of events) {
    if (event.kind === "withheld" && event.disclosure?.kind !== "withheld") return null;
    if (event.kind === "substitution" && event.disclosure?.kind !== "substitution") return null;
    if (event.kind === "withheld_at_capture" && event.disclosure?.kind !== "withheld-at-capture") {
      return null;
    }
  }
  return { identity, destination, environment, events, createdAt, withdrawnAt };
}
