import type { ObservatoryEventInput } from "./types";

type RecordEvent = (
  input: ObservatoryEventInput
) => { ok: boolean; code?: string; event?: { nodeId: string; summary: string } };

type EmissionResult = {
  emitted: number;
  refusals: Array<{ code: string; summary: string }>;
};

type EmitterOptions = {
  delayMs?: number;
};

const WRITE_CHAIN = "write-mod-ts";

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
    kind: "capability_request",
    actor: "ai:implementer",
    summary: "Requested write",
    chainId: WRITE_CHAIN,
  },
  {
    kind: "scope_granted",
    actor: "operator",
    summary: "Granted workspace write",
    chainId: WRITE_CHAIN,
  },
  {
    kind: "approval_request",
    actor: "ai:implementer",
    summary: "Proposed write: patch mod.ts at identified cause",
    chainId: WRITE_CHAIN,
  },
  {
    kind: "approval_resolved",
    actor: "operator",
    summary: "Approved write",
    chainId: WRITE_CHAIN,
    disposition: "approved",
  },
  {
    kind: "tool_attempt",
    actor: "ai:implementer",
    summary: "Write patch",
    chainId: WRITE_CHAIN,
    payload: {
      path: "/home/joe/Projects/private/src/mod.ts",
      diff: "@@ -1 +1 @@",
    },
  },
  {
    kind: "tool_observed",
    actor: "source",
    summary: "Write ok",
    chainId: WRITE_CHAIN,
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
    relianceLimits: [{ kind: "scope-bounds", summary: "Patch is limited to mod.ts" }],
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
  const recorded: Array<{ nodeId: string; summary: string }> = [];

  for (let index = 0; index < SCRIPTED_EVENTS.length; index += 1) {
    if (index > 0 && delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
    const event = { ...SCRIPTED_EVENTS[index], at: new Date().toISOString() };
    const result = recordEvent(event);
    if (result.ok) {
      emitted += 1;
      if (result.event) recorded.push(result.event);
    } else {
      refusals.push({ code: result.code ?? "UNKNOWN_REFUSAL", summary: event.summary });
    }
  }

  const observed = recorded.find((event) => event.summary === "Write ok");
  const remedy = recorded.find((event) => event.summary === "Applied minimal remedy identified cause");
  if (observed && remedy) {
    const claim = recordEvent({
      kind: "claim",
      actor: "ai:implementer",
      summary: "Cause is the missing null check",
      central: true,
      supports: [observed.nodeId, remedy.nodeId],
      relianceLimits: [{ kind: "uncertainty", summary: "Single reproduction only" }],
      at: new Date().toISOString(),
    });
    if (claim.ok) emitted += 1;
    else refusals.push({ code: claim.code ?? "UNKNOWN_REFUSAL", summary: "Cause is the missing null check" });
  }

  return { emitted, refusals };
}
