# RedfireForge — Long-Term Enhancement Plan

> **Purpose:** This is a **permanent backlog** of features, improvements, and ideas that are not yet scheduled. When a plan document is moved to `docs/plan/finished/`, items from it that remain unimplemented should be added here so nothing is forgotten.
>
> **How to use:**
> 1. Before starting a new feature branch, check this document for relevant items.
> 2. When completing a phase plan, move unfinished items here before archiving the plan.
> 3. When a user or reviewer suggests a feature, add it here with a date and source.
> 4. When an item is picked up for implementation, mark it `IN PROGRESS` with the branch name.
> 5. When an item is completed, mark it `DONE` with the date and remove it on next cleanup.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `BACKLOG` | Not started, no branch, available to pick up |
| `IN PROGRESS` | Active work on a feature branch |
| `DONE` | Completed — will be cleaned up on next review |
| `DEFERRED` | Intentionally postponed (with reason) |
| `DROPPED` | No longer relevant (with reason) |

---

## 1. Inherited from ROADMAP (Unchecked Items)

> These items exist in `ROADMAP.md` but are not yet complete. They are the **highest-priority backlog** since they block version milestones.

### 1.1 Phase 0.7.0 — CLI Runner (1 remaining)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| R-0.7.0-1 | **npm Package** — Publish CLI as `npm install -g redfireforge-cli` | `IN PROGRESS` | `publish-cli.yml` workflow exists and is ready (triggers on `v*` tags or manual dispatch). Package never actually published — needs maintainer to push a version tag or run manually with `NPM_TOKEN` set. As of 2026-08-18 the registry returns 404. |

### 1.2 Phase 0.7.5 — CI/CD Pipeline (8 items, 2 done)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| R-0.7.5-1 | **CI Test Pipeline** — GitHub Actions: `npm test` on every push/PR | `DONE` | `ci.yml` runs `tsc`, ESLint, and unit tests on push to develop/release/feature/hotfix and PRs to develop/release/master. Path-filter jobs for demo hub included. Remaining: E2E headless job and required PR status check configuration (R-0.7.5-2 and R-0.7.5-4). |
| R-0.7.5-2 | **CI E2E Pipeline** — GitHub Actions: Playwright E2E on every PR | `BACKLOG` | Needs headless Playwright job added to `ci.yml` |
| R-0.7.5-3 | **Lint & Type-Check Gate** — `eslint` + `tsc --noEmit` as required PR checks | `DONE` | Pre-commit hook (husky: `tsc -b --noEmit` + `lint-staged`) + CI parallel jobs exist. Remaining: configure as required GitHub branch-protection PR checks (R-0.7.5-4). |
| R-0.7.5-4 | **PR Status Checks** — Require all CI jobs to pass before merge | `BACKLOG` | GitHub branch protection rules |
| R-0.7.5-5 | **GitHub Actions Example for Users** — Ready-to-use CI YAML for RedfireForge CLI | `BACKLOG` | |
| R-0.7.5-6 | **Harness.io Pipeline Example** — Sample Harness pipeline with JUnit + Test Intelligence | `BACKLOG` | |
| R-0.7.5-7 | **Automated Version Tagging** — GitHub Action to create `vX.Y.Z` tags on master merge | `BACKLOG` | |
| R-0.7.5-8 | **Live Demo Deployment** — Auto-deploy web build to Vercel/Netlify on master push | `BACKLOG` | Critical for adoption |

### 1.3 Phase 0.9.1 — Engine Performance (3 remaining)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| R-0.9.1-1 | **Tauri Sidecar Executor** — Rust sidecar (`reqwest` + `tokio`) for 5–10x throughput | `DONE` | Completed Phase 11.5 — full Rust HTTP executor (`reqwest` + `tokio`) with pool/sequential/load-profile modes, validation engine in Rust, 542+ Rust tests; `canUseRustExecutor` auto-detection with JS fallback. |
| R-0.9.1-2 | **Constant Request Rate Mode** — Open model: N RPS regardless of response time | `DONE` | Completed Phase 11.6 — `arrival_executor.rs` with interval-based dispatch, configurable `maxInFlight`, ramp-up, backpressure, cancellation; `droppedRequests`/`peakRps`/`targetRps` on `TestSummary`. |
| R-0.9.1-3 | **Graceful Drain** — Wait for in-flight requests on abort/profile end | `BACKLOG` | Low effort, medium value |

