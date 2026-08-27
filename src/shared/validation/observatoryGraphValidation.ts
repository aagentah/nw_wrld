import { neverPersistClassForKey } from "../observatory/contract";
import {
  OBSERVATORY_CONTRACT_VERSION,
  type DeclaredEnvironment,
  type JsonValue,
  type ObservatoryEvent,
  type ObservatoryEventKind,
  type PrivateEvidenceGraph,
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
};
const WITHHELD_CLASSES: Record<WithheldOccurrence["class"], true> = {
  secret: true,
  token: true,
  credential: true,
  key: true,
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
  if (
    !sourceRunId ||
    !exhibitId ||
    !ID_PATTERN.test(sourceRunId) ||
    !ID_PATTERN.test(exhibitId) ||
    sourceRunId === exhibitId ||
    value.contractVersion !== OBSERVATORY_CONTRACT_VERSION ||
    value.consentState !== "private"
  ) {
    return null;
  }
  return {
    sourceRunId,
    exhibitId,
    contractVersion: OBSERVATORY_CONTRACT_VERSION,
    consentState: "private",
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

    const event: ObservatoryEvent = { nodeId, seq: index, kind, actor, summary, at };
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

  return { identity, destination, environment, events, createdAt, updatedAt };
}
