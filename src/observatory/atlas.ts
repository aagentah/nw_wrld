import { claimSupport, exhibitOverview, inspectNode } from "../shared/observatory/contract";
import type {
  InspectedNode,
  ObservatoryEvent,
  ObservatoryState,
  PrivateEvidenceGraph,
} from "../shared/observatory/types";

export type ObservatoryBridge = NonNullable<
  NonNullable<typeof globalThis.nwWrldBridge>["observatory"]
>;

export type AtlasLocalState = {
  state: ObservatoryState | null;
  selectedRunId: string | null;
  selectedNodeId: string | null;
  lastPulseSeqByRun: Map<string, number>;
  emitterInFlight: boolean;
  statusLine: string;
};

export function renderAtlas(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState
): void {
  container.replaceChildren();

  if (localState.state === null) {
    renderLoadingAtlas(container, localState.statusLine);
    return;
  }
  const state = localState.state;
  const selectedRun = selectRun(state, localState);
  const inspected: InspectedNode =
    selectedRun && localState.selectedNodeId
      ? inspectNode(selectedRun, localState.selectedNodeId)
      : { ok: false };
  const selectedNode = inspected.ok ? inspected.item : null;

  container.append(
    buildHeader(state, selectedRun),
    buildBody(container, bridge, localState, selectedRun, inspected),
    buildChronology(container, bridge, localState, selectedRun, selectedNode),
    buildStatusLine(localState.statusLine)
  );
}

function renderLoadingAtlas(container: HTMLElement, statusLine: string): void {
  const header = document.createElement("header");
  header.id = "atlas-header";

  const heading = document.createElement("div");
  const brand = document.createElement("div");
  brand.className = "atlas-brand";
  brand.textContent = "OBSERVATORY · ROUTE ATLAS";
  const destination = document.createElement("div");
  destination.className = "atlas-destination";
  destination.dataset.testid = "destination";
  destination.textContent = "—";
  heading.append(brand, destination);

  const badge = document.createElement("div");
  badge.className = "atlas-badge";
  badge.textContent = "contract v— · private";
  header.append(heading, badge);

  const loading = document.createElement("section");
  loading.id = "spine";
  const text = document.createElement("div");
  text.className = "muted";
  text.textContent = "Loading private Route Atlas…";
  loading.append(text);

  container.append(header, loading, buildStatusLine(statusLine));
}

function buildHeader(
  state: ObservatoryState,
  selectedRun: PrivateEvidenceGraph | null
): HTMLElement {
  const header = document.createElement("header");
  header.id = "atlas-header";

  const heading = document.createElement("div");
  const brand = document.createElement("div");
  brand.className = "atlas-brand";
  brand.textContent = "OBSERVATORY · ROUTE ATLAS";

  const destination = document.createElement("div");
  destination.className = "atlas-destination";
  destination.dataset.testid = "destination";
  destination.textContent = selectedRun?.destination || "—";
  heading.append(brand, destination);

  const badge = document.createElement("div");
  badge.className = "atlas-badge";
  const runId = selectedRun ? ` · ${shortRunId(selectedRun.identity.sourceRunId)}` : "";
  badge.textContent = `contract v${state.contractVersion} · private${runId}`;

  const facts = document.createElement("div");
  facts.className = "atlas-facts";
  const provenance = document.createElement("div");
  provenance.dataset.testid = "provenance-mode";
  provenance.textContent = selectedRun
    ? `provenance: ${selectedRun.identity.provenanceMode}`
    : "provenance: —";
  const effect = document.createElement("div");
  effect.dataset.testid = "effect-capability";
  effect.textContent = selectedRun
    ? `effect: ${selectedRun.identity.effectCapability}`
    : "effect: —";
  facts.append(provenance, effect);

  header.append(heading, badge, facts);
  return header;
}

