# RedfireForge — Roadmap

> Prioritized feature roadmap for open-source release.
> Check items off as they are completed.

---

## Positioning & Strategy

> Recommendations from competitive analysis against k6, Gatling, Locust, Artillery, JMeter, Bruno, Hoppscotch, Postman.

### Identity

RedfireForge is a **visual API testing workbench** — not a raw load generator. Its strength is the intersection of **GUI-driven test building**, **response validation**, and **moderate load testing** in one tool. No competitor occupies this exact niche:

| Tool | GUI | Load Testing | Response Validation | API Catalog | Desktop Native |
|---|---|---|---|---|---|
| **k6** | No (code-only) | Excellent | Basic `check()` | No | No |
| **Gatling** | No (Scala DSL) | Excellent | Basic | No | No |
| **Locust** | Minimal web UI | Good | Manual (Python) | No | No |
| **JMeter** | Yes (dated Java Swing) | Good | Verbose XML assertions | No | No |
| **Artillery** | No (YAML + JS) | Good | Basic | No | No |
| **Bruno** | Yes (modern) | No | Manual | No | Yes (Electron) |
| **Hoppscotch** | Yes (modern, web) | No | Manual | No | No |
| **Postman** | Yes (proprietary) | Limited (paid) | Good | Partial (paid) | Yes (Electron) |
| **RedfireForge** | Yes (modern) | Moderate | Excellent (visual) | **Yes (OpenAPI)** | Yes (Tauri) |

### Key Differentiators (Lean Into These)

1. **Visual load testing with a modern UI** — the JMeter replacement the world needs
2. **Sophisticated validation engine** — JSONPath builder, unordered arrays, selective/full modes, visual diff
3. **API Catalog with OpenAPI import** — browse, search, and send endpoints to load tests; multi-environment aware; no other load testing tool has an integrated catalog-to-test workflow
4. **Excel template workflow** — enterprise QA teams work in spreadsheets, no competitor supports this
5. **Auth inheritance chain** — Global → Feature → Scenario → Test with visual badges
6. **Tauri-based desktop** — lighter than Electron (Bruno, Postman), native performance
7. **Web mode with zero install** — instant try-it-out on Vercel/Netlify

### Positioning Recommendation

- **Current tagline**: "API Performance Studio" — overpromises on raw load-generation capability
- **Recommended tagline**: "Visual API Testing Workbench" or "API Testing Studio"
- **Elevator pitch**: "Build API tests visually, validate responses with precision, run them under load — all from a modern desktop app or your browser. The JMeter replacement for teams who hate XML."

### Risks to Address

- ~~**No tests** — zero unit/integration/E2E tests; critical blocker for contributor trust~~ → **RESOLVED**: 948 unit/integration tests (Vitest, 98% line coverage, 90% branch coverage) + 17 E2E tests (Playwright) = 965 total
- ~~**No CLI / CI** — without pipeline integration, adoption is limited to manual QA~~ → **RESOLVED**: CLI runner with YAML/JSON test files, JUnit XML, JSON, Markdown reports, CI exit codes
- **No request chaining** — can't test multi-step workflows (create → read → update → delete)
- **Browser-based executor** — caps at a few hundred concurrent connections; honest about this limitation
- ~~**Monolithic components** — largest files are 1000-1400 lines; intimidating for contributors~~ → **RESOLVED**: 8 monoliths refactored into 25 focused modules; largest file now ~1100 lines
- **Solo developer vs funded teams** — k6 has Grafana, Bruno has 30K+ stars with a team

### Load Testing Maturity Levels

RedfireForge's load testing is currently rated **Moderate**. The path to **Good** and **Excellent** is mapped below.

#### What each level means

| Level | Description | Throughput | Examples |
|---|---|---|---|
| **Moderate** (current — 5/6 gaps to Good closed) | Worker threads, connection pooling, think time, rich assertions, timing breakdown; missing Variables & Chaining | ~100-300 RPS → approaching 500+ | RedfireForge today |
| **Good** | Variables & chaining, rich assertions, worker-thread execution, connection pooling, think time | ~500-2,000 RPS | Artillery, JMeter |
| **Excellent** | Native async executor (Rust), distributed multi-machine, constant arrival rate, streaming percentiles | 5,000-50,000+ RPS | k6, Gatling |

#### Current capabilities (Moderate → Good: 5/6 gaps closed, Variables & Chaining remaining)

