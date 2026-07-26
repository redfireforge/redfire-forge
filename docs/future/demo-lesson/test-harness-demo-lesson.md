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
| **Total** | | | **83** | **~87 min** | |

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
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios', 'runner', 'param-runner', 'workflow-runner', 'results']` |

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th1-domain-tour` | The Testing Domain | `APP.NAV_HARNESS` | Navigate to **Testing** in the activity bar → spotlight the 5 sub-nav tabs: **Feature Groups**, **Test Runner**, **Parameterized Runner**, **Workflow Runner**, **Results** (1000ms each) → explain: Feature Groups is where you author tests, the runners execute them, Results stores history |
| 2 | `th1-env-scope` | Environment & Microservice Scoping | `APP.ENV_SELECTOR` | Spotlight the **Environment** selector in the header (1000ms) → select an environment → spotlight the **Microservice** selector (1000ms) → select a microservice → spotlight the empty Feature Groups area + explain: all tests you create are scoped to this env/svc pair. Switch env → show different (or empty) test set → switch back |
| 3 | `th1-import-gallery` | Import from Gallery | `HAR.IMPORT_BTN` | Click **Import** button → spotlight the import modal → switch to **Gallery** tab → spotlight available test samples (1200ms, explain: pre-built test suites for learning) → select **User API Smoke Test** → spotlight the preview (endpoint list, assertion counts, difficulty badge — 1000ms) → click **Import** → Feature Group appears in tree |
| 4 | `th1-tree-nav` | Navigate the Test Hierarchy | `HAR.FG_CARD` | Spotlight the imported **Feature Group** card → expand it → spotlight the **Test Scenario** container (kind badge: "Standard") → expand scenario → spotlight individual **Test** rows (method + URL + status dot — 1200ms) → spotlight the **test count badges** on FG and scenario level → spotlight the context menu (⋮) on a test row (rename, move, copy, delete — 1000ms) |
| 5 | `th1-tabs-preview` | Preview the Other Tabs | `APP.SUBNAV` | Click **Test Runner** tab → spotlight empty runner waiting for scenarios (800ms) → click **Parameterized Runner** → spotlight "No parameterized scenarios" message (800ms) → click **Results** → spotlight empty dashboard (800ms) → return to **Feature Groups** → explain: we'll fill these tabs in the upcoming lessons |

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
| 1 | `th2-create-fg` | Create a Feature Group | `HAR.ADD_FG_BTN` | Click **+ Add Feature Group** → spotlight the inline name input (800ms) → type "JSONPlaceholder API" → confirm (Enter) → spotlight the new FG card with expand arrow and action buttons (1200ms, explain: Feature Groups organize tests by API area or business capability) |
| 2 | `th2-create-scenario` | Create a Test Scenario | `HAR.ADD_SCENARIO_BTN` | Click **+ Add Scenario** within the FG → spotlight **Scenario name** input → type "Posts CRUD" → select kind: **Standard** → confirm → spotlight the scenario with its empty test list and kind badge (1000ms, explain: Standard scenarios run each test once per iteration; Parameterized scenarios run tests once per data row) |
| 3 | `th2-create-test` | Create Your First Test | `HAR.ADD_TEST_BTN` | Click **+ Add Test** → spotlight the **Test Editor** modal opening (1000ms) → spotlight the **8 tabs** across the top: Params, Body, Auth, Headers, Validation, Extract, Data, History (1500ms, explain: each tab configures a different aspect of the HTTP request and its validation) |
| 4 | `th2-configure-request` | Configure the HTTP Request | `HAR.TEST_EDITOR` | In the **Params** tab → spotlight **URL** field → type `https://jsonplaceholder.typicode.com/posts/1` (800ms) → spotlight **Method** selector → select **GET** (600ms) → spotlight the **test name** field (auto-populated from URL, editable) → rename to "Get Post by ID" → switch to **Headers** tab → spotlight empty headers table → add `Accept: application/json` row (800ms) |
| 5 | `th2-fetch-response` | Fetch a Sample Response | `HAR.FETCH_BTN` | Switch to **Validation** tab → spotlight **Fetch Response** button (800ms, explain: sends the request once to capture a sample response for validation setup) → click Fetch → spotlight the **loading spinner** → response arrives → spotlight the **response preview** panel showing JSON with `userId`, `id`, `title`, `body` fields (1500ms) → spotlight **status 200** badge |
| 6 | `th2-save-test` | Save and See the Tree | `HAR.SAVE_BTN` | Click **Save** in the editor footer → modal closes → spotlight the new test row in the tree: **GET** badge + "Get Post by ID" + green dot (1200ms) → expand FG to show the full hierarchy: FG → Scenario → Test → spotlight the count badge updated to "1 test" (1000ms) |

**Cleanup:** Keep the created FG for TH-3 usage (or rely on `preAction` seeding).

---

## TH-3: Validation & Assertions

**Goal:** Add validation rules to tests — understand the three validation modes, configure expected fields with operators, add assertion presets, use the Data Mapper for visual validation, and verify rules against live responses. This is the overview lesson; see **TH-10** (Assertions Deep Dive), **TH-11** (Data Mapper), and **TH-12** (Validation Versioning) for dedicated deep dives.

