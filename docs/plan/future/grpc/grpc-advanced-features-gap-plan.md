# gRPC Advanced Features Gap Plan

## Objective
Close the feature and UX gap between the advanced-features mockup and current gRPC implementation, with priority on the Load Testing panel.

## Phase Status Tracker

| Phase | Status | Notes |
|---|---|---|
| 1. Data Model & Compatibility | ✅ Completed | Contracts, validation, scheduler pacing, and profile normalization shipped |
| 2. Load Config UX Parity | ✅ Completed | Seconds-based UI inputs, request-rate control, unary template editor shipped |
| 3. Live Results & Charts | ✅ Completed | Added run status strip, status breakdown, latency histogram, throughput timeline, explicit legends, and compact responsive density tuning |
| 4. Export, Run History, Polish | ✅ Completed | Download JSON/CSV, persisted run history, baseline compare, and detailed two-run diff view shipped |
| 5. Tests & Acceptance | ✅ Completed | Phase 5-tagged suites + broad gRPC coverage/typecheck reruns passed; schema-diff test act warning resolved; manual browser smoke (configure → run → charts → export controls) completed |

## Re-evaluation Delta (Before Implementation)
The initial plan captured visible UI gaps, but deeper code-path review found additional dependency work that must be included:

1. Scheduler-level rate limiting is missing.
- `requestRateRps` requires execution-throttling in `grpcLoadTestSchedulerCore.ts`, not only a new UI field.

2. Profile compatibility needs schema normalization.
- Existing profile storage (`grpc_load_test_profiles_v1`) currently accepts/validates only the older config shape; new fields must be normalized during load and persisted safely.

3. Request template behavior must be scoped by call type.
- Template JSON editing should be available for unary first pass; server-streaming should keep existing snapshot behavior until stream template semantics are explicitly designed.

4. Validation surface must include both syntactic and semantic checks.
- JSON parse errors for request template should be surfaced in panel validation.
- Numeric constraints for `requestRateRps` should be integrated into `validateGrpcLoadTestConfig` so scheduler and profile layers share the same rules.

5. Unit conversion should remain UI-only for now.
- Keep contracts in milliseconds to avoid broad scheduler/report regressions; present seconds in UI with explicit conversion.

## Baseline Compared
- Mockup source: `docs/plan/future/grpc/mockups/06-advanced-features.html`
- Current gRPC load panel: `src/features/grpc/components/GrpcLoadTestPanel.tsx`
- Current gRPC advanced shell: `src/features/grpc/components/GrpcAdvancedFeaturesShell.tsx`
- Reference implementations:
  - WebSocket load testing: `src/features/websocket/WebSocketLoadTest.tsx`
  - GraphQL mock panel: `src/features/graphql/components/GraphqlMockPanel.tsx`
  - GraphQL latency histogram: `src/features/graphql/components/GqlLatencyHistogram.tsx`

## Gap Matrix (Mockup vs Current)

### A. Load Configuration (High Priority)
1. Missing explicit RPC method selector in Load panel.
- Mockup has method selector in config form.
- Current uses active tab/method implicitly and only displays call type badge.

2. Missing request-rate control (RPS cap).
- Mockup includes `Request Rate (RPS, 0 = unlimited)`.
- Current config model has no request-rate field in `GrpcLoadTestConfig`.

3. Missing request body template editor in Load panel.
- Mockup includes template textarea with variable examples.
- Current uses active tab snapshot payload only; no inline template editing in load panel.

4. Unit mismatch for Duration/Ramp-up.
- Mockup uses seconds.
- Current fields are milliseconds.

### B. Live Runtime Feedback (High Priority)
1. Missing run header context and runtime pill details.
- Mockup shows run descriptor (`Run #`, elapsed/total) and running badge.
- Current shows generic `Results` with limited run context.

2. Missing richer live KPI cards.
- Mockup includes throughput, success %, p50, errors during run.
- Current live mode mostly exposes counts + progress.

### C. Results Visualization (High Priority)
1. Missing latency histogram panel.
- Mockup includes histogram with buckets and axis.
- Current gRPC panel has no histogram rendering.