- Duration-based profiles: sustained, ramp-up, spike
- Fixed transaction count: sequential, batch, pool concurrency
- Circuit breaker (error count/rate threshold), retry with delay, per-request timeout
- CSV/Excel parameterized data-driven testing
- Live streaming charts (TPS, response time, error rate, active connections)
- OAuth2 token manager with JWT expiry detection
- Weighted scenario distribution in load profiles
- **Think time & pacing**: constant, uniform random, gaussian (normal distribution) delays between requests for realistic virtual user simulation
- **Worker thread execution**: Engine runs in a Web Worker — UI stays responsive at 60fps during heavy runs; validation/metrics/orchestration offloaded to separate thread; Tauri HTTP proxied through main thread; automatic fallback; incremental result transfer avoids serialization overhead
- **Connection pooling**: Shared `undici.Agent` keeps HTTP connections alive (30s timeout, 128 connections) — eliminates TCP/TLS handshake overhead on repeated requests to the same origin; 2–3x latency reduction for HTTPS APIs in browser dev mode; Tauri mode already pooled via `reqwest`
- **Rich assertions**: Status code (`200`, `2xx`, `200-299`), response time SLA (`≤ 500ms`), response header (`equals`/`contains`/`regex`/`exists`), and regex match on JSONPath values — run on every request regardless of JSON validation mode; status assertions override default HTTP error handling; **Regex Builder modal** with JSON tree picker, 17-pattern library, and live match preview; assertion type badges on test cards
- **Request timing breakdown**: Per-request TTFB/download waterfall bar in Response Detail modal; aggregated average timing table in Results Dashboard; timing columns in CLI console summary and Markdown reports; DNS/TCP/TLS phases ready for future granularity

#### Gap analysis: Moderate → Good

| # | Gap | Why it matters | Phase |
|---|---|---|---|
| 1 | **Variables & chaining** | Can't test multi-step workflows (create → get ID → verify) | 0.9.0 |
| ~~2~~ | ~~**Rich assertions**~~ | ~~No status code, response time SLA, header, or regex assertions~~ | ~~0.10.0~~ ✅ |
| ~~3~~ | ~~**Think time & pacing**~~ | ~~No delay between requests per virtual user → unrealistic flood~~ | ~~0.9.1~~ ✅ |
| ~~4~~ | ~~**Worker thread execution**~~ | ~~Single JS thread bottleneck; Web Workers (browser) or Rust threads (Tauri) = 2-5x throughput~~ | ~~0.9.1~~ ✅ |
| ~~5~~ | ~~**Connection pooling**~~ | ~~New TCP connection per request adds latency; `keep-alive` reuse = massive improvement~~ | ~~0.9.1~~ ✅ |
| ~~6~~ | ~~**Request timing breakdown**~~ | ~~No DNS/TLS/TTFB/download waterfall → can't diagnose *why* something is slow~~ | ~~0.10.0~~ ✅ |

#### Gap analysis: Good → Excellent

| # | Gap | Why it matters | Phase |
|---|---|---|---|
| 7 | **Native Rust executor** | Move HTTP engine to Rust backend (`hyper`/`reqwest` + `tokio`) → 10-50x throughput | 1.x |
| 8 | **Constant arrival rate** | "Send 100 RPS regardless of response time" (open model) — k6's killer feature | 1.x |
| 9 | **Streaming percentiles** | T-Digest/HDR Histogram for P50/P95/P99 without storing every datapoint → scales past 100K results | 1.x |
| 10 | **Distributed execution** | Coordinate load across multiple machines/processes → break single-machine limits | 1.x |
| 11 | **Pre/post-request scripts** | JS hooks for dynamic data transformation — power users need programmability | 1.x |

#### Recommended implementation order

```
Priority 1 — Reach "Good" (Phases 0.9.0 + 0.9.1 + 0.10.0)
  ① Variables & Chaining        → unblocks real-world multi-step testing
  ② ~~Think time & pacing~~      → ✅ realistic virtual user simulation (done)
  ③ ~~Worker thread execution~~ → ✅ Web Worker offloading (done)
  ④ ~~Connection pooling~~       → ✅ keep-alive reuse via undici.Agent (done)
  ⑤ ~~Rich assertions~~         → ✅ status code, SLA, header, regex (done)
  ⑥ ~~Request timing breakdown~~  → ✅ TTFB/download waterfall bar, aggregated dashboard, CLI reports (done)

Priority 2 — Reach "Excellent" (Phases 0.11.0 + 1.x)
  ⑦ Run comparison & trends     → CI/CD regression detection
  ⑧ Native Rust executor        → the architectural leap to 10K+ RPS
  ⑨ Constant arrival rate       → open-model load generation
  ⑩ Streaming percentiles       → memory-efficient metrics at scale
  ⑪ Distributed execution       → enterprise-scale multi-machine coordination
```