| Field | Value |
|---|---|
| `id` | `th-validation-assertions` |
| `estimatedMinutes` | 8 |
| Steps | 7 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG with "Posts CRUD" scenario containing a GET /posts/1 test with a fetched sample response.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th3-modes` | Validation Modes | `HAR.VALIDATION_MODE` | Open the GET /posts/1 test editor → **Validation** tab → spotlight the **Mode** selector (1200ms): **None** (no checking), **Selective** (check specific fields), **Full** (deep body comparison) → select **Selective** → spotlight the mode switching (800ms, explain: Selective is the most common — check what matters, ignore the rest) |
| 2 | `th3-expected-fields` | Expected Fields & Operators | `HAR.EXPECTED_FIELDS` | Spotlight the **Expected Fields** section → click **+ Add Field** → spotlight **JSONPath** input → type `$.userId` → spotlight **Operator** dropdown (1200ms): equals, contains, regex, greater_than, is_not_empty, type_is, between, … (24 operators) → select **equals** → type expected value `1` → Save row → add second field: `$.title` with operator **is_not_empty** → spotlight the two rules (1500ms) |
| 3 | `th3-assertions` | Assertion Presets | `HAR.ASSERTION_MENU` | Spotlight the **+ Add Assertion** button → click → spotlight the **categorized assertion menu** (1200ms): Status (2xx, 4xx patterns), Timing (< 500ms), Headers (content-type), Body (array length, regex), Type checks → click **Status — 2xx Success** → assertion row appears: "Status matches 2xx" → click **Response Time < 1000ms** → second assertion row appears (1000ms) → spotlight both assertions with their inline edit controls |
| 4 | `th3-data-mapper` | Visual Validation (Data Mapper) | `HAR.OPEN_MAPPER_BTN` | Spotlight **Open Data Mapper** button below expected fields (800ms) → click → Data Mapper modal opens → spotlight **source tree** (response JSON: userId, id, title, body — 1200ms) → spotlight **target tree** (validation rules) → drag `$.userId` from source to target → operator pill appears (equals) → set value `1` → spotlight the **connection line** between source and target (1000ms) → click **Done** → rules sync back to expected fields list |
| 5 | `th3-verify` | Verify Against Live Response | `HAR.VERIFY_BTN` | Spotlight the **Verify** button in the validation tab footer (800ms) → click → verification runs → spotlight **pass/fail badges** on each field rule (green ✓ for `$.userId === 1`, green ✓ for `$.title is_not_empty`) → spotlight assertion results (Status ✓, Response Time ✓) → spotlight the **summary bar**: "4/4 passed" (1500ms, explain: Verify tests your rules against the fetched sample without running through the Runner) |
| 6 | `th3-full-mode` | Full Body Validation | `HAR.VALIDATION_MODE` | Switch mode to **Full** → spotlight the **Expected JSON** panel appearing (1000ms, pre-populated from the fetched response) → spotlight **Exclude Paths** list (explain: paths you don't care about — timestamps, random IDs) → add `$.id` to excludes → spotlight the updated comparison config (800ms) → switch back to **Selective** (explain: Full mode catches unexpected field additions but is brittle for dynamic responses) |
| 7 | `th3-extraction` | Extract Values for Chaining | `HAR.EXTRACT_TAB` | Switch to **Extract** tab → spotlight the empty extractions list (800ms) → click **+ Add Extraction** → type JSONPath `$.id` → variable name `postId` → spotlight the extraction rule (1200ms, explain: extracted values become variables available to subsequent tests in the scenario — `{{postId}}` in URLs/bodies) → Save & close editor |

**Cleanup:** Keep the validated test for TH-4.

---

## TH-4: The Test Runner

**Goal:** Execute tests using the standard Test Runner — configure the host, choose an execution mode, set concurrency and iterations, preview the execution plan, run, and monitor live progress.

| Field | Value |
|---|---|
| `id` | `th-test-runner` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `runner` |
| `allowedTabs` | `['scenarios', 'runner', 'results']` |

**Prerequisite:** Seeded FG with 3 tests: GET /posts/1, POST /posts, GET /users/1 — all with basic validation (status 2xx + timing assertion).

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th4-host-selector` | Host Configuration | `HAR.HOST_SELECTOR` | Navigate to **Test Runner** tab → spotlight the **Host Selector** at the top (1200ms) → spotlight 3 modes: **As authored** (uses URLs in tests verbatim), **Settings** (replaces host with microservice base URL), **Custom** (override URL) → select **As authored** (explain: for JSONPlaceholder tests, URLs are already absolute) |
| 2 | `th4-execution-config` | Execution Mode & Concurrency | `HAR.EXEC_CONFIG` | Spotlight the **Execution Config** panel → spotlight **Execution Mode** selector (1200ms): Sequential, Batch, Pool, Load Profile, Constant Arrival → select **Batch** (explain: runs all tests in parallel batches) → spotlight **Concurrency** slider → set to 3 → spotlight **Iterations** field → set to 2 → spotlight **Timeout** → leave at 30s (800ms) |
| 3 | `th4-scenario-select` | Select Scenarios to Run | `HAR.SCENARIO_SELECTOR` | Spotlight the **Scenario Selector** section → checkbox the "Posts CRUD" scenario → spotlight **Validation Overrides** toolbar: Skip Validation toggle, Force Unordered, Skip Assertions (1000ms, explain: temporary overrides without editing test definitions) → spotlight **test count** badge: "3 tests selected" (800ms) |
| 4 | `th4-exec-plan` | Execution Plan Preview | `HAR.EXEC_PLAN` | Spotlight the **Execution Plan Preview** panel expanding (1200ms) → spotlight the formula: `2 iterations × 3 tests = 6 total requests` → spotlight per-scenario breakdown (scenario name + test names + iteration allocation) → spotlight the **estimated duration** calculation (800ms, explain: the plan shows exactly what will run before you commit) |
| 5 | `th4-run` | Run & Monitor Progress | `HAR.RUN_BTN` | Click **▶ Run** → spotlight the **Live Progress Panel** appearing (1000ms) → spotlight the **progress bar** filling → spotlight **live metrics**: requests/sec, active connections, pass/fail counts (1500ms) → spotlight individual **test rows** turning green as they complete → spotlight the **Stop** button (explain: safely abort at any time) → run completes → spotlight **final summary**: 6/6 passed, avg latency (1500ms) |
| 6 | `th4-results` | Navigate to Results | `HAR.VIEW_RESULTS_BTN` | Spotlight **View Results** link/button → click → navigate to **Results** tab → spotlight the new **TestRun** entry at the top of the run list (1200ms) → spotlight run metadata: timestamp, env/svc, "6 requests, 100% pass", execution mode badge → explain: every run is saved here for future comparison and export |

**Cleanup:** Keep the run result for TH-6.

---

## TH-5: Data Source Authoring

**Goal:** Transform a single test into a data-driven suite — understand parameterized scenarios, configure data source columns, add data rows with tags, import from CSV, and link to Shared Data Sources.

| Field | Value |
|---|---|
| `id` | `th-data-sources` |
| `estimatedMinutes` | 7 |
| Steps | 7 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG "User API" with a standard scenario containing a GET test using `https://jsonplaceholder.typicode.com/users/1` and basic validation (`$.name` is_not_empty, status 2xx).

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th5-parameterize` | Create a Parameterized Copy | `HAR.TEST_EDITOR` | Open the existing GET /users/1 test editor → click the **Parameterize** tab (last tab, if kind=standard) → spotlight the **"Parameterize This Test"** empty state (1200ms, explain: a parameterized copy preserves your original test and creates a data-driven version) → spotlight the **Create Parameterized Copy** button (800ms) → click → the **Setup Wizard** opens |
| 2 | `th5-wizard` | The Parameterize Wizard | `HAR.DS_SETUP_MODAL` | Spotlight the wizard **step 1**: auto-detected `{{variables}}` in the URL (1200ms, explain: the wizard found `1` in `/users/1` and proposes replacing it with `{{userId}}`) → spotlight the URL template preview: `https://jsonplaceholder.typicode.com/users/{{userId}}` → spotlight the detected column `userId` with type **path** (1000ms) → proceed to **step 2**: validation columns → spotlight the option to add a `validate:` column for `$.name` (800ms, explain: validate columns let each row define its own expected value) → add `expectedName` validate column → proceed to **review** step → spotlight the summary: 2 columns, URL template, source test preserved (1000ms) → click **Apply** → wizard closes → a new **Parameterized** scenario appears in the FG with the new test, URL now shows `{{userId}}` |
| 3 | `th5-grid` | The Data Source Grid | `HAR.DS_EDITOR` | Open the new parameterized test → click **Data Source** tab → spotlight the **data grid** (1500ms): two columns (`userId` path, `expectedName` validate), one empty row → spotlight the **column headers** with type badges (path = blue, validate = purple — 1000ms) → spotlight the toolbar: **+ Row**, **+ Column**, **Import**, **Populate from API**, **Verify**, **Link Shared DS** (1200ms) |
| 4 | `th5-add-rows` | Add & Tag Data Rows | `HAR.DS_ADD_ROW_BTN` | Click **+ Row** 5 times → 5 rows appear → fill `userId` values: `1`, `2`, `3`, `4`, `5` → fill `expectedName` values: `Leanne Graham`, `Ervin Howell`, `Clementine Bauch`, `Patricia Lebsack`, `Chelsey Dietrich` → spotlight the filled grid with all 5 rows (1500ms) → spotlight the **enable/disable** checkbox on row 5 (explain: disable individual rows to skip them during runs — 800ms) → spotlight the **tags** column → add tag `smoke` to rows 1–3, tag `regression` to rows 4–5 → spotlight the tag pills (1000ms, explain: tags let you filter which rows run in the Parameterized Runner) |
| 5 | `th5-column-types` | Column Types Deep Dive | `HAR.DS_ADD_COL_BTN` | Click **+ Column** → spotlight the column type selector (1500ms): **path** (URL path segments `{{var}}`), **param** (query string `?key=val`), **body** (JSON body `{{var}}`), **header** (HTTP header values), **validate** (per-row expected values) → add a `param` column named `_fields` (800ms, explain: param columns inject query parameters — `/users/1?_fields=name,email`) → fill one cell with `name,email` → spotlight the URL preview showing the full resolved URL with query params (1200ms) → Save |
| 6 | `th5-csv-import` | Import from CSV | `HAR.DS_IMPORT_BTN` | Spotlight the **Import** button above the grid → click → spotlight file type options: **CSV**, **JSON**, **Excel** (1000ms) → select CSV → spotlight the **column mapping** step (1200ms, explain: map CSV columns to existing DS columns or create new ones — the mapper auto-matches by name) → spotlight the preview of mapped rows → confirm → grid updates with imported rows merged below existing data → spotlight the updated row count badge (1000ms) |
| 7 | `th5-shared-ds` | Shared Data Sources | `HAR.SHARED_DS_BTN` | Return to **Feature Groups** view → spotlight **Shared Data Sources** button in header → click → modal opens → spotlight the empty shared DS list (800ms, explain: shared data sources are reusable across tests and Feature Groups — change once, all linked tests update) → click **+ Create** → name it "User IDs" → add 10 user ID rows → spotlight the fetch config option (explain: optionally fetch rows from an API at run time — 1000ms) → Save → close modal → back in test editor → Data Source tab → spotlight **Link Shared DS** dropdown → select "User IDs" → spotlight the **linked badge** replacing inline rows (1200ms, explain: the test now pulls data from the shared source — no duplication) → spotlight the **Promote to Shared** button on the toolbar (800ms, explain: you can also promote an inline data source to shared) |

