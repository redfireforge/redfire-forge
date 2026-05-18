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
| R-0.7.0-1 | **npm Package** — Publish CLI as `npm install -g redfireforge-cli` | `BACKLOG` | Package structure ready (`cli/package.json`, build script, GitHub Actions workflow). Needs actual npm publish with `NPM_TOKEN`. |

### 1.2 Phase 0.7.5 — CI/CD Pipeline (8 items, 0 done)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| R-0.7.5-1 | **CI Test Pipeline** — GitHub Actions: `npm test` on every push/PR | `BACKLOG` | Critical for open-source launch |
| R-0.7.5-2 | **CI E2E Pipeline** — GitHub Actions: Playwright E2E on every PR | `BACKLOG` | Needs headless browser in CI |
| R-0.7.5-3 | **Lint & Type-Check Gate** — `eslint` + `tsc --noEmit` as required PR checks | `BACKLOG` | |
| R-0.7.5-4 | **PR Status Checks** — Require all CI jobs to pass before merge | `BACKLOG` | GitHub branch protection rules |
| R-0.7.5-5 | **GitHub Actions Example for Users** — Ready-to-use CI YAML for RedfireForge CLI | `BACKLOG` | |
| R-0.7.5-6 | **Harness.io Pipeline Example** — Sample Harness pipeline with JUnit + Test Intelligence | `BACKLOG` | |
| R-0.7.5-7 | **Automated Version Tagging** — GitHub Action to create `vX.Y.Z` tags on master merge | `BACKLOG` | |
| R-0.7.5-8 | **Live Demo Deployment** — Auto-deploy web build to Vercel/Netlify on master push | `BACKLOG` | Critical for adoption |

### 1.3 Phase 0.9.1 — Engine Performance (3 remaining)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| R-0.9.1-1 | **Tauri Sidecar Executor** — Rust sidecar (`reqwest` + `tokio`) for 5–10x throughput | `BACKLOG` | Depends on Tauri v2 sidecar API |
| R-0.9.1-2 | **Constant Request Rate Mode** — Open model: N RPS regardless of response time | `BACKLOG` | k6's killer feature |
| R-0.9.1-3 | **Graceful Drain** — Wait for in-flight requests on abort/profile end | `BACKLOG` | Low effort, medium value |

### 1.4 Phase 0.11.0 — Run Comparison & Trends (5 items, 0 done)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| R-0.11.0-1 | **Run Comparison** — Side-by-side TPS/P95/P99 delta with indicators | `BACKLOG` | Most-requested analytics feature |
| R-0.11.0-2 | **Overlaid Histograms** — Response time distribution overlay | `BACKLOG` | |
| R-0.11.0-3 | **Baseline Runs** — Mark run as baseline, auto-compare future runs | `BACKLOG` | |
| R-0.11.0-4 | **Regression Detection** — Alert when P95 increases by X% vs baseline | `BACKLOG` | Integrates with CI exit codes |
| R-0.11.0-5 | **Trend Analysis** — P95 trend across last N runs | `BACKLOG` | |

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
| E-1 | **Native Rust Executor** | Full HTTP engine in Rust (`hyper`/`reqwest` + `tokio`). Tauri sidecar with IPC event bridge. 10–50x throughput. | Very High | High | `BACKLOG` |
| E-2 | **Constant Arrival Rate (Advanced)** | Automatic worker scaling to maintain target RPS. Queue-based dispatching with backpressure. | High | High | `BACKLOG` |
| E-3 | **Streaming Percentiles** | T-Digest or HDR Histogram for P50/P95/P99 without storing every datapoint. Handles 100K+ results. | Medium | Medium | `BACKLOG` |
| E-4 | **Distributed Execution** | Multi-machine load generation via controller/worker architecture. | Very High | Medium | `BACKLOG` |
| E-5 | **Response Streaming** | Stream large response bodies to disk instead of buffering in memory. | Medium | Low | `BACKLOG` |

---

