import type { ObservatoryEventInput } from "./types";

type RecordEvent = (input: ObservatoryEventInput) => { ok: boolean; code?: string };

type EmissionResult = {
  emitted: number;
  refusals: Array<{ code: string; summary: string }>;
};

type EmitterOptions = {
  delayMs?: number;
};

const SCRIPTED_EVENTS: ReadonlyArray<Omit<ObservatoryEventInput, "at">> = [
  {
    kind: "run_start",
    actor: "source",
    summary: "Instrumented source run started",
    environment: {
      repoIdentity: "nw_wrld/test-emitter",
      versions: { app: "0.7.0-beta", emitter: "tracer" },
      capabilityScope: "read-only workspace; approval-gated writes",
    },
  },
  {
    kind: "move",
    actor: "ai:scout",
    summary: "Mapped source context",
  },
  {
    kind: "move",
    actor: "ai:scout",
    summary: "Formed causal hypothesis",
  },
  {
    kind: "tool_attempt",
    actor: "ai:scout",
    summary: "Read source file",
    payload: {
      path: "/home/joe/Projects/private/src/mod.ts",
      api_token: "sk-live-9f2c4d7e",
    },
  },
  {
    kind: "tool_observed",
    actor: "source",
    summary: "Read ok",
    payload: { bytes: 1204, excerpt: "export function broken() { return 1/0; }" },
  },
  {
    kind: "approval_request",
    actor: "ai:implementer",
    summary: "Proposed write: patch mod.ts at identified cause",
  },
  {
    kind: "approval_resolved",
    actor: "operator",
    summary: "Approved write",
  },
  {
    kind: "tool_attempt",
    actor: "ai:implementer",
    summary: "Write patch",
    payload: {
      path: "/home/joe/Projects/private/src/mod.ts",
      diff: "@@ -1 +1 @@",
    },
  },
  {
    kind: "tool_observed",
    actor: "source",
    summary: "Write ok",
    payload: { status: "ok" },
  },
  {
    kind: "artifact",
    actor: "ai:implementer",
    summary: "Patch artifact",
    payload: { kind: "diff", path: "/home/joe/Projects/private/patches/mod.patch" },
  },
  {
    kind: "move",
    actor: "ai:implementer",
    summary: "Applied minimal remedy identified cause",
  },
];

/** Emits a deterministic source-run sequence for the operator instrument. */
export async function emitScriptedSourceRun(
  recordEvent: RecordEvent,
  options: EmitterOptions = {}
): Promise<EmissionResult> {
  const delayMs = options.delayMs ?? 120;
  let emitted = 0;
  const refusals: EmissionResult["refusals"] = [];

  for (let index = 0; index < SCRIPTED_EVENTS.length; index += 1) {
    if (index > 0 && delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
    const event = { ...SCRIPTED_EVENTS[index], at: new Date().toISOString() };
    const result = recordEvent(event);
    if (result.ok) {
      emitted += 1;
    } else {
      refusals.push({ code: result.code ?? "UNKNOWN_REFUSAL", summary: event.summary });
    }
  }

  return { emitted, refusals };
}