### 1.4 Phase 0.11.0 — Run Comparison & Trends (5 items, 5 done) ✅

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| R-0.11.0-1 | **Run Comparison** — Side-by-side TPS/P95/P99 delta with indicators | `DONE` | `RunComparisonPanel.tsx` with delta badges, colour-coded indicators, `results-comparison-guide.md`. |
| R-0.11.0-2 | **Overlaid Histograms** — Response time distribution overlay | `DONE` | `ResponseTimeOverlayHistogram` imported into `RunComparisonPanel`. |
| R-0.11.0-3 | **Baseline Runs** — Mark run as baseline, auto-compare future runs | `DONE` | `runBaselines.ts` — `BaselineMark`, `markAsBaseline()`, `isBaseline()`, label persistence. |
| R-0.11.0-4 | **Regression Detection** — Alert when P95 increases by X% vs baseline | `DONE` | `RegressionAlert` type; regression banner in `RunComparisonPanel`; configurable threshold. |
| R-0.11.0-5 | **Trend Analysis** — P95 trend across last N runs | `DONE` | `TrendChart` component in `RunComparisonPanel`; `TrendPoint` type in `runBaselines.ts`. |

### 1.5 Phase 1.0.0 — Open-Source Launch (14 items, 0 done)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| R-1.0.0-1 | **LICENSE File** — MIT or Apache-2.0 | `BACKLOG` | |
| R-1.0.0-2 | **CONTRIBUTING.md** — Setup instructions, coding standards, PR process | `BACKLOG` | |
| R-1.0.0-3 | **Issue Templates** — Bug report, feature request | `BACKLOG` | |
| R-1.0.0-4 | **Code of Conduct** — Contributor Covenant | `BACKLOG` | |
| R-1.0.0-5 | **Rebrand Tagline** — "Visual API Testing Workbench" | `BACKLOG` | |
| R-1.0.0-6 | **Logo & Branding** — Professional logo and icon | `BACKLOG` | |
| R-1.0.0-7 | **Documentation Site** — Docusaurus/GitHub Pages with guides, search | `BACKLOG` | |
| R-1.0.0-8 | **Video Walkthrough** — GIF demos, YouTube tutorial | `BACKLOG` | |
| R-1.0.0-9 | **Comparison Table** — vs k6, JMeter, Bruno, Postman, Hoppscotch | `BACKLOG` | |
| R-1.0.0-10 | **Live Demo** — Vercel/Netlify deployment | `BACKLOG` | Same as R-0.7.5-8 |
| R-1.0.0-11 | **README Rewrite** — Concise, GIF-heavy, "try in 10 seconds" | `BACKLOG` | |
| R-1.0.0-12 | **Hacker News Post** — "Show HN" launch | `BACKLOG` | |
| R-1.0.0-13 | **Reddit Posts** — r/webdev, r/node, r/programming, r/QualityAssurance | `BACKLOG` | |
| R-1.0.0-14 | **Dev.to / Hashnode Article** — "Why I built a visual load testing tool" | `BACKLOG` | |

---

## 2. Performance & Engine (Good → Excellent)