## 3. Run Comparison, Trends & Regression Detection

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| T-1 | **Run Comparison** | Side-by-side comparison of two runs (TPS, P95, P99 deltas, overlaid histograms). | Medium | High | `BACKLOG` |
| T-2 | **Baseline Runs** | Mark a run as "baseline" and auto-compare future runs with delta badges. | Medium | High | `BACKLOG` |
| T-3 | **Regression Detection** | Alert when P95 increases by configurable % vs baseline. CI exit code integration. | Medium | High | `BACKLOG` |
| T-4 | **Trend Analysis** | P95/P99/TPS trend chart across last N runs for same test/workflow. | Medium | Medium | `BACKLOG` |
| T-5 | **SLA Dashboard** | Persistent SLA targets; traffic light dashboard (pass/warn/fail). | Medium | Medium | `BACKLOG` |

---

## 4. Protocol & Format Support

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| P-1 | **GraphQL Support** | Query/mutation builder with schema introspection, variable editor, assertions. | High | High | `BACKLOG` |
| P-2 | **gRPC Support** | Protobuf import, unary and streaming calls, proto-based assertions. | High | Medium | `BACKLOG` |
| P-3 | **WebSocket Support** | Connect, send/receive, assert on payloads, measure message latency. | High | Medium | `BACKLOG` |
| P-4 | **JSON Schema Validation** | Validate responses against JSON Schema (draft 2020-12). Auto-generate from samples. | Medium | Medium | `BACKLOG` |
| P-5 | **Server-Sent Events (SSE)** | Subscribe, assert on event types/payloads, measure delivery latency. | Medium | Low | `BACKLOG` |

---

## 5. Advanced Workflow Features

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| W-1 | **HAR-to-Workflow Conversion** | Import HAR recordings from browser DevTools → workflow graphs (like `har2locust`). | High | Medium | `BACKLOG` |
| W-2 | **Workflow Templates Gallery** | Pre-built templates for CRUD, OAuth flow, pagination, retry-polling, saga patterns. | Medium | Medium | `BACKLOG` |
| W-3 | **Sub-Workflow Parameters** | Input/output contracts for sub-workflows. Enables reusable workflow modules. | Medium | Medium | `BACKLOG` |
| W-4 | **Workflow Diff & Merge** | Visual diff of node/edge/variable changes. Three-way merge for collaboration. | High | Low | `BACKLOG` |
| W-5 | **Conditional Retry Node** | Retry failed HTTP nodes N times with configurable delay/backoff (linear, exponential, jitter). | Medium | Medium | `BACKLOG` |
| W-6 | **Data-Driven Workflows** | CSV/JSON data rows → workflow iteration variables. Each row = one workflow execution. | Medium | High | `BACKLOG` |

---

## 6. Extensibility & Integration

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| X-1 | **Plugin API** | Extension points for custom auth, assertions, reporters, node types. | Very High | Medium | `BACKLOG` |
| X-2 | **Pre/Post-Request Scripts** | JS hooks before/after each request. Monaco editor with intellisense. | Medium | Medium | `BACKLOG` |
| X-3 | **Slack/Teams Notifications** | Post results summary to Slack or Teams via webhook. | Low | Medium | `BACKLOG` |
| X-4 | **Datadog/Grafana Export** | Push TPS/P95/error-rate to observability platforms. | Medium | Medium | `BACKLOG` |
| X-5 | **Harness.io Integration** | Pipeline template: run tests → JUnit XML → Test Intelligence → deployment gate. | Medium | Medium | `BACKLOG` |
| X-6 | **Test Tagging & Filtering** | Custom tags (`smoke`, `regression`, `critical`); filter in UI and CLI. | Low | High | `BACKLOG` |

---

