### Runtime TypeScript + Boundary Validation + Testing Guidelines (nw_wrld)

This repo intentionally uses a **minimal “runtime TypeScript lane”** plus **boundary validation** and **small unit tests** to prevent regressions in the app’s most fragile, high-impact paths.

This document is the standard we will follow (and enforce) for any future work in this area.

---

### Goals (what we optimize for)

- **Reliability at boundaries**: Validate/normalize at _process boundaries_ (IPC, disk JSON, device input, sandbox/module execution).
- **Zero regression**: Valid inputs must behave the same; invalid inputs must fail safely and predictably.
- **No bloat**: No new dependencies for validation or testing. No “framework creep”.
- **Real safety**: TypeScript must catch mistakes; avoid “fake TS” (no `any`, and `unknown` only at true boundaries).
- **Centralization**: Put checks in one place so the rest of the code can assume stable contracts.

---

### Non-negotiables

- **No `any`** in runtime TS lane.
- **`unknown` is allowed only at true boundaries**, and must be narrowed immediately.
  - Examples of “true boundaries”: JSON parsing, IPC payloads, sandbox messages, device callbacks.
  - Rule: keep `unknown` at the function signature (`(value: unknown)`) and convert to safe, constrained types in the first few lines using guards.
- **No duplicate implementations for runtime modules.**
  - If a module is migrated into the runtime TS lane (`tsconfig.runtime.json`), there must not also be a parallel source implementation (e.g. `src/**.js` + `src/**.ts`, or `src/**.cjs` + `src/**.ts`).
  - A migration is not complete until all consumers are updated to use the runtime output and the legacy implementation is removed.
- **No “validation for validation’s sake.”**
  - Only add runtime validation/tests when the area is truly critical (rubric below).
- **No mystery diffs.**
  - If you can’t explain a changed line, revert it.
- **No silent behavior changes.**
  - For valid data, normalizers should be no-ops (or provably equivalent).

---

### What counts as “critical” in nw_wrld? (rubric)

Treat an area as **critical** only if it matches **at least 2** of the following:

- **Single point of failure**: one change can break core behavior across the app.
- **Cross-process contract**: data crosses boundaries (renderer ↔ main, main ↔ sandbox, disk ↔ app, device ↔ app).
- **Failure is silent or hard to debug**: “nothing happens”, subtle timing bugs, intermittent breakage.
- **High fan-out**: many call sites depend on the shape (e.g., shared JSON state, sandbox contracts).
- **User-authored inputs**: workspace modules, user-edited JSON, OSC addresses, etc.
- **Production risk**: likely to break in real environments (filesystem weirdness, corrupted JSON, unexpected IPC payloads).

Examples of **critical** areas in this repo:

- Input ingestion payloads (`input-event`)
- JSON bridge read/write (`userData.json`, `appState.json`, `recordingData.json`)
- Sandbox request/result contracts (`sandbox:request`, `sandbox:toMain`)
- Workspace module read/list results (`bridge:workspace:*`)

Examples of **not critical**:

- Pure UI state inside a single component
- Cosmetic settings that don’t affect runtime execution
- One-off debug helpers

---

### Architecture rule: validate at boundaries (not everywhere)

**Do**

- Validate/normalize _once_ when data crosses a boundary.
- Make downstream code assume stable types/shapes.

**Don’t**

- Sprinkle checks across business logic.
- Duplicate validators in multiple layers.

In this repo, the canonical boundary points include:

- Main process IPC handlers in `src/index.js`
- JSON bridge sanitization in `src/shared/validation/jsonBridgeValidation.ts`
- Sandbox request/result handling in `src/index.js` and runtime validators in `src/shared/validation/*`
- Input emission in `src/main/InputManager.ts`

---

### Runtime TypeScript lane (how it works here)

- The runtime TS lane compiles selected `.ts` files in `src/` into executable JS under `dist/runtime/**`.
- It is built via:
  - `npm run build:runtime`
- It is required by:
  - `npm start` (so runtime JS exists before Electron boots)
  - `npm run test:unit` (tests run against compiled runtime output)

**Rule**: If you add a new runtime TS file that must execute in Electron/Node, it must be included in `tsconfig.runtime.json`.

---

### Preference: runtime code must not import from `src/` at runtime

When migrating logic into the runtime TS lane, the **single runtime source of truth** is the compiled output under `dist/runtime/**`.

- Runtime code should **not** use “require-from-`src` fallbacks” (e.g., “try `dist/runtime`, else `src/`”).
- If a module is needed at runtime, it should be **compiled into** `dist/runtime/**` (via `tsconfig.runtime.json`) and imported normally from the runtime bundle.
- This avoids duplicated implementations (`.js` + `.ts`) and keeps runtime behavior consistent with what unit tests execute.

---

### Clarification: when to import from `dist/runtime/**` vs `src/**`

This repo has two “worlds” that can both consume shared logic:

- **Runtime lane (Electron/Node execution)**:
  - Main-process/runtime code should import from **`dist/runtime/**`\*\*.
  - Runtime-focused unit tests should import from **`dist/runtime/**`\*\* to validate what actually executes at runtime.
  - This keeps runtime behavior consistent and enforces the “single runtime source of truth” rule.

- **App/renderer/source code (bundled UI code under `src/`)**:
  - Source/UI code should import from **`src/**`** (typically `src/shared/**`), not from `dist/runtime/**`.
  - Avoid making `src/**` depend on build artifacts under `dist/**` (it creates brittle build-order coupling and breaks clean builds).

In practice:

- **Use `dist/runtime/**`\*\* when the code path is intended to run as part of the runtime TS lane (Electron main process / runtime execution) or when a unit test is explicitly validating that compiled output.
- **Use `src/**`\*\* for renderer/UI modules and other source code that is bundled by webpack.

---

### How to add a new “TS island” safely (checklist)

- **Define the boundary**:
  - Where does the data enter/leave? (IPC handler name, JSON filename, device callback, sandbox message type)
- **Define the contract**:
  - What is the minimal stable shape needed downstream?
- **Write a normalizer/sanitizer**:
  - Accept `unknown` at boundaries (preferred) or a constrained “json-ish” union.
  - Return stable outputs.
  - Preserve unknown fields unless unsafe.
  - Be a no-op on valid inputs whenever possible.
- **Wire it at the boundary**:
  - Central place (e.g., `src/index.js` IPC handler, `sanitizeJsonForBridge`).
- **Add minimal unit tests**:
  - 1–2 “valid input preserved” tests
  - 1–2 “invalid input contained” tests
- **Prove no regression**:
  - Run `npm run test:unit`.
  - Confirm the runtime lane duplicate check passes (it is run as part of `npm run test:unit`).

---

### Enforcement: runtime lane must not have duplicate source implementations

This repo enforces the “single runtime source of truth” rule for modules listed in `tsconfig.runtime.json`:

- If a path is included as runtime TS (e.g. `src/foo/bar.ts`), there must not also exist a `src/foo/bar.js` or `src/foo/bar.cjs`.
- This prevents accidentally shipping or relying on a `src/**` fallback implementation.

Run:

- `npm run test:unit` (includes the enforcement check)

### Validation style (no dependencies, no `any`)

Use the established style:

- Prefer boundary signatures like:
  - `normalizeX(value: unknown): X | null`
- Internally, narrow into constrained shapes (examples):
  - `type Jsonish = string | number | boolean | null | undefined | object;`
- Use safe guards:
  - `isPlainObject(...)`
  - `Array.isArray(...)`
  - `asNonEmptyString(...)`
  - `Number.isFinite(...)`
- Avoid over-modeling:
  - Only type what you need to enforce contract stability.

**Rule**: Normalizers must be deterministic and side-effect free.

---

### Testing style (minimal, built-in)

- Use Node’s built-in runner: `node --test`
- Tests live in `test/*.test.js`
- Tests should import the **compiled runtime output** from `dist/runtime/**` when validating runtime TS islands.
- Keep tests short and high-signal:
  - Avoid big fixtures and broad integration setups unless the boundary truly demands it.

When to go beyond basic unit tests (only for truly critical paths):

- **Add a tiny integration test** if wiring is easy to break (e.g., an IPC handler must call a sanitizer).
- **Add property-style tests** only if the failure mode is intermittent and the input space is large.
  - Keep it dependency-free (generate randomized inputs with `Math.random()` and assert invariants).

Run:

- `npm run test:unit`

---

### Error handling standards (fail safe, don’t hide failures)

Pick the failure strategy that matches the boundary:

- **Renderer-facing IPC/bridge reads**:
  - Prefer returning a safe default (or `null`) rather than throwing.
  - Validation failures should be surfaced as structured `{ ok:false, error:"..." }` results where possible.
- **Sandbox request boundaries**:
  - Prefer `{ ok:false, error:"INVALID_..." }` rather than throwing.
  - Never send malformed payloads into the sandbox.
- **Developer diagnostics**:
  - Avoid silent `catch {}` for validation failures.
  - Log only at boundaries, and include context (which boundary, which contract), keeping logs concise.

### Templates (copy/paste)

#### Template: runtime validator (`.ts`)

```typescript
type Jsonish = string | number | boolean | null | undefined | object;

function isPlainObject(value: Jsonish): value is Record<string, Jsonish> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function asNonEmptyString(value: Jsonish): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

export function normalizeCriticalPayload(value: Jsonish): Jsonish {
  const v = value as unknown as Jsonish;
  if (!isPlainObject(v)) return null;
  const id = asNonEmptyString(v.id);
  if (!id) return null;
  return v;
}
```

#### Template: unit test (`.test.js`)

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { normalizeCriticalPayload } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "validation", "yourNewValidator.js")
);

test("normalizer preserves valid payload", () => {
  const payload = { id: "x" };
  assert.deepEqual(normalizeCriticalPayload(payload), payload);
});

test("normalizer rejects invalid payload", () => {
  assert.equal(normalizeCriticalPayload({}), null);
});
```

---

### Practical “don’t overdo it” rules

- **Prefer 1 normalizer at 1 boundary** over many validators scattered in the app.
- **Prefer 3–6 tests total** for a new critical area; more is usually diminishing returns.
- **Don’t normalize deep trees unless needed**:
  - Stabilize the minimal shape that prevents crashes or silent failure.
- **Avoid creating “a schema system”**:
  - If a validator grows beyond ~200 lines, consider splitting by sub-contract (still no dependencies) or re-check whether the area is truly critical.

---

### Dependencies policy (pragmatic, not ideological)

Default posture: **no new dependencies** for validation/testing.

Exception policy: consider a validation library only if ALL are true:

- The contract is complex and changing frequently, and
- Hand-rolled validators are demonstrably causing bugs or slowing iteration, and
- The dependency is small, stable, and widely used, and
- You can justify it with a concrete maintenance win.

---

### What we’ve already applied (reference)

This repo currently follows these standards in practice via:

- Runtime TS compilation (`tsconfig.runtime.json` → `dist/runtime/**`)
- Boundary validators/sanitizers under `src/shared/validation/**`
- Main-process boundary wiring in `src/index.js`
- Minimal unit tests under `test/**` using `node --test`