function buildBody(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  selectedRun: PrivateEvidenceGraph | null,
  inspected: InspectedNode
): HTMLElement {
  const body = document.createElement("div");
  body.className = "atlas-body";

  const main = document.createElement("main");
  main.className = "atlas-main";
  main.append(buildControls(container, bridge, localState, selectedRun));

  if (localState.state && localState.state.runs.length > 1) {
    main.append(buildRunSwitcher(container, bridge, localState, localState.state.runs));
  }

  if (selectedRun) {
    main.append(buildOverview(container, bridge, localState, selectedRun));
  }

  main.append(buildSpine(container, bridge, localState, selectedRun));
  body.append(main, buildInspector(selectedRun, inspected));
  return body;
}

function buildControls(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  selectedRun: PrivateEvidenceGraph | null
): HTMLElement {
  const controls = document.createElement("section");
  controls.id = "controls";

  if (selectedRun === null) {
    const destinationInput = document.createElement("input");
    destinationInput.id = "destination-input";
    destinationInput.type = "text";
    destinationInput.placeholder = "Destination — human goal source run";

    const optIn = document.createElement("button");
    optIn.type = "button";
    optIn.className = "action-button primary";
    optIn.dataset.testid = "opt-in";
    optIn.disabled = bridge?.startCapture === undefined;
    optIn.textContent = "OPT IN — START CAPTURE";
    optIn.addEventListener("click", () => {
      void startCapture(container, bridge, localState, destinationInput.value);
    });

    controls.append(destinationInput, optIn);
    return controls;
  }

  if (isRunEnded(selectedRun)) {
    const endedNote = document.createElement("span");
    endedNote.className = "muted";
    endedNote.textContent = "Run ended — read-only inspection";
    controls.append(endedNote);
    return controls;
  }

  const emitter = document.createElement("button");
  emitter.type = "button";
  emitter.className = "action-button";
  emitter.dataset.testid = "run-emitter";
  emitter.disabled = bridge?.runTestEmitter === undefined || localState.emitterInFlight;
  emitter.textContent = localState.emitterInFlight ? "RUNNING TEST EMITTER…" : "RUN TEST EMITTER";
  emitter.addEventListener("click", () => {
    void runTestEmitter(container, bridge, localState, selectedRun);
  });

  const outcomeInput = document.createElement("input");
  outcomeInput.id = "outcome-input";
  outcomeInput.type = "text";
  outcomeInput.placeholder = "Operator-owned outcome";

  const declareOutcome = document.createElement("button");
  declareOutcome.type = "button";
  declareOutcome.className = "action-button outcome";
  declareOutcome.dataset.testid = "declare-outcome";
  declareOutcome.disabled = bridge?.declareOutcome === undefined;
  declareOutcome.textContent = "DECLARE OUTCOME";
  declareOutcome.addEventListener("click", () => {
    void declareRunOutcome(container, bridge, localState, selectedRun, outcomeInput.value);
  });

  const endRun = document.createElement("button");
  endRun.type = "button";
  endRun.className = "action-button end";
  endRun.dataset.testid = "end-run";
  endRun.disabled = bridge?.endRun === undefined;
  endRun.textContent = "END RUN";
  endRun.addEventListener("click", () => {
    void endSourceRun(container, bridge, localState, selectedRun);
  });

  controls.append(emitter, outcomeInput, declareOutcome, endRun);
  return controls;
}

function buildRunSwitcher(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  runs: PrivateEvidenceGraph[]
): HTMLElement {
  const switcher = document.createElement("nav");
  switcher.className = "run-switcher";
  switcher.setAttribute("aria-label", "Captured source runs");

  for (const run of runs) {
    const runId = run.identity.sourceRunId;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = localState.selectedRunId === runId ? "is-selected" : "";
    chip.textContent = `${shortRunId(runId)} · ${isRunEnded(run) ? "ended" : "active"}`;
    chip.addEventListener("click", () => {
      localState.selectedRunId = runId;
      localState.selectedNodeId = null;
      renderAtlas(container, bridge, localState);
    });
    switcher.append(chip);
  }

  return switcher;
}

