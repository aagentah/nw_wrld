### E2E Testing Guidelines (nw_wrld)

This repo uses **minimal E2E tests** (Playwright + Electron) to validate the **highest-value workflows** that span real boundaries (renderer ↔ main ↔ filesystem ↔ projector).

This document is the standard we will follow (and enforce) for any future work in this area.

---

### Goals (what we optimize for)

- **Confidence in real workflows**: Verify that core user journeys still work end-to-end.
- **Boundary coverage**: Prefer tests that cross real boundaries (UI → IPC → disk JSON → projector messaging) when that’s the risk.
- **No bloat**: Keep tests short, deterministic, and easy to maintain.
- **Zero regression**: A failing E2E test should point to a real break (not flakiness).

---

### Non-negotiables

- **No mega-tests as the default.**
  - We allow a small number of “golden path” tests, but most tests must be focused.
- **No fixed sleeps.**
  - Do not add `setTimeout`/`sleep` waits. Use Playwright auto-waiting, `expect(...).toBeVisible()`, `waitForFunction`, `expect.poll`, etc.
- **No brittle selectors.**
  - Prefer stable selectors. If you can’t make it stable, don’t write the test yet—fix the UI contract first.
- **No mystery diffs.**
  - If you can’t explain a changed line, revert it.

---

### When an E2E test is justified (rubric)

Add E2E tests only when the risk is truly end-to-end. Good candidates:

- **Cross-process contracts**: dashboard ↔ main ↔ projector IPC, sandbox integration, “project folder” wiring.
- **Persistence correctness**: edits must be saved to `nw_wrld_data/json/*.json` and survive relaunch.
- **Complex UI orchestration**: flows that require multiple modals/views where regressions are common.

Bad candidates:

- Pure UI rendering details
- Styling/layout/cosmetic behavior
- Logic that already has strong unit coverage and doesn’t cross a boundary

---

### Test organization (in this repo)

- `test/e2e/smoke.*.spec.ts`
  - Very small “app launches” validations.
- `test/e2e/workflows/*.spec.ts`
  - User-facing workflows (create/edit/delete/reorder, persistence).
- `test/e2e/fixtures/*`
  - Reusable launch + workspace setup utilities.

---

### Test data and isolation (project folders)

Default posture: **each test uses its own fresh temporary project folder** and cleans it up.

- Tests create a temp directory via `os.tmpdir()` with prefix `nw-wrld-e2e-*`.
- The app is launched with `NW_WRLD_TEST_PROJECT_DIR=<that temp dir>` so dialogs are skipped.
- Tests may assert persistence by reading `nw_wrld_data/json/userData.json` inside the temp dir.

Rule: tests must never read/write outside their own temp project dir.

---

### Selectors and “test contracts”

Preferred selector hierarchy:

1. **`data-testid`** (when we intentionally add a stable test hook)
2. **Accessible roles/labels** (`getByRole`, `getByLabel`, stable input ids)
3. **Exact text** only when the string is truly stable (and use `exact: true`)

If a workflow requires clicking an icon-only control (trash/reorder/etc.), add a stable hook first:

- Use `data-testid` on the specific button/icon.
- Keep hooks minimal and local (don’t blanket the UI with test ids).

---

### Flake-proof waiting strategy

Use “wait for truth” instead of “wait for time”:

- Wait for the app/project to be ready:
  - `nwWrldBridge.project.isDirAvailable() === true`
- Wait for modals to open/close using unique elements (e.g., input ids).
- For persistence:
  - `expect.poll` reading `userData.json` until the expected state appears.

---

### Scope rules: golden paths vs. small workflows

- **Golden path tests**:
  - 1–2 tests max
  - Prove the most important end-to-end “happy path”
  - Keep assertions minimal but meaningful

- **Workflow tests**:
  - One behavior per test (create set, delete track, reorder modules, etc.)
  - Each test stands alone (no dependency on test order)

---

### Running E2E tests

```bash
npm run test:e2e
```

Artifacts (on failure) are written to `test-results/` (gitignored).

---

### If you’re adding a new E2E test (checklist)

- Identify the boundary risk (why E2E is the right tool).
- Keep the test to a few actions and one clear assertion.
- Use stable selectors (add a test hook if needed).
- Avoid flakes (no sleeps; wait on real signals).
- Prove no regression:
  - `npm run test:e2e`
  - `npm run test:unit`
