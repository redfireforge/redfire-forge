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
| 1 | [Cached Headers — Repeated Scenario](#test-scenario-1-cached-headers--repeated-scenario) | [ ] | |
| 2 | [Cache Isolation — Multiple Scenarios](#test-scenario-2-cache-isolation--multiple-scenarios) | [ ] | |
| 3 | [OAuth2 Token — Dynamic Authorization](#test-scenario-3-oauth2-token--dynamic-authorization) | [ ] | |
| 4 | [No-Auth Bypass — Token Skip](#test-scenario-4-no-auth-bypass--token-skip) | [ ] | |
| 5 | [Cache Clear — Between Test Runs](#test-scenario-5-cache-clear--between-test-runs) | [ ] | |
| 6 | [Load Profile — Cached Prep Under Sustained Load](#test-scenario-6-load-profile--cached-prep-under-sustained-load) | [ ] | |
| 7 | [Template Resolver — Single-Pass Variable Substitution](#test-scenario-7-template-resolver--single-pass-variable-substitution) | [ ] | |
| 8 | [Template Resolver — Large Variable Set](#test-scenario-8-template-resolver--large-variable-set) | [ ] | |
| 9 | [Template Resolver — No Variables (Passthrough)](#test-scenario-9-template-resolver--no-variables-passthrough) | [ ] | |
| 10 | [Combined — Cached Prep + Combined Resolver Under Workflow Load](#test-scenario-10-combined--cached-prep--combined-resolver-under-workflow-load) | [ ] | |

---

## Test Scenario 1: Cached Headers — Repeated Scenario

**Purpose**: Verify that `prepareScenario` caches the header/body/contentType computation and reuses it across iterations of the same scenario.

**Optimization**: 1I — PreparedScenario cache

### Steps

1. Create a parameterized test with a single `POST` request:
   - URL: `https://httpbin.org/post`
   - Body: `{"name": "test"}` (JSON)
   - Custom headers: `X-Custom: hello`, `Accept: application/json`
2. Set **iterations = 50**, **concurrency = 10** in batch mode
3. Run the test

### Expected Outcomes

- [ ] All 50 requests succeed with correct custom headers present in the response's `headers` echo
- [ ] `Content-Type: application/json` is set automatically
- [ ] Request body is `{"name": "test"}` in all responses
- [ ] No header duplication or missing headers across iterations

---

## Test Scenario 2: Cache Isolation — Multiple Scenarios

**Purpose**: Verify that the cache correctly stores separate entries per scenario ID, so different scenarios don't share headers/body.

**Optimization**: 1I — Per-scenario-ID cache key

### Steps

1. Create two scenarios in the same test:
   - Scenario A: `POST https://httpbin.org/post` with body `{"type": "A"}` and header `X-Type: alpha`
   - Scenario B: `GET https://httpbin.org/get` with header `X-Type: beta`
2. Run as batch with **iterations = 20** (10 of each)
3. Verify that responses from Scenario A show `X-Type: alpha` and body `{"type": "A"}`
4. Verify that responses from Scenario B show `X-Type: beta` and no body

### Expected Outcomes

- [ ] Scenario A results have `X-Type: alpha` in echoed headers
- [ ] Scenario B results have `X-Type: beta` in echoed headers
- [ ] No cross-contamination between cached scenarios
- [ ] All 20 results are correctly attributed (scenarioName matches)

---

## Test Scenario 3: OAuth2 Token — Dynamic Authorization

**Purpose**: Verify that OAuth2 scenarios correctly merge the dynamic `Authorization: Bearer <token>` header with the cached base headers.

**Optimization**: 1I — OAuth2 token path with `needsOAuth` flag

### Steps

1. Create a scenario with `auth.type = 'oauth2'` configured with valid credentials
2. Run the test with **iterations = 5**
3. Verify each request includes the `Authorization: Bearer <token>` header

### Expected Outcomes

- [ ] All requests include `Authorization: Bearer <token>` header
- [ ] Other custom headers are preserved from the cached base headers
- [ ] Token is refreshed when expired (not served from the prep cache)
- [ ] Results show status 200 (or appropriate auth-protected response)

---

## Test Scenario 4: No-Auth Bypass — Token Skip

**Purpose**: Verify that scenarios with `auth.type = 'none'` skip the token manager entirely (no unnecessary async calls).

**Optimization**: 1I — `needsOAuth` flag bypasses `tokenManager.getToken()`

### Steps

1. Create a simple `GET` request with no authentication
2. Run as parameterized with **iterations = 100**, **concurrency = 20**
3. Monitor for any auth-related errors or delays

### Expected Outcomes

- [ ] All 100 requests complete successfully
- [ ] No `Authorization` header in the request log
- [ ] Execution is slightly faster than before (no unnecessary token manager calls)
- [ ] No auth-related errors in results

---

## Test Scenario 5: Cache Clear — Between Test Runs

**Purpose**: Verify that the prep cache is properly cleared between test runs, so stale scenario data doesn't persist.

**Optimization**: 1I — `clearPrepCache()` called at `runTest` start

### Steps

1. Create a `POST` request with body `{"version": "1"}`
2. Run the test once — verify body is correct in response
3. **Edit** the scenario body to `{"version": "2"}`
4. Run the test again — verify the new body appears

### Expected Outcomes

- [ ] First run: response echoes `{"version": "1"}`
- [ ] Second run: response echoes `{"version": "2"}` (cache was cleared)
- [ ] No stale data from the first run bleeds into the second
- [ ] Works correctly for back-to-back runs without refreshing the page

---

## Test Scenario 6: Load Profile — Cached Prep Under Sustained Load

**Purpose**: Verify that the cached scenario preparation works correctly in load profile mode where the same scenario is reused thousands of times.

**Optimization**: 1I — Cache used in `loadProfileRunner.launchOne()`

### Steps

1. Create a load profile test:
   - Endpoint: `POST https://httpbin.org/post` with JSON body
   - Shape: **sustained**, concurrency = 20, duration = 30 seconds
2. Run the test
3. Spot-check 10 random results for correct headers and body

### Expected Outcomes

- [ ] All results have correct headers (no missing `Content-Type`)
- [ ] All results have correct request body in the request log
- [ ] No variance in headers across thousands of iterations
- [ ] RPS should be slightly improved over PR2 baseline (one fewer `serializeWithContentType` + `buildHeaders` call per request)

---

## Test Scenario 7: Template Resolver — Single-Pass Variable Substitution

**Purpose**: Verify that the `buildCombinedResolver` correctly substitutes all `{{variable}}` placeholders in a single regex pass.

**Optimization**: 1M — Combined regex resolver

### Steps

1. Create a workflow with 2 HTTP nodes:
   - Node A: `GET https://httpbin.org/get` → extract `$.url` as `capturedUrl`
   - Node B: `GET {{capturedUrl}}` (uses variable from Node A)
2. Set workflow variables: `baseHost = httpbin.org`
3. Run Quick Test

### Expected Outcomes

- [ ] Node A completes with status 200
- [ ] `capturedUrl` variable is extracted correctly
- [ ] Node B URL resolves correctly using the extracted variable
- [ ] No unresolved `{{...}}` placeholders in the final request

---

## Test Scenario 8: Template Resolver — Large Variable Set

**Purpose**: Verify that the combined resolver handles workflows with many variables efficiently without the N×M regex compilation problem.

**Optimization**: 1M — Single compiled regex from all variable names

### Steps

1. Create a workflow with initial variables:
   - Set 10+ variables: `var1=val1`, `var2=val2`, ..., `var10=val10`
2. Create an HTTP node whose URL includes `{{var1}}` and body includes `{{var5}}` and `{{var10}}`
3. Run Quick Test

### Expected Outcomes

- [ ] All `{{varN}}` placeholders are resolved correctly
- [ ] URL contains `val1`, body contains `val5` and `val10`
- [ ] No performance degradation visible (should complete in same time as before)
- [ ] Variables with special regex characters (if any) are handled safely

---

## Test Scenario 9: Template Resolver — No Variables (Passthrough)

**Purpose**: Verify that the resolver handles the edge case of empty variable maps without errors (fast passthrough).

**Optimization**: 1M — Early return for empty flat map

### Steps

1. Create a workflow with a single HTTP node but **no** initial variables and no extractions
2. Use a static URL: `https://httpbin.org/get`
3. Run Quick Test

### Expected Outcomes

- [ ] Request completes normally with status 200
- [ ] URL is unchanged (no substitution applied)
- [ ] No errors related to empty regex pattern
- [ ] Performance is identical to static URL case

---

## Test Scenario 10: Combined — Cached Prep + Combined Resolver Under Workflow Load

**Purpose**: End-to-end validation that both PR3 optimizations work together in a workflow load test scenario.

**Optimization**: Both 1I and 1M

### Steps

1. Create a workflow with 2 HTTP nodes:
   - Node A: `POST https://httpbin.org/post` with body `{"key": "{{runId}}"}`
   - Node B: `GET https://httpbin.org/get?source={{nodeAStatus}}`
   - Extract `$.url` from Node A as `nodeAStatus`
2. Set initial variable: `runId = test-123`
3. Run as workflow load test: **iterations = 30**, **concurrency = 5**

### Expected Outcomes

- [ ] All 30 iterations complete (60 total requests)
- [ ] Node A body correctly contains `{"key": "test-123"}`
- [ ] Node B URL correctly includes the extracted `nodeAStatus` value
- [ ] No unresolved `{{...}}` in any request
- [ ] Performance is improved over PR2 baseline for template-heavy workflows
- [ ] No cache-related errors or stale data across iterations

---

## Overall Verification Summary

After completing all scenarios:

| Area | Status | Evidence |
|------|--------|----------|
| Prep cache works for repeated scenarios | [ ] | Scenarios 1, 6 |
| Per-scenario cache isolation | [ ] | Scenario 2 |
| OAuth2 dynamic token merge | [ ] | Scenario 3 |
| No-auth token skip | [ ] | Scenario 4 |
| Cache cleared between runs | [ ] | Scenario 5 |
| Combined regex resolves all vars | [ ] | Scenarios 7, 8 |
| Empty variable passthrough | [ ] | Scenario 9 |
| Both optimizations under load | [ ] | Scenario 10 |
