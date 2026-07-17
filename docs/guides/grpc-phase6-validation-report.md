# gRPC Studio — Phase 6 Validation Report

| Field | Value |
|---|---|
| Phase | 6I (Hardening Gate) |
| Date | 2026-06-30 |
| Branch | `feature/grpc-phase` |
| Test pass rate | 15 / 15 (acceptance); see per-phase totals below |
| TypeScript errors | 0 |
| P0 defects | 0 |
| P1 defects | 0 |
| Sign-off status | ✅ PASS — entry criteria satisfied |

---

## Executive summary

Phase 6 (gRPC Workflow Integration, 6A–6I) is complete and all acceptance criteria are satisfied.

The phase delivered three workflow node types (`grpcUnary`, `grpcServerStream`, `grpcAssert`), an output namespace and variable system, a results diagnostics panel (`GrpcMetaSection`), cross-protocol variable chaining, and a hardening gate with full `runGraph`-level acceptance tests for all six acceptance checklist items.

Three regression bugs identified during the Phase 6I re-evaluation were resolved before final acceptance:

| Bug | Symptom | Fix |
|-----|---------|-----|
| B1 | Assert pass path missing `captureGrpcDetails` call | Added `captureGrpcDetails` on pass path in `handleGrpcAssertNode` |
| B2 | UI showed no "all passed" indicator for assert nodes | Handler now explicitly sets `assertionFailures: []` on pass; UI distinguishes `undefined` vs `[]` |
| B3 | Transport exception catch had no `grpcMeta` in `finishGrpcFailure` | Both `handleGrpcUnaryNode` and `handleGrpcServerStreamNode` catch blocks now build minimal `grpcMeta` |
| B4 | `grpcAssert` config-error failures left `grpcResultMeta.assertionFailures` undefined | `finishGrpcAssertFailure` now sets `assertionFailures: assertionFailures ?? [errorMessage]` |
| B5 | Phase 6I gate script did not chain full `6A→6H` regression or run `tsc -b` | `test-grpc-phase6i.sh` expanded (mirrors Phase 5I); `npm run test:grpc:phase6i` added |
| B6 | Assert fail paths omitted `grpcMeta.assertionFailures` when upstream was absent (config errors) | `finishGrpcAssertFailure` builds unified `stepForMeta` with `failureList` for all fail paths |
| B7 | Assert fail trace missing `capturedGrpcDetails` on config-error paths | `captureGrpcDetails` centralized in `finishGrpcAssertFailure` (all fail paths) |
| B8 | `maxDurationMs` never fired on idle SSE streams (no incoming frames) | Wall-clock `setTimeout` + `AbortController`; `parseGrpcSseStream` cancels reader on abort |
| B9 | `grpcAssert` trace events omitted `extractedVariables` (unary/stream included it) | Added `extractedVariables: ctx.snapshot()` to grpcAssert trace block in `graphRunner.ts` |
| B10 | `grpcTrailer` assertions were case-sensitive on trailer key lookup | `resolveTrailerValue()` matches keys case-insensitively |
| B11 | Harness/adapter tests used non-canonical stop reasons (`eof`, `maxMessages`) | Normalized to `stream_end`, `max_messages` to match collector output |
| B12 | Transport-exception catch paths did not commit step results (stream throw; belt for custom ops) | `commitTransportFailureStepResult` in unary/stream catch blocks |
| B13 | In-flight unary calls ignored workflow abort during `postGrpcCall` | `wrapUnaryInvokeWithAbort` cancels via `deleteGrpcCall` on abort signal |
| B14 | Plan claimed nested `{{grpc.response.body.field}}` paths; Phase 6 publishes whole JSON only | Plan corrected; canonical paths are `steps.<nodeId>.grpc.*` and `grpc.<saveAs>.*` |
| B15 | `grpcAssert` `grpcField` accepted malformed JSONPath at config time | Added config-time JSONPath syntax validation in `validateGrpcAssertNodeData` |
| B16 | Transport-exception catch paths missed `capturedGrpcDetails` for unary/stream | Added `captureGrpcDetails(...)` in unary/stream catch paths |

---

## Acceptance checklist traceability

| # | Item | Test file | Test name | Result |
|---|------|-----------|-----------|--------|
| 1 | Two gRPC call nodes do not overwrite each other's scoped outputs | `grpcPhase6iAcceptance.test.ts` | `checklist-1: two-node namespace isolation` | ✅ PASS |
| 2 | `onError: continue` allows downstream execution and carries error detail | `grpcPhase6iAcceptance.test.ts` | `checklist-2: onError continue propagates error detail` (×3) | ✅ PASS |
| 3 | `grpcServerStream` always terminates via a recorded stop reason | `grpcPhase6iAcceptance.test.ts` | `checklist-3: stream stop reason recorded on result` (×3) | ✅ PASS |
| 4 | Retry fires on call nodes but NOT on `grpcAssert` | `grpcPhase6iAcceptance.test.ts` | `checklist-4: retry policy fires on call node but not assert node` (×2) | ✅ PASS |
| 5 | `saveAs` aliases resolve correctly in downstream variable context | `grpcPhase6iAcceptance.test.ts` | `checklist-5: saveAs alias resolves in downstream variable context` (×2) | ✅ PASS |
| 6 | Each result carries `workflowNodeId` for per-step routing | `grpcPhase6iAcceptance.test.ts` | `checklist-6: each result carries workflowNodeId for per-step routing` (×3) | ✅ PASS |