---

## Completed Phases

### Phase 0.5.0 — Load Profiles & Live Monitoring ✅

Graduate from "send N requests" to real performance testing with time-based execution.

- [x] **Duration-Based Runs** — "Run for 60 seconds at 10 concurrent" instead of fixed transaction count
- [x] **Ramp-Up Profile** — Gradually increase from 1 to N concurrent users over X seconds
- [x] **Sustained Load Profile** — Maintain N concurrent users for X duration
- [x] **Spike Test Profile** — Sudden burst of traffic to test resilience
- [x] **Active Connections Gauge** — Real-time count of in-flight requests
- [x] **Live Response Time Chart** — Streaming line chart of response times during execution
- [x] **Live Throughput Chart** — TPS over time during execution
- [x] **Live Error Rate Chart** — Error percentage over time during execution

### Phase 0.6.0 — Data-Driven Testing & Resilience ✅

Bulk testing with data files, request resilience, and advanced results.

- [x] **CSV Data Files** — Run the same test with different inputs from CSV (parameterized testing)
- [x] **Per-Request Timeout** — Configurable timeout per request (default 10s, 0 = unlimited)
- [x] **Retry on Failure** — Retry N times with configurable delay per test
- [x] **Circuit Breaker / Error Policy** — Stop on first error, or at error count/rate threshold
- [x] **Multi-Level Grouped Results** — Group by Feature → Scenario → Test Name with cascading sub-groups
- [x] **Advanced Search** — Boolean search (AND, OR, NOT, "quoted phrases", parentheses) in Scenario Builder and Results
- [x] **Verify Validation Rules** — Invoke API and compare response against expected rules with discrepancy detail
- [x] **Auto-Refreshing Token Manager** — Shared OAuth2 token cache with JWT expiry detection

### Phase 0.6.5 — Excel Templates & Error Visibility ✅

Structured multi-sheet Excel templates for bulk test management and better error diagnostics.

- [x] **Multi-Sheet Excel Template Export** — 3-step wizard: select path variables → customize column names → review & download styled `.xlsx`
- [x] **Styled Data Sheet** — Request/Response category headers with color-coded columns (blue for request, green for validation)
- [x] **Styled Metadata Sheet** — Formatted COLUMN MAPPINGS, CONFIG, HEADERS sections with bold headings and table layout
- [x] **Excel Template Import** — Parse `.xlsx` with file-level and row-level validation, dynamic column detection for user-added fields
- [x] **All Validation Modes** — Full support for none, full JSON match, and selective fields through export/import round-trip
- [x] **Response Error Display** — Clickable error snippets on failed result rows; Response Detail modal with error message, validation failures table, and full response body
- [x] **HTTP Error Message Extraction** — Executor parses `message`/`error`/`detail` from 4xx/5xx response bodies
- [x] **Detail Header Row** — Column headers shown when expanding grouped results to individual test rows

### Phase 0.8.0 — Test Suite & Code Quality ✅

> Zero tests was a blocker for open-source credibility. Contributors won't trust or contribute to an untested codebase.

- [x] **Unit Tests — Executor** — `executor.ts`: buildHeaders (6 auth types), buildUrl, Content-Type auto-detection (24 tests)
- [x] **Unit Tests — Validator** — `validator.ts`: getByPath, full match, selective, unordered arrays, path remapping (28 tests)
- [x] **Unit Tests — Metrics** — `metrics.ts`: summary stats, TPS, percentiles, error rates (16 tests)
- [x] **Unit Tests — CSV/Excel** — `csvTemplateUrl.ts`: parseUrl, analyzeUrlPath, buildUrlFromTemplate (12 tests)
- [x] **Unit Tests — Engine** — `circuitBreaker.ts` (10), `loadProfileRunner.ts` (14), `scenarioSearch.ts` (25), `curlParser.ts` (14)
- [x] **Unit Tests — Utils** — `testEditorUtils.ts` (28), `resultsGrouping.ts` (14), `jsonPathTreeUtils.ts` (24), `helpers.ts` (2), `fileSaver.ts` (5), `export.ts` (2)
- [x] **Integration Tests** — Storage layer (31), auth inheritance resolution (15), JSON import/export roundtrips (15), CSV template roundtrips (12), Excel template roundtrips (15)
- [x] **E2E Tests** — Playwright: create feature group/scenario/test (4), run test (4), view results (4), navigation/settings (5)
- [x] **`npm test` Script** — Vitest (728 tests, 91.5% line coverage, <2s) + Playwright E2E (17 tests, <10s)
- [x] **Refactor Large Components** — 8 monoliths broken into 25+ focused modules + shared useAuthVerify hook + AuthConfigPanel

