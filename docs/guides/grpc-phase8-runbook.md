# gRPC Studio — Phase 8 Runbook (8I)

Operational gate and troubleshooting for **gRPC Test Runner / Harness Integration** (Phase 8A–8I).

## Gate commands

| Gate | Command |
|---|---|
| Phase 8I full hardening gate | `npm run test:grpc:phase8i` |
| Phase 8I acceptance only | `npx vitest run src/shared/grpc/grpcPhase8iAcceptance.test.ts` |
| Full Phase 8 regression (8A→8I) | `npm run test:grpc:phase8` |
| Phase 8H export/redaction | `npm run test:grpc:phase8h` |
| Phase 8G result model | `npm run test:grpc:phase8g` |
| TypeScript check | `npx tsc -b --noEmit` |

**Prerequisites:** Node 20+, `npm install`. Unit tests use mocked transport — no live gRPC server required.

**Optional E2E (merge-to-`develop` gate):**

```bash
cd docker/grpc && docker compose up -d
npm run server   # separate terminal
npm run test:e2e:grpc
```

See [grpc-phase1-runbook.md](./grpc-phase1-runbook.md) for Docker echo fixture setup.

---

## Phase 8 features

### Harness scenario model (8A)

- Single `actionType: 'grpcCall'` with `callType`: `unary` | `server_streaming` | `client_streaming` | `bidi_streaming`.
- `method: 'GRPC'` on harness scenarios.
- Import validation rejects malformed streaming configs (missing `collect`, empty `sendMessages`, etc.).

### Execution snapshots (8B)

- Immutable `GrpcHarnessExecuteSnapshot` built before transport.
- Template interpolation for target, metadata, body, auth, assertions.
- Snapshot export uses Phase 4H `prepareGrpcHarnessExecuteSnapshotExport`.

### Harness executor (8C)

- `executeGrpcAction` in `grpcExecution.ts` — unified entry for Test Runner.
- All four call types dispatch through `executeGrpcHarnessScenario`.
- `RequestResult.transportType: 'grpcCall'` with `grpcResultMeta`.

### Assertion engine (8D)

- Seven assertion kinds: `grpcStatus`, `grpcField`, `grpcNumericField`, `grpcStreamField`, `grpcTrailer`, `grpcDuration`, `grpcStreamLength`.
- Assertions evaluate **after** transport; not retried on assertion failure.
- `skipAssertions` toolbar override respected via `buildSelectedTests`.

### Numeric/trailer hardening (8E)

- `grpcNumericField` uses BigInt-safe comparisons for int64/uint64 string boundaries.
- `grpcTrailer` resolves mixed-case trailer keys via normalized map.

### Data-source expansion (8F)

- Parameterized rows interpolate `grpcCallAction` fields (body, metadata, target, assertions).
- Each row gets stable `dataRowId` and `buildGrpcHarnessRowTraceKey(scenarioId, dataRowId)`.
- Unresolved templates → `errorCategory: 'serialization'` before transport.

### Result model (8G)

- Canonical `GrpcHarnessResult` on `grpcResultMeta.harnessResult`.
- Status precedence: `timeout` > `error` > `failed` > `passed`.
- Per-assertion `assertionResults[]` with stable names (`grpcField:$.path`, etc.).
- `errorMessage` aligned with `harnessResult.errorDetail`.

### Export redaction (8H)

- `grpcHarnessExport` redacts harness results for reports and file exports.
- Runner HTML/JSON/markdown reports, Export JSON, and Export CSV all redact gRPC rows.
- Leak scan targets: `harness_result_export`, `runner_artifacts`.

---

## Troubleshooting harness failures

### Scenario fails validation on import

| Symptom | Cause | Fix |
|---|---|---|
| `missing_descriptor_key` | No `descriptorKey` on `grpcCallAction` | Set descriptor from schema browser or proto ingest |
| `streaming_collect_required` | Server/bidi stream missing bounds | Add `collect.maxMessages` and/or `collect.maxDurationMs` |
| `client_stream_send_messages_required` | Client/bidi missing outbound messages | Add non-empty `sendMessages[]` |

Run `validateGrpcHarnessScenario(scenario)` in a unit test or check import error details.

### Assertion failure but response looks correct

1. Check assertion path syntax — `grpcField` uses JSONPath `$` relative to response body.
2. For streams, use `grpcStreamField` with `index` (0-based message position).
3. For int64 fields, ensure values are compared as strings (`"9223372036854775807"`).
4. For trailers, keys are case-insensitive (`X-Custom` matches `x-custom`).
5. Confirm `skipAssertions` is not enabled in Test Runner toolbar.

Stable failure messages follow: `assertions[N]: <kind> ...`

### `errorCategory: serialization`

Snapshot build failed before transport — usually unresolved `{{var}}` tokens.

- Verify environment variables resolve at run time (`grpcHarnessEnv` in executor).
- Check data-source column mappings produce values for all `{{bodyColumn}}` placeholders.

### `errorCategory: network` or transport errors

- Verify target address (`host:port`, no scheme).
- For live calls: `cd docker/grpc && docker compose up -d`.
- Check Express backend: `npm run server` on port 3001.
- Review `grpcResultMeta.grpcStatus` and `grpcStatusMessage`.

### `status: timeout`

gRPC status code 4 (`DEADLINE_EXCEEDED`) maps to harness `timeout` status (precedence over `failed`).

### `passed: false` with no assertion failures

Check scenario `validation` mode — HTTP-style field validation may fail independently of gRPC assertions.

### Export still contains secrets

Redaction applies to:

- Generate Report (HTML/JSON/Markdown)
- Results Dashboard Export JSON / Export CSV
- `prepareGrpcHarnessResultReportExport` bundles

Redaction does **not** apply to local IDB test-run persistence (local debugging storage). Use export paths for sharing.

Run leak scan in tests:

```ts
import { scanForbiddenGrpcPersistTargets } from 'src/shared/grpc/grpcSecretLeakScan';
scanForbiddenGrpcPersistTargets({ harness_result_export: report });
```

### Parameterized rows show wrong body

- Confirm data-source column `type: 'body'` mapping matches template key (`{{msg}}` → column `msg`).
- Each expanded row should have unique `dataRowId` on `RequestResult`.

---

## Phase 9 entry

Phase 8 is complete when:

- `npm run test:grpc:phase8i` passes (includes 8A→8H regression chain)
- `npm run test:grpc:phase8` — optional full 8A→8I sequential wrapper
- Validation report signed off: [grpc-phase8-validation-report.md](./grpc-phase8-validation-report.md)

Phase 9 adds environment variable interpolation (`{{grpcHost}}`, etc.) in Studio and harness adapters.