2. Missing status-code breakdown visualization.
- Mockup includes donut + per-code legend.
- Current only shows aggregate error rate.

3. Missing throughput-over-time chart.
- Mockup includes sparkline/bar timeline.
- Current panel has no throughput trend visualization.

### D. Export + Run Lifecycle (Medium Priority)
1. Export action is clipboard-only (`Copy JSON/Copy CSV`).
- Mockup implies file-style export action.
- Current should support both copy and download for parity and better UX.

2. No explicit run history selector/list in panel.
- Mockup examples imply identifiable run cards (`Run #3`).
- Current only keeps latest summary in state.

### E. Cross-Feature Consistency (Medium Priority)
1. WebSocket load testing has richer UX affordances not mirrored in gRPC:
- profile presets and contextual warnings,
- explicit running state panel,
- import/export JSON files,
- histogram + throughput trend.

2. GraphQL mock panel has stronger operations ergonomics not fully mirrored by gRPC load panel:
- segmented operational controls,
- clearer status chips and action grouping,
- stronger empty/guard/error messaging patterns.

## Non-Gaps / Already Good
1. Advanced feature tab shell exists and is extensible (`load_test`, `mock_server`, `schema_diff`, `rpc_statistics`, `native_diagnostics`).
2. Saved profiles are already present in gRPC load test panel.
3. RPC stats panel already includes export + reset and method-level rows.
4. gRPC mock panel already supports builder/json/runtime authoring and runtime controls.

## Proposed Implementation Plan

### Phase 1 — Data Model & Compatibility (Foundation)
1. Extend `GrpcLoadTestConfig` with:
- `requestRateRps?: number` (`0|undefined` => unlimited),
- optional `requestTemplateJson?: string` (if enabled for unary only in first pass).
2. Keep backward compatibility for saved profiles:
- migrate existing stored profiles with defaults,
- add schema-versioned repository migration in `grpcLoadTestProfileRepository`.
3. Add validation rules:
- min/max for request rate,
- template JSON validation with clear error paths.
4. Add scheduler throttling support:
- enforce `requestRateRps` in `grpcLoadTestSchedulerCore` launch loop,
- ensure behavior composes with concurrency + totalCalls + duration stopping conditions.

### Phase 2 — Load Config UX Parity
1. Add method selector UI bound to available methods in active descriptor.
- Keep active-tab method as default; explicit override per load profile.
2. Add request-rate input (`RPS cap`) and tooltip semantics.
3. Add request-template editor with minimal variable support and validator.
4. Normalize units to seconds in UI with ms conversion in model layer.

### Phase 3 — Live Results & Charts
1. Expand live KPI cards (throughput, success rate, p50, errors).
2. Add latency histogram component for gRPC summary attempts.
3. Add status-code distribution visualization (donut + legend).
4. Add throughput-over-time chart.
- Reuse chart patterns from WebSocket and GraphQL histogram utilities where practical.

### Phase 4 — Export, Run History, and Polish
1. Add file-download export actions (JSON/CSV) alongside copy actions.
2. Add run history list (latest N summaries) with quick reload/compare.
3. Add runtime status strip (run id, elapsed, stop reason).
4. Tighten responsive behavior and alignment to mockup spacing/tokens.

### Phase 5 — Tests & Acceptance
1. Unit tests for config migration + validation (including new fields).
2. Component tests for:
- method override,
- rate limiting field,
- template validation,
- chart presence and empty states,
- export buttons and run history.
3. End-to-end smoke flow:
- configure -> start -> stop/complete -> inspect charts -> export.

## Risks / Dependencies
1. Scheduler support for RPS throttling may require engine changes (not just UI).
2. Template injection for non-unary types must be carefully scoped (unary first).
3. Streaming methods need explicit messaging/caps to avoid unbounded memory (retain existing stream cap behavior).