**Cleanup:** Keep the parameterized FG for TH-6.

---

## TH-6: The Parameterized Runner

**Goal:** Execute parameterized tests at scale — understand how the Parameterized Runner differs from the standard Test Runner, configure execution with data-aware options (tag filters, row counts, per-row progress), run data-driven test suites, analyze per-row results, and re-run only failed rows.

| Field | Value |
|---|---|
| `id` | `th-parameterized-runner` |
| `estimatedMinutes` | 9 |
| Steps | 8 |
| `initialTab` | `param-runner` |
| `allowedTabs` | `['scenarios', 'param-runner', 'results']` |

**Prerequisite:** Seeded FG "User API" with a **parameterized** scenario containing:
- **Test 1:** GET `https://jsonplaceholder.typicode.com/users/{{userId}}` — 10 data rows (`userId` 1–10), `expectedName` validate column, rows tagged `smoke` (1–5) and `regression` (6–10), validation: `$.name` equals `{{expectedName}}`, status 2xx assertion. Row 8 has a deliberately **wrong** `expectedName` to trigger a failure.
- **Test 2:** GET `https://jsonplaceholder.typicode.com/posts?userId={{userId}}` — same 10 rows linked to a **Shared Data Source** "User IDs", validation: `$.length` greater_than `0`. Row 8 is correct (no seeded failure here — only Test 1 fails on row 8).

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th6-param-tab` | The Parameterized Runner Tab | `HAR.NAV_PARAM_RUNNER` | Navigate to the **Parameterized Runner** sub-tab → spotlight the page title "Parameterized Runner" (800ms, explain: this runner is dedicated to parameterized scenarios — standard scenarios don't appear here) → if no parameterized scenarios exist, spotlight the empty state: *"No parameterized scenarios defined. Go to Feature Groups tab and create a parameterized scenario with data sources."* → since we have seeded data, spotlight the **Scenario Selector** section showing only the parameterized scenario (1200ms) → spotlight the key difference from the standard runner: each test row shows a **📊 N rows** badge next to the method badge (1500ms, explain: the row count tells you how many data rows will execute per iteration) |
| 2 | `th6-scenario-select` | Select Scenarios & Review Weights | `HAR.SCENARIO_SELECTOR` | Checkbox the "User API" parameterized scenario → spotlight the 2 tests appearing with row count badges: **Test 1** `GET /users/{{userId}}` **📊 10 rows**, **Test 2** `GET /posts?userId={{userId}}` **📊 10 rows** (1500ms) → expand **Test Distribution (weights)** section → spotlight the weight inputs (default 1 each — 1000ms, explain: set a weight to 0 to skip a test, higher weights increase the proportion during random distribution) → spotlight the **Validation Overrides** toolbar: Skip Validation toggle, Skip Assertions, Force Unordered (800ms, explain: these toggles let you temporarily disable validation without editing test definitions — useful for baseline performance runs) |
| 3 | `th6-execution-plan` | The Execution Plan (iterations × rows) | `HAR.EXEC_PLAN` | Set **Iterations** to 2 → spotlight the **Execution Plan Preview** panel expanding (1200ms) → spotlight the parameterized-specific plan layout — it shows each test individually: **Test 1:** `2 iterations × 10 rows = 20 requests` → **Test 2:** `2 iterations × 10 rows = 20 requests` → **Total: 40 requests** (2000ms, explain: unlike the standard runner's simple `iterations × tests` formula, the parameterized runner multiplies iterations by the number of **enabled data rows** per test — each row becomes a real HTTP request with its own substituted values) → spotlight the **Concurrency** slider → set to 5 → spotlight the plan updating with concurrency note: "Total: 40 requests · Concurrency: 5" (800ms) |
| 4 | `th6-tag-filter` | Tag Filter — Run a Subset | `HAR.TAG_FILTER` | Spotlight the **Tag Filter** fieldset (1200ms, explain: tag filter lets you run a subset of data rows without editing the data source — only rows matching the specified tags will execute) → type `smoke` in the tag filter input → spotlight the hint text: *"Only rows matching these tags will run"* (800ms) → spotlight the **Execution Plan** updating: **Test 1:** `2 × 5 rows = 10`, **Test 2:** `2 × 5 rows = 10`, **Total: 20 requests** (1500ms, explain: the plan now reflects only the 5 `smoke`-tagged rows per test — half the original 40) → clear the tag filter to show all 10 rows again (for the run step) |
| 5 | `th6-run` | Run the Parameterized Test | `HAR.RUN_BTN` | Set **Iterations** back to 1 (for demo speed — 10+10 = 20 requests) → spotlight the **▶ Run Parameterized Test** button (1000ms, explain: the run button label changes to remind you this is the parameterized runner) → click → spotlight the **Live Progress Panel** appearing (1000ms) → spotlight the **progress bar** filling: `0/20 → 5/20 → 10/20 → ...` → spotlight the **live metrics**: requests/sec, active connections, pass/fail counts updating in real time (1500ms) |
| 6 | `th6-per-row-progress` | Per-Row Live Progress | `HAR.LIVE_PROGRESS` | While the run is in progress (or just completed), spotlight the **per-test row progress** section below the progress bar (1800ms, explain: the parameterized runner shows per-test completion with row-level detail that the standard runner doesn't have) → spotlight **Test 1**: progress showing `9/10 ✓ · 1/10 ✗` (Test 1 row 8 failed due to wrong `expectedName`) → spotlight **Test 2**: progress showing `10/10 ✓` (all rows passed — 1200ms) → spotlight the **overall summary**: `19 passed, 1 failed` → spotlight the failed row's **data row label** in the results: `"Row 8: userId=8, expectedName=..."` highlighted in red (1500ms, explain: each result is tagged with its data row so you can trace exactly which input combination failed) |
| 7 | `th6-rerun-failed` | Re-Run Only Failed Rows | `HAR.RERUN_FAILED_BTN` | Spotlight the **Re-run Failed** button that appears after completion (1000ms, explain: instead of re-running all 20 requests, this re-executes only the rows that failed — saving time on large data sets with hundreds of rows) → click → spotlight a single request executing: `GET /users/8` with the bad expected name (800ms) → result: still fails (the expected value is wrong, not the API) → spotlight the merged results: `19 passed, 1 failed (re-run)` (1000ms) → navigate back to **Feature Groups** → open the test editor → Data Source tab → spotlight row 8's `expectedName` column → fix the value to the correct name ("Nicholas Runolfsdottir V") → spotlight the corrected cell highlighted (800ms) → Save → return to Parameterized Runner → Re-run Failed again → spotlight: now `20/20 ✓` all green (1500ms) |
| 8 | `th6-data-row-results` | Data Row Results Analysis | `HAR.VIEW_RESULTS_BTN` | Spotlight the **View Full Results →** button → click → navigate to **Results** tab → spotlight the new run entry at the top (1000ms) → click it → spotlight the **Group By** selector → select **Data Row** → spotlight the results grouped by data row: each row shows its label (`userId=1`, `userId=2`, …), pass/fail status, response time (1800ms) → spotlight the **Failed Data Rows** filter → click it → spotlight only row 8's result isolated (the original failure, before re-run fix — 1000ms) → spotlight the **per-row detail** showing: resolved URL `https://jsonplaceholder.typicode.com/users/8`, response body, validation result with the mismatched `$.name` field highlighted (1500ms, explain: this is the data-driven advantage — when one row fails out of hundreds, you pinpoint exactly which input combination caused it and fix just that row) |

