# gRPC Studio — Phase 8 Validation Report

| Field | Value |
|---|---|
| Phase | 8I (Hardening Gate) |
| Date | 2026-06-29 |
| Branch | `feature/grpc-phase` |
| Test pass rate | 30 / 30 (8I acceptance); see per-phase totals below |
| TypeScript errors | 0 |
| P0 defects | 0 |
| P1 defects | 0 |
| Sign-off status | ✅ PASS — Phase 9 entry criteria satisfied |

---

## Executive summary

Phase 8 (Test Runner / Harness Integration, 8A–8I) is complete. The phase delivered frozen harness scenario contracts, immutable execution snapshots, unified four-call-type executor, seven-kind assertion engine, int64/uint64-safe numeric comparisons, parameterized data-source expansion, canonical `GrpcHarnessResult` publication, export/redaction for all runner artifact surfaces, and a hardening gate with six acceptance checklist items.

---

## Acceptance checklist traceability

| # | Item | Test file | Test name | Result |
|---|------|-----------|-----------|--------|
| 1 | Unified harness adapter with explicit `callType` | `grpcPhase8iAcceptance.test.ts` | `checklist-1: unified harness adapter` (×6) | ✅ PASS |
| 2 | Stream assertions against bounded collection windows | `grpcPhase8iAcceptance.test.ts` | `checklist-2: bounded stream collection` (×5) | ✅ PASS |
| 3 | int64/uint64 string-safe field assertions | `grpcPhase8iAcceptance.test.ts` | `checklist-3: int64/uint64 assertions` (×2) | ✅ PASS |
| 4 | Failures categorized (assertion / network / timeout / serialization) | `grpcPhase8iAcceptance.test.ts` | `checklist-4: failure categorization` (×6) | ✅ PASS |
| 5 | Data-source row identity + reproducible assertion logs | `grpcPhase8iAcceptance.test.ts` | `checklist-5: data-source row identity` (×3) | ✅ PASS |
| 6 | Harness export redacts secrets | `grpcPhase8iAcceptance.test.ts` | `checklist-6: harness export redaction` (×5) | ✅ PASS |

Sub-phase acceptance files (8A–8H) remain as granular traceability; 8I consolidates the phase-level checklist.

---

## Per-phase test coverage

| Phase | Gate | Scope |
|---|---|---|
| 8A | `test:grpc:phase8a` | Harness scenario contracts + validation |
| 8B | `test:grpc:phase8b` | Execution snapshots + template resolver |
| 8C | `test:grpc:phase8c` | Harness executor + four call types |
| 8D | `test:grpc:phase8d` | Assertion engine (7 kinds) |
| 8E | `test:grpc:phase8e` | int64/uint64 + trailer normalization |
| 8F | `test:grpc:phase8f` | Data-source expansion + row identity |
| 8G | `test:grpc:phase8g` | `GrpcHarnessResult` model + status precedence |
| 8H | `test:grpc:phase8h` | Export redaction + report/CSV/JSON safety |
| 8I | `test:grpc:phase8i` | Acceptance + 405-test regression bundle + 8A→8H chain |
| **Full** | `test:grpc:phase8` | 8A→8I sequential |

---

## Call-type coverage matrix

| Call type | Snapshot build | Executor dispatch | Assertions | HarnessResult | Export redaction |
|---|---|---|---|---|---|
| `unary` | ✅ 8B | ✅ 8C | ✅ 8D | ✅ 8G | ✅ 8H |
| `server_streaming` | ✅ 8B | ✅ 8C | ✅ 8D (`grpcStreamField`) | ✅ 8G | ✅ 8H |
| `client_streaming` | ✅ 8B | ✅ 8C | ✅ 8D | ✅ 8G | ✅ 8H |
| `bidi_streaming` | ✅ 8B | ✅ 8C | ✅ 8D | ✅ 8G | ✅ 8H |

---

## Export safety surfaces

| Surface | Redaction wired | Verified by |
|---|---|---|
| HTML report | ✅ `reportGenerator.ts` | `reportGenerator.test.ts` |
| JSON report | ✅ `reportGenerator.ts` | `reportGenerator.test.ts` |
| Markdown report | ✅ `reportGenerator.ts` | `reportGenerator.test.ts` |
| Export JSON (Results Dashboard) | ✅ `export.ts` | `export.test.ts` |
| Export CSV (Results Dashboard) | ✅ `export.ts` | `export.test.ts` |
| Harness result bundle | ✅ `prepareGrpcHarnessResultReportExport` | `grpcHarnessExport.test.ts` |
| Leak scan | ✅ `harness_result_export`, `runner_artifacts` | `grpcSecretLeakScan` |

---

## Defect triage

### P0 (blocking)

None.

### P1 (regression)

None.

### P2 (deferred)

| ID | Item | Decision |
|----|------|----------|
| P2-1 | CLI JUnit/JSON reporters not wired to harness redaction | ✅ Implemented: `cli/reporters.ts` now redacts via `redactGrpcHarnessRunnerArtifactsForExport` before JSON/JUnit generation |
| P2-2 | Kafka publish envelope does not redact harness results | Explicitly out of 8H scope |
| P2-3 | Local IDB test-run persistence stores unredacted results | By design — export paths are redacted |
| P2-4 | Opaque API keys in benign header names without bearer/PEM shape | Heuristic limit; auth-aware redaction when config available |
| P2-5 | E2E harness suite requires Docker echo fixture | Documented in runbook; optional merge gate |
| P2-6 | Harness runner does not hydrate gRPC connection profiles from storage | ✅ Implemented: runner hydrates profile catalog from storage and passes `runtimeOverrides.profiles` into harness execution |
| P2-7 | Feature-group/scenario JSON export bypasses harness redaction | ✅ Implemented: scenario/feature-group export applies gRPC definition redaction + leak-safety assertion before serialization |
| P2-8 | Export surfaces omit `authByScenarioId` map | Heuristic redaction applies; auth-aware path available when caller passes map |

---

## Phase 9 entry criteria

- [x] `npm run test:grpc:phase8i` green (includes 8A→8H regression chain)
- [x] `npm run test:grpc:phase8` available — full 8A→8I sequential (`scripts/test-grpc-phase8.sh`)
- [x] `npx tsc -b --noEmit` — 0 errors
- [x] No open P0 / P1 issues
- [x] Runbook: `docs/guides/grpc-phase8-runbook.md`
- [x] All six acceptance items traced to passing tests

**Phase 9 may begin:** environment variable interpolation (`{{grpcHost}}`, etc.) in Studio and harness adapters.
