# RedfireForge — Roadmap

> Prioritized feature roadmap for open-source release.
> Check items off as they are completed.

---

## Positioning & Strategy

> Competitive analysis against k6, Gatling, Locust, Artillery, JMeter, Bruno, Hoppscotch, Postman.
> Last re-evaluated: 2026-06-07 (v0.6.0 on `develop`; after completing workflow designer, results explorer with debug console, trace levels, 3-runner architecture, data-driven testing, API catalog with Catalog→Harness integration, validation engine (16 assertion types, 24 operators, 125 functions, array assertions, DSL editor, ASSERT predicates, universal negation), Data Mapper (10 adapters, 8 gallery samples, 12 training manuals), webhook load driver with multi-webhook testing panel, **Rust HTTP executor** (reqwest + tokio with full validation engine, 656+ Rust tests), **Tier 1 JS throughput optimizations** (connection pool tuning, tick reduction, conditional body parsing), **multi-worker load distribution**, Trash Box soft-delete, **constant arrival rate** (open model, Rust arrival executor), **streaming percentiles** (Rust HDR Histogram), **Kafka Integration** (phases 1–10: settings UX, workflow nodes, runner, load policy, results publishing, native rdkafka Tauri transport, schema registry), **Kafka modularization** (KafkaService refactored from 660+ → 464 lines, gallery node factories extracted), and comprehensive code quality audit (23,000+ unit tests, 719 E2E tests, 656+ Rust tests, 99.51% coverage)).

### Identity

RedfireForge is a **visual API testing and workflow automation workbench** — not a raw load generator. Its strength is the intersection of **visual workflow design**, **deep execution observability**, **response validation**, and **performant load testing** in one integrated tool. No competitor covers this full stack:

| Tool | Visual Workflow | Load Testing | Response Validation | Debug Console | API Catalog | Data-Driven | Desktop Native |
|---|---|---|---|---|---|---|---|
| **k6** | No | Excellent | Basic `check()` | CLI stdout | No | JS scripting | No |
| **Gatling** | No | Excellent | Basic | Report-only | No | Feeders | No |
| **Locust** | No | Good | Manual (Python) | CLI stdout | No | Python code | No |
| **JMeter** | Tree editor (dated) | Good | Verbose XML | View Results Tree | No | CSV DataSet | No |
| **Artillery** | No | Good | Basic | CLI stdout | No | YAML payloads | No |
| **n8n** | Yes (DAG) | No | No | Basic logs | No | No | Self-hosted |
| **Bruno** | No | No | Manual | Console | No | Environments | Yes (Electron) |
| **Hoppscotch** | No | No | Manual | Console | No | Environments | No |
| **Postman** | Flows (basic) | Limited (paid) | Good | Console | Partial (paid) | Data files | Yes (Electron) |
| **RedfireForge** | **Yes (full DAG)** | **Excellent (Tauri)** | **Excellent (100%)** | **Full debug console** | **Yes (OpenAPI)** | **CSV/Excel/API** | Yes (Tauri) |

### Key Differentiators

1. **Visual workflow designer with full graph execution** — Fork/Join parallel paths, conditions, loops, switches, sub-workflows, correlation waits, script transforms — executed as load tests with iteration-level trace capture. 19 node types in a React Flow DAG editor. No competitor offers a visual workflow editor that doubles as a performance test runner.
2. **Results Explorer with debug console** — Interactive execution replay: click nodes to see request/response, drill into sub-workflows, filter by iteration/state, search logs. Tiered trace levels (Minimal → Debug) with per-node log buffering and aggregate summary. The depth of JMeter's View Results Tree with the UX of a modern IDE debugger.
3. **Sophisticated validation engine** — JSONPath builder, regex assertions, structured assertions (array length, numeric compare, date compare), response time SLA, header validation, unordered array matching — all composable with visual builder UI and assertion presets.
4. **API Catalog with OpenAPI import** — Browse endpoints with Swagger-style documentation, test interactively, generate cURL, version-track specs, and bulk-export to load tests with environment-aware base URLs. Batch promotion to Harness with coverage tracking. No other load testing tool integrates catalog → test workflow → load test pipeline.
5. **Three-runner architecture with data-driven testing** — Standard Runner, Parameterized Runner (CSV/Excel/JSON/API row expansion), and Workflow Runner — each purpose-built. Shared data sources, row-level validation columns, populate from API, re-run failed rows.
6. **Enterprise-friendly data workflow** — Excel template import/export (3-step wizard, styled sheets), CSV data files, parameterized copy conversion. QA teams work in spreadsheets — we meet them there.
7. **Dual deployment with Rust executor** — Tauri desktop app (lighter than Electron) + web mode with zero install. Same codebase, same features, different runtimes. Desktop mode includes a native Rust HTTP executor (`reqwest` + `tokio`) for 5,000-10,000+ RPS with constant arrival rate (open model) and HDR Histogram streaming percentiles — a significant throughput leap over browser-only execution.
8. **CLI + CI/CD ready** — `redfireforge run` and `redfireforge run-workflow` with JUnit XML, JSON, Markdown reports, `--trace-level`, CI exit codes. Pre-commit hooks (tsc + ESLint) and GitHub Actions CI already configured.

### Positioning

- **Tagline**: "Visual API Testing Workbench"
- **Elevator pitch**: "Design API workflows visually, validate responses with precision, run them under load, and debug failures with a full execution console — from a modern desktop app or your browser. The JMeter replacement for teams who deserve better UX."
- **One-liner for developers**: "If Postman and k6 had a baby with n8n's workflow editor and JMeter's load testing, you'd get RedfireForge."

### Competitive Advantages Summary

| Capability | RedfireForge | Closest Competitor | Our Edge |
|---|---|---|---|
| Visual workflow load testing | Full DAG with 19 node types | JMeter (XML tree) | Modern React Flow canvas vs 2000s Java Swing |
| Execution debugging | Results Explorer + Debug Console | JMeter (View Results Tree) | Tiered trace levels, aggregate summary, sub-workflow drill-down |
| Assertion builder | Visual Data Mapper + 24 operators + DSL + ASSERT + array assertions | Postman (scripted) | No-code assertion composition with live verification, color-coded operator pills, and DSL code editor |
| API Catalog integration | OpenAPI import → Harness load test pipeline with batch promotion, coverage tracking | None | Unique: catalog → test → load test in one tool |
| Data-driven testing | CSV/Excel/JSON/API with row validation | JMeter (CSV DataSet) | Visual editor, populate-from-API, re-run failed rows |
| Desktop app size | ~15 MB (Tauri) | ~250 MB (Postman/Electron) | 15x smaller, native performance |
| Throughput (desktop) | 5,000-10,000+ RPS (Rust executor + constant arrival) | k6 (10K+), JMeter (~5K) | Native Rust executor with open-model load generation matches dedicated load tools |

### Risks & Mitigations

| Risk | Status | Mitigation |
|---|---|---|
| ~~No tests~~ | **RESOLVED** | 23,000+ unit tests + 656+ Rust tests (99.51% coverage all files), 719 E2E tests (Playwright), pre-commit hooks, CI pipeline |
| ~~No CLI / CI~~ | **RESOLVED** | CLI runner with JUnit/JSON/Markdown reports; GitHub Actions CI; `--trace-level` flag |
| ~~No request chaining~~ | **RESOLVED** | 19 node types: HTTP, Condition, Loop, Switch, Fork/Join, Sub-Workflow, Script, Correlation Wait, etc. |
| ~~Monolithic codebase~~ | **RESOLVED** | Feature-based `src/features/` structure; all files under 900 lines; shared hooks/utils |
| ~~Browser-based executor~~ | **MITIGATED** | Rust executor (`reqwest` + `tokio`) in Tauri desktop mode reaches 5,000-10,000+ RPS with constant arrival rate and streaming percentiles; web mode remains at ~500-2,000 RPS; distributed execution planned for Phase 27 |
| Solo developer vs funded teams | **Active risk** | Open-source community + clean architecture lowers contribution barrier; comprehensive training manuals (192 files) |
| No server-side deployment | **Future** | Client-side architecture works for dev/QA use cases now; server deployment plan documented for production scenarios |

### Load Testing Maturity Levels

RedfireForge's load testing is currently rated **Good** in web mode and **Excellent** in Tauri desktop mode (with the Rust executor, constant arrival rate, and streaming percentiles). The remaining gap to fully "Excellent" at enterprise scale is distributed execution.

#### Level definitions

| Level | Description | Throughput | Examples |
|---|---|---|---|
| **Good** (web mode ✅) | Variables, chaining, rich assertions, multi-worker threads, connection pooling, think time, timing breakdown, trace levels, debug console | ~500-2,000 RPS | RedfireForge (web), Artillery, JMeter |
| **Excellent** (Tauri ✅) | + Native Rust executor (`reqwest` + `tokio`), full validation in Rust, pool/sequential/load-profile/constant-arrival modes, circuit breaker, retry, cancellation, JS-side validation bridge, HDR Histogram streaming percentiles | 5,000-10,000+ RPS | RedfireForge (desktop), k6, Gatling |
| **Excellent (Enterprise)** | + Distributed multi-machine | 10,000-50,000+ RPS | k6 (cloud), Gatling Enterprise |

#### Current capabilities (Excellent: all gaps closed ✅ except distributed execution)

