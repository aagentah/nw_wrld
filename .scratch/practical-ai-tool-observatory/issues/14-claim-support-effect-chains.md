# 14: Claim support, effect chains, and drill-down

**What to build:** The contract's evidence semantics, visible in the atlas overview and inspector: typed claims with support states, complete material effect chains as distinct stages, provenance mode and effect capability as separate visible facts, bidirectional claim↔evidence tracing, and reliance limits at the point of reliance. The overview becomes legible before drill-down.

**Blocked by:** 13 — Opt-in capture with live Private atlas.

**Status:** resolved

- [x] Every displayed item is typed source-observed, human-declared, AI-declared, or curator-derived; curator-derived nodes cannot raise claim support.
- [x] Central claims carry supported, partial, unverified, or contradicted.
- [x] Material effect chains keep requested capability → granted scope → proposal → approval or rejection → attempt → observed effect and result as distinct stages; missing, rejected, failed, and unobserved stages stay explicit.
- [x] Provenance mode and effect capability display as separate facts; a replay label never implies authenticity, safety, or deterministic re-execution.
- [x] Drill-down reaches any material actor, move, claim, effect, result, or limitation from the overview without losing orientation.
- [x] Claim↔evidence tracing is bidirectional, extending to source events, actors, and decisions; named source and Wayfinder links resolve.
- [x] Reliance limits (uncertainty, scope bounds, nondeterminism, redaction impact, unverified claims) attach at the claim or move where reliance occurs.
- [x] Before drill-down, the overview shows human goal, before/after result, material AI contribution, central-claim support, material effect-gate status, material limitations, provenance mode, and effect capability.
- [x] Material failed attempts, rejected proposals, and abandoned branches remain visible as non-results when they affected the route.

## Comments

Landed evidence semantics on the Common Exhibit Contract, with the Route Atlas as a thin adapter.

- Seam: `claimSupport`, `effectChains`, `inspectNode`, `resolveLink`, `exhibitOverview` on `src/shared/observatory/contract.ts`. Capture still goes through `applyEvent`.
- Every event carries `evidenceKind`. Curator-derived nodes cannot raise support. Central claims compute supported / partial / unverified / contradicted from linked evidence.
- Effect chains assemble six stages by `chainId`; missing, rejected, failed, unobserved, and abandoned stay explicit `nonResult`s.
- Graph identity stores provenance mode and effect capability as separate facts. Overview has no replay label.
- Inspector traces claims↔evidence (source events, actors, decisions) and resolves named source / Wayfinder links. Reliance limits attach on the claim or move.
- Atlas overview renders the contract facts and drill targets; header shows provenance and effect separately; breadcrumb keeps destination / outcome / effect capability.

Verification: `npm run typecheck:all`, `npm run test:unit` (222 pass, including `test/observatoryEvidence.test.js`).
