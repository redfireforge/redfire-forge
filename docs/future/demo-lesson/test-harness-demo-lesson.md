# Test Harness Demo Lessons — Comprehensive Plan

> **Domain:** `harness`
> **Status:** New — fills the empty `harnessDomain` (currently `available: false`)

---

## Design Philosophy

These lessons teach the **Test Harness from the ground up** — from creating your first Feature Group and writing assertions, to running load profiles and analyzing results. The viewer learns by watching real test authoring, execution, and analysis against live public APIs.

**Key principles:**
- Every test is **authored live** during the demo — not imported from gallery (except TH-1 overview)
- All HTTP calls target **JSONPlaceholder** and **DummyJSON** APIs (CORS-friendly, reliable, no auth needed for basics)
- Each lesson **builds on the prior one's knowledge** but can stand alone via `preAction` guards
- The focus is on **core Test Harness concepts** — scenario authoring, validation, runners, results, and data-driven testing
- Promotion from Requests/Catalog is already covered by **REQ-5** (`req-send-harness`) and **CAT-3** (`cat-export-requests`) — these lessons start from inside the Harness domain itself
- Protocol-specific harness usage (Kafka/WS/gRPC runners) has dedicated protocol lessons — these lessons cover **HTTP** and the **universal features** that apply to all protocols

---

## Current Coverage Gaps

The existing demo lessons that touch Harness:

| Lesson | Domain | What it covers |
|--------|--------|----------------|
| **REQ-5** `req-send-harness` | API | 2-step promotion wizard, IN HARNESS badge, Feature Groups tree, Test Editor (brief) |
| **CAT-3** `cat-export-requests` | Catalog | Send to Harness from Try It Out, target cascade |
| Protocol runners (WS/Kafka/GQL/gRPC) | Protocols | Workflow Runner only (select workflow, run, Results) |

**What's completely missing:** Feature Group authoring from scratch, Test Editor deep dive (all 8 tabs), validation modes and assertions, standard Test Runner (execution modes, load profiles), Parameterized Runner, data sources, Shared Data Sources, Results Dashboard analysis, SLA configuration, Trash & Recovery, run comparison, and baselines.

The `harnessDomain` is registered but has zero lessons — despite 40+ training manuals and 21 gallery samples existing for the Tests training path.

---

## Lesson Summary

| # | ID | Title | Steps | Est. Time | Key Features Covered |
|---|---|---|---|---|---|
| TH-1 | `th-overview-structure` | Harness Overview & Structure | 5 | 5 min | Domain tabs, env/svc scoping, FG hierarchy, import from gallery, tree navigation |
| TH-2 | `th-author-tests` | Author Your First Tests | 6 | 6 min | Create FG, create scenario, create test (URL/method/headers/body), Test Editor tabs tour, fetch response, save |
| TH-3 | `th-validation-assertions` | Validation & Assertions | 7 | 8 min | Validation modes (none/selective/full), expected fields, field operators, assertion presets, Data Mapper, Verify panel |
| TH-4 | `th-test-runner` | The Test Runner | 6 | 6 min | Host selector, execution modes, concurrency, iterations, execution plan, run, live progress, stop |
| TH-5 | `th-data-sources` | Data Source Authoring | 7 | 7 min | Data tab, parameterize wizard, column types (path/param/body/header/validate), add/edit rows, tags, CSV import, Shared Data Sources |
| TH-6 | `th-parameterized-runner` | The Parameterized Runner | 8 | 9 min | Parameterized Runner tab, scenario filter, row count badges, execution plan (iterations × rows), tag filter, run, per-row live progress, re-run failed rows, data row results analysis |
| TH-7 | `th-results-analysis` | Results & Analysis | 6 | 6 min | Results Dashboard, metrics cards, waterfall, grouping, SLA, baselines, run comparison, export |
| TH-8 | `th-load-testing` | Load Profiles & Performance | 5 | 5 min | Load profile modes (ramp-up, sustained, spike), constant arrival rate, think time, error policies, performance regression |
| TH-9 | `th-advanced-features` | Advanced: Versioning, Trash & Organization | 5 | 5 min | Test versioning, tags, structure log, Trash/Undo, search, move/copy |
| TH-10 | `th-assertions-deep-dive` | Assertions Deep Dive | 7 | 8 min | All 6 assertion categories (Response, Field, Array, Schema, WS, Kafka), NOT modifier, 24+ types, Presets, Generate from Response, Regex Builder |
| TH-11 | `th-data-mapper-validation` | Data Mapper for Validation | 8 | 9 min | Source/Target panels, auto-map (coverage %), drag-to-map, operator pills, custom predicates, Code/Preview/Table/Rules views, subtree ops, Verify All, Fetch & Verify |
| TH-12 | `th-validation-versioning` | Validation Versioning | 6 | 6 min | Response Versions (save/preview/restore/delete/compare), Rules Versions, version badges, version diff, baseline tracking |
| TH-13 | `th-sla-configuration` | SLA Targets & Acceptance Criteria | 7 | 7 min | SLA Targets modal (test-level), 7 metrics (P50/P95/P99/P99.9/Avg/TPS/Error Rate), scope levels (aggregate/scenario/FG), warn thresholds, Scenario SLA summary, Runner SLA overrides, Results SLA evaluation (pass/warn/fail) |
| TH-14 | `th-auth-inheritance` | Auth & Inheritance Chain | 7 | 7 min | 7 auth types (none/inherit/basic/bearer/apikey/digest/OAuth2), 4-level inheritance (test→scenario→FG→global profile), effective auth badge, verify auth, show/hide secrets, global auth profiles |
| TH-15 | `th-import-export-curl` | Import, Export & cURL | 7 | 7 min | cURL Import/Export (with OAuth2 tokens), FG/scenario/test JSON export with version checkboxes, CSV/Excel/JSON template import wizard, results import, auto-report |
| TH-16 | `th-advanced-search` | Advanced Search & Drag-Drop | 6 | 6 min | Query syntax (AND/OR/NOT, parentheses, phrases), search across all fields, match count, drag-drop reorder (scenarios/tests), copy/move modals |
| TH-17 | `th-mapper-expressions-dsl` | Data Mapper Expressions & DSL Editor | 8 | 9 min | Expression editor (Monaco), function catalog, live preview, step-through debugger, expression snippets, DSL editor with syntax highlighting/autocomplete, DSL Reference Panel (39 entries), visual↔code sync |
| TH-18 | `th-data-source-advanced` | Data Source Advanced Features | 5 | 6 min | Validate column, row detail modal, verify all modal, validation contract panel, Data Mapper integrations, row distribution and validation modes |
| TH-19 | `th-schema-drift-repair` | Schema Drift & Contract Testing | 6 | 6 min | Schema snapshots, drift detection (added/removed/type changes), severity classification, drift banner, diff modal with repair suggestions, schema contract modes (strict/lenient lock), mapping health dashboard |
| TH-20 | `th-baseline-regression` | Baseline & Regression Analysis | 6 | 6 min | Baseline management (mark/unmark/rename/list), regression thresholds (configurable warn/critical), regression status per run, trend charts, per-scenario trends, comparison report export (JSON/Markdown), overlay histograms |
| TH-21 | `th-workflow-runner` | The Workflow Runner | 7 | 8 min | Workflow picker (searchable tree), variables editor, trace options, run config presets (save/load), correlation wait config, multi-webhook testing panel, webhook load driver, live progress |
| **Total** | | | **144** | **~150 min** | |

---

## Prerequisite: Seeded Data

- **TH-1** uses a gallery import (JSONPlaceholder smoke test)
- **TH-2 through TH-8** seed minimal Feature Groups / scenarios programmatically via `useDemoHarnessBridge` and `preAction` guards
- All lessons require an **Environment** + **Microservice** already configured (seeded by lesson `setup`)
- Public APIs used:
  - `https://jsonplaceholder.typicode.com` — simple CRUD (posts, users, comments)
  - `https://dummyjson.com` — richer responses (products, auth, pagination)

---

## TH-1: Harness Overview & Structure

**Goal:** Understand the Testing domain layout — the 5 sub-navigation tabs, how Feature Groups organize tests, how env/svc scoping works, and how to import tests from the Gallery.

| Field | Value |
|---|---|
| `id` | `th-overview-structure` |
| `estimatedMinutes` | 6 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios', 'runner', 'param-runner', 'workflow-runner', 'results']` |

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th1-domain-tour` | The Testing Domain | `.sub-nav-tabs` | Navigate to **Testing** in the activity bar → spotlight the **sub-nav bar** showing all 5 tabs at once: Feature Groups, Test Runner, Parameterized Runner, Workflow Runner, Results (1500ms, explain: Feature Groups is where you author and organize tests, the three runners execute them in different modes, and Results stores all run history) |
| 2 | `th1-env-scope` | Environment & Microservice Scoping | `APP.HEADER_ENV_SELECT` | Spotlight the **Environment** selector in the header (1200ms, explain: tests are scoped to an environment + microservice pair) → spotlight the **Microservice** selector (1200ms, explain: switch microservice to see different test suites — each microservice has its own Feature Groups) → spotlight the empty Feature Groups area below (1000ms, explain: this is where your test hierarchy will appear once you create content) |
| 3 | `th1-seed-tests` | A Pre-Built Test Suite | `HAR.FG_CARD` | A pre-configured Feature Group "User API Tests" appears in the tree (seeded programmatically) → spotlight the new **Feature Group card** (1500ms, explain: Feature Groups are the top-level organizer — group tests by API area, business domain, or team ownership. You can create them manually or import them from JSON files) |
| 4 | `th1-tree-nav` | Navigate the Test Hierarchy | `HAR.FG_EXPAND` | Click to **expand** the Feature Group → spotlight the **Scenario** container with its kind badge "Standard" and test count (1200ms) → click to expand the scenario → spotlight the individual **test cards**: method badge (GET/POST), test name, and status indicators (1500ms, explain: the hierarchy is Feature Group → Scenario → Tests. Each test defines one HTTP request with its URL, method, headers, body, and validation rules) |
| 5 | `th1-tabs-preview` | Preview Runner & Results | `[data-testid="nav-tab-runner"]` | Click **Test Runner** tab → spotlight the runner page with host selector and execution config (1200ms, explain: this is where you execute your test suites — configure iterations, concurrency, and watch live progress) → click **Results** tab → spotlight the empty results dashboard (1000ms, explain: run history, metrics, SLA evaluation, and baseline comparisons all live here) → return to **Feature Groups** |

**Cleanup:** Delete imported gallery sample. Reset env/svc to demo defaults.

---

## TH-2: Author Your First Tests

**Goal:** Create a Feature Group, add a Test Scenario, and write individual tests from scratch — learn the Test Editor's 8 tabs and how to configure HTTP requests.

| Field | Value |
|---|---|
| `id` | `th-author-tests` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th2-create-fg` | Create a Feature Group | `HAR.ADD_FG_BTN` | Click **+ Add Feature Group** → type "JSONPlaceholder API" → confirm (Enter) → spotlight the new FG card with expand arrow and action buttons (1200ms, explain: Feature Groups organize tests by API area or business capability) |
| 2 | `th2-create-scenario` | Create a Test Scenario | `HAR.ADD_SCENARIO_BTN` | Click **+ Scenario** within the FG → type "User Endpoints" → confirm → spotlight the scenario card (1500ms, explain: Standard scenarios run each test once per iteration; Parameterized scenarios run tests once per data row) |
| 3 | `th2-open-editor` | Open the Test Editor | `HAR.ADD_TEST_BTN` | Click **+ Test** → spotlight the **Test Editor** property card (1500ms): Name, Transport, URL, Method → spotlight the **tab bar** (1200ms): Params, Auth, Headers, Validation, Extract |
| 4 | `th2-configure-request` | Configure the HTTP Request | `HAR.TE_URL_INPUT` | Spotlight **URL** field (800ms) → type `https://jsonplaceholder.typicode.com/users/1` → spotlight **Name** field (600ms) → type "Get User by ID" → switch to **Headers** tab → spotlight headers section (600ms) → fill `Accept: application/json` |
| 5 | `th2-fetch-response` | Fetch a Sample Response | `HAR.TE_TABS` | Switch to **Validation** tab → select **Selective Fields** mode → spotlight **Fetch Response** button (1000ms) → click Fetch → wait for response → spotlight **response preview** (2000ms) |
| 6 | `th2-save-test` | Save and See the Tree | `HAR.TEST_CARD` | Click **Save** in the editor header → modal closes → spotlight the new test row in the tree: **GET** badge + "Get User by ID" (1200ms) |

**Cleanup:** Deletes the "JSONPlaceholder API" FG on exit/restart. TH-3 relies on its own `preAction` seeding.

---

## TH-3: Validation & Assertions

**Goal:** Add validation rules to tests — understand the three validation modes, add assertions (status code, response time), see the sample response and Data Mapper entry point, and verify rules against a live response. This is the overview lesson; see **TH-10** (Assertions Deep Dive), **TH-11** (Data Mapper), and **TH-12** (Validation Versioning) for dedicated deep dives.

