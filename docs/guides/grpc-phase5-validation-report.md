# gRPC Studio — Phase 5 Validation Report (5I)

Sign-off document for Phase 5 (Saved Requests, Collections & History) before Phase 6 workflow integration.

**Date:** 2026-07-01  
**Scope:** Phase 5A–5I (persistence, replay, redaction, grpcurl interop, UI, snapshot baseline)  
**Gate command:** `npm run test:grpc:phase5i`

## Executive summary

Phase 5 delivers saved request collections, call history, grpcurl import/export parity, secret-safe persistence, replay with schema drift analysis, Studio UI for collections/history (5H), and Kreya-style **unary response snapshot baselines** (5I). All Phase 5 acceptance checklist items map to automated tests. **No open P0/P1 defects** in replay correctness, data safety, or grpcurl interop.

## Acceptance checklist traceability

| Checklist item | Verification |
|---|---|
| Saving/reloading unary and streaming requests preserves `callType` and method binding | `grpcReplayTabApply.test.ts`, `useGrpcStudioReplayActions.test.ts`, `grpcReplayBinding.test.ts` |
| Replaying history uses env interpolation; preserves descriptor identity | `grpcReplayBinding.test.ts` (`resolveGrpcHistoryEntryReplay`), `grpcReplayResolver.test.ts` |
| History redacts secrets and enforces body cap | `grpcCallHistoryRecorder.test.ts`, `grpcPersistRedactionMiddleware.test.ts`, `grpcPhase5Acceptance.test.ts` |
| grpcurl import handles descriptor/TLS flags | `grpcGrpcurlImport.test.ts`, `grpcGrpcurlPhase5fg.test.ts` |
| grpcurl export round-trips without semantic drift | `grpcGrpcurlPhase5fg.test.ts`, `compareGrpcGrpcurlSemanticParity` |
| Collections/history UI wired (5H) | `test:grpc:phase5h`, `GrpcStudioPage.test.tsx` |
| Response snapshot baseline (5I) | `grpcResponseSnapshot.test.ts`, `GrpcResponseSnapshotPanel.test.tsx` |
| E2E collections/history sweep | `e2e/grpc-studio-collections-history.spec.ts` |

## Defect triage summary

| Severity | Open | Notes |
|---|---|---|
| P0 | 0 | — |
| P1 | 0 | — |
| P2 | 0 | — |
| Shipped | 5I | Stream multi-message snapshot baselines; saved-request run stats counters |
| Shipped | 5I | Collection JSON file export/import round-trip |

## Data safety surfaces (5E + 5H)

| Surface | Redaction path | Tests |
|---|---|---|
| Collections IDB/localStorage | `redactGrpcSavedRequestForPersist` | `grpcCollectionRepository.test.ts`, `test:grpc:phase5e` |
| Call history append | `prepareGrpcCallHistoryExport` | `grpcCallHistoryRecorder.test.ts` |
| Safe UI preview | `previewGrpcSavedRequestForUi`, `previewGrpcCallHistoryEntryForUi` | `grpcSafePreview.test.ts` |
| grpcurl export | `filterMetadataForGrpcurlExport` | `grpcGrpcurlExport.coverage-gaps.test.ts` |

## Replay & drift (5C)

- `isGrpcReplayExecutable` gates History Replay and Collections **Open in Studio** (blocking drift only).
- Missing loaded descriptor → **blocking** drift (`buildDescriptorMissingDrift`) for saved/history replay and grpcurl import.
- Target-changing replay preserves loaded descriptor when `descriptorKey` unchanged (`createTabDescriptorStateAfterReplayConnectionChange`).
- grpcurl drift analyzed against post-connection-invalidation descriptor state (`resolveDescriptorStateAfterTabPatch`).
- Truncated history bodies (`bodyTruncated: true`) produce **blocking** drift — replay and Send stay disabled until the body is re-entered.
- Send/Start blocked for **blocking** drift only (`isGrpcExecuteBlockedByDrift`); warning drift allows execute per plan 5H `isGrpcReplayExecutable` gate.
- Replay/import aborts in-flight unary and active streams **before** resolve (`abortTabInFlightCalls`).

## Save portability (5A/5H)

- Profile-only saves omit resolved `target` (`resolveSavedRequestTargetForPersist` + `tabContext` from save modal).
- Env template targets (`{{grpcHost}}`) persist verbatim instead of resolved address.

## grpcurl interop (5F/5G)

- grpcurl import runs `analyzeGrpcurlImportSchemaDrift` (same drift engine as saved/history replay).
- Import: `parseGrpcurlCommand` + `grpcurlImportToTabStatePatch` (preserves `grpcurlExportContext` + proto ingest path hints on tab).
- Export: `buildGrpcurlInvokeCommandFromSavedRequest/Snapshot`.
- Collections and history mutations surface `lastMutationError` in panel UI.
- Response snapshot compare requires matching `descriptorKey` on active tab.
- Parity gate: `npm run test:grpc:phase5fg`.

## Sign-off checklist

- [x] Phase 5 acceptance checklist mapped to `grpcPhase5Acceptance.test.ts`
- [x] `npm run test:grpc:phase5i` green (5I + 5A–5H regressions)
- [x] Runbook published: `grpc-phase5-runbook.md`
- [x] E2E spec: `grpc-studio-collections-history.spec.ts`

**Phase 5 signed off for Phase 6 workflow integration.**