- Duration-based profiles: sustained, ramp-up, spike
- Fixed iteration count: sequential, batch, pool concurrency
- Circuit breaker (error count/rate threshold), retry with delay, per-request timeout
- CSV/Excel/JSON parameterized data-driven testing with row-level validation
- Live streaming charts (TPS, response time, error rate, active connections)
- OAuth2 token manager with JWT expiry detection
- Weighted scenario distribution in load profiles
- **Visual workflow engine**: React Flow DAG editor with 19 node types (HTTP, Condition, Switch, Loop, Fork/Join, Sub-Workflow, Script, Delay, Correlation Wait, SetVariable, Aggregate, Log/Debug, Error Handler, Webhook Trigger, Schedule Trigger, Start, End, WaitForCondition); `VariableContext` layered store; template resolution everywhere; built-in generators (`{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`, etc.); Service Registry with multi-environment endpoints
- **Think time & pacing**: constant, uniform random, gaussian delays for realistic virtual user simulation
- **Multi-worker execution**: Full engine in Web Workers — UI stays responsive at 60fps; automatic chunking based on `navigator.hardwareConcurrency`; per-worker concurrency distribution; Tauri HTTP proxied through main thread; automatic single-worker fallback; incremental result transfer with worker-namespaced IDs (`w{n}-` prefixes)
- **Connection pooling**: `undici.Agent` with keep-alive (10s timeout, 512 connections, pipelining 10); 2-3x latency reduction for HTTPS; Tauri pooled via `reqwest` (200 max idle per host, 90s timeout)
- **Rich assertions**: Status code, response time SLA, response header, regex on JSONPath, structured assertions (array length, numeric compare, date compare); Regex Builder modal with pattern library; assertion presets
- **Request timing breakdown**: Per-request TTFB/download waterfall; aggregated timing table; CLI console/Markdown reports
- **Trace capture levels**: Minimal (pass/fail only), Standard (structured data), Full (+ HTTP bodies), Debug (+ raw logs + script output); tiered storage and console rendering
- **Debug console**: Full execution console in Results Explorer with node filter, search, aggregate summary, sub-workflow expansion, docked/floating/maximized modes
- **Rust HTTP executor** (Tauri desktop only): `reqwest` + `tokio` async runtime with pool/sequential/load-profile modes; full Rust-side validation engine (assertion evaluator, field operators, JSON path, deep compare, subset match, date helpers, HTTP helpers); JS-side validation bridge for complex assertions; `canUseRustExecutor` auto-detection with graceful fallback for OAuth2/workflow mode; 542 Rust tests
- **Tier 1 JS optimizations**: Connection pool tuning (512 connections, pipelining 10), `Promise.race` timeout leak fix, load profile tick 500ms→100ms, O(1) counter-based concurrency in `graphLoadRunner`, conditional body parsing, multi-worker load distribution with load-profile meta aggregation
- **Constant arrival rate**: Open-model load generation via Rust arrival executor (`arrival_executor.rs`); configurable target RPS, duration, max in-flight limit, ramp period; backpressure handling with dropped request tracking; `droppedRequests`, `peakRps`, `targetRps` metrics on `TestSummary`
- **Streaming percentiles**: Rust HDR Histogram (`histogram.rs`) for memory-efficient P50/P95/P99/P99.9 calculation without storing every datapoint; accurate at 100K+ results

#### Gap analysis: Good → Excellent (remaining)

| # | Gap | Why it matters | Phase |
|---|---|---|---|
| ~~7~~ | ~~**Native Rust executor**~~ | ✅ **DONE** — `reqwest` + `tokio` in Tauri with full validation engine (542+ Rust tests) | ✅ 11.5 |
| ~~8~~ | ~~**Constant arrival rate**~~ | ✅ **DONE** — Open-model load generation: send N RPS regardless of response time; Rust arrival executor with ramp, backpressure, cancellation | ✅ 11.6 |
| ~~9~~ | ~~**Streaming percentiles**~~ | ✅ **DONE** — Rust HDR Histogram for P50/P95/P99/P99.9 without storing every datapoint; scales past 100K results | ✅ 11.6 |
| 10 | **Distributed execution** | Coordinate load across multiple machines/processes → break single-machine limits | 27 |

#### Implementation order

```
Priority 1 — Reach "Good" ✅ COMPLETE
  ① Variables & Chaining      → ✅ done
  ② Think time & pacing       → ✅ done
  ③ Worker thread execution    → ✅ done (+ multi-worker in Phase 11.5)
  ④ Connection pooling         → ✅ done (+ tuned 512/10 in Phase 11.5)
  ⑤ Rich assertions            → ✅ done
  ⑥ Request timing breakdown   → ✅ done

Priority 1.5 — Rust Executor (Phase 11.5) ✅ COMPLETE
  ⑦ Tier 1: JS optimizations   → ✅ done (pool tuning, tick, conditional parse)
  ⑧ Tier 2: Rust executor      → ✅ done (reqwest + tokio, pool/seq/load modes)
  ⑨ Tier 3: Rust validation    → ✅ done (full assertion engine in Rust, 542 tests)

Priority 1.6 — Streaming Percentiles & Constant Arrival (Phase 11.6) ✅ COMPLETE
  ⑩ Constant arrival rate      → ✅ done (Rust arrival executor, open-model RPS)
  ⑪ Streaming percentiles      → ✅ done (Rust HDR Histogram, P50/P95/P99/P99.9)

Priority 2 — Reach "Excellent (Enterprise)" (Phase 27)
  ⑫ Distributed execution      → enterprise-scale multi-machine coordination
```

---

## Completed Phases

### Phase 1 — Load Profiles & Live Monitoring ✅

Graduate from "send N requests" to real performance testing with time-based execution.

- [x] **Duration-Based Runs** — "Run for 60 seconds at 10 concurrent" instead of fixed iteration count
- [x] **Ramp-Up Profile** — Gradually increase from 1 to N concurrent users over X seconds
- [x] **Sustained Load Profile** — Maintain N concurrent users for X duration
- [x] **Spike Test Profile** — Sudden burst of traffic to test resilience
- [x] **Active Connections Gauge** — Real-time count of in-flight requests
- [x] **Live Response Time Chart** — Streaming line chart of response times during execution
- [x] **Live Throughput Chart** — TPS over time during execution
- [x] **Live Error Rate Chart** — Error percentage over time during execution

### Phase 2 — Data-Driven Testing & Resilience ✅

Bulk testing with data files, request resilience, and advanced results.

- [x] **CSV Data Files** — Run the same test with different inputs from CSV (parameterized testing)
- [x] **Per-Request Timeout** — Configurable timeout per request (default 10s, 0 = unlimited)
- [x] **Retry on Failure** — Retry N times with configurable delay per test
- [x] **Circuit Breaker / Error Policy** — Stop on first error, or at error count/rate threshold
- [x] **Multi-Level Grouped Results** — Group by Feature → Scenario → Test Name with cascading sub-groups
- [x] **Advanced Search** — Boolean search (AND, OR, NOT, "quoted phrases", parentheses) in Scenario Builder and Results
- [x] **Verify Validation Rules** — Invoke API and compare response against expected rules with discrepancy detail
- [x] **Auto-Refreshing Token Manager** — Shared OAuth2 token cache with JWT expiry detection

### Phase 3 — Excel Templates & Error Visibility ✅

Structured multi-sheet Excel templates for bulk test management and better error diagnostics.

- [x] **Multi-Sheet Excel Template Export** — 3-step wizard: select path variables → customize column names → review & download styled `.xlsx`
- [x] **Styled Data Sheet** — Request/Response category headers with color-coded columns (blue for request, green for validation)
- [x] **Styled Metadata Sheet** — Formatted COLUMN MAPPINGS, CONFIG, HEADERS sections with bold headings and table layout
- [x] **Excel Template Import** — Parse `.xlsx` with file-level and row-level validation, dynamic column detection for user-added fields
- [x] **All Validation Modes** — Full support for no body validation, full JSON match, and selective fields through export/import round-trip
- [x] **Response Error Display** — Clickable error snippets on failed result rows; Response Detail modal with error message, validation failures table, and full response body
- [x] **HTTP Error Message Extraction** — Executor parses `message`/`error`/`detail` from 4xx/5xx response bodies
- [x] **Detail Header Row** — Column headers shown when expanding grouped results to individual test rows

### Phase 4 — CLI Runner ✅ (1 item remaining)

> Without a CLI, the tool is limited to manual use. This is the single most important feature for adoption.

- [x] **File-Based Projects** — Store test definitions as `.yaml` or `.json` files committable to git
- [x] **CLI Runner** — `redfireforge run ./tests/checkout-flow.yaml --env t01 --concurrency 10 --duration 60s`
- [x] **CI Exit Codes** — Exit code 1 if assertions fail or error rate exceeds threshold (`--fail-on-error`, `--fail-threshold`)
- [x] **JUnit XML Output** — For CI/CD integration (GitHub Actions, Jenkins, GitLab CI) (`--junit report.xml`)
- [x] **JSON/Markdown Report Output** — Machine-readable and human-readable summary reports (`-o`, `--markdown`)
- [ ] **npm Package** — Publish CLI as `npm install -g redfireforge`

### Phase 5 — Test Suite & Code Quality ✅

> Zero tests was a blocker for open-source credibility. Contributors won't trust or contribute to an untested codebase.

- [x] **Unit Tests — Executor** — `executor.ts`: buildHeaders (6 auth types), buildUrl, Content-Type auto-detection (24 tests)
- [x] **Unit Tests — Validator** — `validator.ts`: getByPath, full match, selective, unordered arrays, path remapping (28 tests)
- [x] **Unit Tests — Metrics** — `metrics.ts`: summary stats, TPS, percentiles, error rates (16 tests)
- [x] **Unit Tests — CSV/Excel** — `csvTemplateUrl.ts`: parseUrl, analyzeUrlPath, buildUrlFromTemplate (12 tests)
- [x] **Unit Tests — Engine** — `circuitBreaker.ts` (10), `loadProfileRunner.ts` (14), `scenarioSearch.ts` (25), `curlParser.ts` (14)
- [x] **Unit Tests — Utils** — `testEditorUtils.ts` (28), `resultsGrouping.ts` (14), `jsonPathTreeUtils.ts` (24), `helpers.ts` (2), `fileSaver.ts` (5), `export.ts` (2)
- [x] **Integration Tests** — Storage layer (31), auth inheritance resolution (15), JSON import/export roundtrips (15), CSV template roundtrips (12), Excel template roundtrips (15)
- [x] **E2E Tests** — Playwright: create feature group/scenario/test (4), run test (4), view results (4), navigation/settings (5)
- [x] **`npm test` Script** — Vitest (19,112 tests) + Playwright E2E (660 tests) + Rust (542+ tests)
- [x] **Refactor Large Components** — 8 monoliths broken into 27+ focused modules + 2 shared utilities + shared useAuthVerify hook + AuthConfigPanel

### Phase 6 — Requests (Ad-Hoc API Testing) ✅

> Insomnia/Postman-style ad-hoc request editor integrated into the app, independent of the project test hierarchy.