**Cleanup:** Keep results for TH-7. Delete seeded FG if standalone.

---

## TH-7: Results & Analysis

**Goal:** Analyze completed test runs — explore the Results Dashboard, interpret metrics, compare runs, set baselines, configure SLA thresholds, and export reports.

| Field | Value |
|---|---|
| `id` | `th-results-analysis` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `results` |
| `allowedTabs` | `['scenarios', 'runner', 'results']` |

**Prerequisite:** 2 seeded TestRuns (one standard, one parameterized) with realistic timing data and mixed pass/fail results.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th7-dashboard` | The Results Dashboard | `HAR.RESULTS_DASHBOARD` | Navigate to **Results** tab → spotlight the **run list** on the left (2 entries with timestamps, pass rates, badges — 1200ms) → click the first run → spotlight the **4 dashboard tabs**: Overview, Requests, SLA, Analysis (1000ms each) → spotlight the **run type filter**: All / Test / Workflow (800ms) |
| 2 | `th7-metrics` | Metrics Cards & Timing | `HAR.METRICS_CARDS` | On the **Overview** tab → spotlight **Metrics Cards** row: Throughput (req/s), Avg Latency, P95, P99, Error Rate (1500ms) → spotlight the **Response Time Histogram** chart (distribution of response times — 1000ms) → spotlight the **Waterfall Breakdown** bar (DNS, TCP, TLS, TTFB, transfer — 1000ms, explain: see where time is spent) |
| 3 | `th7-grouping` | Group & Filter Results | `HAR.RESULTS_GROUP` | Spotlight **Group By** selector: Feature Group, Scenario, Test, Data Row (1000ms) → switch to **by Test** → spotlight the grouped table (each test shows pass count, avg time, error rate — 1200ms) → spotlight the **filter by status** pills: All / Passed / Failed → click **Failed** → spotlight narrowed results (800ms) |
| 4 | `th7-sla` | SLA Targets & Status | `HAR.SLA_TAB` | Switch to **SLA** tab → spotlight the **SLA Status Accordion** (1200ms): per-scenario/test targets with pass/warn/fail indicators → spotlight a **P95 < 500ms** target showing green pass → spotlight a **Error Rate < 1%** target showing amber warn → explain: SLA targets are defined on Feature Groups, Scenarios, or Tests and evaluated automatically after each run (for full SLA authoring, see **TH-13**) |
| 5 | `th7-comparison` | Run Comparison & Baselines | `HAR.COMPARE_BTN` | Click **Compare** → select the second run as comparison → spotlight the **Run Comparison Panel** (1200ms): side-by-side metrics, delta percentages, regression indicators → spotlight a metric showing **+15ms P95 regression** highlighted in red → spotlight **Set as Baseline** button (800ms) → click → baseline pinned → spotlight future runs showing delta from baseline |
| 6 | `th7-export` | Export Reports | `HAR.EXPORT_BTN` | Spotlight the **Export** button → click → spotlight export format options: JSON, CSV, HTML Report, Markdown (1200ms) → select **HTML Report** → spotlight the generated report preview (1000ms, explain: shareable standalone HTML with embedded charts and metrics — great for CI artifacts or team sharing) → close export |

**Cleanup:** Keep results for reference. Clear baseline.

---

## TH-8: Load Profiles & Performance

**Goal:** Configure advanced load testing — ramp-up/sustained/spike profiles, constant arrival rate, think time delays, error policies, and performance regression detection.

| Field | Value |
|---|---|
| `id` | `th-load-testing` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `runner` |
| `allowedTabs` | `['runner', 'results']` |

**Prerequisite:** Seeded FG with 3 fast endpoints (GET /posts, GET /users, GET /comments) — ideal for load testing against JSONPlaceholder.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th8-load-profile` | Load Profile Mode | `HAR.EXEC_MODE` | Switch **Execution Mode** to **Load Profile** → spotlight the **Load Profile configurator** appearing (1200ms) → spotlight **Profile Type** selector: Ramp-Up, Sustained, Spike (1000ms each, explain: Ramp-Up gradually increases concurrency, Sustained holds steady, Spike creates burst patterns) → select **Ramp-Up** → configure: start 1 → end 10 → duration 30s → spotlight the visual ramp-up curve (1200ms) |
| 2 | `th8-think-time` | Think Time & Error Policies | `HAR.THINK_TIME` | Spotlight **Think Time** section → enable it → spotlight config: **Fixed** 200ms (explain: simulates user delays between requests for realistic load) → spotlight **Error Policy** section (1000ms): Continue, Stop on First Failure, Stop at Error Rate → select **Stop at Error Rate** → set threshold to 10% → spotlight **Max Errors** field (800ms) |
| 3 | `th8-constant-arrival` | Constant Arrival Rate | `HAR.EXEC_MODE` | Switch to **Constant Arrival** mode → spotlight the **Target RPS** field (1000ms) → set to 5 req/sec → spotlight explanation text (explain: maintains a fixed arrival rate regardless of response time — true load test semantics, not constrained by concurrency) → spotlight the execution plan showing time-based run (1200ms) |
| 4 | `th8-run-load` | Run Under Load | `HAR.RUN_BTN` | Switch back to **Load Profile** (Ramp-Up) → select all 3 tests → click **▶ Run** → spotlight the **Live Progress Panel** with real-time charts (1500ms): concurrent users line climbing, response time chart, throughput bars → spotlight **percentile metrics** updating live: P50, P95, P99 (1200ms) → let it run 10-15 seconds → spotlight the **stop** button → click stop (graceful) |
| 5 | `th8-perf-results` | Performance Results | `HAR.RESULTS_TAB` | Navigate to Results → select the load run → spotlight **Performance-specific metrics**: peak RPS, max concurrency, P99.9, total duration (1500ms) → spotlight the **Analysis** tab → spotlight latency percentile distribution (1000ms) → spotlight **regression indicator** if a baseline exists (1200ms, explain: the app automatically flags P95/P99 regressions when you have a baseline set) |

**Cleanup:** Delete load test run if desired.

---

## TH-9: Advanced — Versioning, Trash & Organization

**Goal:** Manage test definitions over time — version snapshots, find tests with search and tags, reorganize with move/copy, and recover accidentally deleted items from the Trash.