function buildOverview(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  selectedRun: PrivateEvidenceGraph
): HTMLElement {
  const overview = exhibitOverview(selectedRun);
  const section = document.createElement("section");
  section.id = "overview";
  section.dataset.testid = "overview";

  const heading = document.createElement("h2");
  heading.textContent = "OVERVIEW";
  section.append(heading);

  const facts = document.createElement("dl");
  facts.className = "overview-facts";
  const rows: Array<[string, string]> = [
    ["Human goal", overview.humanGoal],
    ["Before", overview.result.before ?? "unobserved"],
    ["After", overview.result.after ?? "not recorded"],
    [
      "Material AI contribution",
      overview.materialAiContribution.map((item) => item.summary).join(" · ") || "none",
    ],
    ["Central-claim support", overview.centralClaimSupport],
    [
      "Effect-gate status",
      overview.effectGateStatus.map((gate) => `${gate.chainId}: ${gate.status}`).join(" · ") ||
        "none",
    ],
    [
      "Limitations",
      overview.limitations.map((limit) => `${limit.kind}: ${limit.summary}`).join(" · ") || "none",
    ],
    ["Provenance mode", overview.provenanceMode],
    ["Effect capability", overview.effectCapability],
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    facts.append(dt, dd);
  }
  section.append(facts);

  const drills = document.createElement("div");
  drills.className = "overview-drills";
  for (const target of overview.drillTargets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `drill-target${
      localState.selectedNodeId === target.id ? " is-selected" : ""
    }`;
    button.dataset.testid = "drill-target";
    button.textContent = `${target.kind} · ${target.id}`;
    button.addEventListener("click", () => {
      localState.selectedNodeId = target.id;
      renderAtlas(container, bridge, localState);
    });
    drills.append(button);
  }
  section.append(drills);
  return section;
}

function buildSpine(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  selectedRun: PrivateEvidenceGraph | null
): HTMLElement {
  const spine = document.createElement("section");
  spine.id = "spine";

  if (selectedRun === null) {
    const emptyState = document.createElement("div");
    emptyState.className = "muted";
    emptyState.textContent = "No source run is currently captured. Operator opt-in is required.";
    spine.append(emptyState);
    return spine;
  }

  const previousPulseSeq = localState.lastPulseSeqByRun.get(selectedRun.identity.sourceRunId);
  let currentPulseSeq = previousPulseSeq ?? (selectedRun.events.length === 0 ? 0 : undefined);

  for (const event of selectedRun.events) {
    const node = buildSpineNode(
      container,
      bridge,
      localState,
      event,
      previousPulseSeq !== undefined && event.seq > previousPulseSeq
    );
    spine.append(node);
    currentPulseSeq = Math.max(currentPulseSeq ?? event.seq, event.seq);
  }

  if (currentPulseSeq !== undefined) {
    localState.lastPulseSeqByRun.set(selectedRun.identity.sourceRunId, currentPulseSeq);
  }

  const outcome = selectedRun.events.find((event) => event.kind === "outcome");
  if (!outcome && selectedRun.events.some((event) => event.kind === "run_start")) {
    spine.append(buildOutcomePlaceholder(isRunEnded(selectedRun)));
  }

  if (selectedRun.events.length === 0) {
    const waiting = document.createElement("div");
    waiting.className = "muted";
    waiting.textContent = "Capture authorized. Waiting for source-run evidence.";
    spine.append(waiting);
  }

  return spine;
}

