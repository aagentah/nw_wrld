const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  OBSERVATORY_CONTRACT_VERSION,
  startCapture,
  applyEvent,
  claimSupport,
  effectChains,
  inspectNode,
  resolveLink,
  exhibitOverview,
} = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "observatory", "contract.js")
);


const at = (n) => new Date(Date.UTC(2026, 7, 27, 12, 0, n)).toISOString();

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


test("provenance mode and effect capability are separate identity facts", () => {
  const started = optIn();
  assert.equal(started.ok, true);
  const { identity } = started.graph;
  assert.equal(identity.contractVersion, OBSERVATORY_CONTRACT_VERSION);
  assert.equal(identity.provenanceMode, "authentic live");
  assert.equal(identity.effectCapability, "approval-gated");
  assert.notEqual(identity.provenanceMode, identity.effectCapability);
  assert.equal(Object.prototype.hasOwnProperty.call(identity, "replay"), false);
});

test("every captured event is typed source-observed, human-declared, ai-declared, or curator-derived", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, { kind: "move", actor: "ai:scout", summary: "Formed hypothesis" }).graph;
  g = emit(g, { kind: "approval_resolved", actor: "operator", summary: "Approved write" }).graph;
  g = emit(g, {
    kind: "move",
    actor: "curator",
    summary: "Grouped mechanical reads",
    evidenceKind: "curator-derived",
  }).graph;
  g = emit(g, {
    kind: "tool_attempt",
    actor: "ai:scout",
    summary: "Read with token",
    payload: { api_token: "sk-live-typed" },
  }).graph;

  assert.equal(
    g.events.find((e) => e.kind === "run_start").evidenceKind,
    "source-observed"
  );
  assert.equal(g.events.find((e) => e.actor === "ai:scout").evidenceKind, "ai-declared");
  assert.equal(
    g.events.find((e) => e.kind === "approval_resolved").evidenceKind,
    "human-declared"
  );
  assert.equal(
    g.events.find((e) => e.actor === "curator").evidenceKind,
    "curator-derived"
  );
  assert.equal(
    g.events.find((e) => e.kind === "withheld_at_capture").evidenceKind,
    "source-observed"
  );
  assert.ok(
    g.events.every((e) =>
      ["source-observed", "human-declared", "ai-declared", "curator-derived"].includes(
        e.evidenceKind
      )
    )
  );
});

test("central claims carry supported, partial, unverified, or contradicted", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "tool_observed",
    actor: "source",
    summary: "Failing reproduction",
  }).graph;
  const failing = g.events.find((e) => e.kind === "tool_observed");
  g = emit(g, {
    kind: "tool_observed",
    actor: "source",
    summary: "Passing reproduction",
  }).graph;
  const passing = g.events.find((e) => e.summary === "Passing reproduction");
  g = emit(g, {
    kind: "tool_observed",
    actor: "source",
    summary: "Still failing after claimed fix",
  }).graph;
  const stillFailing = g.events.find((e) => e.summary === "Still failing after claimed fix");

  g = emit(g, {
    kind: "claim",
    actor: "ai:implementer",
    summary: "Unverified cause",
    central: true,
  }).graph;
  const unverified = g.events.find((e) => e.summary === "Unverified cause");

  g = emit(g, {
    kind: "claim",
    actor: "ai:implementer",
    summary: "Cause is the missing null check",
    central: true,
    supports: [failing.nodeId, passing.nodeId],
  }).graph;
  const supported = g.events.find((e) => e.summary === "Cause is the missing null check");

  g = emit(g, {
    kind: "claim",
    actor: "operator",
    summary: "Partial repair evidence",
    central: true,
    supports: [failing.nodeId, "n-missing-evidence"],
  }).graph;
  const partial = g.events.find((e) => e.summary === "Partial repair evidence");

  g = emit(g, {
    kind: "claim",
    actor: "ai:implementer",
    summary: "Fix holds",
    central: true,
    supports: [passing.nodeId],
    contradicts: [stillFailing.nodeId],
  }).graph;
  const contradicted = g.events.find((e) => e.summary === "Fix holds");

  assert.equal(unverified.kind, "claim");
  assert.equal(unverified.central, true);
  assert.equal(claimSupport(g, unverified.nodeId), "unverified");
  assert.equal(claimSupport(g, supported.nodeId), "supported");
  assert.equal(claimSupport(g, partial.nodeId), "partial");
  assert.equal(claimSupport(g, contradicted.nodeId), "contradicted");
});