## Acceptance Criteria
1. gRPC Load Testing panel reaches feature parity with mockup for config + results visibility.
2. No regressions in existing advanced tabs (mock, schema diff, rpc stats, diagnostics).
3. Saved profile compatibility preserved for existing users.
4. New behavior covered by targeted tests and type-safe contracts.

## Retrospective Notes (Pre-implementation)
1. Method override selector is intentionally deferred from the first coding pass because current execution snapshots are tab-bound and method-bound; adding override safely requires additional request snapshot plumbing.
2. Highest-value first-pass delivery is request-rate + template + seconds UX + scheduler throttling, which closes the largest practical parity gap with minimal regression risk.

## Implementation Sync (2026-07-10)

### Completed in this pass (Phase 1 + 2)
1. Shared load-test contract and validation updates.
- `requestRateRps` added with validation (`0|undefined` means unlimited).
- `requestTemplateJson` added and validated as unary-only JSON object text.
- Validation paths added for new fields to keep config, scheduler, and persistence behavior aligned.

2. Scheduler pacing updates.
- Request-rate throttling added to launch loop while preserving concurrency and stop/cancel semantics.

3. Profile compatibility and normalization.
- Repository normalization added for new config shape so older saved profiles remain loadable.

4. Load panel UX parity updates.
- Duration and ramp-up now represented in seconds in UI with ms conversion in model layer.
- Request-rate control added.
- Unary request template editor added.

5. Unary template application flow.
- Template application integrated into advanced command/hook start path before execution.

### Validation completed
1. Typecheck:
- `npx tsc -b --noEmit` passed.

2. Targeted vitest suites for Phase 1/2:
- `src/shared/grpc/grpcAdvancedFeatureContracts.coverage-gaps.test.ts`
- `src/shared/grpc/grpcLoadTestSchedulerCore.coverage-gaps.test.ts`
- `src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx`
- `src/features/grpc/data/grpcLoadTestProfileRepository.coverage-gaps.test.ts`
- `src/features/grpc/utils/grpcStudioAdvancedCommands.coverage-gaps.test.ts`

3. Broader gRPC coverage validation run:
- `npx vitest run src/features/grpc src/shared/grpc --coverage.enabled true --coverage.reporter=json-summary --coverage.reportsDirectory coverage-grpc`

### Remaining work
1. Phase 5: finalize acceptance checklist with broader Phase 3/4 focused test coverage and gRPC scoped coverage validation rerun.

### Incremental Implementation Sync (2026-07-10, Phase 3/4 slice)
1. Load-test results visualization added to `GrpcLoadTestPanel`:
- Run status strip (run id, duration, stop reason, completion time).
- Status-code breakdown bar list.
- Latency histogram bucket rows.
- Throughput-over-time bar timeline.

2. Export + run history UX:
- Added download-style JSON/CSV actions in addition to clipboard copy.
- Added run-history selector to switch the active displayed summary.
- Added hook state for run history entries and selected run tracking.

3. Test and validation updates:
- Updated `useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts` reset expectations to preserve run history context.
- Verified touched tests:
  - `src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx`
  - `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts`
- Typecheck passed: `npx tsc -b --noEmit`.

### Incremental Implementation Sync (2026-07-10, persisted history + compare slice)
1. Persisted load-test run history per tab:
- Added localStorage-backed run-history persistence in `useGrpcStudioAdvancedFeatures`.
- Restores persisted history for live tabs on hook mount.
- Prunes persisted payload to live tabs and bounded history length.

2. Run-to-run compare UX:
- Added compare baseline selector in `GrpcLoadTestPanel` when multiple runs exist.
- Added delta metrics (throughput, p50, p95, error rate) against selected baseline run.

3. Test and validation updates:
- Added hook test for restoring persisted load-test history.
- Added panel test coverage for run-history selector + compare card rendering.
- Verified touched tests:
  - `src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx`
  - `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts`
- Typecheck passed: `npx tsc -b --noEmit`.

