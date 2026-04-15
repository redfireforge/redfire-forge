# RedfireForge — Roadmap

> Prioritized feature roadmap for open-source release.
> Check items off as they are completed.

---

## Positioning & Strategy

> Recommendations from competitive analysis against k6, Gatling, Locust, Artillery, JMeter, Bruno, Hoppscotch, Postman.

### Identity

RedfireForge is a **visual API testing workbench** — not a raw load generator. Its strength is the intersection of **GUI-driven test building**, **response validation**, and **moderate load testing** in one tool. No competitor occupies this exact niche:

| Tool | GUI | Load Testing | Response Validation | Desktop Native |
|---|---|---|---|---|
| **k6** | No (code-only) | Excellent | Basic `check()` | No |
| **Gatling** | No (Scala DSL) | Excellent | Basic | No |
| **Locust** | Minimal web UI | Good | Manual (Python) | No |
| **JMeter** | Yes (dated Java Swing) | Good | Verbose XML assertions | No |
| **Artillery** | No (YAML + JS) | Good | Basic | No |
| **Bruno** | Yes (modern) | No | Manual | Yes (Electron) |
| **Hoppscotch** | Yes (modern, web) | No | Manual | No |
| **Postman** | Yes (proprietary) | Limited (paid) | Good | Yes (Electron) |
| **RedfireForge** | Yes (modern) | Moderate | Excellent (visual) | Yes (Tauri) |

### Key Differentiators (Lean Into These)

1. **Visual load testing with a modern UI** — the JMeter replacement the world needs
2. **Sophisticated validation engine** — JSONPath builder, unordered arrays, selective/full modes, visual diff
3. **Excel template workflow** — enterprise QA teams work in spreadsheets, no competitor supports this
4. **Auth inheritance chain** — Global → Feature → Scenario → Test with visual badges
5. **Tauri-based desktop** — lighter than Electron (Bruno, Postman), native performance
6. **Web mode with zero install** — instant try-it-out on Vercel/Netlify

### Positioning Recommendation

- **Current tagline**: "API Performance Studio" — overpromises on raw load-generation capability
- **Recommended tagline**: "Visual API Testing Workbench" or "API Testing Studio"
- **Elevator pitch**: "Build API tests visually, validate responses with precision, run them under load — all from a modern desktop app or your browser. The JMeter replacement for teams who hate XML."

### Risks to Address

- **No tests** — zero unit/integration/E2E tests; critical blocker for contributor trust
- **No CLI / CI** — without pipeline integration, adoption is limited to manual QA
- **No request chaining** — can't test multi-step workflows (create → read → update → delete)
- **Browser-based executor** — caps at a few hundred concurrent connections; honest about this limitation
- **Monolithic components** — largest files are 1000-1400 lines; intimidating for contributors
- **Solo developer vs funded teams** — k6 has Grafana, Bruno has 30K+ stars with a team

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

---

## Upcoming Phases

### Phase 0.7.0 — CLI & CI Integration ⬆️ PRIORITY

> **Moved up from Phase 1.0.** Without CLI/CI, the tool is limited to manual use. This is the single most important feature for adoption.

- [ ] **File-Based Projects** — Store test definitions as `.yaml` or `.json` files committable to git
- [ ] **CLI Runner** — `redfireforge run ./tests/checkout-flow.yaml --env t01 --concurrency 10 --duration 60s`
- [ ] **CI Exit Codes** — Exit code 1 if assertions fail or error rate exceeds threshold
- [ ] **JUnit XML Output** — For CI/CD integration (GitHub Actions, Jenkins, GitLab CI)
- [ ] **JSON/Markdown Report Output** — Machine-readable and human-readable summary reports
- [ ] **GitHub Actions Example** — Ready-to-use workflow YAML for running tests in CI
- [ ] **npm Package** — Publish CLI as `npm install -g redfireforge`

---

### Phase 0.8.0 — Test Suite & Code Quality ⬆️ PRIORITY

> **Moved up from Phase 1.0.** Zero tests is a blocker for open-source credibility. Contributors won't trust or contribute to an untested codebase.