test("curator-derived nodes cannot raise claim support", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "move",
    actor: "curator",
    summary: "Grouped the repair as a success story",
    evidenceKind: "curator-derived",
  }).graph;
  const curated = g.events.find((e) => e.evidenceKind === "curator-derived");
  g = emit(g, {
    kind: "tool_observed",
    actor: "source",
    summary: "Failing reproduction",
  }).graph;
  const observed = g.events.find((e) => e.kind === "tool_observed");

  g = emit(g, {
    kind: "claim",
    actor: "curator",
    summary: "Attested success",
    evidenceKind: "curator-derived",
    central: true,
    supports: [curated.nodeId],
  }).graph;
  const attested = g.events.find((e) => e.summary === "Attested success");

  g = emit(g, {
    kind: "claim",
    actor: "ai:implementer",
    summary: "Cause identified",
    central: true,
    supports: [curated.nodeId, observed.nodeId],
  }).graph;
  const mixed = g.events.find((e) => e.summary === "Cause identified");

  assert.equal(claimSupport(g, attested.nodeId), "unverified");
  assert.equal(claimSupport(g, mixed.nodeId), "partial");
});

test("material effect chains keep six distinct stages", () => {
  let g = runStart(optIn().graph).graph;
  const chainId = "write-mod-ts";
  const stages = [
    { kind: "capability_request", actor: "ai:implementer", summary: "Requested write" },
    { kind: "scope_granted", actor: "operator", summary: "Granted workspace write" },
    { kind: "approval_request", actor: "ai:implementer", summary: "Proposed patch" },
    {
      kind: "approval_resolved",
      actor: "operator",
      summary: "Approved patch",
      disposition: "approved",
    },
    { kind: "tool_attempt", actor: "ai:implementer", summary: "Wrote patch" },
    { kind: "tool_observed", actor: "source", summary: "Write ok" },
  ];
  for (const stage of stages) {
    const result = emit(g, { ...stage, chainId });
    assert.equal(result.ok, true, stage.summary);
    g = result.graph;
  }

  const chains = effectChains(g);
  assert.equal(chains.length, 1);
  assert.equal(chains[0].chainId, chainId);
  assert.equal(chains[0].nonResult, false);
  assert.deepEqual(
    chains[0].stages.map((stage) => [stage.kind, stage.status]),
    [
      ["requested-capability", "present"],
      ["granted-scope", "present"],
      ["proposal", "present"],
      ["approval-or-rejection", "present"],
      ["attempt", "present"],
      ["observed-effect", "present"],
    ]
  );
  assert.ok(chains[0].stages.every((stage) => typeof stage.nodeId === "string" && stage.nodeId));
});

test("missing, rejected, failed, and unobserved stages stay explicit as non-results", () => {
  let g = runStart(optIn().graph).graph;

  g = emit(g, {
    kind: "approval_request",
    actor: "ai:implementer",
    summary: "Proposed external deploy",
    chainId: "rejected-deploy",
  }).graph;
  g = emit(g, {
    kind: "approval_resolved",
    actor: "operator",
    summary: "Rejected deploy",
    chainId: "rejected-deploy",
    disposition: "rejected",
  }).graph;

  g = emit(g, {
    kind: "tool_attempt",
    actor: "ai:implementer",
    summary: "Write that failed",
    chainId: "failed-write",
    disposition: "failed",
  }).graph;

  g = emit(g, {
    kind: "capability_request",
    actor: "ai:scout",
    summary: "Requested network",
    chainId: "abandoned-probe",
    disposition: "abandoned",
  }).graph;

  const chains = effectChains(g);
  const byId = Object.fromEntries(chains.map((chain) => [chain.chainId, chain]));

  const rejected = Object.fromEntries(
    byId["rejected-deploy"].stages.map((stage) => [stage.kind, stage.status])
  );
  assert.equal(rejected["proposal"], "present");
  assert.equal(rejected["approval-or-rejection"], "rejected");
  assert.equal(rejected["requested-capability"], "missing");
  assert.equal(rejected["attempt"], "missing");
  assert.equal(byId["rejected-deploy"].nonResult, true);

  const failed = Object.fromEntries(
    byId["failed-write"].stages.map((stage) => [stage.kind, stage.status])
  );
  assert.equal(failed.attempt, "failed");
  assert.equal(failed["observed-effect"], "unobserved");
  assert.equal(byId["failed-write"].nonResult, true);

  assert.equal(byId["abandoned-probe"].nonResult, true);
  assert.equal(
    byId["abandoned-probe"].stages.find((stage) => stage.kind === "requested-capability").status,
    "present"
  );
  const overviewGates = Object.fromEntries(
    exhibitOverview(g).effectGateStatus.map((gate) => [gate.chainId, gate.nonResult])
  );
  assert.equal(overviewGates["rejected-deploy"], true);
  assert.equal(overviewGates["failed-write"], true);
  assert.equal(overviewGates["abandoned-probe"], true);
});