- [x] **Requests collections** — Organize requests in collections with folders, sub-collections, and unlimited nesting
- [x] **Drag-and-Drop** — Move requests, folders, and collections between containers; convert collections to sub-collections via drag
- [x] **Per-Environment Base URLs** — Configure hostnames per environment; dynamic URL resolution with relative/full path display
- [x] **Sub-Collection Environment Pinning** — Lock sub-collections to a specific environment with isolated auth and URL resolution
- [x] **Auth Inheritance** — Requests inherit auth from collection or override with Bearer, Basic, API Key, OAuth2, Global Auth Profile
- [x] **cURL Import/Export** — Paste cURL to create requests; generate cURL with live OAuth2 tokens
- [x] **JSON Import/Export** — Export/import collections and folders as JSON with validation and duplicate prevention
- [x] **Console Trace** — Insomnia-style request/response trace with headers, timing, and body
- [x] **Collapsible JSON Tree Viewer** — Expandable response tree with search, match navigation, and collapse/expand all
- [x] **Response Caching** — Preserve responses per-request during navigation
- [x] **Response History** — Per-request history dropdown with timestamps, restore, delete, and clear actions
- [x] **Unified Sidebar** — Vertical Requests | Catalog | Harness nav rail with resize, collapse, and persistent Settings
- [x] **Context Menus & Confirmation Dialogs** — Full right-click menus with duplicate/move/rename/delete and confirmation

### Phase 7 — API Catalog (OpenAPI/Swagger Browser) ✅

> **Third pillar of RedfireForge.** Import OpenAPI/Swagger specs, browse endpoints with Swagger-UI-style documentation, test them interactively, generate cURL commands, and track spec versions over time.

> Full design docs: [`docs/api-catalog/`](docs/api-catalog/) — [Design](docs/api-catalog/DESIGN.md) · [Data Model](docs/api-catalog/DATA-MODEL.md) · [UI Wireframes](docs/api-catalog/UI-WIREFRAMES.md) · [Phases](docs/api-catalog/PHASES.md)

**7.1 — Foundation**
- [x] **Catalog types** — `CatalogEntry`, `CatalogEndpoint`, `CatalogVersion`, `CatalogFolder`, host/auth config types
- [x] **OpenAPI parser** — Parse + validate + dereference specs via `@apidevtools/swagger-parser`; group endpoints by tag
- [x] **Schema stub generator** — Convert JSON Schema → sample request body (uses `example`/`default`/type fallback)
- [x] **Catalog sidebar** — Thin sidebar tab showing API names + version badges + endpoint count (no endpoint trees)
- [x] **Import modal** — File picker → validate → preview (title, version, servers, endpoints by tag, warnings) → import
- [x] **Storage hook** (`useCatalog`) — CRUD for catalog entries, persist via existing storage abstraction
- [x] **App integration** — Third nav rail section (`Requests | Catalog | Harness`), welcome page

**7.2 — Endpoint Browser**
- [x] **Endpoint nav strip** — Tag-grouped endpoint list inside main panel (not sidebar); search/filter, collapse, resize
- [x] **Endpoint detail view** — Swagger-UI-style: method badge, path, summary, parameters, request body schema, response schemas
- [x] **Main panel orchestrator** — Three modes: welcome (empty), overview (API selected), endpoint detail (endpoint selected)

**7.3 — Interactive Testing**
- [x] **Host & auth bar** — Strategy selector (From Spec / Custom URL / Environment) for base URL and authentication
- [x] **Parameter editor** — Editable forms for path, query, header params with type hints, enums, required badges
- [x] **"Try It" execution** — Build URL + headers + body → `httpFetch()` → display response (reuse `JsonTreePreview`)

**7.4 — cURL Integration**
- [x] **cURL generation** — Extend existing `buildCurlCommand` for catalog endpoint shape
- [x] **cURL preview popover** — Formatted command with single/multi-line toggle + copy to clipboard
- [x] **Context menu cURL** — Right-click endpoint in nav → "Copy as cURL" with schema defaults

**7.5 — Versioning**
- [x] **Version storage** — Each entry stores version history with raw spec + hash for change detection
- [x] **Re-import flow** — Detect existing API by title, compute diff, offer "Update existing" vs "Import as new"
- [x] **Spec diff engine** — Detect added/removed/changed endpoints between versions
- [x] **Version history modal** — List past imports, view diffs, restore previous versions

**7.6 — Polish & Bridges**
- [x] **Overview page** — API summary with endpoint stats by tag/method, server list, config status
- [x] **"Send to Requests"** — Copy endpoint(s) as `RequestItem` objects into a collection
- [x] **Swagger 2.0 verification** — End-to-end test with real Swagger 2.0 specs
- [x] **Unit + E2E tests** — Parser, stub generator, diff engine, import flow, endpoint browsing

### Phase 8 — Unified Environments & Catalog Export ✅

> Flatten the data model (remove per-project duplication), unify environment management across all features, and enhance Catalog → Requests export workflow.

- [x] **Unified Environment Manager** — Top-level `EnvironmentManager.tsx` page replaces the old Settings Projects tab; single source of truth for environments, microservices, and auth profiles shared by Requests, Catalog, and Harness
- [x] **Catalog Environment Association** — Catalog entries link to globally configured Environments via microservice; base URLs and auth resolve dynamically per environment
- [x] **"Send to Requests" Modal** — Two-panel modal with environment selection, endpoint selection, custom name column, sample inclusion checkboxes, resizable columns, and live collection preview tree
- [x] **Exported Sub-Collections** — Environment folders exported as sub-collections (📦 icon) with inherited base URLs and auth from linked microservice
- [x] **Spec Version in Collection Name** — Exported collections include the YAML spec version, e.g., "sales-product-autoassign (1.0.0)"
- [x] **Dynamic Auth on Env Switch** — Catalog auth automatically updates when switching environments for linked microservices; resets to none when env has no auth profile
- [x] **Safe Tree Operations** — `addReqToFolderSafe` and `addFolderToParentSafe` utilities prevent silent data loss on invalid folder/parent IDs during drag-and-drop and import
- [x] **URL Resolver Module** — Extracted `requestUrlResolver.ts` for testable base URL resolution, display URL building, and send URL resolution
- [x] **Auth State Module** — Extracted `requestAuthState.ts` for auth config ↔ UI state mapping with `globalProfileId` typing
- [x] **Catalog Export Module** — Extracted `catalogExport.ts` for catalog-to-requests data transformation
- [x] **728 Unit Tests** — 91.5% line coverage, 94.5% function coverage across 35 test files; 3 rounds of thorough code review with 25+ bugs found and fixed

### Phase 9 — Group Collections & Catalog Metadata ✅

> Hierarchical collection organization and rich metadata from API Catalog specs embedded in exported requests.

- [x] **Group Collections** — New `group` collection mode as a parent container for Direct URL and Multi-Environment collections; recursive nesting (groups inside groups)
- [x] **Group Sidebar UI** — Visual distinction (icons/badges) for Group, Direct URL, and Multi-Environment; recursive expand/collapse; group-specific context menu
- [x] **Group Drag-and-Drop** — Move collections into and out of groups via drag-and-drop
- [x] **Group Import/Export** — Export a group and all its children as one JSON file; import restores hierarchy
- [x] **Catalog "Send to Group"** — Target Group dropdown in "Send All to Requests" modal to place collections into a group
- [x] **Catalog Request Metadata** — `CatalogRequestMeta` interface attached to each `RequestItem` on export from Catalog with operationId, description, originalPath, tags, deprecated, parameters, expectedResponses, security, sourceSpec
- [x] **API Info Drawer** — On-demand side panel in Request Editor toggled via "ℹ API Info" button; displays all catalog metadata in a structured format, replacing the response panel when open
- [x] **Catalog Origin Indicators** — Clipboard icon (📋) for catalog-origin requests and warning icon (⚠️) with strikethrough for deprecated endpoints in sidebar
- [x] **Group Tree Utilities** — `countGroupRequests`, `collectGroupIds`, `collectAllGroups` functions in `requestTree.ts` with full test coverage

### Phase 10 — Variables & Chaining (Workflow Designer) ✅

> **Table stakes for real-world API testing.** Without this, you can't test multi-step workflows (create order → get order ID → verify order).

- [x] **Variable Templates** — Support `{{baseUrl}}`, `{{apiKey}}`, `{{timestamp}}` in URLs, headers, and body
- [x] **Built-in Generators** — `{{$randomEmail}}`, `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`, `{{$isoDate}}`, `{{$randomString(N)}}`
- [x] **Variable Extraction** — Extract values from responses using JSONPath (e.g., `$.data.id` → `{{orderId}}`), headers, or status code
- [x] **Variable Injection** — Use extracted variables in downstream test URLs, headers, and body
- [x] **Scenario Chaining / Workflow Mode** — Visual workflow designer with React Flow graph editor, drag-and-drop palette, Service Registry with multi-environment endpoints, 19 node types
- [x] **Workflow Control Nodes** — Start (entry point), End (terminal state), Fork (parallel split), Join (parallel merge), Condition (If/Else branching), Delay (think time between steps)
- [x] **Parallel Execution** — Fork/Join nodes enable true parallel execution paths; Join nodes wait for all incoming branches to complete before proceeding; tested with concurrent HTTP requests
- [x] **Auto-Layout** — Dagre-based hierarchical graph layout with smart post-processing: centers condition branches, aligns fork/join paths, resolves overlaps, maintains left-to-right flow
- [x] **Switch Node** — Multi-way branching based on expression evaluation; define cases with values/labels; unmatched values follow Default path; visual expression badge
- [x] **Loop Node** — Iterative execution with three modes: Count (fixed/expression), ForEach (JSON array iteration with item/index variables), While (condition-based loop); configurable max iterations safety limit
- [x] **SetVariable Node** — Assign variables during workflow execution; name/value pairs with template expression support; variables propagate to downstream nodes
- [x] **Aggregate Node** — Collect and combine values across iterations; source→target mappings with strategies (concat, sum, count, first, last, array)
- [x] **Webhook Trigger Node** — HTTP endpoint trigger for workflows; configure method, path, sample payload; extract variables from webhook body via JSONPath; visual badge showing method, path, and extraction count
- [x] **Schedule Trigger Node** — Cron-based workflow scheduling; 5-field cron expressions with timezone support; human-readable schedule description; automatic `{{triggerTime}}` and `{{triggerTimestamp}}` variables
- [x] **Webhook & Schedule Backend** — Node.js webhook HTTP server (`src-server/`) with cron scheduler; file-based workflow storage; webhook delivery logs; execution history; auto-registration on workflow save
- [x] **Script Transform Node** — Custom JavaScript data transformation node with Monaco editor, 3 modes (transform/validate/generate), sandboxed execution with timeout protection, complexity analysis warnings, code template gallery (12 templates across 4 categories), reusable script libraries with localStorage persistence
- [x] **Correlation Wait Node** — Async correlation node: pause workflow execution and wait for external webhook callback; correlation ID expression with variable interpolation; configurable source (body JSONPath, header, query); extract variables from webhook payload; timeout support; **RemoteCorrelationStore** (browser↔server bridge) registers paused waits with webhook server and long-polls `GET /api/correlations/:id/wait` endpoint (1–120s clamp, parked-waiter queue); 409 stale-pause auto-recovery; idempotency cache no longer short-circuits active waiters; backend webhook callback handler with unmatched webhook logging
- [x] **Workflow Refactoring & Runtime Bridge** — Refactored expressionFunctions.ts (957→9 modules), App.tsx (910→858 lines, useTheme extracted), WorkflowDesigner.tsx (1432→893 lines, 6 hooks extracted: useWorkflowPersistence, useWorkflowExtractionSample); consolidated 7 duplicate prettyJson implementations; 53 new hook tests + 14 correlation/wait tests; 4613 tests passing; env selector hidden in preview; runProgress badge fixed; docs synced (CORRELATION_WAIT_API.md, training manuals)
- [x] **JSON Data Files** — Parameterize tests from JSON arrays (complement to CSV)
- [x] **CSV/JSON Import Modal Redesign** — Scrollable modal body via `bodyClassName` prop chain (PopupModal → AppModalFrame); stepped UI with uppercase labels and section dividers; single-row destination layout (label + dropdown + checkbox inline); gallery import sync with name-based fallback for older imports; loaded badge count in Gallery grid