### Incremental Implementation Sync (2026-07-10, compare-detail slice)
1. Explicit two-run compare detail rendering in `GrpcLoadTestPanel`:
- Added metric detail matrix with baseline/current/delta rows (throughput, success/error rates, p50/p95/p99 latency, measured attempts).
- Added status composition diff table by status code with baseline/current counts and percentage deltas.
- Kept compact delta cards (throughput, p50, p95, error rate) as quick-glance summary above detailed tables.

2. Styling polish for compare details:
- Added dedicated compare detail and status composition styles in `src/styles/grpc-studio.css`.
- Added responsive adjustments for detail/status grids on smaller widths.

3. Test and validation updates:
- Expanded panel coverage test assertions for compare detail and status composition sections.
- Verified touched tests:
  - `src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx`
  - `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts`
- Typecheck passed: `npx tsc -b --noEmit`.

### Incremental Implementation Sync (2026-07-10, Phase 3 legend + density slice)
1. Explicit legend additions for results visuals:
- Added percentile legend chips (p50/p95/p99 semantics) in `GrpcLoadTestPanel` summary results area.
- Added throughput series legend chips (successful vs failed attempts/s) in the throughput timeline card.

2. Small-screen chart density tuning:
- Tightened chart card padding/margins for narrower breakpoints.
- Reduced label/value font sizes and row spacing for histogram/status bars on small screens.
- Reduced throughput mini-bar widths/heights and label sizing for compact readability.

3. Test and validation updates:
- Expanded panel test assertions for percentile and throughput legend presence.
- Verified touched tests:
  - `src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx`
  - `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts`
- Typecheck passed: `npx tsc -b --noEmit`.

### Incremental Validation Sync (2026-07-10, Phase 5 scoped coverage rerun)
1. Broader gRPC-scoped coverage rerun completed:
- Command: `npx vitest run src/features/grpc src/shared/grpc --coverage.enabled true --coverage.reporter=json-summary --coverage.reportsDirectory coverage-grpc`
- Result: pass (all suites in scope passed; one non-failing React `act(...)` warning observed in a schema-diff session coverage test).

2. Fresh coverage snapshot (`coverage-grpc/coverage-summary.json`):
- Global instrumented summary for this run context: lines **60.83%**, statements **59.16%**, functions **66.76%**, branches **56.74%**.
- gRPC-scoped file-average summary (`src/features/grpc` + `src/shared/grpc`, 285 files): lines **98.55%**, statements **98.25%**, functions **99.01%**, branches **96.38%**.

3. Most significant current gRPC low-coverage files by line %:
- `src/features/grpc/components/GrpcCallPanel.testHelpers.tsx` — **25.00%** lines.
- `src/features/grpc/test-helpers/grpcAdvancedPanel.testHelpers.ts` — **50.00%** lines.
- `src/features/grpc/components/GrpcLoadTestPanel.tsx` — **65.93%** lines.
- `src/features/grpc/components/grpcCallPanel/grpcCallPanelHelpers.ts` — **90.00%** lines.
- `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts` — **91.66%** lines.

4. Immediate follow-up candidates for Phase 5 closure:
- Add/expand direct tests for `GrpcLoadTestPanel.tsx` branch paths beyond current compare/legend assertions.
- Add targeted unit tests for helper-only files currently used as fixtures/test wiring.

### Incremental Implementation Sync (2026-07-10, Phase 5 low-file lift slice)
1. Added targeted helper coverage tests.
- New test file: `src/features/grpc/components/GrpcCallPanel.testHelpers.coverage-gaps.test.tsx`.
- Validates exported `ECHO_METHOD` fixture shape and verifies `StatefulGrpcCallPanel` state patch wiring by asserting timeout input updates.

2. Expanded advanced panel helper coverage assertions.
- Updated `src/features/grpc/test-helpers/grpcAdvancedPanel.testHelpers.coverage-gaps.test.ts` to exercise default export helpers and callback mocks returned by `buildAdvancedMock`.
- Added assertions for export helper return values and fixture metadata consistency.

3. Expanded `GrpcLoadTestPanel` branch-path coverage.
- Updated `src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx` to cover download guard behavior when export source is unavailable.
- Added rerender branch assertion for compare-detail visibility when run history drops below compare threshold.

