# Changelog

All notable changes to RedfireForge will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Fixed
- **Floating console z-index** — Raised `.wf-console-floating` and `.re-console-floating` z-index from 100 to 200 so the console always appears above the sidebar toggle bar (`usb-toggle-btn` at z-index 101).
- **Floating console spawn/drag boundary** — Console no longer spawns behind or drags into the sidebar. `useFloatingPanel` now reads `--sidebar-w` CSS variable to compute a `minLeft` boundary (sidebar width + 20 px gutter).
- **Duplicate Stop button** — Removed redundant Stop button from the workflow sample preview banner; the main toolbar's Stop button is the single stop control.
- **`WorkflowConfigPanel` code duplication** — Replaced inline variable-insert state/callbacks with the existing `useVariableInsertModal` hook (already used by `WorkflowNodeConfigModal` and `WorkflowDefaultsModal`).
- **Unused destructured variables** — Removed `isRunning` and `handleQuickTest` from `WorkflowDesignerFlowCanvas` after Stop button was removed from the preview banner.

### Added
- **Kafka Integration (Phases 1–10)** — Full end-to-end Kafka support across server transport, UI settings, workflow nodes, runner, load policy, results publishing, native Tauri transport, and schema registry.
  - **Phase 1 — Core Transport Foundation**: `kafkajs`-backed server transport with idempotent connect/disconnect, produce, consumeOnce, subscription registry, `/api/kafka/*` route family, plaintext Docker bootstrap (`docker/kafka/plaintext`), and deterministic topic seed scripts.
  - **Phase 2 — Client Transport + App State**: Operation-based `kafkaClient.ts` dispatcher with testability override (`setKafkaClientTransport`), `kafkaStorage.ts` persistence/migration, `useKafkaState` hook with event-driven status refresh, bounded backoff polling, and UI-safe error classification.
  - **Phase 3 — Kafka Settings UX**: Kafka Settings tab in app navigation; cluster list/create/edit/delete UI with stable identity (name edits never mutate `clusterId`); auth (SASL/PLAIN, SCRAM-SHA-256/512) and TLS fields; inline diagnostic banners; topic browser with filter/search; startup auto-connect preference; `KafkaConnectionIndicator` in AppHeader (4 visual states: connected, connecting, error, disconnected); connection presets module (6 presets); secure Redpanda Docker profile (`docker/kafka/secure`) with SCRAM-SHA-256, 21/21 smoke PASS.
  - **Phase 4 — Workflow Kafka Nodes**: `kafkaProduce` and `kafkaConsume` workflow node types with typed contracts, default factories, canvas components, config panel editors (key/topic/body/headers/filters/output bindings), variable insertion support, executor branches with `KafkaNodeOperations` dependency injection, output binding extraction, load-test behavior modes, structured execution logs with `classifyKafkaFailure`, and `CapturedKafkaNodeDetails` trace capture.
  - **Phase 5 — Kafka Trigger + KafkaWait**: `kafkaTrigger` (subscription-based workflow start, key/header/jsonpath filters, `kafka.trigger.*` context variables, bounded backpressure via pause/resume) and `kafkaWait` (correlation-store-backed pause/resume, `kafka.wait.*` context keys, idempotency via `kafka:topic:partition:offset` key). Bounded trigger lifecycle manager (`kafkaTriggerSubscriptionManager`). Activation/deactivation routes. `dispatchKafkaResumeMessage` for server-side Kafka→correlation routing. `ServerCorrelationBridge` wiring `ICorrelationStore` ↔ server long-poll. 187 tests (trigger handlers, wait handler, correlation bridge, race/resilience integration). All duplicate-resume, stale-wait, and abort-race paths validated.
  - **Phase 6 — Runner Kafka Scenarios**: `actionType: 'kafkaProduce' | 'kafkaConsume'` on `Scenario`; `transportType` on `RequestResult`; `kafkaResultMeta` bag; `kafkaExecution.ts` module; `executeNonHttp` generic hook in `requestExecution.ts`; `kafkaField` assertion type with `KafkaAssertionTarget`; transport-aware guards in `DataRowSummaryTable`, `ResultsRequestDetailsTab`, `WorkflowResultsSummary`, `runBaselines`, `reportGenerator`, `cli/reporters`; `.method-kafka` CSS class; parameterized runner row interpolation for Kafka fields.
  - **Phase 7 — Load-mode Policy**: `kafkaLoadPolicy.ts` compatibility matrix (allow/warn/block per execution mode × consume load mode); `runGraphLoad` pre-run guard blocking `wait-for-real` in workflow mode; default changed from `wait-for-real` → `auto-resume`; `WorkflowRunner` load banners (block/info). 208 tests including repeated-run variance and deterministic simulation tests.
  - **Phase 8 — Results Publishing to Kafka**: `KafkaResultsPublishConfig`, `KafkaRunSummaryEnvelope` (schema v1.0), `KafkaPublishOutcome` types; `kafkaResultsPublisher.ts` (max 3 retries, 2 s base delay, 10 s total cap, fire-and-forget); publish hook at all 3 `saveTestRun` sites in `useTestExecution.ts`; 41/41 broker scenarios PASS (plaintext + SASL/SCRAM-SHA-256).
  - **Phase 9 — Tauri-native Kafka Transport (rdkafka)**: Rust `src-tauri/src/kafka/` module with `KafkaState` (`Arc<Mutex<HashMap>>`), 10 Tauri commands (`kafka_connect`, `kafka_disconnect`, `kafka_status`, `kafka_topics`, `kafka_produce`, `kafka_consume_once`, `kafka_subscribe`, `kafka_unsubscribe`, `kafka_subscriptions`), SASL/TLS error code mapping with `KAFKA_` prefix for frontend classifier parity. `kafkaNativeTauriTransport.ts` implementing `KafkaClientTransport` via dynamic `@tauri-apps/api/core` `invoke`; `CommandSpec.paramKey` for Tauri v2 struct-param wrapping; transport selected via `isTauri()` in `main.tsx`. 8 golden-fixture parity tests (82/82). 656 Rust unit tests. E2E: `e2e/kafka-desktop.spec.ts` 8/8 PASS.
  - **Phase 10 — Schema Registry (Avro/Protobuf/JSON Schema)**: `@kafkajs/confluent-schema-registry ^4.1.0` integration. `KafkaSchemaConfig` type (`registryUrl`, optional `auth`, `subject`, `version`, `format`). `schema-registry-client.ts` (admin ops via direct HTTP `fetch`, encode/decode via library public API, in-process cache). Three new `KafkaOperation` entries (`schema-subjects`, `schema-versions`, `schema-fetch`) with POST routes in `kafka-routes.ts` (credentials in request body — OWASP A02). Produce encode chain: `registry.encode()` → Buffer → base64 in `value` field + `valueEncoding` in result. Consume decode uses `rawValue: Buffer` (not UTF-8 `value`) to preserve binary wire format; decoded value JSON-stringified before returning to client. `SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, `REGISTRY_AUTH_FAILURE` distinct error codes. Client-side: `KafkaSchemaConfig` interface in `kafkaClient.ts`; OPERATION_MAP entries; `kafkaNativeTauriTransport.ts` COMMAND_MAP with `_server_proxy` fallback; schema-aware produce/consume also routes through server proxy in Tauri mode. Workflow types (`KafkaProduceNodeData`, `KafkaConsumeNodeData`) and engine handlers pass `schemaConfig`. Shared `KafkaSchemaConfigSection` component (collapsible, off by default, lazy subject/version loading) added to produce and consume config panels. 470 Phase 10 tests; `npx tsc --noEmit` clean.
  - **Coverage sweep (2026-06-03)**: 98.6% → 99.46% total coverage across all Kafka and related files (21,974 unit tests passing).

### Tests
- Fixed `useFloatingPanel` test: min-x clamp expectation updated to `68` (sidebar `minLeft`).
- Fixed `trainingPaths` test: `tests` path manual count updated from `35` → `36`.
- Added `useWorkflowDesignerInspectActions.test.ts` — 6 tests covering `getWorkflowPreview` (known/unknown/empty id) and memoization stability.
- Added `useWorkflowPreviewReactFlowInit.test.ts` — 7 tests covering all 3 code paths: preview layout, saved-viewport restore, and first-load auto-layout.

### Added
- **Test Scenario Tagging** — Tag `TestScenario` objects for filtering, reporting, and targeted test runs.
  - **`TestScenario.tags?: string[]`** — New optional field on `TestScenario`. Tags are normalised on save: lowercase, trimmed, non-`[a-z0-9-_]` characters stripped.
  - **Tag pills UI** — Inline tag pills on scenario cards in the Scenario Builder sidebar; click `+` to add a tag, `×` to remove one. Autocomplete list drawn from built-in tags (`smoke`, `regression`, `critical`, etc.) plus all existing tags in the workspace.
  - **Right-click context menu** — `ScenarioContextMenu` component appears on right-click for quick checkbox-based tag add/remove and "Remove All Tags" action.
  - **Feature Group tag badge** — FG header shows the count of unique tags in that group (with tooltip listing all tags).
  - **Tag propagation** — Tags are copied to `Scenario.scenarioTags` at test-build time (`buildSelectedTests`) and to `RequestResult.scenarioTags` via all execution paths (`executeRequest`, `buildErrorResult`, Rust passthrough/fallback mappers).
  - **Results Dashboard filtering** — Tag chips above the results list let users filter results by tag. "All" chip clears the filter. Filter resets when changing run selection or deleting a run.
  - **Results Dashboard search** — Scenario tags are included in the full-text search (visible as `scenarioTags` on `RequestResult`).
  - **CLI `--scenario-tags`** — `redfireforge run --scenario-tags smoke,regression` (comma-separated) with `--scenario-tag-mode any|all` (default `any`).
  - **CLI reporters** — JUnit reporter adds `tags` attribute to `<testcase>`; Markdown reporter adds a Tags row; console reporter prints tag summary.
  - **CLI loader** — `tags` field in YAML/JSON test files is loaded as `scenarioTags` (normalised to lowercase).
  - **`useScenarioTags` hook** — `addTag`, `removeTag`, `bulkAddTag`, `bulkRemoveTag`, `clearTags`, `allTags`, `tagCounts`, `tagSuggestions`.
  - **Engine helpers** — `normalizeTag`, `filterScenariosByTags`, `collectAllScenarioTags`, `countScenariosByTag`, `BUILT_IN_SCENARIO_TAGS` in `src/engine/dataSourceExpander.ts`.
  - 9 new type round-trip tests (`src/shared/types/index.test.ts`); 44 tag-engine tests; 31 hook tests; 19 `buildSelectedTests` tests; 9 JUnit + 12 Markdown + 13 console reporter tests.
- **SLA Dashboard** — Absolute performance contract monitoring integrated into the Results view.
  - **Scoped targets** — SLA targets are stored per-workflow (`sla-targets-wf-{workflowId}`) or per-run (`sla-targets-run-{runId}`). Targets embedded in `TestConfig.slaTargets` at run time are read-only in the Results view; workflow-level and per-run targets are fully editable.
  - **Per-scenario metrics** — Targets can be scoped to individual scenario names (e.g. `checkout`, `search`). Metrics are computed from `RequestResult[]` using nearest-rank percentiles, timestamp-span TPS, and `passed`-flag error rate.
  - **Scope priority** — `config.slaTargets` (run-level, read-only) → `sla-targets-wf-{workflowId}` (workflow-level, editable) → `sla-targets-run-{runId}` (per-run, editable). `resolveTargetsForRun` handles all three levels.
  - **Status banner** — Colour-coded 🟢 pass / 🟡 warn / 🔴 fail / ⚪ no-data banner with violation count, scope badge (🔒 This Run / 🔗 Workflow SLA), and collapsible panel. Editor locked when scope is `run`.
  - **Target editor** — Inline table with Metric, Op, Fail threshold, optional Warn zone, Label, and Scenario columns. Real-time validation prevents inverted warn/fail ordering.
  - **Per-scenario display** — `SlaTestTable` groups check cards by scenario; scenarios without a matching target show a neutral "No SLA configured" row.
  - **Run list dots** — Lazy-computed SLA status dot (🟢🟡🔴⚪⚫) appended to each run option in the selector. Dots recompute after every target save via a `slaStatusVersion` counter.
  - **New types**: `SlaMetric`, `SlaTarget`, `SlaCheck`, `SlaStatus`, `ScenarioMetrics` (in `src/shared/types` and `slaTargets.ts`). `TestConfig` gains optional `slaTargets` and `workflowId` fields.
  - **New functions**: `computeScenarioMetrics`, `extractScenarioNames`, `evaluateSlaForScenario`, `evaluateSla`, `overallSlaStatus`, `loadWorkflowSlaTargets`, `saveWorkflowSlaTargets`, `loadRunSlaTargets`, `saveRunSlaTargets`, `resolveTargetsForRun`, `computeRunSlaStatus`.
  - 1186 unit tests (53 test files); `SlaDashboard.test.tsx`: 70 tests; `slaTargets.test.ts`: 89 tests.
- **Catalog → Workflow ("Expose to Workflow")** — New "Expose to Workflow" checkbox on Catalog endpoints saves parameter values, headers, and body for reuse. Exposed endpoints appear in the Workflow Designer's CATALOG palette tab; clicking adds an HTTP Request node with a fully pre-populated scenario. Non-exposed endpoints are hidden from the palette. New type: `CatalogEndpointWorkflowValues`.
- **Requests → Workflow Integration** — REQUESTS tab in the Workflow palette lets users browse Request collections with folder tree navigation. Adding a request creates an HTTP node with full scenario, preserving microservice/environment/auth bindings via `buildServiceFromCollection`.
- **Import Workflow from `+ New`** — "Import Workflow" option added to the `+ New` dropdown in the Workflow sidebar, allowing JSON import at root level without needing to right-click a folder.
- **Empty Canvas Template Suggestions** — When a workflow has no nodes, the empty canvas now shows 4 curated template suggestions (Create → Extract → Verify, Parallel API Calls, Conditional Branching, Perf: Simple POST → GET) with a "Browse All Templates →" link to the Gallery. Clicking a template loads it as a preview for quick adoption. New files: `emptyCanvasTemplates.ts`, `EmptyCanvasTemplates.tsx`.
- **Contextual Onboarding Hints** — First-time users see helpful tooltips for key actions: drag nodes from palette, use command palette (⌘K), configure nodes (double-click), connect nodes, and run workflows. Hints appear at appropriate times (empty canvas, first node added) and can be dismissed individually or all at once. State persists in localStorage. New files: `onboardingHints.ts`, `useOnboardingHints.ts`, `OnboardingTooltip.tsx`.

### Changed
- **IndexedDB Migration for Large Data** — Workflows, requests, catalog entries/specs/endpoint values, and projects migrated from `localStorage` to IndexedDB to eliminate `QuotaExceededError`. Automatic one-time migration with fallback. New files: `idbWorkflows.ts`, `idbRequests.ts`, `idbCatalog.ts`, `idbProjects.ts`. Settings storage tab updated with combined usage display.
- **Workflow Sidebar UX Overhaul** — Removed confusing "UNFILED" section header; renamed "Move to Unfiled" → "Move out of Folder"; "Move out of Folder" hidden when workflow is already at root level; "Move to Folder" submenu widened (160px → 220px); "Workflows (root)" in folder picker.
- **Gallery Navigation from Workflows** — "From Template" and "Browse All Templates →" now open Gallery pre-filtered to the Workflows domain instead of showing "All".
- **`useCopyToClipboard` Shared Hook** — Extracted the "copy text with reset-after-delay feedback" pattern (7 duplicate implementations across `CatalogEndpointCard`, `VersionPreviewModal`, `WorkflowConsolePanel`, `WebhookConfig` ×2, `JsonTreeViewer`, `SourceTreeNode`) into a single reusable `src/shared/hooks/useCopyToClipboard.ts` hook. Hook handles concurrent-copy debouncing via `useRef` timeout and clears the timer on unmount to prevent stale state updates. 10 new unit tests.
- **Monaco CDN E2E Fix** — Created `e2e/monacoCdnFixture.ts` that intercepts CDN requests for `@monaco-editor/react` and serves from local `node_modules` during Playwright runs, eliminating 30-second timeout failures under 40-worker parallelism.

### Fixed
- **Workflow Service Persistence** — Fixed `fixupOverGroupedServices` migration incorrectly splitting microservice-bound services on every load, causing loss of environment/microservice/auth bindings after hard refresh. Added guard to skip services with `microserviceId`.
- **Broken `--bg-hover` CSS Variable** — `var(--bg-hover)` was used across 7 CSS files but never defined in any theme, causing invisible hover/active states on sidebar items. Replaced with `var(--surface-hover)` (26 occurrences). Active/selected items now use accent-tinted background for clear visibility.
- **ResultsDashboard Refactored** — Extracted `ResultsMetricsCards` (throughput/timing/error metrics) and `ResultsDashboardHeader` (context tags, actions, run type filter tabs) into focused components. Reduced `ResultsDashboard.tsx` from 925 → 827 lines (below 900-line monolithic threshold).
- **Shared Test Factories Expanded** — Added `makeSummary`, `makeTestRun`, `makeTestScenario`, `makeFeatureGroup`, `makeWorkflow`, `makeWorkflowNode`, `makeWorkflowEdge` to `src/test-utils/factories.ts`. Updated test files (`cli/reporters.test.ts`, `src/engine/rerunMerge.test.ts`, `src/engine/circuitBreaker.test.ts`, `src/engine/executionWorker.test.ts`) to use shared factories instead of local duplicates.

### Added
- **Constant Arrival Rate (Open Model)** — New `constant-arrival` execution mode sends a fixed number of requests/second regardless of response time. Configurable target RPS, duration, max in-flight limit, and optional ramp period. `ArrivalRateConfig` type, `droppedRequests`/`peakRps`/`targetRps` on `TestSummary`. Rust arrival executor (`arrival_executor.rs`) for Tauri desktop mode.
- **Streaming Percentiles** — Rust HDR Histogram module (`histogram.rs`) for memory-efficient P50/P95/P99/P99.9 calculation without storing every datapoint. Enables accurate metrics at 100K+ results. `p999ResponseTime` added to `TestSummary`.
- **Rust Arrival Executor** — `arrival_executor.rs` (261 lines) with `tokio` interval-based request dispatch, backpressure handling (configurable `maxInFlight`), ramp-up support, and cancellation. 579 lines of Rust tests (`arrival_executor_test.rs`).
- **Rust Histogram Module** — `histogram.rs` (111 lines) with `HdrHistogram` struct for recording response times and querying percentiles. 304 lines of Rust tests (`histogram_test.rs`).
- **Shared `RunnerPage` Component** — Consolidated `TestRunner.tsx` (273→5 lines) and `ParameterizedRunner.tsx` (277→5 lines) into a single `RunnerPage.tsx` with `RunnerVariant` config (`runnerVariants.ts`). Eliminates ~500 lines of duplicated runner UI code.
- **Shared `definitionVersioning.ts`** — Extracted `computeSnapshotFingerprint`, `generateHttpChangeSummary`, `computeHttpSnapshotDiff`, `createVersionEntry`, `addVersionToList`, `deleteVersionById`, `renameVersionById` into `src/shared/utils/definitionVersioning.ts`. Both `requestDefinitionVersioning.ts` and `testDefinitionVersioning.ts` now delegate to the shared module.
- **Shared `OverviewDiffView` Component** — Extracted the identical overview diff view from `RequestDefinitionVersionDiff.tsx` and `TestDefinitionVersionDiff.tsx` into `src/shared/components/version-diff/VersionDiffViews.tsx`.
- **Shared `percentiles.ts`** — Extracted `percentile()`, `computePercentiles()`, and `round2()` into `src/shared/utils/percentiles.ts`, replacing duplicated implementations in `metrics.ts` and `responseTimeHistogram.ts`.
- **Shared Failure Formatting** — Added `formatFailureDetails()` and `getResultErrorMessage()` to `src/shared/utils/helpers.ts`, replacing 5 duplicated patterns across `reportGenerator.ts` and `cli/reporters.ts`.
- **Shared `LiveAreaChart` Component** — Extracted common chart rendering pattern from `LiveCharts.tsx` into a reusable `LiveAreaChart` component, reducing duplication across 4 chart panels.

### Changed
- **Test Suite Deduplication & Coverage Sweep** — Extracted shared mocks, fixtures, and JSX render helpers into four new `__test-utils__/` modules:
  - `src/features/test-runner/__test-utils__/workflowRunnerTestHelpers.tsx` — workflow fixtures, `selectWorkflowById`, `makeSummary`, `MultiWebhookStub` (saved ~815 lines across 4 `WorkflowRunner*.test.tsx` files).
  - `src/features/results/components/__test-utils__/workflowExecutionCanvasTestHelpers.tsx` — mocked ReactFlow render builder, `MiniMap`/`Background`/`Controls` stubs, trace fixture factories, `getLastReactFlowProps` helper (saved ~580 lines across 5 `WorkflowExecutionCanvas*.test.tsx` files).
  - `src/features/scenarios/components/__test-utils__/dataSourceSetupModalTestHelpers.tsx` — 12 mock-module factories plus scenario factories (saved ~1000 lines across 3 `DataSourceSetupModal*.test.tsx` files).
  - `src/features/scenarios/components/__test-utils__/dataSourceEditorTestHelpers.tsx` — fixtures + reusable wrappers around `DataSourceGridTable`, `DataSourceToolbar`, `DataSourceRowDetailModal` (saved ~400 lines across 4 `DataSourceEditor*.test.tsx` files).
  - Net duplication reduction: 22,585 → 18,719 lines (4.48% → 3.73%).
- **Targeted Coverage Gap Fixes** — Added focused unit tests for `expressionBuilderState.ts` (argValues fallback branch), `curlGenerator.ts` (undefined `bodyForm`), `expressionSnippets.ts` (sort comparator), and `targetTreeBuilder.ts` (bracket-array path parsing). All production files now ≥ 90% on every coverage metric.
- **E2E Flaky Test Stabilization** — Replaced 20+ fragile `waitForTimeout()` calls with proper Playwright auto-retrying assertions (`toHaveClass`, `toBeVisible`, `toHaveCount`) across `data-mapper-highlight-nav.spec.ts` and `results-console.spec.ts`. Added `networkidle` waits and retry logic for `harnessBtn.click()` under high parallelism. Increased default Playwright timeout from 15s to 30s for 40-worker runs. Result: 660 E2E tests, 0 flaky (previously 23 flaky).
- **Playwright Config** — Default timeout increased from 15,000ms to 30,000ms to handle 40-worker parallelism without flakiness.

### Added
- **Trash Box — Soft Delete & Recovery**
  - Deleted Feature Groups, Scenarios, Tests, and Shared Data Sources are moved to a Trash Box instead of permanent deletion.
  - **Undo toast** — 5-second notification with Undo button for instant recovery after any delete.
  - **Trash Panel** — modal UI to browse, search, restore, and permanently delete trashed items. Accessible from the Harness toolbar with a badge showing item count.
  - **Automatic purge** — expired items are cleaned up on app startup based on configurable retention period.
  - **Configurable settings** — retention period (7–90 days, default 30) and max items (50–200, default 100) in Trash Panel footer.
  - **Smart restoration** — restores to original parent when available; creates "Restored Items" groups for orphans; handles ID collisions with new UUIDs; clears stale env/svc references.
  - **Structure change logging** — restored items recorded in Feature Group change history with `restored` action.
  - **Dual-mode persistence** — IndexedDB (web), localStorage fallback, Tauri FS (desktop).
  - **Gallery sample** — "Trash Recovery Demo" in the Tests gallery with linked training manual.
  - **Documentation** — User guide (`docs/guides/trash-box-guide.md`), HTML training manual, training path entry.

## [0.5.9] — 2026-05-20

### Changed
- **WorkflowExecutionCanvas Refactored** — Extracted `ReplayCanvasControls` (zoom/fit/save/minimap toolbar), `ReplayCanvasOverlays` (`EdgePercentageOverlay` + `SwimLaneOverlay`), `heatmapColor` utility, and `replayLayoutStorage` (per-workflow node-position persistence) into focused modules. Reduced `WorkflowExecutionCanvas.tsx` from 891 → 634 lines.
- **App.tsx Refactored** — Extracted `AppHeader`, `AppActivityBar`, `AppSubNav` into `src/app/components/`, reducing `App.tsx` from 910 → 779 lines (below 900-line monolithic threshold).
- **Shared Test Mocks Consolidated** — Replaced ~450 lines of duplicated `MockResizeObserver` class + inline `vi.mock('@xyflow/react', …)` boilerplate across 15 `WorkflowResultsExplorerModal.*.test.tsx` files with two reusable test utilities: `src/test-utils/domMocks.ts → stubResizeObserver()` and `src/test-utils/reactFlowMock.tsx → buildReactFlowMock()`. Centralized `installClipboardMock()` / `installEmptyClipboard()` and `stubScrollIntoView()` consumed by 8+ additional test files. Extracted Monaco/snippet harness for ExpressionEditorModal tests (`__test-utils__/expressionEditorHarness.tsx`) and Validation Code Editor helpers (`__test-utils__/validationCodeEditorHelpers.ts`).
- **Storage Migrations Extracted** — Moved `migrateToFlat` and `migratePerFgSharedDataSourcesToTopLevel` from `src/shared/utils/storage.ts` into `src/shared/utils/storageMigration.ts`, keeping the public API stable via re-exports and bringing `storage.ts` back under the 900-line monolithic threshold.

### Fixed
- **useTestExecution tests** — Fixed 41 test failures caused by missing `vi.mock` for `rustBridge` module and incorrect `TestConfig` field names (`concurrentUsers` → `concurrency`, missing `scenarioWeights`).
- **webhook-server tests** — Fixed 2 timeout failures by adding `{ timeout: 30_000 }` to the describe block.
- **ESLint errors** — Fixed 5 unused-import lint errors across `rustBridge.test.ts`, `rustBridgeIntegration.test.ts`, `useTestExecution.test.ts`, `loadProfileRunnerInteg.test.ts`, `workerBridge.test.ts`.

### Added
- **Shared Test Factories** — Created `src/test-utils/factories.ts` with `makeScenario()`, `makeResult()`, `makeConfig()` to eliminate duplicated factory functions across 30+ test files. Updated 6 test files to use shared module.
- **rustBridge.ts Coverage Improvements** — Added 10 new integration tests covering `startRustLoadTest` fallback paths, `runTestViaRust` error handlers, and `mapRustResultWithoutValidation` edge cases (coverage improved: functions 85% → 92%, branches 87% → 91%).

- **Additional Environment Visual Indicator**
  - Amber/orange color scheme (dashed border, `+` badge) across all pages when an additional (microservice-specific) environment is selected.
  - Sidebar: "Additional Environments" section divider, tag labels, and selected-item outline use consistent amber theme.
  - Feature Groups, Test Runner, Parameterized Runner: header badge changes from green to amber dashed with "+" indicator and tooltip.

- **Catalog Export — Schema-Based Sample Body Generation**
  - When exporting from Catalog to Harness, POST/PUT/PATCH endpoints now auto-generate a sample request body from the OpenAPI schema when no explicit `example` is available.
  - Handles nested objects, arrays, enums (picks first value), all primitive types, default values, and date formats.
  - Prevents 405/400 errors when "Fetch Response" is used after Catalog → Harness export.

- **Catalog Host Warning for Placeholder URLs**
  - Proactive amber warning banner in the Try It Out panel when the spec server URL contains `example.com`, `example.org`, `.test`, `.local`, or `localhost`.
  - Improved error message for ENOTFOUND errors when using "From Spec" host strategy — now suggests switching to "Custom URL" or "Environment" mode.

- **Workflow Canvas Viewport Persistence on Tab Switch**
  - IntersectionObserver saves the current viewport (pan + zoom) when the Workflow tab becomes hidden and restores it when the tab becomes visible again.
  - Eliminates the "reset to top-left corner" issue that occurred when switching between tabs.

- **Numeric Input Freeform Editing**
  - `NumericInput` helper component in RunnerExecutionConfig allows users to freely clear and type in numeric fields (concurrency, iterations, timeouts) without immediate value resetting.
  - Values are clamped to min/max on blur; parent state only updates on valid input.

- **Validation Operators — Complete Integration**
  - **24 field operators fully integrated** — equality, comparison, string, boolean, existence/null, type check, set membership operators all working in Data Mapper with color-coded pills, inline value editors, and operator picker dropdown.
  - **Array assertions** — LENGTH, CONTAINS, EACH, SUBSET inline assertions on array nodes with edit/remove controls.
  - **Universal negation** — NOT modifier on any operator/assertion, red NOT badge in UI, `NOT <operator>` syntax in DSL.
  - **ASSERT custom predicates** — `ASSERT $expression()` syntax with 125+ function expression engine, lambda support (`x => expr`), and `NOT ASSERT` for inverted predicates.
  - **DSL code editor improvements** — Monaco autocomplete for paths, operators, and NOT/ASSERT keywords; inline error markers; pass/fail line decorations after verification.
  - **Mapping View enhancements** — Code/List/Pivot views in bottom dock; Status column shows "✓ pass" / "✗ fail" after Verify All; assertion rows display verification results; pivot table for array data comparison.
  - **Panel collapse/expand** — Hide Source/Target panels to give Mapping View full height; drag-to-resize handle between panels and dock.
  - **Font consistency** — standardized all Mapping View text to 0.7rem with perceptual adjustment for uppercase labels.

- **Documentation & Training Refresh**
  - **New guide**: `data-mapper-validation-guide.md` — comprehensive reference for 24 operators, array assertions, DSL rules, ASSERT expressions, verification, Mapping View.
  - **3 new gallery samples**: `dm-validation-operators` (24 operators on DummyJSON products), `dm-array-assertions-dsl` (array assertions + DSL + ASSERT + negation), `dm-users-validation` (nested object validation on JSONPlaceholder users).
  - **3 new training manuals**: operators-products-medium, users-validation-medium, array-assertions-advanced — all using public APIs (DummyJSON, JSONPlaceholder).
  - **Updated guides**: assertions-guide.md, validation-modes-guide.md, guides README — cross-references to new Data Mapper validation guide.
  - **Updated README.md**: Data Mapper feature reference expanded; fixed cross-platform guide link.
  - **Updated ROADMAP.md**: test counts, training manual counts, competitive advantages for validation engine.

- **Validation & Data Mapper — Architecture Refactoring**
  - **Validator module decomposition** — `validator.ts` (1012 → 830 lines) split into focused modules: `validatorDateHelpers.ts`, `validatorHttpHelpers.ts`, `validatorSubsetMatch.ts`, `validatorCustomExpression.ts`.
  - **DataMapper hook extraction** — `DataMapper.tsx` (1001 → 895 lines) split into: `useBottomUtilityDock.ts`, `useDataMapperTreeInteraction.ts`, `useHighlightedMappingPaths.ts`, `useMapperVisibleLines.ts`.
  - **TestEditorValidationTab decomposition** — (936 → 865 lines) split into: `testEditorValidationAddMenu.ts`, `testEditorValidationPivot.ts`.
  - **Zero monolithic files** — all source files now under 900 lines.
  - **Quality gate** — 16,356 unit tests (576 files), 613 E2E tests, >90% coverage (statements/branches/functions/lines) across all files, 0 ESLint errors, 0 TypeScript errors.

- **Validation Rules Modal** (replaced `FloatingEditorModal`)
  - **`ValidationRulesModal`** — three-mode panel (docked / floating / maximized) with split-pane DSL editor + reference panel. Portals into closest modal overlay for correct stacking context.
  - **`DslReferencePanel`** — professional card-based DSL reference with 10 categories, search, expand/collapse all, click-to-insert, and copy syntax.
  - **Bi-directional sync hardening** — `useValidationCodeSync` now uses error-aware updates (only pushes to visual model on zero parse errors) and `pendingCodeSyncs` counter to prevent sync echo overwrites.

- **Data Mapper UX Improvements**
  - **Hover-to-Highlight** — hovering a tree node dims all non-connected lines/nodes.
  - **Toggle Line Visibility** — toolbar button to show/hide all mapping connection lines.
  - **Keyboard navigation** — Arrow Up/Down traverses tree nodes, highlighting both source and target sides. Tab switches panels. Home/End jump to first/last node. Root node (empty path) handled correctly.
  - **Click highlighting** — clicking a tree node or canvas line highlights both connected source and target nodes.
  - **Failure Navigation System** — toolbar shows failed rule count with ◀/▶ navigation to cycle through failures.
  - **Verify scope selector** — Assertions, Validation Rules, or All.
  - **`JsonPathPicker`** for `each` assertion field path.
  - **Auto-map default operator** — validation adapter defaults to `exists`, preventing false failures on type differences.
  - **Type mismatch suppression** — operators like `exists`, `not_exists`, `is_empty`, `is_not_empty` skip type mismatch detection.
  - **Target schema type inference** — `validationAdapter.fetchTargetSchema` now infers actual types from sample data instead of hardcoding `string`.

- **Data Mapper Phase 9E — Hardening**
  - **Full test suite pass** — 515 test files, 13,713 tests, all passing with zero failures.
  - **Type safety** — `tsc --noEmit` zero errors.
  - **Coverage boost** — overall project 97.62% statements / 93.39% branches / 98.05% functions / 98.48% lines. Key improvements: MapperToolbar 81→95%, expressionStepDebugger 87→96%, mappingTrace 87→93%, ExpressionEditorModal 75→81%.
  - **57 new unit tests** across 6 test files: expression step debugger edge cases (8), mapping trace error paths (5), DataMapperModal drift/repair/validation (10), ExpressionEditorModal debugger interaction (12), DataMapper debug mode/resize/keyboard/toast (15), MapperToolbar samples menu (7).
  - **Phase 11 (Visual Polish) added to plan** — new phase to align Data Mapper UI with the mockup HTML design reference (sub-phases 11A–11D: tree nodes, canvas/lines, footer, hardening).

- **Data Mapper Phase 9D — Historical Comparison & Results Integration**
  - **Trace comparison engine** (`traceComparison.ts`) — compares two sets of `MappingTrace[]` (from different test runs) per `mappingId`, classifying each as: unchanged, changed, regression (was passing → now failing), fixed (was failing → now passing), added, or removed. Produces summary counts.
  - **MappingCompare component** (`MappingCompare.tsx`) — side-by-side comparison table showing baseline vs current values for each mapping. Summary bar with color-coded badges (regressions in red, fixes in green, changes in amber). Filter controls: All, Regressions, Changes, Fixed. Custom column labels (e.g., "Run #5" vs "Run #6"). Truncated values with tooltips.
  - **"Open in Mapper" from Results Explorer** — Variables tab in `ResultsExplorerDetailPanel` now shows a "Mapping Traces" section when `event.details.mappingTraces` exists. Each trace row shows source→target path, `fx` badge for expression mappings, and error highlighting for failed mappings. "Open in Mapper" button triggers `onOpenMapper(traces, nodeLabel)` callback for integration. Variables tab is now enabled even when only mapping traces exist.
  - **Trace export/import** (`traceExportImport.ts`) — `exportMappingTraces` packages traces in a versioned JSON envelope (v1) with workflow/node metadata. `importMappingTraces` validates and reconstructs traces from parsed JSON with comprehensive error messages. `extractAllMappingTraces` flattens all mapping traces from a `WorkflowExecutionTrace` with iteration/node context tagging.
  - **CSS** — 200+ lines of comparison table styles in `data-mapper.css` (badges, filters, status icons, row highlighting). "Open in Mapper" button and mapping trace row styles in `results-explorer.css`.
  - **48 new unit tests** — comparison engine (16), MappingCompare UI (11), export/import round-trip (16), Results Explorer mapping traces (5).

- **Data Mapper Phase 9C — Step-Through & Failure Pinpointing**
  - **Step-through expression debugger** — "Step Debug" button in the expression editor opens a panel showing each intermediate evaluation step: path resolutions (`$.price` → `29.99`), nested function evaluations (`$upper($.name)` → `WIDGET`), and the final result. Step-by-step navigation with ◀/▶ controls and click-to-select.
  - **`expressionStepDebugger.ts`** — new utility that breaks expressions into `EvalStep[]` by extracting path refs and nested function calls, evaluating each incrementally (innermost-first) to show the full data flow. Uses string-aware scanning to skip `$.path` and `$fn()` inside quoted strings.
  - **Failure pinpointing** — in debug mode, failed mapping lines show an inline "⚠ Click for details" label below the connection line, styled in red. Non-error lines remain clean.
  - **Error detail popover** — clicking a failed mapping line opens a floating popover with: source path, target path, expression (if any), source value, target value, and the error message. Rendered in DataMapper (not canvas wrapper) to avoid `overflow: hidden` clipping. Closes on button click, outside click, Escape key, or when debugMode/traceData is removed.
  - **`onShowErrorDetail` callback on MappingCanvas** — lifts popover rendering to DataMapper via callback pattern.
  - **CSS styling** — step-through debugger styles in `data-mapper-expression.css` (controls, step list, active/done/error states, expression/value columns). Error inline label and popover styles in `data-mapper.css` (positioning, colors, close button, error highlight). Preview label flex layout for button alignment.
  - **Unit tests** — step-through evaluator (13 incl string-awareness regressions), expression editor debugger UI (8), failure pinpointing callbacks (6), error popover lifecycle (3).

- **Data Mapper Phase 9B — Data Flow Overlay**
  - **Debug mode toggle** — "Debug" button in `MapperToolbar` activates runtime data flow overlay. Only visible when trace data (`MappingTrace[]`) is provided. Shows error count badge when mapping errors exist.
  - **Value badges on connection lines** — in debug mode, each connection line displays a floating badge showing the runtime value that flowed through it (truncated to 16 chars, full value on hover). Green badges for successful values, red for errors/undefined.
  - **Connection line styling** — debug mode colors lines green (`dm-connection-line--trace-ok`) for successful flows and dashed red (`dm-connection-line--trace-error`) for failed mappings.
  - **Source tree trace overlay** — source nodes show runtime values from trace data instead of sample data. `TraceValueOverlay` type (`{ value, isError }`) passed via `traceOverlay` prop. Error values styled in red.
  - **Target tree trace overlay** — target nodes show written values with `=` prefix. Error values highlighted in red.
  - **Debug status bar** — shows trace count and error count when debug mode is active.
  - **`traceData` prop on DataMapper** — accepts `MappingTrace[]` from Phase 9A. Computes `traceByMappingId`, `sourceTraceOverlay`, `targetTraceOverlay` maps via `useMemo`. Enriches `ConnectionLine` with `traceValue`/`traceError` fields.
  - **CSS styling** — 120+ lines of debug overlay styles in `data-mapper.css`: debug bar, toolbar button, line badges, trace values, connection line states.
  - **25 new unit tests** — toolbar debug toggle visibility/interaction (7), canvas trace badge rendering/truncation/classes (7), source tree trace overlay values/errors/propagation (6), target tree trace overlay values/errors/propagation (5).

- **Data Mapper Phase 9A — Mapping Execution Trace**
  - **`MappingTrace` type** — per-mapping trace record capturing `mappingId`, `sourcePath`, `sourceValue`, `expression`, `evaluatedValue`, `targetPath`, `targetValue`, `timestamp`, `durationMs`, and optional `error`. Foundation for the Mapping Debugger (Phase 9B+).
  - **`captureMappingTraces()`** — evaluates mappings against source data using the mapper expression evaluator, producing a `MappingTrace[]` array. Handles direct paths, nested paths, expression evaluation, error capture, multi-source resolution, and JSON string sources.
  - **Trace level gating** — `shouldCaptureMappingTraces()` returns true only for `'full'` or `'debug'` trace levels. Mapping traces are not captured at `'minimal'` or `'standard'` levels to minimize performance overhead.
  - **`ExecutionEventDetails.mappingTraces`** — optional field on the shared event details type. Populated during workflow execution at full/debug level.
  - **`CapturedHttpNodeDetails.mappingTraces`** — optional field on the HTTP node capture type. Populated in `graphRunnerHttpHandler.ts` when extraction mappings exist and trace level is full/debug.
  - **`graphRunner.ts` integration** — mapping traces flow from `CapturedHttpNodeDetails` into `ExecutionEventDetails` alongside request/response bodies at full/debug level.
  - **Utility functions** — `summarizeMappingTraces()` (totals, success/fail counts, error list), `formatTraceValue()` (truncated display string with ellipsis), `isTraceError()` (error/null/undefined detection).
  - **40 new unit tests** in `mappingTrace.test.ts` covering all trace capture scenarios, summarization, value formatting, error detection, and trace level gating.

### Fixed
- **Data Mapper Pre-9C Audit — 3 HIGH + 4 MEDIUM fixes**
  - **HIGH: `debugMode` stuck when `traceData` cleared** — No effect reset `debugMode` to false when trace data disappeared, leaving the debug toggle hidden (gated by `hasTraceData`) with no way to turn off debug mode. Added `useEffect` that auto-disables debug mode when valid traces drop to zero.
  - **HIGH: `sourceTraceOverlay` ignored `sourceId`** — Multi-source mappings with overlapping path strings showed wrong runtime values. Source overlay keyed only by `sourcePath`; now filters traces by `sourceId` matching the active source tab.
  - **HIGH: `traceByMappingId` included stale traces** — Traces from removed/replaced mappings could appear on tree nodes. Now filtered to only include traces whose `mappingId` exists in `state.mappings`.
  - **MEDIUM: Double `onChange` on repair tick** — Repair effect called `onChange(repaired)`, then `state.mappings` update re-triggered the effect, calling `onChange(state.mappings)` again. Added `skipNextOnChangeRef` to suppress the duplicate emission.
  - **MEDIUM: `repairTick` without `repairedMappingsRef` left `prevRepairTickRef` stuck** — If tick advanced but ref was null, tick and prev stayed out of sync indefinitely. Now always updates `prevRepairTickRef` when tick changes.
  - **MEDIUM: Empty string `traceValue` rendered empty badge** — `formatTraceValue("")` returns `""`, which passed `!= null` guard. Added `!== ''` check in MappingCanvas for both badge rendering and trace-ok class.
  - **MEDIUM: `TraceValueOverlay` type scattered across files** — Defined in `SourceTreeNode.tsx`, imported by `TargetTreeNode` (target→source dependency). Moved to `types.ts` as canonical location; all consumers updated.
  - **`hasTraceData` now derived from filtered traces** — Previously based on raw `traceData` prop; now based on `traceByMappingId` (post-filtering), so debug button is hidden when all traces are stale.
  - 5 new unit tests: debug mode reset (1), stale trace filtering (1), source-scoped overlay (1), repair double-fire prevention (1), empty-string badge suppression (1).

- **Data Mapper Pre-9B Audit (Round 2) — 1 CRITICAL + 3 HIGH + 3 MEDIUM fixes**
  - **CRITICAL: HTTP mapping trace used wrong extraction fields** — `graphRunnerHttpHandler.ts` filtered extractions by `jsonPath` and mapped `variable`, but `Extraction` type uses `expression` and `name`. Mapping traces were effectively never produced for real workflow executions. Fixed to use `e.expression` (source path) and `e.name` (target path), filtering only `body`-source extractions.
  - **HIGH: `evaluateMapperExpression` could throw unhandled errors** — Used `try/finally` with no `catch`; errors from malformed expressions or edge cases propagated to callers (expression modal preview, preview bar). Added `catch` returning `{ value: undefined, preview: '', error }`.
  - **HIGH: Repair tick + onChange effect ordering caused stale mappings** — Passive `useEffect` for repair and `onChange` ran in the same commit, so `onChange` could fire with pre-repair `state.mappings`, temporarily setting `currentMappingsRef` to stale data. Merged both into a single effect that calls `onChange` with repaired mappings directly when repair tick fires.
  - **HIGH: Circular import graphRunner ↔ graphRunnerHttpHandler** — `graphRunnerHttpHandler.ts` imported `resolveTraceLevel` from `graphRunner.ts`, which imports handlers from the same module tree. Extracted `resolveTraceLevel` into a leaf module `graphRunnerTraceLevel.ts` imported by both.
  - **MEDIUM: `isTraceError` treated null targetValue as error** — A mapping that intentionally produces `null` was misclassified as an error. Narrowed condition to only treat `undefined` (not `null`) as an error indicator.
  - **MEDIUM: `adapter.validate` not wrapped in try/catch** — A throwing `validate` in `handleDone` could crash the Done button. Wrapped in try/catch with fallback to a validation warning message.
  - **MEDIUM: Wrong `ExpressionFunction` import path** — `mappingTrace.ts` imported `ExpressionFunction` from `expressionEvaluator.ts` which doesn't export it. Fixed to import from `expressionFunctions/types.ts`.
  - 2 new unit tests: custom function throw handling (1), `isTraceError` null-is-not-error (1 updated).

- **Data Mapper Pre-9B Audit — 4 HIGH + 4 MEDIUM fixes**
  - **HIGH: Unstable `initialData` in WebhookConfig/CorrelationWaitConfig** — `data.extractVariables ?? []` created a new empty array on every render, resetting mapper state while modal was open. Added module-level `EMPTY_EXTRACT_VARS` constant for stable reference.
  - **HIGH: Stale body sync mappings** — `useBodyBuilderSync` carried forward stale mappings when body transitioned from unparseable to valid JSON. Now falls back to `syncFromTemplate` (fresh derivation) when old body is unparseable.
  - **HIGH: `$count` returned `undefined`** — `JSON.parse(sv).length` could be `undefined` for non-array JSON strings starting with `[`. Added `Array.isArray(parsed)` guard before accessing `.length`.
  - **MEDIUM: `$hash` metadata/API mismatch** — Listed an unused `algorithm` argument. Removed from `args` array and updated signature/description to reflect djb2-only behavior.
  - **MEDIUM: `$random` broken when `max < min`** — Produced values outside expected range. Added automatic swap of bounds.
  - **MEDIUM: `$padStart`/`$padEnd` throw on empty pad string** — Empty `pad` argument caused `TypeError`. Now defaults to space when pad is empty.
  - **MEDIUM: `$urlEncode` throws on lone surrogates** — `encodeURIComponent` can throw `URIError`. Wrapped in try/catch, returns raw string on error.
  - 5 new unit tests: `$count` non-array edge (2), `$random` swapped bounds (1), `$padStart` empty pad (1), body sync invalid→valid transition (1).

- **Data Mapper Pre-9A Audit — 1 CRITICAL + 3 HIGH + 2 MEDIUM fixes**
  - **CRITICAL: Repair→state desync** — `handleRepairMapping` only updated `currentMappingsRef` without propagating to `DataMapper` React state, causing canvas/connection lines to show stale paths while Done serialized the repaired ref. Added `repairTick` counter and `repairedMappingsRef` props; DataMapper now applies repaired mappings via `setMappings` when tick changes.
  - **HIGH: Multi-source repair snapshot mismatch** — `repairSuggestions` always used `savedSnapshotsRef.current[0]`, producing wrong/empty suggestions for the second+ source in multi-source adapters. Drifts now carry `sourceId`; repair logic finds the matching snapshot pair.
  - **HIGH: Cross-source false positives in `findAffectedMappings`** — Ignored `mapping.sourceId`, so path collisions across different sources caused false-positive drift highlighting. Now filters by `drift.sourceId` when available.
  - **HIGH: Preview `[*]` wildcard as literal string** — `setNestedValue` in `previewCompute.ts` treated `[*]` as a literal key, building wrong object structure. Now maps `*` to `0` index in `parsePathSegments`.
  - **MEDIUM: Zero-affected breaking drift rows not removed** — `handleRepairMapping` filter kept breaking rows with zero affected mappings when path didn't match. Simplified to remove any breaking drift with no affected mappings.
  - **MEDIUM: Stale `savedSnapshotsRef`** — Accept/dismiss didn't clear snapshot pairs, leaving stale data for future repair computations. Now clears `savedSnapshotsRef.current = []` in both handlers.
  - Added `sourceId` field to `SchemaDrift` interface for multi-source drift tracking.
  - 3 new unit tests: sourceId-filtered `findAffectedMappings` (2 tests), preview `[*]` wildcard handling (1 test).

### Added
- **Data Mapper Pre-Phase 9 — Gap Closure**
  - **Repair UI** — `SchemaDiffModal` now has a "Repair" column for breaking drifts. Shows per-path suggestions with confidence scores (high/medium/low color coding), "Apply" button to fix broken mappings in-place. `DataMapperModal` computes repair suggestions via `suggestRepairs()` and applies via `applyRepair()`, updating mappings and clearing drift entries.
  - **Assertion adapter documented as API-only** — `createAssertionAdapter` JSDoc updated to clarify it's for testing/programmatic use. Production UI is `RegexAssertionBuilderModal`. Removed `createAssertionAdapter` from barrel export (types kept).
  - **Plan hygiene** — Fixed 6 stale items: 1E.4 deferral aligned to "Phase 9+", 2B success criteria updated for Monaco, overall success criteria checkbox checked (9 production surfaces), 8D.2 deferral updated to Pre-9.1, file structure updated with `schemaRepair.ts`/`schemaContract.ts`.
  - **7 new tests** — SchemaDiffModal repair column (rendering, dropdown, apply callback, "No suggestions", confidence colors, no-repair-column when not provided)
  - Full suite: 13,497 tests pass across 510 files, 0 type errors
- **Data Mapper Phase 8D — Auto-Repair & Contract Mode**
  - **`schemaRepair.ts`** — `levenshtein()` edit distance, `suggestRepairs()` (similar-name + renamed-candidate strategies, confidence scoring), `generateRepairResults()` for batch repair across breaking drifts, `applyRepair()` to update mapping sourcePath
  - **`schemaContract.ts`** — `SchemaContractConfig` (enabled/disabled, strict/lenient modes), `validateContract()` compares runtime response against saved snapshot, `contractViolationsToFailures()` converts to validator-compatible `FailureDetail[]`, `loadContractConfig()`/`saveContractConfig()` async storage
  - **33 new tests** — schemaRepair (18: levenshtein, suggestions, repairs, apply), schemaContract (15: validate strict/lenient, violations, storage)
  - Full suite: 1,339 data-mapper tests pass, 0 type errors
- **Data Mapper — Pre-8E Audit Fixes (3 HIGH + 3 MEDIUM)**
  - **HIGH: `lastSegment()` path corruption** — `schemaRepair.ts` `lastSegment()` stripped `.[*]` segments then joined, corrupting paths like `foo.bar.[*].baz` → `barbaz`. Fixed to split on `.` and take real last segment, skipping trailing `[*]`.
  - **HIGH: `validateContract` JSON string bodies** — `schemaContract.ts` `validateContract()` didn't parse JSON string response bodies, causing false mass-removal violations. Fixed to `JSON.parse` string responses before snapshot capture.
  - **HIGH: Drift detection ignores paste/fetch overrides** — `DataMapperModal.tsx` `runDriftDetection` used only adapter default `sampleData`, not `sourceSampleOverridesRef`. Fixed to merge overrides (same as save/accept paths).
  - **MEDIUM: Root-array `driftMap` path mismatch** — `DataMapperModal.tsx` `driftMap` didn't alias `[*].name` → `.[*].name` for root-level arrays; tree nodes with normalized paths missed drift indicators. Fixed with leading-`[*]` alias registration.
  - **MEDIUM: MappingCanvas drift+array badge overlap** — drift badge Y-offset didn't account for array badge, causing overlapping text. Fixed to stack drift badge above array badge (same as expression badge stacking).
  - **MEDIUM: `generateRepairResults` unused `mappings` parameter** — removed unused parameter and cleaned up `SchemaFieldEntry` import.
  - **5 new tests** — 3 schemaRepair (array paths, deeply nested `.[*]`, empty snapshots), 2 schemaContract (JSON string response, non-JSON string response)
  - Full suite: 13,490 tests pass across 510 files, 0 type errors
- **Data Mapper — Pre-8D Audit Fixes (8 HIGH + 1 MEDIUM)**
  - **SchemaDiffModal Escape:** Escape now closes the diff modal (not the whole mapper) via capture-phase keydown + `stopPropagation`. `DataMapperModal` Escape handler checks for `.dm-diff-overlay`.
  - **SchemaDiffModal focus:** Focus moves into shell on mount (`useEffect` + `tabIndex={-1}`), restored to previous element on unmount.
  - **Drift path normalization:** `driftMap` keys now include `[*]→[0]` aliases; `SourceTreeNode` fallback-normalizes `node.path` for lookup. Array field drift badges now render correctly.
  - **Gallery sample multi-source:** `handleLoadGallerySample` loops all `sample.sources` and matches by ID against adapter sources instead of only applying `sources[0]`.
  - **Expression editor falsy roots:** `getSourceLeafPaths` uses `== null` checks (not falsy) so `0`, `false`, `""` JSON roots produce leaf completions.
  - **Keyboard Tab trap:** `useKeyboardNavigation` Tab intercept only fires when `e.target` is inside `.dm-tree-container` or `.dm-tree-node`, allowing normal Tab to escape the mapper region.
  - **variableBindingAdapter deserialize:** Rebuilt with `refToCandidates` index and deterministic exact-match-first logic to resolve slot ambiguity for duplicate `templateRef` across locations.
  - **requestBodyAdapter serialize:** Returns `existingBody` unchanged when `parsedBody` is null (invalid JSON), preventing silent wipe to `{}`.
  - **MappingCanvas drift+expression:** Drift badge now renders alongside expression badge (stacked Y offset) instead of being hidden.
  - **5 new tests** — keyboard trap escape, SchemaDiffModal Escape/focus, SourceTreeNode `[*]` normalization, requestBodyAdapter invalid preserve
- **Data Mapper Phase 8C — Visual Drift Overlay**
  - **Source tree drift indicators** — `SourceTreeNode` accepts `driftMap` prop with per-path severity badges: green `●` for added (info), amber `⚠` for type changes (warning), red `✕` with strikethrough for removed (breaking). Breaking nodes are non-draggable. `driftMap` flows through `DataMapper` → `SourcePanel` → `SourceTreeNode`.
  - **Affected mapping lines** — `ConnectionLine` extended with `driftSeverity` field. Breaking: red dashed line with `✕` badge. Warning: amber dashed line with `⚠` badge. `driftMappingIds` computed from classified drifts and injected into lines via `useMemo` in `DataMapper`.
  - **Schema diff modal** — `SchemaDiffModal` shows tabular diff (severity, field path, change type, saved vs current type, affected mapping count). Sorted breaking-first. Launched via "Show Diff" button on `DriftBanner`. CSS animation, z-index 1100.
  - **DriftBanner "Show Diff"** — optional `onShowDiff` prop renders "Show Diff" button alongside "Accept & Update" and dismiss
  - **CSS** — `data-mapper.css` extended with `.dm-tree-node--drift-*`, `.dm-node-key--removed`, `.dm-drift-badge--*`, `.dm-connection-line--drift-*`, `.dm-drift-line-badge--*` styles. `data-mapper-modal.css` extended with `.dm-diff-*` schema diff modal styles.
  - **23 new tests** — SourceTreeNode (7 drift indicator tests), MappingCanvas (5 drift line tests), SchemaDiffModal (11 tests: rendering, sorting, badges, callbacks)
  - Full suite: 13,444 tests pass, 0 type errors
- **Data Mapper — Post-8B Audit Fixes**
  - **`classifyDrift()`** — classifies each `SchemaDrift` entry by severity: `info` (added fields, nullable changes), `warning` (type changes, unused removals), `breaking` (removed fields with affected mappings); exported `ClassifiedDrift`, `DriftSeverity`, `ClassifiedDriftSummary` types
  - **`summarizeClassifiedDrift()`** — extends `DriftSummary` with `breakingCount`/`warningCount`/`infoCount`
  - **`DriftBanner` component** — dismissible notification banner rendered between modal header and body; warning (amber) or breaking (red) styles; shows summary counts, affected mapping count, and individual breaking items list; accessible with `role="alert"` and `aria-live="polite"`
  - **`DataMapperModal` drift detection** — on mount, loads saved snapshot, compares against current adapter source data via `diffSchemas` + `findAffectedMappings` + `classifyDrift`, shows `DriftBanner` if drift detected
  - **Accept & Update flow** — re-captures and saves fresh `SchemaSnapshotPair` with effective sources (including user paste/fetch overrides), clears banner
  - **CSS** — `data-mapper-modal.css` extended with `.dm-drift-banner*` styles: slide-in animation, warning/breaking color variants, detail items, action buttons
  - **22 new tests** — `schemaDrift.test.ts` (12 tests: `classifyDrift` 9 + `summarizeClassifiedDrift` 3), `DriftBanner.test.tsx` (10 tests: rendering, severity styles, callbacks, accessibility)
  - Full suite: 13,412 tests pass, 0 type errors
- **Data Mapper — Post-8B Audit Fixes**
  - **1 HIGH bug fixed:** `extractionAdapter.deserialize([])` now clears `nonBodyIndices`/`fallbackMap` before early return, preventing stale interleaving state from prior calls
  - **Modal drift timing:** drift detection deferred via `mappingsReadyRef` + `requestAnimationFrame` loop (up to 500ms) so `findAffectedMappings` uses real deserialized mappings, not empty ref
  - **requestBodyAdapter.validate:** warning message updated from misleading "Last mapping wins" to accurate "values will be concatenated as {{ref1}}{{ref2}}"
  - **bodyTemplateSync duplicate ref fix:** `syncFromTemplate` now tracks consumed candidate IDs via `usedCandidateIds` Set, preventing `{{ref}}{{ref}}` from reusing the same mapping object twice (duplicate IDs)
  - **schemaDrift.ts JSDoc fix:** aligned classification comment with implementation — `nullableChanged` is `info`, not `warning`
  - **9 new tests:** DriftBanner (5 — title text, all-info, singular grammar, zero-affected), schemaDrift integration (2 — full pipeline, all-removed-warning), bodyTemplateSync (2 — duplicate ref IDs), extractionAdapter (1 — stale state clearing)
  - Full suite: 13,421 tests pass, 0 type errors
- **Data Mapper Phase 8A — Schema Snapshot Engine**
  - **`schemaSnapshot.ts`** — `SchemaSnapshot`, `SchemaFieldEntry`, `SchemaSnapshotPair` types; `collectFieldEntries()` recursive JSON walker (captures paths, types, depth, nullable, array context); `captureSchemaSnapshot()` and `captureSnapshotPair()` factory functions; `loadSnapshot()`/`saveSnapshot()`/`deleteSnapshot()` async storage via `readKey`/`writeKey`
  - **`schemaDrift.ts`** — `SchemaDrift` type with 4 drift types (added/removed/typeChanged/nullableChanged); `diffSchemas()` path-based comparison engine; `findAffectedMappings()` links drifts to mapping IDs (exact + child path matching); `summarizeDrift()` + `formatDriftMessage()` helpers
  - **`DataMapperModal.tsx`** — on successful save, captures `SchemaSnapshotPair` for all source panels + target, persists via `saveSnapshot()` (fire-and-forget)
  - **68 new tests** — `schemaSnapshot.test.ts` (34 tests: field walking, snapshot capture, storage round-trip, cycle detection, heterogeneous arrays, prototype keys, dot-in-keys), `schemaDrift.test.ts` (34 tests: drift detection, affected mappings, path normalization, summary, formatting, integration)
  - **Post-8A audit fixes:**
    - `DataMapperModal` snapshot now captures effective source data (paste/fetch overrides) via `onSourceSampleChange` callback, not stale `adapter.sources`
    - `findAffectedMappings` normalizes `items[0].name` → `items.[*].name` before matching drift paths
    - `collectFieldEntries` adds `WeakSet` cycle detection + `MAX_DEPTH=20` to prevent stack overflow
    - `collectFieldEntries` uses `Array.find(non-null)` for heterogeneous/null-first arrays
- **Data Mapper — Pre-8A Audit Fixes (#2)**
  - **1 critical bug fixed:** `buildBodyFromMappings` now concatenates placeholders for multi-ref fields (`{{a}}{{b}}`) instead of last-write-wins overwrite
  - **`syncFromTemplate` multi-ref fix:** changed `existingByTarget` from `Map<string, Mapping>` to `Map<string, Mapping[]>` so all mappings for a shared `targetPath` are preserved on re-sync
  - **`DataMapperModal` Escape hardening:** added `contentEditable === 'true'` check alongside INPUT/TEXTAREA/SELECT guards
  - **12 new tests:** modal Escape stacking (5 tests), multi-ref round-trip (2 tests), bodyTemplateSync multi-ref (2 tests), variable binding disambiguation (4 tests), bulk drop (1 test)
- **Data Mapper — Pre-8A Audit Fixes**
  - **7 bugs fixed:**
    - Modal Escape stacking — parent `DataMapperModal` no longer closes when `ExpressionEditorModal` is open (checks for `.dm-expr-overlay`); also skips when focus is in editable fields
    - Bulk drop — dragged source now maps to the actual drop target; remaining selections map by name
    - Extraction adapter ordering — `serialize` now re-interleaves non-body extractions at their original positions
    - Request body multi-ref — `deserialize` and `syncFromTemplate` now extract all `{{ref}}` placeholders, not just the first
    - Variable binding adapter — disambiguates duplicate `ref` paths with `ref::location` suffix; strips on serialize
    - Duplicate `.dm-tree-node--selected` CSS rule removed (kept custom property version)
    - Auto-map algorithm no longer claims expression strings as source paths
  - **Expression function doc fixes:** `$parseInt` description corrected to "Returns 0"; `$hash` example corrected to hex output
  - **Gallery sample fixes:** "Conditional Mapping" now uses `$default`, `$if`, `$concat`; "Array Mapping" description corrected
  - **Training manual versions:** all 4 manuals updated from v0.6.0 to v0.5.7
  - **131 new tests:** `stringFunctions.test.ts` (57 tests), `conditionalFunctions.test.ts` (44 tests), `encodingFunctions.test.ts` (19 tests) + updated adapter tests
  - Full suite: 13,309 tests pass, 0 type errors
- **Data Mapper — Remaining Gap Fixes (post-7F batch 2)**
  - **Gallery samples wired to UI** — added `📖 Samples` dropdown button to `MapperToolbar` with `onLoadGallerySample` prop; loads source data and mappings from gallery presets; CSS for difficulty badges (easy/medium/advanced)
  - **Modal Escape handler** — `DataMapperModal` now closes on Escape via `window` keydown listener
  - **Monaco Escape reliability** — registered `editor.addCommand(KeyCode.Escape)` inside `ExpressionEditorModal` so Escape works even when Monaco has focus
  - **Training manual fixes** — updated version from v0.6.0 to v0.5.7; merged duplicate keyboard shortcut sections (8 and 12) into one accurate section; corrected Escape key description from "close the mapper" to "clear selection; close modal from Modal"; renumbered remaining sections
  - Full suite: 13,178 tests pass, 0 type errors
- **Data Mapper — Deferred Item Fixes (post-7F batch 1)**
  - **`$jsonpath` wildcard support** — full rewrite of `$jsonpath` evaluate with `parseJsonPathSegments` and `resolveJsonPath`: bracket notation (`[0]`, `["key"]`), wildcard array iteration (`$[*].name`, `items[*].price`), nested post-wildcard paths; 37 new unit tests covering all JSON function categories
  - **Async storage migration** — `mappingProfiles.ts` migrated from direct `localStorage` to `readKey`/`writeKey` abstraction (supports Tauri file-system store); all callers updated to async; 13 profile tests + 16 toolbar profile tests updated
  - **Unique modal IDs** — `DataMapperModal` and `ExpressionEditorModal` replaced static `id="dm-modal-title"` / `id="dm-expr-title"` with `useId()` for valid HTML when multiple instances exist
  - Full suite: 13,178 tests pass, 0 type errors
- **Data Mapper Phase 7F — Hardening**
  - **Audit fixes** — fixed CSS type badge token rotation (number/boolean/array colors swapped), fixed root node expand/collapse via keyboard (empty path → `__root__` normalization), removed contradictory `role="alert"` from PreviewBar error list, added CSS reset for `<button>` mismatch badge
  - **Coverage boost** — 25 new tests for MapperToolbar (profiles save/load/delete/rename, menu open/close, click-outside, code view toggle) and useKeyboardNavigation (ArrowLeft collapse, root path normalization, Tab/Shift+Tab cycling); overall mapper coverage 91.35% lines
  - **Test file split** — split monolithic `DataMapper.test.tsx` (921 lines) into `DataMapper.test.tsx` (610) + `DataMapper.integration.test.tsx` (327)
  - Full suite: 13,116+ tests pass, 0 type errors, all files under 900-line threshold
- **Data Mapper Phase 7E — Gallery Samples & Accessibility**
  - **Gallery samples** — 6 pre-built mapping presets: direct field mapping, expression transformations, array mapping, multi-source combine, type conversion, conditional mapping; 11 unit tests
  - **WCAG AA compliance** — `aria-labelledby` on dialogs, `aria-label` on icon buttons (replaced `title`), `aria-expanded` on tree toggles, `aria-pressed` on paste toggle, `role="tab"` + `aria-selected` on source tabs, `aria-invalid`/`role="alert"` on error states, `role="separator"` on resize handles, `aria-hidden` on SVG canvas
  - **Screen reader support** — `aria-live="polite"` on preview output, error lists, validation bar, expression preview, suggestion bar; mismatch badge converted to `<button>` when actionable
  - **High contrast mode** — 26 CSS custom properties for all mapper accent colors, type badges, connection lines, focus rings, selected/mapped backgrounds; overridable for high-contrast themes
  - **Training manual** — 5 new sections in basics manual: Mapping Profiles, Bulk Operations, Keyboard Shortcuts, Code View, Expression Editor (Monaco)
- **Data Mapper Phase 7D — Monaco Editor Upgrade**
  - **Monaco expression editor** — replaced `<textarea>` with lazy-loaded `@monaco-editor/react` in `ExpressionEditorModal`; `vs-dark` theme, word wrap, no minimap, Suspense fallback textarea during load
  - **Function autocomplete** — typing `$` triggers completion items from the expression registry with snippet-mode argument placeholders, category/return-type detail, and signature documentation
  - **Source path autocomplete** — typing `$.` triggers completion items from `getAllLeafPaths(sourceTree)`, reactively updated when source data changes
  - **Keyboard shortcuts** — `Ctrl/Cmd+Enter` saves expression via Monaco command and overlay handler; `Escape` cancels
  - 8 new unit tests for Monaco integration (editor mock, value changes, hint text, Ctrl/Cmd+Enter, string/null sampleData handling)
- **Data Mapper Phase 7C — Keyboard Navigation & Code View**
  - **Keyboard navigation** — new `useKeyboardNavigation` hook: Tab/Shift+Tab cycles between source and target panels; Arrow Up/Down moves focus between visible tree nodes; Arrow Right/Left expands/collapses nodes; Home/End jumps to first/last
  - **Focus management** — visual focus ring on active panel (`.dm-panel--focused`), highlight on keyboard-focused tree node (`.dm-tree-node--focused`), `role="group"` ARIA semantics on tree containers
  - **Code view** — new `CodeView` component shows read-only code representation of mappings (`target ← source` or `target ← $expr()`), sorted by target path, with line numbers and real-time updates; toggled via `<> Code` button in toolbar
  - 14 new unit tests (7 for keyboard navigation, 7 for code view rendering)

### Fixed
- **Tab key captured toolbar buttons** — keyboard navigation `Tab` handler now only intercepts within tree containers, not the entire mapper container; toolbar buttons are reachable via normal Tab
- **tabindex leak** — focused tree nodes set `tabindex="0"` but never cleared previous node; now tracks last focused element and removes `tabindex` before focusing new node
- **canvas in focus cycle** — removed non-functional `canvas` region from Tab cycle (was `source → canvas → target`, now `source ↔ target`)
- **Profile rename silently ignored failure** — `handleRename` now checks `renameProfile` return value; only exits edit mode on success
- **`role="tree"` without treeitem semantics** — downgraded to `role="group"` on both tree containers until full ARIA tree pattern is implemented
- **`$dateFormat` → `$formatDate`** — date suggestion in `typeMismatch.ts` was using wrong function name that doesn't exist in the expression registry
- **`$sum` → `$count`, `$map` → `$flatten`/`$jsonpath`** — array mapping suggestions in `arrayMapping.ts` were referencing unregistered functions; now uses only functions from the expression catalog
- **Target panel selection didn't clear multi-select** — selecting a mapping from the target tree panel now properly clears the canvas multi-select `selectedIds` set
- **PreviewBar duplicate React keys** — error list used `targetPath` as key which could duplicate; now uses composite `targetPath+error` key

- **Data Mapper Phase 7B — Array Handling & Type Coercion**
  - **Array mapping detection** — new `utils/arrayMapping.ts` utility classifies mappings into four kinds: `loop` (array→array), `aggregate` (array→scalar), `spread` (scalar→array), and `direct` (scalar→scalar)
  - **Smart aggregate suggestions** — element-type-aware: `$sum` for number arrays→number target, `$join` for string arrays→string target, `$count` for object arrays→number target
  - **Array indicators on connection lines** — dashed lines with color-coded badges: green `∞ for each` for loop, orange `Σ` for aggregate, purple `⤑` for spread
  - **Array suggestion bar** — contextual bar below canvas when an array mapping is selected, showing kind description and one-click "Apply" button for suggested expression
  - **Enhanced type coercion** — extended `FIX_MAP` with `array→string` (`$join`), `string→array` (`$split`), `array→number` (`$count`), `array→boolean` (`$toBool($count(…))`)
  - **Date format detection** — `looksLikeDate()` recognizes ISO 8601, MM/DD/YYYY, YYYY/MM/DD, and RFC 2822 date strings; suggests `$dateFormat(…)` for date-like values
  - Utility helpers: `isArrayWildcardPath()` for `[*]`/`[]` detection, `generateForEachExpression()` for `$map(…)` generation
  - 32 new unit tests across `arrayMapping.test.ts`, `typeMismatch.test.ts`, and `DataMapper.test.tsx`

### Fixed
- **Selection state not cleared on source tab change** — `selectedSourcePaths` and `selectedIds` now reset when switching source tabs to prevent stale selections across different sources
- **Profile load retains stale selection** — loading a mapping profile now clears both `selectedIds` and `selectedSourcePaths`
- **localStorage quota safety** — `persistProfiles()` now wrapped in try/catch to handle quota exceeded or private mode
- **Profile rename lost on blur** — clicking away from the rename input now saves the new name (previously only Enter committed)

- **Data Mapper Phase 7A — Mapping Profiles & Bulk Operations**
  - **Mapping profiles** — save, load, rename, and delete named mapping configurations per adapter context; profiles stored in localStorage keyed by `contextId`
  - New `utils/mappingProfiles.ts` utility with `saveProfile`, `loadProfiles`, `deleteProfile`, `renameProfile`, `getProfileById` functions
  - **Profile manager UI** — dropdown menu in `MapperToolbar` with save input, profile list, inline rename, and delete; wired through `DataMapper` via `contextId`, `mappings`, `onLoadProfile` props
  - **Bulk source select** — hold Shift/Ctrl and click multiple source tree leaf nodes to select a group; drag any selected field to create mappings for all selected simultaneously; selection visualized with `.dm-tree-node--selected` highlight
  - **Multi-select delete** — Shift/Ctrl+click connection lines on canvas to toggle selection into `selectedMappingIds` set; press Delete/Backspace to remove all selected mappings at once
  - New `REMOVE_MAPPINGS` action in `useMapperState` reducer for batch removal with undo support
  - `DataMapperModal` gains `doneLabel` prop for customizable button text (used by HttpConfig variable modal → "Close")
  - 21 new unit tests: 13 profile CRUD tests, 4 `removeMappings` state tests, 4 integration tests (profiles UI, multi-select, bulk select)
  - Full CSS for profile menu and bulk select highlight in `data-mapper.css`

### Fixed
- **Audit fixes (Phase 1–6 pre-7A)**
  - BUG: `populateFromApiAdapter` and `sharedDsFetchAdapter` `validate()` now errors when `storedArrayPath` is empty but mappings exist (prevents silent 0-row serialize)
  - BUG: HttpConfig Visual Variables modal Save was a no-op (data not persisted) — changed to Close-only with `doneLabel="Close"`, removed unused `VariableBinding` import
  - BUG: `syncFromVisual` was replacing non-JSON body with generated JSON when mappings > 0 — now preserves raw body when `parseBodyJson` returns null regardless of mapping count
  - GAP: `syncFromTemplate` kept stale mappings when body became invalid JSON — now clears to `[]` with `mappingsChanged: true` to sync with DataMapper deserialize
  - WARNING: removed dead `colNameToId` variable from `columnMappingAdapter`

- **Data Mapper Phase 6A — RequestBodyAdapter** (10th adapter)
  - New `createRequestBodyAdapter` factory: visual request body construction by mapping variables → JSON body fields
  - Multi-source architecture: upstream workflow variables (grouped by producing node), built-in generators (`$uuid`, `$timestamp`, `$isoDate`, `$randomInt`, `$randomFloat`, `$randomString`, `$sequenceId`), and environment variables
  - Target tree auto-populated from existing JSON body template with `{{var}}` detection, or from schema fields
  - `serialize()`: Mapping[] → JSON body string with `{{variableName}}` placeholders at correct positions, preserving unmapped fields
  - `deserialize()`: Parse existing body template, detect `{{var}}` references, reconstruct Mapping[] with correct source attribution
  - `validate()`: Missing targets, unbound fields, duplicate mappings detection
  - Round-trip tested: serialize → deserialize produces equivalent mappings across all source types
  - 91 unit tests covering helpers, factory, sources, target building, serialize, deserialize, round-trip, validation, and edge cases
  - Exported from barrel: `createRequestBodyAdapter`, `extractBodyTemplateRefs`, `parseBodyJson`, `collectBodyLeafPaths`, `buildBodyFromMappings` + types
- **Data Mapper Phase 6B — Bi-Directional Sync Engine** (`utils/bodyTemplateSync.ts`)
  - `syncFromTemplate()`: detects `{{var}}` refs in body text, produces/updates Mapping[] preserving existing mapping IDs
  - `syncFromVisual()`: takes Mapping[], produces updated body string with `{{var}}` placeholders, preserving unmapped fields
  - `resolveConflict()`: latest-edit-wins when both body and mappings changed simultaneously
  - `diffTemplateRefs()`: computes added/removed refs between two body strings
  - `applyTemplateDiff()`: incremental sync — only adds/removes mappings for changed refs, preserving all others
  - `mappingsEqual()`: shallow equality check for mapping arrays
  - `createSyncState()`: initialize sync state with body + mappings
  - 43 unit tests covering all sync directions, conflict resolution, diff detection, and edge cases
- **Data Mapper Phase 6C — Body Type Support & Integration**
  - `BodyBuilderPanel` component: three-mode visual body construction (JSON Builder, Form Fields, Raw Template)
  - JSON Builder mode: uses `DataMapper` with `createRequestBodyAdapter` for drag-and-drop variable mapping onto JSON body fields
  - Form Fields mode: key-value editor for `form-urlencoded`/`form-data` bodies with `{{var}}` autocomplete via `datalist`
  - Raw Template mode: plain textarea with live `{{var}}` ref detection, template ref tag display, and variable chip insertion
  - `useBodyBuilderSync` hook: React wrapper around `bodyTemplateSync` engine for bi-directional body ↔ mappings sync
  - Wired into `HttpConfig.tsx` Body tab: Raw/Visual Builder toggle, both views stay in sync via 6B engine
  - 30 unit tests (20 component + 10 hook) covering all three modes, mode switching, form CRUD, template refs, and sync lifecycle
  - Exported from barrel: `BodyBuilderPanel`, `useBodyBuilderSync` + associated types
- **Data Mapper Phase 6D — Hardening & Audit Fixes**
  - `previewCompute.ts` `setNestedValue`: added prototype pollution guard (blocks `__proto__`, `prototype`, `constructor` segments)
  - `syncFromVisual`: preserves non-JSON body when mappings are empty (prevents body wipe during mid-edit)
  - `HttpConfig.tsx` raw body tab: removed double `update()` call per keystroke
  - `BodyBuilderPanel`: `activeMode` now re-derives from `bodyType` prop changes; removed unused `mappings` prop
  - `useBodyBuilderSync`: initializes mappings from existing `{{ref}}` body on mount
  - `demoAdapter`: serialize uses `::` delimiter (safe for dotted sourceIds); deserialize supports both `::` and legacy `.`
  - `populateFromApiAdapter` & `sharedDsFetchAdapter`: keyed column mapping by `mapping.id` instead of `sourcePath` (fixes data loss with duplicate source paths)
  - `validationAdapter`: replaced custom `resolveValue` with canonical `getByPathAsString` from `jsonPath.ts`
  - Extracted `findSourceForRef` and `hasUnsafePathSegment` into shared `bodyMappingShared.ts` (deduplication)
  - `requestBodyAdapter.validate()` now warns on unsafe path segments (`__proto__`, `prototype`, `constructor`)
  - `webhookExtractionAdapter` `normalizePath` strips leading dots, handles bracket-first paths (`[0].name → $[0].name`)
  - `variableBindingAdapter` falls back to first source group instead of orphan `__unknown__` sourceId
  - `validationAdapter.serialize()` deduplicates by normalized path (last mapping wins), message updated to match
  - Coverage: all Phase 6 files >90% statements/lines/functions (adapter: 97.93%/98.98%, sync: 98.82%/98.63%, hook: 100%/100%)
- **Results Explorer Debug Console** — Full-featured console panel in the Results Explorer for debugging multi-iteration workflow runs
  - Console toggle via header toolbar button or `⌘J` / `Ctrl+J` keyboard shortcut
  - Three display modes: docked (bottom), floating (draggable/resizable), and maximized (full screen)
  - Adaptive content based on trace level: disabled at Minimal; reconstructed narrative at Standard; HTTP bodies at Full; raw `onLog` lines and script output at Debug
  - Node filter dropdown (topologically sorted) to isolate logs from a specific node
  - Search with match navigation, count display, and keyboard shortcuts (Enter/Shift+Enter)
  - Click-to-select: clicking a console line selects that node in the diagram and opens its detail panel
  - Auto-scroll to first error line when opening a failed iteration
  - Aggregate summary view: professional run overview (pass rate, timing stats, failure details, sub-workflow stats) when no specific iteration is selected
  - Sub-workflow recursive expansion with depth-based indentation and visual borders
  - Workflow context in empty detail panel: shows current workflow name and parent name for sub-workflows
  - Double-click drill-down: double-clicking a sub-workflow node in the diagram navigates directly into it
  - Iteration picker closes on outside click via fullscreen backdrop
- **Trace Capture Levels** — Tiered system controlling how much data is collected during workflow execution
  - Four levels: Minimal (pass/fail only), Standard (default — structured data), Full (+ HTTP bodies), Debug (+ raw logs and script output)
  - Trace level radio buttons in Workflow Runner UI with persistence across sessions
  - `--trace-level` CLI flag for headless execution
  - Designer Quick Test always runs at Debug level for full fidelity
  - Sub-workflows inherit trace options from parent
  - Per-iteration `initialVariables` snapshot for future sampling support
  - Backward-compatible `inferCaptureLevel()` for pre-existing traces
- **Debug-Level Capture (Full Console Fidelity)** — Per-node log buffering at Debug trace level
  - Raw `onLog` lines captured per node during execution and stored in `ExecutionEventDetails.logLines`
  - Script node `console.log` output captured via `capturedScriptOutput` map
  - 200-line cap per node with truncation marker
  - Results Explorer Console renders raw logs when available at Debug level, matching Designer Console output
- **Designer Canvas Consistency** — Simplified and consistent toolbar controls
  - "Save current layout" button replaces "Restore saved layout" — saves both node positions and viewport (zoom/pan)
  - Saved viewport restored on revisit; auto-layout + fit view for new workflows
  - "Fit View" button restores saved view when available; tooltip dynamically shows "Restore saved view"
  - Removed Auto-Layout and Undo/Redo toolbar buttons for simplicity (keyboard shortcuts still work)
  - Consistent behavior between Designer and Results Explorer canvases
- **Runner Redesign — Three-Runner Architecture**
  - Split single Test Runner into **Test Runner** (standard scenarios) and **Parameterized Runner** (data-driven scenarios), alongside existing **Workflow Runner**
  - New `ScenarioKind` type (`'standard'` | `'parameterized'`) enforced at scenario creation — prevents mixing test types
  - New `computeAllocation()` engine — single source of truth for execution planning (replaces weight-based allocation)
  - Renamed "Transactions" → "Iterations" throughout UI, engine, CLI, and documentation
  - `ParameterizedRunner.tsx` — dedicated runner page for data-driven scenarios with per-test row × iterations preview
  - `ExecutionPlanPreview` — shared component showing exact execution plan (iterations × tests or iterations × rows)
  - `ScenarioSelector` now filters by `kind` — Test Runner shows only standard, Parameterized Runner shows only parameterized
  - `useRunnerOrchestration` hook — extracted shared logic between Test Runner and Parameterized Runner (~300 lines of deduplication)
  - `MigrationBanner` — one-time dismissible notification when existing mixed scenarios are auto-split
  - Scenario kind selector (Standard/Parameterized radio buttons) on scenario creation
  - `PARAM` badge on parameterized scenarios, `Param` tag on parameterized tests
  - Feature Group header shows breakdown: `3 scenarios (2S · 1P)`
  - Move/Copy modals filter target scenarios by matching kind
  - Workflow Runner progress shows both iterations and requests: `10/10 iterations (100%) — 40/40 requests (100%)`
  - Workflow Runner trace config (Full Trace, Sampling) persisted across navigations
  - "Scenarios" tab renamed to "Feature Groups"
  - Auto-migration: `migrateScenarioKinds()` detects and splits mixed scenarios on load
  - `allocationEngine.ts` — deterministic allocation with no silent truncation
  - `scenarioMigration.ts` — migration logic with split detection and count tracking
  - 3 new training manuals: Test Runner Guide, Parameterized Runner Guide, Scenario Types Guide
  - Updated 14+ existing training manuals for three-runner architecture
  - Runner Comparison manual rewritten for three runners
- **Training Manual Tracks** — New dedicated page for structured learning with progress tracking
  - `TrainingTracksView`: Full-page training dashboard with expandable learning paths and phases
  - `TrainingProgressDashboard`: Stats overview showing completed, in-progress, paths started, and day streak
  - `ContinueLearningCard`: Quick-access card to resume the last viewed in-progress manual
  - `WhatsNewBanner`: Highlights recently added/updated training manuals with dismiss functionality
  - `TrainingSearchBar`: Search and filter by difficulty (Easy/Medium/Advanced) and status (Not Started/In Progress/Completed)
  - `TrainingPathCard`: Expandable path cards with progress bars and phase navigation
  - `TrainingPhaseSection`: Collapsible phase sections with manual listings
  - `ManualRow`: Individual manual entries with status toggle, badges, and sample links
  - Progress persistence in localStorage with learning streak calculation
  - "What's New" detection based on manual metadata timestamps
  - Keyboard navigation support with focus indicators
  - Smooth expand/collapse animations
  - Responsive design for mobile/tablet
  - 15 E2E tests covering all interactions
  - New hooks: `useTrainingProgress`, `useWhatsNew`, `useManualSearch`
  - 164 unit tests for all new components and hooks

- **Data Mapper (Phases 1–3)** — Reusable visual field mapping component for connecting source data to target schemas
  - **Core Architecture**: Adapter pattern (`MapperAdapter` interface) for context-agnostic integration; `useMapperState` hook with full undo/redo via `useReducer`; unified `JsonTreeNode` model (`buildJsonTree`) and canonical JSONPath engine (`getByPath`, `tokenizeJsonPath`)
  - **Visual Mapping**: Drag-and-drop from source tree nodes to target tree drop zones (native HTML5 DnD); SVG bezier connection lines with real-time position updates via `ResizeObserver`/`MutationObserver` (`useLayoutTick`); click-to-select with dimming of unrelated lines
  - **Expression Editor**: Textarea-based expression modal with `$fn()` syntax; function reference sidebar (String, Math, JSON, DateTime, Conditional, Encoding categories); live preview with 250ms debounce; cursor-position-aware function insertion
  - **Auto-Map with Accept/Reject**: Fuzzy name-matching algorithm generates pending mappings (`isPending` flag); dashed cyan connection lines with ✓/✗ SVG badges for individual accept/reject; toolbar buttons for bulk Accept All / Reject All; toast notification showing candidate count
  - **Preview Bar**: Collapsible live preview showing source JSON → mapped target JSON; evaluates all mappings in real-time with error counting; unmapped fields shown as `null`; supports bracket-notation paths (`items[0].name`)
  - **Type Mismatch Detection**: `detectTypeMismatches` engine infers source/target types from field constraints, schema, and sample data; ⚠ (warning) and ℹ (info) badges on target nodes; dashed amber connection lines; one-click quick-fix applies suggested `$parseInt`/`$toString`/`$toBool`/`$toInt` expressions
  - **Modal Shell & Validation**: Full-screen `DataMapperModal` wrapper with Done/Cancel/fullscreen-toggle; `adapter.validate()` integration; unmapped required field detection; inline validation bar with error/warning counts and individual issue details; Done button disabled when errors exist
  - **UX Polish**: Inline ✕ remove button on hover for mapped target nodes; `/` keyboard shortcut to focus source search; `Delete`/`Backspace` to remove selected mapping; `Escape` to clear selection; draggable vertical panel resize handles; source panel paste JSON / fetch live sample with error display
  - **Demo Adapter**: Self-contained `createDemoAdapter` for testing and documentation with sample data, field constraints, and custom validation
  - **New Expression Functions**: `$parseInt`, `$parseFloat`, `$toInt` (handles stringified booleans), `$toString`, `$toBool` added to the expression function registry
  - **Phase 3 Adapters**: `createExtractionAdapter` (HTTP body extraction → variables), `createAssertionAdapter` (regex assertion JSON path selection), `createValidationAdapter` (selective validation with include/exclude modes); 20 cross-cutting integration tests; old components (`ExtractionPathPickerModal`, `ExtractionMapperModal`, `JsonPathBuilder`, `PickerNode`) marked `@deprecated`
  - **608 unit tests** across 24 test files (531 data-mapper across 22 files + 39 jsonPath + 38 jsonTreeModel); adapters 97% stmts / 100% lines; CSS split into 3 files (814 + 363 + 170 lines)
- **Data Mapper (Phase 4: Data Source Adapters)** — Three new adapters connecting data sources to the Data Mapper
  - **PopulateFromApiAdapter (4A)**: `createPopulateFromApiAdapter` — maps API response JSON to data source columns/rows; mutable internal state for live-fetch with array detection and auto-selection; `getByPath` for nested dotted path resolution; wired into `DataSourceEditor` and `SharedDataSourceModal` replacing `PopulateFromApiModal`
  - **ColumnMappingAdapter (4B)**: `createColumnMappingAdapter` — visually maps data source columns to request template `{{placeholders}}`; `parseScenarioTemplate` extracts tokens from URL path/query, body, bodyForm, and headers; `type::name` target paths; handles duplicate column names via ID-based source keys; wired into `DataSourceEditor` via "Map Columns" button
  - **SharedDsFetchAdapter (4C)**: `createSharedDsFetchAdapter` — purpose-built adapter for shared data source "Populate from API" with dedicated `shared-ds-fetch` contextId; dynamic title from `fetchConfig` method + URL pathname; wired into `SharedDataSourceModal` replacing the generic populate adapter
  - **Deprecation & Hardening (4D)**: `PopulateFromApiModal`, `PopulateFetchStep`, `PopulateMapStep`, `usePopulateFromApi` marked `@deprecated`; no live imports of deprecated components remain; full test suite (12,655 tests, 0 failures); adapter coverage 97.57% stmts / 90.18% branches / 100% functions / 99.54% lines
  - **7 adapters total** (extraction, assertion, validation, populate, column-mapping, shared-ds-fetch, demo) with 752 data-mapper tests across 27 files
- **Data Mapper (Phase 5A: Webhook Extraction Adapter)** — New adapter for webhook/correlation payload variable extraction
  - **WebhookExtractionAdapter**: `createWebhookExtractionAdapter` — maps webhook payload JSON to `Array<{ name, jsonPath }>` (matching `extractVariables` shape on `WebhookTriggerNodeData` / `CorrelationWaitNodeData`); configurable source label and title for reuse across Webhook Trigger vs Correlation Wait contexts; path normalization (`$.` / `$[...]` safe); full validation (empty names, empty paths, duplicates, brace warnings)
  - **CorrelationWaitConfig wiring**: "Data Mapper" button opens `DataMapperModal` alongside existing inline fields; memoized adapter prevents state reset during 3s polling; paused-item click handler now error-safe
  - **WebhookConfig wiring**: New "Extract Variables" section with inline rows + "Data Mapper" button; `extractVariables` now editable in UI (previously missing)
  - **8 adapters total** (extraction, assertion, validation, populate, column-mapping, shared-ds-fetch, demo, webhook-extraction)
- **Data Mapper (Phase 5B: Variable Binding Adapter)** — New adapter for visual upstream-variable-to-template-slot mapping
  - **VariableBindingAdapter**: `createVariableBindingAdapter` — groups upstream `WorkflowVariableHint[]` by producing node as sources, parses scenario `{{var}}` template refs as targets; `collectTemplateSlots()` and `extractTemplateRefs()` helper utilities; validates empty slots, empty bindings, duplicate bindings
  - **HttpConfig wiring**: "Visual Variables (N slots)" button above tabs when template slots exist; memoized adapter; `DataMapperModal` for drag-and-drop variable binding visualization
  - **9 adapters total** (extraction, assertion, validation, populate, column-mapping, shared-ds-fetch, demo, webhook-extraction, variable-binding)
- **Data Mapper (Phase 5C: Unified Path Engine)** — Canonical path resolution across all extraction and variable handling
  - Verified `extractPayloadVariables` in `graphRunnerHelpers.ts`, `graphRunnerTriggerHandlers.ts`, and `correlationWaitHelpers.ts` all use canonical `getByPath` from `src/shared/utils/jsonPath.ts`
  - New `setByPath` utility in `jsonPath.ts` for writing values at JSONPath locations (creates intermediate objects)
  - Refactored `CorrelationWaitConfig.tsx` — replaced 3 manual path-walking code blocks with `getByPath` / `setByPath`
- **Data Mapper (Phase 5D: Hardening)** — Final verification and quality pass for Phase 5
  - Comprehensive audit of all 9 adapters, core components, utilities, hooks, and UI wiring
  - Fixed 5 runtime bugs: `ExtractionEditor` picker adapter re-creation, `DataMapper` unguarded `deserialize`, stale `activeSourceId` on async fetch, `typeMismatch` suggesting `$parseInt` instead of `$parseFloat`, `populateFromApiUtils` cross-type fallback match
  - Fixed 3 gaps: reducer missing `default` arm, `autoMapAlgorithm` expression mappings not claiming source path, webhook adapter `deserialize` not normalizing paths
  - 12,843 tests across 489 files — zero failures; adapter coverage >90% on all metrics
- **Edge Traversal Percentages** — Branching edges in workflow canvas show traversal percentage labels in aggregate view
  - Percentage labels (e.g., "67%") on edges from nodes with 2+ outgoing paths
  - 0% shown on untraversed branching edges for untested path visibility
  - Sampled-out iterations excluded from calculation
  - Hidden in single-iteration view
- **Edge Traversal Demo Gallery Sample** — "Perf: Edge Traversal Demo" workflow in Gallery
  - Uses `SetVariable` + `$randomInt(1,150)` to generate random post IDs per iteration
  - JSONPlaceholder IDs 1–100 return 200, 101–150 return 404 → natural ~67/33 branch split
  - Training manual (`edge-traversal-percentages-guide.html`) with step-by-step guide
  - Registered in `wf-runner` training path under Results Analysis phase (now Comparison & Trends)
- **Additional Keyboard Shortcuts** — Space key toggles between aggregate and iteration #1 view; keys 1–9 jump directly to that iteration number
- **Animated Edge Flow** — Traversed edges in Results Explorer canvas now show a flowing dash animation indicating flow direction
- **Export Aggregate Metrics as CSV** — "📊 Export CSV" button in Results Explorer exports per-HTTP-node metrics (executions, pass rate, avg, min, max, P95) as a `.csv` file
- **Heatmap Coloring** — Nodes in Results Explorer canvas are colored on a green→yellow→orange→red gradient based on average response time. Fastest nodes appear green, slowest appear red, with a 4px colored bar at the bottom of each node. Only activates when 2+ nodes have timing data.
- **Fit View After Measurement** — Results Explorer canvas now re-fits after custom nodes are measured, ensuring the workflow fills the available space correctly on initial load
- **Bottleneck Analysis** — Results Explorer identifies time-dominant (≥40% of total), high-variance (CV>0.5), high-failure (≥20%), and critical-path nodes. Pulsing border on bottleneck nodes, detailed tooltip with suggestions, and insights panel in right sidebar empty state.
- **Save Layout** — Users can drag nodes in Results Explorer to custom positions and save via the pill controls save button. Layouts persist in `localStorage` keyed by workflow ID and are automatically restored on next open.
- **Node Search & Filter** — Search bar in the Results Explorer diagram panel to find nodes by name. State filter buttons (All / Pass / Fail / Skipped) with badge counts. Non-matching nodes are dimmed. Press `/` to focus search, `Escape` to clear.
- **Iteration Picker** — Redesigned iteration selector as a rich dropdown with filter tabs (All / Failed / Slowest), jump-to-# search, p95 "slow" badges, and pass/fail color coding

### Refactored
- **Code Consolidation (Round 5)**
  - Extracted `toggleSetItem()` shared utility (`src/shared/utils/setToggle.ts`) — replaces 9 identical inline Set toggle patterns across 5 files (`useScenarioMutations`, `RequestsSidebar`, `MultiEnvResultRow`, `CatalogSendToRequestsModal`)
  - Extracted `createResponseVersion()` / `createRulesVersion()` factory functions (`src/features/scenarios/utils/versionFactory.ts`) — replaces ~8 inline version object constructions across `TestEditorModal` and `TestEditorValidationTab`

### Tests
- New unit tests: `setToggle` (4), `versionFactory` (8) — **12 new tests** for Round 5 shared utilities
- **5717 unit tests passing** (257 files)

### Improved
- **Validation Tab UX clarity** — 5 improvements to reduce confusion between assertions and body validation:
  - Renamed "No Validation" → "No Body Validation" to clarify assertions still run independently
  - Added "Body Validation" section heading with subtitle to visually separate it from the Assertions section
  - Warning banner when "Full JSON Match" is selected but no expected JSON is pasted
  - Clickable "No Body Validation" link in the warning for quick mode switch
  - Validation tab dot now only appears when validation is meaningfully configured (not for empty Full JSON Match)
  - Auto-switch to "No Body Validation" on save when Full JSON Match has no expected JSON

### Added
- **Parameterized Testing (Data-Driven)** — Define one test pattern with an attached data source, run it against N data rows
  - `DataSource` type: columns (path, param, header, body, validate) + rows with values, tags, labels, notes
  - `DataSourceEditor`: Inline spreadsheet-style table editor with add/remove/reorder columns and rows
  - `dataSourceExpander`: Execution engine expansion — one Scenario + N rows → N concrete requests
  - Validation columns: `validate:$.jsonPath` columns assert response values per row
  - Row tags: Categorize rows (e.g., `smoke`, `regression`); filter by tag when running
  - Row enable/disable, bulk operations (Ctrl/Shift-click), drag-to-reorder, sample rows
  - Distribution modes: Sequential, Random, Round Robin
  - CSV/Excel/JSON import: Load data from external files with column detection
  - Pre-validation (Verify All): Test rows against live API before full run
  - Populate from API: Extract array from response, map fields to columns, auto-generate rows
  - Create Parameterized Copy: Convert normal test to parameterized with auto-detected variables
  - Re-run failed rows: After execution, re-run only failed rows; results merge with original
  - Grouped results: Results dashboard groups by data row with pass/fail status
  - 10 gallery samples + 8 training manuals for parameterized testing
  - CLI support: `dataSource` in YAML/JSON test files for headless data-driven runs
- **Shared Data Sources** — Top-level data sources shared across multiple tests
  - `SharedDataSource` type with `fetchConfig` (URL, method, headers, body, auth) and `tags`
  - Top-level storage: `loadSharedDataSources()` / `saveSharedDataSources()` in IndexedDB
  - `SharedDataSourceModal`: Dedicated modal with list panel, editor, fetch config
  - Cross-test linking via `sharedDataSourceId` on tests
  - "Used by" section: Shows all tests linked to each shared data source
  - Promote/demote: Inline → shared (with copy or link); shared → inline (detach)
  - Create Test from Shared DS: Picker modal with new test creation
  - Impact warning modal: Shows affected tests when modifying shared data
  - Auth inheritance from linked tests for API verification
  - API-driven population and verification via `fetchConfig`
  - Resizable/collapsible list panel, row tags, CSV/Excel import/export
  - Migration from per-FeatureGroup to top-level structure
  - 4 gallery samples + 4 training manuals for shared data sources
- **IndexedDB Persistence** — Large data stored in IndexedDB instead of localStorage
  - `featureGroups`, `testRuns`, `sharedDataSources` stores in `redfireforge` DB (v3)
  - Auto-migration from localStorage on first load
  - 3-second timeout with localStorage fallback for blocked IDB
  - Fixes quota issues with large data sources and many test runs
- **Version History** — Auto-saved definition snapshots for tests, workflows, script libraries, and requests
  - `TestDefinitionVersionPanel` with diff view, restore, rename, and delete
  - `WorkflowVersionPanel` with visual diff of node/edge/variable changes
  - `ScriptLibraryVersionPanel` with code diff
  - `RequestDefinitionVersionPanel` for saved request snapshots
  - `StructureChangeLogPanel` — audit trail of feature group/scenario/test CRUD operations
  - Export options popover with version inclusion toggle
  - Import version modal with selective version import
  - Per-workflow environment persistence (`lastSelectedEnvId` saved/restored on switch)
  - p50 response time metric added to `computeMetrics()`
  - Histogram distribution tab in Run Comparison Panel
- **Response Headers in Results** — Response Detail Modal now shows response headers in a table; captured from both harness and workflow executors
- **Request Log** — Response Detail Modal shows the resolved request headers and body as sent; Authorization header values are masked (`••••••••`) for security
- **Structured JSON Body Assertions**
  - Three new assertion types: **arrayLength** (assert array length at JSONPath, e.g. `$.items` length ≥ 4), **numeric** (compare numeric values, e.g. `$.price > 0`), **date** (compare dates vs `today` or fixed ISO date)
  - Six comparison operators (`=`, `!=`, `>`, `>=`, `<`, `<=`) shared across all three types
  - Date comparison supports `today` (UTC or local timezone) and fixed ISO date references
  - Implemented in `evaluateAssertions()` in `validator.ts` using existing `getByPath()`
  - Validation tab UI with path picker, operator dropdown, and plain-language controls
  - Assertion gallery: 5 sample assertion presets in unified gallery system
  - Applies to both Harness tests and workflow HTTP steps (same `Scenario.validation`)
  - 57 new unit tests in `validator.test.ts` (169 total); 7 new E2E tests in `structured-assertions.spec.ts`

### Changed
- **Gallery Redesign** — Replaced Template Gallery modal (`.tg-modal`) with unified Gallery page
  - Domain filter buttons (All/Requests/API Catalog/Tests/Workflows/Assertions) replace category tabs
  - Cards show name, description, difficulty dots, domain icon
  - Detail panel with action buttons (Load Workflow, Send Request, etc.)
  - "From Template" button now navigates to Gallery page instead of opening a modal
  - Gallery import creates a preview; user clicks "Use as Template" to save to sidebar
  - Pagination with configurable page size (12 per page)

### Refactored
- **Code Consolidation (Round 4)**
  - `WorkflowDesigner.tsx` reduced from 949 → 895 lines — extracted `workflowDesignerUtils.ts` (3 pure functions: `getNodeMiniMapColor`, `buildConfigModalWorkflowList`, `getDetailModalProps`) and `workflowEdgeGeometry.ts` (geometry utils: `pointToSegmentDistance`, `findClosestEdge`, `BRANCH_HANDLES`); consolidated 4 auto-layout call sites into single `handleAutoLayout` callback
  - Fixed temporal dead zone (TDZ) error: `handleAutoLayout` referenced before declaration — moved above `useWorkflowKeyboardShortcuts`
- **Code Consolidation (Round 3)**
  - `ScenarioBuilder.tsx` reduced from 984 → 702 lines — extracted `useScenarioMutations` hook (376 lines)
  - `WorkflowDesigner.tsx` reduced from 978 → 949 lines — extracted `useWorkflowResolvers` hook (per-workflow env + HTTP resolver callbacks)
  - `App.tsx` reduced from 913 → 884 lines — extracted `useWorkflowImportExport` hook
- **Code Consolidation (Round 2 continued)**
  - `WorkflowDesigner.tsx` reduced from 1061 → 893 lines (−168 lines) — extracted `useWorkflowPersistence` and `useWorkflowExtractionSample` hooks
  - Shim removal: deleted 3 re-export shim files for `sampleWorkflows`, migrated 2 legacy YAML specs into `galleries/catalog-specs`
  - Import unification: all 6 `acquireOAuth2Token` consumers now import from canonical `tokenManager.ts`
  - Auth header deduplication: created shared `resolveAuthHeaders()` utility, refactored 6 files
  - Corrected 3 inaccurate `endpointCount` values in catalog specs
- **Template parser deduplication**: Extracted `csvTemplateShared.ts` with `buildTemplateMetaAndSample()` and `buildScenarioFromRow()` — eliminates ~120 lines of identical code duplicated between `csvTemplateCsv.ts` (214→65 lines) and `csvTemplateJson.ts` (321→155 lines)
- **Validation result extraction**: Extracted `validationResult.ts` with `buildValidationResult()` — centralises assertion evaluation + failure assembly previously duplicated in `requestExecution.ts` and `graphRunnerHelpers.ts`
- **Bug fix**: Added missing `responseHeaders` and `requestLog` fields to `runPool` error fallback `RequestResult` (type inconsistency)

### Tests
- **E2E fixes**: Updated 40 failing E2E tests across 9 spec files for gallery redesign, response-detail-modal CSS changes, correlation-wait selectors, and workflow-triggers strict mode
- **372 E2E tests passing** (0 skipped), **5717 unit tests passing** (257 files)

- **Async Correlation — Browser ↔ Server Bridge (runtime fix)**
  - `RemoteCorrelationStore` (browser): `ICorrelationStore` implementation that registers paused waits with the webhook server and long-polls `GET /api/correlations/:id/wait` until resumed by an inbound webhook. Wired into `useWorkflowExecution` so production runs (not just tests) actually receive callbacks.
  - Server: new `GET /api/correlations/:id/wait` long-poll endpoint (1–120s clamp) with parked-waiter pattern + queued-resume reconciliation for race conditions where a webhook arrives before the pause is registered.
  - Server: idempotency cache no longer short-circuits replay when an active waiter exists — duplicate-key webhooks now correctly notify the waiting workflow.
  - Client: 409 (stale-pause) auto-recovery — if a paused entry already exists from an abandoned run, `RemoteCorrelationStore` deletes and retries once.
  - Pause registration now propagates full `CorrelationWaitConfig` (source/jsonPath/header/queryParam) to the server.
  - Sample `Parallel Payment Processing` (16 nodes): added per-branch `Tag Card Payment ID` / `Tag Loyalty Payment ID` setVariable nodes that prefix the gateway-returned id with `card-` / `loyalty-` so two parallel CorrelationWaits never collide on identical sandbox ids (e.g. jsonplaceholder echoing `101`).
  - Sample `Async Approval Workflow`: switch case ids changed from `case-approved`/`case-rejected` to `approved`/`rejected` (handler builds the `case-` prefix automatically; previous double-prefix made the routed branch never match).
  - Sample simulator HTTP requests now append `-{{$timestamp}}` to `x-idempotency-key` headers so replays across runs are not deduplicated.
  - Tests: 10 new `RemoteCorrelationStore` unit tests, 4 new wait-endpoint server tests, total 45/45 correlation-handler tests passing.

### Changed
- **WorkflowToolbar** hides the environment selector when previewing a sample workflow (previously showed an irrelevant `t01`/`prod`/`stage` dropdown that did nothing in preview mode).

### Tests
- New hook unit tests: `useWorkflowNavigation` (7), `useWorkflowConsole` (7), `useWorkflowEdgeOps` (8), `useWorkflowRunCache` (13), `useWorkflowPersistence` (13), `useWorkflowExtractionSample` (5) — **53 new tests** for hooks extracted from `WorkflowDesigner.tsx`.
- New unit tests: `workflowDesignerUtils` (25), `workflowEdgeGeometry` (23), `useWorkflows` (16), `useWorkflowExecution` (14), `useWorkflowDetailModal` (16), `useWorkflowNodeActions` (13), `useWorkflowCanvasSync` (11) — **118 new tests** for Round 4 refactoring.
- New E2E tests: `workflow-designer-refactor.spec.ts` (7 tests) — verifies extracted utils don't break canvas, minimap, auto-layout, or keyboard shortcuts.
- E2E fixes: Fixed `structure-history.spec.ts` BASE_URL (5199→5173), `export-options-popover.spec.ts` checkbox count (3→4 for Structure History), `workflow-template-gallery.spec.ts` strict-mode search locator, `app-features.spec.ts` implemented 2 skipped test stubs.

### Refactored
- **Modal standardization**: Migrated all modals to use `FullPanelModal` or `PopupModal` template components.
  - Created `PopupModal` — centered popup with transparent overlay, no resize/drag/expand.
  - Created `FullPanelModal` — full-panel modal with opaque background, no chrome.
  - Consolidated "hide modal chrome" CSS into reusable `.modal-no-chrome` utility class (was duplicated 3×).
  - Renamed `MoveDialog` → `MoveModal` for consistent `*Modal` naming.
  - Replaced feature-specific CSS classes (`copy-test-name`, `move-dialog-step`, etc.) with generic `popup-modal-*` classes.
  - Extracted `mergeById()` utility from `App.tsx` to `helpers.ts` (was duplicated 3× in import handler).
- **Dead code removal**:
  - Deleted `ImportCenter.tsx`, `ExportCenter.tsx` (never imported).
  - Deleted `VariablePanel.tsx`, `WorkflowHarnessContextBar.tsx` (never imported).
  - Deleted `workflowBundleExport.ts`, `workflowSubWorkflowValidation.ts` and their tests (orphan modules).
  - Deleted `import-export.css` (~70 unused classes for deleted components), `move-dialog.css` (empty).
  - Deleted `MoveDialog.tsx` (duplicate left from rename).
  - Removed debug artifacts: `crash-analysis.md`, `debug-modal.js`, `verify-scrollbar.js`, `scrollbar-diag.spec.ts`, `scrollbar-verify.spec.ts`.
  - Removed unused imports: `TestRun`, `loadTestRuns` from App.tsx, `useCallback` from TestEditorValidationTab.tsx.

### Tests
- New unit tests: `PopupModal` (6), `FullPanelModal` (8), `CopyTestModal` (8), `MoveModal` (15), `mergeById` (6) — **43 new tests**.
- New E2E test: `popup-modals.spec.ts` — CopyTestModal and MoveModal open/close/overlay behavior.
- Fixed `ExtractionMapperModal` and `RegexAssertionModal` tests to match FullPanelModal migration (overlay click, expand controls, button text).

### Refactored (Round 2 — Code Consolidation)
- **Shim removal — sampleWorkflows**: Deleted 3 re-export shim files (`sampleWorkflows.ts`, `sampleWorkflows/index.ts`, `sampleWorkflows/types.ts`); updated 4 consumers to import from canonical `galleries/workflows/` path.
- **Shim removal — sampleCatalogSpecs**: Migrated 2 legacy YAML specs into `galleries/catalog-specs/specs.ts`, inlined entries + `CATALOG_SPEC_CATEGORIES` into `galleries/catalog-specs/index.ts`; updated `CatalogImportModal` to import from `galleries/catalog-specs`; deleted `sampleCatalogSpecs.ts` + test.
- **Import unification — acquireOAuth2Token**: All 6 consumers now import from canonical `tokenManager.ts`; removed stale re-export from `executor.ts`.
- **Auth header deduplication**: Created shared `resolveAuthHeaders()` utility (`src/shared/utils/authHeaders.ts`); refactored 6 files (executor, RequestEditor, CatalogEndpointCard, curlGenerator, catalogCurlGenerator, TestEditorModal) to use it — eliminated 5 copies of the same auth-to-header logic.
- **Data fixes**: Corrected 3 inaccurate `endpointCount` values in catalog specs (FakeStore: 7→6, DummyJSON: 15→14, HTTPBin: 21→20).

### Tests (Round 2)
- New unit tests: `authHeaders` (14 tests, 100% coverage), `catalogSpecs` OpenAPI parsing + category tests (3 new tests).
- Fixed stale tests: `ExtractionMapperModal` (3 tests referencing removed expand buttons), `RegexAssertionModal` (6 tests for removed expand/shrink + close button), `workflows.test.ts` (removed backward-compat shim test).

- **WorkflowDesigner.tsx monolith reduction**: 1062 → 893 lines (−169 lines, −16%). Now under the 900-line monolith threshold.
  - Extracted `useWorkflowPersistence` hook: owns `serializeRFNodes`/`serializeRFEdges` (pure helpers), `persistWorkflow` (incl. webhook PUT registration), `insertNodeAndPersist`, paste/duplicate/copy/undo/redo handlers, `handleSave` + `saveAcknowledged` lifecycle, and `handleUpdateWorkflowVariables`.
  - Extracted `useWorkflowExtractionSample` hook: encapsulates the design-time "Fetch sample response" flow used by the Extract tab — host/auth resolution, entry-point variable seeding (start/schedule), JSON pretty-print of error bodies, and reset-on-selection-change.
  - `useWorkflowNodeActions` now receives `nextNodeY` from parent so paste (in persistence hook) and add (in node-actions hook) advance the same Y-cursor.
  - Removed dead imports (`Edge`, `StartNodeData`, `ScheduleTriggerNodeData`, `cloneWorkflowNodeDataForStorage`, `fetchScenarioSample`, `isHttpWorkflowNode` in node-actions, broken `UseToastReturn` type alias).

### Added (prior)
- **Async Correlation Wait Node — Phase 7E (Documentation & Examples)**
  - User Guide: `docs/workflow/CORRELATION_WAIT_GUIDE.md` — full tutorial with configuration, patterns, troubleshooting
  - API Reference: `docs/workflow/CORRELATION_WAIT_API.md` — all endpoints, request/response examples, security config
  - Example: `easy-payment-callback-workflow.yaml` — basic payment gateway callback (body correlation)
  - Example: `medium-approval-workflow.yaml` — manager approval with header correlation, webhook filter, 72h timeout
  - Example: `medium-cicd-build-callback-workflow.yaml` — CI/CD build trigger with query param correlation
  - Example: `hard-parallel-payment-workflow.yaml` — parallel payments with Fork/Join and 2 CorrelationWaits
- **Async Correlation Wait Node — Phase 7D.1–7D.4 (Advanced Features)**
  - Webhook security: HMAC-SHA256 signed URLs/tokens, token expiration, IP whitelist (CIDR), request signature validation
  - Idempotency: deduplication via `x-idempotency-key`/`x-request-id`/implicit correlationId, cached response replay, configurable TTL
  - Webhook filter expressions: `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `exists`, `&&`, `||`, nested field paths
  - Payload structure validation: required fields, type checking
  - Multi-correlation verified: parallel waits with independent resolution, failure isolation
  - Security configurable via `WEBHOOK_SECURITY_ENABLED`, `WEBHOOK_HMAC_SECRET`, `WEBHOOK_TOKEN_EXPIRY_MS`
  - 136 tests passing across security, idempotency, validation, handler, and correlation modules
- **Async Correlation Wait Node — Phase 7C (Database Persistence)**
  - `IServerCorrelationStore` interface for pluggable correlation storage
  - `InMemoryServerStore` — extracted from correlation-handler for clean DI
  - `SqliteServerStore` — write-through cache with `better-sqlite3`, WAL mode, auto-rehydration on restart
  - `PostgresServerStore` — event-driven with `pg` Pool, async writes, `DATABASE_URL` config
  - Shared SQL schema (`correlation-schema.ts`) for both SQLite and PostgreSQL
  - Store factory (`correlation-store-factory.ts`) with `CORRELATION_STORE_TYPE` env var (memory/sqlite/postgres)
  - Background cleanup job (60s interval) removes expired correlations
  - Graceful shutdown closes store connections
  - Refactored `correlation-handler.ts` to delegate to injectable store
  - 22 new unit tests (memory store, SQLite persistence/rehydration, factory)
- **Async Correlation Wait Node — Phase 7B (Execution History Integration)**
  - Paused node state with amber visual styling (border, dot indicator, pulse animation)
  - "Paused" filter tab in Execution History panel with live elapsed timer
  - Paused correlation cards showing correlation ID, webhook path, workflow/execution ID, timeout countdown
  - "Resume Manually" button to resume paused workflows from execution history
  - "Test Webhook" section in CorrelationWait config modal with auto-generated payload
  - 8 execution history unit tests, 4 config test webhook tests, E2E tests for Test Webhook section and paused tab
- **Async Correlation Wait Node — Phase 7A (In-Memory MVP)**
  - `CorrelationWait` node type: pause workflow execution and wait for an external webhook callback
  - Correlation ID expression with variable interpolation for matching incoming webhooks
  - Configurable correlation source: body (JSONPath), header, or query parameter
  - Extract variables from webhook payload into workflow context
  - Timeout support (ms/s/m) with automatic expiration
  - Optional webhook filter expression
  - State serialization/deserialization for paused workflow state
  - In-memory correlation store with `ICorrelationStore` interface
  - Backend webhook callback handler (`/webhooks/callback/*`, `/api/correlations/*`)
  - Unmatched webhook logging and cleanup endpoints
  - Canvas node with correlation ID preview, webhook path, and timeout display
  - Full config panel with InsertVarField, AvailableVariables, extract variables table
  - Node palette entry under Actions category
  - 41 backend integration tests, 15 handler tests, 52 UI component tests, E2E tests
- **Phase 7A Refactoring & Test Coverage**
  - Refactored `expressionFunctions.ts` (957 lines → 9 modular files: types, helpers, string/math/json/dateTime/conditional/encoding functions, index)
  - Refactored `App.tsx` (910 → 858 lines) — extracted `useTheme` hook
  - Refactored `WorkflowDesigner.tsx` (1432 → 1061 lines) — extracted 4 hooks: `useWorkflowNodeActions`, `useWorkflowCanvasSync`, `useWorkflowEdgeOps`, `useWorkflowDetailModal`
  - Extracted common utilities: `prettyJson()` (consolidated 7 duplicates), `formatBytes()`, `saveFile()`
  - Fixed async/await in 5 file download functions
  - Fixed 3 initialization order bugs in WorkflowDesigner hook ordering
  - Added 192 new unit tests across 7 files (executionMode, useSidebarResize, expressionFunctions helpers/index, csvTemplateTypes, httpMethodColors, regexAssertionUtils)
  - Added 14 E2E tests for refactored features (theme customization, sidebar resize, workflow navigation)
  - Total: 4546 unit tests passing (193 files), 91.47% line coverage
- **Script Transform Node — Phase D: Code Templates & Script Libraries**
  - Code template gallery with 12 templates across 4 categories (transform, validate, generate, utility)
  - Category filter tabs and search functionality for templates
  - Script libraries: reusable function modules shared across script nodes
  - Library manager UI with create, edit, delete, and checkbox selection
  - Library preamble injection into script execution sandbox
  - localStorage persistence for script libraries

---

## [0.5.4] — 2026-04-24

### Added
- **Activity Bar Layout**: Redesigned app shell with VS Code/Postman-inspired Activity Bar + contextual sub-navigation
  - 4-domain Activity Bar: API (🔌), Workflow (🔧), Testing (🏋), Settings (⚙️)
  - Contextual sub-nav tabs per domain: API (Requests, Catalog), Workflow (Designer, Executions, Webhooks), Testing (Scenarios, Runner, Results), Settings (Environments, Preferences)
  - Environment and service selectors moved to header for global access
  - Tab IDs and `?tab=` URL system unchanged for backward compatibility
- **Clear Run Status**: New Clear button in workflow toolbar to reset all node execution status (checkmarks, response times, edge highlights) back to original state
- **Workflow Node SVG Configure Icon**: Replaced small Unicode ⚙ character with a 14×14px SVG pencil/edit icon for better visibility; full "Configure..." text shown on hover tooltip
- **Workflow Node Label Overflow Fix**: Node labels now properly truncate with ellipsis instead of overflowing the node boundary
  - Added `overflow: hidden` and `min-width: 0` to all node body flex containers
  - CSS selector targets only label wrapper divs via `:has(.wf-node-label)` to avoid affecting icon badges
  - Increased node `max-width` from 280px to 320px for more label space
  - Added `flex-shrink: 0` to configure badge to prevent it from being squeezed

### Changed
- **Test Coverage**: 2143 unit/integration tests across 100 test files + 180 E2E tests (97.19% statements, 90.2% branches, 98.03% functions, 98.11% lines)
- **E2E Test Selectors**: Updated all E2E tests for new navigation structure (`.main-nav-tab` → `.sub-nav-tab`, `text=Workflow` → `.ab-btn[title="Workflow"]`, Gallery button → `+ New` → "From Template" dropdown path)

### Added
- **Switch, Loop, SetVariable & Aggregate Workflow Nodes**: Advanced control flow and data manipulation nodes for workflows
  - **Switch Node**: Multi-way branching based on expression evaluation — define cases with values and labels; unmatched values follow the Default path; visual badge showing expression and case count
  - **Loop Node**: Iterative execution with three modes — Count (fixed iterations with optional expression override), ForEach (iterate over JSON array with item/index variables), While (condition-based with operators ==, !=, >, <, contains, regex); configurable max iterations safety limit
  - **SetVariable Node**: Assign variables during workflow execution — define variable name/value pairs with template expression support; variables available to all downstream nodes
  - **Aggregate Node**: Collect and combine values across iterations — map source expressions to target variables with strategies (concat, sum, count, first, last, array); useful for accumulating results from loops
  - **GraphRunner Integration**: Switch evaluates expressions against case values for branch selection; Loop supports count/forEach/while iteration with VariableContext; SetVariable assigns to context; Aggregate collects across iterations
  - **Configuration Panels**: Dedicated config UIs for each node type with add/remove/reorder controls
  - **Workflow Palette**: All four nodes available in the drag-and-drop palette under Control Flow category

- **Extraction Mapper Modal Improvements**: Enhanced change detection and tree navigation
  - Color-coded row indicators: untouched (gray), changed (amber), new (green) with footer legend
  - Change detection via `originalExtractionsRef` comparing against initial state
  - Requests-style tree controls with Expand All / Collapse All buttons

- **Webhook & Schedule Trigger Nodes**: Event-driven and time-based workflow initiation (Phases 3 & 4)
  - **Webhook Trigger Node**: HTTP endpoint trigger for workflows
    - Configure HTTP method (GET, POST, PUT, DELETE, PATCH)
    - Define endpoint path for webhook registration
    - Sample payload JSON for variable extraction via JSONPath
    - Extract variables from payload for downstream nodes
    - Visual badge showing method, path, and extraction count
  - **Schedule Trigger Node**: Cron-based workflow scheduling
    - Cron expression configuration (standard 5-field format)
    - Timezone support for accurate scheduling across regions
    - Human-readable schedule description
    - Input variables for parameterized scheduled runs
    - Automatic trigger time variables: `{{triggerTime}}` (ISO date string), `{{triggerTimestamp}}` (Unix epoch)
  - **GraphRunner Integration**: Trigger nodes recognized as workflow entry points
    - `findStartNodes()` prioritizes webhook/schedule triggers over root HTTP nodes
    - Webhook variable extraction from samplePayload using JSONPath
    - Schedule time variable seeding on execution
  - **Test Coverage**: 31 new tests (11 unit + 20 E2E)
    - graphRunner.webhookSchedule.test.ts: 11 unit tests for trigger recognition, variable extraction, downstream flow
    - workflow-triggers.spec.ts: 20 E2E tests for node rendering, configuration modals, palette integration
  - All tests passing with >90% coverage maintained

- **Workflow Trigger Nodes & Parallel Execution**: Complete workflow control flow with Start, Fork, Join, and End nodes
  - **Start Node**: Define workflow entry point with input variable declarations for parameterized execution
  - **Fork Node**: Split execution into parallel branches - all branches execute concurrently
  - **Join Node**: Barrier synchronization - waits for all incoming branches before continuing
  - **End Node**: Terminal workflow node - marks successful completion or failure propagation
  - **Auto-Layout**: Intelligent graph positioning using Dagre hierarchical layout algorithm
    - Automatic node positioning with proper spacing and hierarchy
    - Centers condition branches and fork/join parallel paths
    - Aligns linear chains and resolves node overlaps
    - Persists layout state across sessions
    - Support for both TB (top-bottom) and LR (left-right) orientations
  - **Enhanced Workflow Execution Engine**:
    - Parallel execution for Fork/Join nodes - branches run concurrently via Promise.all
    - Join barrier coordination - tracks incoming branch counts and waits for all arrivals
    - End node state management - propagates success/failure states to all End nodes
    - Improved error handling - collects errors from all branches and marks affected End nodes
    - Skip subtree logic for failed condition branches
  - **Test Coverage**: 74 new comprehensive tests (65 unit + 9 E2E)
    - workflowAutoLayout: 23 tests, 80.97% branch coverage
    - graphRunner: 27 tests, 88.7% branch coverage
    - debugController: 14 tests, 92.85% branch coverage
    - fetchScenarioSample: 10 tests, 94.44% branch coverage
  - **E2E Tests**: workflow-auto-layout.spec.ts (4 tests), workflow-end-node.spec.ts (7 tests)
  - Workflow directory coverage: 98.12% statements, 91.68% branches, 100% functions, 99.1% lines

- **Variables & Chaining Engine (Phase A)**: Multi-step workflow execution with variable extraction and template resolution
  - New `VariableContext` class: layered variable store (environment → manual → extracted) with built-in generators (`{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt(1,100)}}`, `{{$isoDate}}`, `{{$randomEmail}}`, `{{$randomString(16)}}`)
  - `resolveScenario()`: Pure preprocessor that substitutes `{{varName}}` placeholders in URL, headers, body, form fields, and auth credentials
  - `Extraction` type + `extractVariables()`: Extract values from response body (JSONPath), headers, or status code into the variable context for downstream steps
  - `runWorkflow()` execution mode: Sequential chaining where each step can extract and pass values to the next; `runWorkflowLoad()` for repeated iterations with isolated per-run contexts
  - New `'workflow'` execution mode added to `ExecutionMode` type, integrated into executor routing and Web Worker
  - **UI: Extract tab** in TestEditorModal — configure per-request extractions with variable name, source, expression, and fallback
  - **UI: Workflow radio button** in Runner execution config with mode hint
  - **UI: Initial Variables editor** — shown when Workflow mode is selected, define key-value pairs for `{{var}}` templates
  - **CLI support**: `extract` array on test steps and `variables` object in test files for YAML/JSON workflow definitions
- **Request Timing Breakdown**: DNS/TCP/TLS/TTFB/Download waterfall for every request — diagnose *why* something is slow, not just *how* slow
  - New `TimingBreakdown` type with six phases: `dnsLookup`, `tcpConnect`, `tlsHandshake`, `ttfb`, `download`, `total`
  - `timing?` field added to `RequestResult` — backward-compatible, absent for older saved runs
  - **Vite proxy** (`/__proxy`): Server-side `performance.now()` timestamps capture TTFB and download time from the actual upstream request
  - **Node CLI**: Same TTFB/download split via `performance.now()` around `fetch()` and `.text()`
  - **Tauri desktop**: TTFB/download split via `performance.now()` (DNS/TCP/TLS granularity not yet available from `reqwest`)
  - **WaterfallBar** UI component: Color-coded horizontal bar chart with per-phase labels and totals
  - **Response Detail Modal**: Shows timing breakdown waterfall for each individual request
  - **Results Dashboard**: Aggregated average timing table across all requests in a test run
  - **CLI reporters**: Console summary and Markdown report include average timing breakdown table
- **Rich Assertions**: Four new assertion types that run on every request regardless of JSON validation mode
  - **Status Code** — Assert specific codes (`200`), classes (`2xx`), ranges (`200-299`), or comma-separated lists (`200,201,204`)
  - **Response Time SLA** — Assert response completes within a threshold (`≤ 500ms`)
  - **Response Header** — Assert header values with operators: `equals`, `contains`, `regex`, `exists` (case-insensitive header name lookup)
  - **Regex Match** — Assert JSONPath-extracted values match a regular expression pattern
  - Status code assertions override default HTTP error handling — asserting `404` makes a 404 response pass instead of failing
  - Assertions combine with existing JSON validation: status OK (by assertion or default) → JSON validation runs → all failures merged
  - New `Assertion` discriminated union type and `evaluateAssertions()` engine function
  - UI: "Assertions" section in the Validation tab with type-specific input fields and color-coded badges
  - CLI: YAML/JSON test files support `assertions` array in the `validation` block
  - **Regex Assertion Builder modal** — interactive popup for building regex assertions: paste/fetch JSON → click fields in tree to pick JSONPath → choose from 17 pre-built patterns across 5 categories (Text, Identifiers, Formats, Numbers, Arrays) or write custom → live preview shows match/no-match result
  - Assertion type badges shown on test cards in Scenario Builder (Status, SLA, Header, Regex) for at-a-glance identification
  - 63 new tests (31 unit + 10 integration + 22 modal logic) covering all assertion types, combinations, and edge cases
- **Connection Pooling**: HTTP connections are now reused via `keep-alive` instead of creating a new TCP/TLS connection per request
  - **Before**: Every outbound request opened a fresh TCP connection → DNS lookup + TCP handshake + TLS handshake overhead repeated thousands of times during a run
  - **After**: A shared `undici.Agent` pool keeps connections alive (30s idle timeout, up to 128 concurrent connections, pipelining) — subsequent requests to the same origin skip handshake overhead entirely
  - Vite dev proxy (`/__proxy`): Shared `undici.Agent` created at server startup, reused across all proxied requests, cleaned up on server shutdown
  - Node CLI mode (`nodeFetch`): Shared `undici.Agent` with identical pool settings; `closeNodePool()` exported for explicit cleanup
  - Tauri desktop mode: Already pooled via `reqwest` — no changes needed
  - `Connection: keep-alive` header injected on all outbound requests (Vite proxy + Node CLI)
  - Proxy environment support preserved — `EnvHttpProxyAgent` / `ProxyAgent` used when `HTTP_PROXY` / `HTTPS_PROXY` is set
  - Estimated 2–3x latency reduction for HTTPS APIs in browser dev mode (eliminates repeated TLS handshakes)
- **Worker Thread Execution**: Test execution offloaded to a Web Worker so the UI stays responsive during high-concurrency runs
  - **Before**: UI rendering, progress updates, charts, AND the engine (HTTP, validation, metrics) all shared one JS thread — causing stutters, frozen progress bars, and "page unresponsive" warnings during heavy runs
  - **After**: Engine runs in a dedicated Web Worker thread; main thread is free for 60fps rendering, smooth interactions, and accurate live metrics
  - Responsive UI: no stuttering or freezing during high-concurrency runs
  - Accurate metrics: engine timing is no longer skewed by React reconciliation or DOM repaints
  - Parallel execution: on multi-core machines, engine and UI truly run simultaneously (10–30% throughput improvement on CPU-bound validation-heavy tests)
  - Incremental result transfer: only new results are sent per progress update (avoids serializing the full array repeatedly)
  - Tauri HTTP proxy: in desktop mode, HTTP requests are forwarded from worker to main thread via `postMessage` so the Tauri HTTP plugin (main-thread only) is still used
  - Browser mode: worker uses `fetch(/__proxy)` directly — no main-thread round-trip for HTTP
  - Automatic fallback: if Web Workers are unavailable (e.g., test environments), falls back to direct main-thread execution transparently
  - New files: `executionWorker.ts` (worker entry), `workerBridge.ts` (main-thread bridge), `workerProtocol.ts` (typed messages)
  - `setHttpTransport()` API in `httpClient.ts` for injectable HTTP transport
  - `supportsWorkers()` detection in `platform.ts`
- **Think Time & Pacing**: Configurable delays between requests for realistic virtual user simulation
  - Four modes: None, Constant (fixed delay), Uniform (random min–max range), Gaussian (normal distribution with mean/stdDev)
  - New `src/engine/thinkTime.ts` module with `createThinkTimeDelay()` factory and `applyThinkTime()` with abort-signal awareness
  - Integrated into all four execution strategies: Sequential, Batch, Continuous Pool, and Load Profile
  - Think Time UI controls in Test Runner execution config with mode-specific input fields and descriptive hints
  - Think time config displayed in Progress header and Results dashboard context tags (orange "Think:" badge)
  - Think time persisted in runner config and progress storage for session continuity
  - New types: `ThinkTimeMode`, `ThinkTimeConfig`; `TestConfig` extended with optional `thinkTime` field
- **Workflow Node Config Modal**: Full-screen modal for editing HTTP, condition, and delay node configurations with draft/save/cancel pattern
  - Configure badge on every node type (HTTP, Condition, Delay) for one-click access
  - Double-click on any node opens config modal
  - Save/Cancel/Delete actions with unsaved-changes guard
- **Workflow Defaults Modal**: Modal for managing workflow-level default variables with draft/save/cancel
- **Auto-Layout Button**: One-click dagre-based hierarchical layout for workflow graphs (top-to-bottom)
  - New `workflowAutoLayout.ts` utility using `@dagrejs/dagre` with configurable direction, node spacing, and rank separation
- **Workflow MiniMap**: React Flow minimap overlay for large workflow navigation
- **Shared Variable Source Map**: Extracted `workflowSourceMap.ts` utility for resolving variable sources across workflow nodes
- **Variable Insert Modal Hook**: Shared `useVariableInsertModal` hook for consistent variable picker behavior across modals
- **Snapshot Utility**: `snapshot<T>()` deep-clone helper in `helpers.ts` for draft/save/cancel patterns
- **Inline Expression Autocomplete**: `ExpressionInput` and `ExpressionTextarea` components provide inline autocomplete across all expression-capable fields
  - Type `{{` to trigger variable hints dropdown (filtered by what you type)
  - Type `$` to trigger expression function hints (`$upper`, `$concat`, `$jsonpath`, etc.)
  - Arrow keys navigate, Enter/Tab accepts, Escape dismisses
  - Portal-rendered dropdown with proper z-index layering (10100) above config modal overlays
  - `requestAnimationFrame`-based blur handling prevents dropdown from closing during React re-renders
  - Applied to: HTTP node URL input, header value inputs, body textarea, extraction expression/fallback fields, Condition left operand expression textarea, Condition right operand input
- **Searchable Variable Select**: Custom combobox replacing native `<select>` in Condition node's "Choose variable" mode
  - Type-to-filter search across variable names, labels, and source nodes
  - Variables grouped by source node with section headers (e.g., "GET USERS", "WORKFLOW", "START")
  - Alphabetically sorted items within each group
  - Type badges (string, number) on each item
  - Keyboard navigable (Arrow keys, Enter to select, Escape to close)
  - "Custom name…" option for manual variable references
  - Checkmark indicator on currently selected variable
  - Click-outside-to-close and viewport-aware positioning

### Fixed
- **Results Dashboard**: Request Details groups now fully expanded by default at all nesting levels (previously only top-level groups expanded)
- **WorkflowDefaultsModal**: Fixed duplicate declarations of `requestVariableInsert` and `handleVariableInsertPicked` that caused build errors

### Changed
- **Test Coverage**: 1997 unit/integration tests across 87 test files + 109 E2E tests (97.05% statements, 90.10% branches, 97.74% functions, 98.04% lines)
- **Shared Hook Refactoring**: Extracted common patterns into reusable hooks
  - `useListCrud<T>` hook: generic ordered-list CRUD (update, remove, move) shared by AggregateConfig, SetVariableConfig, SwitchConfig
  - `useNodeBase` hook enhanced: now returns `{ rs, stateClass, debugStep, handleConfigure }` — used by SwitchNode, LoopNode, AggregateNode, SetVariableNode, ForkNode, JoinNode
  - ForkNode/JoinNode refactored from raw hook calls to `useNodeBase`
- **Shared Utilities Refactoring**: Extracted duplicate code into single canonical sources
  - Extracted `serverFormatters.ts` with shared formatting utilities for server-related components
  - Extracted `server-api.ts` shared types for webhook delivery logs, execution history, and server status
  - `useDebounce` hook: consolidated from 3 inline copies into `src/hooks/useDebounce.ts`
  - `escapeRegExp()`: consolidated from 2 copies into `src/utils/helpers.ts`
  - `formatBytes()`: consolidated from 4 copies into `src/utils/helpers.ts`
  - `toErrorMessage()`: new utility replacing 20+ inline `err instanceof Error ? err.message : String(err)` patterns
  - `typeColor()` / `getValuePreview()` / `ChevronIcon`: consolidated from 3 tree viewers into `src/components/shared/jsonTreeShared.tsx`
  - `saveJsonKey()` / `loadJsonKey()`: generic helpers replacing 4 duplicate load/save pairs in `storage.ts`
  - `applyFetchUrlOverrides()`: extracted from 2 duplicate URL-override blocks in `TestEditorModal.tsx`
  - Unified `.jt-*` CSS classes across all JSON tree viewers (removed duplicate `.json-tree-*` classes)
- **E2E Test Fix**: Fixed flaky `workflow-variable-insert.spec.ts` where delete button intercepted pointer events on `Insert…` button

---

## [0.5.2] — 2026-04-19

### Added
- **Group Collections**: New `group` collection type that acts as a parent container for Direct URL and Multi-Environment collections, enabling hierarchical organization with recursive nesting (groups inside groups)
- **Group Sidebar UI**: Visual distinction between Group, Direct URL, and Multi-Environment collections with unique icons and badges; recursive expand/collapse rendering; group-specific context menu (add child group/collection, rename, duplicate, move, export/import, delete)
- **Group Drag-and-Drop**: Move collections into and out of groups via drag-and-drop in the sidebar
- **Group Import/Export**: Export a group and all its child collections as a single JSON file; import recognizes group format and restores the hierarchy
- **Catalog "Send to Group"**: "Send All to Requests" modal now includes a "Target Group" dropdown to place exported collections into a new or existing group
- **Catalog Request Metadata**: When sending endpoints from the API Catalog to Requests, each `RequestItem` now carries a `catalogMeta` field with operation ID, description, original path, tags, deprecated flag, parameters, expected responses, security requirements, and source spec info
- **API Info Drawer**: On-demand side panel in the Request Editor (toggle via "ℹ API Info" button) that displays catalog metadata for requests originating from the API Catalog — replaces the response panel when open
- **Catalog Origin Indicators**: Sidebar shows a clipboard icon for catalog-origin requests and a warning icon with strikethrough styling for deprecated endpoints
- **API Catalog**: Standalone top-level feature for importing, browsing, testing, and versioning OpenAPI/Swagger specifications
- **Catalog Import**: Import OpenAPI 3.0/3.1 and Swagger 2.0 specs from file or paste YAML/JSON directly
- **Catalog Endpoint Browser**: Swagger-UI-style interactive endpoint detail with parameter forms, request body editor, response schemas, and "Try It" execution
- **Catalog cURL Integration**: Generate cURL commands per endpoint with real OAuth2 token acquisition, syntax highlighting, single/multi-line toggle, and copy to clipboard
- **Catalog Versioning**: Re-import updated specs, version history with visual endpoint diff (added/removed/changed), version restore, and version cap (max 10)
- **Catalog Auth Panel**: Auth configuration with Inherit from Spec, From Environment (OAuth2/Bearer/Basic/API Key), and manual options; "Verify Auth" button with token validation
- **Catalog Environments**: Unified with global Environments; microservice linking provides base URLs and auth per environment
- **Catalog Persistence**: Auth tokens, endpoint form values (params, headers, body), environments, and host strategy survive browser refresh and server restart
- **Catalog Overview Page**: API summary with endpoint stats by method/tag, server list, security schemes, and quick action buttons
- **Catalog "Send to Requests" Modal**: Two-panel modal with environment/endpoint selection, custom name column, sample inclusion checkboxes, resizable columns, and live collection preview tree
- **Catalog Export with Samples**: Selectively export user-entered "Try It" values (params, headers, body) as pre-filled request data
- **Catalog Version in Collection Name**: Exported collections include the YAML spec version, e.g., "sales-product-autoassign (1.0.0)"
- **Requests Linked Microservices**: Collections can link to a Microservice to inherit base URLs and auth from Environments config
- **Dynamic Catalog Auth Switching**: Authorization automatically updates when switching environments for linked microservices
- **Unified Environment Management**: Top-level Environments section replaces per-project configuration; all features pull from a single source of truth
- **CLI Runner** (`redfireforge run`): Execute API performance tests from YAML or JSON files via command line
- **YAML/JSON test file format**: Declarative test definitions with `baseUrl`, `defaults`, `config`, and `tests` sections
- **CLI validate command** (`redfireforge validate`): Validate test file structure without running
- **JUnit XML reporter**: `--junit report.xml` for CI/CD integration (GitHub Actions, Jenkins, GitLab CI)
- **JSON report output**: `-o report.json` generates full `TestRun` report compatible with the UI
- **Markdown report output**: `--markdown report.md` generates human-readable summary tables
- **CI exit codes**: `--fail-on-error` (exit 1 on any failure) and `--fail-threshold <pct>` (exit 1 above error rate)
- **CLI flags**: `--concurrency`, `--transactions`, `--mode`, `--timeout`, `--retries`, `--base-url`, `--env`, `--quiet`
- **Corporate proxy support**: Auto-detects `HTTP_PROXY`/`HTTPS_PROXY` for Node.js environments
- **Example test files**: `examples/sample-api-test.yaml`, `examples/load-profile-test.yaml`, `examples/auth-test.yaml`, `examples/sample-api-test.json`
- **esbuild CLI build**: `npm run build:cli` bundles to a single distributable `dist-cli/redfireforge.mjs`
- **Response History Dropdown**: Requests Send button now shows response history with timestamps, status, and restore/delete/clear actions
- **Unit tests (117 initial + 146 + 45 = 308 new tests)**: Comprehensive test coverage bringing total to 728 tests at 91.5%+ line coverage; new test files for `bodySerializer`, `export`, `scenarioImportExport`, `executor`, `tokenManager`, `requestExecution`, `loadProfileRunner`, `platform`, `fileSaver`, `httpClient`, `tauriStore`, `requestUrlResolver`; expanded tests for `curlParser`, `catalogCurlGenerator`, `testEditorUtils`, `storage`, `requestTree`, `circuitBreaker`, `validator`, `catalogSpecDiff`
- **Safe request insertion (`addReqToFolderSafe`)**: Utility in `requestTree.ts` that falls back to collection root if target folder ID is invalid, preventing silent data loss during drag-and-drop
- **Safe folder insertion (`addFolderToParentSafe`)**: Utility in `requestTree.ts` that falls back to root level if parent folder ID is invalid, preventing silent folder loss during moves and imports
- **URL resolver module (`requestUrlResolver.ts`)**: Extracted base URL resolution, display URL building, and send URL resolution from `RequestEditor` into a testable utility module

### Changed
- **Renamed Workbench → Requests throughout codebase**: All types (`RequestItem`, `RequestCollection`, `RequestFolder`, `RequestEnv`, `RequestsData`), files (`useRequests.ts`, `requestTree.ts`, `requestUrlResolver.ts`, `requestAuthState.ts`, `Requests.tsx`, `requests.css`, `components/requests/`), functions (`useRequests`, `loadRequests`, `saveRequests`), CSS class prefix (`wb-` → `req-`), tab ID, export format types, and storage key (`perf-test-requests`) now use consistent "Requests" naming; storage includes one-time migration from legacy `perf-test-workbench` key
- **Sidebar nav rail**: Replaced horizontal tab bar with vertical nav rail; renamed sections to **Requests** (was Workbench), **Catalog** (unchanged), **Harness** (was Projects) to better reflect their purpose
- **Platform detection**: `isTauri()` now safe in non-browser environments; added `isNode()` for CLI mode
- **HTTP client**: Added Node-native `fetch` path with `undici` proxy agent for corporate networks
- **Requests Send button**: Reduced height, added border-radius for a cleaner look
- **Requests status row**: Always visible with consistent min-width so Send button position stays stable with or without a response
- **Response history dropdown**: Aligned to right edge of trigger button; status pills sit tight against Send button
- **Refactored App.tsx**: Extracted catalog-to-requests export logic into `catalogExport.ts` (~120 lines), reducing App.tsx by ~80 lines
- **Refactored RequestCollectionModal.tsx**: Extracted auth state mapping helpers (`getAuthType`, `authToState`, `stateToAuth`, `emptyAuthState`) into shared `requestAuthState.ts` (~65 lines)
- **Typed `globalProfileId` on `AuthConfig`**: Added optional `globalProfileId?: string` field to `AuthConfig` interface, eliminating `Record<string, unknown>` casts and `as any` assertions throughout auth resolution code
- **Safe request moves**: `useRequests.moveRequest` and `moveRequestToCollection` now use `addReqToFolderSafe` to prevent silent request loss when target folder ID is invalid
- **Safe folder moves**: `addFolder`, `addSubCollection`, `moveFolderTo`, `moveFolderToCollection`, and `importFolder` now use `addFolderToParentSafe` to prevent silent data loss with invalid parent IDs
- **Duplicate path param replacement**: `catalogExport.ts` and `catalogCurlGenerator.ts` now use `replaceAll` for path parameter substitution to handle duplicate `{id}` segments in OpenAPI paths
- **Refactored URL resolution**: Extracted duplicated base URL resolution logic from `RequestEditor` `displayUrl` and `handleSend` into shared `requestUrlResolver.ts`, reducing the component by ~35 lines
- **Auth type label**: Renamed "Global Auth Profile" to "From Environment" in Catalog auth dropdown

### Fixed
- **API Key auth type mismatch**: `RequestCollectionModal` was saving `api-key` instead of canonical `apikey`, causing API Key auth to silently fail when sending requests
- **Stale auth resolution**: `resolveEffectiveAuth` in `RequestEditor` was missing `environments` and `appEnvironments` in its dependency array, causing stale auth when switching environments
- **cURL export missing environment auth**: `triggerCurlGeneration` was calling `resolveEffectiveAuth()` without the current environment ID, producing incorrect auth headers in exported cURL commands
- **Malformed saved data crash**: `hasSample` in `CatalogSendToRequestsModal` could throw on malformed persisted endpoint values (missing `params`, `headers`, or `body` properties)
- **Missing RequestFolder import**: `App.tsx` used `RequestFolder` type in a cast without importing it
- **URL path joining**: Catalog export could produce malformed URLs when OpenAPI paths lacked a leading `/` (e.g., `…/apiv1/users` instead of `…/api/v1/users`)
- **"Sample" column header not clickable**: `toggleAllSamples` was defined but never wired to the Sample column header in the Send to Requests modal
- **Pre-existing async test failures**: Fixed 12 tests in `catalogCurlGenerator.test.ts` that were calling async functions without `await`
- **Stale auth on environment switch**: `ApiCatalog` now clears auth to `{ type: 'none' }` when switching to an environment that has no `authProfileId`, instead of keeping the previous environment's credentials
- **Async sample sync in Send to Requests**: `sampleEps` state now syncs when `savedEpValues` loads asynchronously, ensuring all sampleable endpoints are pre-checked
- **Missing `resolvedColBaseUrls` in `handleSend` deps**: Added to `useCallback` dependency array in `RequestEditor`, fixing stale base URL mapping after environment changes
- **Move request data loss**: `moveRequest` and `moveRequestToCollection` could silently drop a request if the target folder ID was stale or invalid; now falls back to collection root via `addReqToFolderSafe`
- **Add request to invalid folder**: `addRequest` could set `selectedRequestId` to a request that was never stored when `folderId` was invalid; now uses `addReqToFolderSafe` for safe fallback
- **Move folder data loss**: `moveFolderToCollection` and `moveFolderTo` could silently drop a folder when `destParentFolderId` was invalid; now uses `addFolderToParentSafe` for safe fallback to root level
- **Import folder to invalid parent**: `importFolder` silently discarded the folder when `parentFolderId` didn't exist; now falls back to collection root level
- **Move scenario data loss**: `moveScenario` in `useProjects` could silently delete a scenario if `targetFgId` didn't exist; now validates target feature group before mutating
- **Move test data loss**: `moveTest` in `useProjects` could silently drop a test if target feature group or scenario didn't exist; now validates both targets before mutating; also skips unnecessary work for same-source/target scenario moves
- **CircuitBreaker NaN in reason**: `circuitBreaker.reason` returned `NaN%` when no requests were recorded (division by zero); now returns descriptive message
- **Validator path remapping discards success**: `tryRemapPaths` in `validator.ts` would discard a successful remapped result (empty failures array) because `[].every()` is vacuously true; fixed condition to also accept empty result arrays
- **Catalog version removal corrupts currentVersionId**: `removeVersion` in `useCatalog` left `currentVersionId` pointing at the removed version; now auto-selects the first remaining version
- **CatalogEndpointBrowser race condition**: Fast catalog entry switching could overwrite endpoint values for the wrong entry due to missing cancellation guard; added cleanup with `cancelled` flag
- **stateToAuth returns undefined**: `stateToAuth` in `requestAuthState` returned `undefined` for missing profile or default case, which could clear auth unexpectedly; now returns `{ type: 'none' }` for safety
- **cURL generator path param replace**: `buildFullUrl` in `catalogCurlGenerator` used `replace` instead of `replaceAll` for path parameters, only replacing the first occurrence of duplicate `{param}` segments
- **Load profile runner hangs on error**: Added `.catch()` to `launchOne()` promise chain — unhandled rejections (e.g., dev server down) no longer permanently stall execution at 0 requests
- **Pool runner hangs on error**: Same `.catch()` fix for `runPool()` which had the identical missing error handler
- **React crash on object error messages**: Non-string `errorMessage` and `failureDetails` values are now JSON-stringified before rendering in ResponseDetailModal, ResultsDashboard, and requestExecution
- **Stale chart display during active runs**: Live charts now show only current run data instead of falling back to previous run's saved time series
- **Thick scrollbar in Response Detail modal**: Added thin scrollbar styling (5px) to modal body and response body pre block

---

## [0.5.0] — 2026-04-18

### Added
- **Workbench (Ad-Hoc API Testing)**: Full Insomnia/Postman-style request editor with collections, folders, sub-collections, and per-request response caching
- **Collection hierarchy**: Collections → Folders (📁) / Sub-Collections (📦) → Requests with unlimited nesting depth
- **Drag-and-drop**: Move requests, folders, and entire collections between containers; drag a collection onto another to convert it into a sub-collection
- **Right-click context menus**: Add, rename, duplicate, move, export, import, and delete collections, folders, sub-collections, and requests
- **Per-environment base URLs**: Configure hostnames per environment in collection settings with dynamic URL resolution (relative path + full resolved URL display)
- **Sub-collection environment pinning**: Sub-collections can lock to a specific environment with isolated URL resolution and auth
- **Auth inheritance in Workbench**: Requests inherit auth from collection or override with Bearer, Basic, API Key, OAuth2, or Global Auth Profile
- **cURL import/export**: Paste cURL to create requests; generate cURL with live OAuth2 tokens from any request
- **JSON import/export for collections/folders**: Export and import collections or folders as JSON with format validation and duplicate name prevention
- **Export All Collections**: Single-click export of all collections into one JSON file from the COLLECTIONS header; import recognizes the format and restores all collections
- **Inline environment creation**: Add new environments directly from the Edit Collection modal without leaving the dialog
- **Insomnia-style console trace**: Detailed request/response trace (headers, timing, body prefixes) in a terminal-like viewer
- **Collapsible JSON tree response viewer**: Response bodies rendered as expandable/collapsible tree with search, match count, prev/next navigation, highlight, and collapse/expand all toggles
- **Response preservation**: Response data cached per-request and restored when navigating between requests
- **Query parameter management**: Enable/disable parameters via checkbox without deleting; order preserved across toggle
- **Unified sidebar**: Vertical Requests | Catalog | Harness nav rail with resizable width, collapse toggle, and persistent Settings button
- **Confirmation dialogs**: All delete actions require confirmation with item count
- **Duplicate name prevention**: Collection, folder, and sub-collection names validated for uniqueness at the same level

### Changed
- **Refactored WorkbenchRequestEditor.tsx** (1098→745 lines): Extracted `RequestAuthEditor`, `JsonTreePreview`, `ConsoleLog`, `MultiEnvResultRow` to dedicated files; extracted `useResponseCache` custom hook
- **Refactored WorkbenchSidebar.tsx** (726→524 lines): Extracted `SidebarContextMenu` (312 lines) to own component; removed dead helper functions
- **Refactored useWorkbench.ts** (578→424 lines): Moved 18 pure tree helper functions to shared `workbenchTree.ts` utility (170 lines)
- **Cleaned up Workbench.tsx**: Removed dead `findParentSubCollection` function and unused `projects` prop
- **CSS cleanup**: Merged duplicate rules, removed orphaned selectors, removed empty rules in `workbench.css`

### Fixed
- **Environment bar hidden in sub-collections**: Env bar and resolved hostname now display when inside a sub-collection even without formal workbench environments registered
- **Base URL resolution fallback**: Sub-collection base URLs are used as fallback when no environment ID matches, preventing "no base URL configured" errors

---

## [0.4.0] — 2026-04-16

### Added
- **Unit Test Suite (218 tests)**: Comprehensive Vitest test suite covering 14 modules — validator, executor, circuit breaker, metrics, load profile runner, scenario search, cURL parser, JSON path tree utils, test editor utils, results grouping, CSV template URL, helpers, file saver, and CSV export
- **Integration Test Suite (88 tests)**: Storage layer roundtrips (31), auth inheritance resolution (15), JSON import/export roundtrips (15), CSV template roundtrips (12), Excel template roundtrips (15)
- **E2E Test Suite (17 tests)**: Playwright tests for critical UI flows — create feature group/scenario/test (4), run test and view completion (4), results dashboard (4), navigation and settings (5)
- **`npm test` / `npm run test:watch` / `npm run test:coverage` scripts**: Runnable Vitest suite (306 tests)
- **`npm run test:e2e` / `npm run test:e2e:headed` scripts**: Playwright E2E tests with Chromium
- **Extracted `resolveAuth` utility** (`src/utils/authResolver.ts`): Shared auth inheritance chain resolver (Test → Scenario → Feature → Global → none), previously inline in TestRunner
- **Global "Unordered arrays" toggle in Test Runner**: Forces unordered array matching for all tests during execution — useful when APIs return array items in non-deterministic order. Persisted per runner config

### Fixed
- **UI crash during sustained testing (~10 min)**: Throttled progress state updates to max once per 500ms (was every request), added incremental metrics tracking instead of O(n log n) re-sort per tick, capped in-memory live results to 500 (all failures kept, passed results sampled), and capped stored results per run to 2,000
- **Error handling in load profile and pool execution modes**: Graceful error recovery during time-based load tests and connection pool runners

### Changed
- **Refactored 8 monolithic files into 25 focused modules**: No behavior changes; all existing imports preserved via barrel re-exports
  - `executor.ts` (641→144 lines) → `tokenManager.ts`, `circuitBreaker.ts`, `requestExecution.ts`, `loadProfileRunner.ts`
  - `csvTemplate.ts` (949→barrel) → `csvTemplateTypes.ts`, `csvTemplateUrl.ts`, `csvTemplateCsv.ts`, `csvTemplateExcel.ts`
  - `TestEditorModal.tsx` (1250→690 lines) → `testEditorUtils.ts`, `curlGenerator.ts`, `TestEditorAuthTab.tsx`, `TestEditorValidationTab.tsx`
  - `ScenarioBuilder.tsx` (1551→1116 lines) → `AuthConfigPanel.tsx`, `scenarioSearch.ts`, `scenarioImportExport.ts`
  - `TestRunner.tsx` (993→822 lines) → `LiveCharts.tsx`, `ProfilePreview.tsx`, `runnerProgressStorage.ts`
  - `SettingsModal.tsx` (643→251 lines) → `SettingsProjectsTab.tsx`, `SettingsStorageTab.tsx`
  - `ResultsDashboard.tsx` (639→519 lines) → `resultsGrouping.ts`, `ResponseDetailModal.tsx`
  - `JsonPathBuilder.tsx` (740→675 lines) → `jsonPathTreeUtils.ts`
- **Shared `useAuthVerify` hook**: Eliminated ~110 lines of duplicate auth verification logic across `TestEditorModal`, `ScenarioBuilder`, and `SettingsModal`
- **Shared `AuthConfigPanel` component**: Eliminated ~350 lines of duplicate auth form JSX in `ScenarioBuilder` (feature + scenario panels)

---

## [0.3.5] — 2026-04-15

### Added
- **Multi-Sheet Excel Template Export**: 3-step export wizard — (1) select URL path variables, (2) customize column names, (3) review & download. Generates `.xlsx` with styled Data sheet (Request/Response category headers) and Metadata sheet (COLUMN MAPPINGS, CONFIG, HEADERS sections with formatted tables)
- **Excel Template Import**: Import `.xlsx` templates with comprehensive file-level and row-level validation. Supports dynamic column detection for user-added validation fields. Backward compatible with legacy CSV imports
- **Response Error Display in Results**: Failed requests (HTTP 4xx/5xx) now show a clickable error snippet in the result row. Click to open a Response Detail modal with error message, validation failure table, and full response body
- **Detail Header Row in Grouped Results**: Expanding a group now shows column headers (Test Name, URL, Status, Validation, Time, Passed, Error/Details) above the individual result rows
- **Multi-Level Grouped Results**: Group results by Feature, Scenario, or Test Name with cascading sub-group options (Feature → Scenario → Test). Collapsible rows with per-group stats (total, passed, failed, validation failed, avg/min/max response time)
- **Advanced Search in Scenario Builder**: Boolean search engine with AND, OR, NOT/-, "quoted phrases", and (parentheses). Searches across test name, URL, method, headers, body, auth config, validation rules and expected values. Inline syntax help via ? button
- **Results Search**: Text search in the Results Dashboard Request Details — filter by name, URL, feature, group, or error message
- **Host Badge on Progress**: Shows the active host (Settings URL, custom URL, or Original) next to the execution mode tag in the Progress section
- **Request Timeout**: Per-request timeout (0–300s, default 10s). Timed-out requests are recorded as failures and execution moves to the next test
- **Retry on Failure**: Retry failed requests up to N times with configurable delay between attempts. Final result reflects the last attempt
- **Error Policy (Circuit Breaker)**: Three policies — Continue (ignore errors), Stop on First Error, or Stop at Threshold (configurable max error count and max error rate %). Applies across all execution modes including Load Profile

### Changed
- **Excel replaces CSV as primary template format**: Export button renamed "Export Template", import button renamed "Import Template". Both support `.xlsx` (preferred) and legacy `.csv`
- **Error extraction from HTTP error responses**: Executor now parses `message`, `error`, `detail`, or `errorMessage` from 4xx/5xx response bodies for meaningful error messages
- **xlsx-js-style replaces xlsx**: Switched to `xlsx-js-style` for Excel cell styling support (bold headings, colored backgrounds, merged cells)
- **Results Group By replaces Scenario dropdown**: The old "All Scenarios" dropdown (listing 100+ individual tests) is replaced by the Group By controls and search
- **Feature/Scenario/Test hierarchy in results**: `featureGroupName` and `groupName` are now threaded from the test hierarchy through execution into `RequestResult` for accurate grouping
- **Unified Execution Config**: Execution Mode, Concurrency, Transactions, Timeout, Retry, and Error Policy grouped into a single card. Load Profile Configuration appears as part of the same group when selected
- **Skip Validation moved**: Relocated from a standalone checkbox to the "Select Scenarios to Test" header row
- **Concurrency/Transactions always visible**: Disabled (not hidden) when Load Profile mode is active, keeping layout consistent

---

## [0.3.4] — 2026-04-14

### Added
- **CSV/Excel Template Import**: Create bulk tests from CSV files with metadata header, path variables, query parameters, and validation rules
- **CSV Template Export**: Generate a CSV template from an existing test, with smart URL analysis to identify variable path segments and query parameters
- **Drag-and-Drop CSV Import**: Drag CSV/Excel files directly into the import modal
- **Create Feature Group on Import**: Option to create a new Feature Group during CSV import (not just a new Scenario)
- **Verify Rules Button**: Invoke the API with current test config and compare response against validation rules, with host override option and detailed discrepancy table
- **Auto-Refreshing Token Manager**: OAuth2 tokens are shared across all tests with the same credentials and auto-refresh on JWT expiry (30s buffer), eliminating redundant token requests
- **Reusable CSV Generator Script**: `scripts/generate-csv-from-db.cjs` for generating importable CSV templates from PostgreSQL databases
- **CSV Generator Cursor Skill**: `.cursor/skills/generate-csv-template/` with instructions and reusable script for DB-to-CSV workflow
- **Sample CSV Templates**: Pre-built `sample_t01_100.csv` and `sample_prod_100.csv` with 100 diverse test records each

### Changed
- **Validation UI Consistency**: Imported tests now display validation rules in the same table format as manually configured tests (consistent header, auto-table view for array fields, "+ Add Manual Rule" button)
- **Token Acquisition**: Replaced upfront per-scenario token loop with lazy `TokenManager` — startup is instant regardless of test count
- **Unordered Array Matching**: CSV template export/import now correctly persists the `unorderedArrays` setting in metadata

### Fixed
- **JSONPath `$` Prefix**: Validator now correctly strips `$` or `$.` prefix from JSON paths (e.g., `$.offers[0].offerName`)
- **Unordered Array Mismatch Reporting**: Partial matches now report only mismatched fields with context (e.g., `matched by associatedOfferingCode=XYZ at [3]`) instead of generic "no matching item found"

---

## [0.3.3] — 2026-04-13

### Added
- **Load Profile Execution Mode**: New "Load Profile" option alongside Sequential, Batch, and Pool modes for time-based load testing
- **Ramp-Up Profile**: Gradually increase from 1 to N concurrent users over a configurable ramp period, then sustain
- **Sustained Load Profile**: Maintain a constant number of concurrent users for a specified duration
- **Spike Test Profile**: Run at base concurrency, then burst to a peak for a configurable window
- **Live Response Time Chart**: Streaming area chart of average response times (ms) per second during execution
- **Live Throughput Chart**: Streaming area chart of transactions per second (TPS) during execution
- **Live Error Rate Chart**: Streaming line chart of error percentage per second during execution
- **Live Concurrency Chart**: Step-area chart showing actual in-flight request count over time (load profile mode)
- **SVG Profile Preview**: Inline preview of the concurrency shape for the selected load profile configuration
- **Active Connections Gauge**: Real-time "Concurrency: X / Y" metric card during load profile runs
- **Roadmap Document**: Added `ROADMAP.md` tracking planned features across 5 phases

### Changed
- Test Runner progress section now shows time-based progress (elapsed/duration) for load profile runs
- Results Dashboard badge displays load profile details (type, peak, duration) instead of generic Batch/Concurrency/Total
- Load profile configuration (type, duration, concurrency) persists per project/environment/microservice context

---

## [0.3.2] — 2026-04-13

### Added
- **Response & Validation Version History**: Save snapshots of both the JSON response and validation rules as named versions, with restore and delete support
- **Save as Version**: Manually snapshot the current response + validation state at any time from the Validation tab
- **Visual Diff Comparison Modal**: Full-screen pop-up modal with side-by-side JSON diff (monokai dark theme) for comparing any two versions
- **Tabbed Comparison**: Compare modal has separate "Response" and "Validation Rules" tabs, each with full visual diff
- **Unordered Array Matching**: Toggle in compare modal to ignore array element order when diffing (works for arrays of objects)
- **Identical Version Banner**: Green checkmark banner when two compared versions are identical
- **Duplicate Version Prevention**: Automatically skips creating a new version when the response and validation rules are unchanged (uses canonical JSON comparison with sorted keys)
- **Excluded Paths for Deduplication**: Paths marked as excluded in validation rules are also ignored during duplicate version detection (handles dynamic fields like timestamps)
- **Manual Validation Rule Input**: "+ Add Manual Rule" now renders editable input fields for JSON path and expected value (previously showed empty non-editable text)
- **Host Override Persistence**: "Host Override" checkbox and URL value in the test editor now persist across close/reopen

### Changed
- Auth badge styling: consistent green highlight for configured types, reduced font size (0.75rem), bold, rounded corners
- "No Auth" badge now has rounded corners matching other badges
- Diff viewer uses monokai dark theme with green/red/blue tinting for added/removed/modified lines

### Fixed
- Project delete button was double-confirming (SettingsModal + App.tsx both called confirm), making deletion appear broken
- Response version diff was hard to read on dark backgrounds (switched to monokai theme with custom inline-diff styling)
- Unordered array comparison was not working for arrays of objects (library built-in sort failed; replaced with custom deep sort)
- Validation rule comparison showed false diffs due to array ordering of expectedFields and excludedPaths

---

## [0.3.1-beta.1] — 2026-04-12

### Added
- Per-context runner config: Concurrency and Total Transactions are now saved independently per project + environment + microservice combination
- Custom host URL input always visible in Test Runner (disabled when not in custom mode, dimmed styling)

### Changed
- Tagline renamed from "API Performance Studio" to "Redfire Performance Workbench"
- Sidebar: clicking a microservice or environment name only toggles expand/collapse, no longer changes content selection
- Git branching rules strengthened: all code changes must go through feature/* or hotfix/* branches

### Fixed
- Auth badge on test cards showing "Auth: none" when inheriting through scenario → feature → global auth profile chain
- Scenario-level "Verify Inherited Auth" button now resolves through feature to global auth profile
- Settings modal header clipped behind app header in desktop mode

---

## [0.3.0-beta.1] — 2026-04-12

### Added
- Project hierarchy: Project > Feature > Scenario > Test
- Each project contains its own environments, microservices, auth profiles, and feature groups
- Cross-project move for feature groups, scenarios, and tests with automatic dependency copy
- Copy/Move/Add for environments, microservices, and auth profiles between projects
- Global auth profiles (app-level, shared across all projects)
- Auth profile selector with separate Global and Project-level optgroups
- Project name context tag displayed on Feature Groups, Test Runner, and Results pages
- Project name stored in test run metadata and shown in results dropdown
- Reset All to 1 / Reset All to 0 buttons for test weight distribution
- Settings modal redesigned with sidebar navigation (Projects, Global Auth Profiles, Export & Import, Storage)
- Full-screen Settings modal with thin custom scrollbar
- Move dialog with hierarchical picker for target project/feature/scenario

### Changed
- Total Transactions now respects exact count — picks top-weighted tests when fewer slots than active tests
- Settings modal uses split layout with left nav tabs instead of single scrollable column
- Export/import updated to handle project-based v2 format with legacy v1 backward compatibility
- Test runner config persists correctly across tab switches (fixed race condition)
- Codebase modularized: App.tsx (1240→298 lines), ScenarioBuilder.tsx (2068→1287 lines)
- Monolithic App.css split into 8 focused CSS modules under src/styles/
- Extracted reusable components: SettingsModal, Sidebar, TestEditorModal
- Extracted hooks: useProjects (project state, CRUD, moves, persistence)

### Fixed
- Feature groups with orphaned env/svc references now visible as unassigned for reassignment
- Cross-project feature group move now copies referenced environments, microservices, and auth profiles
- Test runner config (host mode, custom URL) no longer resets when switching tabs

---

## [0.2.0-beta.1] — 2026-04-12

### Added
- Desktop application using Tauri (macOS, Windows, Linux)
- Native HTTP client for desktop mode (no CORS proxy needed)
- File-system storage for desktop mode (AppData directory)
- Global authentication profiles (Settings → manage named auth configs)
- Auth inheritance chain: Global Profile → Feature Group → Scenario → Test
- Import Center with conflict resolution (skip, overwrite, keep both)
- Export Center with standardized file naming (`{env}-{microservice}-{level}-{name}-{timestamp}.json`)
- Drag-and-drop reordering for scenarios and tests
- Cross-scenario/feature drag-and-drop moving
- Version badge in app header
- Version bump script (`scripts/version.sh`) with branch-aware tagging
- Git Flow branching strategy (master, develop, release/*, feature/*)
- GitHub Actions CI/CD for multi-platform builds
- `RELEASE.md` with full release process documentation

### Changed
- Renamed application from "Performance Test" to "RedfireForge"
- Storage layer converted to async (supports both localStorage and Tauri FS)
- Window title: "RedfireForge — Redfire Performance Workbench"
- Web header shows "Redfire Performance Workbench" subtitle; desktop omits it

### Fixed
- Tauri file path separator bug causing data loss on rebuilds
- URL scope permissions for Tauri HTTP plugin (all hosts/ports allowed)
- TypeScript build errors in ImportCenter, ScenarioBuilder, TestRunner

---

## [0.1.0] — 2026-04-10

### Added
- Initial web-based performance testing tool
- Feature Groups, Scenarios, and Tests hierarchy
- Environment and Microservice management
- Test Runner with configurable concurrency (sequential, parallel, ramp-up)
- OAuth2 authentication support
- JSON response validation builder
- Results Dashboard with historical test runs
- Export/Import functionality
- Sidebar navigation with environment/microservice filtering
- Vite dev server with CORS proxy for API requests

---

<!-- Template for new releases:

## [X.Y.Z] — YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Fixed
- Bug fixes

### Removed
- Removed features

-->