### Phase 11 — Engine Performance (Moderate → Good) ✅

> Upgrade the execution engine from browser-limited single-thread to a performant multi-threaded architecture.

- [x] **Think Time & Pacing** — Configurable delay between requests per virtual user (constant, random uniform, random gaussian); prevents unrealistic request flooding and enables realistic user simulation
- [x] **Connection Pooling** — Reuse HTTP connections via `keep-alive` with shared `undici.Agent`; Vite proxy creates pool at startup with cleanup on shutdown; Node CLI creates pool on first request with `closeNodePool()` for explicit cleanup; `Connection: keep-alive` header injected on all outbound requests; Tauri pooled via `reqwest`; 2–3x latency improvement for HTTPS APIs (tuned to 512 connections, pipelining 10 in Phase 11.5)
- [x] **Worker Thread Execution (Web)** — Full engine (HTTP, validation, metrics, think time, circuit breaker) runs in a Web Worker thread, freeing the main thread for 60fps UI rendering; incremental result transfer via `postMessage`; Tauri HTTP proxied through main thread; automatic fallback when Workers unavailable; 10–30% throughput improvement on CPU-bound tests

### Phase 11.5 — Throughput Optimizations & Rust Executor ✅

> Three-tier throughput improvement: JS-side quick wins, native Rust HTTP executor for Tauri desktop, and full Rust-side validation engine. Elevates desktop throughput from ~2,000 RPS to 5,000-10,000+ RPS.

**Tier 1 — JS Quick Wins (15 optimizations)**
- [x] **Connection pool tuning** — `undici.Agent` upgraded to 512 connections, pipelining 10, 10s timeout; 30-40% latency improvement
- [x] **Promise.race timeout leak fix** — Shared `withTimeout()` helper eliminates timer leaks during high-concurrency runs
- [x] **Load profile tick reduction** — 500ms→100ms with decoupled progress reporting; smoother throughput curves
- [x] **O(1) concurrency control** — `graphLoadRunner` fixed from O(N) pool to counter-based concurrency tracking
- [x] **Conditional body parsing** — Skip `JSON.parse` for pass-through responses; reduces CPU overhead on high-volume runs
- [x] **Multi-worker load distribution** — Automatic scenario chunking across `navigator.hardwareConcurrency` workers with per-worker concurrency split and load-profile meta aggregation

**Tier 2 — Rust HTTP Executor (Tauri only)**
- [x] **Rust executor** — `reqwest` + `tokio` async runtime with pool, sequential, and load-profile execution modes; think time, circuit breaker, retry, cancellation support via `CancellationToken`
- [x] **Tauri commands** — `start_load_test` and `abort_load_test` IPC commands with event streaming for incremental result delivery
- [x] **JS bridge** — `rustBridge.ts` with `buildExecutionPlan`, `mapRustResult`, `canUseRustExecutor` (auto-fallback for OAuth2/workflow mode)
- [x] **Spike & ramp-up parity** — Rust executor matches JS behavior for all load profile shapes (sustained, ramp, spike)

**Tier 3 — Rust Validation Engine**
- [x] **Full assertion evaluator in Rust** — Status code, response time SLA, response header, regex, structured assertions (array length, numeric compare, date compare), field operators, deep compare, subset match, date helpers, HTTP helpers
- [x] **Validation types** — Rust-side `ValidationMode`, `ExpectedField`, `Assertion`, `FieldOperator` types matching the TypeScript definitions
- [x] **JS-side validation bridge** — Complex assertions (JSONPath expressions, custom predicates) evaluated in JS; simple assertions offloaded to Rust for maximum throughput
- [x] **Code quality sweep** — 12 test files consolidated to shared `src/test-utils/factories.ts`; 10 inline `JSON.parse` patterns replaced with shared helpers; 47 `err instanceof Error` ternaries replaced with `toErrorMessage()` across 29 files
- [x] **542 Rust tests** — Comprehensive test coverage across all Rust modules (assertion evaluator, field operators, JSON path, deep compare, subset match, date helpers, HTTP helpers, validation types, executor, cross-module integration)

### Phase 11.6 — Streaming Percentiles & Constant Arrival Rate ✅

> Close the final gaps to "Excellent" load testing: constant arrival rate (open model) and streaming percentiles (HDR Histogram). Companion code quality sweep with shared module extraction and E2E flaky test stabilization.

**Constant Arrival Rate (Open Model)**
- [x] **`constant-arrival` execution mode** — New execution mode: send N RPS regardless of response time (open model); `ArrivalRateConfig` type with `targetRps`, `durationSec`, `maxInFlight`, optional `ramp` period
- [x] **Rust arrival executor** — `arrival_executor.rs` (261 lines): `tokio::time::interval` based dispatch, backpressure handling, configurable max in-flight, ramp-up support, `CancellationToken` abort
- [x] **Arrival executor tests** — 579 lines of Rust tests covering dispatch timing, backpressure drops, ramp-up, cancellation, and edge cases
- [x] **`TestSummary` extensions** — `droppedRequests`, `peakRps`, `targetRps`, `p999ResponseTime` fields for arrival rate metrics

**Streaming Percentiles**
- [x] **Rust HDR Histogram** — `histogram.rs` (111 lines): `HdrHistogram` struct for recording response times and querying P50/P95/P99/P99.9 without storing every datapoint
- [x] **Histogram tests** — 304 lines of Rust tests covering accuracy, edge cases, and percentile queries

**Code Quality & Deduplication**
- [x] **Shared `RunnerPage` component** — Consolidated `TestRunner.tsx` and `ParameterizedRunner.tsx` into single `RunnerPage.tsx` + `runnerVariants.ts` (~500 lines saved)
- [x] **Shared `definitionVersioning.ts`** — Extracted 7 common versioning functions from request/test definition modules
- [x] **Shared `OverviewDiffView`** — Extracted identical diff view component from both version diff panels
- [x] **Shared `percentiles.ts`** — Extracted percentile math from `metrics.ts` and `responseTimeHistogram.ts`
- [x] **Shared failure formatting** — `formatFailureDetails()` and `getResultErrorMessage()` in `helpers.ts`
- [x] **Shared `LiveAreaChart`** — Extracted common chart pattern from `LiveCharts.tsx`
- [x] **E2E flaky test stabilization** — Replaced 20+ `waitForTimeout()` with proper Playwright assertions; 660 E2E tests, 0 flaky (was 23)
- [x] **Playwright timeout** — Default increased from 15s to 30s for 40-worker parallelism

### Phase 12 — Assertions & Observability ✅

> Richer assertions and deeper visibility into what happened during a run.

- [x] **Status Code Assertions** — Assert specific codes (`200`), classes (`2xx`), ranges (`200-299`), comma-separated lists; overrides default HTTP error handling so asserting `404` makes a 404 pass
- [x] **Response Time Assertions** — Per-test SLA threshold (`≤ Nms`); fails requests exceeding the configured maximum
- [x] **Response Header Assertions** — Validate any response header with `equals`, `contains`, `regex`, or `exists` operators; case-insensitive header name lookup
- [x] **Regex Assertions** — Match JSONPath-extracted values against regular expressions (`$.name matches /^[A-Z].*/`)
- [x] **Structured JSON body assertions** — User-friendly rules on response JSON (beyond regex): **array length** at a JSONPath (e.g. `$.offers` length ≥ 4), **numeric compare** at a path (`>`, `≥`, `=`, `<`), **date compare** at a path vs **`today`** (define local vs UTC) or a fixed ISO date. Extend `Assertion` in `src/types/index.ts`, implement in `evaluateAssertions()` (`validator.ts`) using existing `getByPath()`; add Validation tab UI with path picker + plain-language operators. Applies to Harness tests and workflow HTTP steps (same `Scenario.validation`).
- [x] **Assertion Presets** — 5 importable assertion presets (API Health Check, Paginated List, Token Expiry, Price Guard, API Contract) via gallery system with popover menu; training manuals (6 HTML files) and CLI examples (5 YAML files)
- [x] **Response Headers in Results** — Capture and display response headers in Response Detail Modal table; captured from both harness and workflow executors
- [x] **Request Log** — Show the exact resolved request headers and body in Response Detail Modal; Authorization header values masked for security
- [x] **Request Timing Breakdown** — DNS, TLS handshake, TTFB, download (waterfall view)