4. Validation completed for this slice.
- Targeted test run passed:
  - `src/features/grpc/components/GrpcCallPanel.testHelpers.coverage-gaps.test.tsx`
  - `src/features/grpc/test-helpers/grpcAdvancedPanel.testHelpers.coverage-gaps.test.ts`
  - `src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx`
- Typecheck passed: `npx tsc -b --noEmit`.

### Incremental Validation Sync (2026-07-10, post low-file lift rerun)
1. Broader gRPC-scoped coverage rerun completed:
- Command: `npx vitest run src/features/grpc src/shared/grpc --coverage.enabled true --coverage.reporter=json-summary --coverage.reportsDirectory coverage-grpc`
- Result: pass (all suites in scope passed; one non-failing React `act(...)` warning persists in `useGrpcAdvancedSchemaDiffSession.coverage-gaps.test.ts`).

2. Refreshed coverage snapshot (`coverage-grpc/coverage-summary.json`):
- Global instrumented summary for this run context: lines **60.87%**, statements **59.20%**, functions **66.91%**, branches **56.80%**.
- gRPC-scoped file-average summary (`src/features/grpc` + `src/shared/grpc`, 285 files): lines **98.99%**, statements **98.67%**, functions **99.49%**, branches **96.40%**.

3. Updated lowest gRPC files by line % (post-lift):
- `src/features/grpc/components/GrpcLoadTestPanel.tsx` — **68.13%** lines.
- `src/features/grpc/components/grpcCallPanel/grpcCallPanelHelpers.ts` — **90.00%** lines.
- `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts` — **91.66%** lines.
- `src/features/grpc/components/GrpcProtoHybridEditorModal.tsx` — **91.83%** lines.
- `src/shared/grpc/grpcHarnessNumericCompare.ts` — **92.30%** lines.

4. Notable outcome from this rerun:
- Prior low-file outliers are now lifted:
  - `src/features/grpc/components/GrpcCallPanel.testHelpers.tsx` — **100%** lines.
  - `src/features/grpc/test-helpers/grpcAdvancedPanel.testHelpers.ts` — **100%** lines.

### Incremental Validation Sync (2026-07-10, Phase 1 re-evaluation loop)
1. Completed deep Phase 1 implementation audit across contracts, scheduler, profile repository, and advanced command orchestration.
- Reviewed:
  - `src/shared/grpc/grpcAdvancedFeatureContracts.ts`
  - `src/shared/grpc/grpcLoadTestSchedulerCore.ts`
  - `src/features/grpc/data/grpcLoadTestProfileRepository.ts`
  - `src/features/grpc/utils/grpcStudioAdvancedCommands.ts`
  - `src/features/grpc/hooks/useGrpcLoadTestProfilesState.ts`

2. Discrepancy found and fixed in profile-apply flow.
- Issue: loading a saved load-test profile replaced the entire `loadTest` state object and could drop persisted run-history metadata (`runHistory`/`selectedRunId`) introduced in later phases.
- Fix: preserve existing load-test state fields during profile application and overwrite only config + transient run-result fields.
- Updated file:
  - `src/features/grpc/hooks/useGrpcLoadTestProfilesState.ts`

3. Added regression test coverage for the discrepancy.
- Updated `src/features/grpc/hooks/useGrpcLoadTestProfilesState.coverage-gaps.test.ts` to assert run-history metadata is preserved when applying a saved profile.

4. Re-validation completed after fix (clean pass).
- Command:
  - `npx vitest run src/features/grpc/hooks/useGrpcLoadTestProfilesState.coverage-gaps.test.ts src/shared/grpc/grpcAdvancedFeatureContracts.coverage-gaps.test.ts src/shared/grpc/grpcLoadTestSchedulerCore.coverage-gaps.test.ts src/features/grpc/data/grpcLoadTestProfileRepository.coverage-gaps.test.ts src/features/grpc/utils/grpcStudioAdvancedCommands.coverage-gaps.test.ts`
  - `npx tsc -b --noEmit`
