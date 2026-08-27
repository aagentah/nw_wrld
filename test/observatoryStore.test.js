const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const { ObservatoryStore } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "observatory", "ObservatoryStore.js")
);
const { emitScriptedSourceRun } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "observatory", "testEmitter.js")
);
const { OBSERVATORY_CONTRACT_VERSION } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "observatory", "types.js")
);

function createStoreRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "nw-wrld-observatory-"));
}

function startOperatorCapture(store) {
  const result = store.startCapture({
    initiator: "operator",
    destination: "Prove a minimal repair",
    at: "2026-08-26T00:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(`Unexpected refusal: ${result.code}`);
  return result.graph.identity.sourceRunId;
}

function startSourceRun(store, sourceRunId) {
  const result = store.recordEvent(sourceRunId, {
    kind: "run_start",
    actor: "source",
    summary: "Source run started",
    environment: {
      repoIdentity: "nw_wrld/observatory-store-test",
      versions: { app: "0.7.0-beta" },
      capabilityScope: "read-only approval-gated",
    },
    at: "2026-08-26T00:00:01.000Z",
  });
  assert.equal(result.ok, true);
}

function graphPath(rootDir, sourceRunId) {
  return path.join(rootDir, "graphs", `${sourceRunId}.json`);
}

test("fresh and programmatic stores leave no artifacts until operator opt-in", () => {
  const rootDir = createStoreRoot();
  try {
    const store = new ObservatoryStore(rootDir);
    assert.deepEqual(store.getState().runs, []);
    assert.equal(fs.existsSync(path.join(rootDir, "graphs")), false);

    const refused = store.startCapture({
      initiator: "ai:implementer",
      destination: "Attempted program start",
      at: "2026-08-26T00:00:00.000Z",
    });
    assert.deepEqual(refused, { ok: false, code: "OPERATOR_CONSENT_REQUIRED" });
    assert.equal(fs.existsSync(path.join(rootDir, "graphs")), false);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("operator opt-in persists a source-run graph and event appends grow its file", () => {
  const rootDir = createStoreRoot();
  try {
    const store = new ObservatoryStore(rootDir);
    const sourceRunId = startOperatorCapture(store);
    const filePath = graphPath(rootDir, sourceRunId);
    assert.match(path.basename(filePath), /^sr_[a-z0-9]{16}\.json$/);
    assert.equal(fs.existsSync(filePath), true);

    const persistedAtCapture = fs.readFileSync(filePath, "utf8");
    startSourceRun(store, sourceRunId);
    const eventResult = store.recordEvent(sourceRunId, {
      kind: "move",
      actor: "ai:implementer",
      summary: "Applied minimal repair",
      at: "2026-08-26T00:00:02.000Z",
    });
    assert.equal(eventResult.ok, true);

    const persistedAfterEvent = fs.readFileSync(filePath, "utf8");
    assert.ok(persistedAfterEvent.length > persistedAtCapture.length);
    const state = store.getState();
    assert.equal(state.contractVersion, OBSERVATORY_CONTRACT_VERSION);
    assert.equal(state.runs[0].identity.sourceRunId, sourceRunId);
    assert.deepEqual(
      state.runs[0].events.map((event) => event.kind),
      ["run_start", "move"]
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("unknown source runs are observably not instrumented", () => {
  const rootDir = createStoreRoot();
  try {
    const store = new ObservatoryStore(rootDir);
    const result = store.recordEvent("sr_unknownrun12345", {
      kind: "move",
      actor: "source",
      summary: "No capture exists",
      at: "2026-08-26T00:00:00.000Z",
    });
    assert.deepEqual(result, { ok: false, code: "NOT_INSTRUMENTED" });
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("restart reloads the same source-run identity and events", () => {
  const rootDir = createStoreRoot();
  try {
    const firstStore = new ObservatoryStore(rootDir);
    const sourceRunId = startOperatorCapture(firstStore);
    startSourceRun(firstStore, sourceRunId);
    const originalState = firstStore.getState();

    const restoredStore = new ObservatoryStore(rootDir);
    assert.deepEqual(restoredStore.loadAll(), { loaded: 1, skipped: 0 });
    assert.deepEqual(restoredStore.getState(), originalState);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("load skips malformed, incompatible, and never-persist-poisoned files while retaining valid graphs", () => {
  const rootDir = createStoreRoot();
  try {
    const producingStore = new ObservatoryStore(rootDir);
    const sourceRunId = startOperatorCapture(producingStore);
    startSourceRun(producingStore, sourceRunId);
    const graphsDir = path.join(rootDir, "graphs");
    const validGraph = JSON.parse(fs.readFileSync(graphPath(rootDir, sourceRunId), "utf8"));

    fs.writeFileSync(path.join(graphsDir, "garbage.json"), "{ not JSON");
    fs.writeFileSync(
      path.join(graphsDir, "wrong-version.json"),
      JSON.stringify({
        ...validGraph,
        identity: { ...validGraph.identity, contractVersion: OBSERVATORY_CONTRACT_VERSION + 1 },
      })
    );
    fs.writeFileSync(
      path.join(graphsDir, "poisoned.json"),
      JSON.stringify({
        ...validGraph,
        events: [
          ...validGraph.events,
          {
            nodeId: "n9_poison",
            seq: 9,
            kind: "move",
            actor: "source",
            summary: "Poisoned graph",
            at: "2026-08-26T00:00:02.000Z",
            payload: { api_token: "sk-live-9f2c4d7e" },
          },
        ],
      })
    );

    const restoredStore = new ObservatoryStore(rootDir);
    assert.deepEqual(restoredStore.loadAll(), { loaded: 1, skipped: 3 });
    assert.deepEqual(
      restoredStore.getState().runs.map((graph) => graph.identity.sourceRunId),
      [sourceRunId]
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("ticket-13 graphs without provenance or evidenceKind still load", () => {
  const rootDir = createStoreRoot();
  try {
    const producingStore = new ObservatoryStore(rootDir);
    const sourceRunId = startOperatorCapture(producingStore);
    startSourceRun(producingStore, sourceRunId);
    const filePath = graphPath(rootDir, sourceRunId);
    const legacy = JSON.parse(fs.readFileSync(filePath, "utf8"));
    delete legacy.identity.provenanceMode;
    delete legacy.identity.effectCapability;
    for (const event of legacy.events) delete event.evidenceKind;
    fs.writeFileSync(filePath, `${JSON.stringify(legacy)}\n`);

    const restoredStore = new ObservatoryStore(rootDir);
    assert.deepEqual(restoredStore.loadAll(), { loaded: 1, skipped: 0 });
    const graph = restoredStore.getState().runs[0];
    assert.equal(graph.identity.provenanceMode, "authentic live");
    assert.equal(graph.identity.effectCapability, "approval-gated");
    assert.ok(graph.events.every((event) => typeof event.evidenceKind === "string"));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});


test("valid graph loads never rewrite disk and repeated loading is identical", () => {
  const rootDir = createStoreRoot();
  try {
    const producingStore = new ObservatoryStore(rootDir);
    const sourceRunId = startOperatorCapture(producingStore);
    startSourceRun(producingStore, sourceRunId);
    const filePath = graphPath(rootDir, sourceRunId);
    const bytesBeforeLoad = fs.readFileSync(filePath);

    const restoredStore = new ObservatoryStore(rootDir);
    assert.deepEqual(restoredStore.loadAll(), { loaded: 1, skipped: 0 });
    assert.deepEqual(fs.readFileSync(filePath), bytesBeforeLoad);
    const firstState = restoredStore.getState();
    assert.deepEqual(restoredStore.loadAll(), { loaded: 1, skipped: 0 });
    assert.deepEqual(restoredStore.getState(), firstState);
    assert.deepEqual(fs.readFileSync(filePath), bytesBeforeLoad);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("scripted source-run emission records run_start through artifact plus one withheld node", async () => {
  const rootDir = createStoreRoot();
  try {
    const store = new ObservatoryStore(rootDir);
    const sourceRunId = startOperatorCapture(store);

    const result = await emitScriptedSourceRun((input) => store.recordEvent(sourceRunId, input), {
      delayMs: 0,
    });

    assert.deepEqual(result, { emitted: 14, refusals: [] });
    const graph = store.getState().runs[0];
    assert.equal(graph.events.length, 15);
    assert.equal(graph.events[0].kind, "run_start");
    assert.equal(graph.events.filter((event) => event.kind === "withheld_at_capture").length, 1);
    assert.equal(graph.events.filter((event) => event.kind === "claim").length, 1);
    const persisted = fs.readFileSync(graphPath(rootDir, sourceRunId), "utf8");
    assert.equal(persisted.includes("sk-live-9f2c4d7e"), false);
    const restoredStore = new ObservatoryStore(rootDir);
    assert.deepEqual(restoredStore.loadAll(), { loaded: 1, skipped: 0 });
    assert.equal(restoredStore.getState().runs[0].events.length, 15);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