### Phase 13 — UI/UX Visual Foundation ✅

> Redesign the app shell with a modern Activity Bar + contextual workspace layout inspired by VS Code/Postman/Grafana. Improve workflow node visual clarity.

- [x] **Activity Bar Layout** — 4-domain Activity Bar (API, Workflow, Testing, Settings) replacing flat top-nav tabs; contextual sub-navigation per domain (2-3 tabs each)
- [x] **Environment & Service Selectors in Header** — Global access to env/svc dropdowns from any domain
- [x] **Clear Run Status** — Toolbar button to reset all workflow node execution status (checkmarks, response times, edge highlights) back to clean state
- [x] **Workflow Node Label Overflow Fix** — Labels truncate with ellipsis instead of overflowing node boundary; `min-width: 0` and `overflow: hidden` on flex containers; node max-width increased to 320px
- [x] **SVG Configure Icon** — Replaced tiny Unicode ⚙ with a 14×14px SVG pencil/edit icon; hover tooltip preserved
- [x] **Inline Expression Autocomplete** — `ExpressionInput` and `ExpressionTextarea` components provide inline `{{variable}}` and `$function` hints across all expression-capable workflow fields (URL, headers, body, conditions, extractions)
- [x] **Searchable Variable Select** — Custom combobox replacing native `<select>` in Condition node's "Choose variable" mode; type-to-filter, grouped by source node, keyboard navigable, type badges
- [x] **E2E Test Selectors Updated** — All 372 E2E tests updated for new nav structure
- [x] **19,112 Unit Tests, 660 E2E Tests, 542+ Rust Tests** — comprehensive coverage across all features

### Phase 14 — Gallery Redesign & Training Manuals ✅

> Unified gallery system across all 5 domains with type-safe data layer, shared UI components, and comprehensive training manuals.

- [x] **Gallery Type Unification** — `GalleryEntry<T>` base type with domain-specific extensions; 6 domains: requests (13), tests (21), catalog (8), workflows (36), assertions (7), data-mapper (8); total 93 gallery entries
- [x] **Request & Test Gallery Data** — 12 request samples + 8 test scenario samples with factory functions, live API endpoints, difficulty levels, and category tags
- [x] **Catalog Spec Gallery** — 8 OpenAPI specs for public APIs (JSONPlaceholder, FakeStore, PokéAPI, DummyJSON, REST Countries, HTTPBin, PetStore, CorrelationWait)
- [x] **Workflow Gallery Migration** — 36 workflow samples across 6 categories (api-patterns, flow-control, event-driven, orchestration, diverse-apis, performance); includes script nodes, async correlation, and diverse API patterns
- [x] **Shared Gallery UI** — `GalleryPage` with domain tabs, `GalleryDetailPanel` with import/action buttons, `FullPanelModal` for gallery display
- [x] **Diverse API Workflow Samples** — 5 new workflow samples using real public APIs: PokéAPI Evolution Chain, Country Currency Lookup, Product Search & Cart, Book Search & Enrichment, Multi-API Dashboard
- [x] **Training Manuals (192 files)** — Complete training manual coverage across all gallery domains and training paths: requests, tests, catalog, assertions, workflows, workflow patterns, data mapper; each manual has cover page, structured sections, exercises, and RedfireForge branding CSS

### Phase 15 — Version History, Training Paths & Code Quality ✅

> Cross-entity version history, structured training curriculum, and code consolidation.

- [x] **Version History** — Auto-saved definition snapshots for tests, workflows, script libraries, and requests
  - `TestDefinitionVersionPanel` with diff view, restore, rename, and delete
  - `WorkflowVersionPanel` with visual diff of node/edge/variable changes
  - `ScriptLibraryVersionPanel` with code diff
  - `RequestDefinitionVersionPanel` for saved request snapshots
  - Response & Validation version panels with `createResponseVersion` / `createRulesVersion` factory functions
  - Export options popover with version inclusion toggle
  - Import version modal with selective version import
- [x] **Structure Change Log** — `StructureChangeLogPanel` audit trail of feature group/scenario/test CRUD operations
- [x] **Training Paths** — Structured learning curriculum with `TrainingPathsView`: 9 training paths across 3 categories (core, workflow patterns, content), each with multiple phases and progressive difficulty; sidebar hero cards with expand/collapse, search filtering, phase sections, and gallery sample import integration
- [x] **Validation Tab UX** — 5 improvements to reduce confusion between assertions and body validation: renamed "No Validation" → "No Body Validation", added section heading, warning banner for empty Full JSON Match, clickable mode-switch link, smart validation tab dot
- [x] **Per-Workflow Environment Persistence** — `lastSelectedEnvId` saved/restored on workflow switch
- [x] **Histogram Distribution** — Response time histogram tab in Run Comparison Panel
- [x] **p50 Metric** — p50 response time added to `computeMetrics()`
- [x] **Code Consolidation (Round 5)** — Extracted `toggleSetItem()` shared utility (9 inline patterns → 1 function), `createResponseVersion()` / `createRulesVersion()` factory functions (8 inline constructions → 2 factories); `resolveAuthHeaders()` deduplication (6 files); import unification for `acquireOAuth2Token`
- [x] **19,112 Unit Tests, 660 E2E Tests** — 12 new utility tests (setToggle, versionFactory), all passing

### Phase 16 — Parameterized Testing & Shared Data Sources ✅

> Data-driven testing with spreadsheet-style parameterization and cross-test shared data sources.

- [x] **Parameterized Testing (Data-Driven)** — Define one test pattern with an attached data source, run it against N data rows; `DataSource` type with columns (path, param, header, body, validate) + rows; `DataSourceEditor` inline spreadsheet-style table
- [x] **Validation Columns** — `validate:$.jsonPath` columns assert response values per row
- [x] **Row Tags & Filtering** — Categorize rows (smoke, regression); filter by tag when running
- [x] **Row Operations** — Enable/disable, bulk operations (Ctrl/Shift-click), drag-to-reorder, sample rows
- [x] **Distribution Modes** — Sequential, Random, Round Robin for row selection
- [x] **CSV/Excel/JSON Import** — Load data from external files with column detection
- [x] **Pre-Validation (Verify All)** — Test rows against live API before full run
- [x] **Populate from API** — Extract array from response, map fields to columns, auto-generate rows
- [x] **Create Parameterized Copy** — Convert normal test to parameterized with auto-detected variables
- [x] **Re-Run Failed Rows** — After execution, re-run only failed rows; results merge with original
- [x] **Shared Data Sources** — Top-level `SharedDataSource` with `fetchConfig`, tags, cross-test linking via `sharedDataSourceId`; promote/demote between inline and shared; "Used by" section; impact warning modal
- [x] **IndexedDB Persistence** — Large data stored in IndexedDB (`featureGroups`, `testRuns`, `sharedDataSources`); auto-migration from localStorage; 3-second timeout with fallback
- [x] **10 Gallery Samples + 8 Training Manuals** — Parameterized testing samples and guides

### Phase 17 — Training Manual Tracks ✅

> Full-page training dashboard with structured learning paths, progress tracking, and discovery features.

- [x] **TrainingTracksView** — Full-page training dashboard with expandable learning paths and phases
- [x] **TrainingProgressDashboard** — Stats overview (completed, in-progress, paths started, day streak)
- [x] **ContinueLearningCard** — Quick-access card to resume last viewed in-progress manual
- [x] **WhatsNewBanner** — Highlights recently added/updated training manuals with dismiss
- [x] **TrainingSearchBar** — Search and filter by difficulty (Easy/Medium/Advanced) and status
- [x] **Progress Persistence** — localStorage with learning streak calculation
- [x] **Keyboard Navigation** — Focus indicators, smooth expand/collapse animations, responsive design
- [x] **Hooks** — `useTrainingProgress`, `useWhatsNew`, `useManualSearch`
- [x] **164 Unit Tests + 15 E2E Tests** — All interactions covered

### Phase 18 — Codebase Restructuring ✅

> Reorganize flat directory structure into feature-based domain modules with shared utilities.

- [x] **Feature-Based Structure** — `src/features/` with domain modules: `results/`, `scenarios/`, `test-runner/`, `workflow/`, `audit/`; `src/shared/` for cross-cutting types, utils, and components
- [x] **WorkflowDesigner Refactoring** — 1432 → 893 lines with 6 extracted hooks
- [x] **Monolith Reduction** — `graphRunnerNodeHandlers` split into focused handler modules; all files under 900-line threshold
- [x] **Build Verification** — `tsc --noEmit` clean, Vite production build clean

### Phase 19 — Workflow ↔ Harness Integration ✅

> Enable running saved workflows as performance tests in the Harness test runner with full graph topology, configurable iterations/concurrency, and workflow-aware results.

- [x] **WorkflowRunner Component** — Dedicated `WorkflowRunner.tsx` page under Testing domain with workflow-specific execution controls; separated from TestRunner (removed workflow logic from TestRunner)
- [x] **WorkflowPicker** — Searchable dropdown to select saved workflow definitions in the Harness; auto-populates initial variables from workflow's Start node
- [x] **Graph-Based Execution in Harness** — `graphRunner.ts` and `graphLoadRunner.ts` now used for Harness workflow mode (replaces flat chain `workflowRunner.ts`); full graph topology with conditions, forks/joins, loops, switches, sub-workflows
- [x] **Iteration-Level Reporting** — `iterationIndex` and `workflowNodeId` on `RequestResult`; results grouped by iteration with per-iteration timing chart
- [x] **Workflow-Aware Results Display** — Results Dashboard shows workflow run type badge, iteration performance chart, per-step aggregate metrics; run type filter tabs (Harness/Workflow/All)
- [x] **"Run in Harness" Button** — One-click bridge from Workflow Designer to WorkflowRunner with pre-selected workflow
- [x] **Post-Run Navigation** — After workflow run completes, navigate to Results Dashboard with filter presets
- [x] **Workflow Runner Tab** — Dedicated navigation tab under Testing domain
- [x] **CLI Workflow Command** — `redfireforge run-workflow` CLI command for headless workflow performance tests

### Phase 20 — Visual Execution Replay & Results Explorer ✅

> Visual workflow execution replay with interactive diagram, node detail panels, and iteration matrix.