function buildSpineNode(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  event: ObservatoryEvent,
  shouldPulse: boolean
): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.className = `spine-node${
    event.nodeId === localState.selectedNodeId ? " is-selected" : ""
  }${event.kind === "outcome" ? " outcome-node" : ""}${shouldPulse ? " node-pulse" : ""}`;
  node.dataset.testid = "spine-node";
  node.dataset.seq = String(event.seq);
  node.addEventListener("click", () => {
    localState.selectedNodeId = event.nodeId;
    renderAtlas(container, bridge, localState);
  });

  const chip = document.createElement("span");
  chip.className = `kind-chip kind-${event.kind}`;
  chip.textContent = event.kind;

  const actor = document.createElement("span");
  actor.className = "node-actor";
  actor.textContent = event.actor;

  const summary = document.createElement("span");
  summary.className = "node-summary";
  summary.textContent = event.summary;

  const timestamp = document.createElement("time");
  timestamp.className = "node-time";
  timestamp.dateTime = event.at;
  timestamp.textContent = event.at;

  node.append(chip, actor, summary, timestamp);

  if (event.kind === "outcome") {
    const outcome = document.createElement("span");
    outcome.className = "outcome-card";
    outcome.dataset.testid = "outcome-card";
    outcome.textContent = `OUTCOME — ${event.summary} (operator)`;
    node.append(outcome);
  }

  return node;
}

function buildOutcomePlaceholder(runEnded: boolean): HTMLElement {
  const placeholder = document.createElement("article");
  placeholder.className = `outcome-placeholder${runEnded ? " outcome-missing" : ""}`;
  placeholder.dataset.testid = "outcome-card";
  placeholder.textContent = runEnded
    ? "NO OUTCOME RECORDED"
    : "OUTCOME PENDING — operator declares";
  return placeholder;
}

function buildInspector(
  selectedRun: PrivateEvidenceGraph | null,
  inspected: InspectedNode
): HTMLElement {
  const inspector = document.createElement("aside");
  inspector.id = "inspector";
  inspector.dataset.testid = "inspector";

  const heading = document.createElement("h2");
  heading.textContent = "INSPECTOR";

  const breadcrumb = document.createElement("div");
  breadcrumb.className = "breadcrumb";
  breadcrumb.dataset.testid = "breadcrumb";
  breadcrumb.textContent = buildBreadcrumb(selectedRun, inspected);

  inspector.append(heading, breadcrumb);

  if (!inspected.ok) {
    const emptyState = document.createElement("div");
    emptyState.className = "muted";
    emptyState.textContent = "Select node on spine, chronology, or overview.";
    inspector.append(emptyState);
    return inspector;
  }

  const nodeTitle = document.createElement("div");
  nodeTitle.className = "inspector-node-title";
  nodeTitle.textContent = `EVIDENCE NODE #${inspected.item.seq} · ${inspected.item.evidenceKind}`;

  const support =
    inspected.item.kind === "claim" && selectedRun
      ? claimSupport(selectedRun, inspected.item.nodeId)
      : null;
  const facts = document.createElement("dl");
  facts.className = "inspector-facts";
  const rows: Array<[string, string]> = [
    ["Kind", inspected.item.kind],
    ["Evidence", inspected.item.evidenceKind],
    ["Actor", inspected.item.actor],
    ["Provenance mode", inspected.orientation.provenanceMode],
    ["Effect capability", inspected.orientation.effectCapability],
  ];
  if (support) rows.push(["Claim support", support]);
  if (inspected.relianceLimits.length) {
    rows.push([
      "Reliance limits",
      inspected.relianceLimits.map((limit) => `${limit.kind}: ${limit.summary}`).join(" · "),
    ]);
  }
  if (inspected.traces.evidence.length) {
    rows.push(["Evidence nodes", inspected.traces.evidence.map((event) => event.summary).join(" · ")]);
  }
  if (inspected.traces.claims.length) {
    rows.push(["Claims", inspected.traces.claims.map((event) => event.summary).join(" · ")]);
  }
  if (inspected.traces.links.length) {
    rows.push([
      "Links",
      inspected.traces.links.map((link) => `${link.kind}: ${link.label}`).join(" · "),
    ]);
  }
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    facts.append(dt, dd);
  }

  const detail = document.createElement("pre");
  detail.textContent = JSON.stringify(inspected.item, null, 2);
  inspector.append(nodeTitle, facts, detail);
  return inspector;
}

