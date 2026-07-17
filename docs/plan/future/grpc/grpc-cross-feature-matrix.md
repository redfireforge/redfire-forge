# gRPC Studio — Cross-Feature Integration Matrix (Phase 4H + 5F/5G)

This document complements automated tests in `test:grpc:phase4h` and `test:grpc:phase5fg`. It records how Phase 4
TLS/auth/redaction rules and Phase 5 grpcurl interop propagate to adjacent phases.

## Matrix

| Source | Consumer | Module | Secret rule | Env interpolation | Auth precedence |
|---|---|---|---|---|---|
| Execute snapshot | Call history (`grpc_call_history_v1`) | `prepareGrpcCallHistoryExport` | Redact via `prepareGrpcCallHistoryRecord` | Target resolved at replay | Auth panel overrides manual metadata |
| Tab + saved request | Replay execute snapshot | `resolveGrpcSavedRequestReplay` | TLS/auth secrets from tab vault | `resolveTabConnectionWithEnv` | `mergeGrpcExecuteMetadata` at replay |
| Execute snapshot | Workflow node export | `prepareGrpcWorkflowNodeExport` | Redacted snapshot only | Workflow env at run (Phase 6) | Frozen in export |
| Execute snapshot | Harness scenario export | `prepareGrpcHarnessScenarioExport` | Redacted snapshot only | Harness env at run (Phase 8) | Frozen in export |
| Execute snapshot | Export bundle | `prepareGrpcExportBundle` | Saved request + snapshot redacted | Target template preserved | Auth secrets stripped |
| Active call / saved request | grpcurl CLI | `buildGrpcurlInvokeCommand*` + `filterMetadataForGrpcurlExport` | Never embed PEM/tokens | Address literal / template | `-H` only; secret keys omitted |
| grpcurl CLI | Studio import | `parseGrpcurlCommand` | PEM flags → file paths only | Target literal preserved | `-H` → metadata map |

## Phase 11H — Advanced feature exports

| Source | Consumer | Module | Secret rule | Reproducibility metadata |
|---|---|---|---|---|
| Load-test run summary | Clipboard JSON/CSV | `prepareGrpcLoadTestRunSummaryExportSafe` | Sanitize `attempts[].errorMessage`; leak-scan `grpc_load_test_export` | `sourceMetadata` (service, method, descriptor key, transport, target template) |
| Schema diff report | Clipboard JSON/Markdown | `prepareGrpcSchemaDiffReportExportSafe` | Sanitize change descriptions; leak-scan `grpc_schema_diff_export` | `exportMeta` (baseline captured at, exported at) |
| Saved request / history replay | Advanced load test | `useGrpcStudioReplayActions` → `prepareExecuteSnapshot` → `buildGrpcAdvancedFeatureSourceMetadata` | Execute snapshot secrets never enter export; metadata-only stamping | Target template + descriptor key preserved |
| Workflow node export | — | `prepareGrpcWorkflowNodeExport` (unchanged) | Redacted snapshot only | Frozen at export |
| Harness result export | — | `prepareGrpcHarnessResultReportExport` (unchanged) | Phase 8H redaction | Scenario name + timestamps |

Advanced integration path (implicit, no dedicated collection actions in 11H):

1. **Replay** saved request or history entry → lands on `studio` sub-nav.
2. User opens **Advanced** sub-nav → load test uses frozen `prepareExecuteSnapshot`.
3. **Export** routes through Phase 11H safe prepare helpers before clipboard write.

## Phase 11N — Cross-surface promotion

| Source | Consumer | Module | Secret rule | Notes |
|---|---|---|---|---|
| Studio load-test profile | Harness fixture JSON | `prepareGrpcLoadTestProfileHarnessFixture` | Config only; no PEM/tokens | `kind: grpc_load_test_profile` |
| Studio load-test run summary | Harness result bundle | `prepareGrpcHarnessResultReportExportWithAdvanced` | `prepareGrpcLoadTestRunSummaryExportSafe` | `advancedAttachments.loadTestSummary` |
| Studio schema diff report | Harness result bundle | `prepareGrpcHarnessResultReportExportWithAdvanced` | `prepareGrpcSchemaDiffReportExportSafe` + Markdown | `advancedAttachments.schemaDiffReport` |
| Workflow `grpcLoadTest` node | Downstream workflow vars | `GrpcWorkflowOutputRegistry.publishLoadTestSummary` | Summary ref only (counts/latency) | `steps.{nodeId}.grpc.loadTestSummary` |
| Workflow `grpcSchemaDiff` node | Downstream workflow vars | `GrpcWorkflowOutputRegistry.publishSchemaDiffSummary` | Counts only in namespace | Fails step when `breaking > 0` |
| Workflow `grpcMockAssert` node | Mock listener (11M) | `handleGrpcMockAssertNode` | Uses `listenTarget` + descriptor key | No secrets in node data |
| Saved request baseline descriptor | Collections compare | `compareGrpcSavedRequestSchema` | Resolver loads descriptors at compare time | `buildSavedRequestSchemaCompareIntent` |
| History entry descriptor | Drift diff on replay | `buildGrpcHistoryDescriptorDriftReport` | History rows already redacted at persist | `detectGrpcHistoryDescriptorDrift` |

