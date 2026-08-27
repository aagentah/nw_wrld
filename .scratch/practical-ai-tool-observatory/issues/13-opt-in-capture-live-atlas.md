# 13: Opt-in capture with live Private atlas (tracer bullet)

**What to build:** The first end-to-end path: an Operator opts a source run into capture, events land in a private evidence graph behind the Common Exhibit Contract, and a minimal Route Atlas frame — destination header, adaptive spine, one outcome card, one persistent side inspector, one secondary chronology lane — updates live as the graph grows. Inspection is read-only. The run survives restart. Uninstrumented stays the default; the AI cannot start capture; never-persist never lands.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Uninstrumented is the default: no opt-in, no capture, no persisted artifacts.
- [x] Opt-in precedes the first captured event; an in-flight run cannot be retroactively instrumented; a programmatic (AI-attempted) start is refused observably.
- [x] One source run reaches exactly one human-owned outcome; exhibit and source-run identities are stable; contract version is recorded.
- [x] The graph records source-run events, tool I/O minus never-persist, approvals, artifacts, and an environment declaration (repo identity, versions, permissions/capability scope, start/end).
- [x] Never-persist values (secrets, tokens, credentials, keys) are never stored; usage appears only as a typed withheld-at-capture node recording the class, never the value.
- [x] Private-only material (local paths, private repo contents, identifiers, raw tool I/O, local-context prompts) persists in the private graph.
- [x] Hidden reasoning is not inspectable evidence.
- [x] The Route Atlas frame renders destination header, spine, outcome card, persistent inspector, and chronology lane, and updates live during an instrumented run.
- [x] Inspection is read-only: no inspection path triggers an effect or changes effect capability; a destination → outcome → inspected-item breadcrumb preserves orientation.
- [x] The instrument is Operator-only (not Projector, not Dashboard-as-home) and its host is a thin shell over the contract, replaceable without contract change.
- [x] The graph survives process restart; a valid graph loads as a no-op; an invalid graph fails safe and predictably; validation happens once at the storage boundary; no new dependencies.
- [x] Demoable: opt in via a test emitter, watch the run appear live in the atlas, restart, and the run reloads.

## Comments

Landed the tracer bullet as a Common Exhibit Contract module plus a thin Operator-only Route Atlas window.

- Seam: `src/shared/observatory/{types,contract,ObservatoryStore,testEmitter}.ts` with storage-boundary validation in `src/shared/validation/observatoryGraphValidation.ts`.
- Host: third BrowserWindow (`Observatory — Route Atlas`) over `src/observatory/`, IPC in `registerObservatoryBridge.ts`, sender-gated to the atlas webContents. Dashboard/Projector unchanged as home.
- Consent: `startCapture` refuses any initiator other than `operator` (`OPERATOR_CONSENT_REQUIRED`); events before `run_start` are `RUN_NOT_STARTED`; no session exists to retro-instrument.
- Persistence: per-graph JSON under `NW_WRLD_OBSERVATORY_DIR` or `userData/observatory/graphs`. Uninstrumented creates no directory. Invalid files skipped at load.
- Demo: atlas OPT IN → RUN TEST EMITTER → DECLARE OUTCOME → END RUN. Graphs reload after process restart.

Verification: `npm run typecheck:all`, `npm run test:unit` (212 pass, including observatory contract+store), `test/e2e/smoke.launch.spec.ts` and `test/e2e/workflows/observatoryAtlas.spec.ts`.