- Result: **5/5 files passed, 77/77 tests passed, typecheck passed**.

### Incremental Validation Sync (2026-07-10, Phase 2 re-evaluation loop)
1. Completed deep Phase 2 audit over load-config UX parity paths.
- Reviewed:
  - `src/features/grpc/components/GrpcLoadTestPanel.tsx`
  - `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts`
  - `src/features/grpc/utils/grpcStudioAdvancedCommands.ts`

2. Discrepancy found and fixed in integer field parsing.
- Issue: several integer-only load-config fields used truncating parse semantics, so malformed decimal input (for example `1.5`) could be silently coerced instead of rejected/cleared.
- Fix: switched to strict integer parsing for positive/non-negative integer helpers in `GrpcLoadTestPanel` to avoid truncation.
- Updated file:
  - `src/features/grpc/components/GrpcLoadTestPanel.tsx`

3. Added regression coverage for malformed integer input handling.
- Updated `src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx` to assert decimal input no longer truncates for:
  - concurrency
  - totalCalls
  - requestRateRps
  - warmupCalls
  - maxMessagesPerStream

4. Re-validation completed after fix (clean pass).
- Command:
  - `npx vitest run src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts src/features/grpc/utils/grpcStudioAdvancedCommands.coverage-gaps.test.ts`
  - `npx tsc -b --noEmit`
- Result: **3/3 files passed, 103/103 tests passed, typecheck passed**.

### Incremental Validation Sync (2026-07-10, Phase 3 re-evaluation loop)
1. Completed deep Phase 3 audit across live results and chart rendering paths.
- Reviewed:
  - `src/features/grpc/components/GrpcLoadTestPanel.tsx`
  - `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts`
  - `src/features/grpc/utils/grpcStudioAdvancedCommands.ts`

2. Discrepancy found and fixed in throughput timeline visualization.
- Issue: throughput chart rendered a non-zero success bar even when a timeline bucket had zero successful attempts (failed-only bucket), which could misrepresent outcomes.
- Fix: render success throughput bars only when `succeeded > 0` for the bucket.
- Updated file:
  - `src/features/grpc/components/GrpcLoadTestPanel.tsx`

3. Added regression coverage for failed-only throughput buckets.
- Updated `src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx` with a failed-only attempts case asserting:
  - no success bars are rendered,
  - failed bars are still rendered.

4. Re-validation completed after fix (clean pass).
- Command:
  - `npx vitest run src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts src/features/grpc/utils/grpcStudioAdvancedCommands.coverage-gaps.test.ts`
  - `npx tsc -b --noEmit`
- Result: **3/3 files passed, 104/104 tests passed, typecheck passed**.

### Incremental Validation Sync (2026-07-10, Phase 4 re-evaluation loop)
1. Completed deep Phase 4 audit across export actions, run-history selection, and status-strip related state transitions.
- Reviewed:
  - `src/features/grpc/components/GrpcLoadTestPanel.tsx`
  - `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts`
  - `src/features/grpc/hooks/useGrpcAdvancedExportCallbacks.ts`

2. Discrepancy found and fixed in run-history export-source coupling.
- Issue: selecting a run-history entry without source metadata could retain stale `lastExportSource` from a previously selected run, allowing JSON/CSV export to use mismatched metadata.
- Fix: when selecting a run history entry, `lastExportSource` now follows the selected entry source exactly (including clearing to `undefined` when absent).
- Updated file:
  - `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts`

3. Added regression coverage for legacy no-source run-history entries.
- Updated `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts` to assert that selecting a no-source run:
  - clears `lastExportSource`,
  - makes `exportLoadTestJson()` return `undefined`,
  - makes `exportLoadTestCsv()` return `undefined`.

4. Re-validation completed after fix (clean pass).
- Command:
  - `npx vitest run src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts src/features/grpc/hooks/useGrpcAdvancedExportCallbacks.coverage-gaps.test.ts src/features/grpc/utils/grpcStudioAdvancedCommands.coverage-gaps.test.ts`
  - `npx tsc -b --noEmit`