- [x] **Trace Data Model** — `WorkflowExecutionTrace`, `WorkflowIterationTrace`, `ExecutionEvent`, `ExecutionEventDetails` types; `TestRun.executionTrace` field; `fullTraceCaptured` flag
- [x] **TraceCollector** — `traceCollector.ts` class with `onNodeStart`, `onNodeComplete`, `onEdgeTraversed`; integrated into `graphRunner.ts` and `graphLoadRunner.ts`
- [x] **WorkflowResultsExplorerModal** — Full-screen modal with split layout: read-only workflow canvas (left) + detail panel (right); opened via "📊 Results Explorer" button in Results Dashboard
- [x] **WorkflowExecutionCanvas** — Read-only React Flow canvas with pass/fail/skipped node coloring, traversed edge highlighting, timing overlays, fit-to-view, minimap
- [x] **NodeExecutionDetailPanel** — Click a node to see HTTP request/response, timing breakdown, variable state, condition evaluation, loop iteration data; iteration selector dropdown
- [x] **IterationMatrixTable** — Collapsible bottom table showing all iterations × nodes with status/timing; click cell to jump to node+iteration on canvas; non-HTTP overhead displayed inline
- [x] **Aggregate Overlay** — When no node selected, shows summary statistics across all iterations
- [x] **Polish & Optimization** — Trace compression (lz-string), trace sampling (configurable threshold), lazy trace loading, node tooltips, export/import trace as JSON, error surfacing in trace, real-time avg iteration metric, progress display fix, floating point precision fix, iteration overhead breakdown, edge traversal percentages on branching edges, edge traversal gallery sample & training manual, additional keyboard shortcuts (Space toggle, 1-9 jump), animated edge flow, export aggregate metrics as CSV, heatmap coloring (nodes colored by avg duration)
- [x] **Post-Phase Enhancements** — Bottleneck analysis (time-dominant, high-variance, high-failure nodes with suggestions), iteration picker redesign (filter tabs, jump-to-#, p95 badges), save layout (persist node positions to localStorage), node search & filter (search bar + state filter buttons with dimming, `/` hotkey)

### Phase 21 — Runner Redesign (Three-Runner Architecture) ✅

> Architectural fix for test type confusion. Prevents mixing standard and parameterized tests, eliminates silent allocation bugs, and introduces clear terminology.

- [x] **Scenario Types** — `ScenarioKind` (`'standard'` | `'parameterized'`) enforced at creation; UI radio buttons; `PARAM` badge
- [x] **Auto-Migration** — `migrateScenarioKinds()` detects and splits mixed scenarios on load; one-time notification banner
- [x] **Iterations Terminology** — `totalTransactions` → `iterations` across entire codebase (33+ files); CLI flags updated
- [x] **Allocation Engine** — `computeAllocation()` single source of truth for execution planning; no silent truncation
- [x] **Test Runner Refactored** — Standard-only scenario selector; simple iterations × tests execution plan preview
- [x] **Parameterized Runner** — New `ParameterizedRunner.tsx` page with per-test rows × iterations breakdown
- [x] **Shared Runner Hook** — `useRunnerOrchestration` extracts ~300 lines of shared logic between runners
- [x] **Execution Plan Preview** — Shared component with kind-aware rendering (compact for standard, detailed for parameterized)
- [x] **Scenario Selector Filter** — `kind` prop filters scenarios; Test Runner shows standard only, Param Runner shows parameterized only
- [x] **Feature Group Summary** — Header shows `3 scenarios (2S · 1P)` breakdown with tooltip
- [x] **Move/Copy Kind Enforcement** — Move and Copy modals filter target scenarios by matching kind
- [x] **Workflow Progress Display** — Shows both iterations and requests: `10/10 iterations (100%) — 40/40 requests (100%)`
- [x] **Trace Config Persistence** — Full Trace and Trace Sampling settings persist across navigations
- [x] **Tab Rename** — "Scenarios" tab renamed to "Feature Groups"
- [x] **3 New Training Manuals** — Test Runner Guide, Parameterized Runner Guide, Scenario Types Guide
- [x] **14+ Existing Manuals Updated** — Runner references, TPS terminology, navigation paths
- [x] **19,112 Unit Tests, 660 E2E Tests** — All passing, >90% code coverage across all files

### Phase 22 — Results Explorer Debug Console & Trace Levels ✅

> Debug Console in Results Explorer, tiered trace capture levels, and Designer canvas consistency improvements.

- [x] **Trace Capture Levels** — `TraceCaptureLevel` type (`minimal | standard | full | debug`); capture gating in `graphRunner.ts`; `captureLevel` on `WorkflowExecutionTrace`; `initialVariables` per iteration
- [x] **Trace Level UI** — Radio buttons in Workflow Runner; `--trace-level` CLI flag; Designer Quick Test always at Debug; per-session persistence
- [x] **Iteration Index Consistency** — `getIterationByIndex()` utility; all iteration-related components use `.index` field, not array position
- [x] **Console Log Line Component** — Shared `ConsoleLogLine` component and `consoleLogUtils` utilities extracted from Designer Console for reuse
- [x] **Log Reconstruction** — `reconstructLogLines()` utility builds `LogLine[]` from structured `ExecutionEventDetails` (HTTP summaries, assertions, errors, variables, sub-workflow expansion)
- [x] **ResultsExplorerConsolePanel** — Docked/floating/maximized console panel with node filter, search, click-to-select, auto-scroll-to-error, mode persistence
- [x] **Aggregate Summary** — `buildAggregateSummary()` generates professional run overview for multi-iteration aggregate view
- [x] **Debug-Level Capture** — Per-node `logLines` buffering in `graphRunner.ts`; `scriptOutput` wiring for script nodes; 200-line cap; console renders raw logs at Debug level
- [x] **Sub-Workflow Support** — Recursive expansion with depth indentation; workflow context in empty detail panel; double-click drill-down
- [x] **Designer Canvas Consistency** — Simplified toolbar (no Auto-Layout/Undo/Redo); "Save current layout" persists viewport; saved view restored on revisit; consistent with Results Explorer
- [x] **E2E Tests** — 18 Playwright tests covering console toggle, keyboard shortcut, trace levels, node filter, search, aggregate summary, sub-workflow drill-down, designer controls, and runner trace level UI

---

### Phase 23 — Correlation Wait Runner Config & Webhook Load Driver ✅

> Advanced webhook testing capabilities in the Workflow Runner.

- [x] **Correlation Wait Config Panel** — UI for configuring correlation wait parameters in the runner; poll throttle controls
- [x] **Payload Template Engine** — Template-based payload generation for webhook simulation
- [x] **Webhook Load Driver** — `webhookLoadDriver.ts` for driving webhook callbacks during workflow load tests
- [x] **Multi-Webhook Testing Panel** — `MultiWebhookTestingPanel.tsx` (737 lines): UI for configuring and triggering multiple webhook callbacks with payload templates, timing controls, and execution status
- [x] **WebhookLoadDriverPanel** — `WebhookLoadDriverPanel.tsx` (332 lines): Runner UI for webhook load testing configuration with `runWebhookLoadTest` and `calculateTotalRequests` integration

### Phase 23.5 — Catalog ↔ Harness Integration ✅

> Bridge API Catalog and Requests with the Harness test runner. Promote catalog endpoints to load tests with environment-aware URL resolution and batch operations.

- [x] **Send to Harness (Single Request)** — Promote individual requests to Harness feature groups via `SendToHarnessModal` with environment/microservice selection, two-step wizard with `CascadeSelect` dropdowns
- [x] **Batch Send to Harness** — Promote entire collections or sub-collections via `BatchSendToHarnessModal` with professional two-step wizard, custom checkboxes, option cards, endpoint selection, and environment-aware URL resolution
- [x] **Send to Harness Context Menu** — "Send to Harness" option in right-click menus for collections, sub-collections, and folders via `SidebarContextMenu`
- [x] **Live "IN HARNESS" Badge** — Dynamic badge on requests that have been promoted, computed from live feature group data (replaced stale `promotedToHarness` flag with `harnessRequestIds` set)
- [x] **Absolute URL Resolution** — Multi-fallback URL resolution in `requestToScenario.ts` for batch promotion: collection base URL → sub-collection base URL → microservice base URL → environment base URL
- [x] **Spec Version Switching** — `SpecVersionSwitcher.tsx` for browsing and switching between imported OpenAPI spec versions per request
- [x] **Spec Version Compare** — `SpecVersionCompareModal.tsx` for side-by-side diff between spec versions
- [x] **Path Parameter Editor** — `PathParamsEditor.tsx` with `pathParamResolver.ts` for editing and resolving path parameters from catalog endpoint specs
- [x] **Coverage Checker** — `coverageChecker.ts` utility for analyzing API endpoint test coverage across feature groups
- [x] **Version Diff/Merge/Status** — `versionDiff.ts`, `versionMerge.ts`, `versionStatus.ts` utilities for OpenAPI spec version management
- [x] **Extracted Hooks** — `useCatalogState`, `useCatalogExport`, `useHarnessPromotion`, `useRequestsSidebarDnD`, `usePreferencesImport`, `useGalleryWorkflowPreviewState`, `useScenarioBuilderSearch` hooks
- [x] **Shared Components** — `CascadeSelect` (reusable cascade dropdown), `useEscapeKey` (shared hook), `SWAGGER_METHOD_COLORS` (shared constant)
- [x] **Code Quality Audit** — All files under 900 lines; >90% coverage across all 4 metrics; 0 ESLint errors; 0 TypeScript errors; 19,112 unit tests, 660 E2E tests, 542+ Rust tests passing

### Phase 23.7 — Trash Box (Soft Delete & Recovery) ✅ (on `develop`)

> Safe deletion with undo and recovery for all Harness entities. Items are moved to a Trash Box instead of being permanently deleted, with configurable retention and automatic purge.

- [x] **Soft Delete** — Feature Groups, Scenarios, Tests, and Shared Data Sources are moved to Trash Box instead of permanent deletion
- [x] **Undo Toast** — 5-second notification with Undo button for instant recovery after any delete
- [x] **Trash Panel** — Modal UI to browse, search, restore, and permanently delete trashed items; accessible from the Harness toolbar with a badge showing item count
- [x] **Automatic Purge** — Expired items are cleaned up on app startup based on configurable retention period
- [x] **Configurable Settings** — Retention period (7–90 days, default 30) and max items (50–200, default 100) in Trash Panel footer
- [x] **Smart Restoration** — Restores to original parent when available; creates "Restored Items" groups for orphans; handles ID collisions with new UUIDs; clears stale env/svc references
- [x] **Structure Change Logging** — Restored items recorded in Feature Group change history with `restored` action
- [x] **Dual-Mode Persistence** — IndexedDB primary storage with localStorage fallback and Tauri FS support
- [x] **useTrash Hook** — `moveToTrash`, `restore`, `undoLastDelete`, `purge`, `purgeAll`, and settings management
- [x] **Gallery Sample** — "Trash Recovery Demo" in the Tests gallery with linked training manual
- [x] **Documentation** — User guide (`docs/guides/trash-box-guide.md`), HTML training manual, training path entry
- [x] **E2E Tests** — `trash-box.spec.ts` covering delete, undo, restore flows (6 tests)
- [x] **ScenarioBuilderModals extraction** — Reduced `ScenarioBuilder.tsx` below 900 lines by extracting modal components

---

### Phase 23.8 — Kafka Integration ✅ (on `feature/kafka-integration`)

> Full Kafka support across server transport, UI settings, workflow nodes (produce/consume/trigger/wait), runner scenarios, load policy, results publishing, and native Tauri transport (rdkafka). Phases 1–9 complete; Phase 10 (Schema Registry) is optional and activation-gated.

- [x] **Core Transport (Phase 1)** — `kafkajs` server transport, produce/consumeOnce/subscribe routes, plaintext Docker bootstrap, topic seed scripts
- [x] **Client Transport + App State (Phase 2)** — `kafkaClient.ts` dispatcher, `useKafkaState` hook, bounded status refresh, UI-safe error classification
- [x] **Kafka Settings UX (Phase 3)** — Cluster list/create/edit/delete; SASL/SCRAM/TLS auth fields; topic browser; AppHeader connection indicator; 6 connection presets; secure Redpanda Docker profile (21/21 smoke PASS)
- [x] **Workflow Kafka Nodes (Phase 4)** — `kafkaProduce` + `kafkaConsume` node types; config panel editors; executor branches with dependency-injected `KafkaNodeOperations`; output binding extraction; classified execution logs
- [x] **Kafka Trigger + KafkaWait (Phase 5)** — Subscription-based workflow start; backpressure pause/resume; `kafkaWait` correlation-store pause/resume; idempotency (`kafka:topic:partition:offset` key); `ServerCorrelationBridge`; activation/deactivation routes; 187 tests
- [x] **Runner Kafka Scenarios (Phase 6)** — `actionType` + `transportType` on Scenario/RequestResult; `kafkaExecution.ts`; `kafkaField` assertions; transport-aware result rendering in all result surfaces; `.method-kafka` CSS badge; parameterized row interpolation
- [x] **Load-mode Policy (Phase 7)** — `kafkaLoadPolicy.ts` compatibility matrix; `runGraphLoad` pre-run guard; `WorkflowRunner` load banners; 208 tests with repeated-run variance checks
- [x] **Results Publishing to Kafka (Phase 8)** — `KafkaRunSummaryEnvelope` (schema v1.0); `kafkaResultsPublisher.ts` (3 retries, fire-and-forget); publish at all save sites; 41/41 broker scenarios PASS (plaintext + secure)
- [x] **Tauri-native Transport (Phase 9)** — Rust `src-tauri/src/kafka/` module; 10 Tauri commands with rdkafka; `kafkaNativeTauriTransport.ts`; `CommandSpec.paramKey` Tauri v2 wrapping; transport selected via `isTauri()`; 82/82 golden-fixture parity tests; 656 Rust unit tests; 8/8 E2E tests
- [x] **Coverage sweep** — 98.6% → 99.51% total (23,000+ unit tests, 719 E2E, 0 failures)
- [x] **Kafka Service Modularization** — KafkaService refactored from 660+ → 464 lines; `kafka-produce.ts`, `kafka-subscribe.ts`, `kafka-service-utils.ts` extracted; gallery `nodeFactories.ts` extracted (~1,500 lines deduped); `cron-scheduler.test.ts` added (15 tests, 100% coverage); all files above 90% coverage

---

## Upcoming Phases

### Phase 25 — Run Comparison & Trends

Analytics to detect regressions and compare performance over time.

- [ ] **Run Comparison** — Compare two runs side-by-side (TPS, P95, P99 delta with green/red indicators)
- [ ] **Overlaid Histograms** — Response time distribution overlay between two runs
- [ ] **Baseline Runs** — Mark a run as "baseline" and compare future runs against it
- [ ] **Regression Detection** — Automatic alert when P95 increases by X% vs baseline
- [ ] **Trend Analysis** — P95 trend across last N runs for the same test suite

### Phase 24 — CI/CD Pipeline

> Automate quality gates and release workflows. Foundation already in place: `.github/workflows/ci.yml` (tsc + ESLint + unit tests on push/PR), `.github/workflows/release.yml` (multi-platform desktop builds on tag push), `.husky/pre-commit` (tsc + lint-staged on every commit).

- [x] **CI Test Pipeline (partial)** — GitHub Actions `ci.yml`: runs TypeScript check, ESLint, and unit tests on push to `develop`/`release`/`feature`/`hotfix` branches and on PRs
- [x] **Lint & Type-Check Gate (partial)** — Pre-commit hook runs `tsc --noEmit` + `lint-staged`; CI runs both as parallel jobs
- [ ] **CI E2E Pipeline** — GitHub Actions workflow: run Playwright E2E on every PR (requires headless browser setup)
- [ ] **PR Status Checks** — Configure GitHub branch protection: require all CI jobs to pass before merge
- [ ] **GitHub Actions Example for Users** — Ready-to-use workflow YAML for running RedfireForge CLI tests in CI
- [ ] **Harness.io Pipeline Example** — Sample Harness pipeline YAML: run stage with `npx redfireforge run --reporter junit`, consume JUnit XML for Test Intelligence, publish JSON report as artifact, gate deployments on test pass/fail
- [ ] **Automated Version Tagging** — GitHub Action to create version tags on `master` merge
- [ ] **Live Demo Deployment** — Auto-deploy web build to Vercel/Netlify on `master` push

### Phase 26 — Open-Source Launch

The public release — polished, documented, community-ready.

#### Open-Source Packaging
- [ ] **LICENSE File** — MIT or Apache-2.0
- [ ] **CONTRIBUTING.md** — Setup instructions, coding standards, PR process
- [ ] **Issue Templates** — Bug report, feature request templates
- [ ] **Code of Conduct** — Standard Contributor Covenant

#### Documentation & Branding
- [ ] **Rebrand Tagline** — "API Performance Studio" → "Visual API Testing Workbench" (honest positioning)
- [ ] **Logo & Branding** — Professional logo and icon
- [ ] **Documentation Site** — GitHub Pages or Docusaurus with guides, screenshots, API reference
- [ ] **Video Walkthrough** — GIF demos in README, YouTube tutorial
- [ ] **Comparison Table** — RedfireForge vs k6, JMeter, Bruno, Postman, Hoppscotch (honest, with strengths and limitations)
- [ ] **Live Demo** — Deploy web version to Vercel/Netlify for instant try-out (key for adoption)

#### Launch Checklist
- [ ] **README rewrite** — Concise, visual, GIF-heavy; "try in 10 seconds" link to live demo
- [ ] **Hacker News post** — "Show HN: RedfireForge — a visual API testing workbench with Rust executor (open-source JMeter alternative)"
- [ ] **Reddit posts** — r/webdev, r/node, r/programming, r/QualityAssurance
- [ ] **Dev.to / Hashnode article** — "Why I built a visual load testing tool"

### Phase 27 — Future (Good → Excellent)

Post-launch features driven by community feedback. The Rust executor is done (Phase 11.5), and constant arrival rate + streaming percentiles are done (Phase 11.6). The remaining engine item is distributed execution.

#### Engine — Excellent (Enterprise) Tier (remaining)
- [x] **Native Rust Executor** — ✅ Completed in Phase 11.5: `reqwest` + `tokio` with pool/sequential/load-profile modes, full validation engine, 542+ Rust tests
- [x] **Streaming Percentiles** — ✅ Completed in Phase 11.6: Rust HDR Histogram for P50/P95/P99/P99.9 without storing every datapoint
- [x] **Constant Arrival Rate** — ✅ Completed in Phase 11.6: Open-model load generation via Rust arrival executor with ramp, backpressure, and cancellation
- [ ] **Distributed Execution** — Coordinate load generation across multiple machines/processes via a controller/worker architecture; break past single-machine limits for enterprise-scale testing
- [ ] **Graceful Drain** — Wait for in-flight requests to complete on abort (with configurable timeout)

#### Server Deployment & Production
- [ ] **Server-Side Trace Management** — Admin-level trace level ceilings, auto-downgrade rules for high-load runs, retention policies
- [ ] **Sampling (Post-Run Re-execution)** — Select specific iterations and re-run at higher trace level without re-running entire workflow; requires server-side execution
- [ ] **Scheduled Runs** — Server-side cron-based workflow scheduling with history and notifications

#### Protocol & Format Support
- [ ] **GraphQL Support** — Query/mutation builder with introspection
- [ ] **gRPC Support** — Protobuf definition import, unary and streaming calls
- [ ] **WebSocket Support** — Connect, send messages, assert on received messages
- [x] **JSON Schema Validation** — ✅ `jsonSchema` assertion type with Ajv + ajv-formats, allErrors mode, inline validation errors (completed in Phase P6 — see `docs/plan/validation-operator-gap-analysis.md`)

#### Extensibility & Organization
- [ ] **Test Tagging** — Label tests with `smoke`, `regression`, `critical` and run by tag
- [x] **Data Mapper** — ✅ Visual field mapping component with 10 adapters + body builder; drag-and-drop, expression editor (Monaco + 125 functions + lambda), auto-map with accept/reject, type mismatch detection & auto-fix, floating pop-out DSL editor, bi-directional visual ↔ code sync, schema drift/repair, mapping profiles, keyboard navigation, hover-to-highlight, failure navigation; 19,112 unit tests, 660 E2E tests, >90% coverage across all files — see `docs/plan/validation-operator-gap-analysis.md`
- [ ] **Plugin API** — Extension point for custom auth providers, assertion functions, reporters

---

## Progress Summary

| Phase | Target | Items | Done |
|---|---|---|---|
| 1 | Load Profiles & Live Monitoring | 8 | 8 |
| 2 | Data-Driven Testing & Resilience | 8 | 8 |
| 3 | Excel Templates & Error Visibility | 8 | 8 |
| 4 | CLI Runner | 6 | 5 |
| 5 | Test Suite & Code Quality | 10 | 10 |
| 6 | Requests (Ad-Hoc API Testing) | 13 | 13 |
| 7 | API Catalog (OpenAPI/Swagger) | 24 | 24 |
| 8 | Unified Environments & Catalog Export | 11 | 11 |
| 9 | Group Collections & Catalog Metadata | 9 | 9 |
| 10 | Variables & Chaining (Workflow Designer) | 20 | 20 |
| 11 | Engine Performance (Moderate → Good) | 3 | 3 |
| 11.5 | Throughput Optimizations & Rust Executor | 15 | 15 |
| 11.6 | Streaming Percentiles & Constant Arrival Rate | 14 | 14 |
| 12 | Assertions & Observability | 9 | 9 |
| 13 | UI/UX Visual Foundation | 9 | 9 |
| 14 | Gallery Redesign & Training Manuals | 7 | 7 |
| 15 | Version History, Training Paths & Code Quality | 9 | 9 |
| 16 | Parameterized Testing & Shared Data Sources | 13 | 13 |
| 17 | Training Manual Tracks | 9 | 9 |
| 18 | Codebase Restructuring | 4 | 4 |
| 19 | Workflow ↔ Harness Integration | 9 | 9 |
| 20 | Visual Execution Replay & Results Explorer | 9 | 9 |
| 21 | Runner Redesign (Three-Runner Architecture) | 17 | 17 |
| 22 | Results Explorer Debug Console & Trace Levels | 11 | 11 |
| 23 | Correlation Wait Runner & Webhook Load | 5 | 5 |
| 23.5 | Catalog ↔ Harness Integration | 13 | 13 |
| 23.7 | Trash Box (Soft Delete & Recovery) | 13 | 13 |
| 23.8 | Kafka Integration (Phases 1–9) | 9 | 9 |
| 24 | CI/CD Pipeline | 8 | 2 |
| 25 | Run Comparison & Trends | 5 | 0 |
| 26 | Open-Source Launch | 14 | 0 |
| 27 | Future (Engine → Excellent + Server) | 15 | 5 |
| **Total** | | **337** | **301** |

### Feature Maturity Assessment

```
PRODUCTION-READY (fully implemented, tested, documented):
  ✅ Workflow Designer          — 19 node types, visual DAG, auto-layout (Phase 10)
  ✅ Results Explorer           — execution replay, debug console, trace levels (Phases 20, 22)
  ✅ API Catalog                — OpenAPI import, versioning, interactive testing (Phases 7–9)
  ✅ Catalog ↔ Harness          — batch promotion, URL resolution, coverage checker, spec versioning (Phase 23.5)
  ✅ Requests                   — collections, auth inheritance, cURL, console (Phase 6)
  ✅ Test Runners (x3)          — Standard, Parameterized, Workflow (Phases 19, 21)
  ✅ Webhook Load Testing       — multi-webhook testing panel, webhook load driver, correlation wait (Phase 23)
  ✅ Data-Driven Testing        — CSV/Excel/JSON/API, shared data sources (Phases 2, 3, 16)
  ✅ Assertions Engine          — 16 assertion types, 24 field operators, 125 expression functions (Phases 12, P0–P9.3)
  ✅ Data Mapper                — 10 adapters, visual + DSL authoring, floating editor, schema drift (Phase 7F+)
  ✅ CLI Runner                 — YAML/JSON, JUnit XML, CI exit codes (Phase 4)
  ✅ Training System            — 192 manuals, 9 training paths, progress tracking (Phases 14, 15, 17)
  ✅ Rust HTTP Executor         — reqwest + tokio, full validation engine, 542+ Rust tests (Phase 11.5)
  ✅ Multi-Worker Execution     — automatic chunking, per-worker concurrency, load-profile aggregation (Phase 11.5)
  ✅ Constant Arrival Rate      — open-model RPS with Rust arrival executor (Phase 11.6)
  ✅ Streaming Percentiles      — Rust HDR Histogram for P50/P95/P99/P99.9 at scale (Phase 11.6)
  ✅ Trash Box                  — soft delete, undo toast, smart restoration, configurable purge (Phase 23.7)
  ✅ Kafka Integration          — settings UX, workflow nodes (produce/consume/trigger/wait), runner, load policy, results publishing, native rdkafka Tauri transport (Phase 23.8)

PARTIALLY COMPLETE (functional, needs polish):
  🟡 CI/CD Pipeline            — Pre-commit hooks + Actions CI exist, full pipeline pending (Phase 24)

NOT STARTED (post-launch):
  ⬜ Run Comparison & Trends    (Phase 25)
  ⬜ Open-Source Launch          (Phase 26)
  ⬜ Distributed execution       (Phase 27)
```

### Load Testing Level Milestones

```
CURRENT: Good (web ~500-2,000 RPS) / Excellent (Tauri 5,000-10,000+ RPS)
  ├── Phase 1    ✅  Duration profiles, ramp-up, spike
  ├── Phase 2    ✅  CSV data, retry, circuit breaker, timeout
  ├── Phase 3    ✅  Excel templates, live charts
  ├── Phase 10   ✅  Variables, chaining, workflow mode
  ├── Phase 11   ✅  Worker threads, connection pooling, think time
  ├── Phase 11.5 ✅  Tier 1 JS optimizations + Tier 2/3 Rust executor (542+ Rust tests)
  ├── Phase 11.6 ✅  Constant arrival rate + streaming percentiles (HDR Histogram)
  ├── Phase 12   ✅  Rich assertions, presets, timing breakdown
  ├── Phase 16   ✅  Parameterized data-driven testing, shared data sources
  ├── Phase 19   ✅  Workflow ↔ Harness integration
  ├── Phase 20   ✅  Visual execution replay & results explorer
  ├── Phase 22   ✅  Debug console, trace levels, Designer consistency
  ├── Phase 23   ✅  Webhook load driver, multi-webhook testing panel
  └── Phase 23.5 ✅  Catalog ↔ Harness integration, batch promotion

FUTURE: Excellent (Enterprise) (10,000-50,000+ RPS)
  └── Phase 27     Distributed execution
```

### Adoption Forecast

| Scenario | Predicted Stars (Year 1) | Requirements |
|---|---|---|
| Launch now (CI partially done, no demo) | 1,000–2,500 | CLI done, 19K+ unit tests + 656+ Rust tests, Actions CI exists, Rust executor + constant arrival + streaming percentiles, all features complete through Phase 23.8 |
| Launch with full CI pipeline + live demo | 2,500–5,000 | Phase 24 complete |
| Launch with Rust executor + demo + branding | 5,000–10,000 | Phases 10–23.8 ✅ + Phase 26 (Rust executor + open model is a strong differentiator) |
| Viral launch (HN front page, YouTube) | 10,000–25,000+ | All of above + great branding + community momentum + "visual JMeter killer" narrative |

### Critical Path to Open-Source

```
REMAINING BLOCKERS:

  Phase 24 (CI/CD Pipeline)     — E2E in CI, PR status checks, live demo deployment
       ↓
  Phase 26 (Open-Source Launch)  — LICENSE, CONTRIBUTING.md, docs site, README rewrite, branding
       ↓
  Launch on Hacker News / Reddit / Dev.to

ALREADY COMPLETE (Phases 1–23.8):
  ✅ Phase 4    (CLI)           — `redfireforge run` + `run-workflow`, JUnit/JSON/Markdown reports
  ✅ Phase 5    (Tests)         — 23,000+ unit tests, 719 E2E tests, 656+ Rust tests, 99.51% code coverage
  ✅ Phase 6    (Requests)      — Full ad-hoc API testing with collections/auth/cURL
  ✅ Phase 7    (API Catalog)   — OpenAPI/Swagger browser with versioning
  ✅ Phase 10   (Workflow)      — Visual workflow designer (19 node types) + graph execution engine
  ✅ Phase 11   (Engine)        — Full "Good" load testing capabilities (JS)
  ✅ Phase 11.5 (Throughput)    — Tier 1 JS optimizations + Rust executor (5,000-10,000+ RPS in Tauri)
  ✅ Phase 11.6 (Arrival+Perc)  — Constant arrival rate (open model) + streaming percentiles (HDR Histogram)
  ✅ Phase 20   (Replay)        — Results Explorer with interactive execution replay
  ✅ Phase 22   (Console)       — Debug console with tiered trace levels
  ✅ Phase 23   (Webhook)       — Multi-webhook testing panel + webhook load driver
  ✅ Phase 23.5 (Catalog→Test)  — Catalog ↔ Harness batch promotion, spec versioning, coverage checker
  ✅ Phase 23.7 (Trash Box)     — Soft delete & recovery with undo toast, smart restoration
  ✅ CI Foundation               — GitHub Actions (tsc + ESLint + unit tests), pre-commit hooks
```

### Critical Path to "Excellent" Load Testing (Post-Launch)

```
                              Phase 11.5 ✅ Rust Executor DONE (5,000-10,000+ RPS)
                                    ↓
                              Phase 11.6 ✅ Constant Arrival + Streaming Percentiles DONE
                                    ↓
Phase 25 (Run Comparison)  →  Phase 27 (Distributed Execution)
  ↑ regression detection           ↑ remaining gap to Enterprise scale (10K-50K+ RPS)
```

---

_Last updated: 2026-06-07 (v0.6.0 on `develop`; 301/337 items done (89.3%); load testing at Good (web) / Excellent (Tauri with Rust executor + constant arrival + streaming percentiles); 99.51% code coverage; 23,000+ unit tests, 719 E2E tests, 656+ Rust tests; Kafka integration phases 1–10 merged; KafkaService modularized (660+ → 464 lines); gallery node factories extracted)_