function buildChronology(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  selectedRun: PrivateEvidenceGraph | null,
  selectedNode: ObservatoryEvent | null
): HTMLElement {
  const chronology = document.createElement("section");
  chronology.id = "chronology";

  const heading = document.createElement("h2");
  heading.textContent = "CHRONOLOGY";
  chronology.append(heading);

  const strip = document.createElement("div");
  strip.className = "chrono-strip";

  if (selectedRun === null || selectedRun.events.length === 0) {
    const emptyState = document.createElement("span");
    emptyState.className = "muted";
    emptyState.textContent = "No evidence nodes available.";
    strip.append(emptyState);
  } else {
    for (const event of selectedRun.events) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `chrono-cell${event.nodeId === selectedNode?.nodeId ? " is-selected" : ""}`;
      cell.dataset.testid = "chrono-cell";
      cell.addEventListener("click", () => {
        localState.selectedNodeId = event.nodeId;
        renderAtlas(container, bridge, localState);
      });

      const sequence = document.createElement("span");
      sequence.className = "chrono-seq";
      sequence.textContent = `#${event.seq}`;

      const kind = document.createElement("span");
      kind.className = "chrono-kind";
      kind.textContent = event.kind;

      const summary = document.createElement("span");
      summary.className = "chrono-summary";
      summary.textContent = event.summary;

      cell.append(sequence, kind, summary);
      strip.append(cell);
    }
  }

  chronology.append(strip);
  return chronology;
}

function buildStatusLine(statusLine: string): HTMLElement {
  const status = document.createElement("footer");
  status.id = "status-line";
  status.textContent = statusLine || "Ready for operator inspection.";
  return status;
}

async function startCapture(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  destination: string
): Promise<void> {
  if (bridge?.startCapture === undefined) {
    localState.statusLine = "refused: OBSERVATORY_BRIDGE_UNAVAILABLE";
    renderAtlas(container, bridge, localState);
    return;
  }

  try {
    const result = await bridge.startCapture({ initiator: "operator", destination });
    if (result.ok) {
      localState.selectedRunId = result.graph.identity.sourceRunId;
      localState.selectedNodeId = null;
      localState.statusLine = `capture started: ${shortRunId(result.graph.identity.sourceRunId)}`;
      await refreshState(bridge, localState);
    } else {
      localState.statusLine = `refused: ${result.code}`;
    }
  } catch (error: unknown) {
    localState.statusLine = formatActionError(error);
  }

  renderAtlas(container, bridge, localState);
}

async function runTestEmitter(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  selectedRun: PrivateEvidenceGraph
): Promise<void> {
  if (bridge?.runTestEmitter === undefined) {
    localState.statusLine = "refused: OBSERVATORY_BRIDGE_UNAVAILABLE";
    renderAtlas(container, bridge, localState);
    return;
  }
  localState.emitterInFlight = true;
  renderAtlas(container, bridge, localState);

  try {
    const result = await bridge.runTestEmitter({
      sourceRunId: selectedRun.identity.sourceRunId,
    });
    localState.statusLine = result.ok ? "test emitter started" : `refused: ${result.code}`;
    if (result.ok) {
      let previousCount = -1;
      let stableTicks = 0;
      for (let i = 0; i < 40; i += 1) {
        await refreshState(bridge, localState);
        renderAtlas(container, bridge, localState);
        const count =
          localState.state?.runs.find(
            (run) => run.identity.sourceRunId === selectedRun.identity.sourceRunId
          )?.events.length ?? 0;
        if (count === previousCount) {
          stableTicks += 1;
          if (stableTicks >= 3 && count > 0) break;
        } else {
          stableTicks = 0;
          previousCount = count;
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 50);
        });
      }
    }
  } catch (error: unknown) {
    localState.statusLine = formatActionError(error);
  }

  localState.emitterInFlight = false;
  renderAtlas(container, bridge, localState);
}