- Result: **4/4 files passed, 111/111 tests passed, typecheck passed**.

### Incremental Validation Sync (2026-07-10, Phase 5 re-evaluation loop)
1. Completed comprehensive Phase 5 validation sweep.
- Executed all Phase 5-tagged gRPC test files (components/hooks/data/utils): **29/29 files passed, 451/451 tests passed**.
- Executed broad gRPC validation with coverage instrumentation:
  - `npx vitest run src/features/grpc src/shared/grpc --coverage.enabled true --coverage.reporter=json-summary --coverage.reportsDirectory coverage-grpc`
  - Result: **454/454 files passed, 5727 tests passed, 13 skipped**.
- Typecheck rerun passed: `npx tsc -b --noEmit`.

2. Discrepancy found and fixed during Phase 5 acceptance rerun.
- Issue: non-failing React `act(...)` warning persisted in schema-diff coverage suite (`clearSchemaBaseline resets state and deletes baseline acknowledgements`).
- Fix: wrapped async state updates in `async act(...)` and flushed pending microtasks in the test.
- Updated file:
  - `src/features/grpc/hooks/useGrpcAdvancedSchemaDiffSession.coverage-gaps.test.ts`

3. Re-validation after warning fix.
- Targeted rerun:
  - `npx vitest run src/features/grpc/hooks/useGrpcAdvancedSchemaDiffSession.coverage-gaps.test.ts`
  - Result: **1/1 file passed, 17/17 tests passed**.
- Full broad gRPC coverage rerun repeated cleanly after fix.

4. Coverage snapshot (latest `coverage-grpc/coverage-summary.json`).
- Global instrumented summary: lines **61.01%**, statements **59.34%**, functions **67.12%**, branches **56.88%**.

### Incremental Validation Sync (2026-07-10, manual Phase 5 browser smoke)
1. Executed live manual smoke flow on running app (`http://127.0.0.1:5173`) against reflected local gRPC endpoint (`localhost:50051`).
- Flow completed end-to-end: **configure -> start -> stop/complete -> inspect charts -> export controls**.
- Verified runtime results rendering includes:
  - status strip (run id / duration / stop reason),
  - status breakdown and latency histogram,
  - throughput-over-time section,
  - JSON/CSV copy+download action availability after completion.

2. Discrepancy found and fixed during smoke.
- Issue: entering **Advanced → Load testing** after selecting a method could trigger repeated React runtime updates (`Maximum update depth exceeded`) when persisted run history existed.
- Root cause: persisted history hydration effect in `useGrpcStudioAdvancedFeatures` could write tab state repeatedly on tab-array identity churn.
- Fix: hydration now diff-checks prior vs persisted load-test state and returns previous state when no material change; tab-id dependency handling stabilized to tab-id signatures.
- Updated file:
  - `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts`

3. Regression validation after runtime fix.
- Targeted suites:
  - `npx vitest run src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx`
  - Result: **2/2 files passed, 70/70 tests passed**.
- Typecheck:
  - `npx tsc -b --noEmit` (passed).
- Browser re-check:
  - Advanced tab no longer emits the prior update-depth loop; load test run completed and results/export controls rendered normally.

### Incremental Validation Sync (2026-07-10, full Phase 1–5 re-evaluation loop)
1. Re-ran phase-targeted validation suites (post-fix confidence pass).
- Phase 1 command:
  - `npx vitest run src/features/grpc/hooks/useGrpcLoadTestProfilesState.coverage-gaps.test.ts src/shared/grpc/grpcAdvancedFeatureContracts.coverage-gaps.test.ts src/shared/grpc/grpcLoadTestSchedulerCore.coverage-gaps.test.ts src/features/grpc/data/grpcLoadTestProfileRepository.coverage-gaps.test.ts src/features/grpc/utils/grpcStudioAdvancedCommands.coverage-gaps.test.ts`
  - Result: **5/5 files passed, 77/77 tests passed**.
