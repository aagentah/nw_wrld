const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  startCapture,
  applyEvent,
  claimSupport,
  exhibitOverview,
  inspectNode,
  previewGraduation,
  graduate,
} = require(path.join(__dirname, "..", "dist", "runtime", "shared", "observatory", "contract.js"));

const at = (n) => new Date(Date.UTC(2026, 7, 27, 14, 0, n)).toISOString();

const optIn = (destination = "Prove a private run can graduate") =>
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

const endRun = (graph) =>
  emit(graph, { kind: "run_end", actor: "source", summary: "Instrumented source run ended" }).graph;

function graphWithPrivatePathClaim() {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "artifact",
    actor: "source",
    summary: "Repair log",
    payload: { path: "/home/joe/Projects/nw_wrld/src/foo.ts", note: "null-check applied" },
  }).graph;
  const artifact = g.events.find((event) => event.kind === "artifact");
  g = emit(g, {
    kind: "claim",
    actor: "operator",
    summary: "The repair is proven",
    central: true,
    supports: [artifact.nodeId],
  }).graph;
  g = emit(g, { kind: "outcome", actor: "operator", summary: "Repair holds" }).graph;
  return endRun(g);
}

function graphReadyToGraduate() {
  let g = runStart(optIn().graph).graph;
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

test("preview class-withholds private-only material as typed nodes and downgrades claims", () => {
  const graph = graphWithPrivatePathClaim();
  const artifact = graph.events.find((event) => event.kind === "artifact");
  const claim = graph.events.find((event) => event.kind === "claim");
  assert.equal(claimSupport(graph, claim.nodeId), "supported");

  const preview = previewGraduation(graph);
  const withheld = preview.projection.events.find((event) => event.kind === "withheld");
  const projectedArtifact = preview.projection.events.find(
    (event) => event.nodeId === artifact.nodeId
  );

  assert.equal(withheld.disclosure.kind, "withheld");
  assert.equal(withheld.disclosure.class, "local-path");
  assert.equal(typeof withheld.disclosure.reason, "string");
  assert.ok(withheld.disclosure.reason.length > 0);
  assert.equal(withheld.disclosure.sourceNodeId, artifact.nodeId);
  assert.deepEqual(withheld.disclosure.affectedClaimIds, [claim.nodeId]);
  assert.equal(projectedArtifact.payload.path.withheld, true);
  assert.equal(projectedArtifact.payload.note, "null-check applied");
  assert.equal(claimSupport(preview.projection, claim.nodeId), "unverified");
  assert.deepEqual(
    preview.report.downgrades.map((row) => [row.claimId, row.before, row.after]),
    [[claim.nodeId, "supported", "unverified"]]
  );
  assert.equal(preview.report.provenanceMode, "sanitized");
  assert.equal(preview.report.effectCapability, "disabled");
  assert.equal(preview.report.presentableClaim, "recorded-playback");
  assert.deepEqual(preview.report.restorableNodeIds, [artifact.nodeId]);
  assert.equal(preview.projection.identity.sourceRunId, graph.identity.sourceRunId);
  assert.equal(preview.projection.identity.exhibitId, graph.identity.exhibitId);
  assert.equal(preview.projection.identity.effectCapability, "disabled");
  assert.equal(preview.projection.identity.presentableClaim, "recorded-playback");
  assert.equal(preview.projection.identity.provenanceMode, "sanitized");
  assert.equal(graph.identity.consentState, "private");
});

test("operator may restore a private-only payload, narrow a claim, or abort", () => {
  const graph = graphWithPrivatePathClaim();
  const artifact = graph.events.find((event) => event.kind === "artifact");
  const claim = graph.events.find((event) => event.kind === "claim");

  const restored = previewGraduation(graph, { restoreNodeIds: [artifact.nodeId] });
  assert.equal(
    restored.projection.events.find((event) => event.nodeId === artifact.nodeId).payload.path,
    "/home/joe/Projects/nw_wrld/src/foo.ts"
  );
  assert.equal(claimSupport(restored.projection, claim.nodeId), "supported");
  assert.equal(restored.report.vetoes.includes("CENTRAL_CLAIM_UNSUPPORTED"), false);
  assert.equal(
    restored.projection.events.some((event) => event.kind === "withheld"),
    false
  );

  const narrowed = previewGraduation(graph, { narrowedClaimIds: [claim.nodeId] });
  const projectedClaim = narrowed.projection.events.find((event) => event.nodeId === claim.nodeId);
  assert.equal(projectedClaim.central, undefined);
  assert.equal(narrowed.report.vetoes.includes("CENTRAL_CLAIM_UNSUPPORTED"), false);

  const aborted = graduate(graph, { initiator: "operator", at: at(9), abort: true });
  assert.equal(aborted.ok, false);
  assert.equal(aborted.code, "GRADUATION_ABORTED");
});

test("never-persist values cannot be restored and the AI cannot Graduate", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "tool_observed",
    actor: "source",
    summary: "Fetched with token",
    payload: { api_token: "sk-live-secret", passing: true },
  }).graph;
  const tool = g.events.find((event) => event.kind === "tool_observed");
  const withheld = g.events.find((event) => event.kind === "withheld_at_capture");
  g = emit(g, {
    kind: "claim",
    actor: "operator",
    summary: "Observed result",
    central: true,
    supports: [tool.nodeId],
  }).graph;
  g = emit(g, { kind: "outcome", actor: "operator", summary: "Done" }).graph;
  g = endRun(g);

  assert.equal(tool.payload.api_token.withheldAtCapture, true);
  const refusedRestore = graduate(g, {
    initiator: "operator",
    at: at(9),
    restoreNodeIds: [withheld.nodeId],
  });
  assert.equal(refusedRestore.ok, false);
  assert.equal(refusedRestore.code, "NEVER_PERSIST_UNRESTORABLE");

  const refusedAi = graduate(g, { initiator: "ai:implementer", at: at(9) });
  assert.equal(refusedAi.ok, false);
  assert.equal(refusedAi.code, "OPERATOR_CONSENT_REQUIRED");
  assert.equal("projection" in refusedAi, false);
});

