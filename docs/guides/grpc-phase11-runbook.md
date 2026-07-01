# gRPC Studio — Phase 11 Runbook (11I)

Operational gate and troubleshooting guide for Phase 11 advanced features:
- Load testing (11B, 11C)
- Mock server rules and runtime lifecycle (11D, 11E)
- Schema diff classification and exports (11F)
- Advanced panel orchestration and export safety (11G, 11H)

## Gate commands

| Gate | Command |
|---|---|
| Phase 11I hardening gate | `npm run test:grpc:phase11i` |
| Phase 11I fast local loop (no chained regressions) | `npm run test:grpc:phase11i:fast` |
| Phase 11I full merge gate (fresh TypeScript + chained regressions) | `npm run test:grpc:phase11i:full` |
| Phase 11H export safety regression | `npm run test:grpc:phase11h` |
| Phase 11G advanced UI regression | `npm run test:grpc:phase11g` |
| TypeScript check | `npx tsc -b --noEmit` |

Prerequisites: Node 20+, `npm install`.

## Recommended development cycle

1. While implementing or debugging Phase 11 changes, use `npm run test:grpc:phase11i:fast`.
2. Before push or handoff, run `npm run test:grpc:phase11i`.
3. Before merge gate / release sign-off, run `npm run test:grpc:phase11i:full`.

Notes:
- Fast mode keeps TypeScript and local acceptance checks, but skips chained regressions through `GRPC_SKIP_REGRESSION=1`.
- Full mode forces a fresh TypeScript pass via `GRPC_FORCE_TSC=1` and keeps the complete 11H -> 11G -> 11F -> 11E -> 11D -> 11C chain.

### Generic commands for all phases

Use these for any phase gate, including earlier phases:

- Fast lane: `npm run test:grpc:phase:fast -- <phase-id>`
	- Example: `npm run test:grpc:phase:fast -- 8f`
- Full lane: `npm run test:grpc:phase:full -- <phase-id>`
	- Example: `npm run test:grpc:phase:full -- 8f`

## Phase 11 operational checklist

1. Confirm method binding before advanced actions.
- Load testing supports unary methods only.
- If the active method is not unary, fix the method selection before starting a run.

2. Confirm descriptor context for schema diff.
- Capture baseline first.
- Compare baseline and candidate descriptors from the same expected source.

3. Confirm mock rule validity before start.
- Rules JSON must parse and validate.
- Invalid predicates or malformed response bodies must be corrected before runtime start.

4. Confirm safe exports.
- Use advanced export actions (JSON/CSV/Markdown) routed through safety helpers.
- Never bypass helpers with direct serialization in UI wiring.

## Troubleshooting: Load test panel

Symptom: Start action fails immediately.
- Cause: Validation failed (non-unary call type, invalid config, unresolved target, missing method).
- Fix:
1. Select a unary method.
2. Verify target validity in the studio connection panel.
3. Use valid config bounds (`concurrency`, `totalCalls`/`durationMs`).

Symptom: Run appears stuck.
- Cause: Long duration run or pending transport responses.
- Fix:
1. Use Cancel to request cooperative stop.
2. Verify run status transitions to `cancelled` or `completed`.
3. Re-run with smaller duration/call count when debugging.

Symptom: Export output missing source metadata.
- Cause: Export attempted without completed summary state.
- Fix:
1. Complete at least one successful run.
2. Export from latest run summary (state stores `lastExportSource`).

## Troubleshooting: Mock server runtime

Symptom: Mock runtime does not start.
- Cause: Rule JSON parse/validation failure.
- Fix:
1. Validate rule JSON structure.
2. Verify expression predicates avoid blocked tokens.
3. Re-run start after parser error clears.

Symptom: New rule commit not reflected in active call.
- Cause: Expected generation pinning behavior.
- Fix:
1. Finish in-flight call.
2. Start a new call to observe committed generation.

Symptom: One tab impacts another tab runtime.
- Cause: Unexpected shared-state mutation.
- Fix:
1. Verify tab-specific manager in registry.
2. Confirm per-tab start/stop operations and cleanup on tab close.

## Troubleshooting: Schema diff panel

Symptom: Compare action fails.
- Cause: Missing baseline descriptor or candidate descriptor.
- Fix:
1. Capture baseline first.
2. Ensure active tab has loaded descriptor before compare.

Symptom: Large diff list feels incomplete.
- Cause: UI cap intentionally limits visible rows.
- Fix:
1. Use severity filters to inspect subsets.
2. Export JSON/Markdown for full machine-readable review.

Symptom: Diff severity appears unexpected.
- Cause: Wire-compatibility classifier behavior.
- Fix:
1. Validate change type (removed field/number change/type shape change are breaking).
2. Review report `changes` payload and summary counts.

## Troubleshooting: Advanced export safety

Symptom: Export blocked by leak scanner.
- Cause: Secret-like values detected in forbidden persist targets.
- Fix:
1. Keep export paths routed through safe prepare helpers.
2. Sanitize source error text and descriptors before serialization.
3. Re-run export after sanitization confirms no leak findings.

Symptom: Markdown export missing metadata footer.
- Cause: Export bypassed safe markdown serializer.
- Fix:
1. Use `serializeGrpcSchemaDiffReportExportSafeMarkdown`.
2. Confirm `exportMeta` is stamped in safe report object.

## Known limits (Phase 11)

- Load testing remains unary-only in this phase.
- Mock runtime is in-process manager only; no external listener endpoint in Phase 11.
- Schema diff UI list is capped for rendering safety; full detail is available in exports.
- Advanced-feature workflow/harness promotion remains deferred beyond 11H.

## Sign-off references

- Validation report: `docs/guides/grpc-phase11-validation-report.md`
- Hardening acceptance: `src/shared/grpc/grpcPhase11iAcceptance.test.ts`
- Gate script: `scripts/test-grpc-phase11i.sh`