> Moving load testing from ~2,000 RPS to 50,000+ RPS.

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| E-1 | **Native Rust Executor** | Full HTTP engine in Rust (`hyper`/`reqwest` + `tokio`). Tauri sidecar with IPC event bridge. 10–50x throughput. | Very High | High | `DONE` — Phase 11.5. `reqwest` + `tokio` async runtime; full Rust validation engine; 542+ Rust tests; JS-side bridge; `canUseRustExecutor` auto-detection. |
| E-2 | **Constant Arrival Rate (Advanced)** | Automatic worker scaling to maintain target RPS. Queue-based dispatching with backpressure. | High | High | `DONE` — Phase 11.6. `arrival_executor.rs`; configurable target RPS, duration, max-in-flight, ramp period; backpressure with dropped-request tracking. |
| E-3 | **Streaming Percentiles** | T-Digest or HDR Histogram for P50/P95/P99 without storing every datapoint. Handles 100K+ results. | Medium | Medium | `DONE` — Phase 11.6. `histogram.rs` using HDR Histogram; P50/P95/P99/P99.9; `p999ResponseTime` on `TestSummary`; 304 Rust tests. |
| E-4 | **Distributed Execution** | Multi-machine load generation via controller/worker architecture. | Very High | Medium | `BACKLOG` |
| E-5 | **Response Streaming** | Stream large response bodies to disk instead of buffering in memory. | Medium | Low | `BACKLOG` |

---

## 3. Run Comparison, Trends & Regression Detection

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| T-1 | **Run Comparison** | Side-by-side comparison of two runs (TPS, P95, P99 deltas, overlaid histograms). | Medium | High | `DONE` — `RunComparisonPanel.tsx`; delta badges with colour indicators; `ResponseTimeOverlayHistogram`; `results-comparison-guide.md`. |
| T-2 | **Baseline Runs** | Mark a run as "baseline" and auto-compare future runs with delta badges. | Medium | High | `DONE` — `runBaselines.ts` with `BaselineMark`, `markAsBaseline()`, `isBaseline()`, label editing; integrated into `RunComparisonPanel`. |
| T-3 | **Regression Detection** | Alert when P95 increases by configurable % vs baseline. CI exit code integration. | Medium | High | `DONE` — `RegressionAlert` type; regression severity banner (warning / critical) in `RunComparisonPanel`; configurable threshold. |
| T-4 | **Trend Analysis** | P95/P99/TPS trend chart across last N runs for same test/workflow. | Medium | Medium | `DONE` — `TrendChart` component; `TrendPoint` type in `runBaselines.ts`. |
| T-5 | **SLA Dashboard** | Definition-first SLA targets; compact bar + tree accordion (pass/warn/fail); per-test/scenario/FG targets; CLI `--fail-on-sla`. | Medium | Medium | `DONE` — All phases complete (original 1–5, Scoped A–E, Per-Test B10–B16, Results Refactor C–D, Code Cleanup CC-1/2/3/5). 109 `slaTargets` tests, 20,221 total tests passing. See [sla-dashboard-plan.md](./sla-dashboard-plan.md). |

---

## 4. Protocol & Format Support

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| P-1 | **GraphQL Support** | Query/mutation builder with schema introspection, variable editor, assertions. | High | High | `DONE` | `src/features/graphql/GraphqlStudioPage.tsx` — full GraphQL Studio with query/mutation builder, schema introspection, variable editor, auth panel, subscriptions, demo bridges, and E2E tests. See `docs/plan/future/graphql/`. |
| P-2 | **gRPC Support** | Protobuf import, unary and streaming calls, proto-based assertions. | High | Medium | `DONE` | `src/features/grpc/GrpcStudioPage.tsx` — full gRPC Studio with proto import, unary/server-streaming/client-streaming/bidi, reflection, assertions, schema diff, load testing. See `docs/plan/future/grpc/`. |
| P-3 | **WebSocket Support** | Connect, send/receive, assert on payloads, measure message latency. | High | Medium | `DONE` | `src/features/websocket/` — WebSocket Studio with connection, send/receive, console, schema validation, filtering, load test, mock server, tabs persistence. |
| P-4 | **JSON Schema Validation** | Validate responses against JSON Schema (draft 2020-12). Auto-generate from samples. | Medium | Medium | `DONE` | `src/features/websocket/wsSchemaValidator.ts` + `WebSocketSchemaPanel.tsx` — JSON Schema validation against WS messages with auto-detect and manual schema editor. |
| P-5 | **Server-Sent Events (SSE)** | Subscribe, assert on event types/payloads, measure delivery latency. | Medium | Low | `DONE` | `src/features/sse/` — SSE Studio with auth panel, connection tab bar, event stream viewer. |
| P-6 | **Kafka Support** | Produce/consume messages, topic management, TLS, SASL auth, workflow nodes. | High | Medium | `DONE` | `src/features/kafka/` — Kafka Studio with cluster editor, body editor, consumer/producer, workflow trigger/produce/consume nodes, TLS/SASL. |