- Phase 2–4 command:
  - `npx vitest run src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts src/features/grpc/hooks/useGrpcAdvancedExportCallbacks.coverage-gaps.test.ts src/features/grpc/utils/grpcStudioAdvancedCommands.coverage-gaps.test.ts`
  - Result: **4/4 files passed, 111/111 tests passed**.

2. Re-ran broad Phase 5 acceptance sweep.
- Command:
  - `npx vitest run src/features/grpc src/shared/grpc --coverage.enabled true --coverage.reporter=json-summary --coverage.reportsDirectory coverage-grpc`
- Result: **454/454 files passed, 5727 passed, 13 skipped**.
- Spot re-check of prior warning hotspot:
  - `npx vitest run src/features/grpc/hooks/useGrpcAdvancedSchemaDiffSession.coverage-gaps.test.ts`
  - Result: **1/1 file passed, 17/17 tests passed**.

3. Type safety validation.
- Command:
  - `npx tsc -b --noEmit`
- Result: passed.

4. Fresh manual runtime smoke re-check (post broad rerun).
- Repeated live flow in app: **configure -> start -> complete -> inspect charts -> export controls**.
- Verified no runtime loop regressions, and results/export surfaces remained consistent.

5. Outcome.
- No new discrepancies found across Phases 1–5 in this loop.

### Incremental Validation Sync (2026-07-10, deferred-item closure smoke)
1. Executed focused manual smoke for the two previously deferred/approved items in live app (`http://127.0.0.1:5173/?tab=grpc-studio`).
- Step 1: selected `echo.EchoService / Echo` in Studio, then opened **Advanced → Load testing**.
- Step 2: verified **Method under test** selector is present and populated with reflected methods.
- Step 3: changed method override to `echo.EchoService / ServerStream`.
- Step 4: started a short load test and observed live runtime KPI tiles during execution.

2. Verified deferred item #1 (method override config path).
- Changing **Method under test** immediately updated run context in the panel header:
  - `Tab: Tab 1 · echo.EchoService / ServerStream`
  - `Call type: Server stream — Express proxy transport; bounded message collection per stream.`
- Streaming-only guard/control appeared (`Max messages / stream`), confirming call-type-aware config rendering for the override target.

3. Verified deferred item #2 (scheduler-backed live KPI metrics).
- During active run (`Status: Running`), live KPI cards rendered and updated in-place:
  - `Throughput (live)`
  - `Success rate (live)`
  - `p50 latency (live)`
  - `Error rate (live)`
- Progress/counter strip also updated while running (`0 / 200 calls` at run start and then increasing), confirming live scheduler metric plumbing into UI state.

4. Evidence and closure note.
- Captured UI evidence screenshot during this smoke session (advanced load-test panel with overridden ServerStream method visible).
- Result: both deferred items are now manually validated in runtime flow; no new runtime discrepancy observed in this closure pass.
- No additional code fixes were required in this pass.

### Incremental Validation Sync (2026-07-10, deferred follow-up closure)
1. Implemented the two previously deferred gaps from retrospective notes.
- **Method override selector** is now implemented in the Load Testing panel and persisted per load profile.
  - Override is applied at snapshot capture time and validated against loaded descriptor methods.
  - Override is optional; leaving it empty continues to use the active Studio tab method.
- **Richer live KPI cards** are now implemented while load test is running.
  - Live panel now surfaces Throughput (RPS), Success %, p50 latency, and Error % in addition to progress and counts.

2. Validation pass for deferred closure implementation.
- Command:
  - `npx vitest run src/features/grpc/components/GrpcLoadTestPanel.coverage-gaps.test.tsx src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts src/shared/grpc/grpcLoadTestSchedulerCore.coverage-gaps.test.ts src/features/grpc/data/grpcLoadTestProfileRepository.coverage-gaps.test.ts packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/validate.test.ts`
- Result: **5/5 files passed, 137/137 tests passed**.
- Typecheck:
  - `npx tsc -b --noEmit` passed.

3. Outcome.
- The previously deferred items are now implemented.
- No remaining known deferred items from this plan for the gRPC Load Testing panel.