Workflow advanced node path:

1. **Author** workflow with `grpcLoadTest` / `grpcSchemaDiff` / `grpcMockAssert` node data (Designer modals deferred).
2. **Run** via `runGraph` with `buildGrpcNodeOperations()` (`resolveDescriptor` + `resolveLoadTestProfile` for production Quick Test).
3. **Read** `grpc.loadTestSummary` / `grpc.schemaDiffSummary` or step-scoped `steps.{nodeId}.grpc.*` in downstream nodes.

## Phase 11O — Server-streaming load testing

| Source | Consumer | Module | Secret rule | Notes |
|---|---|---|---|---|
| Studio server-streaming RPC | Advanced load-test scheduler | `startGrpcStudioLoadTestRun` → `captureAndStartGrpcLoadTestStreamSchedulerRun` | Uses execute snapshot only; no PEM in config | Express proxy via `collectGrpcWorkflowServerStream` |
| Load-test config | Stream collector cap | `resolveGrpcLoadTestStreamCollectConfig` | Config only | Default `maxMessages: 10`; UI field + profile JSON |
| Scheduler report | Studio runtime status | `resolveLoadTestRunOperationTransition` | Counts only | Fails on partial failures / cancel via shared derive helpers |
| Active tab transport | Stream load-test validation | `validateLoadTestPreconditions` | N/A | Blocks browser-direct (`grpc-web` / `spring-servlet`) for 11O v1 |

Server-streaming load path:

1. User selects a **server-streaming** method on the active tab.
2. **Advanced → Load test** shows call-type badge + optional **Max messages / stream**.
3. **Start** runs bounded concurrent stream collectors; **Stop** cooperatively cancels in-flight attempts.

## grpcurl flag mapping (Phase 5F/5G)

| grpcurl flag | Studio field | Import | Export |
|---|---|---|---|
| `-plaintext` | `tlsMode: disabled` | ✅ | ✅ |
| (no flag) | `tlsMode: tls` | ✅ | ✅ |
| `-cert` + `-key` | `tlsMode: mtls`, `tlsFilePaths` | ✅ | partial (when context supplies paths) |
| `-cacert` | `tlsFilePaths.caCertPath` | ✅ | partial |
| `-d '{...}'` | `body` (JSON object) | ✅ | ✅ |
| `-H 'Key: value'` | `metadata[key]` (lowercase) | ✅ | ✅ (secrets omitted) |
| `-authority` | `tlsConfig.serverNameOverride` | ✅ | ✅ |
| `host:port` | `target` | ✅ | ✅ | Supports `{{envVar}}` and `[ipv6]:port` |
| `package.Service/Method` | `service` + `method` | ✅ | ✅ |
| `-proto` (repeat) | `descriptorImport.protoPaths[]` | ✅ | partial |
| `-protoset` | `descriptorImport.protosetPath` | ✅ | partial |
| `-import-path` (repeat) | `descriptorImport.importPaths[]` | ✅ | partial |
| `-insecure` | — | ⚠️ unsupported diagnostic | — |

Programmatic matrix: `GRPC_GRPCURL_FLAG_COMPAT_MATRIX` in `grpcGrpcurlTypes.ts`.

## Saved-request replay contract

1. **Persist:** `createGrpcSavedRequestFromSnapshot` (+ optional `connectionId` tab context) → `redactGrpcSavedRequestForPersist` (no raw secrets).
2. **Replay:** `buildReplayTabState` merges saved inputs with active tab vault material; tab `serverNameOverride` overrides saved when set; profile-only saved requests (`connectionId` without `target`) skip tab target/TLS/profile fallback; explicit-target saves ignore tab `connectionId`.
3. **Execute:** `resolveGrpcSavedRequestReplay` → `captureGrpcTabExecuteSnapshotFromResolution` + `prepareGrpcExecuteRequestMetadata` (OAuth2 skips client-side Authorization merge per Phase 4D).
4. **grpcurl export:** `buildGrpcurlInvokeCommandFromSavedRequest(saved, context?)` — optional `GrpcGrpcurlExportContext` supplies descriptor/TLS **file paths** when known; PEM never embedded.

Phase 5H collection/history UI will wire import/export actions; Phase 5F/5G validate utilities with unit tests only.

## Phase gates

```bash
npm run test:grpc:phase5fg   # 5F + 5G interop
npm run test:grpc:phase4h    # 4H regression (grpcurl v1 parity)
npm run test:grpc:phase4i    # full Phase 4 hardening chain
npm run test:grpc:phase11h   # 11H advanced export safety (+ 11G regression)
```
