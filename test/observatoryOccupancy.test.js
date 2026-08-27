const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { startCapture, applyEvent, programSlots, claimSupport, graduate, seal, revoke } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "observatory", "contract.js")
);

const at = (n) => new Date(Date.UTC(2026, 7, 27, 16, 0, n)).toISOString();

const optIn = (overrides = {}) =>
  startCapture({
    initiator: "operator",
    destination: "Reach a decision-ready plan",
    at: at(0),
    ...overrides,
  });

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

const endRun = (graph, time = 8) =>
  emit(graph, {
    kind: "run_end",
    actor: "source",
    summary: "Instrumented source run ended",
    at: at(time),
  }).graph;

function graphReadyToGraduate(overrides = {}) {
  let g = runStart(
    optIn({ destination: "Prove a private run can graduate", ...overrides }).graph
  ).graph;
  g = emit(g, {
    kind: "artifact",
    actor: "source",
    summary: "Passing reproduction",
    payload: { passing: true },
  }).graph;
  const artifact = g.events.find((event) => event.kind === "artifact");
  g = emit(g, {
    kind: "claim",
    actor: "operator",
    summary: "Repair holds",
    central: true,
    supports: [artifact.nodeId],
  }).graph;
  g = emit(g, { kind: "outcome", actor: "operator", summary: "Repaired" }).graph;
  return endRun(g);
}

test("four program slots start empty in encounter order", () => {
  const slots = programSlots({ runs: [], projections: [] });
  assert.deepEqual(
    slots.map((slot) => [slot.outcomeClass, slot.occupancy, slot.occupant]),
    [
      ["decision-ready-planning", "empty", null],
      ["proven-repair", "empty", null],
      ["regression-safe-delivery", "empty", null],
      ["controlled-service-change", "empty", null],
    ]
  );
});

test("first qualifying instrumented run occupies as a presentable hole; demos and reconstructions cannot", () => {
  const planning = optIn({ outcomeClass: "decision-ready-planning", at: at(2) }).graph;
  const extra = optIn({ at: at(3) }).graph;
  const demo = optIn({
    outcomeClass: "decision-ready-planning",
    origin: "demo",
    at: at(1),
  }).graph;
  const reconstruction = optIn({
    outcomeClass: "proven-repair",
    origin: "uninstrumented-reconstruction",
    at: at(4),
  }).graph;
  const laterPlanning = optIn({ outcomeClass: "decision-ready-planning", at: at(5) }).graph;

  const slots = programSlots({
    runs: [planning, extra, demo, reconstruction, laterPlanning],
    projections: [],
  });

  assert.equal(slots[0].occupancy, "presentable-hole");
  assert.equal(slots[0].occupant.sourceRunId, planning.identity.sourceRunId);
  assert.notEqual(slots[0].occupant.sourceRunId, laterPlanning.identity.sourceRunId);
  assert.equal(slots[1].occupancy, "empty");
  assert.equal(slots[2].occupancy, "empty");
  assert.equal(slots[3].occupancy, "empty");
  assert.ok(
    new Set(slots.map((slot) => slot.occupancy)).size === 2,
    "empty and presentable-hole stay distinct"
  );
});

test("marking a classed run as a purpose-built demo vacates the slot", () => {
  const graph = optIn({ outcomeClass: "decision-ready-planning", at: at(2) }).graph;
  assert.equal(programSlots({ runs: [graph], projections: [] })[0].occupancy, "presentable-hole");
  const demo = {
    ...graph,
    identity: { ...graph.identity, origin: "demo" },
  };
  assert.equal(programSlots({ runs: [demo], projections: [] })[0].occupancy, "empty");
});

test("Graduation of the occupant fills the slot", () => {
  const graph = graphReadyToGraduate({ outcomeClass: "proven-repair" });
  const result = graduate(graph, { initiator: "operator", at: at(9) });
  assert.equal(result.ok, true);

  const slots = programSlots({ runs: [graph], projections: [result.projection] });
  assert.equal(slots[1].occupancy, "filled");
  assert.equal(slots[1].occupant.sourceRunId, graph.identity.sourceRunId);
  assert.equal(slots[1].occupant.projectionId, result.projection.identity.projectionId);
  assert.equal(slots[0].occupancy, "empty");
});

