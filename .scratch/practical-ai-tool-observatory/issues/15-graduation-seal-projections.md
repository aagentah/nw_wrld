# 15: Graduation, Seal, and projections

**What to build:** The private-to-presentable path as an Operator-facing flow on the instrument: Graduation as class-withhold then Operator consent over a withhold/downgrade report, with projection preview; immutable projection versions under the same source-run identity; all five mechanical Seal vetoes with no waivers; sanitized vs simulated provenance with typed substitution and withheld nodes that downgrade their claims automatically.

**Blocked by:** 14 — Claim support, effect chains, and drill-down.

**Status:** resolved

- [x] Graduation procedure: class-withhold private-only material as typed nodes → recompute claim support → present the withhold/downgrade report → Operator may restore a payload, narrow a claim, or abort.
- [x] Never-persist values cannot be restored; the AI cannot Graduate.
- [x] Each of the five mechanical Seal vetoes blocks Graduation with no waiver: never-persist landed and unpurged; required withholding leaves a central claim unsupported; the projection would not be effect-disabled; the Operator cannot inspect the complete private chain; a legal or third-party confidential constraint applies.
- [x] Aesthetic fit is excluded from the Seal veto.
- [x] Projections are immutable; further sanitization or claim-narrowing mints a new version with the same source-run identity; the previous version is withdrawn if it must not remain in the program.
- [x] Real events with withheld or truncated payloads read as sanitized; replaced events or stand-in tool behavior read as simulated; when both occur, the overview reads simulated while both node types stay inspectable.
- [x] Every withheld, withheld-at-capture, and substitution node is typed with class and reason and linked to affected claims, which downgrade automatically.
- [x] Operator or curator attestation cannot preserve a support state the visible evidence no longer earns.
- [x] The projection preview renders on the operator instrument and does not bind the Projector.
- [x] The default presentable claim is recorded playback with effect capability disabled.

## Comments

Landed Graduation on the Common Exhibit Contract. The Route Atlas previews a projection locally and consents through the existing Operator-only bridge.

- Seam: `previewGraduation`, `graduate` on `src/shared/observatory/contract.ts`. Claim support still refuses curator-derived, withheld, withheld-at-capture, and substitution nodes. Capture still goes through `applyEvent`.
- Class-withhold walks private-only payload keys (`path`, prompts, identifiers, raw tool I/O, repo contents) into typed `withheld` nodes with class, reason, source node, and affected claims; never-persist stays unrestorable.
- Operator consent may restore a private-only payload, narrow a claim off central, or abort. Initiator other than `operator` is `OPERATOR_CONSENT_REQUIRED`.
- Five mechanical Seal vetoes, no waivers: `NEVER_PERSIST_UNPURGED`, `CENTRAL_CLAIM_UNSUPPORTED`, `PROJECTION_NOT_EFFECT_DISABLED`, `PRIVATE_CHAIN_INCOMPLETE`, `LEGAL_OR_THIRD_PARTY_CONSTRAINT`. `aestheticFit` is ignored.
- Presentable projections are immutable versions under the same source-run and exhibit ids, always `recorded-playback` with effect capability `disabled`. A later Graduation withdraws the previous version.
- Atlas preview is computed in the renderer and does not call Projector. `graduate` IPC persists under `projections/` and is sender-gated to the atlas window.

Verification: `npm run typecheck:all`, `npm run test:unit` (232 pass, including `test/observatoryGraduation.test.js`).