---

## 5. Advanced Workflow Features

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| W-1 | **HAR-to-Workflow Conversion** | Import HAR recordings from browser DevTools → workflow graphs (like `har2locust`). | High | Medium | `BACKLOG` |
| W-2 | **Workflow Templates Gallery** | Pre-built templates for CRUD, OAuth flow, pagination, retry-polling, saga patterns. | Medium | Medium | `DONE` | `src/data/galleries/workflows/` — extensive gallery with HTTP, WebSocket, gRPC, GraphQL, Kafka, SSE, and orchestration samples across all protocols. |
| W-3 | **Sub-Workflow Parameters** | Input/output contracts for sub-workflows. Enables reusable workflow modules. | Medium | Medium | `BACKLOG` |
| W-4 | **Workflow Diff & Merge** | Visual diff of node/edge/variable changes. Three-way merge for collaboration. | High | Low | `BACKLOG` |
| W-5 | **Conditional Retry Node** | Retry failed HTTP nodes N times with configurable delay/backoff (linear, exponential, jitter). | Medium | Medium | `BACKLOG` |
| W-6 | **Data-Driven Workflows** | CSV/JSON data rows → workflow iteration variables. Each row = one workflow execution. | Medium | High | `DONE` | Parameterized test runner (`src/features/scenarios/`) supports CSV/JSON/XLSX data sources feeding scenario variables. See `docs/plan/finished/parameterized-test-plan.md`. |

---

## 6. Extensibility & Integration

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| X-1 | **Plugin API** | Extension points for custom auth, assertions, reporters, node types. | Very High | Medium | `BACKLOG` |
| X-2 | **Pre/Post-Request Scripts** | JS hooks before/after each request. Monaco editor with intellisense. | Medium | Medium | `BACKLOG` |
| X-3 | **Slack/Teams Notifications** | Post results summary to Slack or Teams via webhook. | Low | Medium | `BACKLOG` |
| X-4 | **Datadog/Grafana Export** | Push TPS/P95/error-rate to observability platforms. | Medium | Medium | `BACKLOG` |
| X-5 | **Harness.io Integration** | Pipeline template: run tests → JUnit XML → Test Intelligence → deployment gate. | Medium | Medium | `BACKLOG` |
| X-6 | **Test Tagging & Filtering** | Custom tags (`smoke`, `regression`, `critical`); filter in UI and CLI. | Low | High | `DONE` — `useScenarioTags.ts` (add/remove/bulk/clear, `tagSuggestions`, `tagCounts`); tag pills in Scenario Builder with custom dark dropdown; tag filter in Test Runner and Parameterized Runner; `test-tagging-plan.md` moved to `finished/`. |

---