---

### Phase 0.8.5 — Requests (Ad-Hoc API Testing) ✅

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

### Phase 0.7.0 — CLI Runner ✅

> Without a CLI, the tool is limited to manual use. This is the single most important feature for adoption.

- [x] **File-Based Projects** — Store test definitions as `.yaml` or `.json` files committable to git
- [x] **CLI Runner** — `redfireforge run ./tests/checkout-flow.yaml --env t01 --concurrency 10 --duration 60s`
- [x] **CI Exit Codes** — Exit code 1 if assertions fail or error rate exceeds threshold (`--fail-on-error`, `--fail-threshold`)
- [x] **JUnit XML Output** — For CI/CD integration (GitHub Actions, Jenkins, GitLab CI) (`--junit report.xml`)
- [x] **JSON/Markdown Report Output** — Machine-readable and human-readable summary reports (`-o`, `--markdown`)
- [ ] **npm Package** — Publish CLI as `npm install -g redfireforge`

### Phase 0.8.8 — API Catalog (OpenAPI/Swagger Browser) ✅

> **Third pillar of RedfireForge.** Import OpenAPI/Swagger specs, browse endpoints with Swagger-UI-style documentation, test them interactively, generate cURL commands, and track spec versions over time. Sits alongside Requests and Harness as a top-level feature.

> Full design docs: [`docs/api-catalog/`](docs/api-catalog/) — [Design](docs/api-catalog/DESIGN.md) · [Data Model](docs/api-catalog/DATA-MODEL.md) · [UI Wireframes](docs/api-catalog/UI-WIREFRAMES.md) · [Phases](docs/api-catalog/PHASES.md)

**Phase 1 — Foundation**
- [x] **Catalog types** — `CatalogEntry`, `CatalogEndpoint`, `CatalogVersion`, `CatalogFolder`, host/auth config types
- [x] **OpenAPI parser** — Parse + validate + dereference specs via `@apidevtools/swagger-parser`; group endpoints by tag
- [x] **Schema stub generator** — Convert JSON Schema → sample request body (uses `example`/`default`/type fallback)
- [x] **Catalog sidebar** — Thin sidebar tab showing API names + version badges + endpoint count (no endpoint trees)
- [x] **Import modal** — File picker → validate → preview (title, version, servers, endpoints by tag, warnings) → import
- [x] **Storage hook** (`useCatalog`) — CRUD for catalog entries, persist via existing storage abstraction
- [x] **App integration** — Third nav rail section (`Requests | Catalog | Harness`), welcome page

**Phase 2 — Endpoint Browser**
- [x] **Endpoint nav strip** — Tag-grouped endpoint list inside main panel (not sidebar); search/filter, collapse, resize
- [x] **Endpoint detail view** — Swagger-UI-style: method badge, path, summary, parameters, request body schema, response schemas
- [x] **Main panel orchestrator** — Three modes: welcome (empty), overview (API selected), endpoint detail (endpoint selected)

**Phase 3 — Interactive Testing**
- [x] **Host & auth bar** — Strategy selector (From Spec / Custom URL / Environment) for base URL and authentication
- [x] **Parameter editor** — Editable forms for path, query, header params with type hints, enums, required badges
- [x] **"Try It" execution** — Build URL + headers + body → `httpFetch()` → display response (reuse `JsonTreePreview`)

**Phase 4 — cURL Integration**
- [x] **cURL generation** — Extend existing `buildCurlCommand` for catalog endpoint shape
- [x] **cURL preview popover** — Formatted command with single/multi-line toggle + copy to clipboard
- [x] **Context menu cURL** — Right-click endpoint in nav → "Copy as cURL" with schema defaults