test("a Sealed run that never Graduated is not an occupant; the slot stays available", () => {
  const first = optIn({ outcomeClass: "regression-safe-delivery", at: at(2) }).graph;
  const sealed = seal(first, { initiator: "operator", at: at(3) });
  assert.equal(sealed.ok, true);
  assert.equal(sealed.graph.identity.consentState, "sealed");

  const next = optIn({ outcomeClass: "regression-safe-delivery", at: at(4) }).graph;
  const emptyAfterSeal = programSlots({ runs: [sealed.graph], projections: [] });
  assert.equal(emptyAfterSeal[2].occupancy, "empty");
  assert.equal(emptyAfterSeal[2].occupant, null);

  const afterNext = programSlots({ runs: [sealed.graph, next], projections: [] });
  assert.equal(afterNext[2].occupancy, "presentable-hole");
  assert.equal(afterNext[2].occupant.sourceRunId, next.identity.sourceRunId);

  const aiSeal = seal(next, { initiator: "ai", at: at(5) });
  assert.equal(aiSeal.ok, false);
  assert.equal(aiSeal.code, "OPERATOR_CONSENT_REQUIRED");
});

test("seal of a Graduated occupant is refused so re-Graduation stays possible", () => {
  const graph = graphReadyToGraduate({ outcomeClass: "proven-repair" });
  const graduated = graduate(graph, { initiator: "operator", at: at(9) });
  assert.equal(graduated.ok, true);
  const sealed = seal(graph, {
    initiator: "operator",
    at: at(10),
    previousProjections: [graduated.projection],
  });
  assert.equal(sealed.ok, false);
  assert.equal(sealed.code, "ALREADY_GRADUATED");
  assert.equal(graph.identity.consentState, "private");
});

test("empty, presentable hole, filled, and withdrawn are mutually distinct", () => {
  const hole = optIn({ outcomeClass: "decision-ready-planning", at: at(1) }).graph;
  const filledGraph = graphReadyToGraduate({ outcomeClass: "proven-repair", at: at(2) });
  const filled = graduate(filledGraph, { initiator: "operator", at: at(9) });
  assert.equal(filled.ok, true);
  const withdrawnGraph = graphReadyToGraduate({
    outcomeClass: "regression-safe-delivery",
    at: at(3),
  });
  const withdrawnGrad = graduate(withdrawnGraph, { initiator: "operator", at: at(9) });
  assert.equal(withdrawnGrad.ok, true);
  const withdrawn = revoke([withdrawnGrad.projection], { initiator: "operator", at: at(10) });
  assert.equal(withdrawn.ok, true);

  const slots = programSlots({
    runs: [hole, filledGraph, withdrawnGraph],
    projections: [filled.projection, ...withdrawn.withdrawn],
  });
  assert.deepEqual(
    slots.map((slot) => slot.occupancy),
    ["presentable-hole", "filled", "withdrawn", "empty"]
  );
});

test("revoke after Graduation keeps the private occupant withdrawn; no replacement is sought", () => {
  const graph = graphReadyToGraduate({ outcomeClass: "proven-repair", at: at(2) });
  const graduated = graduate(graph, { initiator: "operator", at: at(9) });
  assert.equal(graduated.ok, true);
  const revoked = revoke([graduated.projection], { initiator: "operator", at: at(10) });
  assert.equal(revoked.ok, true);
  assert.equal(revoked.withdrawn[0].identity.consentState, "sealed");
  assert.equal(revoked.withdrawn[0].withdrawnAt, at(10));
  assert.equal(graph.identity.consentState, "private");

  const later = optIn({ outcomeClass: "proven-repair", at: at(11) }).graph;
  const slots = programSlots({
    runs: [graph, later],
    projections: revoked.withdrawn,
  });
  assert.equal(slots[1].occupancy, "withdrawn");
  assert.equal(slots[1].occupant.sourceRunId, graph.identity.sourceRunId);
  assert.notEqual(slots[1].occupant.sourceRunId, later.identity.sourceRunId);

  const aiRevoke = revoke([graduated.projection], { initiator: "ai", at: at(12) });
  assert.equal(aiRevoke.ok, false);
  assert.equal(aiRevoke.code, "OPERATOR_CONSENT_REQUIRED");
});