async function declareRunOutcome(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  selectedRun: PrivateEvidenceGraph,
  outcome: string
): Promise<void> {
  if (bridge?.declareOutcome === undefined) {
    localState.statusLine = "refused: OBSERVATORY_BRIDGE_UNAVAILABLE";
    renderAtlas(container, bridge, localState);
    return;
  }

  try {
    const result = await bridge.declareOutcome({
      sourceRunId: selectedRun.identity.sourceRunId,
      outcome,
    });
    if (result.ok) {
      localState.selectedNodeId = result.event.nodeId;
      localState.statusLine = "outcome declared";
      await refreshState(bridge, localState);
    } else {
      localState.statusLine = `refused: ${result.code}`;
    }
  } catch (error: unknown) {
    localState.statusLine = formatActionError(error);
  }

  renderAtlas(container, bridge, localState);
}

async function endSourceRun(
  container: HTMLElement,
  bridge: ObservatoryBridge | undefined,
  localState: AtlasLocalState,
  selectedRun: PrivateEvidenceGraph
): Promise<void> {
  if (bridge?.endRun === undefined) {
    localState.statusLine = "refused: OBSERVATORY_BRIDGE_UNAVAILABLE";
    renderAtlas(container, bridge, localState);
    return;
  }

  try {
    const result = await bridge.endRun({
      sourceRunId: selectedRun.identity.sourceRunId,
    });
    if (result.ok) {
      localState.selectedNodeId = result.event.nodeId;
      localState.statusLine = "run ended";
      await refreshState(bridge, localState);
    } else {
      localState.statusLine = `refused: ${result.code}`;
    }
  } catch (error: unknown) {
    localState.statusLine = formatActionError(error);
  }

  renderAtlas(container, bridge, localState);
}

async function refreshState(bridge: ObservatoryBridge, localState: AtlasLocalState): Promise<void> {
  if (bridge.getState === undefined) {
    localState.statusLine = "refused: OBSERVATORY_BRIDGE_UNAVAILABLE";
    return;
  }
  const result = await bridge.getState();
  if (result.ok) {
    localState.state = result.state;
  } else {
    localState.statusLine = `refused: ${result.code}`;
  }
}

function selectRun(
  state: ObservatoryState,
  localState: AtlasLocalState
): PrivateEvidenceGraph | null {
  const selected = state.runs.find((run) => run.identity.sourceRunId === localState.selectedRunId);
  const fallback = selected ?? state.runs.find((run) => !isRunEnded(run)) ?? state.runs[0] ?? null;
  localState.selectedRunId = fallback?.identity.sourceRunId ?? null;
  if (
    localState.selectedNodeId !== null &&
    fallback &&
    !inspectNode(fallback, localState.selectedNodeId).ok
  ) {
    localState.selectedNodeId = null;
  }
  return fallback;
}

function isRunEnded(run: PrivateEvidenceGraph | null): boolean {
  return Boolean(run && run.events.some((event) => event.kind === "run_end"));
}

function buildBreadcrumb(
  selectedRun: PrivateEvidenceGraph | null,
  inspected: InspectedNode
): string {
  const destination = inspected.ok
    ? inspected.orientation.destination
    : selectedRun?.destination || "—";
  const outcomeLabel = inspected.ok
    ? inspected.orientation.outcome
      ? `OUTCOME: ${inspected.orientation.outcome}`
      : isRunEnded(selectedRun)
        ? "NO OUTCOME RECORDED"
        : "OUTCOME PENDING"
    : selectedRun?.events.find((event) => event.kind === "outcome")
      ? `OUTCOME: ${selectedRun.events.find((event) => event.kind === "outcome")?.summary}`
      : isRunEnded(selectedRun)
        ? "NO OUTCOME RECORDED"
        : "OUTCOME PENDING";
  const inspectedItem = inspected.ok
    ? `NODE #${inspected.item.seq}: ${inspected.item.kind}`
    : "SELECT NODE";
  return `${destination} → ${outcomeLabel} → ${inspectedItem}`;
}

function shortRunId(sourceRunId: string): string {
  return sourceRunId.length > 12 ? `${sourceRunId.slice(0, 12)}…` : sourceRunId;
}

function formatActionError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `failed: ${error.message}`;
  }
  return "failed: bridge request";
}
