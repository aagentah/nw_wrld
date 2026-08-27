const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { OBSERVATORY_CONTRACT_VERSION, startCapture, applyEvent } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "observatory", "contract.js")
);

const at = (n) => new Date(Date.UTC(2026, 7, 26, 12, 0, n)).toISOString();

const optIn = (destination = "Prove the atlas renders a live private run") =>
  startCapture({ initiator: "operator", destination, at: at(0) });
const emit = (graph, input) => applyEvent(graph, { at: at(1), ...input });

const runStart = (graph) =>
  emit(graph, {
    kind: "run_start",
    actor: "source",
    summary: "Run started",
    environment: {
      repoIdentity: "nw_wrld@workspace",
      versions: { app: "0.7.0-beta", node: "v20.0.0" },
      capabilityScope: "read-only workspace; approval-gated writes",
    },
  });
test("uninstrumented is the default: nothing exists to record into", () => {
  const refusedProgram = startCapture({ initiator: "program", destination: "x", at: at(0) });
  assert.equal(refusedProgram.ok, false);
  assert.equal(refusedProgram.code, "OPERATOR_CONSENT_REQUIRED");

  const refusedAi = startCapture({ initiator: "ai", destination: "x", at: at(0) });
  assert.equal(refusedAi.code, "OPERATOR_CONSENT_REQUIRED");

  // An AI-attempted start leaves no session behind: there is no graph to record into.
  assert.equal("graph" in refusedProgram, false);
});

test("operator opt-in creates a private graph with stable identities and contract version", () => {
  const started = optIn("Repair the failing build");
  assert.equal(started.ok, true);
  const graph = started.graph;
  assert.equal(graph.identity.consentState, "private");
  assert.equal(graph.identity.contractVersion, OBSERVATORY_CONTRACT_VERSION);
  assert.match(graph.identity.sourceRunId, /^sr_[a-z0-9]+$/);
  assert.match(graph.identity.exhibitId, /^ex_[a-z0-9]+$/);
  assert.notEqual(graph.identity.sourceRunId, graph.identity.exhibitId);
  assert.equal(graph.destination, "Repair the failing build");
  assert.deepEqual(graph.events, []);
  assert.equal(graph.environment, null);

  // Identities are stable: recording the first event must not re-key the graph.
  const afterStart = runStart(graph);
  assert.equal(afterStart.ok, true);
  assert.equal(afterStart.graph.identity.sourceRunId, graph.identity.sourceRunId);
  assert.equal(afterStart.graph.identity.exhibitId, graph.identity.exhibitId);
  assert.equal(afterStart.graph.identity.contractVersion, OBSERVATORY_CONTRACT_VERSION);
});

test("opt-in precedes the first captured event: no run_start, no events", () => {
  const started = optIn();
  const early = emit(started.graph, {
    kind: "tool_attempt",
    actor: "ai:scout",
    summary: "Read file",
  });
  assert.equal(early.ok, false);
  assert.equal(early.code, "RUN_NOT_STARTED");
  assert.deepEqual(started.graph.events, []);
});

test("never-persist values never land; usage appears as typed withheld-at-capture nodes", () => {
  const started = optIn();
  const g0 = runStart(started.graph).graph;
  const toolRun = emit(g0, {
    kind: "tool_attempt",
    actor: "ai:scout",
    summary: "Called vendor API",
    payload: {
      path: "/home/joe/Projects/private/src/mod.ts",
      api_token: "sk-live-9f2c4d",
      headers: [{ authorization: "Bearer abc.def.ghi" }, { contentType: "application/json" }],
      secret: "hunter2",
      nested: { credentials: { password: "nope" }, note: "keep this" },
      keyboard: "logitech",
    },
  });
  assert.equal(toolRun.ok, true);
  const serialized = JSON.stringify(toolRun.graph);
  assert.ok(!serialized.includes("sk-live"), "token value must never land");
  assert.ok(!serialized.includes("abc.def.ghi"), "credential value must never land");
  assert.ok(!serialized.includes("hunter2"), "secret value must never land");
  assert.ok(!serialized.includes("nope"), "nested password must never land");
  assert.ok(serialized.includes("/home/joe/Projects/private/src/mod.ts"), "private path persists");
  assert.ok(serialized.includes("logitech"), "non-secret 'keyboard' key is not scrubbed");

  const event = toolRun.graph.events.find((e) => e.kind === "tool_attempt");
  const withheldKinds = toolRun.graph.events.filter((e) => e.kind === "withheld_at_capture");
  assert.equal(withheldKinds.length, 1, "exactly one withheld node per scrubbed event");
  const withheld = withheldKinds[0];
  assert.deepEqual(withheld.withheld.map((w) => w.class).sort(), [
    "credential",
    "credential",
    "secret",
    "token",
  ]);
  assert.ok(!JSON.stringify(withheld).includes("sk-live"));
  assert.equal(event.payload.api_token.withheldAtCapture, true);
  assert.equal(event.payload.api_token.class, "token");
  assert.equal(event.payload.headers[0].authorization.withheldAtCapture, true);
  assert.equal(event.payload.headers[1].contentType, "application/json");
  assert.equal(event.payload.nested.credentials.withheldAtCapture, true);
  assert.equal(event.payload.nested.credentials.class, "credential");
  assert.equal(event.payload.nested.note, "keep this");
  assert.equal(event.payload.keyboard, "logitech");
});