test("each mechanical Seal veto blocks Graduation with no waiver; aesthetic fit is excluded", () => {
  const privatePath = graphWithPrivatePathClaim();
  const unsupported = graduate(privatePath, { initiator: "operator", at: at(9) });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.code, "CENTRAL_CLAIM_UNSUPPORTED");
  assert.deepEqual(unsupported.vetoes, ["CENTRAL_CLAIM_UNSUPPORTED"]);

  const ready = graphReadyToGraduate();
  const enabled = graduate(ready, {
    initiator: "operator",
    at: at(9),
    effectCapability: "enabled",
  });
  assert.equal(enabled.ok, false);
  assert.equal(enabled.code, "PROJECTION_NOT_EFFECT_DISABLED");

  const incomplete = graduate(runStart(optIn().graph).graph, {
    initiator: "operator",
    at: at(9),
  });
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.code, "PRIVATE_CHAIN_INCOMPLETE");

  const inspectDenied = graduate(ready, {
    initiator: "operator",
    at: at(9),
    privateChainInspectable: false,
  });
  assert.equal(inspectDenied.ok, false);
  assert.equal(inspectDenied.code, "PRIVATE_CHAIN_INCOMPLETE");

  const legal = graduate(ready, {
    initiator: "operator",
    at: at(9),
    legalOrThirdPartyConstraint: true,
  });
  assert.equal(legal.ok, false);
  assert.equal(legal.code, "LEGAL_OR_THIRD_PARTY_CONSTRAINT");

  const poisoned = {
    ...ready,
    events: ready.events.map((event) =>
      event.kind === "artifact" ? { ...event, payload: { api_token: "sk-live-unpurged" } } : event
    ),
  };
  const unpurged = graduate(poisoned, { initiator: "operator", at: at(9) });
  assert.equal(unpurged.ok, false);
  assert.equal(unpurged.code, "NEVER_PERSIST_UNPURGED");

  const aesthetic = graduate(ready, {
    initiator: "operator",
    at: at(9),
    aestheticFit: false,
  });
  assert.equal(aesthetic.ok, true);
  assert.equal(aesthetic.projection.identity.effectCapability, "disabled");
  assert.equal(aesthetic.projection.identity.presentableClaim, "recorded-playback");
  assert.deepEqual(aesthetic.report.vetoes, []);
});