- [ ] **Unit Tests — Executor** — `executor.ts`: request execution, timeout, retry, circuit breaker logic
- [ ] **Unit Tests — Validator** — `validator.ts`: full match, selective, unordered arrays, path remapping
- [ ] **Unit Tests — Metrics** — `metrics.ts`: summary stats, percentile calculations
- [ ] **Unit Tests — CSV/Excel** — `csvTemplate.ts`: export/import round-trip for all 3 validation modes
- [ ] **Integration Tests** — Import/export roundtrips, storage layer, auth inheritance resolution
- [ ] **E2E Tests** — Playwright tests for critical UI flows (create test, run test, view results, import Excel)
- [ ] **`npm test` Script** — Runnable test suite with coverage reporting
- [ ] **CI Test Pipeline** — GitHub Actions runs tests on every PR
- [ ] **Refactor Large Components** — Break down ScenarioBuilder (~1400 lines), TestRunner (~1000 lines), TestEditorModal into smaller focused components

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

### Phase 0.10.0 — Assertions & Observability

Richer assertions and deeper visibility into what happened during a run.

- [ ] **Status Code Assertions** — Assert specific status codes (e.g., "expect 201", "expect 4xx range")
- [ ] **Response Time Assertions** — "Must respond under 500ms" per-test SLA threshold
- [ ] **Response Header Assertions** — Validate `Content-Type`, `Cache-Control`, custom headers
- [ ] **Regex Assertions** — `$.name matches /^[A-Z].*/`
- [ ] **Response Headers in Results** — Capture and display response headers (currently only body)
- [ ] **Request Log** — Show the exact request sent including resolved auth headers
- [ ] **Request Timing Breakdown** — DNS, TLS handshake, TTFB, download (waterfall view)

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

### Phase 1.x — Future

Post-launch features driven by community feedback.

- [ ] **Test Tagging** — Label tests with `smoke`, `regression`, `critical` and run by tag
- [ ] **GraphQL Support** — Query/mutation builder with introspection
- [ ] **gRPC Support** — Protobuf definition import, unary and streaming calls
- [ ] **WebSocket Support** — Connect, send messages, assert on received messages
- [ ] **Plugin API** — Extension point for custom auth providers, assertion functions, reporters
- [ ] **JSON Schema Validation** — Validate response against JSON Schema (draft 2020-12)
- [ ] **Pre/Post-Request Scripts** — JS snippets for dynamic data transformation
- [ ] **Distributed Execution** — Coordinate load generation across multiple machines (stretch goal)

---

## Progress Summary

| Phase | Target | Items | Done |
|---|---|---|---|
| 0.5.0 | Load Profiles & Live Monitoring | 8 | 8 |
| 0.6.0 | Data-Driven & Resilience | 8 | 8 |
| 0.6.5 | Excel Templates & Error Visibility | 8 | 8 |
| 0.7.0 | CLI & CI Integration | 7 | 0 |
| 0.8.0 | Test Suite & Code Quality | 9 | 0 |
| 0.9.0 | Variables & Chaining | 6 | 0 |
| 0.10.0 | Assertions & Observability | 7 | 0 |
| 0.11.0 | Run Comparison & Trends | 5 | 0 |
| 1.0.0 | Open-Source Launch | 14 | 0 |
| 1.x | Future | 8 | 0 |
| **Total** | | **80** | **24** |

### Adoption Forecast

| Scenario | Predicted Stars (Year 1) | Requirements |
|---|---|---|
| Launch now (no CLI, no tests, no demo) | 50–200 | ❌ Not recommended |
| Launch with CLI + tests + live demo | 500–2,000 | Phases 0.7–0.8 complete |
| Viral launch (HN front page, YouTube) | 2,000–5,000+ | All of above + great branding + luck |

### Critical Path to Open-Source (minimum viable launch)

```
Phase 0.7.0 (CLI/CI)  →  Phase 0.8.0 (Tests)  →  Phase 1.0.0 (Launch)
     ↑ MUST HAVE            ↑ MUST HAVE              ↑ MUST HAVE
```

Phases 0.9–0.11 (variables, assertions, trends) are **nice to have** for launch but not blockers. They can ship as post-launch updates to sustain momentum.

---

_Last updated: 2026-04-15 (v0.3.5)_