## 7. User Experience & Polish

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| U-1 | **Real Screenshot Guides** | Replace ASCII diagrams with actual UI screenshots. Auto-capture via Playwright. | Medium | Low | `BACKLOG` |
| U-2 | **Dark Mode** | Full dark theme with toggle and system preference detection. | Medium | Medium | `BACKLOG` |
| U-3 | **Keyboard Shortcuts (Extended)** | Comprehensive shortcuts for common actions (run, save, navigate, search). | Low | Medium | `BACKLOG` |
| U-4 | **Undo/Redo** | Global undo/redo for workflow editor (node add/remove/move, edge changes, properties). | High | Medium | `BACKLOG` |
| U-5 | **Collaborative Editing** | Multi-user real-time editing via CRDT (Yjs) for workflows and test definitions. | Very High | Low | `BACKLOG` |
| U-6 | **Responsive Mobile View** | Read-only results dashboard for mobile/tablet monitoring. | Medium | Low | `BACKLOG` |
| U-7 | **Multi-Language Support (i18n)** | Internationalization framework for UI strings. Start with English + 1 other language. | Medium | Low | `BACKLOG` |
| U-8 | **Accessibility (a11y) Audit** | WCAG 2.1 AA compliance: keyboard navigation, screen reader labels, color contrast. | Medium | Medium | `BACKLOG` |

---

## 8. Open-Source & Community

| ID | Feature | Description | Complexity | Priority | Status |
|----|---------|-------------|------------|----------|--------|
| O-1 | **CI Test Pipeline** | GitHub Actions: unit + E2E + lint + type-check on push/PR. | Medium | Critical | `BACKLOG` |
| O-2 | **Live Demo** | Auto-deploy web build to Vercel/Netlify. "Try in 10 seconds" link. | Low | Critical | `BACKLOG` |
| O-3 | **Documentation Site** | Docusaurus or GitHub Pages with guides, screenshots, API reference, search. | Medium | High | `BACKLOG` |
| O-4 | **Branding & Logo** | Professional logo, icon, rebrand tagline. | Low | High | `BACKLOG` |
| O-5 | **README Rewrite** | GIF-heavy, feature screenshots, quick-start, comparison table. | Low | High | `BACKLOG` |
| O-6 | **CONTRIBUTING.md** | Setup, coding standards, PR process, issue templates, Code of Conduct. | Low | High | `BACKLOG` |
| O-7 | **Launch Marketing** | HN, Reddit, Dev.to, YouTube. | Low | Medium | `BACKLOG` |
| O-8 | **npm Package Publish** | Publish `redfireforge-cli` to npm registry. | Low | High | `BACKLOG` |

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
| | | | |

---

## Prioritized Implementation Order (Suggested)

```
━━━ Critical Path to Launch ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ① O-1   CI Test Pipeline              — gate for open-source
  ② O-2   Live Demo                     — gate for adoption
  ③ O-8   npm Package Publish           — unblocks CLI distribution
  ④ O-5   README Rewrite                — first impression
  ⑤ O-6   CONTRIBUTING.md               — contributor onboarding

━━━ High Value, Moderate Effort ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⑥ T-1   Run Comparison                — most-requested feature
  ⑦ X-6   Test Tagging & Filtering      — low effort, high value
  ⑧ W-6   Data-Driven Workflows         — unlock parameterized workflows
  ⑨ T-2   Baseline Runs                 — regression workflow
  ⑩ T-3   Regression Detection          — CI/CD quality gate

━━━ Architecture Leaps ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⑪ E-1   Native Rust Executor          — Good → Excellent
  ⑫ E-2   Constant Arrival Rate         — k6 parity
  ⑬ P-1   GraphQL Support               — expand protocol coverage
  ⑭ O-3   Documentation Site            — community growth

━━━ Long Term ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⑮ E-4   Distributed Execution         — enterprise scale
  ⑯ X-1   Plugin API                    — ecosystem growth
  ⑰ P-2   gRPC Support                  — microservice testing
  ⑱ U-4   Undo/Redo                     — workflow UX
  ⑲ U-5   Collaborative Editing         — team features
```

---

## Maintenance Notes

- **When archiving a plan:** Move unchecked items to the appropriate section above.
- **When starting a feature:** Change status to `IN PROGRESS` and note the branch name.
- **When completing a feature:** Change status to `DONE` with date. Remove on next cleanup.
- **Quarterly review:** Re-prioritize items based on user feedback and competitive landscape.

---

_Created: 2026-05-07 | Last updated: 2026-05-14_
_Related: [ROADMAP.md](../../ROADMAP.md) · [workflow-harness-integration-plan.md](./workflow-harness-integration-plan.md) · [validation-operator-gap-analysis.md](./validation-operator-gap-analysis.md)_
