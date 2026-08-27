// Observatory Common Exhibit Contract — pure capture logic.
//
// Deep module over the private evidence graph: opt-in consent, the
// run-window state machine, never-persist scrubbing, and the one-outcome
// rule. No Node/Electron imports; both the renderer bundle and the runtime
// TS lane consume this file. Validation of untrusted shapes happens once at
// the true boundaries (IPC handlers, graph file loader) — never here.

import type {
  ApplyEventResult,
  DeclaredEnvironment,
  JsonValue,
  NeverPersistClass,
  ObservatoryEvent,
  ObservatoryEventInput,
  ObservatoryRefusalCode,
  PrivateEvidenceGraph,
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
      ...(payload !== undefined ? { payload } : {}),
      ...(withheld && withheld.length ? { withheld } : {}),
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
