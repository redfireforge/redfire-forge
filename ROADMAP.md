# RedfireForge — Roadmap

> Prioritized feature roadmap for open-source release.
> Check items off as they are completed.

---

## Phase 0.5.0 — Load Profiles & Live Monitoring ✅

Graduate from "send N requests" to real performance testing with time-based execution.

- [x] **Duration-Based Runs** — "Run for 60 seconds at 10 concurrent" instead of fixed transaction count
- [x] **Ramp-Up Profile** — Gradually increase from 1 to N concurrent users over X seconds
- [x] **Sustained Load Profile** — Maintain N concurrent users for X duration
- [x] **Spike Test Profile** — Sudden burst of traffic to test resilience
- [x] **Active Connections Gauge** — Real-time count of in-flight requests
- [x] **Live Response Time Chart** — Streaming line chart of response times during execution
- [x] **Live Throughput Chart** — TPS over time during execution
- [x] **Live Error Rate Chart** — Error percentage over time during execution

---

## Phase 0.6.0 — Data-Driven Testing & Resilience ✅

Bulk testing with data files, request resilience, and advanced results.

- [x] **CSV Data Files** — Run the same test with different inputs from CSV (parameterized testing)
- [x] **Per-Request Timeout** — Configurable timeout per request (default 10s, 0 = unlimited)
- [x] **Retry on Failure** — Retry N times with configurable delay per test
- [x] **Circuit Breaker / Error Policy** — Stop on first error, or at error count/rate threshold
- [x] **Multi-Level Grouped Results** — Group by Feature → Scenario → Test Name with cascading sub-groups
- [x] **Advanced Search** — Boolean search (AND, OR, NOT, "quoted phrases", parentheses) in Scenario Builder and Results
- [x] **Verify Validation Rules** — Invoke API and compare response against expected rules with discrepancy detail
- [x] **Auto-Refreshing Token Manager** — Shared OAuth2 token cache with JWT expiry detection

---

## Phase 0.6.5 — Excel Templates & Error Visibility ✅

Structured multi-sheet Excel templates for bulk test management and better error diagnostics.

- [x] **Multi-Sheet Excel Template Export** — 3-step wizard: select path variables → customize column names → review & download styled `.xlsx`
- [x] **Styled Data Sheet** — Request/Response category headers with color-coded columns (blue for request, green for validation)
- [x] **Styled Metadata Sheet** — Formatted COLUMN MAPPINGS, CONFIG, HEADERS sections with bold headings and table layout
- [x] **Excel Template Import** — Parse `.xlsx` with file-level and row-level validation, dynamic column detection for user-added fields
- [x] **All Validation Modes** — Full support for none, full JSON match, and selective fields through export/import round-trip
- [x] **Response Error Display** — Clickable error snippets on failed result rows; Response Detail modal with error message, validation failures table, and full response body
- [x] **HTTP Error Message Extraction** — Executor parses `message`/`error`/`detail` from 4xx/5xx response bodies
- [x] **Detail Header Row** — Column headers shown when expanding grouped results to individual test rows

---

## Phase 0.7.0 — Assertions & Observability

Richer assertions and deeper visibility into what happened during a run.

- [ ] **Status Code Assertions** — Assert specific status codes (e.g., "expect 201", "expect 4xx range")
- [ ] **Response Time Assertions** — "Must respond under 500ms" per-test SLA threshold
- [ ] **Response Header Assertions** — Validate `Content-Type`, `Cache-Control`, custom headers
- [ ] **Regex Assertions** — `$.name matches /^[A-Z].*/`
- [ ] **Response Headers in Results** — Capture and display response headers (currently only body)
- [ ] **Request Log** — Show the exact request sent including resolved auth headers
- [ ] **Request Timing Breakdown** — DNS, TLS handshake, TTFB, download (waterfall view)

---

## Phase 0.8.0 — Variables & Chaining

Dynamic data and multi-step API workflows.

- [ ] **Variable Templates** — Support `{{baseUrl}}`, `{{apiKey}}`, `{{timestamp}}` in URLs, headers, and body
- [ ] **Built-in Generators** — `{{$randomEmail}}`, `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`
- [ ] **Variable Extraction** — Extract values from responses using JSONPath (e.g., `$.data.id` → `{{orderId}}`)
- [ ] **Variable Injection** — Use extracted variables in downstream test URLs, headers, and body
- [ ] **Scenario Chaining / Workflow Mode** — Chain requests sequentially where each step depends on the previous
- [ ] **JSON Data Files** — Parameterize tests from JSON arrays (complement to CSV)

