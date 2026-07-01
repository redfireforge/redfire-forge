# gRPC Studio — Phase 4 Security Validation Report (4I)

Sign-off document for Phase 4 TLS/auth hardening before Phase 5 collections/history work.

**Date:** 2026-06-28  
**Scope:** Phase 4A–4I (browser + Express proxy + export/replay contracts)  
**Gate command:** `npm run test:grpc:phase4i`

## Executive summary

Phase 4 introduces TLS/mTLS transport, per-call auth (Bearer, Basic, API key, OAuth2), secret vault persistence, masked secret UI, transport error classification, Spring Boot hints, and cross-feature export/replay contracts. All Phase 4A threat items (T1–T10) have implemented mitigations with automated regression coverage. **No open P0/P1 security or data-leak defects** remain in Phase 4 scope.

## Threat model sign-off (4A → 4I)

| ID | Threat | Mitigation | Verification |
|---|---|---|---|
| T1 | Bearer token in call history | `redactGrpcMetadataForExport`, `prepareGrpcCallHistoryExport`, `redactGrpcSavedRequestForPersist` | `grpcRedaction.test.ts`, `grpcCrossFeatureExport.test.ts`, `grpcSavedRequest.test.ts`, `grpcPhase4Acceptance.test.ts` |
| T2 | PEM in error toast/envelope | `sanitizeGrpcErrorMessage`, transport error envelopes | `grpcTransportErrors.test.ts`, `grpcRedaction.test.ts`, `grpcPhase4Acceptance.test.ts` |
| T3 | OAuth secret in browser network | Server-side token fetch only; `prepareGrpcExecuteRequestMetadata` OAuth2 passthrough | `grpcOAuth2TokenService.test.ts`, `grpcStudioTypes.test.ts`, `grpcReplayResolver.test.ts` |
| T4 | Manual Authorization vs auth panel | `mergeGrpcExecuteMetadata` — auth wins | `grpcAuthPolicy.test.ts`, `grpcPhase4Acceptance.test.ts` |
| T5 | mTLS without client key reaches network | `validateGrpcTlsConfigContract` blocks locally | `grpcTlsPolicy.test.ts`, `grpcStudioSessionHelpers.test.ts`, `grpcPhase4Acceptance.test.ts` |
| T6 | `-bin` metadata corruption | `metadataValidation.ts` base64 gate | `metadataValidation.test.ts`, `grpcPhase4Acceptance.test.ts` |
| T7 | BSR token in export | `redactGrpcProtoIngestState` | `grpcRedaction.test.ts` |
| T8 | SNI override in plaintext mode | `normalizeGrpcTlsConfig` strips override when disabled | `grpcTlsPolicy.test.ts`, `grpcPhase4Acceptance.test.ts` |
| T9 | SSRF via URL/BSR fetch | Phase 3 server-side gateways (unchanged) | `protoFetchPolicy.test.ts` |
| T10 | Secret rehydrated into UI after save | Write-only masked fields + Clear stored (4G) | `grpcSecretFieldUi.test.ts`, `grpcTabSecretVault.test.ts` |

## Defect triage summary

| Severity | Open | Notes |
|---|---|---|
| P0 | 0 | — |
| P1 | 0 | — |
| P2 | 0 | — |
| Deferred | — | E2E Playwright suite for TLS/auth UI (optional; not blocking Phase 5) |
| Shipped | 5F | grpcurl PEM/descriptor file-path import (`parseGrpcurlCommand`, `test:grpc:phase5fg`) |
| Deferred | — | OAuth token URL SSRF hardening policy (future; server-side fetch only today) |

## Data-leak surfaces audited (4E + 4H)

Forbidden persist targets (`GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS`):

- `grpc_call_history_v1` — `prepareGrpcCallHistoryExport`
- `grpc_export_bundle` — `prepareGrpcExportBundle`
- `workflow_node_snapshot` — `prepareGrpcWorkflowNodeExport`
- `harness_scenario_export` — `prepareGrpcHarnessScenarioExport`

Additional surfaces:

- grpcurl CLI export — `filterMetadataForGrpcurlExport` (no tokens/PEM)
- Clipboard copy grpcurl — schema browser uses export builder (no metadata secrets by default)
- Saved request persist — `redactGrpcSavedRequestForPersist` (4H)

Leak scan regression: `grpcSecretLeakScan.test.ts`, `grpcCrossFeatureExport.test.ts`.

## Safe-default verification

| Default | Expected | Test evidence |
|---|---|---|
| OAuth2 never client-side Authorization merge | Manual metadata only at execute | `grpcStudioTypes.test.ts`, `grpcReplayResolver.test.ts` |
| Tab vault PEM over saved PEM at replay | Secrets from active tab | `grpcSavedRequest.test.ts`, `grpcReplayResolver.test.ts` |
| Auth type mismatch + redacted saved → tab vault | Executable replay | `grpcSavedRequest.test.ts` |
| Explicit saved target ignores tab connection profile | No profile TLS drift | `grpcReplayResolver.test.ts` |

## Sign-off checklist

- [x] Phase 4 acceptance checklist mapped to `grpcPhase4Acceptance.test.ts`
- [x] `npm run test:grpc:phase4i` green (acceptance + 4A–4H chain)
- [x] Threat model T1–T10 mitigations traced to tests
- [x] Runbook published: `grpc-phase4-runbook.md`
- [x] Cross-feature matrix published: `grpc-cross-feature-matrix.md`

**Phase 4 signed off for Phase 5 entry.**