**Phase 5 — Versioning**
- [x] **Version storage** — Each entry stores version history with raw spec + hash for change detection
- [x] **Re-import flow** — Detect existing API by title, compute diff, offer "Update existing" vs "Import as new"
- [x] **Spec diff engine** — Detect added/removed/changed endpoints between versions
- [x] **Version history modal** — List past imports, view diffs, restore previous versions

**Phase 6 — Polish & Bridges**
- [x] **Overview page** — API summary with endpoint stats by tag/method, server list, config status
- [x] **"Send to Requests"** — Copy endpoint(s) as `RequestItem` objects into a collection
- [x] **Swagger 2.0 verification** — End-to-end test with real Swagger 2.0 specs
- [x] **Unit + E2E tests** — Parser, stub generator, diff engine, import flow, endpoint browsing

### Phase 0.9.0-alpha — Unified Environments & Catalog Export ✅

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

### Phase 0.9.0-alpha.2 — Group Collections & Catalog Metadata ✅

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

---

## Upcoming Phases

### Phase 0.7.5 — CI/CD Pipeline

> Automate quality gates and release workflows. The existing multi-platform release pipeline (`.github/workflows/release.yml`) already builds macOS/Windows/Linux artifacts on tag push. This phase extends automation to cover testing, PR checks, and deployment.

- [ ] **CI Test Pipeline** — GitHub Actions workflow: run `npm test` (Vitest 728 tests) on every push/PR
- [ ] **CI E2E Pipeline** — GitHub Actions workflow: run `npm run test:e2e` (Playwright 17 tests) on every PR
- [ ] **Lint & Type-Check Gate** — `npm run lint` + `tsc --noEmit` as required PR checks
- [ ] **PR Status Checks** — Require all CI jobs to pass before merge
- [ ] **GitHub Actions Example for Users** — Ready-to-use workflow YAML for running RedfireForge CLI tests in CI (depends on Phase 0.7.0)
- [ ] **Automated Version Tagging** — GitHub Action to create version tags on `master` merge
- [ ] **Live Demo Deployment** — Auto-deploy web build to Vercel/Netlify on `master` push

---

### Phase 0.9.0 — Variables & Chaining

> **Table stakes for real-world API testing.** Without this, you can't test multi-step workflows (create order → get order ID → verify order).

- [ ] **Variable Templates** — Support `{{baseUrl}}`, `{{apiKey}}`, `{{timestamp}}` in URLs, headers, and body
- [ ] **Built-in Generators** — `{{$randomEmail}}`, `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`
- [ ] **Variable Extraction** — Extract values from responses using JSONPath (e.g., `$.data.id` → `{{orderId}}`)
- [ ] **Variable Injection** — Use extracted variables in downstream test URLs, headers, and body
- [ ] **Scenario Chaining / Workflow Mode** — Chain requests sequentially where each step depends on the previous
- [ ] **JSON Data Files** — Parameterize tests from JSON arrays (complement to CSV)

---

### Phase 0.9.1 — Engine Performance (Moderate → Good)

> Upgrade the execution engine from browser-limited single-thread to a performant multi-threaded architecture. This is the core engineering work that moves load testing from **Moderate** to **Good**.

- [x] **Think Time & Pacing** — Configurable delay between requests per virtual user (constant, random uniform, random gaussian); prevents unrealistic request flooding and enables realistic user simulation
- [x] **Connection Pooling** — Reuse HTTP connections via `keep-alive` with shared `undici.Agent` (30s timeout, 128 connections, pipelining); Vite proxy creates pool at startup with cleanup on shutdown; Node CLI creates pool on first request with `closeNodePool()` for explicit cleanup; `Connection: keep-alive` header injected on all outbound requests; Tauri already pooled via `reqwest`; 2–3x latency improvement for HTTPS APIs
- [x] **Worker Thread Execution (Web)** — Full engine (HTTP, validation, metrics, think time, circuit breaker) runs in a Web Worker thread, freeing the main thread for 60fps UI rendering; incremental result transfer via `postMessage`; Tauri HTTP proxied through main thread; automatic fallback when Workers unavailable; 10–30% throughput improvement on CPU-bound tests
- [ ] **Tauri Sidecar Executor** — In desktop mode, offload HTTP execution to a Rust sidecar process using `reqwest` + `tokio` async runtime; communicates with the UI via Tauri IPC events for 5-10x throughput improvement
- [ ] **Constant Request Rate Mode** — "Send exactly N requests/second regardless of response time" (open model); complements existing closed model where concurrency = in-flight connections
- [ ] **Graceful Drain** — When a load profile ends or is aborted, wait for in-flight requests to complete (with configurable timeout) instead of dropping them; ensures accurate final metrics

