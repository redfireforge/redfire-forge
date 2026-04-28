# Changelog

All notable changes to RedfireForge will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
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

### Refactored
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