## 7. User Experience & Polish

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| U-1 | **Real Screenshot Guides** | Replace ASCII diagrams with actual UI screenshots. Auto-capture via Playwright. | Medium | Low | `BACKLOG` |
| U-2 | **Dark Mode** | Full dark theme with toggle and system preference detection. | Medium | Medium | `IN PROGRESS` | 12-theme picker (dark + light variants, accent colours) with toggle in `AppHeader`; `useTheme` hook with localStorage persistence. **Remaining:** `prefers-color-scheme` system preference auto-detection — no implementation found in `src/` yet. |
| U-3 | **Keyboard Shortcuts (Extended)** | Comprehensive shortcuts for common actions (run, save, navigate, search). | Low | Medium | `BACKLOG` |
| U-4 | **Undo/Redo** | Global undo/redo for workflow editor (node add/remove/move, edge changes, properties). | High | Medium | `PARTIAL` | `WorkflowDesignerFlowCanvas.tsx` and `WorkflowCanvasControls.tsx` reference undo/redo UI, but no `useUndo`/`canUndo` hook found — may be ReactFlow built-in history only. Needs audit to confirm scope and completeness. |
| U-5 | **Collaborative Editing** | Multi-user real-time editing via CRDT (Yjs) for workflows and test definitions. | Very High | Low | `BACKLOG` |
| U-6 | **Responsive Mobile View** | Read-only results dashboard for mobile/tablet monitoring. | Medium | Low | `BACKLOG` |
| U-7 | **Multi-Language Support (i18n)** | Internationalization framework for UI strings. Start with English + 1 other language. | Medium | Low | `BACKLOG` |
| U-8 | **Accessibility (a11y) Audit** | WCAG 2.1 AA compliance: keyboard navigation, screen reader labels, color contrast. | Medium | Medium | `BACKLOG` |

---

## 8. Open-Source & Community

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| O-1 | **CI Test Pipeline** | GitHub Actions: unit + E2E + lint + type-check on push/PR. | Medium | Critical | `PARTIAL` | `ci.yml` exists and runs tsc + ESLint + unit tests. E2E job and required branch-protection checks still missing. |
| O-2 | **Live Demo** | Auto-deploy web build to Vercel/Netlify. "Try in 10 seconds" link. | Low | Critical | `BACKLOG` |
| O-3 | **Documentation Site** | Docusaurus or GitHub Pages with guides, screenshots, API reference, search. | Medium | High | `BACKLOG` |
| O-4 | **Branding & Logo** | Professional logo, icon, rebrand tagline. | Low | High | `BACKLOG` |
| O-5 | **README Rewrite** | GIF-heavy, feature screenshots, quick-start, comparison table. | Low | High | `BACKLOG` |
| O-6 | **CONTRIBUTING.md** | Setup, coding standards, PR process, issue templates, Code of Conduct. | Low | High | `BACKLOG` |
| O-7 | **Launch Marketing** | HN, Reddit, Dev.to, YouTube. | Low | Medium | `BACKLOG` |
| O-8 | **npm Package Publish** | Publish `redfireforge-cli` to npm registry. | Low | High | `IN PROGRESS` | `publish-cli.yml` workflow ready; triggered on `v*` tags or manual dispatch. Needs `NPM_TOKEN` secret and a maintainer to initiate first publish. |

---

## 9. Data Mapper & Validation Operator Enhancements

> Migrated from `docs/plan/validation-operator-gap-analysis.md` § 10 — Future Roadmap.

### 9.1 Near-Term (6 months)

| ID | Feature | Adapters Benefiting | Design Impact | Status |
|----|---------|---------------------|---------------|--------|
| DM-1 | **Conditional mappings** | All adapters | `condition?: string` on `Mapping`; conditional badge | `BACKLOG` |
| DM-2 | **Loop/iterate** | `requestBody`, `extraction`, `populate` | Loop node in target tree | `BACKLOG` |
| DM-3 | **Default values / fallback** | `extraction`, `variableBinding`, `requestBody` | `fallback?: string` on `Mapping` | `BACKLOG` |
| DM-4 | **Multi-source merge** | `variableBinding`, `requestBody` | Already supported via multi-source tabs | `BACKLOG` |
| DM-5 | **Type coercion declarations** | All adapters | Explicit coercion pill | `BACKLOG` |
| DM-6 | **Expression templates** | All adapters | Expression library panel | `BACKLOG` |

### 9.2 Mid-Term (6–12 months)