---

### Phase 0.10.0 — Assertions & Observability

> Richer assertions and deeper visibility into what happened during a run. Combined with Phase 0.9.1, this completes the transition to **Good** load testing.

- [x] **Status Code Assertions** — Assert specific codes (`200`), classes (`2xx`), ranges (`200-299`), comma-separated lists; overrides default HTTP error handling so asserting `404` makes a 404 pass
- [x] **Response Time Assertions** — Per-test SLA threshold (`≤ Nms`); fails requests exceeding the configured maximum
- [x] **Response Header Assertions** — Validate any response header with `equals`, `contains`, `regex`, or `exists` operators; case-insensitive header name lookup
- [x] **Regex Assertions** — Match JSONPath-extracted values against regular expressions (`$.name matches /^[A-Z].*/`)
- [ ] **Structured JSON body assertions** — User-friendly rules on response JSON (beyond regex): **array length** at a JSONPath (e.g. `$.offers` length ≥ 4), **numeric compare** at a path (`>`, `≥`, `=`, `<`), **date compare** at a path vs **`today`** (define local vs UTC) or a fixed ISO date. Extend `Assertion` in `src/types/index.ts`, implement in `evaluateAssertions()` (`validator.ts`) using existing `getByPath()`; add Validation tab UI with path picker + plain-language operators. Applies to Harness tests and workflow HTTP steps (same `Scenario.validation`).
- [ ] **Response Headers in Results** — Capture and display response headers (currently only body)
- [ ] **Request Log** — Show the exact request sent including resolved auth headers
- [x] **Request Timing Breakdown** — DNS, TLS handshake, TTFB, download (waterfall view)

---

### Phase 0.11.0 — Run Comparison & Trends

Analytics to detect regressions and compare performance over time.

- [ ] **Run Comparison** — Compare two runs side-by-side (TPS, P95, P99 delta with green/red indicators)
- [ ] **Overlaid Histograms** — Response time distribution overlay between two runs
- [ ] **Baseline Runs** — Mark a run as "baseline" and compare future runs against it
- [ ] **Regression Detection** — Automatic alert when P95 increases by X% vs baseline
- [ ] **Trend Analysis** — P95 trend across last N runs for the same test suite

---

### Phase 1.0.0 — Open-Source Launch

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
- [ ] **Hacker News post** — "Show HN: RedfireForge — a visual API testing workbench (open-source JMeter alternative)"
- [ ] **Reddit posts** — r/webdev, r/node, r/programming, r/QualityAssurance
- [ ] **Dev.to / Hashnode article** — "Why I built a visual load testing tool"

---

### Phase 1.x — Future (Good → Excellent)

Post-launch features driven by community feedback. Completing the engine items below moves load testing from **Good** to **Excellent**.

#### Engine — Excellent Tier
- [ ] **Native Rust Executor** — Full HTTP engine in Rust (`hyper`/`reqwest` + `tokio` async runtime) invoked via Tauri commands; eliminates JS overhead entirely for 10-50x throughput (5,000-50,000+ RPS)
- [ ] **Streaming Percentiles** — T-Digest or HDR Histogram for P50/P95/P99 calculation without storing every datapoint in memory; enables accurate metrics at 100K+ results without OOM
- [ ] **Distributed Execution** — Coordinate load generation across multiple machines/processes via a controller/worker architecture; break past single-machine limits for enterprise-scale testing
- [ ] **Constant Arrival Rate (Advanced)** — Automatic worker scaling to maintain target RPS even when responses are slow; queue-based request dispatching with backpressure

#### Protocol & Format Support
- [ ] **GraphQL Support** — Query/mutation builder with introspection
- [ ] **gRPC Support** — Protobuf definition import, unary and streaming calls
- [ ] **WebSocket Support** — Connect, send messages, assert on received messages
- [ ] **JSON Schema Validation** — Validate response against JSON Schema (draft 2020-12)