| Field | Value |
|---|---|
| `id` | `th-advanced-features` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG with 2 scenarios (5 tests total), some tests tagged, and 1 test definition with 2 version snapshots in history.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th9-versioning` | Test Definition Versions | `HAR.TEST_EDITOR` | Open a test with version history → switch to **History** tab → spotlight the **Version Panel** (1200ms): 2 snapshots with timestamps, change summaries → spotlight **Compare** button → click → spotlight the diff view showing changed URL and added assertion (1500ms) → spotlight **Restore** button (800ms, explain: restore any previous test definition without losing history) → close editor |
| 2 | `th9-tags` | Scenario & Test Tags | `HAR.TAGS` | Spotlight a scenario with existing tags (smoke, regression) → spotlight **+ Add Tag** → type "edge-case" → confirm → spotlight the tag pills on the scenario card (1000ms) → spotlight the **Tag Filter** in the search bar → type "smoke" → spotlight only tagged scenarios visible (1200ms, explain: tags help organize test subsets for targeted runs in the Runner) |
| 3 | `th9-search` | Search Across Everything | `HAR.SEARCH_BAR` | Spotlight the **Search Bar** at the top of Feature Groups → type "user" → spotlight results filtering: matching FGs, scenarios, and tests highlighted (1200ms) → spotlight the match count badge → clear search → spotlight **Structure Change Log** button on FG → click → spotlight the log showing add/delete/move/rename events with timestamps (1200ms) |
| 4 | `th9-move-copy` | Move & Copy Tests | `HAR.CONTEXT_MENU` | Right-click a test → spotlight context menu items: Edit, Duplicate, Move, Copy, Delete (1000ms) → click **Copy** → spotlight the **Copy modal** with target selector: FG → Scenario → confirm copy → spotlight the test appearing in the destination scenario (1000ms) → right-click another test → **Move** → select target → confirm → original location empty, test in new location (800ms) |
| 5 | `th9-trash` | Trash & Undo | `HAR.TRASH_BTN` | Delete a test (right-click → Delete) → spotlight the **Undo Toast** appearing at bottom with 5-second countdown bar (1200ms, explain: 5 seconds to undo before it goes to Trash) → let toast expire → spotlight **Trash** button in header (count badge incremented) → click → Trash Panel opens → spotlight the deleted item with restore/permanent-delete options (1200ms) → click **Restore** → item returns to original location → close Trash panel |

**Cleanup:** Restore all trashed items. Remove extra tags. Delete seeded FG.

---

## TH-10: Assertions Deep Dive

**Goal:** Master all assertion types available in RedfireForge — from basic status checks to JSON Schema validation, date comparisons, array element assertions, and custom predicates. Understand the 6 assertion categories, the NOT modifier, and how to build complex validation rules without writing code.

| Field | Value |
|---|---|
| `id` | `th-assertions-deep-dive` |
| `estimatedMinutes` | 8 |
| Steps | 7 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG with a GET test against `https://dummyjson.com/products/1` (returns rich JSON with arrays, nested objects, dates, numeric values — ideal for demonstrating all assertion types). Test has a fetched sample response already saved.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th10-assertion-menu` | The Assertion Menu (6 Categories) | `HAR.ASSERTION_MENU` | Open the test editor → **Validation** tab → spotlight the **Assertions** section with its count badge (800ms) → click **+ Add** → spotlight the **categorized assertion menu** opening (1500ms) → spotlight each category header: **Response** (Status Code, Response Time SLA, Response Header, Body Size), **Field Validation** (Regex Match, Regex Builder, Numeric Compare, Date Compare, Date Precise, Type Check, Field Exists), **Array & Structure** (Array Length, Array Contains, Each Element, Contains Subset), **Schema & Advanced** (JSON Schema, Custom Predicate) — pause on each category (1000ms per group, explain: 24+ assertion types organized by what you're checking) → close the menu without selecting |
| 2 | `th10-response-assertions` | Response Assertions | `HAR.ASSERTION_ROW` | Click **+ Add** → select **Status Code** → spotlight the new assertion row: type pill `STATUS`, expected value `200` (800ms) → edit to `2xx` (explain: pattern matching — `2xx` matches any 200-range status) → add **Response Time SLA** → spotlight: `RESPONSE TIME`, max `500` ms (800ms) → add **Response Header** → spotlight: `HEADER`, name `content-type`, operator `contains`, value `json` (1000ms) → add **Body Size** → spotlight: `SIZE`, operator `<=`, value `1024`, unit `KB` (1000ms) → spotlight the **NOT** toggle on Body Size → click it → pill changes to `SIZE NOT` (800ms, explain: the NOT modifier inverts any assertion — "body is NOT larger than 1024 KB") |
| 3 | `th10-field-assertions` | Field Validation Assertions | `HAR.ASSERTION_ROW` | Add **Numeric Compare** → spotlight: `NUMERIC`, JSONPath `$.price`, operator `>`, value `0` (1000ms) → add **Date Compare** → spotlight: `DATE`, JSONPath `$.meta.createdAt`, operator `on or after`, reference **today** (1200ms, explain: dynamic date references — "today", "yesterday", "7 days ago" — so assertions don't break over time) → spotlight the **precision selector**: Day, Hour, Minute, Second (800ms) → add **Type Check** → spotlight: `TYPE`, JSONPath `$.title`, expected type `string` (800ms) → add **Field Exists** → spotlight: `EXISTS`, JSONPath `$.thumbnail`, expect exists: true (800ms, explain: verify the field is present without caring about its value) |
| 4 | `th10-array-assertions` | Array & Structure Assertions | `HAR.ASSERTION_ROW` | Add **Array Length** → spotlight: `LENGTH`, JSONPath `$.images`, operator `>=`, value `1` (1000ms, explain: assert the images array has at least one item) → add **Array Contains** → spotlight: `CONTAINS`, JSONPath `$.tags`, mode selector with 3 options: **any (at least one)**, **all (every one)**, **none** (1500ms) → select `any` → type value `"electronics"` → spotlight the matching mode (800ms, explain: "any" means at least one element must match the criteria) → add **Each Element** → spotlight: `EACH`, JSONPath `$.images`, field path `url`, operator `is_not_empty` (1200ms, explain: assert that every element in the images array has a non-empty url property — no image is missing its URL) → add **Contains Subset** → spotlight: `SUBSET`, JSONPath `$`, expected `{"brand": "Apple"}` (1000ms, explain: partial deep match — the response must contain these fields with these values, but can have other fields too) |
| 5 | `th10-schema-custom` | JSON Schema & Custom Predicates | `HAR.ASSERTION_ROW` | Add **JSON Schema** → spotlight: `SCHEMA`, the JSON Schema editor with **Paste Schema**, **Pretty Format**, **Minify**, **Generate from Response** buttons (1500ms) → click **Generate from Response** → spotlight the auto-generated schema populating (1200ms, explain: the app builds a complete JSON Schema from your sample response — types, required fields, array items, all inferred automatically) → spotlight the generated schema content (1000ms) → add **Custom Predicate** → spotlight: `CUSTOM`, expression editor, description field (1000ms) → type expression: `$gt($count($.body.images), 0)` → type description: "Has at least one image" → spotlight the expression syntax (1200ms, explain: custom predicates use the same expression engine as the Data Mapper — `$gt`, `$sum`, `$map`, `$all` — for assertions that go beyond built-in operators) |
| 6 | `th10-presets` | Assertion Presets (Quick Setup) | `HAR.PRESETS_BTN` | Spotlight the **Presets** button next to + Add (800ms) → click → spotlight the **Assertion Presets Library** panel (1200ms): curated preset groups like "API Health" (status 2xx + timing + content-type), "CRUD Validation" (status + body exists + id exists), "Performance SLA" (P95 < 500ms + throughput), "Security Headers" (CORS + CSP + X-Frame-Options) → select **API Health** preset → spotlight 3 assertions added at once (1000ms, explain: presets let you apply a validated set of assertions with one click — great for consistency across tests) → spotlight the **Save as Preset** option on the assertions section (800ms, explain: create your own reusable assertion sets from what you've configured) |
| 7 | `th10-regex-builder` | The Regex Builder | `HAR.ASSERTION_ROW` | Click **+ Add** → select **Regex Builder...** → spotlight the **Regex Assertion Builder modal** opening (1200ms) → spotlight the **JSON tree picker** on the left (select source field from the response tree — 1000ms) → select `$.sku` → spotlight the **Pattern Library** with common patterns: email, UUID, ISO date, URL, phone, hex color (1200ms) → select **UUID** pattern → spotlight the **live preview** showing the field value matched against the pattern with green/red highlighting (1500ms) → spotlight the pattern input: `^[A-Z0-9-]+$` → modify to a custom pattern → spotlight preview updating live (800ms) → click **Apply** → assertion row added with the regex rule → save test |

**Cleanup:** Keep the assertions for validation testing reference.

---

## TH-11: Data Mapper for Validation

**Goal:** Use the visual Data Mapper to build validation rules by dragging response fields to assertion targets — understand auto-mapping, coverage tracking, custom predicates, subtree operations, verification, and the 5 view modes (Code, Preview, Table, Rules, Lines).

| Field | Value |
|---|---|
| `id` | `th-data-mapper-validation` |
| `estimatedMinutes` | 9 |
| Steps | 8 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG with a GET test against `https://dummyjson.com/products/1` that has a fetched sample response (rich JSON with arrays, nested objects). The test has Selective Fields validation mode enabled with 2 basic expected fields already configured (so the Data Mapper opens with some initial state). Unordered array matching is checked.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th11-open-mapper` | Open the Data Mapper | `HAR.OPEN_MAPPER_BTN` | Open the test editor → **Validation** tab → spotlight the **Data Mapper** button below the expected fields section (800ms, explain: the Data Mapper provides a visual way to build validation rules — drag response fields to assertion targets instead of typing JSONPaths manually) → click → Data Mapper modal opens → spotlight the **Full screen** toggle (600ms) → click to enter full screen → spotlight the two-panel layout: **Source** (response JSON tree) on the left, **Target** (validation rules) on the right (1500ms) → spotlight the **toolbar** row: Auto-map, Clear all, N mappings ready, Code/Preview/Table/Rules/Lines toggle buttons, Verify All, Fetch & Verify, Auto, Compact, Undo, Redo (1200ms) |
| 2 | `th11-source-tree` | The Source Panel (Response Tree) | `HAR.MAPPER_SOURCE` | Spotlight the **Source** panel header showing "Source: none" (800ms) → spotlight the JSON tree with type indicators: `obj (root)`, `arr offers`, `str offerName`, `num rank`, `obj duration` with children `str unit`, `num value` (1500ms, explain: every field in the response is shown with its type — obj, arr, str, num, bool — so you know what you're mapping) → spotlight the **Search fields** input → type "offer" → spotlight the tree filtering to show only matching paths (1000ms) → clear search → spotlight the **Map all** button (800ms, explain: maps every source field to a target rule automatically — use for initial coverage, then refine) → spotlight **coverage indicator**: "29% HEALTHY" badge (1000ms, explain: coverage tracks what percentage of the response is covered by validation rules — aim for higher coverage on critical APIs) |
| 3 | `th11-auto-map` | Auto-Map & Coverage | `HAR.MAPPER_AUTOMAP` | Click the **Auto-map** button (showing count badge, e.g., "Auto-map 23") → spotlight the mappings populating: connection lines appear between source fields and target rules (1500ms) → spotlight the **N mappings ready** counter updating → spotlight coverage jumping from 29% to a higher value (1000ms, explain: auto-map uses 3-tier name matching — exact path, fuzzy name, type-compatible — to create mappings automatically) → spotlight a few individual mappings: source `$.offers[0].offerName` → target with `equals` operator pill → source `$.offers[0].rank` → target with `equals` operator (1200ms) → click **Clear all** to start fresh for the manual demo |
| 4 | `th11-drag-map` | Drag-to-Map & Operator Pills | `HAR.MAPPER_TARGET` | Drag `$.title` from source to the target panel → a new mapping appears with an **operator pill** (defaults to `equals`) and the value auto-filled from the sample response (1200ms) → spotlight the **operator pill** → click it → spotlight the **operator picker dropdown**: categorized, searchable, with icon + name + description per operator (1500ms, explain: 24 operators available — equals, contains, regex, greater_than, is_not_empty, type_is, between, …) → change operator to `is_not_empty` → pill updates → drag `$.price` → change operator to `greater_than` → set value `0` → drag `$.images` → spotlight the **array handling** controls appearing: `unordered` badge, item count, assertion mode (1200ms) → spotlight **inline value editors** appearing next to operators that need values vs hidden for no-value operators like `is_not_empty` (800ms) |
| 5 | `th11-custom-predicates` | Custom Predicates | `HAR.MAPPER_PREDICATES` | Spotlight the **CUSTOM PREDICATES** section at the top of the Target panel (1000ms) → click **+ Add Custom** → spotlight the expression input → type `$gt($count($.body.offers), 0)` → spotlight the predicate row showing: `f CUSTOM` badge + expression (1200ms, explain: custom predicates use the expression engine for assertions that go beyond field-level operators — aggregate checks, cross-field comparisons, computed validations) → add another: `$all($.body.offers, x => $gte(x.rank, 1))` (explain: assert every offer has a rank >= 1) → spotlight both predicates (1000ms) → spotlight the **NOT** toggle available on custom predicates (800ms) |
| 6 | `th11-views` | Five View Modes | `HAR.MAPPER_TOOLBAR` | Click **Code** tab → spotlight the **Code View** showing all mappings as `target ← source` text with line numbers (1200ms) → click **Preview** → spotlight the **Preview** panel showing the evaluated output with values from the sample response (1000ms) → click **Table** → spotlight the **tabular rules view** with JSON PATH, OPERATOR (color-coded pills), EXPECTED VALUE columns (1500ms, explain: this is the same table you see in the Validation tab — the Data Mapper just provides a visual way to build it) → click **Rules** → spotlight the **DSL rules view** with syntax-highlighted assertion expressions (1000ms) → click **Lines** → spotlight the **connection lines canvas** showing SVG lines connecting source nodes to target nodes (800ms) |
| 7 | `th11-subtree-ops` | Subtree Operations | `HAR.MAPPER_SOURCE` | Right-click the `offers` array node in the source tree → spotlight the **context menu**: **Map subtree**, **Map siblings**, **Clear subtree**, **Replace subtree**, **Preview propagate** (1500ms) → click **Map subtree** → spotlight all children of `offers[0]` getting mapped at once: `associatedOfferingCode`, `rank`, `offerName`, `productCode`, `billingCadence`, `planType` (1200ms, explain: subtree operations let you map an entire branch of the response in one action — then refine individual rules) → spotlight the **Anchor mapping** dropdown in the toolbar (800ms, explain: anchor mapping controls how the target tree root is aligned with the source — useful for deeply nested responses) |
| 8 | `th11-verify` | Verify All & Fetch & Verify | `HAR.MAPPER_VERIFY` | Spotlight the **Verify All** button in the toolbar (800ms) → click → spotlight the verification running: each mapping gets a **pass/fail badge** (green ✓ / red ✗) (1500ms) → spotlight a passing rule: `$.title equals "iPhone 9"` ✓ → spotlight a failing rule (if any seeded mismatch) with red ✗ and the actual vs expected diff (1000ms) → spotlight the **Fetch & Verify** button (800ms, explain: fetches a fresh response from the API and verifies all rules against it — catches cases where the sample response is stale) → click → spotlight the fresh fetch happening + verification results updating (1200ms) → spotlight the **summary bar** at the bottom: "9 mapped · Review mappings and save when ready" → click **Save** → Data Mapper closes → spotlight the expected fields list updated with all the rules from the mapper (1000ms) |

**Cleanup:** Keep the validation rules for TH-12 versioning demo.

---

## TH-12: Validation Versioning

**Goal:** Track validation changes over time with Response Versions and Rules Versions — save snapshots, preview historical validation state, compare versions side by side, restore previous configurations, and understand the version metadata badges.

| Field | Value |
|---|---|
| `id` | `th-validation-versioning` |
| `estimatedMinutes` | 6 |
| Steps | 6 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios']` |

**Prerequisite:** Seeded FG with a GET test that has 3 Response Versions (v1: initial fetch, v2: updated response with new fields, v3: current) and 3 Rules Versions (r1: 12 rules SELECTIVE·INCLUDE·UNORDERED, r2: refined to 6 rules, r3: current 6 rules with updated operators). Validation is set to Selective Fields with Unordered array matching.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th12-response-versions` | Response Versions | `HAR.RESPONSE_VERSIONS` | Open the test editor → **Validation** tab → scroll down past the expected fields and assertions → spotlight the **Response Versions** section with count badge `(3)` and the **Save as Version** + **Compare** buttons (1200ms) → spotlight the 3 version rows: **v3** with timestamp + `SELECTIVE · INCLUDE` badge + `current` tag (green), **v2** with timestamp + badge + **Preview** / **Restore** / **Delete** buttons, **v1** oldest with same controls (1800ms, explain: every time you fetch a new response or manually save, you can snapshot the current validation state — the response body, validation mode, and settings are all captured) |
| 2 | `th12-preview-response` | Preview a Previous Response | `HAR.VERSION_PREVIEW_BTN` | Click **Preview** on v1 → spotlight the **Preview panel** opening (1000ms): shows the response body at the time of v1, with the validation mode badge (`SELECTIVE · INCLUDE`), timestamp, and response size → spotlight the JSON content (different from v3 — maybe fewer fields, different values — 1200ms, explain: Preview lets you see exactly what the API returned when this version was saved — useful for debugging regression in API responses) → close preview |
| 3 | `th12-compare-responses` | Compare Response Versions | `HAR.VERSION_COMPARE_BTN` | Click **Compare** button at the section header → spotlight the **version comparison modal** opening (1000ms) → spotlight the **two-column selector**: left = v1, right = v3 → spotlight the **side-by-side diff** view: added fields highlighted green, removed fields highlighted red, changed values highlighted yellow (1800ms, explain: response comparison shows exactly how the API evolved between versions — new fields added, old fields removed, value changes) → spotlight the **delta summary** at the top: "3 added, 1 removed, 2 changed" (800ms) → close comparison |
| 4 | `th12-rules-versions` | Rules Versions | `HAR.RULES_VERSIONS` | Scroll to the **Rules Versions** section with count badge `(3)` → spotlight the 3 rules version rows: **r3** current with `SELECTIVE · INCLUDE · 6 RULES · UNORDERED` badge, **r2** with `SELECTIVE · INCLUDE · 6 RULES · UNORDERED`, **r1** with `SELECTIVE · INCLUDE · 12 RULES · UNORDERED` (1500ms, explain: rules versions are separate from response versions — they track changes to your validation configuration: expected fields, operators, values, assertion count, and validation mode settings) → spotlight the **Save Rules Version** button (800ms, explain: save a rules snapshot before making changes — if your edits break things, you can restore) |
| 5 | `th12-restore-rules` | Restore a Previous Rules Version | `HAR.VERSION_RESTORE_BTN` | Spotlight the **Restore** button on r1 (the version with 12 rules) → click → spotlight a confirmation dialog (800ms, explain: restoring replaces current rules with the historical version — the current version is still in history, nothing is lost) → confirm → spotlight the Validation Rules table updating: 12 rules now visible instead of 6 (1200ms, explain: the 6 rules from r3 were a refined subset; restoring r1 brings back all original 12) → spotlight the expected fields count updating → spotlight the rules version list gaining a new entry (r4 = the pre-restore state auto-saved — 1000ms, explain: the system auto-saves the current state before a restore so you can always undo) |
| 6 | `th12-compare-rules` | Compare Rules Versions | `HAR.VERSION_COMPARE_BTN` | Click **Compare** at the Rules Versions header → spotlight the **rules comparison modal** (1000ms) → select r1 (12 rules) vs r3 (6 rules) → spotlight the diff showing: **removed rules** (6 rules that were dropped during refinement, struck through in red), **changed operators** (e.g., `equals` → `is_not_empty` highlighted in yellow), **unchanged rules** (grayed out for context — 1800ms) → spotlight the **summary**: "6 removed, 2 changed, 4 unchanged" (800ms, explain: rules comparison is essential when refactoring validation — see exactly which assertions were added, removed, or modified between versions) → close comparison → restore back to r3 (the refined 6-rule version) → save test |

**Cleanup:** Keep versions for reference. Close editor.

---

## TH-13: SLA Targets & Acceptance Criteria

**Goal:** Define absolute performance contracts on tests — set thresholds for response time percentiles, throughput, and error rate at test, scenario, and Feature Group levels. Understand the warn/fail two-tier system, see how the Runner evaluates SLA targets, and learn to use Runner overrides for ad-hoc adjustments.

| Field | Value |
|---|---|
| `id` | `th-sla-configuration` |
| `estimatedMinutes` | 7 |
| Steps | 7 |
| `initialTab` | `scenarios` |
| `allowedTabs` | `['scenarios', 'runner', 'results']` |

**Prerequisite:** Seeded FG "User API" with a scenario containing 2 tests (GET /users/1, GET /users) — both already have a fetched sample response and basic validation configured. At least one completed test run exists in Results so SLA evaluation can be demonstrated.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `th13-open-sla-modal` | The SLA Targets Modal | `HAR.SLA_BTN` | Navigate to Feature Groups → spotlight the **🎯 SLA** button on the test card "GET /users/1" (800ms, explain: SLA targets define absolute acceptance criteria — "P95 must always be ≤ 500ms", "error rate must be ≤ 1%" — unlike regression detection which compares run-to-run) → click → spotlight the **SLA Targets** modal opening with "+ Add Target" and "No SLA targets yet" empty state (1200ms) → spotlight the modal title showing the test name (800ms) |
| 2 | `th13-add-targets` | Add SLA Targets (7 Metrics) | `HAR.SLA_TARGET_ROW` | Click **+ Add Target** → spotlight a new row appearing with 4 columns: **Metric** dropdown, **Operator**, **Fail at** value, **Warn at** value (1200ms) → spotlight the **Metric** dropdown → open it → spotlight all 7 metrics: **P50 Response Time** (ms), **P95 Response Time** (ms), **P99 Response Time** (ms), **P99.9 Response Time** (ms), **Avg Response Time** (ms), **TPS** (throughput), **Error Rate** (%) (1500ms, explain: latency metrics use ≤ by default — "must be at or below"; TPS uses ≥ — "must be at or above") → select **P95 Response Time** → operator auto-sets to **≤** → set fail value to `500` → spotlight the **Warn at** field → set to `300` (1000ms, explain: warn threshold is the early warning — amber indicator before the red fail; it must be stricter than the fail value) → add a second target: **Error Rate ≤ 1%**, warn at `0.5%` → add third: **TPS ≥ 10**, warn at `15` (1200ms) → spotlight all 3 rows configured (800ms) |
| 3 | `th13-scope-levels` | Scope Levels (Aggregate / Scenario / FG) | `HAR.SLA_SCOPE` | Spotlight the **Scope** column on a target row (if using `SlaTargetEditor` from Results view — 1000ms) → spotlight the 3 scope options: **Aggregate** (evaluated against the entire run's combined metrics), **Scenario** (only metrics from the named scenario), **Feature Group** (only metrics from tests in the named FG) (1500ms, explain: Aggregate is the default — the target applies to the overall run; Scenario scope lets you set different thresholds per scenario; FG scope groups all scenarios in a Feature Group) → change one target's scope to **Scenario → "GET Users"** (800ms) → click **Save** → modal closes → spotlight the test card now showing a **🎯 3** badge (1000ms, explain: the badge shows how many SLA targets are configured on this test) |
| 4 | `th13-scenario-summary` | Scenario SLA Summary | `HAR.SCENARIO_SLA_PANEL` | Scroll up to the scenario card → spotlight the **🎯 SLA Summary** collapsible panel that appeared (the scenario now has tests with SLA targets — 1000ms) → click to expand → spotlight the **summary table**: Test name, Metric, Operator, Fail at, Warn at — grouped by test (1500ms) → spotlight "GET /users/1" row showing P95 ≤ 500ms, Error Rate ≤ 1%, TPS ≥ 10 → spotlight the row is clickable (800ms, explain: click any row to open the SLA modal for that test and edit targets) → click the second test "GET /users" → spotlight the SLA modal opening empty for this test (800ms) → add one quick target: **P99 ≤ 1000ms** → save → scenario summary updates to show 4 total targets across 2 tests (1000ms) |
| 5 | `th13-runner-override` | Runner SLA Overrides | `HAR.RUNNER_SLA_OVERRIDE` | Navigate to **Test Runner** tab → spotlight the **SLA** section in the runner config (1000ms) → spotlight the **compact trigger bar** showing "3 configured · 0 overrides" (800ms) → click **Configure** → spotlight the **SLA Override modal** opening (1200ms) → spotlight **Configured Targets** section (read-only table grouped by scope) showing the 4 defined targets → spotlight the **Override** button on the P95 row → click → spotlight the target cloned into the **Overrides** section with locked metric + scope, but editable thresholds (1000ms, explain: runner overrides are temporary — they apply only to this run, not persisted to the test definition. Useful for "can we handle 300ms instead of 500ms?" experiments) → change the P95 fail threshold from 500 to 300 → spotlight the "was 500ms" hint (800ms) → close the override modal |
| 6 | `th13-run-with-sla` | Run and Evaluate SLA | `HAR.RUN_BTN` | Select both tests → set 3 iterations → click **▶ Run** → spotlight the **live progress** showing execution (1500ms) → run completes → spotlight the **SLA compact bar** at the bottom of the runner results (1000ms): "3 targets: 2 pass · 1 warn" with colored indicators → spotlight a **green pass** indicator (P99 ≤ 1000ms ✓), an **amber warn** indicator (P95 between 300–500ms ⚠), and the override result (1200ms) |
| 7 | `th13-sla-results` | SLA in the Results Dashboard | `HAR.SLA_TAB` | Navigate to **Results** tab → select the run → spotlight the **SLA** tab in the results dashboard (800ms) → click → spotlight the **SLA Status Accordion** expanding (1200ms): each target as a row with **metric name**, **threshold**, **actual value**, and **pass/warn/fail** badge → spotlight a **pass** row: P99 = 420ms vs target ≤ 1000ms (green) → spotlight a **warn** row: P95 = 380ms vs warn 300ms, fail 500ms (amber) → spotlight a **fail** row if present (red, explain: fail = actual value crossed the fail threshold, warn = crossed the warn threshold but not yet failing) → spotlight the **SLA override indicator** on overridden targets: "Override: was 500ms → 300ms" (1000ms) → spotlight the accordion grouping: **Aggregate** section, **Per-Scenario** section with separate results per scenario name (800ms) |

**Cleanup:** Remove runner overrides (they're session-only). Keep SLA targets on tests for future runs.

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

---

## Not Covered (Handled by Other Lessons)

| Feature | Covered by |
|---|---|
| Send to Harness from Requests | **REQ-5** `req-send-harness` |
| Send to Harness from Catalog | **CAT-3** `cat-export-requests` |
| Workflow Runner (workflow execution under load) | Protocol lessons (WS/Kafka/GQL/gRPC) + **WF-6** quick test |
| Workflow Results Explorer (3-panel replay) | Protocol workflow runner lessons |
| Auth tab deep dive (OAuth, mTLS, certificate) | Future "Auth & Security" lesson series |
| Body Builder (visual JSON body construction) | Future TH-17 lesson |
| Regex Assertion Builder modal | **TH-10** Step 7 (full deep dive) |
| CLI test execution | Future TH-16 lesson |
| Schema Drift & Contract Testing | Future TH-20 lesson |
| Validation DSL Editor | Future TH-21 lesson |

---

## Implementation Priority

| Order | Lesson | Reason |
|---|---|---|
| 1 | TH-1 | Foundation — understand the domain before anything else |
| 2 | TH-2 | Core authoring — can't validate or run without tests |
| 3 | TH-3 | Core value — validation basics (modes, expected fields, verify) |
| 4 | TH-4 | First execution — the "see it work" moment |
| 5 | TH-10 | Assertion mastery — all 24+ types, NOT modifier, presets, regex builder |
| 6 | TH-11 | Data Mapper — visual validation, auto-map, custom predicates, verify |
| 7 | TH-12 | Validation versioning — response/rules snapshots, compare, restore |
| 8 | TH-5 | Data authoring — configure the data that powers parameterized tests |
| 9 | TH-6 | Parameterized Runner — data-driven execution at scale |
| 10 | TH-7 | Analysis — understand what happened after a run |
| 11 | TH-8 | Performance — advanced load testing for power users |
| 12 | TH-13 | SLA — define acceptance criteria, evaluate results, runner overrides |
| 13 | TH-9 | Organization — long-term test management |

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
    { id: 'execution',    label: 'Runners & Execution', icon: '▶' },
    { id: 'performance',  label: 'Performance & SLA', icon: '🎯' },
    { id: 'analysis',     label: 'Results & Analysis', icon: '📊' },
  ],
  lessons: harnessLessons,
};
```

Category mapping:
- **Fundamentals:** TH-1, TH-2
- **Validation & Assertions:** TH-3, TH-10, TH-11, TH-12
- **Runners & Execution:** TH-4, TH-5, TH-6, TH-8
- **Results & Analysis:** TH-7, TH-9
- **Performance & SLA:** TH-8, TH-13

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
| TH-3 Step 4 (Data Mapper) | "For the full Data Mapper deep dive..." | TH-11 |
| TH-3 Step 3 (Assertion presets) | "For all assertion types and Regex Builder..." | TH-10 |
| TH-5 Step 7 (Shared DS) | Links to full Shared DS training manuals | Training path Phase 5 |
| TH-6 Step 4 (Tag Filter) | Cross-ref tag authoring | TH-5 Step 4 |
| TH-6 Step 8 (Data Row Results) | Cross-ref Results Dashboard details | TH-7 |
| TH-8 (Load testing) | "For workflow-based load testing..." | Protocol workflow runner lessons |
| TH-10 Step 5 (Custom predicates) | "Same expression engine as the Data Mapper" | TH-11 Step 5 |
| TH-11 Step 6 (Table view) | "Same rules table as Validation tab" | TH-3 Step 2 |
| TH-12 (Validation versioning) | "Test definition versioning is separate — see..." | TH-9 Step 1 |
| TH-13 Step 6 (SLA compact bar) | "For detailed SLA results analysis..." | TH-7 Step 4 |
| TH-13 Step 5 (Runner overrides) | "Runner config and execution details..." | TH-4 |
| TH-8 Step 5 (Performance results) | "For SLA target authoring..." | TH-13 |

### Training path alignment:

| Training Path Phase | Demo Lesson Equivalent |
|---|---|
| Phase 1 — Getting Started | TH-1, TH-2 |
| Phase 2 — Intermediate Suites | TH-3, TH-4 |
| Phase 2b — Validation Mastery | TH-10, TH-11, TH-12 |
| Phase 3 — Advanced Suites | TH-8, TH-13 |
| Phase 4 — Parameterized Testing | TH-5, TH-6 |
| Phase 5 — Shared Data Sources | TH-5 Step 7 (intro) |
| Phase 6 — Runners & Scenario Types | TH-4, TH-6, TH-8 |

---

## Future Expansion (Phase 2)

After the core 13 lessons are complete, consider:

| Lesson | Focus |
|---|---|
| TH-14 | Shared Data Sources Deep Dive — fetch config, cross-FG reuse, promote/demote, impact warnings |
| TH-15 | Auth Inheritance Chain — test → scenario → FG → global profile → env fallback |
| TH-16 | CI/CD Integration — CLI execution, JSON export for CI, exit codes, report artifacts |
| TH-17 | Body Builder & Request Templates — visual JSON body construction, `{{variable}}` substitution |
| TH-18 | Multi-Protocol Harness — Kafka/WS/gRPC test scenarios (non-workflow), transport-specific assertions |
| TH-19 | Parameterized Load Testing — data-driven load profiles, per-row SLA targets, large-scale row execution |
| TH-20 | Schema Drift & Contract Testing — schema snapshots, drift detection, contract lock modes, repair suggestions |
| TH-21 | Validation DSL Editor — Monaco-based DSL authoring, autocomplete, inline errors, bi-directional sync with visual mode |

> **Note:** TH-10 (Assertions Deep Dive), TH-11 (Data Mapper), TH-12 (Validation Versioning), and TH-13 (SLA Configuration) now cover features previously in the Future Expansion section.

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

However, **no gallery import is used as the primary teaching vehicle** (except TH-1 Step 3 as a brief overview). All other lessons author tests from scratch so the viewer understands construction, not just consumption.