test("projections are immutable versions under the same source-run identity", () => {
  const graph = graphReadyToGraduate();
  const first = graduate(graph, { initiator: "operator", at: at(9) });
  assert.equal(first.ok, true);
  const firstId = first.projection.identity.projectionId;

  const second = graduate(graph, {
    initiator: "operator",
    at: at(10),
    previousProjections: [first.projection],
    narrowedClaimIds: [graph.events.find((event) => event.kind === "claim").nodeId],
  });
  assert.equal(second.ok, true);
  assert.equal(second.projection.identity.sourceRunId, graph.identity.sourceRunId);
  assert.equal(second.projection.identity.exhibitId, graph.identity.exhibitId);
  assert.equal(second.projection.identity.projectionVersion, 2);
  assert.notEqual(second.projection.identity.projectionId, firstId);
  assert.equal(first.projection.identity.projectionVersion, 1);
  assert.equal(first.projection.withdrawnAt, null);
  assert.equal(second.withdrawn.length, 1);
  assert.equal(second.withdrawn[0].identity.projectionId, firstId);
  assert.equal(second.withdrawn[0].identity.consentState, "sealed");
  assert.equal(second.withdrawn[0].withdrawnAt, at(10));
  assert.equal(first.projection.identity.consentState, "presentable");
});

test("withheld payloads read sanitized; substitutions read simulated; mixed overview is simulated", () => {
  const graph = graphWithPrivatePathClaim();
  const sanitized = previewGraduation(graph);
  assert.equal(sanitized.report.provenanceMode, "sanitized");
  assert.equal(sanitized.projection.identity.provenanceMode, "sanitized");
  const withheldNode = sanitized.projection.events.find((event) => event.kind === "withheld");
  assert.equal(inspectNode(sanitized.projection, withheldNode.nodeId).ok, true);

  const presentable = graphReadyToGraduate();
  const presentableArtifact = presentable.events.find((event) => event.kind === "artifact");
  const simulatedOnce = previewGraduation(presentable, {
    substitutions: [
      {
        sourceNodeId: presentableArtifact.nodeId,
        summary: "Stand-in passing reproduction",
        reason: "replaced tool behavior with a stand-in",
      },
    ],
  });
  assert.equal(simulatedOnce.report.provenanceMode, "simulated");
  const substitutionNode = simulatedOnce.projection.events.find(
    (event) => event.kind === "substitution"
  );
  assert.equal(inspectNode(simulatedOnce.projection, substitutionNode.nodeId).ok, true);

  let mixedGraph = runStart(optIn().graph).graph;
  mixedGraph = emit(mixedGraph, {
    kind: "artifact",
    actor: "source",
    summary: "Repair log",
    payload: { path: "/home/joe/Projects/nw_wrld/src/foo.ts" },
  }).graph;
  mixedGraph = emit(mixedGraph, {
    kind: "tool_observed",
    actor: "source",
    summary: "Passing reproduction",
    payload: { passing: true },
  }).graph;
  const mixedTool = mixedGraph.events.find((event) => event.kind === "tool_observed");
  mixedGraph = emit(mixedGraph, {
    kind: "claim",
    actor: "operator",
    summary: "Repair holds",
    central: true,
    supports: [mixedTool.nodeId],
  }).graph;
  mixedGraph = emit(mixedGraph, { kind: "outcome", actor: "operator", summary: "Done" }).graph;
  mixedGraph = endRun(mixedGraph);

  const mixed = previewGraduation(mixedGraph, {
    substitutions: [
      {
        sourceNodeId: mixedTool.nodeId,
        summary: "Stand-in passing reproduction",
        reason: "replaced tool behavior with a stand-in",
      },
    ],
  });
  assert.equal(mixed.report.provenanceMode, "simulated");
  assert.equal(exhibitOverview(mixed.projection).provenanceMode, "simulated");
  assert.equal(
    mixed.projection.events.some((event) => event.kind === "withheld"),
    true
  );
  assert.equal(
    mixed.projection.events.some((event) => event.kind === "substitution"),
    true
  );
  assert.equal(
    inspectNode(
      mixed.projection,
      mixed.projection.events.find((event) => event.kind === "withheld").nodeId
    ).ok,
    true
  );
  assert.equal(
    inspectNode(
      mixed.projection,
      mixed.projection.events.find((event) => event.kind === "substitution").nodeId
    ).ok,
    true
  );
});

test("operator or curator attestation cannot preserve unearned support", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "artifact",
    actor: "source",
    summary: "Private log",
    payload: { path: "/home/joe/secret.log" },
  }).graph;
  const artifact = g.events.find((event) => event.kind === "artifact");
  g = emit(g, {
    kind: "move",
    actor: "curator",
    summary: "Attest the repair still holds",
    evidenceKind: "curator-derived",
  }).graph;
  const attestation = g.events.find((event) => event.actor === "curator");
  g = emit(g, {
    kind: "claim",
    actor: "operator",
    summary: "Repair is proven",
    central: true,
    supports: [artifact.nodeId, attestation.nodeId],
  }).graph;
  g = emit(g, { kind: "outcome", actor: "operator", summary: "Done" }).graph;
  g = endRun(g);

  const claim = g.events.find((event) => event.kind === "claim");
  assert.equal(claimSupport(g, claim.nodeId), "partial");
  const preview = previewGraduation(g);
  assert.equal(claimSupport(preview.projection, claim.nodeId), "unverified");
  assert.equal(preview.report.downgrades[0].after, "unverified");
});