#### Extensibility & Organization
- [ ] **Test Tagging** — Label tests with `smoke`, `regression`, `critical` and run by tag
- [ ] **Pre/Post-Request Scripts** — JS snippets for dynamic data transformation
- [ ] **Plugin API** — Extension point for custom auth providers, assertion functions, reporters

---

## Progress Summary

| Phase | Target | Load Level | Items | Done |
|---|---|---|---|---|
| 0.5.0 | Load Profiles & Live Monitoring | Moderate | 8 | 8 |
| 0.6.0 | Data-Driven & Resilience | Moderate | 8 | 8 |
| 0.6.5 | Excel Templates & Error Visibility | Moderate | 8 | 8 |
| 0.7.0 | CLI Runner | — | 6 | 5 |
| 0.7.5 | CI/CD Pipeline | — | 7 | 0 |
| 0.8.0 | Test Suite & Code Quality | — | 10 | 10 |
| 0.8.5 | Requests (Ad-Hoc API Testing) | — | 13 | 13 |
| 0.8.8 | API Catalog (OpenAPI/Swagger) | — | 18 | 18 |
| 0.9.0-α | Unified Environments & Catalog Export | — | 12 | 12 |
| 0.9.0-α2 | Group Collections & Catalog Metadata | — | 9 | 9 |
| 0.9.0 | Variables & Chaining | → Good | 6 | 0 |
| **0.9.1** | **Engine Performance** | **→ Good** | **6** | **3** |
| 0.10.0 | Assertions & Observability | → Good | 7 | 5 |
| 0.11.0 | Run Comparison & Trends | — | 5 | 0 |
| 1.0.0 | Open-Source Launch | — | 14 | 0 |
| 1.x | Future (Engine → Excellent) | → Excellent | 11 | 0 |
| **Total** | | | **148** | **97** |

### Load Testing Level Milestones

```
CURRENT: Moderate (~100-300 RPS)
  ├── Phase 0.5.0 ✅  Duration profiles, ramp-up, spike
  ├── Phase 0.6.0 ✅  CSV data, retry, circuit breaker, timeout
  └── Phase 0.6.5 ✅  Excel templates, live charts

TARGET: Good (~500-2,000 RPS)
  ├── Phase 0.9.0     Variables, chaining, workflow mode
  ├── Phase 0.9.1     Worker threads, connection pooling, think time, constant rate
  └── Phase 0.10.0    Rich assertions ✅, timing breakdown ✅

FUTURE: Excellent (5,000-50,000+ RPS)
  └── Phase 1.x       Native Rust executor, streaming percentiles, distributed
```

### Adoption Forecast

| Scenario | Predicted Stars (Year 1) | Requirements |
|---|---|---|
| Launch now (no CLI, no CI pipeline, no demo) | 50–200 | Not recommended |
| Launch with CLI + CI pipeline + live demo | 500–2,000 | Phases 0.7.0 + 0.7.5 complete |
| Launch with "Good" load testing + demo | 2,000–5,000 | Phases 0.9.0 + 0.9.1 + 0.10.0 + 1.0.0 |
| Viral launch (HN front page, YouTube) | 5,000–10,000+ | All of above + great branding + luck |

### Critical Path to Open-Source (minimum viable launch)

```
Phase 0.7.0 (CLI) ✅ DONE  →  Phase 0.7.5 (CI/CD)  →  Phase 1.0.0 (Launch)
                                  ↑ MUST HAVE              ↑ MUST HAVE

Phase 0.8.0 (Tests) ✅ DONE — 730 unit/integration + 17 E2E = 747 tests
Phase 0.8.5 (Requests) ✅ DONE — Insomnia/Postman-style ad-hoc API testing
Phase 0.8.8 (API Catalog) ✅ DONE — OpenAPI/Swagger browser, interactive testing, cURL, versioning
```

### Critical Path to "Good" Load Testing

```
Phase 0.9.0 (Variables & Chaining)  →  Phase 0.9.1 (Engine Performance)  →  Phase 0.10.0 (Assertions)
  ↑ unblocks real workflows              ↑ 2-5x throughput boost                ↑ actionable results
```

Phases 0.9.0–0.10.0 elevate load testing from **Moderate** to **Good**. Phase 0.11.0 (trends) and 1.x (Rust executor, distributed) are post-launch paths to **Excellent**.

---

_Last updated: 2026-04-19 (v0.5.2 — Request timing breakdown complete; 97/148 items done)_
