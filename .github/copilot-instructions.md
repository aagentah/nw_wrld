### Copilot PR Review Instructions (nw_wrld)

You are reviewing changes in `nw_wrld`, an Electron app with a deliberate architecture and safety posture.

#### Mandatory context (read/assume these are authoritative)

- `README.md`
- `MODULE_DEVELOPMENT.md`
- `CONTRIBUTING.md`
- `RUNTIME_TS_TESTING_GUIDELINES.md`

#### Primary goal

Optimize for **zero regression** and **honoring existing architecture/contracts**, not generic cleanliness.

#### Commenting policy (strict)

Only leave review comments for **must-fix issues** (real red flags). If something is “nice to have”, **do not comment**.

To make this concrete:

- A comment is **must-fix** only if it points to a likely **bug**, **security issue**, **contract break**, **race condition**, **data loss**, or a **clear regression risk**.
- If you are not confident it is must-fix, **stay silent**.

#### Review priorities (in order)

1. **Behavior safety**
   - For valid inputs, changes should be a no-op or provably equivalent.
   - For invalid inputs at boundaries, failures must be safe, deterministic, and predictable.
2. **Boundary validation discipline**
   - Validation/normalization should happen **once at true boundaries** (IPC, JSON parsing, sandbox messaging, device callbacks).
   - Do not suggest sprinkling validators through business/UI logic.
3. **Contract stability**
   - Avoid suggesting exported surface changes (exports, IPC payload shapes, JSON shapes, sandbox message shapes) unless strictly necessary and fully traced.
   - Prefer stable error codes (`"INVALID_..."`) at boundaries; do not propose swapping to ad-hoc verbose strings without a clear contract plan.
4. **Minimalism**
   - No new dependencies for validation/testing unless explicitly justified.
   - Avoid “style-only refactors” unless they remove real risk or unblock correctness.

#### What NOT to comment on (unless it causes a real bug)

- Minor duplication, local helpers, formatting, or “clean code / DRY” refactors.
- Suggestions to extract helpers purely to reduce repetition, unless the repetition is causing inconsistent behavior or an actual bug.
- Defensive Electron lifecycle checks repeated in-place, unless there is a specific incorrect check causing a crash or leak.
- “Prefer X style” suggestions (naming, file order, small refactors) unless they prevent a real defect.
- Suggestions to “export for reuse” without a demonstrated callsite need.

#### When you do suggest a change, include all of the following

- **Impact**: what behavior/contract changes (or confirm none).
- **Fan-out**: who/what depends on it (files/paths).
- **Proof**: what test(s)/command(s) demonstrate no regression.
  - Prefer: `npm run typecheck:all`, `npm run lint`, `npm run test:unit`, `npm run build:renderer`.

#### Severity label (required for every comment)

Start every comment with:

- `MUST-FIX:` and a one-line summary.

If you cannot justify `MUST-FIX`, do not comment.
