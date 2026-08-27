# 16: Program slots and occupancy

**What to build:** The first showcase program as a visible operator-side view: four program slots in encounter order, filled only by the first qualifying Observatory-instrumented source run of each class, with empty, presentable hole, filled, and withdrawn as distinct observable occupancies, plus revoke, re-Graduation, and delete rules rendered in the program view.

**Blocked by:** 15 — Graduation, Seal, and projections.

**Status:** resolved

- [x] Four program slots exist in encounter order: decision-ready planning → proven repair → regression-safe delivery → controlled service change, one per outcome class.
- [x] A slot fills only with the first qualifying Observatory-instrumented source run of that class; purpose-built demos and Uninstrumented reconstructions cannot fill a slot.
- [x] Occupancy states empty, presentable hole, filled, and withdrawn are each observable in the program view and mutually distinct.
- [x] A Sealed run that never Graduated is not an occupant: the slot is empty and available.
- [x] Revoke after Graduation keeps the private occupant and shows withdrawn to the audience view; no replacement is sought.
- [x] Re-Graduation of that occupant is allowed only when no mechanical Seal veto holds; it mints a new immutable projection version; the audience stays withdrawn until then.
- [x] Deleting a private graph vacates a non-Graduated occupant and leaves a Graduated projection and occupancy standing, still claim-supporting.
- [x] Extra private source runs exist outside the program without occupying slots.

## Comments

Landed program occupancy on the Common Exhibit Contract. The Route Atlas renders the four slots; Projector is unchanged.

- Seam: `programSlots`, `seal`, `revoke` on `src/shared/observatory/contract.ts`. Capture still goes through `startCapture` / `applyEvent`. Graduation still goes through `graduate`.
- Four slots in encounter order. A slot’s occupant is the first Observatory-instrumented run of that class. `origin: demo` and `origin: uninstrumented-reconstruction` cannot occupy. Runs without an outcome class stay extra. The scripted test emitter marks `origin: demo`.
- Occupancy is derived: empty, presentable-hole, filled, withdrawn. Sealed never-Graduated graphs are not occupants. Seal of a Graduated occupant is refused (`ALREADY_GRADUATED`). Revoke withdraws the live projection and keeps the private occupant; later qualifying runs are not replacements.
- Re-Graduation of a withdrawn occupant is the existing `graduate` path: mechanical Seal vetoes still block; a new immutable projection version is minted; audience occupancy stays withdrawn until that version exists.
- `ObservatoryStore.deletePrivateGraph` unlinks the private graph file first. Graduated projections remain, ordered by `sourceCreatedAt`, still claim-supporting.
- Atlas always offers opt-in (destination + outcome class) so extra private runs and later slots can be captured without deleting the current occupant.

Verification: `npm run typecheck:all`, `npm run test:unit` (251 pass, including `test/observatoryOccupancy.test.js`).