---

## Per-phase test coverage

| Phase | File | Tests |
|---|---|---|
| 6A–6B | `grpcWorkflowNodeValidation.test.ts` + `grpcPhase6Acceptance.test.ts` + `useWorkflowExecution.test.ts` | ~40 |
| 6C–6D | `graphRunner.grpc.test.ts` | ~30 |
| 6E | `grpcPhase6efAcceptance.test.ts` | ~8 |
| 6F | `grpcPhase6efAcceptance.test.ts` | ~4 |
| 6G–6H (adapter) | `grpcWorkflowOutputAdapter.test.ts` | 23 |
| 6G–6H (acceptance) | `grpcPhase6ghAcceptance.test.ts` | 12 |
| 6G–6H (UI) | `NodeConfigOutputTab.test.tsx` (gRPC section) | 13 |
| 6G–6H (handler) | `graphRunnerGrpcNodeHandlers.test.ts` | 23 |
| 6I | `grpcPhase6iAcceptance.test.ts` | 15 |
| **Total (gRPC)** | | **~163** |

---

## Defect triage

### P0 (blocking — must fix before merge)

None.

### P1 (regression — must fix before merge)

None. (Three P1 candidates identified during 6I re-evaluation; all fixed before final run — see B1–B3 above.)

### P2 (quality improvement — defer to Phase 7)

| ID | Item | Decision |
|----|------|----------|
| P2-1 | `grpcAssert` does not validate `grpcField` JSONPath syntax at config time | **Shipped in Phase 6 hardening** (B15) |
| P2-2 | `captureGrpcDetails` not called in transport-exception catch path | **Shipped in Phase 6 hardening** (B16) |
| P2-3 | SSE connection close without `grpc-end` event defaults to `stream_end` OK | Acceptable — mirrors server half-close; collector records `stream_end` when the body completes without an explicit terminal frame |

---

## Adversarial Re-evaluation (2026-07-01)

Extra hardening pass completed after closing deferred items B15/B16.

### Scope

- Added malformed `grpcAssert.assertions[].grpcField` matrix coverage (invalid + valid path corpus).
- Re-ran focused validator tests.
- Re-ran fast Phase 6 checkpoint and full `phase6i` chain.

### Evidence commands

- `npx vitest run src/features/workflow/utils/grpcWorkflowNodeValidation.test.ts --reporter=verbose`
- `npm run test:grpc:fast -- 6i`
- `GRPC_FORCE_TSC=1 npm run test:grpc:phase6i`

### Result

- ✅ Malformed-path matrix rejects invalid JSONPath-like syntax at config time.
- ✅ Valid-path matrix remains accepted (no regression to existing supported forms).
- ✅ Fast + full Phase 6 gates remain green.

## Adversarial Re-evaluation #2 (2026-07-01)

Second hardening pass completed to stress assertion-shape validators beyond `grpcField`.

### Scope

- Added `grpcTrailer` matrix coverage for blank-name and missing-operator rejection, plus accepted operator forms.
- Added `grpcDuration` matrix coverage enforcing finite-number semantics for `min`/`max`.
- Re-ran focused validator tests.
- Re-ran fast Phase 6 checkpoint and full `phase6i` chain.

### Evidence commands

- `npx vitest run src/features/workflow/utils/grpcWorkflowNodeValidation.test.ts --reporter=verbose`
- `npm run test:grpc:fast -- 6i`
- `GRPC_FORCE_TSC=1 npm run test:grpc:phase6i`

### Result

- ✅ `grpcTrailer` assertions now have adversarial matrix lock for name/operator contract.
- ✅ `grpcDuration` assertions now have adversarial matrix lock for finite `min`/`max` requirement.
- ✅ Fast + full Phase 6 gates remain green after the additional matrix suite.

## Phase 7 entry criteria

All gate criteria satisfied:

- [x] `npm run test:grpc:phase6i` green (acceptance + full 6A→6H regression chain)
- [x] `npx tsc -b --noEmit` — 0 errors
- [x] No open P0 / P1 issues
- [x] Runbook updated (`docs/guides/grpc-phase6-runbook.md`)
- [x] All acceptance checklist items traced to passing tests

**Phase 7 may begin**: Tauri native gRPC transport, channel pooling, and desktop descriptor caching.