| Field | Value |
|---|---|
| `id` | `th-validation-assertions` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG with "User Endpoints" scenario containing a GET /users/1 test with `validation.mode: 'selective'` and `validation.sampleJson` pre-populated (simulating a previously fetched response). No assertions or expected fields yet.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th3-modes` | Three Validation Modes | `HAR.TE_RADIO_GROUP` | Open the seeded test (click Edit) → navigate to **Validation** tab → spotlight the **3 radio modes** (1200ms): **No Body Validation** (assertions only), **Full JSON Match** (deep comparison), **Selective Fields** (check specific fields) → explain Selective is the most common choice |
| 2 | `th3-add-status` | Add a Status Code Assertion | `HAR.TE_ASSERTIONS_ADD_BTN` | Spotlight the **+ Add** button in the Assertions section → click → spotlight the **categorized assertion menu** (1200ms): Response, Field Validation, Array & Structure, Schema & Advanced → click **Status Code** → assertion row appears with input pre-filled "200" → close menu → spotlight the new assertion row (1200ms) |
| 3 | `th3-add-timing` | Add a Response Time Assertion | `HAR.TE_ASSERTIONS_LIST` | Click **+ Add** again → click **Response Time SLA** → row appears with max ms input showing "500" → close menu → spotlight both assertion rows (1500ms, explain: assertions run on every request regardless of body validation mode — they check HTTP-level properties) |
| 4 | `th3-response-preview` | Sample Response & Data Mapper | `HAR.TE_RESPONSE_PREVIEW` | Spotlight the **response preview** panel showing the fetched JSON (1500ms, explain: this is the captured sample used to build field-level rules) → spotlight the **⚡ Data Mapper** button (1000ms, explain: the Data Mapper lets you visually create field validation rules by mapping source paths to operators — deep dive in TH-11) |
| 5 | `th3-verify` | Verify Against Live Response | `HAR.TE_VERIFY_BTN` | Spotlight the **Verify** button (800ms) → click → verification runs against the live API → spotlight the **result summary** showing pass/fail badges (1500ms, explain: Verify sends the request and evaluates all assertions — use it to test your rules before running the full suite) |
| 6 | `th3-save` | Save the Validated Test | `HAR.TEST_CARD` | Click **Save** → modal closes → spotlight the test card in the tree showing validation indicators (1200ms) |

**Cleanup:** Deletes the seeded FG on exit/restart. TH-4 relies on its own `preAction` seeding.

---

## TH-4: The Test Runner

**Goal:** Execute tests using the standard Test Runner — configure the host, choose an execution mode, set iterations, preview the execution plan, run, and monitor live progress.

| Field | Value |
|---|---|
| `id` | `th-test-runner` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `runner` |
| `allowedTabs` | `['scenarios', 'runner', 'results']` |

**Prerequisite:** Seeded FG "Runner Demo" with a standard scenario containing 3 tests: GET /users (status 200), GET /users/1 (status 200), POST /users (status 201) — all with response time assertion (max 5000ms). URLs are absolute jsonplaceholder.typicode.com.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th4-host-selector` | Host Configuration | `HAR.HOST_SELECTOR` | Spotlight the **Host Selector** at the top (1500ms) — three radio modes: **Original** (uses URLs as authored — correct for absolute jsonplaceholder URLs), **Settings** (replaces host with the microservice's base URL from Settings), **Custom** (enter an override URL). Explain: since our tests use absolute URLs, Original is the right choice |
| 2 | `th4-execution-config` | Execution Mode & Concurrency | `HAR.EXEC_CONFIG` | Spotlight the **Execution Mode** radios (1200ms): Sequential, Batch, Continuous Pool, Load Profile, Constant Arrival — Batch is selected by default (fires N requests, waits for all, then fires next N). Spotlight the **Iterations** input → set to **2** (1000ms, explain: each test runs twice). Leave Concurrency at 1 and Timeout at 10 sec |
| 3 | `th4-scenario-select` | Select Scenarios to Run | `HAR.SCENARIO_SELECTOR` | Spotlight the **Select Scenarios** section → check the seeded scenario checkbox (selects all 3 tests) → spotlight the **count badge** "1 scenario(s) selected (3 test(s))" (1200ms) → spotlight the **override controls**: Body Validation dropdown, Assertions checkbox, Unordered arrays (1000ms, explain: temporary overrides without editing test definitions) |
| 4 | `th4-exec-plan` | Execution Plan Preview | `HAR.EXEC_PLAN` | Spotlight the **Execution Plan** summary (1500ms): `2 iterations × 3 tests = 6 requests` — this shows exactly what will execute before you commit to running. The total request count helps estimate time and resource usage |
| 5 | `th4-run` | Run & Monitor Progress | `HAR.RUN_BTN` | Click **▶ Run Test** → spotlight the **progress bar** filling (1000ms) → spotlight the **live metrics**: TPS, Avg Response, Error Rate, Validation Failures (1500ms, explain: these update in real-time as requests complete) → run completes → spotlight the **completion banner** with total requests and elapsed time (1500ms) |
| 6 | `th4-results` | View Full Results | `HAR.VIEW_RESULTS_BTN` | Spotlight **View Full Results →** button in the completion banner → click → navigate to **Results** tab → spotlight the new run entry at the top of the results list (1200ms, explain: every run is saved here for comparison, export, and baseline analysis) |

**Cleanup:** Deletes the seeded FG on exit/restart. TH-5 relies on its own seeding.

---

## TH-5: Data Source Authoring

**Goal:** Understand data-driven testing — see a parameterized scenario with a data source, understand column types, add data rows with tags, filter by tags, and preview execution.

| Field | Value |
|---|---|
| `id` | `th-data-sources` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG "Data-Driven Demo" with a **parameterized** scenario "User Tests" containing a test "Get User by ID" with:
- URL template: `https://jsonplaceholder.typicode.com/users/{{userId}}`
- Data source: one `userId` column (type: path, mapping: `userId`), 2 pre-filled rows (userId=1, userId=2, both enabled)
- Validation: status 200 assertion

**Note:** The Parameterize/Data Source tab only appears for tests inside parameterized scenarios (`kind !== 'standard'`). The setup wizard (5 steps: detect variables → columns → validate → order → review) is how users create data sources from scratch; here we seed a pre-configured data source so the lesson focuses on the grid.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th5-param-scenario` | Parameterized Scenarios | `.kind-badge-param` | Navigate to Scenarios → expand the seeded FG → spotlight the **PARAM** badge on the scenario (1500ms, explain: parameterized scenarios support data-driven testing — each data row becomes a separate request with substituted values) → spotlight the test card showing the `{{userId}}` template URL |
| 2 | `th5-data-tab` | The Data Source Tab | `.builder-tab:has(.tab-badge)` | Open the test editor (click Edit) → spotlight the **Data Source** tab with its row-count badge (1500ms, explain: the Data Source tab appears for parameterized tests and shows how many rows are enabled) → click it → grid appears |
| 3 | `th5-grid-overview` | The Data Source Grid | `.data-source-grid` | Spotlight the grid showing 2 rows with the `userId` column (1500ms) → spotlight the column header with its **Path** type dropdown (1200ms, explain: 5 column types — Path replaces URL path segments, Param adds query params, Body fills JSON body fields, Header sets HTTP header values, Validate defines per-row expected values) → spotlight the **Run Preview** footer: "2 enabled rows → 2 requests" (1000ms) |
| 4 | `th5-add-rows` | Add Data Rows | `.data-source-toolbar-unified` | Click **+ Row** three times → fill userId values: 3, 4, 5 → spotlight the filled grid with all 5 rows (1500ms) → spotlight a row's enable/disable checkbox (800ms, explain: uncheck to skip individual rows without deleting them) → spotlight the updated Run Preview: "5 enabled rows → 5 requests" (1000ms) |
| 5 | `th5-tags` | Tag & Filter Rows | `.data-source-row-tags` | Click the **+** tag button on row 1 → type "smoke" → repeat for row 2 → spotlight the tag pills (1200ms) → spotlight the **tag filter bar** that appeared: All (5), smoke (2), untagged (3) → click **smoke** filter → grid shows only tagged rows (1000ms, explain: tags let you run subsets in the Parameterized Runner without editing the data source) → click **All** to restore full view |
| 6 | `th5-save` | Save & Review | `[data-testid="te-save-btn"]` | Click **Save** → editor closes → spotlight the test card back in the tree (1200ms, explain: this test now runs 5 times in the Parameterized Runner — once per enabled data row. Use Shared Data Sources for reusable row sets, or the Import menu for CSV/Excel bulk loading) |

**Cleanup:** Deletes the seeded FG on exit/restart. TH-6 relies on its own seeding.

---

## TH-6: The Parameterized Runner

**Goal:** Execute parameterized tests — understand how the Parameterized Runner differs from the standard Test Runner, see the per-test execution plan with row counts, use tag filtering, run the suite, and monitor per-row live progress.

| Field | Value |
|---|---|
| `id` | `th-parameterized-runner` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `param-runner` |
| `allowedTabs` | `['scenarios', 'param-runner', 'results']` |

**Prerequisite:** Seeded FG "Param Runner Demo" with a **parameterized** scenario "User Tests" containing one test "Get User by ID":
- URL template: `https://jsonplaceholder.typicode.com/users/{{userId}}`
- Data source: `userId` column (path), 5 rows (userId 1–5, all enabled), rows 1–3 tagged `smoke`, rows 4–5 tagged `regression`
- Validation: status 200 assertion

**Note:** The Parameterized Runner is a **separate sub-tab** (`param-runner`) from the standard Test Runner (`runner`). It shares the same `RunnerPage` component but filters to show only `kind === 'parameterized'` scenarios. The run button reads "▶ Run Parameterized Test" and the execution plan shows per-test `iterations × rows = N` breakdowns. Per-test row progress is visible only **during** the run (not after completion). "Re-run Failed" lives on the Results tab — see TH-7.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th6-param-tab` | The Parameterized Runner | `.param-runner-page .page-header` | Navigate to the **Parameterized Runner** tab → spotlight the page title "Parameterized Runner" (1200ms, explain: this is a dedicated runner for parameterized scenarios only — standard scenarios appear in the Test Runner tab instead) → spotlight the **Scenario Selector** showing only the seeded parameterized scenario with its aggregate row count badge `📊 5 rows` (1500ms) |
| 2 | `th6-select-weights` | Select & Review Weights | `.collapsible-legend` | Select the scenario checkbox → spotlight the **Test Distribution (weights)** section that appears (1500ms) → spotlight the per-test weight row showing the test name, method badge, `📊 5 rows` badge, and weight input (1200ms, explain: weights control test proportion — set to 0 to skip, higher values increase share during random distribution) |
| 3 | `th6-exec-plan` | Execution Plan (Rows × Iterations) | `HAR.EXEC_PLAN` | Set **Iterations** to 2 → spotlight the **Execution Plan** showing the per-test breakdown: `Get User by ID: 2 × 5 = 10` → `Total: 10 requests · Concurrency: 1` (1800ms, explain: the parameterized runner multiplies iterations by the number of **enabled data rows** per test — each row becomes a real HTTP request with substituted values from the data source) |
| 4 | `th6-tag-filter` | Tag Filter | `.runner-tag-filter-input` | Spotlight the **Tag Filter** input that appeared because rows have tags (1200ms) → type "smoke" → spotlight the hint: "Only rows matching these tags will run" (1200ms, explain: the tag filter applies at **run time** — only rows tagged `smoke` will execute, cutting our 5 rows to 3 per iteration) → clear the filter for the full run |
| 5 | `th6-run` | Run & Monitor Progress | `HAR.RUN_BTN` | Set iterations back to 1 → click **▶ Run Parameterized Test** → spotlight the **live progress bar** filling (1200ms) → spotlight the **per-test row progress** showing completion counts (1500ms, explain: this real-time row-level breakdown is unique to the parameterized runner — see exactly how many rows passed or failed per test) → spotlight **live metrics** (TPS, Avg Response, Error Rate) updating in real time (1500ms) |
| 6 | `th6-results` | Completion & Results | `HAR.COMPLETION` | Run completes → spotlight the **completion banner** showing total requests and elapsed time (1200ms) → click **View Full Results →** → navigate to Results tab → spotlight the new run entry (1500ms, explain: every parameterized run is saved for comparison, re-run of failed rows, and baseline analysis — see TH-7 for Results & Analysis deep dive) |

**Cleanup:** Deletes the seeded FG on exit/restart.

---

## TH-7: Results & Analysis

**Goal:** Explore the Results Dashboard — understand the run selector, read metrics and response time distribution, drill into request details with grouping and filters, mark a baseline, and export reports.

| Field | Value |
|---|---|
| `id` | `th-results-analysis` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `results` |
| `allowedTabs` | `['scenarios', 'runner', 'param-runner', 'results']` |

**Prerequisite:** 1 seeded TestRun (5 results with realistic timing data, 4 passed + 1 failed validation) saved to storage. The dashboard loads runs from IndexedDB on mount, so seeding before navigating to the results tab is sufficient.

**Note:** The Results Dashboard is a **single-column layout** (not left/right split). Runs are selected via a **dropdown** (`.results-run-select`), not a sidebar list. View tabs are: **Overview**, **Request Details** (not "Requests"), **SLA**, and **Comparison & Trends** (not "Analysis"). Status filtering uses a **dropdown** (not pills). Group By primary options are Feature, Scenario, Test Name (flat), not "Data Row" at top level. Export is split across **Export JSON**, **Export CSV**, and **Generate Report ▾** (HTML/JSON/Markdown downloads — no in-app preview).

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th7-dashboard` | The Results Dashboard | `.results-top` | Navigate to **Results** tab → spotlight the **run type filter tabs**: All Runs / 🧪 Test Runs / ⚡ Workflow Runs (1200ms, explain: filter which run types are shown in the dropdown) → spotlight the **run dropdown** showing the seeded run with its timestamp, request count, and TPS (1500ms) → select the run |
| 2 | `th7-metrics` | Metrics & Distribution | `[data-testid="results-metrics-cards"]` | On the **Overview** tab → spotlight the **Metrics Cards**: TPS, Avg Response, Min, Max on the first row (1500ms) → spotlight the **second row**: P50, P95, P99, Error Rate, Total Duration, Total Requests, Validation Failures (1500ms) → spotlight the **Response Time Distribution** histogram below (1200ms, explain: shows how response times are distributed — the P95/P99 reference lines help identify outliers) |
| 3 | `th7-request-details` | Request Details & Grouping | `#results-tab-requests` | Click the **Request Details** tab → spotlight the **Group By** selector (1200ms): options are Feature, Scenario, Test Name (flat) → select **Scenario** → spotlight the grouped table showing pass/fail counts, avg/min/max timing per scenario (1500ms) → spotlight the **status filter** dropdown → select **Failed Only** → spotlight the filtered view showing only the failed request (1200ms) |
| 4 | `th7-baseline` | Set a Baseline | `.baseline-toggle` | Spotlight the **☆ Set Baseline** button next to the run dropdown (1200ms, explain: baselines anchor your performance expectations — future runs are compared against the baseline to detect regressions) → click → button changes to **★ Baseline** (active state, 1000ms) → spotlight the **Comparison & Trends** tab label (800ms, explain: open this tab to compare runs against the baseline and see trend charts) |
| 5 | `th7-sla` | SLA Status | `#results-tab-sla` | Click the **SLA** tab → spotlight the SLA panel (1500ms, explain: SLA targets defined on Feature Groups or Scenarios are evaluated automatically after each run — see TH-13 for authoring SLA targets). If targets exist: spotlight pass/warn/fail indicators. If empty: spotlight the message and explain where to define targets |
| 6 | `th7-export` | Export Reports | `[data-testid="results-export-json-btn"]` | Spotlight the **Export JSON** button (1000ms) → spotlight the **Generate Report ▾** dropdown nearby (1200ms, explain: three report formats — **HTML** for shareable standalone reports with charts, **JSON** for CI integration, **Markdown** for documentation) → click Generate Report → click **HTML Report** to download (800ms) |

**Cleanup:** Deletes seeded TestRun and unmarks baseline on exit/restart.

---

## TH-8: Load Profiles & Advanced Execution

**Goal:** Configure advanced execution modes — load profiles (ramp-up/sustained/spike), think time delays, error policies, and constant arrival rate. This lesson focuses on the configuration UI; actual load test execution and results analysis are covered in TH-4 and TH-7.

| Field | Value |
|---|---|
| `id` | `th-load-testing` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `runner` |
| `allowedTabs` | `['runner']` |

**Prerequisite:** Seeded FG "Load Test Demo" with 3 fast GET endpoints (absolute jsonplaceholder URLs) and a standard scenario pre-selected in the runner.

**Note — UI realities (verified against `RunnerExecutionConfig.tsx`):**
- Execution Mode is a horizontal radio group: Sequential, Batch, Continuous Pool, Load Profile, Constant Arrival
- Load Profile shows `.load-profile-section` with 3 profile type **buttons** (not radios): Ramp-Up, Sustained, Spike
- Ramp-Up fields: Duration (sec), Max Concurrency, Ramp (sec) — no "Start Concurrency" (always starts from 1)
- Profile preview is `ProfilePreview` (SVG chart), not Recharts
- Think Time is a **radio group** (None/Constant/Uniform/Gaussian), not a toggle+mode
- Error Policy is inside `.resilience-row` under "On Error" label: Continue, Stop 1st, Threshold
- Threshold enables both Max Errors and Error Rate % fields
- Constant Arrival is **desktop-only** (`isTauri()` gated) — disabled at 50% opacity on web
- Concurrency/Iterations are disabled and show hints ("Set in profile" / "Time-based") for Load Profile and Constant Arrival
- `ExecutionPlanPreview` is hidden for Load Profile and Constant Arrival modes

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th8-load-profile` | Load Profile Mode | `HAR.EXEC_CONFIG` | On the Runner tab with the seeded scenario selected, switch **Execution Mode** from Batch to **Load Profile** (800ms pause for section to appear) → spotlight the **Profile Type selector** (Ramp-Up / Sustained / Spike buttons, 1500ms) → configure: Duration 10s, Max Concurrency 5, Ramp 5s → spotlight the **fields** (1200ms) → spotlight the **SVG preview chart** showing the ramp curve (1500ms). Note: highlight is on EXEC_CONFIG (not LOAD_PROFILE_SEC) because the load profile section doesn't exist during reading phase |
| 2 | `th8-profile-types` | Profile Types | `HAR.PROFILE_TYPE_SEL` | Brief pause (400ms) → click **Sustained** → spotlight SVG preview showing flat line (1000ms) → click **Spike** → spotlight extra fields (Spike Concurrency, Spike Start, Spike Duration, 1200ms) → spotlight SVG preview with spike shape (1000ms) → click **Ramp-Up** to return → spotlight restored ramp curve (800ms) |
| 3 | `th8-think-time` | Think Time Delays | `HAR.THINK_TIME_SEC` | Click **Constant** radio (no re-spotlight — highlight already shown during reading) → inline ms input appears → set to **200** → spotlight the hint "Fixed 200ms delay" (1000ms) → click **None** to reset |
| 4 | `th8-error-policy` | Error Policies | `HAR.ERROR_POLICY` | Click **Threshold** radio (no re-spotlight — highlight already shown during reading) → spotlight **Max Errors** field, then **Error Rate %** field individually (800ms each) → set Error Rate to **10%** → spotlight the **Timeout** field (800ms, explain: complementary resilience controls) |
| 5 | `th8-constant-arrival` | Constant Arrival Rate | `HAR.EXEC_MODE_ROW` | Spotlight the **Constant Arrival** radio label at 50% opacity (1200ms, narrate: Constant Arrival fires requests at a fixed rate regardless of response time — an open model like k6's constant-arrival-rate. It's available in the desktop app and configures Target RPS, Duration, Max In-Flight, and optional ramp) → switch back to **Batch** mode to restore defaults → explain: for most testing, Batch or Load Profile covers your needs; Constant Arrival is for strict throughput targets on the desktop app |

**Cleanup:** Resets execution mode to Batch, Think Time to None, Error Policy to Continue on exit/restart. Deletes the seeded FG.

---

## TH-9: Advanced — Versioning, Trash & Organization

**Goal:** Manage test definitions over time — version snapshots, find tests with search and tags, and recover accidentally deleted items from the Trash.

| Field | Value |
|---|---|
| `id` | `th-advanced-features` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG "Organization Demo" with 2 scenarios (3 tests total), one scenario tagged `smoke`, and 1 test with 2 pre-built `definitionVersions` entries (URL changed between versions). The seeded test data includes version snapshots so the History tab has content to show.

**Note — UI realities (verified against codebase):**
- **Version History** is the last tab in the Test Editor (only shown for existing tests, not new). `TestDefinitionVersionPanel` → shared `VersionHistoryPanel`. Versions track request definition fields (name, URL, method, headers, body, auth, extractions) — NOT assertions/validation (that's TH-12).
- **Compare** requires selecting exactly 2 version checkboxes → "Compare" button appears → opens `TestDefinitionVersionDiff` modal with tabs (Overview, Headers, Body, Auth, Extractions).
- **Restore** is per-row ↩ button. Updates editor draft only — user must Save to persist.
- **Tags** are **scenario-level only** (`.scenario-tag-pill`). Add via `.scenario-tag-add-btn` (`+` icon) → inline input. No test-level tags. No "Tag Filter" bar in search.
- **Search** bar (`ScenarioBuilderSearchBar`) searches tests/scenarios/FGs by name, URL, method, tags. Match count in `.builder-search-count`. Only matching **test cards** get `.search-match` highlight; FGs/scenarios are filtered in/out.
- **Test actions** are **inline buttons** on `.test-card-actions` (Edit, Copy, Move, Export, Delete) — no right-click context menu.
- **Trash** button in header (no `data-testid`). Delete → `ConfirmModal` → undo toast (5s countdown) → Trash panel with Restore/Permanent Delete.
- **Structure History** is the FG "History" button (not "Structure Change Log"). Opens inline panel, not modal.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th9-search` | Search & Filter | `.builder-search-wrapper` | Spotlight the **Search Bar** at top of the Feature Groups tree → type "user" → spotlight the **match count** `.builder-search-count` and test cards with `.search-match` highlight (1500ms, explain: search matches test name, URL, method, and scenario tags) → clear the search → tree restores to full view |
| 2 | `th9-tags` | Scenario Tags | `.scenario-tag-pill` | Spotlight the seeded scenario's existing **smoke** tag pill (1200ms) → click the **+** button (`.scenario-tag-add-btn`) → type "regression" in the inline input → press Enter → spotlight the new tag pill appearing (1000ms, explain: tags organize scenarios for filtered runs in the Parameterized Runner and are searchable) |
| 3 | `th9-versioning` | Test Definition Versions | `[data-testid="version-history-panel"]` | Open the seeded test (click Edit) → click the **History** tab → spotlight the **version list** with 2 entries showing timestamps and change summaries (1500ms) → spotlight the **↩ Restore** button on the older version (1000ms, explain: Restore loads that snapshot into the editor draft — you must Save to persist) → close the editor |
| 4 | `th9-delete-undo` | Delete & Undo | `.trash-toast` | Click the **Delete** button on a test card → confirm in the dialog → spotlight the **Undo Toast** with its 5-second countdown bar (1500ms, explain: you have 5 seconds to undo before the item moves to Trash) → click **Undo** → test reappears in its original location |
| 5 | `th9-trash-panel` | The Trash Panel | `.trash-panel-modal` | Delete a different test → let the undo toast expire → spotlight the **Trash** button in the header showing count badge (1200ms) → click it → Trash Panel opens → spotlight the deleted item row with Restore and Permanent Delete buttons (1500ms) → click **Restore** → item returns to tree → close Trash panel |

**Cleanup:** Restore any trashed items, remove added tags, delete seeded FG.

---

## TH-10: Assertions Deep Dive

**Goal:** Master assertion types in RedfireForge — from basic status checks to JSON Schema validation, array assertions, and the Regex Builder. Understand the 4 HTTP assertion categories, the NOT modifier, presets, and the Regex Builder modal.

| Field | Value |
|---|---|
| `id` | `th-assertions-deep-dive` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG with a GET test against `https://jsonplaceholder.typicode.com/users/1` with `validation.mode: 'selective'` and `validation.sampleJson` pre-populated with a cached user response (rich JSON with nested objects for `address`, `company`, arrays). No assertions initially.

**Note — UI realities (verified against codebase):**
- Assertion menu is a **portal popover** (`.assertions-add-menu`) — not a modal. 4 categories visible for HTTP tests (WS/Kafka hidden): Response, Field Validation, Array & Structure, Schema & Advanced.
- Badge labels differ from type names: `responseTime` → `TIME`, `numeric` → `NUMBER`, `arrayLength` → `ARRAY`, `arrayContains` → `CONTAINS`, `existence` → `EXISTS`, `containsSubset` → `SUBSET`.
- **NOT modifier** is a toggle button (`.assertion-negate-toggle`) on every row. It does NOT change the badge text — only the toggle and row styling change.
- **Presets** button (`📋 Presets`) opens a dropdown panel (`.assertion-preset-menu`) with 3 category tabs (API Validation, Data Quality, Security) and 7 curated presets. **Save as Preset** does not exist.
- **Regex Builder** opens as a two-column modal via `RegexAssertionBuilderModal`. Tree picker on left, pattern/preview on right. Pattern library has 5 categories (Text, Identifiers, Formats, Numbers, Arrays).
- **Date Compare** only supports `today` + `fixed date` references (not "yesterday" or "7 days ago"). Precision selector is on **Date Precise** only.
- JSON Schema editor is an inline `textarea` with toolbar buttons (Paste Schema, Pretty Format, Minify, Generate from Response). Generate requires `sampleJson`.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th10-assertion-menu` | The Assertion Menu | `HAR.TE_ASSERTIONS_ADD_BTN` | Open the test editor → **Validation** tab → click **+ Add** → spotlight the **categorized assertion menu** (`.assertions-add-menu`) opening with search and 4 category headers: **Response** (Status Code, Response Time SLA, Response Header, Body Size), **Field Validation** (Regex Match, Regex Builder, Numeric, Date, Date Precise, Type Check, Field Exists), **Array & Structure** (Array Length, Array Contains, Each Element, Contains Subset), **Schema & Advanced** (JSON Schema, Custom Predicate) — 1500ms pause → close menu |
| 2 | `th10-response` | Response Assertions & NOT | `HAR.TE_ASSERTION_ROW` | Click **+ Add** → **Status Code** → spotlight the new assertion row with `STATUS` badge and value `200` (1000ms) → add **Response Time SLA** → spotlight: `TIME` badge, max `500` ms (1000ms) → spotlight the **NOT** toggle on the timing row (`.assertion-negate-toggle`) → click it → row gets negated styling (1000ms, explain: the NOT modifier inverts any assertion — available on every assertion type) → click NOT again to restore |
| 3 | `th10-field-type` | Field & Type Assertions | `HAR.TE_ASSERTION_ROW` | Add **Numeric Compare** → spotlight: `NUMBER` badge, JSONPath input, operator, value (1200ms) → spotlight the **⎆ JSONPath picker** button → click → spotlight the `.jpp-menu` popover showing response fields as a searchable tree (1200ms) → select `$.address.geo.lat` → picker closes → set operator `>=` value `-90` → add **Field Exists** → spotlight: `EXISTS` badge, JSONPath `$.company`, expect exists checked (1000ms, explain: verify a field is present without checking its value) |
| 4 | `th10-schema-custom` | JSON Schema & Custom | `HAR.TE_ASSERTION_ROW` | Add **JSON Schema** → spotlight the schema textarea with toolbar: **Paste Schema**, **Pretty Format**, **Minify**, **Generate from Response** (1200ms) → click **Generate from Response** → spotlight the auto-generated schema populating the textarea (1500ms, explain: builds a complete JSON Schema from the sample response — types, required fields, nested objects, all inferred) → add **Custom Predicate** → spotlight: `CUSTOM` badge, inline expression input + description field (1000ms) → type expression: `$gt($count($.body.address), 0)` → type description: "Has address data" |
| 5 | `th10-presets` | Assertion Presets | `.assertion-preset-wrap` | Spotlight the **📋 Presets** button (800ms) → click → spotlight the **Presets panel** with category tabs: All, API Validation, Data Quality, Security (1200ms) → spotlight the **API Health Check** card (1000ms, explain: presets apply a curated set of assertions in one click — great for consistency across your test suite) → click it → spotlight the assertions appended to the list (1000ms) → close presets panel |
| 6 | `th10-regex-builder` | The Regex Builder | `.assertion-builder-btn` | Click **+ Add** → **Regex Builder…** → spotlight the **Regex Builder modal** opening with two-column layout (1200ms) → spotlight the **JSON tree** on the left showing response fields → select `$.email` → path populates (1000ms) → spotlight the **Pattern Library** toggle → click → spotlight pattern categories (Formats section: Email address, URL, ISO date, etc.) (1200ms) → select **Email address** → spotlight the **live preview** showing MATCH/NO MATCH against the field value (1500ms) → click **Apply Assertion** → modal closes → regex row added → save test |

**Cleanup:** Keep assertions for reference. Close editor.

---

## TH-11: Data Mapper for Validation

**Goal:** Use the visual Data Mapper to build validation rules — understand the two-panel layout, auto-mapping, operator pills, view modes, and verification. This is an overview tour; see TH-10 for assertion types and TH-12 for versioning.

| Field | Value |
|---|---|
| `id` | `th-data-mapper-validation` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG with a GET test against `https://jsonplaceholder.typicode.com/users/1` with `validation.mode: 'selective'`, `sampleJson` pre-populated, and 2 basic `expectedFields` already configured (so the mapper opens with initial state).

**Note — UI realities (verified against codebase):**
- The **⚡ Data Mapper** button is in `.fetch-host-override-row` (uses `HAR.TE_MAPPER_BTN`), enabled when `sampleJson` or `expectedFields` exist in selective mode.
- Modal shell uses `.dm-modal-overlay` (backdrop, `role="presentation"`) / `.dm-modal-shell` (the dialog box, carries `role="dialog"`) — NOT `.data-mapper-modal`. There is no full screen toggle; the modal is drag-moveable by its header and resizable via the right/bottom/corner handles.
- Layout: **Source** panel (`.dm-panel--source`) on left with JSON tree + type pills (`obj`, `arr`, `str`, `num`, `bool`) + search input (`.dm-search-input`). **Target** panel (`.dm-panel--target`) on right with mapped rules + operator pills (`.dm-operator-pill`). **Canvas** (`.dm-canvas`) between them with SVG connection lines.
- **Toolbar** (`.dm-toolbar`): Auto-map (`.dm-toolbar-btn--primary`), Clear all, status text, view mode buttons (Code/Preview/Table/Rules/Lines), Verify All (`.dm-toolbar-btn--verify`), Undo/Redo.
- **Auto-map** uses 3-tier name matching (exact path, fuzzy name, type-compatible). Button shows count badge.
- **Coverage** lives in `MappingHealthDashboard` (`.dm-health-dashboard`): separate health status + coverage % metric.
- **Operator picker**: click a pill → portal dropdown (`.dm-operator-picker`) with categorized, searchable 24-operator list.
- **View modes**: Code + Preview + Table are bottom dock tabs; Rules opens a separate `ValidationRulesModal`; Lines toggles SVG canvas visibility.
- **Verify All**: runs verification on all mappings → each gets pass/fail badge (`.dm-verify-badge--pass/fail`).
- **Custom predicates section** exists (`.dm-custom-predicates-section`) but has **no "+ Add Custom" button** — predicates are added via Rules DSL or seeded in initial data.
- **Subtree operations** use `BulkActionsBar` (click-select source + target nodes, then toolbar buttons) — NOT right-click context menu on source.
- **Save** button in footer (`.dm-modal-btn--primary`), label "Save".

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th11-open-mapper` | Open the Data Mapper | `HAR.TE_MAPPER_BTN` | Open the test editor → **Validation** tab → click the **⚡ Data Mapper** button → modal opens → spotlight the two-panel layout: **Source** tree (left) showing the JSON response with type pills, **Target** rules (right) with the 2 pre-configured expected fields, and **Canvas** (center) with connection lines (1500ms) → spotlight the **toolbar** with Auto-map, view mode buttons, and Verify All (1200ms) |
| 2 | `th11-source-panel` | The Source Panel | `.dm-panel--source` | Spotlight the **Source** panel header showing "Source" (800ms) → spotlight a few tree nodes with their **type pills**: `obj` (root), `str` (name), `num` (id), `obj` (address), `arr` (nested) (1500ms, explain: every response field is shown with its type so you know what you're mapping) → spotlight the **search** input → type "address" → spotlight the tree filtering to matching paths (1000ms) → clear search → spotlight the **coverage** dashboard showing health status + coverage percentage (1000ms, explain: coverage tracks how much of the response is validated — aim higher on critical APIs) |
| 3 | `th11-auto-map` | Auto-Map | `.dm-toolbar` | Spotlight the **Auto-map** button with its count badge (800ms) → click → spotlight mappings populating on both panels with connection lines appearing on the canvas (1500ms, explain: auto-map uses 3-tier matching — exact path, fuzzy name, type-compatible — to map source fields to target rules automatically) → spotlight the **toolbar status** updating with mapping count (1000ms) → spotlight an individual mapping on the target panel showing the **operator pill** (`.dm-operator-pill`) defaulting to `equals` (1200ms) |
| 4 | `th11-operator-pill` | Operator Pills | `.dm-operator-pill` | Spotlight an **operator pill** on a mapped target node (800ms) → click it → spotlight the **operator picker** dropdown (`.dm-operator-picker`) with categorized, searchable list of 24 operators: equals, contains, regex, greater_than, is_not_empty, type_is, between, and more (1500ms, explain: each mapping can have a different comparison operator — pick the one that matches your validation intent) → select **is_not_empty** → pill updates → spotlight the pill change (800ms) |
| 5 | `th11-views-verify` | View Modes & Verify | `.dm-toolbar` | Click **Code** in the toolbar → spotlight the **Code View** dock showing mappings as `target ← source` text with line numbers (1200ms) → click **Table** → spotlight the **Table View** with JSON Path and Expected Value columns (1200ms) → click **Verify All** → spotlight verification running: each mapping gets a **pass/fail badge** (green ✓ / red ✗) on target nodes (1500ms, explain: Verify checks all rules against the sample response — green means the field matches, red means a mismatch) → spotlight the **verify summary** in the toolbar (1000ms) |
| 6 | `th11-save` | Save Rules | `.dm-modal-btn--primary` | Spotlight the **Save** button in the footer (800ms) → click → Data Mapper closes → spotlight the updated **expected fields** list in the Validation tab now reflecting all mapped rules (1200ms, explain: rules built in the Data Mapper are saved back to the test's validation configuration — you can re-open the mapper anytime to refine) → save the test |

**Cleanup:** Keep validation rules for TH-12 versioning demo. Close editor.

---

## TH-12: Validation Versioning

**Goal:** Track validation changes over time with Response Versions and Rules Versions — save snapshots, preview historical validation state, compare versions side by side, and restore previous configurations.

| Field | Value |
|---|---|
| `id` | `th-validation-versioning` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG with a GET test in Selective Fields mode. The test has 3 `responseVersions` (v1: initial response with fewer fields, v2: updated response with new fields, v3: current) and 2 `rulesVersions` (r1: 4 rules Selective·Include·Unordered, r2: current 2 rules Selective·Include). Validation has `sampleJson` pre-populated and 2 basic expected fields.

**Note — UI realities (verified against codebase):**
- Version panels render **only in Selective mode** (`validation.mode === 'selective'`), at the **bottom** of the Validation tab (below assertions, expected fields, fetch row).
- **Response Versions** panel uses `.version-panel` root class. Header `<h4>Response Versions (N)</h4>` — count in title text, NOT a separate badge. Collapsible via `.version-collapse-toggle`.
- **Rules Versions** panel uses `.rules-version-panel` root class. Header `<h4>Rules Versions (N)</h4>`. Same collapse pattern. Hidden entirely when no rules AND no saved versions.
- Version rows use `VersionListItem` (`.version-item`). Each shows: editable label (`.version-label`), timestamp (`.version-time`), optional badge (`.version-rules-tag`), and `current` green pill (`.version-current-tag`) on the latest matching version.
- Row actions: **Preview** (`.btn.btn-xs`), **Restore** (`.btn.btn-xs`, hidden on current row), **Delete** (`.btn.btn-xs.btn-danger`).
- **Restore is immediate** — no confirmation dialog. The system does NOT auto-save current state before restore.
- **Preview** opens `VersionPreviewModal` (`.vp-modal`). Response previews show pretty-printed JSON + validation mode tags. Rules previews show DSL text + tag pills (mode, rule count, unordered).
- **Compare** opens `VersionDiffModal` (`.version-diff-modal`). Uses `json-diff-kit` side-by-side diff. Info bar shows "Changes detected" / "✔ Identical" / "Same version selected" — **no numeric delta summary** like "3 added, 1 removed". Response compare has Response + Validation Rules tab toggle.
- Section buttons: **Save as Version** / **Save Rules Version** (`.btn-accent`), **Compare** (`.btn.btn-sm`, only when ≥2 versions).
- No `data-testid` attributes on validation version elements. Use CSS class selectors.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th12-response-versions` | Response Versions | `.version-panel` | Open the test editor → **Validation** tab → spotlight the **Response Versions** section showing `Response Versions (3)` in the header with **Save as Version** and **Compare** buttons (1200ms) → spotlight the version rows: **v3** with timestamp + `SELECTIVE · INCLUDE` badge + `current` green pill, **v2** with timestamp + badge + Preview/Restore/Delete buttons, **v1** oldest (1500ms, explain: every time you fetch a response or click Save as Version, a snapshot captures the response body plus your validation settings — mode, fields, everything) |
| 2 | `th12-preview-response` | Preview a Response Version | `.vp-modal` | Click **Preview** on v1 (the oldest version) → spotlight the **Preview modal** showing the response JSON with validation mode tags in the header, timestamp, and line count in the footer (1200ms, explain: Preview lets you see exactly what the API returned when this version was saved — useful for debugging regression in API responses) → spotlight the JSON content showing a simpler response than the current v3 (1000ms) → close the preview modal |
| 3 | `th12-compare-responses` | Compare Response Versions | `.version-diff-modal` | Click the **Compare** button in the Response Versions header → spotlight the **comparison modal** with two version selectors (left and right dropdowns), an info bar showing "Changes detected", and a side-by-side diff viewer (1500ms) → spotlight the diff view highlighting added fields in green and changed values (1200ms, explain: response comparison shows how the API evolved between versions — added fields, removed fields, value changes — all at a glance) → spotlight the **Validation Rules** tab toggle at the top to see how rules changed between the same response versions (1000ms) → close the comparison |
| 4 | `th12-rules-versions` | Rules Versions | `.rules-version-panel` | Spotlight the **Rules Versions** section below Response Versions, showing `Rules Versions (2)` in the header with **Save Rules Version** and **Compare** buttons (1200ms) → spotlight the version rows: **r2** current with badge `SELECTIVE · INCLUDE · 2 RULES` + `current` green pill, **r1** with `SELECTIVE · INCLUDE · 4 RULES · UNORDERED` badge + Preview/Restore/Delete buttons (1500ms, explain: rules versions are separate from response versions — they track changes to your validation configuration: expected fields, operators, assertions, and validation mode settings) |
| 5 | `th12-restore-rules` | Restore a Rules Version | `.rules-version-panel` | Spotlight the **Restore** button on r1 (800ms, explain: restoring replaces the current rules with a previous version — use this when recent edits broke your validation and you want to roll back) → click Restore → spotlight the validation rules updating immediately — the expected fields list now shows 4 rules instead of 2, with Unordered array matching restored (1200ms) → spotlight the rules version rows: r1 is now marked `current` (1000ms) |
| 6 | `th12-compare-rules` | Compare Rules Versions | `.version-diff-modal` | Click **Compare** in the Rules Versions header → spotlight the **rules comparison modal** with version selectors and side-by-side diff (1200ms) → spotlight the diff highlighting differences between r1 and r2: added/removed rules, changed operators, different field paths (1500ms, explain: rules comparison is essential when refactoring validation — see exactly which assertions were added, removed, or modified between versions) → close the comparison |

**Cleanup:** Keep versions for reference. Close editor.

---

## TH-13: SLA Targets & Acceptance Criteria

**Goal:** Define absolute performance contracts on tests — set thresholds for response time percentiles, throughput, and error rate. Understand the warn/fail two-tier system, the Scenario SLA Summary, and the Runner SLA Override panel.

| Field | Value |
|---|---|
| `id` | `th-sla-configuration` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios', 'runner']` |

**Prerequisite:** Seeded FG "SLA Demo" with a scenario containing 1 test (GET /users/1) — validation mode selective with basic expected fields. No SLA targets initially (empty state shown first).

**Note — UI realities (verified against codebase):**
- The **🎯** SLA button is on each test card in `FeatureGroupCard.tsx` (`.test-card-actions .btn`), with tooltip `"Configure SLA targets for this test"`. Shows `🎯 N` count when targets configured, with class `.btn-sla-active`.
- **TestSlaModal** (`.test-sla-modal`) opens on click. Title: `"🎯 SLA Targets — {test.name}"`. Footer has `"+ Add Target"` button (`.sla-add-btn`). Empty state: `.sla-empty-hint`.
- **Row structure**: `.sla-editor-table.sla-editor-table--test` with columns: Metric (`CustomSelect .sla-editor-select`), Operator (read-only `.sla-operator-display` — auto `≤` or `≥`), Fail at (`.sla-editor-input`), warn arrow, Warn at (`.sla-editor-input`), Label (`.sla-editor-input-label`), Delete (`.sla-delete-btn`).
- **No Scope column in test modal** — test-level targets are implicitly test-scoped. Scope column exists only in `SlaTargetEditor` (Results/Workflow).
- **7 metrics**: P50, P95, P99, P99.9, Avg Response Time (ms); TPS; Error Rate (%). Latency defaults to `≤`, TPS to `≥`.
- **ScenarioSlaPanel** (`.scenario-sla-panel`) appears below test cards when any test has SLA targets. Collapsible header `🎯 SLA Summary` + count badge. Body is a `.sla-summary-table` with rows per target. Row click opens TestSlaModal.
- **Runner SLA Override**: trigger bar (`.sla-trigger`) with stats + Configure button (`.sla-trigger-btn`). Override modal (`.sla-override-modal`) shows configured targets + override section.
- **SLA compact bar on runner completion does NOT exist** — runner shows duration + "View Full Results →". SLA compact bar is on Results → Overview tab (`.sla-compact-bar`).
- **Override indicator in Results ("was 500ms → 300ms") does NOT exist** in `SlaStatusAccordion`.
- Save/close: TestSlaModal footer has Save (`.btn-primary`) and Cancel (`.btn`). Override modal footer has Save (`.btn-primary`) and Cancel (`.btn`) inside `.sla-modal-footer-actions`.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th13-open-sla-modal` | The SLA Targets Modal | `.test-sla-modal` | Spotlight the **🎯** SLA button on the test card (800ms, explain: SLA targets define absolute acceptance criteria — "P95 must always be ≤ 500ms" or "error rate must be ≤ 1%" — these are hard contracts, not relative comparisons) → click → spotlight the **SLA Targets** modal opening with the test name in the title and "No SLA targets yet" empty state (1200ms) → spotlight the **+ Add Target** button in the footer (800ms) |
| 2 | `th13-add-targets` | Add SLA Targets | `.sla-editor-table` | Click **+ Add Target** → spotlight the new row with **Metric** dropdown, **Operator** (auto-set), **Fail at**, and **Warn at** columns (1200ms) → open the Metric dropdown → spotlight the 7 available metrics: P50, P95, P99, P99.9, Avg Response Time (ms), TPS, Error Rate (%) (1500ms, explain: latency metrics default to ≤ — "must be at or below"; TPS defaults to ≥ — "must be at or above") → select **P95 Response Time** → operator auto-sets to **≤** → set Fail at `500` and Warn at `300` (1000ms, explain: warn is the early warning threshold — amber before the red fail) → add a second target: **Error Rate ≤ 1%**, warn `0.5%` → spotlight both rows configured (800ms) → click **Save** |
| 3 | `th13-sla-badge` | SLA Badge & Summary | `.scenario-sla-panel` | Spotlight the test card now showing **🎯 2** badge — indicating 2 SLA targets configured (800ms) → scroll to spotlight the **🎯 SLA Summary** panel that appeared at the bottom of the scenario (1000ms) → spotlight the **summary table** showing Test name, Metric, Operator, Fail at, Warn at columns with the 2 configured targets (1500ms, explain: the SLA Summary aggregates all targets across tests in a scenario — click any row to edit that test's SLA configuration) |
| 4 | `th13-runner-trigger` | Runner SLA Override | `.sla-trigger` | Navigate to **Test Runner** → spotlight the **🎯 SLA Override** trigger bar showing "2 configured" with a blue indicator dot (1200ms) → spotlight the **Configure** button (800ms) → click → spotlight the **SLA Override modal** opening with the configured targets section showing the 2 test-level targets (1200ms, explain: runner overrides are temporary — they apply only to this run and are not saved to the test definition. Useful for experimenting with tighter thresholds) |
| 5 | `th13-override-target` | Create an Override | `.sla-override-modal` | Expand the Configured Targets section → spotlight the **Override** button on the P95 row (800ms) → click → spotlight the target cloned into the **Overrides for This Run** section with metric locked but thresholds editable (1000ms) → close the override modal → spotlight the trigger bar updating to show "2 configured · 1 override" (800ms) |

**Cleanup:** Close any open modals. Remove seeded data.

**Note:** Step 6 (SLA in Results) was removed because `allowedTabs` does not include `results` and a real test run (with SLA evaluation data) cannot be executed in the demo environment. The Results SLA compact bar and SLA Status Accordion are covered in the TH-7 Results Analysis lesson when SLA targets are present.

---

## TH-14: Auth & Inheritance Chain

**Goal:** Understand the 4-level auth inheritance system (test → scenario → FG → global profile), configure auth at each level, and see effective auth resolution badges showing where each test's auth comes from.

| Field | Value |
|---|---|
| `id` | `th-auth-inheritance` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded global auth profile "Corp OAuth2" (oauth2). Seeded FG "Auth Demo" with 1 scenario containing 2 tests — FG auth set to "inherit" + linked to the global profile. All tests start with `{ type: 'inherit' }`, so badges initially show `Auth: oauth2 (Corp OAuth2) (global)`.

**Note — UI realities (verified against codebase):**
- **Global profiles** are created in **Settings → Global Auth Profiles** (not Environment Manager). FG references via `globalAuthProfileId`.
- **FG Auth button**: `.feature-group-actions .btn` (text "Auth"), toggles `editingFeatureAuth`. Panel: `.scenario-auth-panel.feature-auth-panel`. Profile dropdown: `.global-profile-selector` (only visible when auth type is "Inherit from Auth Profile").
- **Scenario Auth button**: `.scenario-group-actions .btn` (text "Auth"), toggles `editingScenarioAuth`. Panel: `.scenario-auth-panel`.
- **Test card badges**: `.test-card-meta .auth-badge` with sub-classes: `auth-badge-test-own` (green), `auth-badge-test-scenario` (blue), `auth-badge-test-feature` (purple), `auth-badge-test-global` (orange). Format: `Auth: {type} ({source})` or `Auth: {type} ({profileName}) (global)`.
- **Test editor Auth tab**: `.builder-tabs .builder-tab` (text "Auth"). Type select: `.auth-type-select`. 7 types: Inherit from Scenario, No Auth, Basic Auth, Bearer Token, API Key, Digest Auth, OAuth2 Client Credentials.
- **Inherit hint**: `.auth-inherit-hint` — text like `"Will use global profile "Corp OAuth2" (oauth2 Client Credentials) (via scenario → feature → global)"`.
- **Verify Auth button**: `.auth-verify-section .btn-verify`. Result: `.auth-verify-result`.
- **No Auth button on test cards** — use Edit → Auth tab.
- **No realm field** on Digest Auth, **no scope field** on OAuth2.
- **Secret toggle** (`.secret-toggle`) exists only for OAuth2 client secret.
- **No "Effective Auth Summary" view** — mixed badges on test cards are the visual summary.
- Demo bridge: `__demoUpsertGlobalAuthProfile(profile)` and `__demoPurgeGlobalAuthProfiles(names, ids)`.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th14-fg-auth-profile` | FG Auth & Global Profile | `.feature-auth-panel` | Spotlight the **Auth** button on the FG card (800ms) → click to open the **Feature Auth** panel (1000ms) → spotlight the auth type showing **Inherit from Auth Profile** with the **Auth Profile** dropdown (`.global-profile-selector`) showing "Corp OAuth2" (1200ms, explain: global profiles are created in Settings and shared across Feature Groups — the FG links to one via this dropdown, forming the bottom of the inheritance chain) → spotlight the hint text showing the profile's auth type (800ms) → close the panel |
| 2 | `th14-auth-badges` | Auth Badges & Inheritance | `.auth-badge` | Spotlight the test card badges — both showing **Auth: oauth2 (Corp OAuth2) (global)** in orange (1200ms, explain: auth resolves bottom-up — test checks its own auth, then scenario, then FG, then global profile. The first non-inherit level wins. The badge color and label show exactly where auth comes from at a glance) |
| 3 | `th14-scenario-override` | Scenario Auth Override | `.scenario-auth-panel` | Spotlight the **Auth** button on the scenario card (800ms) → click to open the **Scenario Auth** panel (1000ms) → spotlight the auth type selector showing "Inherit from Feature" → change to **Bearer Token** → fill the token field with a demo token (1000ms, explain: scenario-level auth overrides the FG/global chain for all tests in this scenario unless a test has its own auth) → spotlight both test badges updating from orange "global" to blue "bearer (scenario)" (1000ms) |
| 4 | `th14-test-override` | Test-Level Auth Override | `.auth-type-select` | Open first test via Edit → switch to **Auth** tab → spotlight the auth type selector (1000ms) → spotlight the inherit hint: "Will use scenario-level Bearer Token" → change to **API Key** → fill API Key Name `X-API-Key`, Value `demo-key-123`, placement **Header** (1200ms, explain: test-level is the highest priority — overrides everything above it) → save → spotlight the first test badge now showing green **Auth: apikey (own)** while the second test still shows blue **Auth: bearer (scenario)** (1000ms) |
| 5 | `th14-mixed-badges` | Mixed Auth Summary | `.test-card-meta` | Spotlight the scenario's test cards showing the mixed auth badges side by side: green **apikey (own)** on the first test, blue **bearer (scenario)** on the second (1500ms, explain: badge colors and labels make it clear at a glance — green means the test has its own auth, blue means it inherits from the scenario, orange would mean from a global profile. No need to open each test to check) |

**Cleanup:** Remove seeded global profile and FG. Close panels.

---

## TH-15: Import, Export & cURL

**Goal:** Explore the import/export capabilities in the test editor — cURL import to auto-populate fields from a command, cURL export to generate a ready-to-paste command, the Import/Export dropdown menus for test definitions and data, FG-level export with version options, and the auto-report toggle on the runner.

| Field | Value |
|---|---|
| `id` | `th-import-export-curl` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios', 'runner']` |

**Prerequisite:** Seeded FG with 1 scenario containing a configured HTTP POST test (with headers, body, and response versions for export popover demonstration).

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th15-curl-import` | cURL Import | `.curl-mode-panel` | Open test editor → spotlight the **cURL Import** mode button (`.mode-btn`, 800ms) → click it to switch to cURL Import mode → spotlight the **paste textarea** (`.curl-mode-panel textarea`, 1000ms) → paste a cURL command: `curl -X POST https://api.example.com/users -H "Authorization: Bearer tok123" -H "Content-Type: application/json" -d '{"name":"Alice"}'` → spotlight the **Import & Switch to Builder** button (800ms) → click it → fields auto-populate (method=POST, URL, headers, body) → spotlight the populated URL input (`.url-input`, 1200ms, explain: cURL import parses the command and fills all fields instantly — URL, method, headers, body, auth) |
| 2 | `th15-curl-export` | cURL Export | `.curl-export-textarea` | Switch to **cURL Export** mode (`.mode-btn`, click) → spotlight the generated cURL command textarea (`.curl-export-textarea`, 1200ms) → spotlight the **Copy to Clipboard** button (800ms) → spotlight the **Refresh** button (600ms, explain: when auth is OAuth2, the export acquires a real token and includes it. Click Refresh to regenerate with a fresh token) → switch back to Builder mode |
| 3 | `th15-editor-menus` | Import & Export Menus | `.mode-btn-dropdown` | Spotlight the **Import ▾** dropdown button → click to open → spotlight the dropdown showing: **Test Definition** (load .json) and **Data Rows** (CSV/JSON into Data Source) (1000ms) → close → spotlight the **Export ▾** dropdown → click to open → spotlight the dropdown showing: **Test Definition**, **Excel Template**, **Data as CSV**, **Data as JSON** (1200ms, explain: the test editor gives you multiple import/export paths — full test definitions, structured Excel templates, or raw data rows for the Data Source tab) → close dropdown → close editor |
| 4 | `th15-fg-export-versions` | FG Export with Version Options | `.export-opts-popover` | Spotlight the **Export** button on the FG card (`.feature-group-actions`, 800ms) → click to open the **Export Options** popover → spotlight the version checkboxes: Response Versions, Rules Versions, Definition Versions, Structure History with counts (1200ms, explain: version data can be large — choose what to include based on whether you need the full history or just current state. Uncheck to reduce file size for sharing) → click Cancel to close |
| 5 | `th15-auto-report` | Auto-Report Toggle | `.selection-actions` | Navigate to **Runner** tab → spotlight the **Auto-report** checkbox in the scenario selector toolbar (1000ms) → enable it → spotlight the format dropdown showing HTML, JSON, Markdown options (1000ms, explain: auto-report generates and downloads a shareable standalone report every time a run completes — ideal for CI pipelines or team sharing. HTML gives a rich visual report, JSON for programmatic consumption, Markdown for docs) |

**Cleanup:** Close test editor if open. Delete seeded FG.

---

## TH-16: Advanced Search & Drag-Drop

**Goal:** Use boolean search operators to find tests across all properties, reorganize your test hierarchy with copy/move actions, and understand the unassigned Feature Groups section.

| Field | Value |
|---|---|
| `id` | `th-advanced-search` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded env with 2 FGs containing 3 scenarios, 6+ tests across different URLs, methods, and tags, so search, copy, and move have meaningful targets.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th16-search-filter` | Search & Boolean Operators | `HAR.SEARCH_INPUT` | Spotlight the **Search bar** (`.builder-search-input`, 800ms) → type "user" → spotlight the tree filtering: only matching items visible, tests highlighted with `.search-match` accent border (1200ms) → spotlight the **match count** badge (`.builder-search-count`, 800ms) → clear → type `POST AND users` → spotlight results filtering to POST tests with "users" (1200ms, explain: search uses boolean AND/OR/NOT with parentheses, searching across name, URL, method, headers, body, auth type, and tags) → clear search |
| 2 | `th16-search-help` | Search Syntax Help Panel | `.search-help` | Spotlight the **?** help icon button (800ms) → click to open the syntax help panel → spotlight the panel showing: substring, "exact phrase", AND/OR/NOT, grouping with parentheses, `-term` exclusion (1200ms) → close the help panel |
| 3 | `th16-copy-test` | Copy Test to Another Scenario | `.popup-modal` | Spotlight the **Copy** button on a test card (`.test-card-actions`, 800ms) → click to open the **Copy Test To...** modal → spotlight the modal with FG and Scenario dropdowns (1200ms, explain: copy creates an independent duplicate in the target location — changes to the copy don't affect the original) → close the modal |
| 4 | `th16-move-test` | Move Test Between Scenarios | `.popup-modal` | Spotlight the **Move** button on a test card (800ms) → click to open the **Move Test** modal → spotlight the Target Feature Group dropdown and Target Scenario dropdown (1200ms, explain: move relocates the test permanently — the original location loses it. This is useful for reorganizing as your suite grows) → close the modal |
| 5 | `th16-test-actions` | Test Card Action Bar | `.test-card-actions` | Spotlight the full action bar on a test card showing all available actions: **Edit**, **Copy**, **Move**, **Export**, **Delete** (1500ms, explain: every test card has inline action buttons for quick access. The drag handle ⠿ on the left lets you reorder tests within a scenario or drag between scenarios and Feature Groups) → spotlight the drag handle (`.drag-handle`, 800ms) |

**Cleanup:** Clear search. Close any open modals. Delete seeded FGs.

---

## TH-17: Data Mapper Expressions & DSL Editor

**Goal:** Explore the Expression Editor's three-panel layout (function catalog, Monaco editor, documentation/snippets), the step-through debugger, and the DSL Rules editor with syntax highlighting, autocomplete, inline verification, and the reference panel.

| Field | Value |
|---|---|
| `id` | `th-mapper-expressions-dsl` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded test with selective validation, sample JSON response, and at least 2 expectedFields. Data Mapper opened from the Validation tab. At least one mapping exists so the expression editor can be opened via double-click on a mapped badge.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th17-expression-editor` | Expression Editor Layout | `.dm-expr-modal` | Open the Expression Editor by double-clicking a mapped badge on a target node → spotlight the 3-panel layout (1200ms): **left** = function catalog (`.dm-expr-sidebar`) with 8 categories and search, **center** = Monaco editor with the current expression, **right** = documentation panel (`.dm-expr-docs`) with function details and reusable snippets → spotlight the **live preview** section (`.dm-expr-preview-section`) showing the evaluated value from sample data (1000ms, explain: the expression editor lets you write complex transformations — not just simple `$.path` references) |
| 2 | `th17-catalog-debug` | Function Catalog & Step Debugger | `.dm-expr-sidebar` | Spotlight the function catalog search (`.dm-expr-fn-search`, 800ms) → spotlight the function list filtered by a category (800ms) → spotlight a selected function's documentation in the right panel (`.dm-expr-docs`, 1200ms): signature, description, examples, Insert button → spotlight the **Step Debug** toggle (`.dm-expr-debug-toggle`) in the preview section (800ms) → spotlight the step debugger panel (`.dm-expr-step-debugger`, 1200ms) showing the expression broken into incremental evaluation steps with step badges, expression fragments, and intermediate results |
| 3 | `th17-snippets-templates` | Snippets & Function Templates | `.dm-expr-docs` | Spotlight the **Reusable Snippets** section in the right panel (`.dm-expr-snippets`, 1000ms): shows saved expressions with Use/Delete buttons and a name input for saving the current expression → spotlight the **Function Templates** panel (`.dm-expr-template-panel`, 1000ms): a searchable library of ~35 transformation templates that can be inserted at the cursor, with a "Compose current" checkbox to wrap the existing expression → close the expression editor |
| 4 | `th17-dsl-rules-editor` | DSL Rules Editor & Reference | `.vr-modal-panel` | Click the **Rules** button in the Data Mapper toolbar → spotlight the **Validation Rules Modal** opening in docked mode (1200ms): Monaco editor with custom `validation-dsl` syntax highlighting (operators, paths, values in distinct colors) → spotlight the **Reference** toggle → spotlight the **DSL Reference Panel** (`.vr-reference-pane`, 1200ms): 8 categories (Equality, Comparison, String, Boolean & Null, Type & Existence, Set, Collection, Custom), 34 operator entries with search, Insert, and Copy buttons |
| 5 | `th17-dsl-verify` | DSL Inline Verify | `.vr-modal-panel` | Spotlight the **▶ Verify** button in the Rules modal header (`.vr-modal-action-btn--verify`, 800ms) → spotlight gutter markers on each rule line: green pass bars + inline ✓, red fail bars + inline "← Got: …" annotations (1200ms) → spotlight the **pass/fail stats** in the header (`.vr-modal-stat--pass`, `.vr-modal-stat--fail`, 800ms, explain: inline verify evaluates every DSL rule against the sample response — gutter markers show pass/fail per line, and failing lines show what the API actually returned) → close the Rules modal |

**Cleanup:** Close expression editor and Rules modal if open. Close Data Mapper. Close test editor.

---

## TH-18: Data Source Advanced Features

**Goal:** Explore advanced data source capabilities — per-row detail editing with URL preview and fetch, batch verification with progress tracking, validation contracts for array consistency, and the toolbar's Data Mapper integrations (Populate from API, Map Columns) plus distribution modes.

| Field | Value |
|---|---|
| `id` | `th-data-source-advanced` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded parameterized scenario with 3 data rows, 2 columns (userId: path, expectedName: validate). Test editor open on the test with the Data tab visible.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th18-add-name-column` | Add Validate Column | `HAR.DS_ADD_COLUMN_BTN` | Add a Validate column for `$.name`, populate expected values, and spotlight the Column Order control. |
| 2 | `th18-row-detail` | Row Detail — Admin User | `HAR.ROW_EDIT_BTN` | Open the first row detail, spotlight the Admin User row values and URL preview, then close the modal. |
| 3 | `th18-verify-modal` | Verify & Inspect Modal | `HAR.DS_VERIFY_OPEN_BTN` | Open Verify & Inspect, demonstrate verification controls and row cards, then close the modal. |
| 4 | `th18-contract-panel` | Validation Contract Panel | `HAR.CONTRACT_BTN` | Demonstrate Dynamic/Fixed and Ordered/Unordered validation contract controls, then close the panel. |
| 5 | `th18-toolbar-mappers` | Data Mapper Integrations | `HAR.DS_FROM_API_BTN` | Open From API and Map Columns, then demonstrate Distribution and Validate dropdown options. This is the final step. |

**Implementation note (2026-07-29):** Removed the former Shared Data Sources final step. Shared Data Sources is covered by the dedicated TH-21 lesson, and TH-18 now completes after Data Mapper Integrations.

**Cleanup:** Close all open modals. Delete seeded data.

---

## TH-19: Schema Drift & Repair

**Goal:** Understand how the Data Mapper detects schema changes between API versions, classifies drift severity, shows repair suggestions for broken mappings, and tracks mapping quality via the Health Dashboard.

| Field | Value |
|---|---|
| `id` | `th-schema-drift-repair` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded test with validation mappings and a pre-saved schema snapshot from a "previous API version." The current sample response has 2 new fields added, 1 field removed, and 1 field type changed compared to the snapshot — triggering automatic drift detection when the Data Mapper opens.

**Note:** The drift engine detects four change types: `added` (info), `removed` (breaking if mappings reference it, warning otherwise), `typeChanged` (warning), and `nullableChanged` (info). There is no explicit "renamed" type — renames appear as `removed` + repair suggestion pointing to a similarly-named new field. The Schema Contract UI (strict/lenient mode toggle) exists as an engine only — no toolbar button or mode selector is built yet.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th19-drift-banner` | Schema Drift Detection | `.dm-drift-banner` | Open the Data Mapper for the test → spotlight the **Drift Banner** appearing between header and body (1500ms): shows either "Source schema has breaking changes" (red, with ⛔) or "Source schema changed since last mapping" (amber, with ⚠), a detail line counting added/removed/type-changed fields, and three action buttons: **Show Diff**, **Accept & Update**, and dismiss **×** (explain: the Data Mapper captures a schema snapshot every time you save — when the API response changes shape, drift detection warns you before broken mappings cause silent test failures) |
| 2 | `th19-diff-modal` | Schema Diff Modal | `.dm-diff-shell` | Click **Show Diff** → spotlight the **Schema Diff Modal** (1200ms): tabular view with 7 columns — Severity, Field Path, Change, Saved Type, Current Type, Mappings, Repair → spotlight a **severity badge row**: 🔴 Breaking (removed field with affected mappings), 🟡 Warning (type changed), 🟢 Info (added field) — each row color-coded by severity (1200ms) → spotlight the **Affected Mappings** count badge showing how many mappings reference changed fields (800ms) |
| 3 | `th19-repair` | Repair Suggestions | `.dm-diff-shell` | Spotlight the **Repair** column in the diff modal (1000ms): for removed fields with similarly-named new fields, a 🔧 **Repair** dropdown shows suggestions with confidence percentage (high/medium/low) and an **Apply** button → spotlight the **Apply all repairs** batch button at the top for bulk fixing (800ms, explain: the repair engine uses Levenshtein fuzzy name matching — if `$.userName` was removed and `$.user_name` was added, it suggests the new path with confidence based on edit distance) → close the diff modal |
| 4 | `th19-accept-update` | Accept & Update Snapshot | `.dm-drift-banner` | Spotlight the **Accept & Update** button on the drift banner (1000ms) → click → spotlight the banner dismissing and the mapper returning to normal state (800ms, explain: Accept & Update saves the current response schema as the new baseline — future drift comparisons will be against this version, not the old one. Any remaining broken mappings should be fixed manually before saving) |
| 5 | `th19-health-dashboard` | Mapping Health Dashboard | `HAR.MAPPER_HEALTH` | Spotlight the **Health Dashboard** bar below the toolbar (1200ms): shows Status (Healthy/Warnings/Broken), Coverage % (percentage of response fields covered by mappings), Broken count, Drift warnings count, and Type mismatches count — each with color-coded indicators (green/amber/red) → spotlight the clickable Broken and Drift metrics that open the diff modal when non-zero (1000ms, explain: the Health Dashboard is your continuous quality score — aim for high coverage, zero broken mappings, and zero drift warnings for reliable test results) |

**Cleanup:** Close Data Mapper. Close test editor. Delete seeded data.

---

## TH-20: Baseline & Regression Analysis

**Goal:** Explore the Comparison & Trends tab — set baselines, configure regression thresholds, compare runs side-by-side, view trend charts, and export comparison reports.

| Field | Value |
|---|---|
| `id` | `th-baseline-regression` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `results` |
| `allowedTabs` | `['results']` |

**Prerequisite:** 2 seeded test runs: Run 1 (fast baseline) and Run 2 (slower, with regressions). Run 1 is pre-marked as baseline.

**Note — TH-7 overlap:** TH-7 (step 4) already introduces the ☆ Set Baseline button and mentions the Comparison & Trends tab exists. TH-20 goes deep into the tab's features: baseline list management, thresholds, side-by-side comparison, trends, and export.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th20-baseline-list` | Baseline List & Management | `HAR.TAB_ANALYSIS` | Navigate to Comparison & Trends tab → spotlight the **Baseline List Panel** in the sidebar (1200ms): shows the pre-marked baseline with ★ star, label, and timestamp → spotlight the **Rename** action (click label to edit inline) and **Unmark** button → spotlight the **Set Compare Target** button that opens the CompareActionModal (1000ms, explain: baselines are named reference points stored in the sidebar — rename them for clarity, unmark when no longer needed, and set them as the comparison target for side-by-side analysis) |
| 2 | `th20-thresholds` | Regression Thresholds | `.thresholds-panel` | Spotlight the **Regression Thresholds Panel** in the sidebar (1200ms) — 7 configurable metrics: Avg, P50, P95, P99, P99.9 (% change), TPS drop (%), Error Rate (absolute pp) → spotlight the P95 input and explain the 2× critical multiplier (800ms, explain: set a warning threshold per metric — critical fires at 2× that value; e.g. P95 warn 10% means critical at 20% — tailor to your API's tolerance) → spotlight Save/Cancel actions (600ms) |
| 3 | `th20-comparison` | Run Comparison Panel | `.run-comparison-panel` | Spotlight the **comparison toolbar**: mode badge (Baseline/Ad-hoc) + compare dropdown (1000ms) → the comparison auto-selects the baseline run → spotlight the **Run Comparison Panel** (1500ms): side-by-side metrics table with Baseline vs Current columns, delta % with color-coded indicators (green OK / amber warn / red critical) → spotlight the **sub-tabs**: Overview, Per-Scenario, Regressions, Distribution (1000ms, explain: the comparison panel evaluates every metric's delta against your configured thresholds and color-codes results at a glance) |
| 4 | `th20-trends` | Trend Chart | `.trend-chart-container` | Spotlight the **Show Trend** button in the toolbar (800ms) → click to enable → spotlight the **multi-run trend chart** (1500ms): X-axis = runs over time, Y-axis = selected metric, baseline runs shown as larger orange dots → spotlight the **per-scenario tab** inside the trend chart (1000ms) → spotlight the **scope filter** dropdown: All runs / By service / By service+env (800ms, explain: trends visualize performance over time — baseline runs are highlighted so you can see regression patterns across multiple releases) |
| 5 | `th20-export` | Export Comparison Report | `.run-comparison-export-btn` | Spotlight the **Export ▾** button in the comparison panel (800ms) → spotlight the dropdown menu with **JSON** and **Markdown** format options (1000ms, explain: comparison reports capture the baseline vs current analysis as a shareable document — JSON for CI pipelines, Markdown for PR reviews — includes summary table, per-scenario deltas, and threshold violations) |

**Cleanup:** Remove seeded test runs and baselines.

---

## TH-21: The Workflow Runner

**Goal:** Run workflows as performance tests — select a workflow, configure variables, set trace level, manage variable presets, explore execution config, and learn about CorrelationWait support.

| Field | Value |
|---|---|
| `id` | `th-workflow-runner` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `workflow-runner` |
| `allowedTabs` | `['workflow-runner']` |

**Prerequisite:** At least 1 workflow in the user's workflow list (seeded via demo bridge or gallery samples available). No live execution — focuses on UI tour and configuration.

**Note — Plan vs Actual UI:** Trace levels are **Minimal/Standard/Full/Debug** (not Metrics/Sampled). Variable presets save **variables only** (not full run configs). The Multi-Webhook Testing Panel only appears when CorrelationWait mode is set to "Wait for Real Webhook" (conditional). The lesson covers what every user will see without requiring external webhook infrastructure.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th21-picker` | Workflow Picker | `.workflow-picker` | Navigate to **Workflow Runner** tab → spotlight the **Workflow Picker** dropdown trigger (1000ms) → open it → spotlight the **searchable dropdown panel** with folder navigation, workflow items, and gallery samples (1200ms) → spotlight the **search input** (800ms) → select a workflow → spotlight the **HTTP node summary** showing step count and node labels (1200ms, explain: the picker shows your workflow library with folder drill-down — after selecting, a summary shows the HTTP step pipeline at a glance) |
| 2 | `th21-variables` | Initial Variables & Presets | `.workflow-vars-section` | Spotlight the **Initial Variables** section (1000ms) → spotlight the **editable variable rows**: each row shows variable name (code) + value input → spotlight the **variable actions bar**: Reset, Save preset, and Presets toggle (1000ms) → spotlight the **history panel** when open: saved variable presets with labels, relative timestamps ("2 min ago"), and Restore/Rename/Delete actions (1200ms, explain: variables are the workflow inputs — `{{variableName}}` placeholders in HTTP node URLs, headers, and bodies get replaced at runtime; save presets to quickly switch between test profiles) |
| 3 | `th21-trace-config` | Trace Level & Execution Config | `.wf-runner-inline-options` | Spotlight the **Trace Level** radio buttons: Minimal, Standard, Full, Debug (1200ms) → spotlight the **Sampling** checkbox and threshold input that appear on Full/Debug (800ms, explain: trace level controls how much data is captured per node — Minimal for fast load tests, Full for debugging; Sampling captures every Nth iteration to reduce overhead) → spotlight the **execution config** section: iterations, concurrency, execution mode, think time, resilience settings (1200ms) |
| 4 | `th21-run-button` | Run & Completion Flow | `[data-testid="workflow-runner-run-btn"]` | Spotlight the **▶ Run Workflow** button (1000ms, explain: clicking Run executes the selected workflow with the configured variables, trace level, and execution settings — the live progress panel shows iteration count, timing metrics, and error rate in real time) → spotlight the **completion section** below: banner with request count, duration, and **View Full Results →** link that navigates to the Results Dashboard filtered to workflow runs (1200ms) |
| 5 | `th21-correlation` | CorrelationWait Support | `.wf-runner-correlation-section` | Spotlight the **CorrelationWait Behavior** panel (1200ms, explain: when a workflow includes CorrelationWait nodes, this panel appears with 3 modes — **Auto-Resume** skips the wait for fast testing, **Synthetic Inject** fires a delayed mock payload, **Wait for Real Webhook** pauses until an external callback arrives) → spotlight the **mode radio cards**: Auto-Resume, Synthetic Inject, Wait for Real Webhook (1000ms) → spotlight the **Multi-Webhook Testing Panel** that appears in Wait-for-Real mode: per-node state tracker, payload editor, fire button, and saved scenarios (1200ms) |

**Cleanup:** None needed (no runs executed).

---

## Feature Coverage Matrix

Every Test Harness feature mapped to its lesson:

| Feature | Lesson | Step |
|---|---|---|
| **Testing domain navigation (5 tabs)** | TH-1 | Step 1 |
| **Environment + Microservice scoping** | TH-1 | Step 2 |
| **Gallery import (tests)** | TH-1 | Step 3 |
| **Feature Group hierarchy tree** | TH-1 | Step 4 |
| **Context menu (rename/move/copy/delete)** | TH-1 | Step 4, TH-9 Step 4 |
| **Create Feature Group** | TH-2 | Step 1 |
| **Create Test Scenario (standard kind)** | TH-2 | Step 2 |
| **Create Test (+ Add Test)** | TH-2 | Step 3 |
| **Test Editor — 8 tabs tour** | TH-2 | Step 3 |
| **Configure URL + Method** | TH-2 | Step 4 |
| **Headers configuration** | TH-2 | Step 4 |
| **Fetch Sample Response** | TH-2 | Step 5 |
| **Save test** | TH-2 | Step 6 |
| **Validation modes (None/Selective/Full)** | TH-3 | Steps 1, 6 |
| **Expected Fields + JSONPath** | TH-3 | Step 2 |
| **Field operators (24 operators)** | TH-3 | Step 2 |
| **Assertion presets (categorized menu)** | TH-3 | Step 3 |
| **Data Mapper for validation** | TH-3 | Step 4 |
| **Verify panel (live rule check)** | TH-3 | Step 5 |
| **Full body validation + Exclude Paths** | TH-3 | Step 6 |
| **Extraction (JSONPath → variable)** | TH-3 | Step 7 |
| **Variable chaining `{{var}}`** | TH-3 | Step 7 |
| **Host Selector (3 modes)** | TH-4 | Step 1 |
| **Execution Mode (Sequential/Batch/Pool)** | TH-4 | Step 2 |
| **Concurrency + Iterations config** | TH-4 | Step 2 |
| **Scenario Selector + test count** | TH-4 | Step 3 |
| **Validation Overrides toolbar** | TH-4 | Step 3 |
| **Execution Plan Preview** | TH-4 | Step 4 |
| **Run + Live Progress Panel** | TH-4 | Step 5 |
| **Stop (abort)** | TH-4 | Step 5 |
| **Navigate to Results** | TH-4 | Step 6 |
| **Parameterize tab / Create Parameterized Copy** | TH-5 | Step 1 |
| **Parameterize Wizard (auto-detect `{{variables}}`)** | TH-5 | Step 2 |
| **Data Source grid (inline editor)** | TH-5 | Step 3 |
| **Add data rows + tags** | TH-5 | Step 4 |
| **Column types (path/param/body/header/validate)** | TH-5 | Step 5 |
| **CSV / JSON / Excel import** | TH-5 | Step 6 |
| **Shared Data Sources (create, link, promote)** | TH-5 | Step 7 |
| **Parameterized Runner tab (dedicated surface)** | TH-6 | Step 1 |
| **Parameterized scenario filter (kind=parameterized)** | TH-6 | Step 1 |
| **Row count badges (📊 N rows)** | TH-6 | Steps 1–2 |
| **Test Distribution weights** | TH-6 | Step 2 |
| **Validation Overrides in Parameterized Runner** | TH-6 | Step 2 |
| **Execution Plan (iterations × rows = requests)** | TH-6 | Step 3 |
| **Concurrency with row expansion** | TH-6 | Step 3 |
| **Tag Filter (run subset of data rows)** | TH-6 | Step 4 |
| **Run Parameterized Test button** | TH-6 | Step 5 |
| **Live Progress Panel (parameterized)** | TH-6 | Step 5 |
| **Per-row live progress (✓/✗ per test)** | TH-6 | Step 6 |
| **Data row labels in results** | TH-6 | Step 6 |
| **Re-run Failed Rows** | TH-6 | Step 7 |
| **Fix data → re-run workflow** | TH-6 | Step 7 |
| **Group by Data Row** | TH-6 | Step 8 |
| **Failed Data Rows filter** | TH-6 | Step 8 |
| **Per-row result detail (resolved URL, validation diff)** | TH-6 | Step 8 |
| **Results Dashboard (run list + tabs)** | TH-7 | Step 1 |
| **Run type filter (All/Test/Workflow)** | TH-7 | Step 1 |
| **Metrics Cards (TPS, latency, error rate)** | TH-7 | Step 2 |
| **Response Time Histogram** | TH-7 | Step 2 |
| **Waterfall Breakdown** | TH-7 | Step 2 |
| **Group By (FG/Scenario/Test/DataRow)** | TH-7 | Step 3 |
| **Filter by pass/fail status** | TH-7 | Step 3 |
| **SLA Status Accordion (pass/warn/fail)** | TH-7 | Step 4 |
| **SLA targets per-scenario/test** | TH-7 | Step 4 |
| **Run Comparison Panel** | TH-7 | Step 5 |
| **Set as Baseline** | TH-7 | Step 5 |
| **Regression indicators** | TH-7 | Step 5 |
| **Export (JSON/CSV/HTML/Markdown)** | TH-7 | Step 6 |
| **Load Profile mode (Ramp-Up/Sustained/Spike)** | TH-8 | Step 1 |
| **Visual load curve** | TH-8 | Step 1 |
| **Think Time** | TH-8 | Step 2 |
| **Error Policy (Continue/Stop/Rate)** | TH-8 | Step 2 |
| **Constant Arrival Rate (RPS)** | TH-8 | Step 3 |
| **Live progress charts under load** | TH-8 | Step 4 |
| **Performance metrics (P99.9, peak RPS)** | TH-8 | Step 5 |
| **Performance regression detection** | TH-8 | Step 5 |
| **Test definition versioning** | TH-9 | Step 1 |
| **Version compare (diff)** | TH-9 | Step 1 |
| **Version restore** | TH-9 | Step 1 |
| **Scenario/Test tags** | TH-9 | Step 2 |
| **Tag filtering** | TH-9 | Step 2 |
| **Search (FG/scenario/test)** | TH-9 | Step 3 |
| **Structure Change Log** | TH-9 | Step 3 |
| **Move/Copy tests** | TH-9 | Step 4 |
| **Trash + 5s Undo Toast** | TH-9 | Step 5 |
| **Trash Panel (restore/permanent delete)** | TH-9 | Step 5 |
| **Assertion categories (6 groups, 24+ types)** | TH-10 | Step 1 |
| **Status Code assertion (pattern matching)** | TH-10 | Step 2 |
| **Response Time SLA assertion** | TH-10 | Step 2 |
| **Response Header assertion** | TH-10 | Step 2 |
| **Body Size assertion** | TH-10 | Step 2 |
| **NOT modifier (invert any assertion)** | TH-10 | Step 2 |
| **Numeric Compare assertion** | TH-10 | Step 3 |
| **Date Compare assertion (dynamic references)** | TH-10 | Step 3 |
| **Type Check assertion** | TH-10 | Step 3 |
| **Field Exists assertion** | TH-10 | Step 3 |
| **Array Length assertion** | TH-10 | Step 4 |
| **Array Contains assertion (any/all/none modes)** | TH-10 | Step 4 |
| **Each Element assertion (per-item rule)** | TH-10 | Step 4 |
| **Contains Subset assertion (partial deep match)** | TH-10 | Step 4 |
| **JSON Schema assertion + Generate from Response** | TH-10 | Step 5 |
| **Custom Predicate assertion (expression engine)** | TH-10 | Step 5 |
| **Assertion Presets library** | TH-10 | Step 6 |
| **Save as Preset** | TH-10 | Step 6 |
| **Regex Assertion Builder modal** | TH-10 | Step 7 |
| **Regex Pattern Library** | TH-10 | Step 7 |
| **Data Mapper modal (full visual mapping)** | TH-11 | Step 1 |
| **Source panel (response JSON tree with types)** | TH-11 | Step 2 |
| **Field search in source tree** | TH-11 | Step 2 |
| **Coverage tracking (% HEALTHY badge)** | TH-11 | Steps 2–3 |
| **Auto-map (3-tier name matching)** | TH-11 | Step 3 |
| **Drag-to-map (source → target)** | TH-11 | Step 4 |
| **Operator pill picker (categorized, searchable)** | TH-11 | Step 4 |
| **Array handling (unordered, item count, mode)** | TH-11 | Step 4 |
| **Custom predicates in Data Mapper** | TH-11 | Step 5 |
| **Expression engine ($gt, $sum, $map, $all)** | TH-11 | Step 5 |
| **Code view (target ← source text)** | TH-11 | Step 6 |
| **Preview view (evaluated output)** | TH-11 | Step 6 |
| **Table view (JSON PATH / OPERATOR / VALUE)** | TH-11 | Step 6 |
| **Rules view (DSL syntax)** | TH-11 | Step 6 |
| **Lines view (SVG connection canvas)** | TH-11 | Step 6 |
| **Subtree operations (map/clear/replace)** | TH-11 | Step 7 |
| **Anchor mapping** | TH-11 | Step 7 |
| **Verify All (per-mapping pass/fail badges)** | TH-11 | Step 8 |
| **Fetch & Verify (fresh fetch + verify)** | TH-11 | Step 8 |
| **Response Versions (save/preview/restore/delete)** | TH-12 | Steps 1–2 |
| **Response version badges (SELECTIVE·INCLUDE)** | TH-12 | Step 1 |
| **Response version comparison (side-by-side diff)** | TH-12 | Step 3 |
| **Rules Versions (save/preview/restore/delete)** | TH-12 | Step 4 |
| **Rules version badges (N RULES·UNORDERED)** | TH-12 | Step 4 |
| **Auto-save before restore** | TH-12 | Step 5 |
| **Rules version comparison (diff)** | TH-12 | Step 6 |
| **SLA Targets modal (test-level)** | TH-13 | Step 1 |
| **7 SLA metrics (P50/P95/P99/P99.9/Avg/TPS/Error Rate)** | TH-13 | Step 2 |
| **Warn/Fail two-tier thresholds** | TH-13 | Step 2 |
| **Scope levels (Aggregate/Scenario/Feature Group)** | TH-13 | Step 3 |
| **SLA badge on test cards** | TH-13 | Step 3 |
| **Scenario SLA Summary panel** | TH-13 | Step 4 |
| **Cross-test SLA overview (grouped table)** | TH-13 | Step 4 |
| **Runner SLA Override panel** | TH-13 | Step 5 |
| **SLA override cloning (locked metric, editable thresholds)** | TH-13 | Step 5 |
| **"Was X" hint on overridden values** | TH-13 | Step 5 |
| **SLA compact bar (pass/warn/fail counts)** | TH-13 | Step 6 |
| **SLA Status Accordion in Results** | TH-13 | Step 7 |
| **Per-scope SLA evaluation (aggregate vs per-scenario)** | TH-13 | Step 7 |
| **SLA override indicator in results** | TH-13 | Step 7 |
| **Global auth profiles** | TH-14 | Step 1 |
| **4-level auth inheritance chain (test→scenario→FG→global)** | TH-14 | Step 2 |
| **Effective auth badge (own/scenario/feature/global)** | TH-14 | Step 2 |
| **7 auth types (none/inherit/basic/bearer/apikey/digest/OAuth2)** | TH-14 | Step 3 |
| **Show/Hide secrets toggle** | TH-14 | Step 3 |
| **Verify Auth (live validation)** | TH-14 | Step 4 |
| **Scenario-level auth override** | TH-14 | Step 5 |
| **Test-level auth override (highest priority)** | TH-14 | Step 6 |
| **Auth resolution summary view** | TH-14 | Step 7 |
| **cURL Import (paste → auto-populate test fields)** | TH-15 | Step 1 |
| **cURL Export (with resolved OAuth2 tokens)** | TH-15 | Step 2 |
| **Test JSON Export with version checkboxes** | TH-15 | Step 3 |
| **Feature Group Import/Export** | TH-15 | Step 4 |
| **CSV/Excel/JSON Template Import wizard** | TH-15 | Step 5 |
| **Results Import (CLI/external JSON)** | TH-15 | Step 6 |
| **Auto-Report on Complete (HTML/JSON/Markdown)** | TH-15 | Step 7 |
| **Advanced search (AND/OR/NOT, phrases, parentheses)** | TH-16 | Steps 1–2 |
| **Search across all fields (URL, method, headers, body, auth)** | TH-16 | Step 2 |
| **Match count + syntax help panel** | TH-16 | Step 1 |
| **Drag-and-drop scenarios between FGs** | TH-16 | Step 3 |
| **Drag-and-drop tests (reorder + move)** | TH-16 | Step 4 |
| **Copy Test modal (cross-scenario)** | TH-16 | Step 5 |
| **Move Test/Scenario modal** | TH-16 | Step 5 |
| **Unassigned Feature Groups (assign env/svc)** | TH-16 | Step 6 |
| **Expression Editor (Monaco-based)** | TH-17 | Step 1 |
| **Function catalog (browse/search)** | TH-17 | Step 2 |
| **Inline function documentation** | TH-17 | Step 2 |
| **Live expression preview** | TH-17 | Step 3 |
| **Complex expressions ($map, $filter, $sum, $reduce)** | TH-17 | Step 3 |
| **Step-through expression debugger** | TH-17 | Step 4 |
| **Expression snippets (save/load named)** | TH-17 | Step 5 |
| **Lambda insert templates** | TH-17 | Step 5 |
| **DSL Code Editor (Monaco, custom language)** | TH-17 | Step 6 |
| **DSL syntax highlighting + autocomplete** | TH-17 | Steps 6–7 |
| **DSL Reference Panel (39 entries, 10 categories)** | TH-17 | Step 7 |
| **Bi-directional visual ↔ DSL sync** | TH-17 | Step 7 |
| **DSL line-level verify (pass/fail gutter markers)** | TH-17 | Step 8 |
| **DSL rule/error counts** | TH-17 | Step 8 |
| **Row Detail modal (per-row fetch/validate/notes)** | TH-18 | Step 1 |
| **Verify All modal (batch verify rows)** | TH-18 | Step 2 |
| **Validation Contract panel (dynamic/fixed, ordered/unordered)** | TH-18 | Step 3 |
| **Populate from API (Data Mapper)** | TH-18 | Step 4 |
| **Map Columns (Data Mapper)** | TH-18 | Step 5 |
| **Row Distribution (Sequential/Random/Round-Robin)** | TH-18 | Step 6 |
| **Shared DS Fetch Configuration (URL/method/headers/auth)** | TH-18 | Step 7 |
| **Shared DS Linked Tests list** | TH-18 | Step 7 |
| **Create Test from Shared DS** | TH-18 | Step 7 |
| **Schema snapshot capture + fingerprinting** | TH-19 | Step 1 |
| **Schema drift detection (added/removed/type/renamed)** | TH-19 | Step 1 |
| **Drift Banner (Accept & Update / Show Diff)** | TH-19 | Step 1 |
| **Schema Diff modal (tabular view with severity badges)** | TH-19 | Step 2 |
| **Affected Mappings column** | TH-19 | Step 2 |
| **Severity classification (Breaking/Warning/Info)** | TH-19 | Step 2 |
| **Repair suggestions (Levenshtein fuzzy matching)** | TH-19 | Step 3 |
| **Auto-apply repair (Apply button per suggestion)** | TH-19 | Step 3 |
| **Schema contract modes (Strict/Lenient)** | TH-19 | Step 5 |
| **Mapping Health Dashboard (coverage/broken/drift/mismatch)** | TH-19 | Step 6 |
| **Type mismatch detection + quick-fix** | TH-19 | Step 6 |
| **Set Performance Baseline** | TH-20 | Step 1 |
| **Baseline management (mark/unmark/rename/list)** | TH-20 | Step 1 |
| **Regression thresholds (configurable warn/critical)** | TH-20 | Step 2 |
| **Run Comparison panel (side-by-side deltas)** | TH-20 | Step 3 |
| **Scenario-level regression alerts** | TH-20 | Step 3 |
| **Regression status badges per run (Pass/Warn/Critical)** | TH-20 | Step 4 |
| **Multi-run trend charts** | TH-20 | Step 5 |
| **Per-scenario trend filter** | TH-20 | Step 5 |
| **Response time overlay histogram (baseline vs current)** | TH-20 | Step 5 |
| **Comparison report export (JSON/Markdown)** | TH-20 | Step 6 |
| **Workflow Picker (searchable folder-tree)** | TH-21 | Step 1 |
| **Workflow variables editor (initial values)** | TH-21 | Step 2 |
| **HTTP node summary** | TH-21 | Step 1 |
| **Trace options (Full/Metrics Only/Sampled)** | TH-21 | Step 3 |
| **Run Config Presets (save/load/rename/delete)** | TH-21 | Step 4 |
| **Workflow Runner live progress** | TH-21 | Step 5 |
| **Results Explorer launch from runner** | TH-21 | Step 5 |
| **Correlation Wait config (payload builder, cURL generator)** | TH-21 | Step 6 |
| **Multi-Webhook Testing panel** | TH-21 | Step 7 |
| **Webhook payload presets per node** | TH-21 | Step 7 |
| **Saved webhook test scenarios** | TH-21 | Step 7 |

---

## Not Covered (Handled by Other Lessons or Future Expansion)

| Feature | Covered by |
|---|---|
| Send to Harness from Requests | **REQ-5** `req-send-harness` |
| Send to Harness from Catalog | **CAT-3** `cat-export-requests` |
| Workflow Results Explorer (3-panel replay) | Future **TH-26** |
| Body Builder (visual JSON body construction) | Future **TH-23** |
| CLI test execution | Future **TH-22** |
| Multi-Protocol Harness (Kafka/WS/gRPC scenarios) | Future **TH-24** — protocol lessons also cover |
| Data Mapper Gallery & Profiles | Future **TH-27** |
| Execution Strategies deep dive (5 modes) | Future **TH-28** |

---

## Implementation Priority

| Order | Lesson | Reason |
|---|---|---|
| 1 | TH-1 | Foundation — understand the domain before anything else |
| 2 | TH-2 | Core authoring — can't validate or run without tests |
| 3 | TH-14 | Auth — critical for any real API testing (all tests need auth) |
| 4 | TH-3 | Core value — validation basics (modes, expected fields, verify) |
| 5 | TH-4 | First execution — the "see it work" moment |
| 6 | TH-15 | Import/Export — cURL import is a top productivity feature |
| 7 | TH-10 | Assertion mastery — all 24+ types, NOT modifier, presets, regex builder |
| 8 | TH-11 | Data Mapper — visual validation, auto-map, custom predicates, verify |
| 9 | TH-17 | Expressions & DSL — power-user validation authoring |
| 10 | TH-12 | Validation versioning — response/rules snapshots, compare, restore |
| 11 | TH-19 | Schema drift — contract testing and mapping health |
| 12 | TH-5 | Data authoring — configure the data that powers parameterized tests |
| 13 | TH-18 | Data Source advanced — row detail, verify, populate from API |
| 14 | TH-6 | Parameterized Runner — data-driven execution at scale |
| 15 | TH-7 | Analysis — understand what happened after a run |
| 16 | TH-20 | Baseline & regression — performance tracking over time |
| 17 | TH-8 | Performance — advanced load testing for power users |
| 18 | TH-13 | SLA — define acceptance criteria, evaluate results, runner overrides |
| 19 | TH-21 | Workflow Runner — workflow execution as test harness |
| 20 | TH-16 | Advanced search — power-user organization and navigation |
| 21 | TH-9 | Organization — long-term test management |

---

## Shared Helpers Needed

### New file: `packages/demo-hub/src/lessons/harness/th-demo-helpers.ts`

| Helper | Purpose |
|---|---|
| `seedDemoEnvironmentAndService(ctx)` | Create env + microservice with JSONPlaceholder base URL |
| `seedEmptyFeatureGroup(ctx, name)` | Create blank FG in demo env/svc scope |
| `seedFeatureGroupWithTests(ctx, name, tests[])` | Create FG with scenario + N pre-configured tests |
| `seedParameterizedScenario(ctx, fgName, columns[], rows[])` | Create parameterized scenario with data source |
| `seedSharedDataSource(ctx, name, columns[], rows[])` | Create named shared DS |
| `seedTestRuns(ctx, count, config)` | Create N seeded TestRun records with realistic metrics |
| `seedVersionedTest(ctx, fgName, versions[])` | Create test with version snapshots |
| `openTestEditor(ctx, testName)` | Double-click test row → editor opens |
| `closeTestEditor(ctx)` | Close editor modal |
| `switchTestEditorTab(ctx, tabId)` | Switch to Params/Body/Auth/Headers/Validation/Extract/Data/History |
| `addExpectedField(ctx, jsonPath, operator, value)` | Add a validation field rule |
| `addAssertion(ctx, type, config)` | Add an assertion via preset menu |
| `fetchSampleResponse(ctx)` | Click Fetch Response and wait |
| `runTestRunner(ctx, config)` | Configure and run standard runner |
| `runParameterizedRunner(ctx, config)` | Configure and run param runner |
| `waitForRunComplete(ctx)` | Wait for live progress to finish |
| `navigateToResults(ctx)` | Switch to Results tab |
| `navigateToRunner(ctx, type)` | Switch to runner/param-runner/workflow-runner tab |
| `setTagFilter(ctx, tags)` | Fill runner tag filter input |
| `spotlightExecutionPlan(ctx)` | Highlight execution plan with row breakdown |
| `spotlightPerRowProgress(ctx, testIndex)` | Highlight per-test row progress section |
| `rerunFailedRows(ctx)` | Click Re-run Failed and wait for completion |
| `groupResultsByDataRow(ctx)` | Switch Results grouping to Data Row |
| `filterFailedDataRows(ctx)` | Click Failed Data Rows filter |
| `cleanupHarnessDemo(ctx)` | Delete all demo FGs, shared DS, runs, restore env/svc |
| **TH-10: Assertions Deep Dive** | |
| `openAssertionMenu(ctx)` | Click + Add and wait for categorized menu to render |
| `selectAssertionType(ctx, category, label)` | Pick assertion from menu by category + label |
| `spotlightAssertionRow(ctx, index)` | Highlight the Nth assertion row in the list |
| `toggleAssertionNot(ctx, index)` | Click the NOT toggle on the Nth assertion |
| `configureAssertion(ctx, index, fields)` | Fill assertion config fields (operator, value, jsonPath, etc.) |
| `openPresetsLibrary(ctx)` | Click Presets button and wait for panel |
| `applyPreset(ctx, presetName)` | Select and apply a named assertion preset |
| `openRegexBuilder(ctx)` | Select Regex Builder from assertion menu |
| `selectRegexPattern(ctx, patternName)` | Pick pattern from the pattern library |
| `generateSchemaFromResponse(ctx)` | Click Generate from Response in JSON Schema editor |
| **TH-11: Data Mapper** | |
| `openDataMapper(ctx)` | Click Data Mapper button and wait for modal |
| `toggleMapperFullScreen(ctx)` | Click Full screen toggle |
| `clickAutoMap(ctx)` | Click Auto-map button |
| `clearAllMappings(ctx)` | Click Clear all button |
| `dragSourceToTarget(ctx, sourcePath)` | Drag a source tree node to the target panel |
| `changeOperatorPill(ctx, index, operator)` | Click operator pill on mapping N and select new operator |
| `addCustomPredicate(ctx, expression)` | Add a custom predicate expression |
| `switchMapperView(ctx, view)` | Switch to Code/Preview/Table/Rules/Lines view |
| `mapSubtree(ctx, nodePath)` | Right-click node → Map subtree |
| `clickVerifyAll(ctx)` | Click Verify All and wait for results |
| `clickFetchAndVerify(ctx)` | Click Fetch & Verify and wait |
| `saveMapper(ctx)` | Click Save in the Data Mapper footer |
| **TH-12: Validation Versioning** | |
| `spotlightResponseVersions(ctx)` | Highlight the Response Versions section |
| `spotlightRulesVersions(ctx)` | Highlight the Rules Versions section |
| `previewVersion(ctx, type, index)` | Click Preview on version N (response or rules) |
| `restoreVersion(ctx, type, index)` | Click Restore on version N + confirm |
| `openVersionCompare(ctx, type)` | Click Compare on version section header |
| `selectCompareVersions(ctx, leftIndex, rightIndex)` | Select left/right versions in comparison modal |
| **TH-13: SLA Targets** | |
| `openTestSlaModal(ctx, testName)` | Click 🎯 SLA button on test card |
| `addSlaTarget(ctx, metric, operator, failValue, warnValue?)` | Add a row with metric/operator/thresholds |
| `spotlightSlaMetrics(ctx)` | Highlight the 7 metrics in the dropdown |
| `setSlaScope(ctx, index, scope, name?)` | Set scope level on target N |
| `saveSlaTargets(ctx)` | Click Save on SLA modal |
| `spotlightScenarioSlaPanel(ctx)` | Highlight the Scenario SLA Summary |
| `openRunnerSlaOverride(ctx)` | Click Configure in runner SLA bar |
| `cloneOverride(ctx, index)` | Click Override button on target N |
| `spotlightSlaCompactBar(ctx)` | Highlight the compact pass/warn/fail bar |
| `spotlightSlaAccordion(ctx)` | Highlight the Results SLA accordion |
| **TH-14: Auth & Inheritance** | |
| `seedAuthDemoFg(ctx)` | Create FG with scenarios + global auth profile |
| `openFgAuthPanel(ctx, fgName)` | Click Auth button on FG card |
| `selectGlobalAuthProfile(ctx, profileName)` | Select a global auth profile from dropdown |
| `closeFgAuthPanel(ctx)` | Close FG auth panel |
| `openScenarioAuth(ctx, scenarioName)` | Click Auth on scenario card |
| `configureAuthType(ctx, type, fields)` | Set auth type + fill type-specific fields |
| `clickVerifyAuth(ctx)` | Click Verify Auth and wait for result |
| `toggleSecretVisibility(ctx)` | Click Show/Hide secrets toggle |
| `spotlightAuthBadge(ctx, testSelector)` | Highlight the "Auth: type (source)" badge |
| `spotlightInheritanceHint(ctx)` | Highlight the inheritance preview text |
| **TH-15: Import, Export & cURL** | |
| `clickCurlImport(ctx)` | Click cURL Import in test editor header |
| `pasteCurlCommand(ctx, curl)` | Paste cURL text into the import area |
| `clickCurlExport(ctx)` | Click cURL Export in header |
| `spotlightCurlOutput(ctx)` | Highlight the generated cURL |
| `openExportDropdown(ctx)` | Click Export dropdown in test editor header |
| `clickExportWithOptions(ctx, options)` | Export with version checkbox selections |
| `openCsvImportModal(ctx)` | Click Import Template in page header |
| `configureCsvImport(ctx, config)` | Set file, mode, target FG/scenario |
| `clickImportResults(ctx)` | Click Import in Results tab |
| `toggleAutoReport(ctx, format)` | Enable auto-report with format selection |
| **TH-16: Advanced Search & Drag-Drop** | |
| `openSearchHelp(ctx)` | Click the search ? help icon |
| `typeSearchQuery(ctx, query)` | Fill the search bar with advanced query |
| `spotlightSearchResults(ctx)` | Highlight match count and filtered tree |
| `dragScenarioToFg(ctx, scenarioName, targetFg)` | Drag scenario to another FG |
| `dragTestToScenario(ctx, testName, targetScenario)` | Drag test to another scenario |
| `openCopyModal(ctx, testName)` | Right-click → Copy |
| `openMoveModal(ctx, testName)` | Right-click → Move |
| `assignUnassociatedFg(ctx, fgName, env, svc)` | Assign env/svc to an unassigned FG |
| **TH-17: Expressions & DSL** | |
| `openExpressionEditor(ctx, mappingIndex)` | Double-click mapping to open expression editor |
| `searchFunctionCatalog(ctx, query)` | Search the function catalog |
| `insertFunction(ctx, funcName)` | Insert function from catalog |
| `typeExpression(ctx, expr)` | Type an expression in the Monaco editor |
| `openStepDebugger(ctx)` | Click Debug button in expression editor |
| `spotlightDebugStep(ctx, index)` | Highlight a step in the debugger |
| `saveExpressionSnippet(ctx, name)` | Save current expression as named snippet |
| `openDslEditor(ctx)` | Click Rules in Data Mapper toolbar |
| `typeDslRule(ctx, rule)` | Type a DSL rule in the Monaco editor |
| `openDslReference(ctx)` | Toggle DSL Reference Panel |
| `insertFromReference(ctx, operator)` | Click Insert on a reference entry |
| `verifyDslLines(ctx)` | Click Verify in DSL editor |
| `spotlightGutterMarkers(ctx)` | Highlight pass/fail gutter markers |
| **TH-18: Data Source Advanced** | |
| `openRowDetail(ctx, rowIndex)` | Click row number to open detail modal |
| `fetchSingleRow(ctx)` | Click Fetch in row detail modal |
| `openVerifyAll(ctx)` | Click Verify All in toolbar |
| `openValidationContract(ctx)` | Click Contract in toolbar |
| `setContractMode(ctx, mode)` | Set Dynamic/Fixed and Ordered/Unordered |
| `openPopulateFromApi(ctx)` | Click From API in toolbar |
| `openMapColumns(ctx)` | Click Map Columns in toolbar |
| `setRowDistribution(ctx, mode)` | Select Sequential/Random/Round-Robin |
| `openSharedDsFetchConfig(ctx, dsName)` | Open fetch config for a shared DS |
| `configureSharedDsFetch(ctx, config)` | Set URL/method/headers/auth |
| **TH-19: Schema Drift & Repair** | |
| `seedDriftScenario(ctx)` | Create test with old schema snapshot + changed response |
| `spotlightDriftBanner(ctx)` | Highlight the drift banner |
| `openSchemaDiffModal(ctx)` | Click Show Diff on drift banner |
| `applyRepairSuggestion(ctx, index)` | Click Apply on a repair suggestion |
| `clickAcceptUpdate(ctx)` | Click Accept & Update on drift banner |
| `setSchemaContract(ctx, mode)` | Set Strict/Lenient contract mode |
| `spotlightHealthDashboard(ctx)` | Highlight the mapping health dashboard |
| **TH-20: Baseline & Regression** | |
| `seedTestRunsWithRegression(ctx)` | Create 4 runs with varying performance |
| `clickSetBaseline(ctx)` | Click Set as Baseline on selected run |
| `openBaselineList(ctx)` | Open Baseline List Panel |
| `configureRegressionThresholds(ctx, config)` | Set warn/critical thresholds |
| `clickCompareToBaseline(ctx)` | Click Compare to Baseline |
| `spotlightRegressionBadges(ctx)` | Highlight regression status on runs |
| `toggleTrendChart(ctx)` | Toggle trend visualization |
| `exportComparisonReport(ctx, format)` | Export comparison as JSON/Markdown |
| **TH-21: Workflow Runner** | |
| `seedWorkflowForRunner(ctx, name, nodes[])` | Create a workflow for runner testing |
| `openWorkflowPicker(ctx)` | Click Workflow Picker dropdown |
| `selectWorkflow(ctx, name)` | Select workflow from picker |
| `editWorkflowVariable(ctx, name, value)` | Edit a workflow variable value |
| `setTraceOption(ctx, level)` | Set Full/Metrics Only/Sampled |
| `saveRunConfigPreset(ctx, name)` | Save current config as named preset |
| `loadRunConfigPreset(ctx, name)` | Load a saved preset |
| `runWorkflow(ctx)` | Click Run Workflow |
| `spotlightCorrelationWait(ctx)` | Highlight correlation wait config |
| `openMultiWebhookPanel(ctx)` | Open multi-webhook testing panel |
| `fireWebhook(ctx, nodeId, payload)` | Fire a webhook with payload |

### Reuse from existing infrastructure

- `useDemoHarnessBridge` — existing hook for seeding harness state from demo lessons
- `makeScenario`, `makeTestScenario`, `makeFeatureGroup`, `makeTestRun` — test factories for seeding
- `WF_CONFIG_DEMO_TIMING` equivalent for Harness modals (new: `TH_DEMO_TIMING`)

---

## New Selectors Needed (`src/shared/selectors/har.ts`)

New selector namespace `HAR` for the Test Harness:

| Selector | Target |
|---|---|
| **Navigation & Layout** | |
| `NAV_SCENARIOS` | `[data-testid="nav-tab-scenarios"]` |
| `NAV_RUNNER` | `[data-testid="nav-tab-runner"]` |
| `NAV_PARAM_RUNNER` | `[data-testid="nav-tab-param-runner"]` |
| `NAV_WORKFLOW_RUNNER` | `[data-testid="nav-tab-workflow-runner"]` |
| `NAV_RESULTS` | `[data-testid="nav-tab-results"]` |
| **Feature Groups** | |
| `ADD_FG_BTN` | `[data-testid="har-add-fg-btn"]` |
| `FG_CARD` | `[data-testid="har-fg-card"]` |
| `FG_EXPAND` | `[data-testid="har-fg-expand"]` |
| `ADD_SCENARIO_BTN` | `[data-testid="har-add-scenario-btn"]` |
| `ADD_TEST_BTN` | `[data-testid="har-add-test-btn"]` |
| `IMPORT_BTN` | `[data-testid="har-import-btn"]` |
| `TRASH_BTN` | `[data-testid="har-trash-btn"]` |
| `SHARED_DS_BTN` | `[data-testid="har-shared-ds-btn"]` |
| `SEARCH_BAR` | `[data-testid="har-search-bar"]` |
| `CONTEXT_MENU` | `[data-testid="har-context-menu"]` |
| `TAGS` | `[data-testid="har-tags"]` |
| **Test Editor** | |
| `TEST_EDITOR` | `[data-testid="har-test-editor"]` |
| `EDITOR_URL` | `[data-testid="har-editor-url"]` |
| `EDITOR_METHOD` | `[data-testid="har-editor-method"]` |
| `EDITOR_NAME` | `[data-testid="har-editor-name"]` |
| `SAVE_BTN` | `[data-testid="har-save-btn"]` |
| `FETCH_BTN` | `[data-testid="har-fetch-response-btn"]` |
| `PARAMS_TAB` | `[data-testid="har-tab-params"]` |
| `BODY_TAB` | `[data-testid="har-tab-body"]` |
| `AUTH_TAB` | `[data-testid="har-tab-auth"]` |
| `HEADERS_TAB` | `[data-testid="har-tab-headers"]` |
| `VALIDATION_TAB` | `[data-testid="har-tab-validation"]` |
| `EXTRACT_TAB` | `[data-testid="har-tab-extract"]` |
| `DATA_TAB` | `[data-testid="har-tab-data"]` |
| `HISTORY_TAB` | `[data-testid="har-tab-history"]` |
| **Validation** | |
| `VALIDATION_MODE` | `[data-testid="har-validation-mode"]` |
| `EXPECTED_FIELDS` | `[data-testid="har-expected-fields"]` |
| `ADD_FIELD_BTN` | `[data-testid="har-add-field-btn"]` |
| `FIELD_JSONPATH` | `[data-testid="har-field-jsonpath"]` |
| `FIELD_OPERATOR` | `[data-testid="har-field-operator"]` |
| `FIELD_VALUE` | `[data-testid="har-field-value"]` |
| `ASSERTION_MENU` | `[data-testid="har-assertion-menu"]` |
| `OPEN_MAPPER_BTN` | `[data-testid="har-open-mapper-btn"]` |
| `VERIFY_BTN` | `[data-testid="har-verify-btn"]` |
| `VERIFY_RESULTS` | `[data-testid="har-verify-results"]` |
| **Data Source** | |
| `DS_EDITOR` | `[data-testid="har-ds-editor"]` |
| `DS_ADD_COL_BTN` | `[data-testid="har-ds-add-col"]` |
| `DS_ADD_ROW_BTN` | `[data-testid="har-ds-add-row"]` |
| `DS_IMPORT_BTN` | `[data-testid="har-ds-import"]` |
| `DS_LINK_SHARED` | `[data-testid="har-ds-link-shared"]` |
| **Runners** | |
| `HOST_SELECTOR` | `[data-testid="har-host-selector"]` |
| `EXEC_CONFIG` | `[data-testid="har-exec-config"]` |
| `EXEC_MODE` | `[data-testid="har-exec-mode"]` |
| `CONCURRENCY` | `[data-testid="har-concurrency"]` |
| `ITERATIONS` | `[data-testid="har-iterations"]` |
| `SCENARIO_SELECTOR` | `[data-testid="har-scenario-selector"]` |
| `EXEC_PLAN` | `[data-testid="har-exec-plan"]` |
| `RUN_BTN` | `[data-testid="har-run-btn"]` |
| `STOP_BTN` | `[data-testid="har-stop-btn"]` |
| `LIVE_PROGRESS` | `[data-testid="har-live-progress"]` |
| `THINK_TIME` | `[data-testid="har-think-time"]` |
| `TAG_FILTER` | `[data-testid="har-tag-filter"]` or `.runner-tag-filter-input` |
| `TAG_FILTER_HINT` | `.runner-tag-filter-hint` |
| `ROW_COUNT_BADGE` | `.count-badge-data` |
| `SLA_COUNT_BADGE` | `.count-badge-sla` |
| `WEIGHT_ROW` | `.weight-row` |
| `PER_TEST_PROGRESS` | `.runner-per-test-progress` |
| `RERUN_FAILED_BTN` | `[data-testid="har-rerun-failed"]` |
| `VIEW_RESULTS_BTN` | `[data-testid="har-view-results"]` |
| **Results** | |
| `RESULTS_DASHBOARD` | `[data-testid="har-results-dashboard"]` |
| `RESULTS_RUN_LIST` | `[data-testid="har-results-run-list"]` |
| `METRICS_CARDS` | `[data-testid="har-metrics-cards"]` |
| `RESULTS_GROUP` | `[data-testid="har-results-group-by"]` |
| `SLA_TAB` | `[data-testid="har-sla-tab"]` |
| `SLA_ACCORDION` | `[data-testid="har-sla-accordion"]` |
| `COMPARE_BTN` | `[data-testid="har-compare-btn"]` |
| `BASELINE_BTN` | `[data-testid="har-baseline-btn"]` |
| `EXPORT_BTN` | `[data-testid="har-export-btn"]` |
| **Trash** | |
| `TRASH_PANEL` | `[data-testid="har-trash-panel"]` |
| `TRASH_RESTORE_BTN` | `[data-testid="har-trash-restore"]` |
| `UNDO_TOAST` | `[data-testid="har-undo-toast"]` |
| **Assertions (TH-10)** | |
| `ASSERTION_ROW` | `[data-testid="har-assertion-row"]` |
| `ASSERTION_TYPE_PILL` | `[data-testid="har-assertion-type-pill"]` |
| `ASSERTION_NOT_TOGGLE` | `[data-testid="har-assertion-not-toggle"]` |
| `ASSERTION_DELETE` | `[data-testid="har-assertion-delete"]` |
| `ASSERTION_COPY` | `[data-testid="har-assertion-copy"]` |
| `PRESETS_BTN` | `[data-testid="har-presets-btn"]` |
| `PRESETS_PANEL` | `[data-testid="har-presets-panel"]` |
| `PRESET_SAVE` | `[data-testid="har-preset-save"]` |
| `ASSERTION_COUNT_BADGE` | `[data-testid="har-assertion-count"]` |
| `SCHEMA_EDITOR` | `[data-testid="har-schema-editor"]` |
| `SCHEMA_GENERATE_BTN` | `[data-testid="har-schema-generate"]` |
| `SCHEMA_PASTE_BTN` | `[data-testid="har-schema-paste"]` |
| `SCHEMA_PRETTY_BTN` | `[data-testid="har-schema-pretty"]` |
| `CUSTOM_EXPR_INPUT` | `[data-testid="har-custom-expr-input"]` |
| `CUSTOM_DESC_INPUT` | `[data-testid="har-custom-desc-input"]` |
| `REGEX_BUILDER` | `[data-testid="har-regex-builder"]` |
| `REGEX_PATTERN_LIBRARY` | `[data-testid="har-regex-pattern-library"]` |
| `REGEX_LIVE_PREVIEW` | `[data-testid="har-regex-live-preview"]` |
| `REGEX_TREE_PICKER` | `[data-testid="har-regex-tree-picker"]` |
| **Data Mapper (TH-11)** | |
| `MAPPER_MODAL` | `[data-testid="har-mapper-modal"]` |
| `MAPPER_FULLSCREEN` | `[data-testid="har-mapper-fullscreen"]` |
| `MAPPER_SOURCE` | `[data-testid="har-mapper-source"]` |
| `MAPPER_TARGET` | `[data-testid="har-mapper-target"]` |
| `MAPPER_TOOLBAR` | `[data-testid="har-mapper-toolbar"]` |
| `MAPPER_AUTOMAP` | `[data-testid="har-mapper-automap"]` |
| `MAPPER_CLEAR_ALL` | `[data-testid="har-mapper-clear-all"]` |
| `MAPPER_COVERAGE` | `[data-testid="har-mapper-coverage"]` |
| `MAPPER_VIEW_CODE` | `[data-testid="har-mapper-view-code"]` |
| `MAPPER_VIEW_PREVIEW` | `[data-testid="har-mapper-view-preview"]` |
| `MAPPER_VIEW_TABLE` | `[data-testid="har-mapper-view-table"]` |
| `MAPPER_VIEW_RULES` | `[data-testid="har-mapper-view-rules"]` |
| `MAPPER_VIEW_LINES` | `[data-testid="har-mapper-view-lines"]` |
| `MAPPER_VERIFY` | `[data-testid="har-mapper-verify"]` |
| `MAPPER_FETCH_VERIFY` | `[data-testid="har-mapper-fetch-verify"]` |
| `MAPPER_PREDICATES` | `[data-testid="har-mapper-predicates"]` |
| `MAPPER_ADD_PREDICATE` | `[data-testid="har-mapper-add-predicate"]` |
| `MAPPER_OPERATOR_PILL` | `[data-testid="har-mapper-operator-pill"]` |
| `MAPPER_SAVE` | `[data-testid="har-mapper-save"]` |
| `MAPPER_ANCHOR` | `[data-testid="har-mapper-anchor"]` |
| `MAPPER_SUBTREE_MENU` | `[data-testid="har-mapper-subtree-menu"]` |
| **Validation Versioning (TH-12)** | |
| `RESPONSE_VERSIONS` | `[data-testid="har-response-versions"]` |
| `RESPONSE_SAVE_VERSION` | `[data-testid="har-response-save-version"]` |
| `RULES_VERSIONS` | `[data-testid="har-rules-versions"]` |
| `RULES_SAVE_VERSION` | `[data-testid="har-rules-save-version"]` |
| `VERSION_PREVIEW_BTN` | `[data-testid="har-version-preview"]` |
| `VERSION_RESTORE_BTN` | `[data-testid="har-version-restore"]` |
| `VERSION_DELETE_BTN` | `[data-testid="har-version-delete"]` |
| `VERSION_COMPARE_BTN` | `[data-testid="har-version-compare"]` |
| `VERSION_BADGE` | `[data-testid="har-version-badge"]` |
| `VERSION_DIFF_MODAL` | `[data-testid="har-version-diff-modal"]` |
| `VERSION_CURRENT_TAG` | `[data-testid="har-version-current"]` |
| **SLA Targets (TH-13)** | |
| `SLA_BTN` | `[data-testid="har-sla-btn"]` |
| `SLA_MODAL` | `[data-testid="har-sla-modal"]` |
| `SLA_TARGET_ROW` | `[data-testid="har-sla-target-row"]` |
| `SLA_METRIC_DROPDOWN` | `[data-testid="har-sla-metric"]` |
| `SLA_OPERATOR` | `[data-testid="har-sla-operator"]` |
| `SLA_FAIL_VALUE` | `[data-testid="har-sla-fail-value"]` |
| `SLA_WARN_VALUE` | `[data-testid="har-sla-warn-value"]` |
| `SLA_SCOPE` | `[data-testid="har-sla-scope"]` |
| `SLA_ADD_TARGET` | `[data-testid="har-sla-add-target"]` |
| `SLA_SAVE_BTN` | `[data-testid="har-sla-save"]` |
| `SLA_BADGE` | `[data-testid="har-sla-badge"]` |
| `SCENARIO_SLA_PANEL` | `[data-testid="har-scenario-sla-panel"]` |
| `RUNNER_SLA_OVERRIDE` | `[data-testid="har-runner-sla-override"]` |
| `SLA_OVERRIDE_BTN` | `[data-testid="har-sla-override-btn"]` |
| `SLA_COMPACT_BAR` | `[data-testid="har-sla-compact-bar"]` |
| **Auth (TH-14)** | |
| `AUTH_PROFILE` | `[data-testid="har-auth-profile"]` |
| `AUTH_PANEL` | `[data-testid="har-auth-panel"]` |
| `AUTH_TYPE_SELECT` | `[data-testid="har-auth-type-select"]` |
| `AUTH_INHERIT_HINT` | `[data-testid="har-auth-inherit-hint"]` |
| `AUTH_VERIFY` | `[data-testid="har-auth-verify"]` |
| `AUTH_VERIFY_RESULT` | `[data-testid="har-auth-verify-result"]` |
| `AUTH_SECRETS_TOGGLE` | `[data-testid="har-auth-secrets-toggle"]` |
| `AUTH_BADGE` | `[data-testid="har-auth-badge"]` |
| `SCENARIO_AUTH` | `[data-testid="har-scenario-auth"]` |
| **Import/Export (TH-15)** | |
| `CURL_IMPORT` | `[data-testid="har-curl-import"]` |
| `CURL_PASTE_AREA` | `[data-testid="har-curl-paste-area"]` |
| `CURL_EXPORT` | `[data-testid="har-curl-export"]` |
| `CURL_OUTPUT` | `[data-testid="har-curl-output"]` |
| `EXPORT_DROPDOWN` | `[data-testid="har-export-dropdown"]` |
| `EXPORT_VERSION_OPTS` | `[data-testid="har-export-version-opts"]` |
| `FG_EXPORT` | `[data-testid="har-fg-export"]` |
| `FG_IMPORT` | `[data-testid="har-fg-import"]` |
| `IMPORT_TEMPLATE` | `[data-testid="har-import-template"]` |
| `CSV_IMPORT_MODAL` | `[data-testid="har-csv-import-modal"]` |
| `CSV_DROP_ZONE` | `[data-testid="har-csv-drop-zone"]` |
| `CSV_IMPORT_MODE` | `[data-testid="har-csv-import-mode"]` |
| `CSV_PARSE_PREVIEW` | `[data-testid="har-csv-parse-preview"]` |
| `IMPORT_RESULTS` | `[data-testid="har-import-results"]` |
| `AUTO_REPORT` | `[data-testid="har-auto-report"]` |
| **Search & Drag-Drop (TH-16)** | |
| `SEARCH_HELP` | `[data-testid="har-search-help"]` |
| `SEARCH_MATCH_COUNT` | `[data-testid="har-search-match-count"]` |
| `DRAG_HANDLE` | `[data-testid="har-drag-handle"]` |
| `DROP_ZONE` | `[data-testid="har-drop-zone"]` |
| `COPY_TEST_MODAL` | `[data-testid="har-copy-test-modal"]` |
| `MOVE_MODAL` | `[data-testid="har-move-modal"]` |
| `UNASSIGNED` | `[data-testid="har-unassigned-section"]` |
| **Expression & DSL Editor (TH-17)** | |
| `MAPPER_EXPR` | `[data-testid="har-mapper-expr-editor"]` |
| `MAPPER_FUNCTIONS` | `[data-testid="har-mapper-function-catalog"]` |
| `MAPPER_DEBUG` | `[data-testid="har-mapper-debug-btn"]` |
| `MAPPER_DEBUG_STEPS` | `[data-testid="har-mapper-debug-steps"]` |
| `MAPPER_SNIPPETS` | `[data-testid="har-mapper-snippets"]` |
| `MAPPER_DSL` | `[data-testid="har-mapper-dsl-editor"]` |
| `MAPPER_DSL_REF` | `[data-testid="har-mapper-dsl-reference"]` |
| `MAPPER_DSL_VERIFY` | `[data-testid="har-mapper-dsl-verify"]` |
| `MAPPER_DSL_GUTTER` | `.mapper-dsl-gutter-marker` |
| **Data Source Advanced (TH-18)** | |
| `DS_ROW_DETAIL` | `[data-testid="har-ds-row-detail"]` |
| `DS_ROW_FETCH` | `[data-testid="har-ds-row-fetch"]` |
| `DS_ROW_NOTES` | `[data-testid="har-ds-row-notes"]` |
| `DS_VERIFY` | `[data-testid="har-ds-verify-all"]` |
| `DS_VERIFY_MODAL` | `[data-testid="har-ds-verify-modal"]` |
| `DS_CONTRACT` | `[data-testid="har-ds-contract"]` |
| `DS_CONTRACT_PANEL` | `[data-testid="har-ds-contract-panel"]` |
| `DS_FROM_API` | `[data-testid="har-ds-from-api"]` |
| `DS_MAP_COLUMNS` | `[data-testid="har-ds-map-columns"]` |
| `DS_DISTRIBUTION` | `[data-testid="har-ds-distribution"]` |
| `SHARED_DS_FETCH` | `[data-testid="har-shared-ds-fetch"]` |
| `SHARED_DS_LINKED` | `[data-testid="har-shared-ds-linked"]` |
| **Schema Drift (TH-19)** | |
| `MAPPER_DRIFT` | `[data-testid="har-mapper-drift-banner"]` |
| `MAPPER_DIFF` | `[data-testid="har-mapper-diff-modal"]` |
| `MAPPER_REPAIR` | `[data-testid="har-mapper-repair"]` |
| `MAPPER_ACCEPT` | `[data-testid="har-mapper-accept-update"]` |
| `MAPPER_CONTRACT` | `[data-testid="har-mapper-contract"]` |
| `MAPPER_HEALTH` | `[data-testid="har-mapper-health-dashboard"]` |
| **Baseline & Regression (TH-20)** | |
| `BASELINE_BTN` | `[data-testid="har-baseline-btn"]` |
| `BASELINE_LIST` | `[data-testid="har-baseline-list"]` |
| `BASELINE_STAR` | `[data-testid="har-baseline-star"]` |
| `REGRESSION_CONFIG` | `[data-testid="har-regression-config"]` |
| `REGRESSION_BADGE` | `[data-testid="har-regression-badge"]` |
| `COMPARE_BTN` | `[data-testid="har-compare-btn"]` |
| `COMPARISON_PANEL` | `[data-testid="har-comparison-panel"]` |
| `TREND_CHART` | `[data-testid="har-trend-chart"]` |
| `COMPARISON_EXPORT` | `[data-testid="har-comparison-export"]` |
| **Workflow Runner (TH-21)** | |
| `WF_PICKER` | `[data-testid="har-wf-picker"]` |
| `WF_VARIABLES` | `[data-testid="har-wf-variables"]` |
| `WF_TRACE` | `[data-testid="har-wf-trace"]` |
| `WF_PRESETS` | `[data-testid="har-wf-presets"]` |
| `WF_RUN` | `[data-testid="har-wf-run"]` |
| `WF_CORRELATION` | `[data-testid="har-wf-correlation"]` |
| `WF_WEBHOOK` | `[data-testid="har-wf-webhook"]` |
| `WF_PROGRESS` | `[data-testid="har-wf-progress"]` |

---

## Domain Registration

Update `packages/demo-hub/src/lessons/index.ts`:

```typescript
export const harnessDomain: DemoDomain = {
  id: 'harness',
  name: 'Test Harness',
  icon: '🧪',
  description: 'Build, validate, and run API test suites — from simple smoke tests to data-driven load profiles.',
  available: true,  // ← enable
  categories: [
    { id: 'fundamentals', label: 'Fundamentals', icon: '📐' },
    { id: 'validation',   label: 'Validation & Assertions', icon: '✓' },
    { id: 'data-driven',  label: 'Data-Driven Testing', icon: '📊' },
    { id: 'execution',    label: 'Runners & Execution', icon: '▶' },
    { id: 'analysis',     label: 'Results & Analysis', icon: '📈' },
  ],
  lessons: harnessLessons,
};
```

Category mapping:
- **Fundamentals:** TH-1, TH-2, TH-14, TH-15, TH-16
- **Validation & Assertions:** TH-3, TH-10, TH-11, TH-12, TH-17, TH-19
- **Data-Driven Testing:** TH-5, TH-6, TH-18
- **Runners & Execution:** TH-4, TH-8, TH-13, TH-21
- **Results & Analysis:** TH-7, TH-9, TH-20

---

## Timing & Pacing Guidelines

Test Harness lessons involve form-heavy interactions (editor tabs, data grids, modal cascades). Delays need to account for complex UI renders:

| Action | Minimum delay |
|---|---|
| Modal opens (editor, Data Mapper, Trash) | 1000ms settle + 800ms before interaction |
| Tab switch inside editor | 800ms |
| Fill a form field (URL, JSONPath, value) | 600ms after |
| Dropdown opens + selection | 400ms open + 600ms after select |
| Fetch Response (real HTTP call) | Wait for result + 1500ms to read |
| Verify run (multiple assertions) | Wait for all + 1200ms on results |
| Runner starts (live progress) | 1000ms for panel + let natural execution |
| Run completes → results summary | 1500ms on final state |
| Search filter applies | 800ms for re-render |
| Undo toast appears | 1200ms (let countdown be visible) |
| Data grid row add | 400ms per row |
| CSV import mapping step | 1200ms settle |

**Total per step:** A 5-beat step should last 15–25 seconds at 1× speed.

---

## Relationship to Existing Content

### Cross-references from these lessons:

| This Lesson | References | Lesson |
|---|---|---|
| TH-1 Step 3 (Gallery import) | "For how to promote from Requests, see..." | REQ-5 |
| TH-2 Step 3 (Auth tab in tour) | "For a deep dive into all auth types..." | TH-14 |
| TH-3 Step 4 (Data Mapper) | "For the full Data Mapper deep dive..." | TH-11 |
| TH-3 Step 3 (Assertion presets) | "For all assertion types and Regex Builder..." | TH-10 |
| TH-5 Step 7 (Shared DS) | "For advanced shared DS fetch config..." | TH-18 Step 7 |
| TH-6 Step 4 (Tag Filter) | Cross-ref tag authoring | TH-5 Step 4 |
| TH-6 Step 8 (Data Row Results) | Cross-ref Results Dashboard details | TH-7 |
| TH-7 Step 5 (Baseline) | "For full baseline & regression management..." | TH-20 |
| TH-8 (Load testing) | "For workflow-based load testing..." | TH-21 |
| TH-10 Step 5 (Custom predicates) | "Same expression engine as the Data Mapper" | TH-11 Step 5 |
| TH-11 Step 5 (Expressions) | "For the expression editor deep dive..." | TH-17 |
| TH-11 Step 6 (Rules/DSL view) | "For the full DSL editor..." | TH-17 Step 6 |
| TH-11 Step 6 (Table view) | "Same rules table as Validation tab" | TH-3 Step 2 |
| TH-12 (Validation versioning) | "Test definition versioning is separate — see..." | TH-9 Step 1 |
| TH-13 Step 6 (SLA compact bar) | "For detailed SLA results analysis..." | TH-7 Step 4 |
| TH-13 Step 5 (Runner overrides) | "Runner config and execution details..." | TH-4 |
| TH-8 Step 5 (Performance results) | "For SLA target authoring..." | TH-13 |
| TH-14 Step 1 (Global profiles) | "Global profiles are defined in Environment Manager" | ENV lesson |
| TH-15 Step 5 (CSV import) | "For data source setup..." | TH-5 |
| TH-15 Step 7 (Auto-report) | "For runner execution details..." | TH-4 |
| TH-17 Step 3 (Expressions) | "For Data Mapper visual mapping basics..." | TH-11 |
| TH-18 Step 4 (Populate from API) | "For Data Mapper operation basics..." | TH-11 |
| TH-19 (Schema drift) | "For Data Mapper basics..." | TH-11 |
| TH-20 (Regression) | "For SLA target configuration..." | TH-13 |
| TH-21 Step 5 (Results Explorer) | "For Results Dashboard overview..." | TH-7 |

### Training path alignment:

| Training Path Phase | Demo Lesson Equivalent |
|---|---|
| Phase 1 — Getting Started | TH-1, TH-2, TH-14 |
| Phase 1b — Productivity Tools | TH-15, TH-16 |
| Phase 2 — Intermediate Suites | TH-3, TH-4 |
| Phase 2b — Validation Mastery | TH-10, TH-11, TH-17, TH-12, TH-19 |
| Phase 3 — Advanced Suites | TH-8, TH-13, TH-20 |
| Phase 4 — Parameterized Testing | TH-5, TH-18, TH-6 |
| Phase 5 — Shared Data Sources | TH-5 Step 7, TH-18 Step 7 |
| Phase 6 — Runners & Scenario Types | TH-4, TH-6, TH-8, TH-21 |
| Phase 7 — Advanced Analysis | TH-7, TH-20, TH-9 |

---

## Future Expansion (Phase 2)

After the core 21 lessons are complete, consider:

| Lesson | Focus |
|---|---|
| TH-22 | CI/CD Integration — CLI execution, JSON export for CI, exit codes, report artifacts, pipeline templates |
| TH-23 | Body Builder & Request Templates — visual JSON body construction (3-mode), `{{variable}}` substitution, bi-directional sync |
| TH-24 | Multi-Protocol Harness — Kafka/WS/gRPC test scenarios (non-workflow), transport-specific assertions |
| TH-25 | Parameterized Load Testing — data-driven load profiles, per-row SLA targets, large-scale row execution |
| TH-26 | Workflow Results Explorer — 3-panel explorer, execution canvas, timeline, iteration matrix, console, bottleneck analysis, fork/join detection |
| TH-27 | Data Mapper Gallery & Profiles — gallery presets, example inference ("Learn from Examples"), mapping profiles, array mapping detection |
| TH-28 | Execution Strategies — 5 execution modes deep dive (Sequential/Batch/Pool/Load/Constant Arrival), resilience controls, test weights, runtime overrides |

> **Note:** Features previously in Future Expansion that are now core lessons: Auth (TH-14), Import/Export (TH-15), Schema Drift (TH-19), DSL Editor (TH-17), Baseline/Regression (TH-20), Workflow Runner (TH-21), Advanced Search (TH-16), Data Source Advanced (TH-18).

---

## Gallery Samples Used for Seeding

These existing gallery samples are leveraged for lesson seeding where appropriate:

| Sample | Used in |
|---|---|
| `test-user-api-smoke` | TH-1 gallery import demo |
| `test-param-user-sweep` | TH-5 concept reference (structure example) |
| `test-shared-user-ids` | TH-5 Step 7 shared DS pattern |
| `test-api-health-sla` | TH-6 SLA reference |
| `test-performance-regression-baseline` | TH-7 baseline reference |
| `test-auth-chain-demo` | TH-14 auth inheritance demo FG |
| `test-export-versioned` | TH-15 versioned export demo |
| `test-search-diverse-suite` | TH-16 diverse test suite for search demo |
| `test-drift-before-after` | TH-19 schema drift scenario (old vs new response) |
| `test-regression-runs-4x` | TH-20 four runs with varying performance |
| `workflow-user-registration` | TH-21 HTTP-only workflow for runner demo |
| `workflow-order-webhook` | TH-21 webhook/correlation-wait workflow |

However, **no gallery import is used as the primary teaching vehicle** (except TH-1 Step 3 as a brief overview). All other lessons author tests from scratch so the viewer understands construction, not just consumption.