| ID | Feature | Adapters Benefiting | Design Impact | Status |
|----|---------|---------------------|---------------|--------|
| DM-7 | **GraphQL field selection** | New `graphqlAdapter` | Target tree = GraphQL schema | `BACKLOG` |
| DM-8 | **Database mapper** | New `dbResultAdapter` | Source = SQL result set | `BACKLOG` |
| DM-9 | **AI/LLM prompt template** | New `promptAdapter` | Source = context vars; target = prompt slots | `BACKLOG` |
| DM-10 | **gRPC/protobuf mapping** | New `grpcAdapter` | Target tree from .proto schema | `BACKLOG` |
| DM-11 | **WebSocket message mapping** | New `wsExtractionAdapter` | Similar to webhook extraction | `BACKLOG` |
| DM-12 | **File content mapping** | New `fileFormatAdapter` | CSV/XML/YAML → JSON | `BACKLOG` |

### 9.3 Long-Term (12+ months)

| ID | Feature | Adapters Benefiting | Design Impact | Status |
|----|---------|---------------------|---------------|--------|
| DM-13 | **Data flow visualization** | All workflow adapters | End-to-end data lineage canvas | `BACKLOG` |
| DM-14 | **Schema evolution tracking** | All HTTP adapters | Time-series schema diff | `BACKLOG` |
| DM-15 | **AI-assisted mapping** | All adapters | LLM-powered "Suggest" button | `BACKLOG` |
| DM-16 | **Custom operator plugins** | `validationAdapter` | Plugin registration API | `BACKLOG` |
| DM-17 | **Cross-adapter references** | Workflow chains | Inter-adapter dependency graph | `BACKLOG` |

---

## 10. Ideas & Suggestions (Unstructured)

> Drop ideas here as they come up. Periodically review and promote to a numbered section above.

| Date | Source | Idea | Promoted To |
|------|--------|------|-------------|
| 2026-05-07 | Plan review | Tauri desktop CLI `--cli` should support all Node CLI options | **DONE** (fixed 2026-05-07) |
| 2026-05-07 | Plan review | `workflow-cli-conditional.yaml` missing edges | **DONE** (fixed 2026-05-07) |
| 2026-05-07 | Plan review | `run-basic-test.sh` missing `mkdir -p results` | **DONE** (fixed 2026-05-07) |
| 2026-05-20 | Feature branch | Trash Box — soft-delete & recovery (FG/Scenario/Test/SDS → trash, 5s undo toast, Trash Panel with restore/permanent-delete/empty, configurable retention 7–90 days, max items 50–200, auto-purge on startup, IDB + localStorage + Tauri FS dual-mode storage, gallery sample + training manual + user guide) | **DONE** (2026-05-20) |

---

## Prioritized Implementation Order (Suggested)