test("reliance limits attach at the claim or move where reliance occurs", () => {
  let g = runStart(optIn("Repair the failing build").graph).graph;
  g = emit(g, {
    kind: "move",
    actor: "ai:implementer",
    summary: "Applied remedy",
    relianceLimits: [{ kind: "scope-bounds", summary: "Patch is limited to mod.ts" }],
  }).graph;
  const move = g.events.find((e) => e.kind === "move");
  g = emit(g, {
    kind: "claim",
    actor: "ai:implementer",
    summary: "Cause is the missing null check",
    central: true,
    supports: [move.nodeId],
    relianceLimits: [{ kind: "uncertainty", summary: "Single reproduction only" }],
  }).graph;
  const claim = g.events.find((e) => e.kind === "claim");

  const inspectedClaim = inspectNode(g, claim.nodeId);
  const inspectedMove = inspectNode(g, move.nodeId);

  assert.deepEqual(inspectedClaim.relianceLimits, [
    { kind: "uncertainty", summary: "Single reproduction only" },
  ]);
  assert.deepEqual(inspectedMove.relianceLimits, [
    { kind: "scope-bounds", summary: "Patch is limited to mod.ts" },
  ]);
  assert.equal(inspectNode(g, "missing").ok, false);
});

test("claim and evidence tracing is bidirectional and named links resolve", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "tool_observed",
    actor: "source",
    summary: "Failing reproduction",
  }).graph;
  const observed = g.events.find((e) => e.kind === "tool_observed");
  g = emit(g, {
    kind: "move",
    actor: "ai:implementer",
    summary: "Chose the null-check cause",
  }).graph;
  const decision = g.events.find((e) => e.kind === "move");
  g = emit(g, {
    kind: "claim",
    actor: "ai:implementer",
    summary: "Cause is the missing null check",
    central: true,
    supports: [observed.nodeId],
    links: [
      { kind: "wayfinder", label: "Cause decision", href: decision.nodeId },
      { kind: "source", label: "Source map", href: "map://repair" },
    ],
  }).graph;
  const claim = g.events.find((e) => e.kind === "claim");

  const fromClaim = inspectNode(g, claim.nodeId);
  assert.equal(fromClaim.ok, true);
  assert.deepEqual(
    fromClaim.traces.evidence.map((e) => e.nodeId),
    [observed.nodeId]
  );
  assert.deepEqual(fromClaim.traces.actors, ["ai:implementer", "source"]);
  assert.deepEqual(
    fromClaim.traces.sourceEvents.map((e) => e.nodeId),
    [observed.nodeId]
  );
  assert.deepEqual(
    fromClaim.traces.decisions.map((e) => e.nodeId),
    [decision.nodeId]
  );

  const fromEvidence = inspectNode(g, observed.nodeId);
  assert.deepEqual(
    fromEvidence.traces.claims.map((e) => e.nodeId),
    [claim.nodeId]
  );

  const wayfinder = resolveLink(g, {
    kind: "wayfinder",
    label: "Cause decision",
    href: decision.nodeId,
  });
  assert.equal(wayfinder.ok, true);
  assert.equal(wayfinder.item.nodeId, decision.nodeId);

  const source = resolveLink(g, {
    kind: "source",
    label: "Source map",
    href: "map://repair",
  });
  assert.equal(source.ok, true);
  assert.equal(source.link.href, "map://repair");

  assert.equal(resolveLink(g, { kind: "source", label: "", href: "" }).ok, false);
});