test("hidden reasoning is refused as evidence", () => {
  const started = optIn();
  const g0 = runStart(started.graph).graph;
  for (const kind of ["reasoning", "thinking"]) {
    const refused = emit(g0, { kind, actor: "ai:scout", summary: "I think therefore I am" });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, "HIDDEN_REASONING_NOT_EVIDENCE");
  }
  assert.ok(!g0.events.some((e) => e.kind === "reasoning" || e.kind === "thinking"));
});

test("outcome is human-owned and singular", () => {
  const started = optIn();
  const g0 = runStart(started.graph).graph;

  const aiOutcome = emit(g0, {
    kind: "outcome",
    actor: "ai:implementer",
    summary: "Build repaired (self-declared)",
  });
  assert.equal(aiOutcome.ok, false);
  assert.equal(aiOutcome.code, "OUTCOME_OPERATOR_OWNED");

  const outcome = emit(g0, {
    kind: "outcome",
    actor: "operator",
    summary: "Build repaired and regression-checked",
  });
  assert.equal(outcome.ok, true);

  const second = emit(outcome.graph, {
    kind: "outcome",
    actor: "operator",
    summary: "A different outcome",
  });
  assert.equal(second.ok, false);
  assert.equal(second.code, "OUTCOME_ALREADY_RECORDED");
});

test("run_end bounds the instrumented window and rejects later events", () => {
  const started = optIn();
  const g0 = runStart(started.graph).graph;
  const ended = emit(g0, { kind: "run_end", actor: "source", summary: "Run ended" });
  assert.equal(ended.ok, true);
  assert.equal(ended.graph.environment.endedAt, at(1));

  const late = emit(ended.graph, {
    kind: "tool_attempt",
    actor: "ai:scout",
    summary: "Too late",
  });
  assert.equal(late.ok, false);
  assert.equal(late.code, "RUN_ENDED");

  const doubleStart = runStart(ended.graph);
  assert.equal(doubleStart.ok, false);
  assert.equal(doubleStart.code, "RUN_ALREADY_STARTED");
});

test("environment declaration is recorded at run_start", () => {
  const started = optIn();
  const g0 = runStart(started.graph).graph;
  assert.equal(g0.environment.repoIdentity, "nw_wrld@workspace");
  assert.deepEqual(g0.environment.versions, { app: "0.7.0-beta", node: "v20.0.0" });
  assert.equal(g0.environment.capabilityScope, "read-only workspace; approval-gated writes");
  assert.equal(g0.environment.startedAt, at(1));
  assert.equal(g0.environment.endedAt, null);

  const noEnv = emit(optIn().graph, {
    kind: "run_start",
    actor: "source",
    summary: "Run started",
  });
  assert.equal(noEnv.ok, false);
  assert.equal(noEnv.code, "ENVIRONMENT_REQUIRED");
});

test("effect chain stages stay distinct events with monotonic seq", () => {
  const started = optIn();
  let g = runStart(started.graph).graph;
  const chain = [
    { kind: "tool_attempt", actor: "ai:implementer", summary: "Attempted write" },
    { kind: "approval_request", actor: "ai:implementer", summary: "Proposed write" },
    { kind: "approval_resolved", actor: "operator", summary: "Approved" },
    { kind: "tool_observed", actor: "source", summary: "Write ok" },
    { kind: "artifact", actor: "ai:implementer", summary: "Diff produced" },
    { kind: "move", actor: "ai:implementer", summary: "Applied remedy at cause" },
  ];
  for (const input of chain) {
    const r = emit(g, input);
    assert.equal(r.ok, true, input.summary);
    g = r.graph;
  }
  const kinds = g.events.map((e) => e.kind);
  assert.deepEqual(kinds, [
    "run_start",
    "tool_attempt",
    "approval_request",
    "approval_resolved",
    "tool_observed",
    "artifact",
    "move",
  ]);
  assert.deepEqual(
    g.events.map((e) => e.seq),
    g.events.map((_, i) => i)
  );
  assert.ok(g.events.every((e) => typeof e.nodeId === "string" && e.nodeId.length > 0));
});