---

## Phase 0.9.0 — Run Comparison & Trends

Analytics to detect regressions and compare performance over time.

- [ ] **Run Comparison** — Compare two runs side-by-side (TPS, P95, P99 delta with green/red indicators)
- [ ] **Overlaid Histograms** — Response time distribution overlay between two runs
- [ ] **Baseline Runs** — Mark a run as "baseline" and compare future runs against it
- [ ] **Regression Detection** — Automatic alert when P95 increases by X% vs baseline
- [ ] **Trend Analysis** — P95 trend across last N runs for the same test suite

---

## Phase 1.0.0 — CLI, CI Integration & Open-Source Release

The open-source launch — git-friendly, pipeline-ready, community-ready.

### CLI & CI
- [ ] **File-Based Projects** — Store test definitions as `.yaml` or `.json` files committable to git
- [ ] **CLI Runner** — `redfireforge run ./tests/checkout-flow.yaml --env t01 --concurrency 10 --duration 60s`
- [ ] **CI Exit Codes** — Exit code 1 if assertions fail or error rate exceeds threshold
- [ ] **JUnit XML Output** — For CI/CD integration (GitHub Actions, Jenkins, GitLab CI)
- [ ] **JSON/Markdown Report Output** — Machine-readable and human-readable summary reports
- [ ] **GitHub Actions Example** — Ready-to-use workflow YAML for running tests in CI

### Quality & Testing
- [ ] **Unit Tests** — Engine (`executor.ts`, `validator.ts`, `metrics.ts`)
- [ ] **Integration Tests** — Import/export roundtrips, storage layer
- [ ] **E2E Tests** — Playwright tests for the UI
- [ ] **`npm test` Script** — Runnable test suite with CI badge

### Open-Source Packaging
- [ ] **LICENSE File** — MIT or Apache-2.0
- [ ] **CONTRIBUTING.md** — Setup instructions, coding standards, PR process
- [ ] **Issue Templates** — Bug report, feature request templates
- [ ] **npm Package** — Publish CLI as `npm install -g redfireforge`

### Documentation & Branding
- [ ] **Documentation Site** — GitHub Pages or Docusaurus with guides, screenshots, API reference
- [ ] **Video Walkthrough** — GIF demos in README, YouTube tutorial
- [ ] **Comparison Table** — RedfireForge vs Postman, k6, Bruno, Insomnia, Hoppscotch
- [ ] **Logo & Branding** — Professional logo and icon
- [ ] **Live Demo** — Deploy web version to Vercel/Netlify for instant try-out

---

## Phase 1.x — Future

Post-launch features driven by community feedback.

- [ ] **Test Tagging** — Label tests with `smoke`, `regression`, `critical` and run by tag
- [ ] **GraphQL Support** — Query/mutation builder with introspection
- [ ] **gRPC Support** — Protobuf definition import, unary and streaming calls
- [ ] **WebSocket Support** — Connect, send messages, assert on received messages
- [ ] **Plugin API** — Extension point for custom auth providers, assertion functions, reporters
- [ ] **JSON Schema Validation** — Validate response against JSON Schema (draft 2020-12)
- [ ] **Pre/Post-Request Scripts** — JS snippets for dynamic data transformation

---

## Progress Summary

| Phase | Target | Items | Done |
|---|---|---|---|
| 0.5.0 | Load Profiles & Live Monitoring | 8 | 8 |
| 0.6.0 | Data-Driven & Resilience | 8 | 8 |
| 0.6.5 | Excel Templates & Error Visibility | 8 | 8 |
| 0.7.0 | Assertions & Observability | 7 | 0 |
| 0.8.0 | Variables & Chaining | 6 | 0 |
| 0.9.0 | Run Comparison & Trends | 5 | 0 |
| 1.0.0 | CLI, CI & Open-Source Release | 19 | 0 |
| 1.x | Future | 7 | 0 |
| **Total** | | **68** | **24** |

---

_Last updated: 2026-04-15 (v0.3.5)_
