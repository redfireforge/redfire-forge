# RedfireForge — Roadmap

> Prioritized feature roadmap for open-source release.
> Check items off as they are completed.

---

## Phase 0.4.0 — Workflow & Assertions

Core features that make the tool usable for real-world API workflows.

- [ ] **Variable Templates** — Support `{{baseUrl}}`, `{{apiKey}}`, `{{timestamp}}` in URLs, headers, and body
- [ ] **Built-in Generators** — `{{$randomEmail}}`, `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}` for dynamic data
- [ ] **Scenario Chaining / Workflow Mode** — Chain requests sequentially where each step can depend on the previous
- [ ] **Variable Extraction** — Extract values from responses using JSONPath (e.g., `$.data.id` → `{{orderId}}`) for use in subsequent requests
- [ ] **Variable Injection** — Use extracted variables in downstream test URLs, headers, and body
- [ ] **Pre/Post-Request Scripts** — Small JS snippets for dynamic data transformation before/after each request
- [ ] **Status Code Assertions** — Assert specific status codes (e.g., "expect 201", "expect 4xx range")
- [ ] **Response Header Assertions** — Validate `Content-Type`, `Cache-Control`, custom headers, etc.
- [ ] **Response Time Assertions** — "Must respond under 500ms" per-test SLA threshold
- [ ] **JSON Schema Validation** — Validate response against JSON Schema (draft 2020-12) for contract testing

---

## Phase 0.5.0 — Load Profiles & Live Monitoring

Graduate from "send N requests" to real performance testing with time-based execution.

- [ ] **Duration-Based Runs** — "Run for 60 seconds at 10 concurrent" instead of fixed transaction count
- [ ] **Ramp-Up Profile** — Gradually increase from 1 to N concurrent users over X seconds
- [ ] **Sustained Load Profile** — Maintain N concurrent users for X duration
- [ ] **Spike Test Profile** — Sudden burst of traffic to test resilience
- [ ] **Soak Test Profile** — Low concurrency over a long duration to detect memory leaks / degradation
- [ ] **Live Response Time Chart** — Streaming line chart of response times during execution
- [ ] **Live Throughput Chart** — TPS over time during execution
- [ ] **Live Error Rate Chart** — Error percentage over time during execution
- [ ] **Active Connections Gauge** — Real-time count of in-flight requests

---

## Phase 0.6.0 — CLI, File-Based Projects & CI Integration

The open-source killer features — git-friendly and pipeline-ready.

- [ ] **File-Based Projects** — Store test definitions as `.yaml` or `.json` files that can be committed to git
- [ ] **CLI Runner** — `redfireforge run ./tests/checkout-flow.yaml --env t01 --concurrency 10 --duration 60s`
- [ ] **CI Exit Codes** — Exit code 1 if assertions fail or error rate exceeds threshold
- [ ] **JUnit XML Output** — For CI/CD integration (GitHub Actions, Jenkins, GitLab CI)
- [ ] **JSON/Markdown Report Output** — Machine-readable and human-readable summary reports
- [ ] **GitHub Actions Example** — Ready-to-use workflow YAML for running tests in CI
- [ ] **Run Comparison** — Compare two runs side-by-side (TPS, P95, P99 delta with green/red indicators)
- [ ] **Overlaid Histograms** — Response time distribution overlay between two runs
- [ ] **Baseline Runs** — Mark a run as "baseline" and compare future runs against it
- [ ] **Regression Detection** — Automatic alert when P95 increases by X% vs baseline

---

## Phase 0.7.0 — Data-Driven & Advanced Validation

Enterprise-grade testing capabilities.

- [ ] **CSV Data Files** — Run the same test with different inputs from CSV (parameterized testing)
- [ ] **JSON Data Files** — Parameterize tests from JSON arrays
- [ ] **Regex Assertions** — `$.name matches /^[A-Z].*/`
- [ ] **Retry on Failure** — Retry N times with X ms delay per test
- [ ] **Per-Test Timeout** — Configurable timeout per request (currently no timeout)
- [ ] **Circuit Breaker** — Stop the run if error rate exceeds X%
- [ ] **Trend Analysis** — P95 trend across last N runs for the same test suite
- [ ] **Request Timing Breakdown** — DNS, TLS handshake, TTFB, download (waterfall view)
- [ ] **Response Headers in Results** — Capture and display response headers (currently only body)
- [ ] **Request Log** — Show the exact request sent including resolved auth headers

---

## Phase 1.0.0 — Ecosystem & Community

Full open-source maturity.

### Protocol Support
- [ ] **GraphQL Support** — Query/mutation builder with introspection
- [ ] **gRPC Support** — Protobuf definition import, unary and streaming calls
- [ ] **WebSocket Support** — Connect, send messages, assert on received messages

### Plugin System
- [ ] **Plugin API** — Extension point for custom auth providers (HMAC signing, AWS SigV4)
- [ ] **Custom Assertion Functions** — User-defined validation logic
- [ ] **Custom Reporters** — Slack notification, Datadog metrics push, PagerDuty alerts

### Collaboration
- [ ] **Test Tagging** — Label tests with `smoke`, `regression`, `critical`, etc.
- [ ] **Selective Execution by Tag** — "Run all tests tagged `smoke`"
- [ ] **Comments / Notes on Tests** — Document purpose and context per test
- [ ] **Shared Project Files** — Git-friendly format with merge-safe structure

### Quality & Testing
- [ ] **Unit Tests** — Engine (`executor.ts`, `validator.ts`, `metrics.ts`)
- [ ] **Integration Tests** — Import/export roundtrips, storage layer
- [ ] **E2E Tests** — Playwright tests for the UI
- [ ] **`npm test` Script** — Runnable test suite with CI badge

### Documentation & Branding
- [ ] **Documentation Site** — GitHub Pages or Docusaurus with guides, screenshots, API reference
- [ ] **Video Walkthrough** — GIF demos in README, YouTube tutorial
- [ ] **Comparison Table** — RedfireForge vs Postman, k6, Bruno, Insomnia, Hoppscotch
- [ ] **Logo & Branding** — Professional logo and icon
- [ ] **Live Demo** — Deploy web version to Vercel/Netlify for instant try-out

### Open-Source Packaging
- [ ] **LICENSE File** — MIT or Apache-2.0
- [ ] **CONTRIBUTING.md** — Setup instructions, coding standards, PR process
- [ ] **Issue Templates** — Bug report, feature request templates
- [ ] **GitHub Discussions** — Enable for community Q&A
- [ ] **npm Package** — Publish CLI as `npm install -g redfireforge`

---

## Progress Summary

| Phase | Target | Items | Done |
|---|---|---|---|
| 0.4.0 | Workflow & Assertions | 10 | 0 |
| 0.5.0 | Load Profiles & Live Monitoring | 9 | 0 |
| 0.6.0 | CLI & CI Integration | 10 | 0 |
| 0.7.0 | Data-Driven & Advanced Validation | 10 | 0 |
| 1.0.0 | Ecosystem & Community | 20 | 0 |
| **Total** | | **59** | **0** |

---

_Last updated: 2026-04-13_