test("camelCase identifier keys are class-withheld from the projection", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "artifact",
    actor: "source",
    summary: "Account record",
    payload: { userId: "customer-42", note: "presentable" },
  }).graph;
  const artifact = g.events.find((event) => event.kind === "artifact");
  g = emit(g, {
    kind: "claim",
    actor: "operator",
    summary: "Account observed",
    central: true,
    supports: [artifact.nodeId],
  }).graph;
  g = emit(g, { kind: "outcome", actor: "operator", summary: "Done" }).graph;
  g = endRun(g);

  const preview = previewGraduation(g);
  const projected = preview.projection.events.find((event) => event.nodeId === artifact.nodeId);
  assert.equal(projected.payload.userId.withheld, true);
  assert.equal(projected.payload.userId.class, "identifier");
  assert.equal(projected.payload.note, "presentable");
  assert.equal(preview.report.provenanceMode, "sanitized");
});

test("private repo excerpts and multi-class payloads each get typed withheld nodes", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "artifact",
    actor: "source",
    summary: "Private source",
    payload: {
      excerpt: "const secretLocal = true;",
      path: "/home/joe/Projects/nw_wrld/src/foo.ts",
      diff: "- broken\n+ fixed",
    },
  }).graph;
  const artifact = g.events.find((event) => event.kind === "artifact");
  g = emit(g, { kind: "outcome", actor: "operator", summary: "Done" }).graph;
  g = endRun(g);

  const preview = previewGraduation(g);
  const projected = preview.projection.events.find((event) => event.nodeId === artifact.nodeId);
  assert.equal(projected.payload.excerpt.withheld, true);
  assert.equal(projected.payload.excerpt.class, "private-repo");
  const classes = preview.projection.events
    .filter((event) => event.kind === "withheld")
    .map((event) => event.disclosure.class)
    .sort();
  assert.deepEqual(classes, ["local-path", "private-repo"]);
});

test("withholding contradictory evidence cannot strengthen a claim", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "artifact",
    actor: "source",
    summary: "Passing log",
    payload: { passing: true },
  }).graph;
  const passing = g.events.find((event) => event.summary === "Passing log");
  g = emit(g, {
    kind: "artifact",
    actor: "source",
    summary: "Failing private log",
    payload: { path: "/home/joe/fail.log" },
  }).graph;
  const failing = g.events.find((event) => event.summary === "Failing private log");
  g = emit(g, {
    kind: "claim",
    actor: "operator",
    summary: "Fix holds",
    central: true,
    supports: [passing.nodeId],
    contradicts: [failing.nodeId],
  }).graph;
  g = emit(g, { kind: "outcome", actor: "operator", summary: "Done" }).graph;
  g = endRun(g);

  const claim = g.events.find((event) => event.kind === "claim");
  assert.equal(claimSupport(g, claim.nodeId), "contradicted");
  const preview = previewGraduation(g);
  assert.equal(claimSupport(preview.projection, claim.nodeId), "contradicted");
});

test("operator attestation moves cannot preserve unearned support", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "artifact",
    actor: "source",
    summary: "Private log",
    payload: { path: "/home/joe/secret.log" },
  }).graph;
  const artifact = g.events.find((event) => event.kind === "artifact");
  g = emit(g, {
    kind: "move",
    actor: "operator",
    summary: "I attest the repair still holds",
  }).graph;
  const attestation = g.events.find((event) => event.kind === "move");
  g = emit(g, {
    kind: "claim",
    actor: "operator",
    summary: "Repair is proven",
    central: true,
    supports: [artifact.nodeId, attestation.nodeId],
  }).graph;
  g = emit(g, { kind: "outcome", actor: "operator", summary: "Done" }).graph;
  g = endRun(g);

  const claim = g.events.find((event) => event.kind === "claim");
  assert.equal(claimSupport(g, claim.nodeId), "partial");
  const preview = previewGraduation(g);
  assert.equal(claimSupport(preview.projection, claim.nodeId), "unverified");
});
