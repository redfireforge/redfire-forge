# Throughput PR 3 — Test Scenarios for Visual Verification

> PR 3: Caching & Deduplication
> Completed: 2026-05-18
> Branch: `feature/review-status`

---

## Files Changed

| File | Changes |
|------|---------|
| `src/engine/requestExecution.ts` | 1I: `PreparedScenario` cache — `prepareScenario()`, `clearPrepCache()`; used by `runSequential`, `runBatch`, `runPool` |
| `src/engine/loadProfileRunner.ts` | 1I: Switched to `prepareScenario()` in `launchOne()`, removed `buildHeaders`/`serializeWithContentType` imports |
| `src/engine/executor.ts` | 1I: Call `clearPrepCache()` at test start |
| `src/features/workflow/engine/graphRunnerHelpers.ts` | 1M: `buildCombinedResolver()` — single combined regex; `applyTemplateLiteralsToScenario` accepts optional resolver |
| `src/engine/requestExecution.test.ts` | Test fix: `clearPrepCache()` in `beforeEach`; OAuth2 auth type for token rejection test |

---

## Validation Checklist

> Check each box after manually verifying the scenario. Add notes in the "Notes" column.

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [Cached Headers — Repeated Scenario](#test-scenario-1-cached-headers--repeated-scenario) | [x] | Done |
| 2 | [Cache Isolation — Multiple Scenarios](#test-scenario-2-cache-isolation--multiple-scenarios) | [x] | Done |
| 3 | [OAuth2 Token — Dynamic Authorization](#test-scenario-3-oauth2-token--dynamic-authorization) | [x] | Done |
| 4 | [No-Auth Bypass — Token Skip](#test-scenario-4-no-auth-bypass--token-skip) | [x] | |
| 5 | [Cache Clear — Between Test Runs](#test-scenario-5-cache-clear--between-test-runs) | [ ] | |
| 6 | [Load Profile — Cached Prep Under Sustained Load](#test-scenario-6-load-profile--cached-prep-under-sustained-load) | [ ] | |
| 7 | [Template Resolver — Single-Pass Variable Substitution](#test-scenario-7-template-resolver--single-pass-variable-substitution) | [ ] | |
| 8 | [Template Resolver — Large Variable Set](#test-scenario-8-template-resolver--large-variable-set) | [ ] | |
| 9 | [Template Resolver — No Variables (Passthrough)](#test-scenario-9-template-resolver--no-variables-passthrough) | [ ] | |
| 10 | [Combined — Cached Prep + Combined Resolver Under Workflow Load](#test-scenario-10-combined--cached-prep--combined-resolver-under-workflow-load) | [ ] | |

---

## Test Scenario 1: Cached Headers — Repeated Scenario

**Purpose**: Verify that `prepareScenario` caches the computed headers, serialized body, and `Content-Type` after the first iteration, then reuses them across every subsequent iteration of the same test. The first call to `prepareScenario(scenario)` populates the cache; calls 2–50 should hit the cache (one Map lookup).

**Optimization**: 1I — `PreparedScenario` cache (`_prepCache`)

### Steps

**Part A — Create the test**

1. Go to **Test Harness** → create or reuse a Feature Group → Scenario → add a **Test**:
   - **Name**: `Cached Headers Repeat`
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post`
   - **Body Type**: `JSON`, **Body**: `{"name": "test"}`
   - **Custom Headers**: `X-Custom: hello`, `Accept: application/json`
   - **Save**

**Part B — Run and verify**

2. Go to **Test Runner** → select `Cached Headers Repeat`
3. Set **Execution Mode**: `batch`, **Concurrency**: `10`, **Iterations**: `50`
4. Click **Run**
5. After the run finishes, click any result row → response detail modal → verify echoed `headers` contain `X-Custom: hello`, `Accept: application/json`, `Content-Type: application/json`, and the response `data`/`json` shows `{"name": "test"}`
6. Spot-check 3–5 more results — every one should show identical headers and body

### Expected Outcomes

- [x] All 50 requests succeed with correct custom headers present in the response's `headers` echo
- [x] `Content-Type: application/json` is set automatically
- [x] Request body is `{"name": "test"}` in all responses
- [x] No header duplication or missing headers across iterations

---

## Test Scenario 2: Cache Isolation — Multiple Scenarios

**Purpose**: Verify that the prep cache stores **separate entries per test ID**, so two different tests with different headers/bodies don't accidentally share cached data. (Each "Test" in the harness UI becomes its own `Scenario` with a unique `id` in the engine — that ID is the cache key.)

**Optimization**: 1I — Per-scenario-ID cache key (`_prepCache.get(scenario.id)`)

### Steps

**Part A — Create two tests in the same Scenario group**

1. Go to **Test Harness** → create a Feature Group named `PR3 Cache Tests` → inside it create a Scenario named `Isolation Check`
2. Inside `Isolation Check`, add **Test A**:
   - **Name**: `Alpha POST`
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post`
   - **Body Type**: `JSON`, **Body**: `{"type": "A"}`
   - **Custom Headers**: `X-Type: alpha`
   - **Save**
3. Still inside `Isolation Check`, click **+ Add Test** to add **Test B**:
   - **Name**: `Beta GET`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get`
   - **Body Type**: `No Body`
   - **Custom Headers**: `X-Type: beta`
   - **Save**

**Part B — Run both tests together**

4. Go to **Test Runner** → in the left sidebar, check **both** `Alpha POST` and `Beta GET` so both run in the same execution
5. Set **Execution Mode**: `batch`, **Concurrency**: `5`, **Iterations**: `10` (each test runs 10 times → 20 total results)
6. Click **Run**

**Part C — Verify isolation**

7. In the results table, filter or sort by **Scenario Name**:
   - Click any `Alpha POST` result → response detail modal → in the body, expand `headers` — should see `X-Type: alpha` AND `data` field shows `{"type": "A"}`
   - Click any `Beta GET` result → response detail modal → in the body, expand `headers` — should see `X-Type: beta` and `args` field is empty (no body for GET)
8. Spot-check 2–3 results from each test to confirm consistency

### Expected Outcomes

- [x] All 10 `Alpha POST` results echo `X-Type: alpha` and body `{"type": "A"}`
- [x] All 10 `Beta GET` results echo `X-Type: beta` and no body
- [x] No `Alpha POST` result shows `beta` header, no `Beta GET` result shows `alpha` header (zero cross-contamination)
- [x] Result rows are correctly labeled by scenario name in the results table

---

## Test Scenario 3: OAuth2 Token — Dynamic Authorization

**Purpose**: Verify that OAuth2 tests correctly merge the dynamic `Authorization: Bearer <token>` header with the cached base headers. Even though the static headers (`X-Custom`, `Accept`) are cached and reused, the freshly-fetched OAuth2 token must be added to each request without polluting the cache.

**Optimization**: 1I — OAuth2 token path with `needsOAuth` flag (calls `tokenManager.getToken()` and merges into the cached headers per-request)

> **Note**: This scenario requires a working OAuth2 token endpoint. We use **Duende IdentityServer's public demo** ([demo.duendesoftware.com](https://demo.duendesoftware.com)) which supports the `client_credentials` grant with no signup required.

> **How auth works in RedfireForge**: OAuth2 is configured **directly on the Test's Auth tab** (not via a separate "Auth Profiles" page). Auth can also be inherited up the tree — set on the Scenario or Feature Group level, then leave each Test's Auth type as `Inherit from Scenario`. For this scenario we set it directly on the Test for clarity.

### Steps

**Part A — Create the test and select OAuth2 type**

1. Go to **Test Harness** → create a Feature Group → Scenario → click **+ Add Test**
2. In the New Test modal, fill in the basics:
   - **Name**: `OAuth2 Cache Merge`
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post` (echoes all headers so we can see `Authorization`)
3. Click the **Auth** tab (in the test editor's tabs row)
4. Open the **Type** dropdown → choose **`OAuth2 Client Credentials`** (a ✓ next to it means it's selected)

**Part B — Fill in OAuth2 credentials**

5. With OAuth2 selected, the OAuth2 fields appear below. Fill in:
   - **Token URL**: `https://demo.duendesoftware.com/connect/token`
   - **Client ID**: `m2m`
   - **Client Secret**: `secret`
   - **Scope**: (leave blank, or `api` if the field requires a value)
6. Click **Verify Auth** — should return success with a JWT token preview. If it fails, see the Alternative section below.

**Part C — Add body and custom headers**

7. Click the **Body** tab → set:
   - **Body Type**: `JSON`
   - **Body**: `{"oauth": "test"}`
8. Click the **Headers** tab → add two custom headers:
   - `X-Custom`: `hello`
   - `Accept`: `application/json`
9. Click **Save**

**Part D — Run and verify**

10. Go to **Test Runner** → check `OAuth2 Cache Merge` in the sidebar
11. Set **Iterations**: `5` → click **Run**
12. After completion, click each result row to open the Response Detail modal
13. In the response body, expand the `headers` object echoed by httpbin — look for:
    - `Authorization`: `Bearer eyJ...` (a real JWT, much longer than your custom header value)
    - `X-Custom`: `hello` (your static custom header preserved)
    - `Content-Type`: `application/json`

### Expected Outcomes

- [x] All 5 requests include `Authorization: Bearer <jwt-token>` in the echoed headers
- [x] `X-Custom: hello` is also present (cached static header not lost when `Authorization` is merged in)
- [x] `Content-Type: application/json` is present
- [x] All 5 results have status 200
- [x] The Bearer token value is the **same** across all 5 iterations (single token reuse — no refresh storm)

### Alternative — if Duende demo is down

If `demo.duendesoftware.com` is unreachable or returns an error from **Verify Auth**, substitute any OAuth2 client-credentials provider you have access to (Auth0, Okta, Keycloak, your own dev IdP). Fill in its Token URL, Client ID, Client Secret. The verification logic is the same: the response from `httpbin.org/post` must echo back both the dynamic `Authorization` header AND the cached static `X-Custom` header.

---

## Test Scenario 4: No-Auth Bypass — Token Skip

**Purpose**: Verify that tests with **no auth** (`auth.type = 'none'`) skip the token manager entirely. The `needsOAuth` flag is computed once during `prepareScenario` and is `false`, so the per-request hot path becomes a no-op instead of an unnecessary `await tokenManager.getToken()` that resolves immediately to `undefined`.

**Optimization**: 1I — `needsOAuth` flag short-circuits `tokenManager.getToken()` call

### Steps

**Part A — Create a no-auth test**

1. Go to **Test Harness** → create or reuse a Feature Group → Scenario → add a **Test**:
   - **Name**: `No Auth GET`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get`
   - **Body Type**: `No Body`
   - **Auth**: `None` (the default — confirm no auth profile is selected)
   - **Save**

**Part B — Run at high concurrency**

2. Go to **Test Runner** → select `No Auth GET`
3. Set **Execution Mode**: `pool`, **Concurrency**: `20`, **Iterations**: `100`
4. Click **Run** and wait for completion

**Part C — Verify no Authorization header was sent**

5. After the run finishes, click any result row → response detail modal → expand `headers` in the response body
6. Scroll the headers list — there should be **no** `Authorization` key
7. Spot-check 3–5 more results to confirm the same — no `Authorization` header in any of them
8. Check the runner status bar — total wall-clock time should be reasonable (no unexplained pauses; expect roughly 100 × avg-latency / 20 concurrency)

### Expected Outcomes

- [x] All 100 requests complete with status 200
- [x] No `Authorization` header appears in the echoed headers of any result
- [x] No auth-related errors (no "token endpoint unreachable", no "auth profile not found")
- [x] Run completes without unexplained delay at start (no token-fetch pause for no-auth requests)

---

## Test Scenario 5: Cache Clear — Between Test Runs

**Purpose**: Verify that the prep cache is wiped at the start of every `runTest` call, so edits made between runs are picked up immediately. Without this, a user who edits a test's body or headers and re-runs would see the **old** cached values in the response.

**Optimization**: 1I — `clearPrepCache()` called at the start of `runTest()` in `executor.ts`

### Steps

**Part A — Create the test with v1 body**

1. Go to **Test Harness** → create or reuse a Feature Group → Scenario → add a **Test**:
   - **Name**: `Cache Clear Check`
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post`
   - **Body Type**: `JSON`, **Body**: `{"version": "1"}`
   - **Save**

**Part B — First run (v1)**

2. Go to **Test Runner** → select `Cache Clear Check`
3. Set **Iterations**: `3` → click **Run**
4. Click any result row → expand `data` or `json` field in the response body → confirm it shows `{"version": "1"}`

**Part C — Edit body, second run (v2) — without page refresh**

5. Without leaving the page, click back into **Test Harness** → open `Cache Clear Check` → change the body to `{"version": "2"}` → **Save**
6. Go back to **Test Runner** → the same test is still selected → click **Run** again
7. Click any result row from the new run → confirm response body shows `{"version": "2"}` (NOT `{"version": "1"}`)

**Part D — Stress test (optional but recommended)**

8. Repeat the edit-and-rerun cycle with a third value `{"version": "3"}` — confirm it appears
9. Try editing only a custom header (e.g., add `X-Test: foo`) and rerun — confirm the new header appears in the response's echoed headers

### Expected Outcomes

- [ ] First run results echo `{"version": "1"}` in the response `data`/`json` field
- [ ] After editing and re-running, the second run echoes `{"version": "2"}` (NOT `"1"`)
- [ ] No stale cached data leaks across runs — every run reflects the latest saved test definition
- [ ] Works for both body edits AND header edits without needing to refresh the page

---

## Test Scenario 6: Load Profile — Cached Prep Under Sustained Load

**Purpose**: Verify that the prep cache holds up correctly under sustained load, where a single scenario is invoked thousands of times. In load mode, `loadProfileRunner.launchOne()` calls `prepareScenario()` on every invocation — on the first call the result is cached, and every subsequent call should be an O(1) Map lookup with zero header/body recomputation.

**Optimization**: 1I — `prepareScenario()` cache hit path in `loadProfileRunner.launchOne()`

### Steps

**Part A — Create a load test**

1. Go to **Test Harness** → create or reuse a Feature Group → Scenario → add a **Test**:
   - **Name**: `Sustained Load`
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post`
   - **Body Type**: `JSON`, **Body**: `{"load": "sustained", "v": "pr3"}`
   - **Custom Headers**: `X-Load-Test: pr3`, `Accept: application/json`
   - **Save**

**Part B — Run in Load Profile mode**

2. Go to **Test Runner** → select `Sustained Load`
3. Set **Execution Mode**: `load-profile`
4. Configure the load shape:
   - **Shape**: `sustained` (constant concurrency)
   - **Concurrency**: `20`
   - **Duration**: `30s`
5. Click **Run** and let it run for the full 30 seconds

**Part C — Spot-check results**

6. After the run completes, the results table should have several hundred to several thousand rows. Scroll/sort to spot-check at least **10 random rows** spread across the run (first few, middle, last few)
7. For each spot-check, click the row → response detail modal → verify in the echoed `headers`:
   - `X-Load-Test: pr3` is present
   - `Content-Type: application/json` is present
   - Response body `data`/`json` field shows `{"load": "sustained", "v": "pr3"}`
8. Note the **RPS** value displayed in the runner status bar — record it for comparison against PR2 baseline

### Expected Outcomes

- [ ] Total requests >> 100 (depends on network — typically 500–3000 over 30s with httpbin)
- [ ] Every spot-checked result has `X-Load-Test: pr3` and `Content-Type: application/json` (no header drift over time)
- [ ] Every spot-checked result has the correct body in `data`/`json`
- [ ] No errors or NaN/undefined values in the headers across any sampled row
- [ ] RPS is **≥** PR2 baseline (ideally a slight improvement from one fewer `serializeWithContentType` + `buildHeaders` call per invocation)

---

## Test Scenario 7: Template Resolver — Single-Pass Variable Substitution

**Purpose**: Verify that `buildCombinedResolver` substitutes all `{{variable}}` placeholders correctly using a single combined regex pass over the workflow scenario. Previously each variable name compiled its own regex and the engine scanned the scenario N times (one pass per variable). PR3 collapses this to one pass that handles all variables at once.

**Optimization**: 1M — Combined regex resolver built once per workflow execution from all known variable names

### Steps

**Part A — Create a 2-node workflow**

1. Go to **Workflows** in the sidebar → click **+ New Workflow** → name it `Resolver Single Pass`
2. From the palette on the left, drag an **HTTP** node onto the canvas → name it `Node A`
3. Configure `Node A`:
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get`
   - Click the **Extract** tab → click **+ Add Extraction**:
     - **Variable name**: `capturedUrl`
     - **JSONPath**: `$.url` (this captures the full URL httpbin echoes back, e.g., `https://httpbin.org/get`)
   - **Save**
4. Drag a second **HTTP** node onto the canvas → name it `Node B`
5. Configure `Node B`:
   - **Method**: `GET`
   - **URL**: `{{capturedUrl}}` (note: the entire URL is a single placeholder)
   - **Save**
6. Connect `Node A → Node B` (drag from Node A's output handle to Node B's input handle)

**Part B — Add an initial workflow variable**

7. In the Workflow Designer toolbar (the row with `+ New`, workflow name, `Services`, etc.), click the **"Variables"** button (between Services and Versions) to open the Workflow Variables modal → add an initial variable:
   - **Name**: `baseHost`, **Value**: `httpbin.org`
   - (This isn't used by the URLs in this scenario but ensures `buildCombinedResolver` has multiple variables to fold into the combined regex — exercising the single-pass code path)

**Part C — Run via Quick Test**

8. Click the **Quick Test** (play) button in the workflow toolbar
9. Wait for both nodes to turn green (success)

**Part D — Verify substitution**

10. Click on `Node A` → in the execution panel, check the captured `capturedUrl` variable shows `https://httpbin.org/get`
11. Click on `Node B` → check the resolved request URL — it should be `https://httpbin.org/get` (NOT the raw `{{capturedUrl}}` string)
12. In `Node B`'s response, verify the URL was reached successfully (status 200)

### Expected Outcomes

- [ ] Node A returns 200, and `capturedUrl` is captured as `https://httpbin.org/get` (or whatever URL httpbin echoes in `$.url`)
- [ ] Node B's resolved URL shows `https://httpbin.org/get` — the `{{capturedUrl}}` placeholder is fully substituted
- [ ] Node B returns 200 (it wouldn't if the URL still contained literal `{{...}}` text)
- [ ] No `{{...}}` placeholders remain anywhere in Node B's resolved request

---

## Test Scenario 8: Template Resolver — Large Variable Set

**Purpose**: Verify that the combined resolver handles workflows with many initial variables without the old N×M overhead (where N = variable count and M = scenario string length). With one compiled regex covering all variable names, resolution scales linearly with M, regardless of N.

**Optimization**: 1M — Single compiled regex from all variable names; no per-variable scan loop

### Steps

**Part A — Create the workflow with 10 variables**

1. Go to **Workflows** → **+ New Workflow** → name it `Resolver Large Set`
2. Open the **Variables** panel → add the following 10 initial variables (one row each):

   | Name | Value |
   |------|-------|
   | `var1` | `alpha` |
   | `var2` | `bravo` |
   | `var3` | `charlie` |
   | `var4` | `delta` |
   | `var5` | `echo` |
   | `var6` | `foxtrot` |
   | `var7` | `golf` |
   | `var8` | `hotel` |
   | `var9` | `india` |
   | `var10` | `juliet` |

**Part B — Create an HTTP node that references multiple variables**

3. Drag an **HTTP** node onto the canvas → name it `Multi Var Echo`
4. Configure it to exercise placeholders in **URL**, **headers**, and **body** simultaneously:
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post?first={{var1}}&last={{var10}}`
   - **Custom Headers**:
     - `X-Mid: {{var5}}`
     - `X-All: {{var1}}-{{var5}}-{{var10}}`
   - **Body Type**: `JSON`, **Body**: `{"a":"{{var1}}","e":"{{var5}}","j":"{{var10}}"}`
   - **Save**

**Part C — Run and verify**

5. Click **Quick Test** in the workflow toolbar → wait for the node to turn green
6. Click `Multi Var Echo` → response detail
7. In the echoed response from httpbin, verify:
   - `args.first` = `alpha`, `args.last` = `juliet`
   - `headers.X-Mid` = `echo`, `headers.X-All` = `alpha-echo-juliet`
   - `json.a` = `alpha`, `json.e` = `echo`, `json.j` = `juliet`
8. The node should complete in well under a second (no perceptible slowness from the variable count)

### Expected Outcomes

- [ ] URL query params resolve to `first=alpha&last=juliet`
- [ ] Headers `X-Mid` and `X-All` resolve correctly (`echo` and `alpha-echo-juliet`)
- [ ] Body resolves to `{"a":"alpha","e":"echo","j":"juliet"}`
- [ ] **No unresolved `{{varN}}` text** anywhere in the echoed request (would indicate a missed substitution)
- [ ] Node completes quickly (sub-second resolution; no measurable slowdown vs single-variable case)

---

## Test Scenario 9: Template Resolver — No Variables (Passthrough)

**Purpose**: Verify the **edge case** where a workflow has **no variables at all**. The combined-resolver code path must early-return without trying to build/compile an empty regex (which would either crash or, worse, match every character).

**Optimization**: 1M — Early return when the flat variable map is empty; no regex compiled

### Steps

**Part A — Create a minimal workflow**

1. Go to **Workflows** → **+ New Workflow** → name it `Resolver Passthrough`
2. Open the **Variables** panel → confirm it is **empty** (no rows). If any variables exist, remove them
3. Drag a single **HTTP** node onto the canvas → name it `Static GET`
4. Configure it with a fully static request (no `{{...}}` anywhere):
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get?source=passthrough`
   - No custom headers, no body
   - **Save**

**Part B — Run and verify**

5. Click **Quick Test** → wait for the node to turn green
6. Click `Static GET` → response detail
7. Verify:
   - Status is `200`
   - The echoed `url` field shows `https://httpbin.org/get?source=passthrough` exactly (unchanged)
   - The runtime is fast (no perceptible delay from the resolver code path)

### Expected Outcomes

- [ ] Request returns status 200
- [ ] URL in the response is exactly `https://httpbin.org/get?source=passthrough` — no characters added or removed
- [ ] No errors in the workflow execution console related to regex, resolver, or empty variable map
- [ ] Quick Test completes as fast as it would with a non-workflow single-request runner (no resolver overhead when no variables are defined)

---

## Test Scenario 10: Combined — Cached Prep + Combined Resolver Under Workflow Load

**Purpose**: End-to-end smoke test that **both PR3 optimizations** (1I cache + 1M combined resolver) work together correctly under workflow load. This is the real-world case — repeated workflow executions, each with templated requests and extracted variables.

**Optimization**: 1I (prepareScenario cache) + 1M (buildCombinedResolver) acting together

### Steps

**Part A — Build the workflow**

1. Go to **Workflows** → **+ New Workflow** → name it `Combined Cache + Resolver`
2. Open the **Variables** panel → add an initial variable:
   - **Name**: `runId`, **Value**: `test-123`
3. Drag an **HTTP** node onto the canvas → name it `Node A`
4. Configure `Node A`:
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post`
   - **Body Type**: `JSON`, **Body**: `{"key": "{{runId}}"}`
   - Click **Extract** tab → **+ Add Extraction**:
     - **Variable name**: `echoedUrl`
     - **JSONPath**: `$.url`
   - **Save**
5. Drag a second **HTTP** node onto the canvas → name it `Node B`
6. Configure `Node B`:
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get?source={{echoedUrl}}&run={{runId}}`
   - **Save**
7. Connect `Node A → Node B`

**Part B — Run as workflow load test**

8. Save the workflow → go to **Test Runner** → switch to the **Workflows** tab (if separate) or select the workflow target
9. Configure the load:
   - **Iterations**: `30`
   - **Concurrency**: `5`
   - **Mode**: `batch` (or whatever the workflow runner exposes for repeated executions)
10. Click **Run** and wait for completion — expect 30 workflow executions = 60 HTTP requests total

**Part C — Verify both optimizations**

11. Open the results — there should be 30 workflow iteration rows, each with 2 node sub-results
12. Spot-check at least **5 iterations** spread across the run:
    - Click into iteration 1 → `Node A` response → confirm `data` is `{"key": "test-123"}` (resolver substituted `runId`)
    - Same iteration → `Node B` response → confirm `args.source` is the echoed URL from Node A and `args.run` is `test-123`
13. Pick iteration 15 (middle) — verify the same expected substitution still holds (cache did not corrupt the values over time)
14. Pick iteration 30 (last) — same check (no drift in headers/body/URL across all 30 runs)
15. Watch for any rows marked failed or with status ≠ 200

### Expected Outcomes

- [ ] All 30 workflow iterations complete with 60 successful (status 200) requests
- [ ] Every Node A response shows `data` = `{"key": "test-123"}` — `runId` substituted correctly via the combined resolver
- [ ] Every Node B response shows `args.run` = `test-123` and `args.source` = the URL captured from Node A's `$.url`
- [ ] **No** unresolved `{{...}}` text in any echoed URL, header, or body across all 60 requests
- [ ] No errors related to cache staleness, regex compilation, or extraction across iterations
- [ ] Throughput (RPS) is **≥** the PR2 baseline for template-heavy workflows (no regression from combining both optimizations)

---

## Overall Verification Summary

After completing all scenarios:

| Area | Status | Evidence |
|------|--------|----------|
| Prep cache works for repeated scenarios | [ ] | Scenarios 1, 6 |
| Per-scenario cache isolation | [x] | Scenario 2 |
| OAuth2 dynamic token merge | [x] | Scenario 3 |
| No-auth token skip | [x] | Scenario 4 |
| Cache cleared between runs | [ ] | Scenario 5 |
| Combined regex resolves all vars | [ ] | Scenarios 7, 8 |
| Empty variable passthrough | [ ] | Scenario 9 |
| Both optimizations under load | [ ] | Scenario 10 |
