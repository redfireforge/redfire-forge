# gRPC Studio — Phase 9 Validation Report

| Field | Value |
|---|---|
| Phase | 9I (Hardening Gate) |
| Date | 2026-06-29 |
| Branch | `feature/grpc-phase` |
| Test pass rate | 19 / 19 (9I acceptance); see per-phase totals below |
| TypeScript errors | 0 |
| P0 defects | 0 |
| P1 defects | 0 |
| Sign-off status | ✅ PASS — Phase 10 entry criteria satisfied |

---

## Executive summary

Phase 9 (Environment Variable Interpolation, 9A–9I) is complete. The phase delivered frozen token grammar, flat shared resolver with deep JSON/metadata/auth traversal, layered env precedence with immutable execute snapshots, canonical target validation, env cycle detection, template-only persistence, Studio preview UX, cross-surface execute parity, and mid-stream stream-message interpolation using frozen env.

---

## Acceptance checklist traceability

| # | Item | Test file | Test name | Result |
|---|------|-----------|-----------|--------|
| 1 | Same input resolves identically across Studio, Workflow, Harness | `grpcPhase9iAcceptance.test.ts` | `checklist-1` | ✅ PASS |
| 2 | Environment switch affects only subsequent calls | `grpcPhase9iAcceptance.test.ts` | `checklist-2` | ✅ PASS |
| 3 | Missing `grpcHost` blocks with validation error | `grpcPhase9iAcceptance.test.ts` | `checklist-3` | ✅ PASS |
| 4 | Nested body/metadata/auth interpolate correctly | `grpcPhase9iAcceptance.test.ts` | `checklist-4` | ✅ PASS |
| 5 | Escaped braces remain literal | `grpcPhase9iAcceptance.test.ts` | `checklist-5` | ✅ PASS |
| 6 | Secret values never exposed in exported artifacts | `grpcPhase9iAcceptance.test.ts` | `checklist-6` | ✅ PASS |

Sub-phase acceptance files (9A–9H) remain as granular traceability; 9I consolidates the phase-level checklist.

---

## Per-phase test coverage

| Phase | Gate | Scope |
|---|---|---|
| 9A | `test:grpc:phase9a` | Token grammar + contracts |
| 9B | `test:grpc:phase9b` | Shared flat resolver + deep traversal |
| 9C | `test:grpc:phase9c` | Precedence + env snapshot binding |
| 9D | `test:grpc:phase9d` | Target validation (`grpcHost`/`grpcPort`) |
| 9E | `test:grpc:phase9e` | Cycle detection + diagnostic safety |
| 9F | `test:grpc:phase9f` | Template persistence + replay compatibility |
| 9G | `test:grpc:phase9g` | Studio preview UX + error banner |
| 9H | `test:grpc:phase9h` | Cross-surface execute interpolation parity |
| 9I | `test:grpc:phase9i` | Consolidated acceptance + 9H regression |
| **Full** | `test:grpc:phase9` | 9A→9I sequential |

---

## Cross-surface parity matrix

| Surface | Target resolve | Body/metadata/auth deep resolve | Post-resolve validation | Frozen env on in-flight |
|---|---|---|---|---|
| Studio unary | ✅ 9D/9H | ✅ 9H | ✅ 9H | ✅ 9C |
| Studio stream start | ✅ 9D/9H | ✅ 9H | ✅ 9H | ✅ 9C |
| Studio stream send | ✅ 9D/9H | ✅ 9I (frozen `interpolationEnv`) | ✅ 9I (`validation` category + server cancel on failure) | ✅ 9I |
| Saved-request replay | ✅ 9F/9H | ✅ 9H | ✅ 9H | N/A (new bind) |
| Workflow node | ✅ 9D/9B | ✅ 9B | ✅ 9B | ✅ 9C |
| Harness scenario | ✅ 9D/9B | ✅ 9B | ✅ 9B | ✅ 9C |
| Harness pre-transport errors | N/A | N/A | ✅ 9E/9F (`serialization` category — not transport) | N/A |

---

## Defect triage

### P0 (blocking)

None.

### P1 (regression)

None.

### P2 (deferred)

| ID | Item | Decision |
|----|------|----------|
| P2-1 | Transitive env value expansion (`{{a}}` → value contains `{{b}}`) | By design: Phase 9B flat single-pass resolver; 9E cycle detection guards references without expanding |
| P2-2 | Workspace env UI layer (`workspaceDefaults` merge) | Deferred to Environment Manager expansion |
| P2-3 | Body/metadata resolved preview in Studio (beyond target strip) | 9G ships target-only preview; execute snapshot is source of truth |
| P2-4 | Replay TLS validation parity with Studio | Pre-existing Phase 4H; replay inherits tab TLS material |
| P2-5 | E2E interpolation tagged suite | Optional merge gate; unit gates cover resolver semantics |

---

## Phase 10 entry criteria

- [x] `npm run test:grpc:phase9i` green (includes 9H regression chain)
- [x] `npm run test:grpc:phase9` available — full 9A→9I sequential (`scripts/test-grpc-phase9.sh`)
- [x] `npx tsc -b --noEmit` — 0 errors
- [x] No open P0 / P1 issues
- [x] Runbook: `docs/guides/grpc-phase9-runbook.md`
- [x] All six acceptance items traced to passing tests

**Phase 10 may begin:** gRPC-Web transport expansion.
