# gRPC Studio — Phase 6 Runbook (6I)

Operational gate and troubleshooting for **gRPC Workflow Integration** (Phase 6A–6I).

## Gate commands

| Gate | Command |
|---|---|
| Phase 6I full hardening gate | `npm run test:grpc:phase6i` |
| Phase 6I acceptance only | `bash scripts/test-grpc-phase6i.sh` |
| Phase 6G+6H adapter + UI | `npm run test:grpc:phase6gh` |
| Phase 6A–6F type & executor suite | `npx vitest run src/shared/grpc/ src/features/workflow/` |
| TypeScript check | `npx tsc -b --noEmit` |

**Prerequisites:** Node 20+, `npm install`. No live gRPC server needed — all Phase 6 tests are pure unit/integration.

---

## Phase 6 features

### Workflow node types (6A–6B)

- **grpcUnary** — single request/response call with optional retry policy.
- **grpcServerStream** — bounded server-stream collector with configurable stop conditions.
- **grpcAssert** — assertion evaluation against frozen upstream step results (no network I/O).

### Execution (6C–6D)

- Unary nodes execute via `executeGrpcWorkflowUnary` with retry policy (`maxAttempts`, `backoffMs`, `retryOnStatuses`).
- Stream nodes execute via `collectServerStream` with stop conditions (`maxMessages`, `maxDuration`, `untilExpression`).
- Both nodes emit `RequestResult` with `transportType: 'grpcUnary' | 'grpcServerStream'` and `grpcResultMeta`.
- `workflowNodeId` on every result enables per-step routing in Results Explorer.

### Assert engine (6E)

- `grpcAssert` reads from `GrpcWorkflowStepResultStore` — never triggers transport.
- Assert failures are **not retried**. Retry policy applies only to call nodes.
- `onError: 'continue'` allows downstream execution even when assertions fail.

### Output namespace (6F)

- `steps.<nodeId>.grpc.body` — step-scoped body (always set on success).
- `grpc.<saveAs>.body` — saveAs alias body (set when `saveAs` is configured).
- `grpc.response.*` — global last-success gRPC response (last-write-wins across all call nodes).
- `grpc.stream` — serialized last stream message array.
- Two nodes with different `saveAs` aliases never overwrite each other's scoped output.

### Results diagnostics (6G–6H)

- `NodeRunStatus.grpcMeta: GrpcNodeStatusMeta` — per-node gRPC diagnostics in workflow output tab.
- `NodeConfigOutputTab` renders `GrpcMetaSection` for gRPC nodes (hides HTTP statusCode row).
- Assert pass shows "✓ All assertions passed" (`assertionFailures: []`); fail shows failure list.
- `ExecutionEvent.nodeType` includes `'grpcUnary' | 'grpcServerStream' | 'grpcAssert'`.
- `capturedGrpcDetails` populated for all three node types including assert pass path.

---

## Troubleshooting

### grpcUnary fails with "gRPC operations not configured"

The `runGraph` call is missing the `grpcOperations` parameter. Pass an object with:

```ts
const grpcOperations = {
  invokeUnary: async (req) => /* call your transport */,
  collectServerStream: async (req, tabId, collect, opts) => /* stream collector */,
};
```

### grpcAssert fails with "No committed gRPC step result for source"

The assert node's `source` field does not match any `nodeId` or `saveAs` alias from upstream call nodes.

- Check that an upstream `grpcUnary` or `grpcServerStream` with the matching node id or `saveAs` ran first.
- If the upstream node uses `onError: 'continue'` and failed, the step result is still committed (failed results are committed before traversal).

### grpcAssert always fails even when upstream succeeded

- Verify `assertions` array is not empty.
- Check assertion syntax: `{ grpcStatus: 0 }`, `{ grpcField: '$.path', equals: 'value' }`.
- `grpcField` paths use JSONPath `$` syntax relative to the response body.

### Stream node never terminates

All stop conditions are evaluated in order:
1. `abortSignal` fires → `cancelled`
2. `maxDuration` elapsed → `max_duration`
3. `untilExpression` matches → `until_expression`
4. `maxMessages` reached → `max_messages`
5. Server closes stream → `stream_end` or `stream_error`

Ensure at least one of `maxMessages`, `maxDuration`, or `untilExpression` is configured, otherwise the stream collector relies entirely on the server closing it (`stream_end`).

### Results Explorer shows same data for every step

Verify each `RequestResult` has `workflowNodeId` set correctly. All three gRPC node handlers (`handleGrpcUnaryNode`, `handleGrpcServerStreamNode`, `handleGrpcAssertNode`) set `workflowNodeId` via `buildGrpcResult`.

### onError:continue does not traverse outgoing edges

`onError: 'continue'` must be set on the **failing node's data**, not on the outgoing edge. Check `data.onError === 'continue'` in the node config JSON.

### NodeConfigOutputTab shows HTTP statusCode for gRPC node

`isGrpcNode` is `nodeRunStatus.grpcMeta !== undefined`. Ensure `onNodeStateChange` passes `grpcMeta` in the status update. All three handler paths (pass, fail, and transport exception catch) now populate `grpcMeta`.

### Trace event missing grpcDetails

`capturedGrpcDetails` map is populated by the `captureGrpcDetails` internal function. This is called:
- On unary/stream success and failure paths in `finalizeGrpcCallNode`.
- On assert **pass** and fail paths in `handleGrpcAssertNode`.
- Transport exception catch blocks set a minimal `grpcMeta` but do **not** call `captureGrpcDetails` (no step result to capture).
- Assert **fail** paths (including config errors) populate `capturedGrpcDetails` via `finishGrpcAssertFailure`.

---

## Acceptance checklist (automated)

All items are verified by `src/shared/grpc/grpcPhase6iAcceptance.test.ts`:

| Item | Test | Gate |
|------|------|------|
| Two nodes do not overwrite each other's scoped outputs | `checklist-1: two-node namespace isolation` | `test-grpc-phase6i.sh` |
| `onError: continue` allows downstream execution | `checklist-2: onError continue propagates error detail` (×3) | `test-grpc-phase6i.sh` |
| `grpcServerStream` terminates via recorded stop reason | `checklist-3: stream stop reason recorded on result` (×3) | `test-grpc-phase6i.sh` |
| Retry fires on call node, not on assert node | `checklist-4: retry policy fires on call node but not assert node` | `test-grpc-phase6i.sh` |
| `saveAs` aliases resolve in downstream expressions | `checklist-5: saveAs alias resolves in downstream variable context` | `test-grpc-phase6i.sh` |
| Each result carries `workflowNodeId` for per-step routing | `checklist-6: each result carries workflowNodeId` | `test-grpc-phase6i.sh` |

---

## Phase 7 entry criteria

Before starting Phase 7 (Tauri native transport):

1. `npm run test:grpc:phase6i` — green.
2. `npx tsc -b --noEmit` — 0 errors.
3. No open P0/P1 issues in workflow determinism, output collision, or retry policy handling.
4. `docs/guides/grpc-phase6-validation-report.md` — signed off.

See [`grpc-phase6-validation-report.md`](grpc-phase6-validation-report.md) for acceptance traceability and sign-off.