test("overview shows contract facts before drill-down", () => {
  let g = runStart(optIn("Repair the failing build").graph).graph;
  g = emit(g, {
    kind: "tool_observed",
    actor: "source",
    summary: "Build red on null deref",
  }).graph;
  const before = g.events.find((e) => e.kind === "tool_observed");
  g = emit(g, {
    kind: "capability_request",
    actor: "ai:implementer",
    summary: "Requested write",
    chainId: "write-fix",
  }).graph;
  g = emit(g, {
    kind: "scope_granted",
    actor: "operator",
    summary: "Granted workspace write",
    chainId: "write-fix",
  }).graph;
  g = emit(g, {
    kind: "approval_request",
    actor: "ai:implementer",
    summary: "Proposed patch",
    chainId: "write-fix",
  }).graph;
  g = emit(g, {
    kind: "approval_resolved",
    actor: "operator",
    summary: "Approved patch",
    chainId: "write-fix",
    disposition: "approved",
  }).graph;
  g = emit(g, {
    kind: "tool_attempt",
    actor: "ai:implementer",
    summary: "Wrote patch",
    chainId: "write-fix",
  }).graph;
  g = emit(g, {
    kind: "tool_observed",
    actor: "source",
    summary: "Write ok",
    chainId: "write-fix",
  }).graph;
  g = emit(g, {
    kind: "move",
    actor: "ai:implementer",
    summary: "Applied null-check remedy",
    relianceLimits: [{ kind: "scope-bounds", summary: "Limited to mod.ts" }],
  }).graph;
  const move = g.events.find((e) => e.kind === "move");
  g = emit(g, {
    kind: "claim",
    actor: "ai:implementer",
    summary: "Cause is the missing null check",
    central: true,
    supports: [before.nodeId, move.nodeId],
    relianceLimits: [{ kind: "uncertainty", summary: "Single reproduction" }],
  }).graph;
  const claim = g.events.find((e) => e.kind === "claim");
  g = emit(g, {
    kind: "outcome",
    actor: "operator",
    summary: "Build repaired",
  }).graph;

  const overview = exhibitOverview(g);
  assert.equal(overview.humanGoal, "Repair the failing build");
  assert.deepEqual(overview.result, {
    before: "Build red on null deref",
    after: "Build repaired",
  });
  assert.deepEqual(
    overview.materialAiContribution.map((item) => item.summary),
    ["Applied null-check remedy"]
  );
  assert.equal(overview.centralClaimSupport, "supported");
  assert.deepEqual(
    overview.effectGateStatus.map((gate) => [gate.chainId, gate.status]),
    [["write-fix", "present"]]
  );
  assert.deepEqual(
    overview.limitations.map((limit) => limit.kind).sort(),
    ["scope-bounds", "uncertainty"]
  );
  assert.equal(overview.provenanceMode, "authentic live");
  assert.equal(overview.effectCapability, "approval-gated");
  assert.equal(Object.prototype.hasOwnProperty.call(overview, "replay"), false);

  const kinds = new Set(overview.drillTargets.map((target) => target.kind));
  assert.deepEqual(
    [...kinds].sort(),
    ["actor", "claim", "effect", "limitation", "move", "result"].sort()
  );
  assert.ok(overview.drillTargets.some((target) => target.id === claim.nodeId));
  assert.ok(overview.drillTargets.some((target) => target.id === `actor:${move.actor}`));
});

test("drill-down keeps destination, outcome, provenance, and effect capability", () => {
  let g = runStart(optIn("Repair the failing build").graph).graph;
  g = emit(g, {
    kind: "move",
    actor: "ai:implementer",
    summary: "Applied remedy",
  }).graph;
  const move = g.events.find((e) => e.kind === "move");
  g = emit(g, {
    kind: "outcome",
    actor: "operator",
    summary: "Build repaired",
  }).graph;

  const beforeCapability = g.identity.effectCapability;
  const inspected = inspectNode(g, move.nodeId);
  assert.equal(inspected.ok, true);
  assert.deepEqual(inspected.orientation, {
    destination: "Repair the failing build",
    outcome: "Build repaired",
    provenanceMode: "authentic live",
    effectCapability: "approval-gated",
  });
  assert.equal(g.identity.effectCapability, beforeCapability);
  assert.equal(inspectNode(g, `actor:${move.actor}`).ok, true);
});

test("empty claim support arrays are omitted so graphs round-trip", () => {
  let g = runStart(optIn().graph).graph;
  g = emit(g, {
    kind: "claim",
    actor: "ai:implementer",
    summary: "Unverified without cited evidence",
    central: true,
    supports: [],
    contradicts: [],
  }).graph;
  const claim = g.events.find((e) => e.kind === "claim");
  assert.equal(Object.prototype.hasOwnProperty.call(claim, "supports"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(claim, "contradicts"), false);
  assert.equal(claimSupport(g, claim.nodeId), "unverified");
});