```
━━━ Critical Path to Launch ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ① O-2   Live Demo                     — deploy to Vercel/Netlify
  ② O-8   npm Package Publish           — trigger first CLI release (workflow ready)
  ③ R-0.7.5-2  CI E2E Pipeline          — add Playwright headless job to ci.yml
  ④ R-0.7.5-4  PR Status Checks         — configure branch protection rules
  ⑤ O-5   README Rewrite               — first impression
  ⑥ O-6   CONTRIBUTING.md              — contributor onboarding
  ⑦ R-1.0.0-1  LICENSE File             — required for open-source

━━━ High Value, Moderate Effort ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⑧ U-2   System Preference Detection   — complete dark mode (auto-theme)
  ⑨ U-4   Undo/Redo                    — audit ReactFlow history scope
  ⑩ W-3   Sub-Workflow Parameters      — reusable sub-workflow I/O contracts
  ⑪ O-3   Documentation Site           — community growth

━━━ Already DONE (remove on next cleanup) ━━━━━━━━━━━━━━━━━
  ✅ P-1   GraphQL Support (full studio)
  ✅ P-2   gRPC Support (full studio)
  ✅ P-3   WebSocket Support (full studio)
  ✅ P-4   JSON Schema Validation (WebSocket)
  ✅ P-5   SSE Support (full studio)
  ✅ P-6   Kafka Support (full studio + workflow nodes)
  ✅ W-2   Workflow Templates Gallery
  ✅ W-6   Data-Driven Workflows (parameterized runner)
  ✅ X-6   Test Tagging & Filtering
  ✅ T-1   Run Comparison
  ✅ T-2   Baseline Runs
  ✅ T-3   Regression Detection
  ✅ T-4   Trend Analysis
  ✅ T-5   SLA Dashboard
  ✅ E-1   Native Rust Executor
  ✅ E-2   Constant Arrival Rate
  ✅ E-3   Streaming Percentiles
  ✅ R-0.7.5-1  CI Test Pipeline (unit + lint + tsc)
  ✅ R-0.7.5-3  Lint & Type-Check Gate
  ✅ R-0.9.1-1  Tauri Sidecar Executor
  ✅ R-0.9.1-2  Constant Request Rate Mode
  ✅ R-0.11.0-1–5  All Run Comparison & Trend items

━━━ Architecture Leaps ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⑫ E-4   Distributed Execution         — enterprise scale
  ⑬ X-1   Plugin API                    — ecosystem growth
  ⑭ W-1   HAR-to-Workflow Conversion    — DevTools import

━━━ Long Term ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⑮ U-5   Collaborative Editing         — team features
  ⑯ E-5   Response Streaming            — large body handling
  ⑰ U-7   i18n                          — multi-language support
```

---

## 11. SLA Configuration Architecture Refactor

> **Added: 2026-05-24** | **Details:** [sla-dashboard-plan.md § 12](./sla-dashboard-plan.md#3-active-plan--definition-first-architecture-refactor)

**Problem**: SLA targets are configured post-run in Results — architecturally inverted. SLA is a pre-run acceptance criterion, not a post-hoc observation. Industry tools (k6, Gatling, Artillery) all co-locate thresholds with the test definition.

**Decision (2026-05-24)**: Option 1 — definition-first. `TestScenario.slaTargets[]` is the primary home. Runner provides environment-specific override only. See [sla-dashboard-plan.md § 12](./sla-dashboard-plan.md#3-active-plan--definition-first-architecture-refactor) for full detail.

| Phase | Status | Summary |
|-------|--------|---------|
| Phase A — Workflow Definition SLA | `DONE` | `WorkflowSlaPanel`, `SlaTargetEditor` extracted, scope badges |
| Phase B — TestScenario/FeatureGroup SLA | `DONE` | Per-test 🎯 button + `TestSlaModal`, `ScenarioSlaPanel` summary table, runner auto-collect + override panel |
| Phase C — Results SLA Display Refactor | `DONE` | `SlaCompactBar` replaces `SlaDashboard`; `SlaStatusAccordion` Feature→Scenario→Test tree |
| Phase D — Results UI Polish | `DONE` | Read-only label, inline save confirmation, ⚗ Ad-hoc indicator |
| Phase E — Migration & CLI | `DONE` | `--sla-config` / `--fail-on-sla` CLI flags (exit code 3); legacy migration code removed |
| Code Cleanup (CC-1/2/3/5) | `DONE` | Removed `scope='workflow'`, workflow localStorage, migration banner, `SlaDashboard.tsx` |

---

## Maintenance Notes

- **When archiving a plan:** Move unchecked items to the appropriate section above.
- **When starting a feature:** Change status to `IN PROGRESS` and note the branch name.
- **When completing a feature:** Change status to `DONE` with date. Remove on next cleanup.
- **Quarterly review:** Re-prioritize items based on user feedback and competitive landscape.

---

_Created: 2026-05-07 | Last updated: 2026-05-24 (Phase B rewrite: definition-first architecture)_
_Related: [ROADMAP.md](../../ROADMAP.md) · [workflow-harness-integration-plan.md](./workflow-harness-integration-plan.md) · [validation-operator-gap-analysis.md](./validation-operator-gap-analysis.md)_