test("re-Graduation of a withdrawn occupant mints a new version; audience stays withdrawn until then", () => {
  const graph = graphReadyToGraduate({ outcomeClass: "proven-repair", at: at(2) });
  const first = graduate(graph, { initiator: "operator", at: at(9) });
  assert.equal(first.ok, true);
  const revoked = revoke([first.projection], { initiator: "operator", at: at(10) });
  assert.equal(revoked.ok, true);

  assert.equal(
    programSlots({ runs: [graph], projections: revoked.withdrawn })[1].occupancy,
    "withdrawn"
  );

  const vetoed = graduate(graph, {
    initiator: "operator",
    at: at(11),
    effectCapability: "enabled",
    previousProjections: revoked.withdrawn,
  });
  assert.equal(vetoed.ok, false);
  assert.equal(vetoed.code, "PROJECTION_NOT_EFFECT_DISABLED");
  assert.equal(
    programSlots({ runs: [graph], projections: revoked.withdrawn })[1].occupancy,
    "withdrawn"
  );

  const again = graduate(graph, {
    initiator: "operator",
    at: at(12),
    previousProjections: revoked.withdrawn,
  });
  assert.equal(again.ok, true);
  assert.equal(again.projection.identity.projectionVersion, 2);
  assert.equal(again.projection.identity.sourceRunId, graph.identity.sourceRunId);
  assert.equal(again.withdrawn.length, 0);

  const stillWithdrawn = programSlots({
    runs: [graph],
    projections: revoked.withdrawn,
  });
  assert.equal(stillWithdrawn[1].occupancy, "withdrawn");

  const restored = programSlots({
    runs: [graph],
    projections: [...revoked.withdrawn, again.projection],
  });
  assert.equal(restored[1].occupancy, "filled");
  assert.equal(restored[1].occupant.projectionVersion, 2);
});

test("deleting a non-Graduated occupant vacates the slot; extra runs stay outside the program", () => {
  const occupant = optIn({ outcomeClass: "controlled-service-change", at: at(2) }).graph;
  const extra = optIn({ destination: "Private work outside the program", at: at(3) }).graph;
  const before = programSlots({ runs: [occupant, extra], projections: [] });
  assert.equal(before[3].occupancy, "presentable-hole");
  assert.equal(before[3].occupant.sourceRunId, occupant.identity.sourceRunId);

  const afterDelete = programSlots({ runs: [extra], projections: [] });
  assert.equal(afterDelete[3].occupancy, "empty");
  assert.equal(afterDelete[3].occupant, null);
  assert.equal(extra.identity.sourceRunId === occupant.identity.sourceRunId, false);
});

test("deleting a Graduated private graph leaves projection occupancy standing and claim-supporting", () => {
  const graph = graphReadyToGraduate({ outcomeClass: "controlled-service-change" });
  const result = graduate(graph, { initiator: "operator", at: at(9) });
  assert.equal(result.ok, true);
  const claim = result.projection.events.find((event) => event.kind === "claim");

  const afterDelete = programSlots({ runs: [], projections: [result.projection] });
  assert.equal(afterDelete[3].occupancy, "filled");
  assert.equal(afterDelete[3].occupant.sourceRunId, graph.identity.sourceRunId);
  assert.equal(claimSupport(result.projection, claim.nodeId), "supported");
});

test("deleting a Graduated occupant does not let a later run take the slot", () => {
  const first = graphReadyToGraduate({ outcomeClass: "proven-repair", at: at(2) });
  const later = optIn({ outcomeClass: "proven-repair", at: at(3) }).graph;
  const graduated = graduate(first, { initiator: "operator", at: at(20) });
  assert.equal(graduated.ok, true);

  const afterDelete = programSlots({
    runs: [later],
    projections: [graduated.projection],
  });
  assert.equal(afterDelete[1].occupancy, "filled");
  assert.equal(afterDelete[1].occupant.sourceRunId, first.identity.sourceRunId);
  assert.notEqual(afterDelete[1].occupant.sourceRunId, later.identity.sourceRunId);
});
