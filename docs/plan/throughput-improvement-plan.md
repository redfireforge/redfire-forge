# Throughput Improvement Plan: Good → Excellent

> From ~500-2,000 RPS to 10,000-50,000+ RPS
> Created: 2026-05-18 (v0.5.8 stable)

---

## Current Architecture Analysis

### Request Flow by Platform

| Surface | HTTP Path |
|---------|-----------|
| **Browser (main thread)** | `httpFetch` → `POST /__proxy` → Vite middleware → `fetch(..., { dispatcher: undici.Agent })` |
| **Browser (Web Worker)** | Worker `httpFetchViaViteProxy` → same `/__proxy` chain |
| **Tauri (main thread)** | `httpFetch` → `@tauri-apps/plugin-http` (native `reqwest`) |
| **Tauri + Web Worker** | Worker posts `http-request` → main `httpFetch` → plugin → posts `http-response` back |
| **Node CLI** | `httpFetch` → `fetch` + `undici.Agent` (or proxy agent) |

### Identified Bottlenecks

| Layer | Current Limit | Impact |
|-------|--------------|--------|
| JS event loop | Single-threaded, even in Web Worker | All HTTP, validation, JSON parsing shares one thread |
| Vite proxy (browser) | Every request → `POST /__proxy` → Node `fetch` → back | Double serialization (JSON encode/decode) on every request |
| Tauri worker bridge | `postMessage` per HTTP request to main thread | Serialize/deserialize every request+response across threads |
| undici pool | 128 connections, pipelining=1 | Hard cap per origin; no HTTP/2 multiplexing |
| Full body reads | `response.text()` always reads entire body into JS string | Memory pressure at high throughput; GC pauses |
| Single worker | One Worker per test run | No multi-core utilization beyond one offloaded thread |
| Load profile ticker | `setInterval(fillPool, 500)` | Coarse-grained concurrency filling; up to 500ms lag |

### Key Files

| File | Role |
|------|------|
| `src/engine/executor.ts` | Orchestration; mode selection, queue expansion |
| `src/engine/requestExecution.ts` | Parameterized HTTP execution + pooling modes |
| `src/shared/utils/httpClient.ts` | All transports + Node undici agent |
| `vite.config.ts` | `/__proxy` middleware + undici pool |
| `src/engine/workerBridge.ts` | Worker lifecycle + Tauri HTTP bridge |
| `src/engine/executionWorker.ts` | Worker entry point |
| `src/engine/workerProtocol.ts` | Typed message protocol |
| `src/features/workflow/engine/graphRunner.ts` | Workflow graph traversal |
| `src/features/workflow/engine/graphRunnerHttpHandler.ts` | HTTP node execution in workflows |
| `src/features/workflow/engine/graphRunnerHelpers.ts` | HTTP fetch + validation in graph mode |
| `src/features/workflow/engine/graphLoadRunner.ts` | Workflow load runner with iteration pool |
| `src/engine/loadProfileRunner.ts` | Duration-based load profile execution |

---

## Improvement Tiers

### Tier 1 — Quick Wins (No Architecture Change)

**Target**: ~3,000-8,000 RPS (from current ~500-2,000)
**Effort**: 2-3 weeks
**Risk**: Low — optimizations within existing architecture

> Deep code audit of every hot-path file (15 files, ~2,500 lines) on 2026-05-18.
> All line numbers reference the v0.5.8 codebase.
> Re-evaluated: 2026-05-18 — expanded to 16 items with precise before/after code.

---

#### 1A. Connection Pool Tuning

**Files**: `src/shared/utils/httpClient.ts` (L221-227), `vite.config.ts` (L46-51)
**Impact**: HIGH — directly controls max concurrent HTTP connections per origin
**Effort**: 30 min

**Analysis**: Both `httpClient.ts` (Node CLI) and `vite.config.ts` (browser proxy) create their own `undici.Agent`. Settings are conservative and inconsistent between the two.

| Setting | httpClient.ts | vite.config.ts | Proposed | Rationale |
|---------|--------------|----------------|----------|-----------|
| `connections` | 128 | 128 | **512** | Allow more concurrent connections per origin |
| `pipelining` | 1 | 1 | **10** | Send multiple requests on same connection before waiting (HTTP/1.1 pipelining) |
| `connect.timeout` | 30,000ms | **MISSING** | **10,000ms** | Fail fast on unreachable hosts; **BUG**: Vite agent has no connect timeout |
| `keepAliveTimeout` | 30,000ms | 30,000ms | 30,000ms | No change needed |

**Implementation Steps**:

1. **`httpClient.ts` L221-227** — update the Agent constructor:
   ```typescript
   // BEFORE:
   _nodeDispatcher = new undici.Agent({
     keepAliveTimeout: 30_000,
     keepAliveMaxTimeout: 60_000,
     connect: { timeout: 30_000 },
     connections: 128,
     pipelining: 1,
   });
   
   // AFTER:
   _nodeDispatcher = new undici.Agent({
     keepAliveTimeout: 30_000,
     keepAliveMaxTimeout: 60_000,
     connect: { timeout: 10_000 },
     connections: 512,
     pipelining: 10,
   });
   ```

2. **`vite.config.ts` L46-51** — update AND add missing `connect`:
   ```typescript
   // BEFORE:
   pooledDispatcher = new undici.Agent({
     keepAliveTimeout: 30_000,
     keepAliveMaxTimeout: 60_000,
     connections: 128,
     pipelining: 1,
   });
   
   // AFTER:
   pooledDispatcher = new undici.Agent({
     keepAliveTimeout: 30_000,
     keepAliveMaxTimeout: 60_000,
     connect: { timeout: 10_000 },
     connections: 512,
     pipelining: 10,
   });
   ```

3. **Unit test**: Verify both agents are constructed with matching configuration.

**Why it matters**: At `connections: 128, pipelining: 1`, max theoretical parallel requests to a single origin is 128. At `connections: 512, pipelining: 10`, it jumps to 5,120 outstanding requests — a 40x increase in connection-level concurrency.

---

#### 1B. Fix `Promise.race` Timeout Timer Leak

**File**: `src/engine/requestExecution.ts` (L31-36)
**Impact**: MEDIUM — eliminates N dangling timers in event loop at high throughput
**Effort**: 30 min

**Analysis**: When `httpFetch` completes before the timeout, the `setTimeout` handle is never cleared. The timer still fires, creates a rejected promise (that nobody catches — it's been swallowed by `Promise.race`), and adds event loop noise. At 1,000 RPS with a 10s timeout, there are 1,000 orphaned timers queued at any time.

**Implementation Steps**:

```typescript
// BEFORE (L29-36):
let resultPromise: Promise<HttpResponse> = httpFetch(url, scenario.method, headers, reqBody);
if (timeoutMs && timeoutMs > 0) {
  const timeoutPromise = new Promise<HttpResponse>((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout (${(timeoutMs / 1000).toFixed(0)}s)`)), timeoutMs);
  });
  resultPromise = Promise.race([resultPromise, timeoutPromise]);
}

// AFTER:
let resultPromise: Promise<HttpResponse> = httpFetch(url, scenario.method, headers, reqBody);
if (timeoutMs && timeoutMs > 0) {
  let timerId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<HttpResponse>((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`Request timeout (${(timeoutMs / 1000).toFixed(0)}s)`)), timeoutMs);
  });
  const origPromise = resultPromise;
  resultPromise = Promise.race([origPromise, timeoutPromise]).finally(() => clearTimeout(timerId!));
}
```

**Unit test**: Verify timer is cleared when request completes before timeout.

---

#### 1C. Reduce Load Profile Tick Interval + Decouple Progress Reporting

**File**: `src/engine/loadProfileRunner.ts` (L162-178)
**Impact**: MEDIUM — 5x faster concurrency ramp; steadier RPS during ramp-up/spike profiles
**Effort**: 45 min

**Analysis**: The `setInterval(ticker, 500)` serves two purposes: (1) top-up the pool via `fillPool()`, and (2) report progress via `onProgress()`. Both run at 500ms. This means:
- Ramp-up can lag by up to 500ms between target concurrency changes and new launches
- Progress reporting also runs at 500ms (fine for UI)

These two concerns should be decoupled: faster fill, slower progress.

**Implementation Steps**:

```typescript
// BEFORE (L162-178):
const ticker = setInterval(() => {
  if (abortSignal?.aborted || breaker.shouldStop || performance.now() - startTime >= durationMs) {
    timerStopped = true;
    clearInterval(ticker);
    if (inFlight === 0) finish();
    return;
  }
  fillPool();
  const elapsed = performance.now() - startTime;
  const target = getTargetConcurrency(profile, elapsed);
  onProgress(allResults.length, -1, allResults, {
    elapsedMs: elapsed, targetConcurrency: target,
    currentInFlight: inFlight, durationMs,
  });
}, 500);

// AFTER:
let lastProgressTime = startTime;
const ticker = setInterval(() => {
  if (abortSignal?.aborted || breaker.shouldStop || performance.now() - startTime >= durationMs) {
    timerStopped = true;
    clearInterval(ticker);
    if (inFlight === 0) finish();
    return;
  }
  fillPool();
  const now = performance.now();
  if (now - lastProgressTime >= 500) {
    lastProgressTime = now;
    const elapsed = now - startTime;
    const target = getTargetConcurrency(profile, elapsed);
    onProgress(allResults.length, -1, allResults, {
      elapsedMs: elapsed, targetConcurrency: target,
      currentInFlight: inFlight, durationMs,
    });
  }
}, 100);
```

**Also**: Already confirmed that `fillPool` is called in the request completion path (L138-139: `applyThinkTime(getThinkTimeMs, abortSignal).then(fillPool)`), so this is purely about the interval between "check if we need to launch more" cycles.

---

#### 1D. Fix `graphLoadRunner` Pool — O(n) → O(1) per Completion

**File**: `src/features/workflow/engine/graphLoadRunner.ts` (L254-273)
**Impact**: HIGH at high concurrency — eliminates O(concurrency) array scan per iteration completion
**Effort**: 1 hour

**Analysis**: The current pool uses `Array.indexOf(p)` + `splice` to remove completed promises. For concurrency=100:
- `indexOf` scans up to 100 elements per completion → O(100)
- `splice` shifts remaining elements → O(100)
- Over 1,000 iterations: ~200,000 array operations

A counter-based pattern eliminates this entirely.

**Implementation Steps**:

```typescript
// BEFORE (L253-273):
} else {
  let launched = 0;
  const pool: Promise<void>[] = [];
  while (launched < iterations) {
    if (abortSignal?.aborted || breaker?.shouldStop) break;
    while (pool.length < concurrency && launched < iterations) {
      launched++;
      const p = runOneIteration().then(() => {
        pool.splice(pool.indexOf(p), 1);
      });
      pool.push(p);
    }
    if (pool.length > 0) {
      await Promise.race(pool);
    }
  }
  await Promise.all(pool);
}

// AFTER — counter-based pattern (matches runPool in requestExecution.ts):
} else {
  let launched = 0;
  let completed = 0;
  
  await new Promise<void>((resolve) => {
    function launchNext() {
      while (launched < iterations && (launched - completed) < concurrency) {
        if (abortSignal?.aborted || breaker?.shouldStop) break;
        launched++;
        runOneIteration().finally(() => {
          completed++;
          if (completed >= iterations || abortSignal?.aborted || breaker?.shouldStop) {
            resolve();
          } else {
            launchNext();
          }
        });
      }
      if (launched >= iterations && completed >= iterations) resolve();
    }
    launchNext();
  });
}
```

**Why counter > Set**: Even `Set.delete` has overhead from hashing and memory cleanup. A simple counter is O(1) with zero allocation.

---

#### 1E. Conditional Body Parsing — Skip `JSON.parse` When Not Needed

**Files**: `src/engine/requestExecution.ts` (L48-52), `src/features/workflow/engine/graphRunnerHelpers.ts` (L199)
**Impact**: HIGH for large responses — `JSON.parse` of a 100KB body takes ~2ms; at 500 RPS that's 1 full second of parse time per second
**Effort**: 2 hours

**Analysis**: Both `executeRequest` and `executeHttpNode` **always** call `JSON.parse(responseBody)` even when the scenario has no validation rules that need a parsed object. The `validate()` function is only called when `validation.mode !== 'none'`, but the parse happens unconditionally.

**Implementation Steps** — `requestExecution.ts` (L44-52):

```typescript
// BEFORE:
httpStatus = result.status;
responseBody = result.body;
responseHeaders = result.headers;
try {
  responseObj = JSON.parse(responseBody);
} catch {
  responseObj = responseBody;
}

// AFTER:
httpStatus = result.status;
responseBody = result.body;
responseHeaders = result.headers;
const needsParse = scenario.validation.mode !== 'none'
  || (scenario.validation.assertions?.length ?? 0) > 0
  || (scenario.validation.expectedFields?.length ?? 0) > 0
  || (scenario as { extractions?: unknown[] }).extractions?.length;
if (needsParse && responseBody) {
  try { responseObj = JSON.parse(responseBody); } catch { responseObj = responseBody; }
} else {
  responseObj = responseBody;
}
```

**Same pattern in `graphRunnerHelpers.ts`** (L199):
```typescript
// BEFORE:
try { responseObj = JSON.parse(responseBody); } catch { responseObj = responseBody; }

// AFTER:
const needsParse = resolvedAbs.validation.mode !== 'none'
  || (resolvedAbs.validation.assertions?.length ?? 0) > 0
  || data.scenario.extractions?.length;
if (needsParse && responseBody) {
  try { responseObj = JSON.parse(responseBody); } catch { responseObj = responseBody; }
} else {
  responseObj = responseBody;
}
```

**Note**: The `buildValidationResult` function already handles `responseObj` being a string — it checks `typeof responseObj === 'object'` before deep comparison. So skipping parse is safe.

---

#### 1F. Reduce Vite Proxy Overhead — O(n²) → O(n) Body Concatenation

**File**: `vite.config.ts` (L71-74, L91, L103, L110, L115, L139-140)
**Impact**: HIGH — the Vite proxy is the #1 bottleneck in browser/worker dev mode
**Effort**: 3 hours

**Problem 1 — Quadratic body concatenation** (L71-73):
The `rawBody += chunk` pattern is O(n²) because strings are immutable in JS — each concatenation copies all previous bytes. A 100KB POST body arriving in 16 chunks causes ~800KB of intermediate copies.

```typescript
// BEFORE (L71-74):
let rawBody = '';
for await (const chunk of req) {
  rawBody += chunk;
}

// AFTER:
const chunks: Buffer[] = [];
for await (const chunk of req) {
  chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
}
const rawBody = Buffer.concat(chunks).toString('utf8');
```

**Problem 2 — Redundant header object allocation** (L91):
```typescript
// BEFORE:
const headers = { ...payload.headers, 'Connection': 'keep-alive' };

// AFTER — mutate in place (payload is already parsed and ephemeral):
payload.headers['Connection'] = 'keep-alive';
const headers = payload.headers;
```

**Problem 3 — `round2` function recreated per request** (L103):
```typescript
// BEFORE (inside the middleware handler):
const round2 = (n: number) => Math.round(n * 100) / 100;

// AFTER — hoist to module scope (it's stateless):
// Move to top of proxyPlugin() or module scope
```

**Problem 4 — `Object.fromEntries(response.headers.entries())` per request** (L115):
Headers object allocation per response. Replace with direct iteration:
```typescript
// BEFORE:
headers: Object.fromEntries(response.headers.entries()),

// AFTER:
const resHeaders: Record<string, string> = {};
response.headers.forEach((v, k) => { resHeaders[k] = v; });
// ... use resHeaders
```

**Problem 5 — Full response body in JSON envelope** (L139-140):
The entire response body (potentially megabytes) is wrapped inside a JSON string. This means the body is escaped/quoted by `JSON.stringify`, then the browser has to `JSON.parse` it back. For a 1MB body, that's ~3MB of string operations per request (original + escaped + parsed).

**No easy fix without protocol change**, but we can add a response body cap to prevent pathological cases:
```typescript
// After L110:
const MAX_PROXY_BODY = 2 * 1024 * 1024; // 2MB
const responseBody = await response.text();
const cappedBody = responseBody.length > MAX_PROXY_BODY
  ? responseBody.slice(0, MAX_PROXY_BODY) : responseBody;
```

---

#### 1G. Throttle Worker Progress Messages

**Files**: `src/engine/executionWorker.ts` (L56-59), `src/engine/workerBridge.ts` (L52)
**Impact**: MEDIUM — reduces GC pressure from frequent `allResults.slice()` allocations + `postMessage` serialization
**Effort**: 1 hour

**Analysis**: The worker's `onProgress` callback fires after **every single request completion** (via `runPool.finally`, `loadProfileRunner.finally`, etc.). Each invocation:
1. `allResults.slice(lastSentCount)` — creates a new array
2. `postMsg(...)` — structured-clone serializes every `RequestResult` in `newResults` across the thread boundary
3. Bridge side: `allResults.push(...msg.newResults)` — spread into array

At 2,000 RPS, that's 2,000 `postMessage` calls/sec, each with structured clone overhead.

**Implementation Steps** — `executionWorker.ts` (L56-59):

```typescript
// BEFORE:
(completed, total, allResults, meta) => {
  const newResults = allResults.slice(lastSentCount);
  lastSentCount = allResults.length;
  postMsg({ type: 'progress', completed, total, newResults, meta });
},

// AFTER — throttle to every 200ms or final:
let lastProgressPost = 0;
const THROTTLE_MS = 200;
// ...
(completed, total, allResults, meta) => {
  const now = performance.now();
  const isFinal = completed >= total;
  if (!isFinal && now - lastProgressPost < THROTTLE_MS) return;
  lastProgressPost = now;
  const newResults = allResults.slice(lastSentCount);
  lastSentCount = allResults.length;
  postMsg({ type: 'progress', completed, total, newResults, meta });
},
```

**Bridge side** — `workerBridge.ts` (L52):
```typescript
// BEFORE:
allResults.push(...msg.newResults);

// AFTER — avoid spread for large batches:
for (const r of msg.newResults) allResults.push(r);
```

**Interaction with load profile**: The load profile runner also has its own 500ms progress ticker (1C above). Both throttles work independently — the worker-level throttle reduces thread-crossing messages, the load profile throttle reduces `getTargetConcurrency` recalculation.

---

#### 1H. Replace `uuidv4()` with Monotonic Counter for Result IDs

**Files**: `src/engine/requestExecution.ts` (L17), `src/features/workflow/engine/graphRunnerHelpers.ts` (L229), `src/features/workflow/engine/graphLoadRunner.ts` (L181, L208)
**Impact**: LOW-MEDIUM — eliminates `crypto.getRandomValues()` + hex encoding per request (4 call sites)
**Effort**: 45 min

**Analysis**: `uuidv4()` is called in 4 places across the hot path to generate `RequestResult.id`. This involves:
1. `crypto.getRandomValues(new Uint8Array(16))` — kernel entropy source
2. Byte-to-hex string conversion (128-bit → 36 chars with dashes)

Result IDs only need to be unique within a single test run. A monotonic counter suffices.

**Implementation Steps**:

1. Create a shared helper (new file or add to `requestExecution.ts`):
   ```typescript
   let _resultIdCounter = 0;
   export function resetResultIdCounter(): void { _resultIdCounter = 0; }
   export function nextResultId(): string { return `r-${++_resultIdCounter}`; }
   ```

2. Replace in `requestExecution.ts` L17:
   ```typescript
   // BEFORE: const id = uuidv4();
   const id = nextResultId();
   ```

3. Replace in `requestExecution.ts` L212 (error path):
   ```typescript
   // BEFORE: id: `err-${Date.now()}`,
   id: nextResultId(),
   ```

4. Replace in `graphRunnerHelpers.ts` L229:
   ```typescript
   // BEFORE: id: uuidv4(),
   id: nextResultId(),
   ```

5. Replace in `graphLoadRunner.ts` L181 and L208 (cancelled/error results):
   ```typescript
   // BEFORE: id: crypto.randomUUID(),
   id: nextResultId(),
   ```

6. Call `resetResultIdCounter()` at the start of `runTest()` in `executor.ts`.

7. **Keep** `crypto.randomUUID()` in `executionWorker.ts` L30 (Tauri bridge request IDs) — those need global uniqueness across main↔worker.

8. Remove `import { v4 as uuidv4 } from 'uuid'` from `requestExecution.ts` and `graphRunnerHelpers.ts` — shrinks the bundle too.

---

#### 1I. Cache Static Headers & URL per Scenario

**Files**: `src/engine/executor.ts` (L35-65), `src/engine/requestExecution.ts` (L203-206), `src/engine/loadProfileRunner.ts` (L94-97)
**Impact**: LOW-MEDIUM — avoids rebuilding identical objects thousands of times
**Effort**: 1.5 hours

**Analysis**: For every single request, the hot path calls:
1. `serializeWithContentType(scenario)` — recomputes body type, rebuilds URLSearchParams or multipart boundary
2. `buildHeaders(scenario, token, contentType)` — iterates `scenario.headers`, calls `.trim()` 2x per header key, calls `resolveAuthHeaders()`
3. `buildUrl(scenario)` — for API Key in query, creates `new URL()` + `.toString()` every time

For a test with 1 scenario running 10,000 iterations, these are called 10,000 times with **identical** scenario data (only the OAuth2 token may change).

**Implementation Steps**:

1. Add a `PreparedScenario` cache in `requestExecution.ts`:
   ```typescript
   interface PreparedScenario {
     body: string | undefined;
     contentType: string | null;
     baseHeaders: Record<string, string>;  // Everything except dynamic Authorization
     resolvedUrl: string;
     needsOAuth: boolean;
   }
   const _prepCache = new Map<string, PreparedScenario>();
   
   function prepareScenario(scenario: Scenario): PreparedScenario {
     const cached = _prepCache.get(scenario.id);
     if (cached) return cached;
     const { body, contentType } = serializeWithContentType(scenario);
     const baseHeaders = buildHeaders(scenario, undefined, contentType);
     const resolvedUrl = buildUrl(scenario);
     const needsOAuth = scenario.auth.type === 'oauth2';
     const prep = { body, contentType, baseHeaders, resolvedUrl, needsOAuth };
     _prepCache.set(scenario.id, prep);
     return prep;
   }
   ```

2. In `runPool` L203-206, replace per-request prep:
   ```typescript
   // BEFORE:
   const { body: reqBody, contentType } = serializeWithContentType(scenario);
   tokenManager.getToken(scenario).then((token) => {
     const headers = buildHeaders(scenario, token, contentType);
     return executeWithRetry(scenario, headers, reqBody, timeoutMs, retryCount, retryDelayMs);
   })
   
   // AFTER:
   const prep = prepareScenario(scenario);
   const tokenPromise = prep.needsOAuth ? tokenManager.getToken(scenario) : Promise.resolve(undefined);
   tokenPromise.then((token) => {
     const headers = token
       ? { ...prep.baseHeaders, Authorization: `Bearer ${token}` }
       : prep.baseHeaders;
     return executeWithRetry(scenario, headers, prep.body, timeoutMs, retryCount, retryDelayMs);
   })
   ```

3. Same pattern in `runSequential`, `runBatch`, and `loadProfileRunner.launchOne`.

4. Clear the cache at test start: `_prepCache.clear()`.

**Note for `form-data`**: The multipart boundary includes `Date.now().toString(36)` (bodySerializer.ts L40), so it changes per call. This is fine for load testing — the boundary value doesn't affect correctness. Cache is still valid.

**Note for `graphRunnerHelpers.ts`**: Don't cache here — workflow scenarios are variable-substituted per iteration, so each call gets a different resolved URL/body. The cache only applies to parameterized/load test runners.

---

#### 1J. Fix Load Profile Error Result — Missing Fields

**File**: `src/engine/loadProfileRunner.ts` (L101-118)
**Impact**: LOW (correctness, not throughput) — but causes downstream UI inconsistencies
**Effort**: 30 min

**Bug**: When `launchOne` catches an error, the `RequestResult` is missing fields that `runPool` includes in its catch path (requestExecution.ts L211-229):

| Field | `runPool` catch | `loadProfileRunner` catch |
|-------|----------------|--------------------------|
| `responseHeaders` | `{}` | **missing** |
| `requestLog` | `{ headers: {}, body: reqBody }` | **missing** |
| `timing` | (not present) | (not present) |

**Implementation Steps** — add missing fields to L102-118:
```typescript
const errorResult: RequestResult = {
  id: nextResultId(),  // Also fix: currently uses `err-${Date.now()}`
  scenarioId: scenario.id,
  scenarioName: scenario.name,
  featureGroupName: scenario.featureGroupName,
  groupName: scenario.groupName,
  url: scenario.url,
  method: scenario.method,
  httpStatus: 0,
  responseTimeMs: 0,
  responseBody: '',
  timestamp: Date.now(),
  passed: false,
  validationMode: scenario.validation.mode,
  failureDetails: [...],
  errorMessage: ...,
  responseHeaders: {},                          // ADD
  requestLog: { headers: {}, body: reqBody },   // ADD
};
```

---

#### 1K. Add Timeout to Workflow Graph HTTP Execution

**File**: `src/features/workflow/engine/graphRunnerHelpers.ts` (L191-192)
**Impact**: MEDIUM — prevents hung connections from blocking entire graph branches indefinitely
**Effort**: 1.5 hours

**Analysis**: `executeHttpNode` calls `httpFetch` directly (L192) with **no timeout**. In contrast, the parameterized runner (`requestExecution.ts`) wraps `httpFetch` in `Promise.race` with a configurable timeout. A single hung connection in a workflow can block the entire iteration forever — the graph runner has no recovery mechanism.

**Implementation Steps**:

1. Add optional `timeoutMs` parameter to `executeHttpNode`:
   ```typescript
   export async function executeHttpNode(
     data: HttpNodeData,
     ctx: VariableContext,
     tokenManager: TokenManager,
     httpNodeId: string,
     workflowDefaults: Record<string, string>,
     resolveHttpBaseUrl?: ...,
     resolveHttpAuth?: ...,
     timeoutMs?: number,  // ADD
   ): Promise<...> {
   ```

2. Wrap the `httpFetch` call (L192) with timeout:
   ```typescript
   // BEFORE:
   const result = await httpFetch(url, resolvedAbs.method, headers, reqBody);
   
   // AFTER:
   let fetchPromise: Promise<HttpResponse> = httpFetch(url, resolvedAbs.method, headers, reqBody);
   if (timeoutMs && timeoutMs > 0) {
     let timerId: ReturnType<typeof setTimeout>;
     const timeoutPromise = new Promise<HttpResponse>((_, reject) => {
       timerId = setTimeout(() => reject(new Error(`Request timeout (${(timeoutMs / 1000).toFixed(0)}s)`)), timeoutMs);
     });
     fetchPromise = Promise.race([fetchPromise, timeoutPromise]).finally(() => clearTimeout(timerId!));
   }
   const result = await fetchPromise;
   ```

3. Thread `timeoutMs` from `GraphLoadRunOpts` → `runGraph` → `handleHttpNode` → `executeHttpNode`. Default to 30 seconds if not specified.

4. **Unit test**: Mock `httpFetch` to never resolve; verify timeout fires and returns error result.

---

#### 1L. Pre-allocate Result Array at Known Size

**Files**: `src/engine/requestExecution.ts` (L141, L160, L192), `src/engine/executor.ts` (L112)
**Impact**: LOW — reduces array resizing overhead for large runs
**Effort**: 20 min

**Analysis**: `allResults: RequestResult[] = []` starts at capacity 0 and grows dynamically. For a 10,000-iteration run, V8 resizes the backing store ~14 times (doubling strategy). Pre-allocating avoids this.

**Implementation Steps**:

```typescript
// In runSequential, runBatch, runPool — the total is known:
const allResults: RequestResult[] = [];
// Not helpful to pre-fill (Array(total) creates sparse array)
// But we CAN hint V8:
if (total > 1000) {
  // Force V8 to allocate backing store upfront
  allResults.length = total;
  allResults.length = 0;
}
```

Or more practically: since `runPool` already has `const total = queue.length`, and the final check is `allResults.length >= total`, V8 already optimizes well for `push()` in hot loops. **Marginal gain — include only if bundled with other changes.**

---

#### 1M. Eliminate Duplicate Template Literal Passes in `graphRunnerHelpers`

**File**: `src/features/workflow/engine/graphRunnerHelpers.ts` (L148-182)
**Impact**: LOW-MEDIUM for template-heavy workflows — avoids multiple regex passes over URL/body/headers
**Effort**: 1 hour

**Analysis**: `executeHttpNode` runs three layers of variable substitution:
1. `resolveScenario(scenario, stepCtx)` — resolves `{{varName}}` from VariableContext (L165)
2. `applyTemplateLiteralsToScenario(resolved, flatLiterals)` — regex replace on URL + body + every header (L171)
3. `applyTemplateLiteralsFromMap(url, flatLiterals)` if URL still has `{{` (L181)

Each `applyTemplateLiteralsFromMap` iterates **all** entries in `flatLiterals` and creates a `new RegExp(...)` per key (L35). For workflows with 50+ variables, that's 50+ regex compilations per field.

**Optimization**: Pre-compile a single combined regex from all variable names:

```typescript
function buildCombinedResolver(flat: Record<string, string>): (template: string) => string {
  const entries = Object.entries(flat).filter(([k]) => k.trim());
  if (entries.length === 0) return (t) => t;
  const pattern = entries.map(([k]) => `\\{\\{\\s*${escapeRegExp(k.trim())}\\s*\\}\\}`).join('|');
  const re = new RegExp(pattern, 'g');
  const lookup = new Map(entries.map(([k, v]) => [k.trim(), v]));
  return (template: string) => {
    if (!template.includes('{{')) return template;
    return template.replace(re, (match) => {
      const key = match.replace(/\{\{\s*|\s*\}\}/g, '');
      return lookup.get(key) ?? match;
    });
  };
}
```

Then use `const resolve = buildCombinedResolver(flatLiterals)` once per HTTP node execution, and call `resolve(url)`, `resolve(body)`, etc. — one regex pass per string instead of N.

---

#### 1N. Avoid Redundant `getTargetConcurrency` Calls

**File**: `src/engine/loadProfileRunner.ts` (L121-130 vs L156 vs L169-171)
**Impact**: LOW — micro-optimization but trivially cheap to fix
**Effort**: 15 min

**Analysis**: `getTargetConcurrency(profile, elapsed)` is called:
1. In `fillPool` (L156) — to determine how many to launch
2. In `launchOne.finally` (L124) — for progress reporting
3. In the ticker (L171) — for progress reporting

All three compute `elapsed` independently (`performance.now() - startTime`). After implementing 1C (separate fill vs progress), the ticker's progress path already computes `target` — so `launchOne.finally` doesn't need to recompute it (it can let the next ticker report it).

**Steps**: Remove the `getTargetConcurrency` call from the `launchOne.finally` progress callback (L124-125). The `onProgress` there is already somewhat redundant with the ticker's progress — it just adds extra reporting. After 1C, the ticker runs at 100ms, so removing the per-completion progress from `launchOne.finally` saves one `getTargetConcurrency` call per request.

---

#### 1O. Reduce `buildHeaders` String Operations

**File**: `src/engine/executor.ts` (L35-55)
**Impact**: LOW — eliminates redundant `.trim()` calls (3x per header × N headers × M requests)
**Effort**: 30 min

**Analysis**: `buildHeaders` calls `h.key.trim()` up to **three times** per header in the loop body:
- L38: `if (h.key.trim())` — guard
- L39: `if (h.key.trim().toLowerCase() === 'authorization' ...)` — auth check
- L42: `headers[h.key.trim()] = h.value` — assignment

**Steps**:
```typescript
// BEFORE (L37-43):
for (const h of scenario.headers) {
  if (h.key.trim()) {
    if (h.key.trim().toLowerCase() === 'authorization' && scenario.auth.type !== 'none') {
      continue;
    }
    headers[h.key.trim()] = h.value;
  }
}

// AFTER:
for (const h of scenario.headers) {
  const key = h.key.trim();
  if (!key) continue;
  if (key.toLowerCase() === 'authorization' && scenario.auth.type !== 'none') continue;
  headers[key] = h.value;
}
```

This also makes the code more readable. Combined with 1I (caching), headers are only built once per scenario anyway — but this fix applies to all paths including workflow execution.

---

#### 1P. Multi-Worker Execution (Largest Single Win)

**Files**: `src/engine/workerBridge.ts`, `src/engine/executionWorker.ts`, `src/engine/workerProtocol.ts`
**Impact**: VERY HIGH — enables multi-core utilization (the only way to break past single-thread ceiling in JS)
**Effort**: 3-5 days

**Current state**: One Worker per test run. On a modern 4-8 core machine, only 2 threads are active (main + 1 worker). The worker runs `runTest()` which does ALL work: queue expansion, HTTP fetching, JSON parsing, validation, progress reporting — all on a single thread.

**Architecture**:
```
Main Thread (UI + aggregation)
  ├── Worker 1 (scenarios 0-249, concurrency=N/4)   → progress batches
  ├── Worker 2 (scenarios 250-499, concurrency=N/4)  → progress batches
  ├── Worker 3 (scenarios 500-749, concurrency=N/4)  → progress batches
  └── Worker 4 (scenarios 750-999, concurrency=N/4)  → progress batches
  └── Aggregator: merge results, enforce circuit breaker, report to UI
```

**Detailed Implementation Steps**:

1. **Determine worker count** — new helper:
   ```typescript
   function getWorkerCount(): number {
     const cores = navigator.hardwareConcurrency ?? 2;
     return Math.max(1, Math.min(cores - 1, 8));
   }
   ```

2. **Split queue** — in `runTestMultiWorker()`:
   ```typescript
   const N = getWorkerCount();
   const chunkSize = Math.ceil(expandedQueue.length / N);
   const chunks = Array.from({ length: N }, (_, i) =>
     expandedQueue.slice(i * chunkSize, (i + 1) * chunkSize)
   );
   const perWorkerConcurrency = Math.max(1, Math.ceil(config.concurrency / N));
   ```

3. **Add `MainToWorkerMessage` variant** — in `workerProtocol.ts`:
   ```typescript
   | { type: 'start'; config: TestConfig; scenarios: Scenario[];
       useTauriProxy: boolean; workflow?: Workflow;
       workerIndex?: number; totalWorkers?: number }  // ADD fields
   ```

4. **New `runTestMultiWorker` function** — in `workerBridge.ts`:
   - Spawn N workers, each with `config = { ...config, concurrency: perWorkerConcurrency }`
   - Each worker gets its own `scenarios` slice
   - Main thread merges `newResults` from all workers
   - Circuit breaker: main thread checks after each progress message; sends `abort` to all workers if tripped
   - On `done` from all workers: merge traces, resolve

5. **Load profile mode** — each worker runs `runLoadProfile` with `concurrency / N`
   - Weighted iterator is independent per worker (no cross-worker coordination needed)
   - Total concurrency target = sum of all workers' targets

6. **Workflow mode** — keep single-worker for now
   - Graph topology has dependencies (edges, variable state) that can't be trivially split
   - Multi-iteration workflow load (`graphLoadRunner`) could use N workers for N iterations, but the graph within each iteration stays single-threaded
   - Revisit after Tier 1 ships

7. **Tauri mode**: Workers still proxy HTTP through main thread (Tauri plugin is main-thread-only), but the JS work (validation, header building, body parsing, JSON.parse) is parallelized across cores. This is where 1E (conditional body parsing) and 1I (header caching) compound — each worker benefits independently.

8. **Fallback**: If `navigator.hardwareConcurrency === 1` or Worker constructor fails, fall back to single-worker path (existing `runTestInWorker`).

**Risks & Mitigations**:
- **Circuit breaker coordination**: Main thread polls workers; adds ~200ms lag before tripping. Acceptable — exact same lag as UI progress updates.
- **Progress reporting**: Each worker sends throttled batches (from 1G); main thread merges. Total progress = sum of all workers' `completed` counts.
- **Memory**: N workers × copy of `scenarios[]` + `config`. For 100 scenarios, this is negligible (~100KB × N).
- **Worker startup**: ~50ms per worker. Spawn all N in parallel, wait for all to send first `progress`.

---

### Tier 1 Implementation Order (Priority × Risk)

```
─── PR 1: Hot-path micro-optimizations (COMPLETED 2026-05-18) ───
  1O  Reduce buildHeaders string ops      [30 min]  ✅ DONE — executor.ts
  1B  Fix Promise.race timeout leak       [30 min]  ✅ DONE — requestExecution.ts
  1H  Replace UUID with counter           [45 min]  ✅ DONE — 5 files (requestExecution, executor, loadProfileRunner, graphRunnerHelpers, graphLoadRunner)
  1N  Avoid redundant concurrency calc    [15 min]  ✅ DONE — loadProfileRunner.ts
  1J  Fix load profile error consistency  [30 min]  ✅ DONE — loadProfileRunner.ts (added responseHeaders, requestLog)
  1D  Fix graphLoadRunner pool O(n)→O(1)  [1 hour]  ✅ DONE — graphLoadRunner.ts (counter-based pattern)
  1E  Conditional body parsing            [2 hours] ✅ DONE — requestExecution.ts + graphRunnerHelpers.ts
  1L  Pre-allocate result arrays          [—]       ✅ DONE — skipped intentionally (marginal gain, V8 handles dynamic arrays efficiently)

─── PR 2: Transport & scheduling (COMPLETED 2026-05-18) ────────
  1A  Connection pool tuning              [30 min]  ✅ DONE — httpClient.ts + vite.config.ts (512 conn, pipelining=10, 10s connect timeout)
  1F  Reduce Vite proxy overhead          [3 hours] ✅ DONE — vite.config.ts (Buffer.concat body, in-place headers, forEach response headers, hoisted round2)
  1C  Reduce load profile tick            [45 min]  ✅ DONE — loadProfileRunner.ts (100ms fill, 500ms progress reporting decoupled)
  1K  Add graph HTTP timeout              [1.5 hr]  ✅ DONE — graphRunnerHelpers.ts + graphRunnerNodeHandlerContext.ts + graphRunner.ts (30s default)
  1G  Throttle worker progress            [1 hour]  ✅ DONE — executionWorker.ts (250ms throttle with drain on completion)

─── PR 3: Caching & deduplication (COMPLETED 2026-05-18) ────────
  1I  Cache static headers per scenario   [1.5 hr]  ✅ DONE — PreparedScenario cache in requestExecution.ts, used by runSequential/runBatch/runPool/loadProfileRunner
  1M  Deduplicate template literal passes [1 hour]  ✅ DONE — buildCombinedResolver() single-regex in graphRunnerHelpers.ts

─── PR 4: Multi-worker (COMPLETED 2026-05-18) ──────────────────
  1P  Multi-worker execution              [3-5 days] ✅ DONE — runTestMultiWorker() in workerBridge.ts, N workers via hardwareConcurrency, queue splitting, aggregation
```

### Expected Cumulative Improvement

| Phase | Items | Estimated RPS | Multiplier | Status |
|-------|-------|---------------|------------|--------|
| Baseline (v0.5.8) | — | ~1,500 | 1.0x | — |
| **PR 1** (hot-path micro) | 1O, 1B, 1H, 1N, 1J, 1D, 1E | ~2,800 | 1.9x | **✅ DONE** |
| **PR 2** (transport) | 1A, 1F, 1C, 1K, 1G | ~3,500 | 2.3x | **✅ DONE** |
| **PR 3** (caching) | 1I, 1M | ~4,000 | 2.7x | **✅ DONE** |
| **PR 4** (multi-worker) | 1P | ~6,000-8,000 | 4-5x | **✅ DONE** |

**Key insight**: Items 1A through 1O compound. Each removes a small bottleneck, shifting the constraint to the next layer. Without 1P (multi-worker), the ceiling is ~4,000 RPS due to single-thread JS limits. With 1P, we break past that ceiling by distributing JS work across cores while sharing the same HTTP transport layer.

**Browser vs Desktop vs CLI impact**:
- **Browser (Vite proxy)**: 1F is the biggest win (removes O(n²) + double-serialization); 1A affects the server-side undici pool
- **Tauri desktop**: 1G is critical (reduces `postMessage` overhead); 1P parallelizes JS validation work
- **Node CLI**: 1A + 1I + 1E compound most (direct undici connections, cached headers, skip parse)
- **All platforms**: 1B, 1D, 1H, 1O, 1P benefit equally

### Tier 2 — Native Rust Executor via `#[tauri::command]`

**Target**: ~10,000-15,000 RPS (desktop only)
**Effort**: ~2 weeks (10-13 days)
**Risk**: Low-Medium — Rust code runs inside existing Tauri process, no new binary
**Revised**: 2026-05-18 — changed from sidecar to in-process `#[tauri::command]`

> **Why not a sidecar?** The original plan proposed a separate Rust binary. After re-evaluation:
>
> | | `#[tauri::command]` (Chosen) | Sidecar binary (Original) |
> |---|---|---|
> | **Build complexity** | Zero — same `Cargo.toml` | High — separate crate, cross-platform naming with target triples |
> | **IPC** | Tauri invoke (fast, typed serde) | stdin/stdout JSON lines (slow, line-delimited) |
> | **Streaming results** | `app.emit()` events (structured) | stdout lines (parse per line) |
> | **Connection pool** | Shared process memory | Separate process, no sharing |
> | **Abort signal** | `CancellationToken` in shared state | Kill process (unclean) |
> | **Bundle size** | +2-3 MB (reqwest/tokio linked into existing binary) | +8-10 MB (full standalone binary) |
> | **Effort** | ~2 weeks | ~3-4 weeks |
> | **Thread blocking** | tokio runs on its own thread pool — does NOT block Tauri main | N/A (separate process) |
>
> The `#[tauri::command]` approach is simpler, faster to build, and has better IPC performance.
> tokio's multi-threaded runtime runs on its own OS threads — the Tauri main thread (WebView events)
> is never blocked, which was the original concern that motivated the sidecar approach.

---

#### Architecture

```
Current (Tauri mode):
  Worker → postMessage → Main Thread → @tauri-apps/plugin-http → Response → postMessage → Worker
  Bottleneck: per-request IPC serialization through JS main thread, single connection pool

After Tier 2 (Tauri + Rust executor):
  JS UI → invoke("start_load_test", plan) → Rust #[tauri::command]
    → tokio::spawn N virtual users
    → reqwest::Client (shared pool, HTTP/1.1 + HTTP/2)
    → batch results every 100ms → app.emit("load-test-progress", batch)
  JS UI ← listen("load-test-progress") → update UI + validate in JS

  Abort: JS → invoke("abort_load_test") → CancellationToken → all tasks stop
```

**Key advantage**: HTTP requests go directly from Rust → network → Rust. No JS involvement in the
hot path. JS only handles UI rendering and validation of batched results.

---

#### Current Tauri Setup (as of v0.5.8)

| Component | Status |
|-----------|--------|
| Tauri version | **v2.10.3** |
| `tauri-plugin-shell` | Installed + registered (unused from TS) |
| `tauri-plugin-http` | Used for all HTTP in Tauri mode |
| Custom `#[tauri::command]` | **None** — `lib.rs` has no `invoke_handler` yet |
| Sidecar / `externalBin` | **None** configured |
| `Cargo.toml` deps | serde, serde_json, log, clap, 5 Tauri plugins |
| `capabilities/default.json` | `core:default`, `fs`, `http:*`, `dialog`, `shell:allow-open` |

---

#### 2A. Add `reqwest` + `tokio` to Tauri Binary — ✅ COMPLETED

**Effort**: 2-3 days → **Completed Day 1** (re-evaluation found reqwest 0.13 is latest, `rustls` is default TLS)
**Files**: `src-tauri/Cargo.toml`, `src-tauri/src/executor.rs` (new), `src-tauri/src/types.rs` (new), `src-tauri/src/commands.rs` (new), `src-tauri/src/executor_test.rs` (new)

**Step 1 — Dependencies** (`Cargo.toml`) — ✅ Done:

```toml
# ADDED to [dependencies]:
reqwest = { version = "0.13", features = ["json", "gzip", "brotli"] }  # v0.13: rustls is default TLS
tokio = { version = "1", features = ["full"] }
tokio-util = "0.7"       # CancellationToken
rand = "0.9"             # Think time (uniform/gaussian) + weighted scenario shuffle
```

**Step 2 — Shared types** (`src-tauri/src/types.rs`):

> **Design decision**: JS handles all pre-processing before invoking Rust:
> - `expandQueue()` — data source parameterization (clones scenarios per data row)
> - `prepareScenario()` — serializes body, resolves content type, builds headers, resolves URL
> - Auth resolution — `basic`/`bearer`/`apikey`/`digest` headers baked into `headers` array
>
> Rust receives **fully prepared** scenarios: resolved URL, final headers, serialized body.
> This keeps Rust focused on HTTP execution and avoids duplicating `buildHeaders`, `buildUrl`,
> `serializeWithContentType`, `resolveAuthHeaders`, and the entire auth config type system.

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A fully-prepared scenario ready for HTTP execution.
/// JS resolves all headers (including auth), URL (including API key query params),
/// and body (including form serialization) BEFORE sending to Rust.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RustScenario {
    pub id: String,
    pub name: String,
    pub url: String,                            // Already resolved via buildUrl() — includes API key query params
    pub method: String,                         // GET, POST, PUT, DELETE, PATCH, etc.
    pub headers: HashMap<String, String>,       // Already built via prepareScenario() — includes auth headers
    pub body: Option<String>,                   // Already serialized via serializeWithContentType()
    pub feature_group_name: Option<String>,
    pub group_name: Option<String>,
    pub weight: Option<f64>,                    // For weighted load profile selection
    pub data_row_id: Option<String>,            // From data source expansion
    pub data_row_label: Option<String>,         // Human-readable row label
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode")]
pub enum ExecutionPlan {
    #[serde(rename = "pool")]
    Pool {
        scenarios: Vec<RustScenario>,
        concurrency: u32,
        timeout_ms: u64,
        retry_count: u32,
        retry_delay_ms: u64,
        think_time: ThinkTimeConfig,
        circuit_breaker: CircuitBreakerConfig,
    },
    #[serde(rename = "sequential")]
    Sequential {
        scenarios: Vec<RustScenario>,
        timeout_ms: u64,
        retry_count: u32,
        retry_delay_ms: u64,
        think_time: ThinkTimeConfig,
        circuit_breaker: CircuitBreakerConfig,
    },
    #[serde(rename = "load-profile")]
    LoadProfile {
        scenarios: Vec<RustScenario>,
        concurrency: u32,
        duration_sec: u64,
        timeout_ms: u64,
        retry_count: u32,
        retry_delay_ms: u64,
        think_time: ThinkTimeConfig,
        circuit_breaker: CircuitBreakerConfig,
        profile_type: String,                   // "sustained" | "ramp-up" | "spike"
        ramp_up_sec: Option<u64>,
        spike_concurrency: Option<u32>,
        spike_start_sec: Option<u64>,
        spike_duration_sec: Option<u64>,
    },
}

/// Mirrors JS ThinkTimeConfig — delay between requests/iterations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ThinkTimeConfig {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "constant")]
    Constant { delay_ms: u64 },
    #[serde(rename = "uniform")]
    Uniform { min_ms: u64, max_ms: u64 },
    #[serde(rename = "gaussian")]
    Gaussian { mean_ms: u64, std_dev_ms: u64 },
}

/// Mirrors JS CircuitBreaker — when to stop the test on errors
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "policy")]
pub enum CircuitBreakerConfig {
    #[serde(rename = "continue")]
    Continue,
    #[serde(rename = "stop-first")]
    StopFirst,
    #[serde(rename = "stop-threshold")]
    StopThreshold {
        max_errors: u64,
        max_error_rate: f64,        // 0.0-1.0
        min_sample_size: u64,       // Default: 10
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub id: String,
    pub scenario_id: String,
    pub scenario_name: String,
    pub feature_group_name: Option<String>,
    pub group_name: Option<String>,
    pub url: String,
    pub method: String,
    pub http_status: u16,
    pub response_time_ms: f64,
    pub response_body: String,                  // Capped at 2000 chars (matches JS)
    pub response_headers: HashMap<String, String>,
    pub timestamp: u64,
    pub error_message: Option<String>,
    pub data_row_id: Option<String>,
    pub data_row_label: Option<String>,
    pub request_log: RequestLog,
    pub timing: Option<TimingBreakdown>,
    pub retry_count: u32,                       // How many retries were attempted
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestLog {
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

/// Timing breakdown — reqwest provides total; ttfb estimated from first chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingBreakdown {
    pub dns_lookup: f64,
    pub tcp_connect: f64,
    pub tls_handshake: f64,
    pub ttfb: f64,
    pub download: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressBatch {
    pub completed: u64,
    pub total: i64,                             // -1 for load-profile (duration-based)
    pub results: Vec<ExecutionResult>,
    pub elapsed_ms: f64,
    pub current_in_flight: u32,
    pub target_concurrency: u32,
    pub breaker_tripped: bool,                  // True if circuit breaker stopped the test
}
```

**Step 3 — Rust executor** (`src-tauri/src/executor.rs`):

```rust
use crate::types::*;
use reqwest::Client;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicU32, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;
use tauri::Emitter;

const MAX_BODY_LEN: usize = 2048;
const BATCH_INTERVAL_MS: u64 = 100;

pub async fn run_pool(
    app: tauri::AppHandle,
    client: Arc<Client>,
    scenarios: Vec<RustScenario>,
    concurrency: u32,
    timeout: Duration,
    cancel: CancellationToken,
) -> Vec<ExecutionResult> {
    let semaphore = Arc::new(Semaphore::new(concurrency as usize));
    let counter = Arc::new(AtomicU64::new(0));
    let in_flight = Arc::new(AtomicU32::new(0));
    let total = scenarios.len() as u64;
    let start = Instant::now();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<ExecutionResult>();

    // Spawn all requests with semaphore-controlled concurrency
    for scenario in scenarios {
        if cancel.is_cancelled() { break; }
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        let client = client.clone();
        let tx = tx.clone();
        let counter = counter.clone();
        let in_flight = in_flight.clone();
        let cancel = cancel.clone();
        let timeout = timeout;

        tokio::spawn(async move {
            in_flight.fetch_add(1, Ordering::Relaxed);
            let result = execute_one(&client, &scenario, timeout, &cancel).await;
            in_flight.fetch_sub(1, Ordering::Relaxed);
            counter.fetch_add(1, Ordering::Relaxed);
            let _ = tx.send(result);
            drop(permit);
        });
    }
    drop(tx); // Close sender so rx.recv() returns None when all done

    // Collect results and emit batched progress
    let mut all_results = Vec::new();
    let mut batch = Vec::new();
    let mut last_emit = Instant::now();

    while let Some(result) = rx.recv().await {
        batch.push(result);
        if last_emit.elapsed() >= Duration::from_millis(BATCH_INTERVAL_MS) || cancel.is_cancelled() {
            let progress = ProgressBatch {
                completed: counter.load(Ordering::Relaxed),
                total: total as i64,
                results: std::mem::take(&mut batch),
                elapsed_ms: start.elapsed().as_secs_f64() * 1000.0,
                current_in_flight: in_flight.load(Ordering::Relaxed),
            };
            let _ = app.emit("load-test-progress", &progress);
            last_emit = Instant::now();
        }
        all_results.push(batch.last().cloned().unwrap_or_else(|| {
            // Already moved to progress — re-fetch from all_results context
            // This arm shouldn't fire in practice due to mem::take ordering
            ExecutionResult { /* ... default ... */ }
        }));
    }

    // Final drain
    if !batch.is_empty() {
        let progress = ProgressBatch {
            completed: counter.load(Ordering::Relaxed),
            total: total as i64,
            results: std::mem::take(&mut batch),
            elapsed_ms: start.elapsed().as_secs_f64() * 1000.0,
            current_in_flight: 0,
        };
        let _ = app.emit("load-test-progress", &progress);
    }

    all_results
}

async fn execute_one(
    client: &Client,
    scenario: &RustScenario,
    timeout: Duration,
    cancel: &CancellationToken,
) -> ExecutionResult {
    let start = Instant::now();
    let mut builder = client.request(
        scenario.method.parse().unwrap_or(reqwest::Method::GET),
        &scenario.url,
    );
    for h in &scenario.headers {
        builder = builder.header(&h.key, &h.value);
    }
    if let Some(body) = &scenario.body {
        if scenario.method != "GET" {
            builder = builder.body(body.clone());
        }
    }
    builder = builder.timeout(timeout);

    let id = format!("r-{}", start.elapsed().as_nanos());

    tokio::select! {
        _ = cancel.cancelled() => {
            ExecutionResult {
                id, scenario_id: scenario.id.clone(), scenario_name: scenario.name.clone(),
                feature_group_name: scenario.feature_group_name.clone(),
                group_name: scenario.group_name.clone(),
                url: scenario.url.clone(), method: scenario.method.clone(),
                http_status: 0, response_time_ms: start.elapsed().as_secs_f64() * 1000.0,
                response_body: String::new(),
                response_headers: Default::default(),
                timestamp: timestamp_ms(),
                error_message: Some("Cancelled".into()),
            }
        }
        result = builder.send() => {
            match result {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    let headers = resp.headers().iter()
                        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                        .collect();
                    let body = resp.text().await.unwrap_or_default();
                    let capped = if body.len() > MAX_BODY_LEN {
                        body[..MAX_BODY_LEN].to_string()
                    } else { body };
                    ExecutionResult {
                        id, scenario_id: scenario.id.clone(), scenario_name: scenario.name.clone(),
                        feature_group_name: scenario.feature_group_name.clone(),
                        group_name: scenario.group_name.clone(),
                        url: scenario.url.clone(), method: scenario.method.clone(),
                        http_status: status, response_time_ms: start.elapsed().as_secs_f64() * 1000.0,
                        response_body: capped, response_headers: headers,
                        timestamp: timestamp_ms(), error_message: None,
                    }
                }
                Err(e) => {
                    ExecutionResult {
                        id, scenario_id: scenario.id.clone(), scenario_name: scenario.name.clone(),
                        feature_group_name: scenario.feature_group_name.clone(),
                        group_name: scenario.group_name.clone(),
                        url: scenario.url.clone(), method: scenario.method.clone(),
                        http_status: 0, response_time_ms: start.elapsed().as_secs_f64() * 1000.0,
                        response_body: String::new(), response_headers: Default::default(),
                        timestamp: timestamp_ms(),
                        error_message: Some(e.to_string()),
                    }
                }
            }
        }
    }
}

fn timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
```

**Why this works**: `reqwest::Client` internally uses `hyper` which manages its own connection pool.
A single `Client` instance with default settings already supports:
- Keep-alive connection reuse
- HTTP/2 multiplexing (auto-negotiated via ALPN)
- Configurable pool idle timeout and max connections per host
- TLS via `rustls` (no OpenSSL dependency)

The `tokio::spawn` per request + `Semaphore` pattern is the idiomatic Rust equivalent of our JS
`runPool` — but each "task" is a lightweight green thread (~2KB stack), not a JS Promise on a
single event loop. On an 8-core machine, tokio distributes tasks across 8 OS threads automatically.

**Features the Rust executor must implement** (found during codebase audit):

| Feature | JS Location | Rust Equivalent | Notes |
|---------|-------------|-----------------|-------|
| **Think time** | `thinkTime.ts` — none/constant/uniform/gaussian | `tokio::time::sleep` with `rand` crate | Applied between requests, same as JS |
| **Circuit breaker** | `circuitBreaker.ts` — continue/stop-first/stop-threshold | `AtomicU64` counters + check after each result | Breaker fires `cancel` token when tripped |
| **Retry with delay** | `requestExecution.ts` — `executeWithRetry` | Loop with `tokio::time::sleep` between attempts | Same retry_count + retry_delay_ms semantics |
| **Response body cap** | 2000 chars in `graphRunnerHelpers.ts` | `body[..2000]` on Rust String | Match JS cap exactly |
| **Request logging** | `requestLog: { headers, body }` on `RequestResult` | Clone headers/body before send | Needed for Results Explorer detail panel |
| **Weighted selection** | `loadProfileRunner.ts` — `buildWeightedIterator` | Multiply scenarios by integer weight, shuffle, round-robin | Same algorithm |
| **Load profile ramp** | `getTargetConcurrency(profile, elapsed)` | Match the 3 profile types: sustained (flat), ramp-up (linear), spike (step) | Controls semaphore permit count |
| **Abort signal** | `AbortController` → cooperative loop check | `CancellationToken` from `tokio-util` | `tokio::select!` on every request |

**Features that stay in JS** (NOT duplicated in Rust):

| Feature | Why JS-only |
|---------|-------------|
| Data source expansion (`expandQueue`) | Complex parameterization with data row cloning — runs before Rust is invoked |
| Scenario preparation (`prepareScenario`) | Header building, URL resolution, body serialization — runs before Rust is invoked |
| Auth resolution (basic/bearer/apikey/digest) | Baked into headers by `prepareScenario` — Rust sees final headers |
| OAuth2 token management | `tokenManager.ts` has refresh/cache logic — OAuth2 scenarios use JS executor |
| ~~Validation (`buildValidationResult`)~~ | ~~24-operator evaluator stays in JS~~ — **Moved to Rust in Phase 3A** (2,799 LOC, 542 tests). JS `mapRustResult` passes through Rust validation with custom assertion fallback. |
| Workflow graph execution | Graph topology requires JS variable context and edge traversal |

---

#### 2B. Tauri Commands + Event Streaming

**Effort**: 3-4 days
**Files**: `src-tauri/src/lib.rs`, `src-tauri/src/state.rs` (new), `src-tauri/capabilities/default.json`

**Step 1 — Shared state** (`src-tauri/src/state.rs`):

```rust
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;
use reqwest::Client;

pub struct TestState {
    pub cancel_token: Mutex<Option<CancellationToken>>,
    pub client: Client,
}

impl TestState {
    pub fn new() -> Self {
        let client = Client::builder()
            .pool_max_idle_per_host(512)
            .pool_idle_timeout(std::time::Duration::from_secs(30))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");
        Self {
            cancel_token: Mutex::new(None),
            client,
        }
    }
}
```

**Step 2 — Commands** (add to `src-tauri/src/lib.rs`):

```rust
mod executor;
mod types;
mod state;

use state::TestState;
use types::ExecutionPlan;

#[tauri::command]
async fn start_load_test(
    app: tauri::AppHandle,
    state: tauri::State<'_, TestState>,
    plan: ExecutionPlan,
) -> Result<String, String> {
    let cancel = tokio_util::sync::CancellationToken::new();
    *state.cancel_token.lock().unwrap() = Some(cancel.clone());
    let client = std::sync::Arc::new(state.client.clone());

    match plan {
        ExecutionPlan::Pool { scenarios, concurrency, timeout_ms } => {
            let timeout = std::time::Duration::from_millis(timeout_ms);
            let results = executor::run_pool(app, client, scenarios, concurrency, timeout, cancel).await;
            Ok(format!("Completed: {} results", results.len()))
        }
        ExecutionPlan::Sequential { scenarios, timeout_ms } => {
            let timeout = std::time::Duration::from_millis(timeout_ms);
            let results = executor::run_pool(app, client, scenarios, 1, timeout, cancel).await;
            Ok(format!("Completed: {} results", results.len()))
        }
        ExecutionPlan::LoadProfile { scenarios, concurrency, duration_sec, timeout_ms, .. } => {
            let timeout = std::time::Duration::from_millis(timeout_ms);
            // Load profile mode — run for duration with concurrency control
            let results = executor::run_load_profile(
                app, client, scenarios, concurrency, duration_sec, timeout, cancel,
            ).await;
            Ok(format!("Completed: {} results", results.len()))
        }
    }
}

#[tauri::command]
async fn abort_load_test(state: tauri::State<'_, TestState>) -> Result<(), String> {
    if let Some(token) = state.cancel_token.lock().unwrap().take() {
        token.cancel();
    }
    Ok(())
}

#[tauri::command]
fn is_rust_executor_available() -> bool {
    true  // Always available when running in Tauri
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(TestState::new())
        .invoke_handler(tauri::generate_handler![
            start_load_test,
            abort_load_test,
            is_rust_executor_available,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3 — Load profile executor** (add to `executor.rs`):

Implements duration-based execution with weighted scenario selection and ramp-up/spike support.
Uses `tokio::time::interval` for concurrency control instead of JS's `setInterval`.

**No capabilities changes needed** — `#[tauri::command]` functions are internal to the app and
don't require shell or external permissions.

---

#### 2C. JS Integration + Fallback

**Effort**: 3-4 days
**Files**: `src/engine/workerBridge.ts`, `src/engine/executor.ts`, `src/engine/rustBridge.ts` (new)

**Step 1 — Rust executor bridge** (`src/engine/rustBridge.ts`):

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from '../shared/utils/platform';
import type { RequestResult, Scenario, TestConfig, ProgressMeta } from '../shared/types';

let _rustAvailable: boolean | null = null;

export async function isRustExecutorAvailable(): Promise<boolean> {
  if (_rustAvailable !== null) return _rustAvailable;
  if (!isTauri()) { _rustAvailable = false; return false; }
  try {
    _rustAvailable = await invoke<boolean>('is_rust_executor_available');
  } catch {
    _rustAvailable = false;
  }
  return _rustAvailable;
}

export async function runTestViaRust(
  config: TestConfig,
  scenarios: Scenario[],
  onProgress: (completed: number, total: number, results: RequestResult[], meta: ProgressMeta) => void,
  abortSignal?: AbortSignal,
): Promise<RequestResult[]> {
  // Convert JS scenarios → Rust ExecutionPlan
  const plan = buildExecutionPlan(config, scenarios);

  // Listen for progress events
  const allResults: RequestResult[] = [];
  const unlisten: UnlistenFn = await listen('load-test-progress', (event) => {
    const batch = event.payload as RustProgressBatch;
    const mapped = batch.results.map(mapRustResult);
    for (const r of mapped) allResults.push(r);
    onProgress(batch.completed, batch.total, allResults, {
      elapsedMs: batch.elapsed_ms,
      targetConcurrency: config.concurrency ?? 1,
      currentInFlight: batch.current_in_flight,
      durationMs: config.loadProfile?.durationSec ? config.loadProfile.durationSec * 1000 : 0,
    });
  });

  // Wire abort signal
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      invoke('abort_load_test').catch(() => {});
    }, { once: true });
  }

  try {
    await invoke('start_load_test', { plan });
  } finally {
    unlisten();
  }

  return allResults;
}

function mapRustResult(r: RustExecutionResult): RequestResult { /* field mapping */ }
function buildExecutionPlan(config: TestConfig, scenarios: Scenario[]): RustExecutionPlan { /* ... */ }
```

**Step 2 — Integration in executor** (`src/engine/executor.ts` or `workerBridge.ts`):

```typescript
// In the execution entry point:
if (await isRustExecutorAvailable() && !workflow) {
  return runTestViaRust(config, expandedQueue, onProgress, abortSignal);
}
// Fallback to existing JS multi-worker path
return runTestMultiWorker(...);
```

**Fallback conditions** (use JS multi-worker executor instead of Rust):
1. Not running in Tauri (browser/web mode — no Rust available)
2. Workflow mode (`config.executionMode === 'workflow'` — graph topology needs JS variable context)
3. Any scenario with `auth.type === 'oauth2'` — token manager has refresh/cache logic in JS
4. `invoke('is_rust_executor_available')` returns false / throws
5. Sub-workflow resolver is present (`resolveSubWorkflow` callback — needs JS graph traversal)

**Step 3 — Post-result validation in JS** (streaming, not batch-at-end):

Rust returns raw `ExecutionResult` (status, headers, body, timing). **Validation happens per-batch
as `load-test-progress` events arrive**, not after the full test completes:

```typescript
// Inside the listen('load-test-progress') callback:
const batch = event.payload as RustProgressBatch;
for (const rustResult of batch.results) {
  const scenario = scenarioMap.get(rustResult.scenario_id);
  const mapped = mapRustResult(rustResult);    // → partial RequestResult (passed=false)
  if (scenario && scenario.validation.mode !== 'none') {
    const parsed = JSON.parse(mapped.responseBody);  // Only if validation needs it
    const validation = buildValidationResult(scenario, parsed, mapped);
    mapped.passed = validation.passed;
    mapped.failureDetails = validation.failureDetails;
    mapped.validationMode = scenario.validation.mode;
  } else {
    mapped.passed = mapped.httpStatus > 0 && mapped.httpStatus < 400;
  }
  allResults.push(mapped);
}
// Report to UI immediately — no waiting for test completion
onProgress(batch.completed, batch.total, allResults, { ... });
```

**Why streaming validation**: If we batch-validate only at the end, the UI shows no pass/fail
status during the test. By validating each progress batch as it arrives (~every 100ms), the
live results dashboard shows real-time pass/fail counts, matching current JS executor behavior.

**Performance note**: `buildValidationResult` is CPU-bound but fast (~0.1ms per result for
typical assertions). At 10K RPS with 100ms batches, each batch has ~1,000 results → ~100ms
of validation work. This could cause UI jank if done synchronously. Solution: use `requestIdleCallback`
or batch validation in a Web Worker if profiling shows it's needed.

**Step 4 — `@tauri-apps/api` imports**:

Neither `invoke` nor `listen` are currently used in `src/`. New imports needed:

```typescript
// rustBridge.ts
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
```

These are already installed as dependencies (`@tauri-apps/api: ^2.10.1` in `package.json`).
They will be tree-shaken in web builds since `isRustExecutorAvailable()` gates all Rust paths.

---

#### 2D. Protocol Types + Result Mapping

**Effort**: 2 days
**Files**: `src/engine/rustBridge.ts`, `src-tauri/src/types.rs`

Define matching TypeScript interfaces for all Rust structs. These live in `src/engine/rustBridge.ts`:

```typescript
// ── Execution Plan (JS → Rust) ──────────────────────────

interface RustExecutionPlan {
  mode: 'pool' | 'sequential' | 'load-profile';
  scenarios: RustScenario[];
  concurrency: number;
  timeout_ms: number;
  retry_count: number;
  retry_delay_ms: number;
  think_time: RustThinkTimeConfig;
  circuit_breaker: RustCircuitBreakerConfig;
  // Load profile fields (only for mode === 'load-profile')
  duration_sec?: number;
  profile_type?: string;
  ramp_up_sec?: number;
  spike_concurrency?: number;
  spike_start_sec?: number;
  spike_duration_sec?: number;
}

interface RustScenario {
  id: string;
  name: string;
  url: string;                               // Already resolved (includes API key query)
  method: string;
  headers: Record<string, string>;           // Already built (includes auth headers)
  body?: string;                             // Already serialized
  feature_group_name?: string;
  group_name?: string;
  weight?: number;
  data_row_id?: string;
  data_row_label?: string;
}

type RustThinkTimeConfig =
  | { type: 'none' }
  | { type: 'constant'; delay_ms: number }
  | { type: 'uniform'; min_ms: number; max_ms: number }
  | { type: 'gaussian'; mean_ms: number; std_dev_ms: number };

type RustCircuitBreakerConfig =
  | { policy: 'continue' }
  | { policy: 'stop-first' }
  | { policy: 'stop-threshold'; max_errors: number; max_error_rate: number; min_sample_size: number };

// ── Results (Rust → JS) ──────────────────────────────────

interface RustExecutionResult {
  id: string;
  scenario_id: string;
  scenario_name: string;
  feature_group_name?: string;
  group_name?: string;
  url: string;
  method: string;
  http_status: number;
  response_time_ms: number;
  response_body: string;                     // Capped at 2000 chars
  response_headers: Record<string, string>;
  timestamp: number;
  error_message?: string;
  data_row_id?: string;
  data_row_label?: string;
  request_log: { headers: Record<string, string>; body?: string };
  timing?: {
    dns_lookup: number;
    tcp_connect: number;
    tls_handshake: number;
    ttfb: number;
    download: number;
    total: number;
  };
  retry_count: number;
}

interface RustProgressBatch {
  completed: number;
  total: number;                             // -1 for load-profile
  results: RustExecutionResult[];
  elapsed_ms: number;
  current_in_flight: number;
  target_concurrency: number;
  breaker_tripped: boolean;
}
```

**`buildExecutionPlan()` — converts from existing JS types:**

```typescript
function buildExecutionPlan(
  config: TestConfig,
  scenarios: Scenario[],          // Already expanded via expandQueue()
): RustExecutionPlan {
  // Pre-resolve each scenario using existing JS preparation logic
  const rustScenarios: RustScenario[] = scenarios.map(s => {
    const prep = prepareScenario(s);    // Uses cached PreparedScenario
    return {
      id: s.id,
      name: s.name,
      url: prep.resolvedUrl,            // buildUrl() already applied
      method: s.method,
      headers: prep.baseHeaders,        // buildHeaders() already applied (incl. non-OAuth auth)
      body: prep.body,                  // serializeWithContentType() already applied
      feature_group_name: s.featureGroupName,
      group_name: s.groupName,
      weight: config.scenarioWeights.find(w => w.scenarioId === s.id)?.weight,
      data_row_id: s.dataRowId,
      data_row_label: s.dataRowLabel,
    };
  });

  const base = {
    scenarios: rustScenarios,
    concurrency: config.concurrency,
    timeout_ms: (config.timeoutSec ?? 30) * 1000,
    retry_count: config.retryCount ?? 0,
    retry_delay_ms: config.retryDelayMs ?? 1000,
    think_time: mapThinkTime(config.thinkTime),
    circuit_breaker: mapCircuitBreaker(config),
  };

  if (config.executionMode === 'load-profile' && config.loadProfile) {
    return { ...base, mode: 'load-profile',
      duration_sec: config.loadProfile.durationSec,
      profile_type: config.loadProfile.type,
      ramp_up_sec: config.loadProfile.rampUpSec,
      spike_concurrency: config.loadProfile.spikeConcurrency,
      spike_start_sec: config.loadProfile.spikeStartSec,
      spike_duration_sec: config.loadProfile.spikeDurationSec,
    };
  }
  if (config.executionMode === 'sequential') {
    return { ...base, mode: 'sequential' };
  }
  return { ...base, mode: 'pool' };
}
```

**`mapRustResult()` — converts Rust result back to JS `RequestResult`:**

```typescript
function mapRustResult(r: RustExecutionResult): RequestResult {
  return {
    id: r.id,
    scenarioId: r.scenario_id,
    scenarioName: r.scenario_name,
    featureGroupName: r.feature_group_name,
    groupName: r.group_name,
    url: r.url,
    method: r.method,
    httpStatus: r.http_status,
    responseTimeMs: r.response_time_ms,
    responseBody: r.response_body,
    responseHeaders: r.response_headers,
    timestamp: r.timestamp,
    passed: false,                           // Set by JS validation after mapping
    validationMode: 'none',                  // Set by JS validation after mapping
    failureDetails: [],                      // Set by JS validation after mapping
    errorMessage: r.error_message,
    dataRowId: r.data_row_id,
    dataRowLabel: r.data_row_label,
    requestLog: r.request_log,
    timing: r.timing ? {
      dnsLookup: r.timing.dns_lookup,
      tcpConnect: r.timing.tcp_connect,
      tlsHandshake: r.timing.tls_handshake,
      ttfb: r.timing.ttfb,
      download: r.timing.download,
      total: r.timing.total,
    } : undefined,
  };
}
```

---

#### ~~2E. Validation in Rust~~ — REMOVED (Tier 2) → **Implemented in Phase 3A**

Originally deferred from Tier 2 because HTTP I/O was the bottleneck, not validation.
Phase 3A subsequently implemented the full validation engine in Rust (2,799 LOC production,
5,277 LOC tests, 542 Rust tests passing). See "Phase 3A — Implementation Progress" for details.

---

#### Implementation Order

```
─── Phase 2A: Rust executor core ✅ COMPLETED ──────────────
  ✅ Add reqwest 0.13 + tokio + tokio-util + rand to Cargo.toml
  ✅ Create types.rs:
    - RustScenario (pre-resolved: url, headers as HashMap, body, data_row_id/label)
    - ExecutionPlan (Pool/Sequential/LoadProfile with think_time + circuit_breaker)
    - ThinkTimeConfig (none/constant/uniform/gaussian)
    - CircuitBreakerConfig (continue/stop-first/stop-threshold)
    - ExecutionResult (with request_log, timing, retry_count, data_row_id/label)
    - ProgressBatch (with target_concurrency, breaker_tripped)
    - CompletionSummary
  ✅ Create executor.rs:
    - execute_one() — single HTTP request with reqwest + timeout + cancellation
    - execute_with_retry() — retry loop matching JS retryCount + retryDelayMs
    - run_pool() — semaphore-based concurrency + think time + circuit breaker + batch emit
    - run_load_profile() — duration-based with weighted scenario iterator
    - apply_think_time() — tokio::time::sleep with rand for uniform/gaussian
    - build_weighted_pool() — multiply by weight, Fisher-Yates shuffle, round-robin (match JS)
    - get_target_concurrency() — sustained/ramp-up/spike profile logic (match JS)
    - CircuitBreakerState — atomic counters, check after each result
  ✅ Create commands.rs (merged from Phase 2B scope):
    - ExecutorState (reqwest::Client with 200 max idle per host + CancellationToken)
    - start_load_test(plan: ExecutionPlan) → dispatches to run_pool/run_load_profile
    - abort_load_test() → cancels CancellationToken
    - is_rust_executor_available() → true
  ✅ Update lib.rs: mod declarations + .manage(ExecutorState) + invoke_handler
  ✅ Create executor_test.rs: 27 unit tests covering:
    - Think time (none, constant, uniform range/edge, gaussian non-negative)
    - Circuit breaker (continue, stop-first, stop-threshold count/rate/min-sample)
    - Weighted pool (uniform, weighted, empty)
    - Target concurrency (sustained, ramp-up linear/zero, spike inside/outside/before)
    - Body capping (short, long)
    - Serde round-trip (ExecutionPlan pool/load-profile, ThinkTimeConfig, CircuitBreakerConfig)
  ✅ cargo check — 0 errors, 0 warnings
  ✅ cargo clippy — 0 warnings
  ✅ cargo test — 62 tests passed (27 → 48 → 52 → 55 → 62 across 4 re-evaluation rounds)
  ✅ Re-evaluation R1: 11 bugs/issues found and fixed (UTF-8 body cap, Box-Muller ln(0),
    breaker_tripped state, think time in permit scope, semaphore cancellation, response rounding,
    result builder dedup, sequential serde test, edge case coverage)
  ✅ Re-evaluation R2: 4 more issues found and fixed (think time after-not-before request,
    download timing negative clamp, RESULT_COUNTER race moved to commands, async think time tests)
  ✅ Re-evaluation R3: 6 more issues found and fixed (concurrency=0 deadlock guard,
    timeout=0 semantic mismatch with JS, load_profile concurrency guard, clippy warnings,
    serde missing-field test, 3-byte UTF-8 boundary test)
  ✅ Re-evaluation R4: CRITICAL serde camelCase fix — all types now use camelCase field names
    for Tauri JS interop (rename_all on structs, per-field rename on enum variant fields).
    Added 7 JS-interop deserialization/serialization tests.
  ✅ Re-evaluation R5: 1 inconsistency found — CompletionSummary.duration_ms not rounded
    via round_ms() unlike all other timing values. Fixed. Deep audit from 12 new angles
    (retry ID uniqueness, weighted pool OOM, Fisher-Yates correctness, cancellation race
    semantics, concurrent test run safety, panic surface review, usize overflow, Mutex
    blocking, channel lifetime, Emitter import, total i64 overflow, etc.) found no bugs.
    All 62 tests pass, cargo clippy 0 warnings, tsc 0 errors.

─── Phase 2B: Integration test via Tauri dev (1-2 days) ────
  ✅ Created rustBridge.ts — typed TypeScript wrappers for invoke/listen:
    - isRustExecutorAvailable() with caching
    - startRustLoadTest() with onProgress/onComplete callbacks
    - abortRustLoadTest()
    - Full type definitions matching Rust types.rs
  ✅ Created RustExecutorTestPanel.tsx — dev-only UI with 6 integration tests:
    - Availability check, Pool execution, Sequential, Load Profile, Abort, Circuit Breaker
  ✅ Wired into App.tsx — accessible via Cmd+Shift+T or ?rust-test URL param (dev mode only)
  ✅ Unit tests for rustBridge.ts — 8 tests (availability caching, reset, non-Tauri fallback,
    abort no-op, startRustLoadTest guard with throw and onError)
  ✅ Tauri dev compiles and launches: npx tauri dev -c '{"build":{"beforeDevCommand":""}}'
  ✅ cargo check, cargo clippy, tsc — all pass with 0 errors
  ✅ Re-evaluation R1: 4 issues found and fixed:
    - CRITICAL: Event listener leak — listeners not cleaned up after test completion
      Fix: Auto-cleanup in unlistenComplete handler + idempotent cleanup flag
    - CRITICAL: invoke error → Promise hangs forever (onComplete never called)
      Fix: Added onError callback + fallback to synthetic onComplete on invoke failure
    - BUG: abortRustLoadTest/startRustLoadTest not guarded with isTauri() check
      Fix: Added isTauri() guard to both functions
    - MISSING: No tests for abort/start when not in Tauri
      Fix: Added 3 new tests (abort no-op, start throws, start calls onError)
  ✅ Re-evaluation R2-R3: Clean — no further issues found.
    Audited: race conditions, unhandled rejections, keyboard shortcut conflicts,
    concurrent test isolation, component type safety, Promise lifecycle.

─── Phase 2C: JS integration + fallback (3-4 days) ─────────  ✅ COMPLETE

  **Pre-evaluation (2026-05-18): 10 gaps identified vs original plan — corrected.**
  **Implementation (2026-05-18): All functions implemented, 67 unit tests pass, tsc + lint clean.**
  **Re-evaluation R1-R4 (2026-05-18): 4 bugs found and fixed across 2A/2B/2C, 68 unit tests pass.**
    - BUG-1: `mapCircuitBreaker()` sent `maxErrorRate` as 0-100 percent; Rust expects 0.0-1.0 fraction → fixed: divide by 100
    - BUG-2: `runTestViaRust()` race condition — `onComplete` could fire before `.then()` set `unlistenFn` → fixed: added `settled` guard
    - BUG-3: `mapRustResultWithoutValidation()` showed "HTTP 0" for network errors → fixed: show "network error" for status 0
    - BUG-4: Load-profile mode didn't propagate `scenarioWeights` to `RustScenario.weight` → fixed: map weights from config
  **Re-evaluation R5-R19 (2026-05-18): 0 bugs found across 15 rounds of deep auditing.**
    - R5-7: Deep re-audit + adversarial edge cases + final verification
    - R8-10: Memory safety, concurrency hazards, mutation testing (12 mutations all caught)
    - R11-13: 11 fresh analytical perspectives + cross-boundary contract verification
    - R14-16: Full JS↔Rust type contract audit + 5 end-to-end runtime path traces
    - R17-19: RustExecutorTestPanel audit + cargo check + ESLint + Vite production build
    **Final status: 68 JS tests, 62 Rust tests, tsc + cargo check + ESLint + Vite build all clean.**

  Step 1: Add to existing rustBridge.ts (Phase 2B created the file):
    - buildExecutionPlan(config, scenarios, weights) → RustExecutionPlan
      * Filter active scenarios by scenarioWeights (weight > 0)
      * computeAllocation() → shuffle → expandQueue() (data source expansion) — REUSE existing JS logic
      * For each expanded scenario: prepareScenario() → serialize body, merge headers, resolve auth, build URL
      * OAuth2 detection: if ANY scenario has auth.type === 'oauth2', FALL BACK to JS executor
      * Map executionMode: 'pool'→pool, 'sequential'→sequential, 'batch'→pool (same behavior),
        'load-profile'→load-profile, 'workflow'→FALLBACK to JS
      * Map thinkTime config: none/constant/uniform/gaussian
      * Map circuitBreaker: continue/stop-first/stop-threshold from errorPolicy+maxErrors+maxErrorRate
      * Return RustExecutionPlan with all fields populated
    - mapRustResult(rustResult, scenario) → RequestResult
      * Copy id, scenarioId, scenarioName, url, method, httpStatus, responseTimeMs, etc.
      * Run buildValidationResult() from engine/validationResult.ts for passed/failureDetails
      * Set validationMode from scenario.validation.mode
      * Set timing, requestLog, dataRowId, dataRowLabel, retryCount
      * Note: Rust retries on network error only (http_status==0); JS retries on !passed — documented diff
    - runTestViaRust(config, scenarios, onProgress, abortSignal) → TestResult
      * Call buildExecutionPlan() — returns null if fallback needed (OAuth2/workflow/batch)
      * Register listeners via startRustLoadTest()
      * Accumulate results across batches (Rust sends incremental; JS onProgress expects cumulative)
      * For each batch result: mapRustResult() + buildValidationResult()
      * On abort: abortSignal listener → abortRustLoadTest()
      * On complete: return { results: allResults }

  Step 2: Wire into useTestExecution.ts:
    - Before worker path: if (await isRustExecutorAvailable() && canUseRustExecutor(config, scenarios))
      → const testResult = await runTestViaRust(config, scenarios, onProgress, abortSignal)
    - canUseRustExecutor(): false when executionMode==='workflow', any scenario has OAuth2,
      resolveSubWorkflow provided, or scenarios have complex features Rust can't handle
    - Fallback: existing runTestMultiWorker() / runTest() (unchanged)

  Step 3: Abort wiring:
    - In useTestExecution, when Rust path is active, abort handler calls abortRustLoadTest()
    - abortRef.current.abort() still fires for AbortSignal propagation to runTestViaRust

  Step 4: Unit tests for buildExecutionPlan, mapRustResult, canUseRustExecutor

─── Phase 2D: Integration tests + edge cases (2-3 days) ────  ✅ COMPLETE

  **Implementation (2026-05-18): 48 integration tests in rustBridgeIntegration.test.ts**
  **Re-evaluation: Thorough pre-evaluation of each Phase 2D step before implementation.**
    - Confirmed breakerTripped NOT needed in ProgressMeta (consistent with JS executor behavior)
    - Validated all 10 planned items and identified additional edge cases
    - 0 bugs found during implementation

  Test categories implemented:
  1. runTestViaRust end-to-end (4 tests) — batch accumulation, 0 iterations, workflow rejection, pre-aborted signal
  2. ProgressMeta forwarding (3 tests) — elapsedMs/targetConcurrency/currentInFlight, load-profile durationMs, total=-1
  3. Abort signal propagation (2 tests) — abort during execution calls abort_load_test, listener cleanup after completion
  4. Circuit breaker integration (4 tests) — maxErrorRate percent→fraction mapping (0/75/100%), breaker-tripped batch handling
  5. Fallback correctness (7 tests) — digest/inherit/none/mixed-auth, batch→pool mapping, workflow rejection, invoke error
  6. Retry behavior edge cases (5 tests) — retry succeeded, retry exhausted, retryCount=0, config mapping, defaults
  7. Scenario lookup (3 tests) — composite key matching, scenarioId fallback, unknown ID → mapWithoutValidation
  8. Load profile plan (4 tests) — ramp-up, spike, sustained, missing loadProfile config falls back to pool
  9. Think time mapping (3 tests) — negative values clamped, unknown mode defaults to none
  10. Preparation parity (3 tests) — header/auth/body consistency, API key query param, allocation queue sizes
  11. Validation with Rust results (4 tests) — expectedFields pass/fail (selective mode), HTTP status validation
  12. Error message extraction (4 tests) — detail/errorMessage/non-string/empty body edge cases
  13. Settled guard (1 test) — no double resolution when complete fires before .then()
  
  Compare JS vs Rust results for same scenarios (deterministic seed)
  Test circuit breaker tripping across JS progress listener
  Test abort signal propagation (JS abort → Rust CancellationToken)
  Test load profile concurrency ramp (sustained, ramp-up, spike)
  Test think time distribution (constant, uniform, gaussian)
  Test retry behavior (retry_count > 0, verify retry_count in result)
  Test OAuth2 scenarios correctly fall back to JS executor
  Test workflow mode correctly fall back to JS executor
  Test web mode (non-Tauri) correctly uses JS executor
  Verify ProgressBatch.breaker_tripped stops JS from sending more requests
```

#### Expected Improvement

| Metric | Tier 1 (JS) | Tier 2 (Rust executor) | Why |
|--------|-------------|----------------------|-----|
| **RPS (pool mode)** | ~6,000-8,000 | ~10,000-15,000 | Native HTTP, no JS event loop bottleneck |
| **Connection model** | HTTP/1.1 (undici) | HTTP/1.1 + HTTP/2 (hyper) | Auto ALPN negotiation |
| **Concurrency model** | JS Promises on 1 event loop per worker | tokio tasks on N OS threads | True parallelism |
| **Memory per request** | ~1-2 KB (JS object + GC pressure) | ~200 bytes (Rust stack) | No garbage collector |
| **Startup overhead** | ~50ms per Web Worker | ~0ms (tokio already running) | Shared process |
| **Body handling** | Full string in JS heap | Streamed, capped at 2KB in Rust | Avoid large allocations |
| **Browser/web mode** | Same as Tier 1 | Same as Tier 1 (fallback) | Rust only in Tauri desktop |
| **Workflow mode** | Same as Tier 1 | Same as Tier 1 (fallback) | Graph needs JS context |

---

### Tier 3 — Full Rust Executor (Endgame)

**Target**: ~50,000+ RPS
**Effort**: 2-3 months
**Risk**: High — major engine rewrite
**Prerequisite**: Tier 2 proves the Rust-in-Tauri architecture

---

#### 3A. Full Validation in Rust

**Goal**: Eliminate JS post-processing overhead by running all validation inside the Rust
executor hot loop, returning fully-validated results (with `passed`, `failureDetails`) directly
in `ProgressBatch`.

**Effort**: 2-3 weeks
**Target**: ~20,000 RPS (removes JS mapRustResult + buildValidationResult bottleneck)

**Crate dependencies** (add to `src-tauri/Cargo.toml`):
```toml
regex = "1"                 # Regex operator + header regex + body regex
jsonschema = "0.27"         # JSON Schema Draft-07 validation (replaces ajv)
chrono = "0.4"              # Date/timezone handling (date, datePrecise assertions)
```

**Note**: `serde_json_path` was considered but rejected — its RFC 9535 semantics differ
from the custom `getByPath()` in JS. A direct port of the 122-line JS tokenizer/walker
ensures exact behavioral parity.

**Current state (what changes)**:
- Tier 2: Rust sends raw `ExecutionResult` (no validation) → JS `mapRustResult()` parses JSON,
  runs `buildValidationResult()` (evaluateAssertions + validate), then emits to UI.
- Tier 3A: Rust runs validation inside `execute_with_retry()` → `ProgressBatch.results` already
  contain `passed`, `failureDetails`, `validationMode`.
- JS `mapRustResult()` becomes a thin passthrough (no re-parsing, no re-validation).

##### Step 1 — Rust validation types (`src-tauri/src/validation_types.rs`) — NEW

Define Rust-side validation config types matching JS `shared/types/index.ts` **exactly**:

```rust
// ── Validation Config ────────────────────────────
// NOTE: Only fields ACTUALLY USED by validate() + buildValidationResult() are included.
// JS ValidationConfig has additional UI-only fields (selectiveMode, excludedPaths,
// sampleJson, responseVersions, rulesVersions) that are NOT used in the validation
// engine and SHOULD NOT be serialized across the Rust IPC bridge.
pub enum ValidationMode { None, Full, Selective }

pub struct ValidationConfig {
    pub mode: ValidationMode,
    pub expected_json: Option<String>,
    pub expected_fields: Option<Vec<ExpectedField>>,
    pub unordered_arrays: Option<bool>,
}
// Assertions are passed SEPARATELY (not inside ValidationConfig) to match JS
// architecture where buildValidationResult() takes (validation, assertions) as
// two distinct parameters.

pub struct ExpectedField {
    pub json_path: String,
    pub expected_value: String,
    pub operator: Option<FieldOperator>,
    pub operator_value: Option<String>,
    pub negate: Option<bool>,
    pub expression: Option<String>,
}

// ── FailureDetail ────────────────────────────────
pub struct FailureDetail {
    pub path: String,
    pub expected: String,
    pub actual: String,
}

// ── Assertion (tagged union — 16 variants) ───────
// CRITICAL: Use exact `type` discriminator names from JS:
pub enum Assertion {
    Status       { negate: bool, expected: String },
    ResponseTime { negate: bool, max_ms: f64 },
    Header       { negate: bool, name: String, operator: AssertionOperator, value: Option<String> },
    Regex        { negate: bool, json_path: String, pattern: String },
    ArrayLength  { negate: bool, json_path: String, operator: ComparisonOperator, value: f64 },
    Numeric      { negate: bool, json_path: String, operator: ComparisonOperator, value: f64 },
    Date         { negate: bool, json_path: String, operator: ComparisonOperator, reference: DateReference },
    TypeCheck    { negate: bool, json_path: String, expected_type: JsonTypeName },
    Existence    { negate: bool, json_path: String, expect_exists: bool },
    ArrayContains{ negate: bool, json_path: String, value: String, mode: ArrayContainsMode },
    Each         { negate: bool, json_path: String, field_path: String, operator: FieldOperator, value: Option<String> },
    ContainsSubset { negate: bool, json_path: String, expected: String },
    JsonSchema   { negate: bool, schema: String },
    BodySize     { negate: bool, operator: ComparisonOperator, value: f64, unit: SizeUnit },
    DatePrecise  { negate: bool, json_path: String, operator: ComparisonOperator, reference: String, precision: DatePrecision },
    Custom       { negate: bool, expression: String, description: Option<String> },
}

// Supporting enums (match JS exactly):
pub enum AssertionOperator { Equals, Contains, Regex, Exists }
pub enum ComparisonOperator { Eq, Ne, Gt, Gte, Lt, Lte }  // "=","!=",">",">=","<","<="
pub enum DateReference { Today { timezone: Timezone }, Fixed { iso: String } }
pub enum Timezone { Utc, Local }
pub enum JsonTypeName { String, Number, Boolean, Array, Object, Null }
pub enum ArrayContainsMode { Any, All, Only, None }
pub enum SizeUnit { Bytes, Kb, Mb }
pub enum DatePrecision { Day, Hour, Minute, Second, Millisecond }

// FieldOperator — all 24 operators:
pub enum FieldOperator {
    Equals, NotEquals, GreaterThan, GreaterThanOrEqual, LessThan, LessThanOrEqual,
    Contains, NotContains, StartsWith, EndsWith, Regex,
    IsTrue, IsFalse, IsNull, IsNotNull, IsEmpty, IsNotEmpty,
    Exists, NotExists, IsType, In, NotIn, Between, CloseTo,
}
```

**IMPORTANT**: The JS `Assertion` union uses these **exact** `type` discriminator strings:
`status`, `responseTime`, `header`, `regex`, `arrayLength`, `numeric`, `date`, `typeCheck`,
`existence`, `arrayContains`, `each`, `containsSubset`, `jsonSchema`, `bodySize`,
`datePrecise`, `custom`. The plan originally listed incorrect names (`jsonPath`, `bodyContains`,
`bodyRegex`, `jsonSubset`). These do NOT exist in the codebase.

Add validation fields to `RustScenario`:
```rust
pub validation: ValidationConfig,
pub assertions: Vec<Assertion>,
```

Add validation fields to `ExecutionResult`:
```rust
pub passed: bool,
pub failure_details: Vec<FailureDetail>,
pub validation_mode: String,
```

##### Step 2 — JSONPath engine (`src-tauri/src/json_path.rs`) — NEW

**Note**: `serde_json_path` implements RFC 9535 JSONPath, which has different semantics from
the custom `getByPath()` in JS. **Do NOT use `serde_json_path` for this**. Instead, port
the exact JS tokenizer/walker logic (122 lines) to Rust for perfect parity.

```rust
pub fn get_by_path(value: &serde_json::Value, path: &str) -> Option<serde_json::Value>
pub fn get_by_path_as_string(value: &serde_json::Value, path: &str) -> String
```

**Tokenization** (from `tokenizeJsonPath`):
- Strip `$.` or `$` prefix, trim
- Scan left-to-right: `.` = separator (skip), `[...]` = bracket token, else dot-segment
- `[*]` → STAR sentinel, `[0]` → "0" string token
- Unclosed `[` → tokenization stops (rest of path ignored, no error)

**Walk rules** (from `walkPath`):
| Token | Behavior |
|-------|----------|
| `STAR` on non-array | → `None` |
| `STAR` as last token | → return array value as-is |
| `STAR` not last | → `array.iter().map(\|el\| walk(el, remaining))` → Vec of results |
| `"length"` on array | → `Value::Number(array.len())`, then continue walk |
| `"length"` on non-array | → normal key lookup (not special) |
| Numeric string token | → `key = number` for array index, `String(key)` for object lookup |
| Non-numeric token | → object key lookup |
| `null`/primitive mid-path | → `None` |

**Critical parity edge cases**:
- Empty/whitespace path → return root value
- `$` only → return root value
- `[*]` mid-path returns array of sub-results (possibly nested arrays)
- Numeric tokens access both array indices AND object string keys (`"0"` key)
- No prototype pollution protection needed (Rust doesn't have `__proto__`)

**Parity tests**: Port all tests from `src/shared/utils/jsonPath.test.ts` to Rust.

**Decision change**: Remove `serde_json_path` from Cargo.toml dependencies. The custom
JSONPath engine is simpler and guarantees exact behavioral parity.

##### Step 3 — Field operator evaluator (`src-tauri/src/field_operator.rs`) — NEW

Port all 24 operators from `fieldOperatorEvaluation.ts` (236 lines).

**Key helper functions to port**:
- `toNumber(val)` → `to_number(val: &Value) -> Option<f64>`: number passthrough; string → trim, empty → None, parse as f64, NaN → None; else → None
- `stringify(val)` → `stringify(val: &Value) -> String`: None/Null → `"null"`, String → raw string (no quotes), else → `serde_json::to_string()`. **CRITICAL**: JS returns `"undefined"` for `undefined` — Rust has no undefined, use `"null"` for `Value::Null`
- `stripQuotes(s)` → `strip_quotes(s: &str) -> &str`: remove leading/trailing `"` or `'` if matching pair
- `parseListItems(raw)` → `parse_list_items(raw: &str) -> Vec<Value>`: try `serde_json::from_str` → if array, return elements; else split by `,`, trim, strip quotes, return as `Value::String`

**Function signature**:
```rust
pub struct FieldEvalResult {
    pub pass: bool,
    pub expected: String,
    pub actual: String,
}

pub fn evaluate_field_operator(
    actual_value: &Value,    // serde_json::Value (Null for "not found")
    operator: &FieldOperator,
    operator_value: Option<&str>,
    expected_value: &str,
) -> FieldEvalResult
```

**IMPORTANT — `exists`/`not_exists` convention**: The field operator evaluator does NOT call `getByPath` itself — it receives the already-resolved value. `undefined` in JS is represented by a sentinel (e.g., a special `Option<&Value>` wrapper or a convention that `Value::Null` from a missing path is distinct from explicit `null`). **Design decision needed**: Use `Option<&Value>` as the `actual_value` parameter where `None` = path not found (JS `undefined`) and `Some(Value::Null)` = explicit null. This changes the function signature. The `exists` operator checks `actual_value.is_some()` and `not_exists` checks `actual_value.is_none()`. Update the `is_null` operator to check `actual_value == Some(Value::Null)`, `is_not_null` to check `actual_value.is_some() && actual_value != Some(Value::Null)`, `is_empty` to treat `None` as empty.

| # | Operator | Rust implementation notes |
|---|----------|--------------------------|
| 1 | `equals` | **JSON stringify normalization**: `serde_json::to_string(actual_value)` vs try `serde_json::from_str(raw_expected)` then `serde_json::to_string()`, fall back to `serde_json::to_string(raw_expected_as_string)`. The `raw_expected` is `operator_value.unwrap_or(expected_value)`. The result message format is `"equals {raw}"` |
| 2 | `not_equals` | Same normalization as `equals`, inverted pass, message `"not equals {raw}"` |
| 3 | `greater_than` | `to_number` both sides; if either None → `pass: false` with raw fallback in expected; message `"> {b}"` |
| 4 | `greater_than_or_equal` | Same pattern, `>=`, message `">= {b}"` |
| 5 | `less_than` | Same pattern, `<`, message `"< {b}"` |
| 6 | `less_than_or_equal` | Same pattern, `<=`, message `"<= {b}"` |
| 7 | `contains` | **Stringification**: if actual is string → use raw string; else → `serde_json::to_string()`. Then `str.contains(target)`. Message `"contains \"{target}\""`. The `actual` field in result always uses `stringify(actual_value)` |
| 8 | `not_contains` | Same, inverted, message `"not contains \"{target}\""` |
| 9 | `starts_with` | Same stringification, `str.starts_with(target)`, message `"starts with \"{target}\""` |
| 10 | `ends_with` | Same stringification, `str.ends_with(target)`, message `"ends with \"{target}\""` |
| 11 | `regex` | Empty pattern → `pass: false, expected: "non-empty regex pattern", actual: "empty pattern"`. Same stringification. `Regex::new(pattern)` → `is_match(str)`. Invalid regex → `pass: false, expected: "valid regex /{pattern}/", actual: "invalid regex pattern"`. Message `"matches /{pattern}/"` |
| 12 | `is_true` | `actual_value == Value::Bool(true)` OR `actual_value == Value::String("true")`. **NOT** `"True"` — case-sensitive. Message `"is true"` |
| 13 | `is_false` | `actual_value == Value::Bool(false)` OR `actual_value == Value::String("false")`. **JS also checks `=== 0`** — WAIT, re-reading JS line 153: `actualValue === false \|\| actualValue === 'false'` — NO `0` check. The plan was wrong. Just bool false or string "false". Message `"is false"` |
| 14 | `is_null` | `actual_value == Value::Null` (or `None` if using Option). Message `"is null"` |
| 15 | `is_not_null` | JS: `actualValue !== null && actualValue !== undefined`. In Rust: `actual_value.is_some() && actual_value != Some(Value::Null)`. Message `"is not null"` |
| 16 | `is_empty` | `""`, null, undefined(None), empty array `[]`, empty object `{}`. **NOT** `0` or `false`. Message `"is empty"` |
| 17 | `is_not_empty` | Inverse of all is_empty conditions. Message `"is not empty"` |
| 18 | `exists` | JS: `actualValue !== undefined`. Rust: `actual_value.is_some()` (null counts as exists). Message `"exists"` |
| 19 | `not_exists` | JS: `actualValue === undefined`. Rust: `actual_value.is_none()`. Message `"not exists"` |
| 20 | `is_type` | Expected type → `.to_lowercase()`. Actual type: null → `"null"`, array → `"array"`, else `typeof` equivalent. **Key parity**: JS `typeof []` is `"object"` but JS code uses `Array.isArray(actualValue)` to detect `"array"` FIRST (line 191), so `"array"` is the correct label for arrays. Message `"is type {expectedType}"`, actual `"type: {actualType}"` |
| 21 | `in` | `parse_list_items(raw)` → build `Vec<String>` of JSON-stringified items; JSON-stringify actual; check membership. Message `"in [{items}]"` |
| 22 | `not_in` | Same as `in`, inverted. Message `"not in [{items}]"` |
| 23 | `between` | Parse `"lo,hi"` (comma split first, else whitespace split). Both sides `Number()`. **Inclusive**: `a >= lo && a <= hi`. NaN on either side → fail. Message `"between {lo} and {hi}"` |
| 24 | `close_to` | Parse `"target[,tolerance]"` (comma first, else whitespace). Default tolerance **0.01** if only one part. `(a - target).abs() <= tolerance`. NaN → fail. Message `"close to {target} ±{tolerance}"` |

**Parity tests**: Port key tests from `fieldOperatorEvaluation.test.ts` (273 lines) and
`fieldOperatorEvaluation.comprehensive.test.ts` (658 lines). Target: ~60-70 Rust tests covering
all 24 operators with edge cases.

**CORRECTION from re-evaluation**:
1. ~~`is_false` checks `0`~~ → **NO** — JS line 153 only checks `false` and `"false"`, NOT `0`
2. `stringify()` for strings: JS returns the raw string (line 21: `if typeof val === 'string' return val`), NOT JSON-quoted. Rust must match: `Value::String(s) => s.clone()`, not `serde_json::to_string()`
3. `exists`/`not_exists`: These operators check `undefined` (not found) vs any value (including null). The function needs `Option<&Value>` to distinguish null-at-path from path-not-found

##### Step 4 — Assertion evaluator (`src-tauri/src/assertion_evaluator.rs`) — NEW

Port `evaluateAssertions()` from `validator.ts` — all **16 assertion types** in the switch.

**Additional helper functions needed** (local to this module):
- `compare(a: f64, op: &ComparisonOperator, b: f64) -> bool`: simple match on 6 operators (=, !=, >, >=, <, <=). Port from `validator.ts` line 284-293.
- `format_op(op: &ComparisonOperator) -> &str`: `=` → `"="`, `!=` → `"≠"`, `>` → `">"`, `>=` → `"≥"`, `<` → `"<"`, `<=` → `"≤"`. Port from `validator.ts` line 295-300.
- `stringify_for_regex(val: &Value) -> String`: for the `regex` assertion — if None → `"undefined"`, if string → raw string, else → `serde_json::to_string()`. **Truncate to 200 chars** with `"…"` suffix for failure messages (JS line 365).

```rust
pub fn evaluate_assertions(
    assertions: &[Assertion],
    ctx: &AssertionContext,  // { http_status, response_time_ms, response_headers, response_body: Value, raw_body }
) -> AssertionEvalResult {   // { failures: Vec<FailureDetail>, status_asserted: bool }
```

| # | Assertion type | Helpers needed | Notes |
|---|----------------|----------------|-------|
| 1 | `status` | `matches_status_pattern()` | Sets `status_asserted = true` **unconditionally** (even when assertion passes or fails). Pattern: exact digit, `lo-hi` range, `Nxx` class, comma-separated. Path: `"(status)"`. Expected: `a.expected`. Actual: `String(ctx.http_status)` |
| 2 | `responseTime` | numeric compare | `ctx.response_time_ms > a.max_ms` → fail. Path: `"(responseTime)"`. Expected: `"≤ {maxMs}ms"`. Actual: `"{responseTimeMs}ms"` |
| 3 | `header` | `find_header()` (case-insensitive), `evaluate_header_op()` | Path: `"(header:{name})"`. Pass through `HeaderOpResult.expected`/`.actual` from `evaluate_header_op`. **Note**: `a.value` is `Option<String>` (may be None for `exists` operator) |
| 4 | `regex` | `get_by_path()`, `Regex::new()` | **Resolve path first** → stringify value (None→`"undefined"`, string→raw, else→JSON). Test regex. Invalid pattern → config error (actual: `"invalid regex pattern"`). **Truncate actual to 200 chars** in failure message (JS line 365). Path: `"(regex:{jsonPath})"` |
| 5 | `arrayLength` | `get_by_path()`, `compare()` | Not an array → fail with `"not an array ({typeof})"` or `"undefined"`. Is array → compare `.len() as f64` against `a.value` using `a.operator`. Path: `"(arrayLength:{jsonPath})"`. Expected: `"array with length {formatOp} {value}"` or `"length {formatOp} {value}"` |
| 6 | `numeric` | `get_by_path()`, `to_number()`, `compare()` | **3 failure cases** (order matters): (1) value not found → `"undefined"`; (2) not a number / NaN → `"not a number: {JSON}"` ; (3) comparison fails → `"{num}"`. Path: `"(numeric:{jsonPath})"`. **IMPORTANT**: JS line 396 does `typeof raw === 'number' ? raw : Number(raw)` — for Rust, extract f64 from Value::Number, or try parsing Value::String as f64 |
| 7 | `date` | `get_by_path()`, `to_day_string()`, `resolve_date()` | **3 failure cases**: (1) not found → `"undefined"`; (2) `to_day_string` returns None → `"not a date: {JSON}"`; (3) day string `localeCompare` comparison fails. **CRITICAL**: JS uses `dayStr.localeCompare(refStr)` which returns -1/0/1, then `compare(cmp, a.operator, 0)`. Rust: use `str::cmp()` → `Ordering` → map to -1/0/1 as f64 → `compare(cmp, op, 0.0)`. Path: `"(date:{jsonPath})"` |
| 8 | `typeCheck` | `get_by_path()`, `get_json_type_name()` | **2 failure cases**: (1) path not found → `"path not found"`; (2) type mismatch → `"type {actual}"`. Uses `get_json_type_name()` from `http_helpers.rs`. Expected: `"type {expectedType}"`. Path: `"(typeCheck:{jsonPath})"` |
| 9 | `existence` | `get_by_path()` | `found = val != None` (null IS found). `found != a.expect_exists` → fail. Expected: `"field exists"` or `"field does not exist"`. Actual: `"field exists"` or `"field not found"`. Path: `"(existence:{jsonPath})"` |
| 10 | `arrayContains` | `get_by_path()`, `deep_subset_match()` | Not array → fail. Parse `a.value` as JSON (fall back to raw string). **4 sub-modes**: `any` — `acArr.iter().any(item_matches)` → fail if none match; `all` — count non-matches; `only` — parse expected as array (or wrap in array), check bidirectional unmatched/extras with `deep_subset_match`; `none` — fail if any match (report index). **Item matching**: if parsed is object → `deep_subset_match(item, parsed).match`; else → `item == parsed \|\| JSON.stringify equality`. Path: `"(arrayContains:{jsonPath})"` |
| 11 | `each` | `get_by_path()`, `evaluate_field_operator()` | Not array → fail. For each element: if `field_path` set → `get_by_path(elem, field_path)` else use element directly. Run `evaluate_field_operator`. Collect failures as `"[{idx}]{.fieldPath}: expected {result.expected}, got {result.actual}"`. **Cap at 3** in message: `"[0]...; [1]...; [2]... … and N more"`. Path: `"(each:{jsonPath})"`. Expected: `"all {len} items: {fieldPath }{operator}{value }"`. Actual: `"{failCount} of {len} failed — {summary}"` |
| 12 | `containsSubset` | `get_by_path()`, `deep_subset_match()` | Path not found → fail (`"undefined"`). Parse `a.expected` as JSON → invalid → config error (`actual: "invalid JSON in expected"`, `expected: "valid JSON subset"`). Then `deep_subset_match(val, parsed)` → fail with subset path appended. Path: `"(containsSubset:{jsonPath}{.subsetPath})"` |
| 13 | `jsonSchema` | `jsonschema` crate | **JS uses Ajv** with `allErrors: true, strict: false` + `ajv-formats`. Rust uses `jsonschema` crate. Parse schema string → compile → validate `ctx.response_body`. Cap at **10 errors**. Path: `"(jsonSchema#{assertion_index}:{instancePath})"`. **CRITICAL**: JS uses `_ai` (assertion loop index) in the path — Rust must pass the assertion index into each case. Schema parse failure → `expected: "valid JSON Schema"`, `actual: error message` |
| 14 | `bodySize` | raw body byte length, `compare()` | **JS uses `TextEncoder().encode(raw).length`** — this is UTF-8 byte length, same as Rust `raw_body.len()`. Fallback: if `raw_body` empty/missing, use `serde_json::to_string(response_body)`. Unit divisor: bytes=1, kb=1024, mb=1048576. Actual size = bytes / divisor. `compare(actual_size, op, threshold)`. Round actual to 2 decimal places for display: `(actual * 100.0).round() / 100.0`. Unit label: bytes→`"B"`, kb→`"KB"`, mb→`"MB"`. Path: `"(bodySize)"` |
| 15 | `datePrecise` | `get_by_path()`, `truncate_to_unit()`, `compare()` | **3 failure cases**: (1) not found → `"undefined"`; (2) actual date invalid → `"invalid date: {raw}"`; (3) reference date invalid → `"invalid reference: {ref}"`. **Date parsing**: JS uses `new Date(String(rawDp))` and `new Date(a.reference)` — Rust must parse ISO 8601 strings to `DateTime` via `chrono::DateTime::parse_from_rfc3339` or `chrono::NaiveDateTime::parse_from_str` with multiple format attempts. Get epoch millis, call `truncate_to_unit()`, then `compare()`. Path: `"(datePrecise:{jsonPath})"`. **IMPORTANT**: `a.reference` is a raw string (not a `DateReference` enum) — different from the `date` assertion which uses the `DateReference` enum |
| 16 | `custom` | **SKIP in Rust** | Do NOT evaluate. Simply skip the assertion entirely — no failure, no pass. JS will handle it post-hoc via `mapRustResult()` by re-running ONLY custom assertions. **Implementation**: when iterating assertions, if `a.type == Custom`, `continue` (skip to next assertion) |

**Negate logic** (universal post-processing, NOT per-case):
```
if negated:
    config_errors = filter failures for known config-error patterns:
        f.actual == "invalid regex pattern" ||
        f.actual == "invalid JSON in expected" ||
        f.actual == "empty expression" ||
        f.actual.starts_with("expression error:") ||
        f.actual.starts_with("runtime error:") ||
        f.actual.starts_with("invalid date:") ||
        f.actual.starts_with("invalid reference:") ||
        f.expected == "valid JSON Schema" ||
        f.expected == "valid JSON subset"
    if config_errors → push config_errors (fail even when negated)
    elif assertion_failures is empty → push synthetic failure:
        path: "(assertion_type)", expected: "NOT (assertion to fail)",
        actual: "assertion passed (negated → fail)"
    else → drop failures (negated pass — assertion failed as expected)
else:
    push all assertion_failures
```

**CRITICAL — Negate path format**: JS uses `a.type` in the synthetic failure path: `(${a.type})`. In Rust, this requires a method on `Assertion` to return the type discriminator string (e.g., `"status"`, `"responseTime"`, etc.).

**Crate dependency**: `chrono = "0.4"` already added in Sub-Group A.

**Decision**: `custom` assertions depend on `expressionEvaluator.ts` (353 lines) which has
full JS expression evaluation with variable resolution, `wrapCustomExprDollarPaths()` (stateful
string lexer for `$path` → `{{path}}` conversion), and `evaluateExpression()` with `{{var}}`
substitution + `isTruthy()`. Porting this is high-risk and low-value for throughput. Instead,
scenarios with `custom` assertions are **skipped** in Rust and JS fills them in via
`mapRustResult()` (incremental approach).

**CORRECTIONS from re-evaluation (2026-05-18)**:
1. **`compare()` and `format_op()` helpers missing from plan** — these are critical helpers used by 6 assertion types (arrayLength, numeric, date, bodySize, datePrecise + negate). Added with exact JS parity.
2. **`regex` assertion truncates actual to 200 chars** — JS line 365: `str.length > 200 ? str.slice(0, 200) + '…' : str`. Was missing from plan.
3. **`jsonSchema` path uses assertion loop index `_ai`** — path format is `(jsonSchema#0:...)` not `(jsonSchema:...)`. Rust must track the assertion index.
4. **`bodySize` fallback body source** — JS line 644: `ctx.rawBody ?? (ctx.responseBody != null ? JSON.stringify(ctx.responseBody) : '')`. Plan only mentioned `raw_body`.
5. **`bodySize` display rounding** — JS line 654: `Math.round(actualSize * 100) / 100`. Was missing.
6. **`datePrecise.reference` is a raw string, not `DateReference` enum** — different from `date` assertion. JS uses `new Date(a.reference)` directly. Rust must parse with chrono. Plan was ambiguous.
7. **`date` assertion uses `localeCompare` for comparison** — not direct string equality. JS `localeCompare` returns -1/0/1, then uses `compare(cmp, op, 0)`. This was missing from the plan.
8. **`custom` assertions should be SKIPPED entirely** — not return a `SkippedByRust` marker. No failure, no pass. Just `continue` in the assertion loop. JS handles them separately.

##### Step 5 — JSON validation engine (`src-tauri/src/json_validator.rs`) — NEW

Port `validate()` from `validator.ts` (lines 790–830) + `validateFields()` (lines 35–70) +
`validateFieldsUnordered()` (lines 81–227) + `tryRemapPaths()` (lines 235–282).

**`mode: 'none'`**: return empty failures.

**`mode: 'full'`**: Call `deep_compare()` from already-completed `deep_compare.rs`:
- `deep_compare.rs` is ✅ DONE. **Do NOT re-implement** — just call `deep_compare::deep_compare()`.
- Parse `config.expected_json` as `serde_json::Value` (if parse fails → `(parse)` failure).
- Call `deep_compare(expected, actual, "", &mut failures)`.
- Return failures.

**`mode: 'selective'` (also default fallthrough)**: Port `validate()` selective branch
from `validator.ts`. **IMPORTANT**: JS `validate()` treats any mode that isn't `'none'`
or `'full'` as selective — there is no strict mode check. In Rust, `ValidationMode` is a
3-variant enum (`None`, `Full`, `Selective`), so use `match` with `_ =>` on the selective
arm to handle any future variants. The function signature should be:
```rust
pub fn validate(config: &ValidationConfig, response_body: &Value) -> Vec<FailureDetail>
```
Note: `response_body` is a `&Value` (parsed JSON), NOT the raw string. JS `validate(config,
responseObj)` in `validationResult.ts` line 43 passes the parsed object.

**`validateFields()` (lines 35–70)** — port as `validate_fields()`:
- For each `ExpectedField`:
  - Call `get_by_path(response, &field.json_path)` to get `actual_value`
  - **Negate handling**: `let negated = field.negate.unwrap_or(false)`
  - **With operator**: `evaluate_field_operator(actual_value, operator, operator_value, expected_value)`
    then flip pass/fail with negate. Format expected as `"{neg_prefix}{result.expected}"`.
  - **Without operator** (plain equality check): JSON-stringify both sides and compare.
    - **CRITICAL parity detail**: For `expected_value`, JS does `JSON.stringify(JSON.parse(v))` first,
      falling back to `JSON.stringify(v)` on parse error. Rust must mirror: `serde_json::from_str(v)`
      → if Ok → `serde_json::to_string(&parsed)`, else → `serde_json::to_string(v)` (quote the raw string).
    - **CRITICAL**: JS `actualStr ?? 'undefined'` — when `JSON.stringify` returns `undefined`
      (which happens for JS `undefined`), the actual display is `'undefined'`. In Rust, when
      `get_by_path` returns `Value::Null` for a missing path, `serde_json::to_string` returns
      `"null"`. This creates a minor display difference that is acceptable (see Sub-Group B
      `deep_compare.rs` notes on undefined handling).
    - Negate: if negated, expected becomes `"NOT equals {field.expected_value}"`.

**`validateFieldsUnordered()` (lines 81–227)** — port as `validate_fields_unordered()`:
This is the most complex function in the validation engine (~145 lines in JS).

Algorithm:
1. **Separate array vs non-array fields**: Regex `/^(.*\[\d+\])/` identifies row prefixes
   (e.g., `offers[0]`). Fields without array indices go to `non_array_fields`.
2. **Validate non-array fields normally**: call `validate_fields(non_array_fields, body)`.
3. **Group row prefixes by array pattern**: Replace `[N]` with `[*]` to cluster rows belonging
   to the same array (e.g., `offers[0]` and `offers[1]` → `offers[*]`).
4. **For each array pattern group**:
   a. Strip trailing `[*]` to get `array_path`, resolve array from response.
   b. If array is empty/not found: validate all row fields normally (they'll fail as expected).
   c. For each expected row: iterate ALL array indices looking for a match:
      - Extract field suffixes (everything after the row prefix).
      - For each candidate index `i` (skip already-used indices):
        - Reconstruct `candidate_path = rowPrefix.replace([N] → [i]) + suffix`
        - Evaluate each field (operator or plain equality) with negate support.
        - Track `matchCount`, `mismatches`, `matches`.
      - If **all match**: mark index as used, move on.
      - If **partial match** (best partial): report mismatches with context
        `"actual (matched by suffix=value at [bestPartialIndex])"`.
        **CRITICAL detail**: JS line 207 strips quotes from actual:
        `m.actualValue.replace(/^"|"$/g, '')`. Rust must replicate.
      - If **no match at all**: report `"no matching item found in array"`.

5. **`usedIndices` tracking**: A `HashSet<usize>` prevents matching the same array element
   twice across different expected rows.

**`tryRemapPaths()` (lines 235–282)** — port as `try_remap_paths()`:
Called ONLY when ALL selective failures have `actual == "undefined"` (or `actual == None`).
Three strategies:
1. **Strip common prefix** (response is array): take first path's first segment, check all
   paths share it, strip it, re-validate. **CRITICAL**: JS line 243 splits on `[` or `.`:
   `firstPath.split(/[[.]/)[0]` — Rust must use the same regex.
2. **Add prefix** (response is object): for each root key whose value is object/array,
   try prefixing all paths with `key.`, replacing `.[` with `[`. Also try resolving
   directly against the nested value: `doValidate(fields, rootObj[key])`.
3. **Return null** if no strategy improves results (not all `undefined`).
**CRITICAL**: The `doValidate` parameter switches between `validate_fields` and
`validate_fields_unordered` based on `config.unordered_arrays`. Must pass through correctly.

**CRITICAL**: JS line 250/268 checks `!result.every(f => f.actual === 'undefined' || f.actual === undefined)`.
This means "at least one failure has a non-undefined actual". Rust equivalent:
`result.is_empty() || !result.iter().all(|f| f.actual == "undefined")`.

**Fields NOT used by `validate()`** (do NOT port into the validation engine):
- `selectiveMode` — unused in `validator.ts`; only UI/version code references it
- `excludedPaths` — unused in `validator.ts`; used only in UI/versioning code
- `sampleJson` — editor/mapper only
- `responseVersions`, `rulesVersions` — versioning metadata only
- `assertions` — assertions are evaluated OUTSIDE `validate()` via
  `buildValidationResult()` (see Step 5A below)

##### Step 5A — Port `buildValidationResult()` logic (`src-tauri/src/validation_result.rs`) — NEW

**CRITICAL**: The JS architecture splits validation into two stages that are combined in
`buildValidationResult()` (`src/engine/validationResult.ts`, 63 lines). The Rust port MUST
replicate this exact combination logic:

```rust
pub struct ValidationOutput {
    pub failure_details: Vec<FailureDetail>,
    pub passed: bool,
    pub error_message: Option<String>,
}

pub fn build_validation_result(
    http_status: u16,           // NOTE: u16 not u32 — matches ExecutionResult.http_status
    response_time_ms: f64,
    response_headers: &HashMap<String, String>,
    response_body: &str,        // raw body string
    response_obj: &Value,       // parsed JSON body
    error_message: Option<&str>,
    validation: &ValidationConfig,
    assertions: &[Assertion],
) -> ValidationOutput { ... }
```

**Combination logic** (must match JS exactly):
1. If `assertions.len() > 0`: run `evaluate_assertions()` → get `(failures, status_asserted)`
2. Determine `http_ok = http_status > 0 && http_status < 400`
3. Determine `status_ok`:
   - If `status_asserted`: check if any failure has `path == "(status)"` → if none, `status_ok = true`
   - Else: `status_ok = http_ok`
4. Run `validate()` ONLY when `validation.mode != 'none'` AND `status_ok` is true
   (JSON validation is skipped on bad HTTP status unless a status assertion overrides)
5. Merge: `failure_details = [...assertion_failures, ...json_failures]`
6. **HTTP failure overlay**: When `!status_asserted && (http_status >= 400 || http_status == 0)`:
   prepend synthetic `(http)` failure, **DROP json_failures** — only keep
   `[(http_failure), ...assertion_failures]`. This is intentional JS behavior.
   **CRITICAL detail** — the `(http)` actual message (JS line 54-55):
   - If `error_message` is Some → use it as actual
   - Else if `http_status == 0` → `"network error"`
   - Else → `"HTTP {http_status}"`
7. `network_error = http_status == 0 && !status_asserted`
8. `passed = !network_error && failure_details.is_empty()`
9. Return `ValidationOutput { failure_details, passed, error_message }` — error_message
   is **passed through unchanged** from input (JS line 62).

**CORRECTION from re-evaluation (2026-05-19)**: The plan signature previously used `http_status: u32`
but `ExecutionResult.http_status` is `u16` in `types.rs`. The Rust function should accept `u16`
for the status parameter to match the existing type — cast to `u32` internally only for
comparison operations if needed. The JS bridge uses `number` which is effectively the same.

##### Step 6 — Wire into executor hot loop (`src-tauri/src/executor.rs`)

**CORRECTION from re-evaluation (2026-05-19)**: The plan said to modify `execute_with_retry()`.
This is **WRONG**. Validation should NOT go inside `execute_with_retry()` because that function
handles retry logic based on HTTP status only (retry on `http_status == 0`). JS retries on
`!passed` which includes validation failures, but the Rust executor currently only retries on
network errors. Inserting validation inside the retry loop would require changing retry semantics.

**Correct approach**: Wire validation at the **call site** of `execute_with_retry()`, not inside it.

**CORRECTION from re-evaluation round 2 (2026-05-19)**: There are only **TWO** call sites
in `executor.rs` — NOT three. There is no `run_sequential()` function. Sequential mode is
handled by the JS bridge mapping `mode: 'sequential'` to `run_pool()` with concurrency=1
(see `rustBridge.ts` line 333). The two call sites are:
- `run_pool()` line 425 → spawned task per scenario (also handles sequential mode)
- `run_load_profile()` line 595 → spawned task per iteration

For each call site, **inside the spawned closure**, after `execute_with_retry()` returns
and **before** `tx.send(result)`:

1. **Body parsing guard**: Only parse response body when validation is needed:
   `scenario.validation.mode != ValidationMode::None || !scenario.assertions.is_empty()`.
   For `mode: None` with no assertions, skip JSON parsing entirely (saves allocations at high RPS).
2. Parse `result.response_body` as `serde_json::Value` (if parse fails, use `Value::Null`).
3. Call `build_validation_result(result.http_status, result.response_time_ms, &result.response_headers,
   &result.response_body, &parsed_body, result.error_message.as_deref(), &scenario.validation,
   &scenario.assertions)`.
4. Set `result.passed`, `result.failure_details`, `result.validation_mode` from output.
5. Send the fully-validated `ExecutionResult` through the channel.

**CRITICAL implementation detail — mutability**: The current code uses `let result = execute_with_retry(...)`.
This must change to `let mut result = execute_with_retry(...)` so we can set `result.passed`,
`result.failure_details`, and `result.validation_mode` on the result.

**Design (preferred)**: Extract a `validate_result()` helper function:
```rust
use crate::validation_types::{ValidationMode, ValidationConfig, Assertion, FailureDetail};
use crate::validation_result::build_validation_result;

fn validate_result(result: &mut ExecutionResult, validation: &ValidationConfig, assertions: &[Assertion]) {
    let needs_validation = validation.mode != ValidationMode::None || !assertions.is_empty();
    let mode_str = match &validation.mode {
        ValidationMode::None => "none",
        ValidationMode::Full => "full",
        ValidationMode::Selective => "selective",
    };
    if !needs_validation {
        result.passed = Some(result.http_status > 0 && result.http_status < 400);
        result.failure_details = vec![];
        result.validation_mode = mode_str.to_string();
        return;
    }
    let parsed: serde_json::Value = serde_json::from_str(&result.response_body)
        .unwrap_or(serde_json::Value::Null);
    let output = build_validation_result(
        result.http_status, result.response_time_ms, &result.response_headers,
        &result.response_body, &parsed, result.error_message.as_deref(),
        validation, assertions,
    );
    result.passed = Some(output.passed);
    result.failure_details = output.failure_details;
    result.validation_mode = mode_str.to_string();
}
```
Call at both call sites. In `run_pool()` (line 425):
```rust
let mut result = execute_with_retry(&client, &scenario, timeout, retry_count, retry_delay_ms, &cancel).await;
validate_result(&mut result, &scenario.validation, &scenario.assertions);
```
In `run_load_profile()` (line 595):
```rust
let mut result = execute_with_retry(&client, &scenario, timeout, retry_count, retry_delay_ms, &cancel).await;
validate_result(&mut result, &scenario.validation, &scenario.assertions);
```

**CRITICAL — `build_result()` must be updated**: The existing `build_result()` function (line 148)
creates `ExecutionResult` with the current struct fields. After adding `passed`, `failure_details`,
and `validation_mode` to `ExecutionResult`, this function must also initialize them:
```rust
fn build_result(...) -> ExecutionResult {
    ExecutionResult {
        // ... existing fields ...
        passed: None,                    // default — set later by validate_result()
        failure_details: vec![],         // default — populated by validate_result()
        validation_mode: String::new(),  // default — set by validate_result()
    }
}
```

**Circuit breaker impact**: `is_error` check now includes `!result.passed.unwrap_or(true)`
(validation failure), not just HTTP status. This matches JS behavior where validation
failures count as errors. **IMPORTANT**: The current circuit breaker call:
```rust
let is_error = result.http_status == 0 || result.http_status >= 400;
breaker.record(is_error);
```
Must move **after** `validate_result()` and change to:
```rust
validate_result(&mut result, &scenario.validation, &scenario.assertions);
let is_error = result.http_status == 0 || result.http_status >= 400
    || !result.passed.unwrap_or(true);
breaker.record(is_error);
```

**`cap_body` interaction**: `executor.rs` currently calls `cap_body(&body_text)` which
truncates response bodies to 2000 bytes. Validation operates on the **truncated** body.
This means validation on very large response bodies may produce **false negatives** (fields
or JSON paths may be cut off by truncation). This is an acceptable trade-off for performance —
the same body cap applies to JS results shown in the UI. **Future enhancement**: consider
passing the full body for validation while still capping the stored body for IPC/display.
Note that `cap_body()` truncates at a UTF-8 boundary, so JSON parsing of the truncated body
may produce `Value::Null` for partially-truncated JSON — this is graceful degradation.

##### Step 7 — Update types.rs + ExecutionPlan

**Changes to `RustScenario`** in `types.rs` (add validation payload):
```rust
pub struct RustScenario {
    // ... existing fields ...
    #[serde(default)]
    pub validation: ValidationConfig,    // NEW — from validation_types.rs
    #[serde(default)]
    pub assertions: Vec<Assertion>,      // NEW — from validation_types.rs
}
```

**CORRECTION from re-evaluation round 2 (2026-05-19)**: `ValidationConfig` already exists in
`validation_types.rs` with exactly the right fields (`mode: ValidationMode`, `expected_json`,
`expected_fields`, `unordered_arrays`). It already has `impl Default`. No new struct is needed.
Just reuse the existing `ValidationConfig` from `validation_types.rs` directly.
See Step 7 `RustScenario` changes for the exact code.

**CRITICAL — `#[serde(default)]` on new RustScenario fields**: The `validation` and `assertions`
fields MUST have `#[serde(default)]` so that old JS bridge code (before the Step 8 changes)
can still send `RustScenario` without these fields. `ValidationConfig` already has `impl Default`
(mode=None, all fields None). `Vec<Assertion>` defaults to empty vec. This ensures backward
compatibility during the migration period.
**IMPORTANT**: `ValidationConfig.mode` is `ValidationMode` (enum), NOT a string. The enum
already serializes/deserializes correctly via `#[serde(rename_all = "camelCase")]`.
JS sends `"none"`, `"full"`, or `"selective"` strings which serde maps to the enum variants.

**IMPORTANT**: `ExpectedField.expression` field exists in validation_types.rs but is unused
by the Rust validation engine (expression evaluation requires JS runtime). It's `Option<String>`
so it will deserialize to `None` when not provided by JS. It's intentionally NOT serialized
by `prepareRustScenario()` to save IPC bandwidth — serde defaults handle the missing field.
The `#[serde(default)]` attribute should be added to `ExpectedField` fields that may be
absent in serialized JSON (expression, operator, operator_value, negate).

**Changes to `ExecutionResult`** (add validation output):
```rust
pub struct ExecutionResult {
    // ... existing fields ...
    pub passed: Option<bool>,                    // NEW — None when validation not run
    pub failure_details: Vec<FailureDetail>,      // NEW — from validation_types.rs
    pub validation_mode: String,                  // NEW — "none"|"full"|"selective"
}
```
**IMPORTANT**: `passed` is `Option<bool>`, NOT `bool`. This enables backward compatibility:
when validation is not configured (mode=none, no assertions), `passed` defaults based on
HTTP status alone. The JS bridge checks `passed !== undefined` to detect Rust-validated results.

**IMPORTANT**: `validation_mode` is a `String`, NOT `ValidationMode` enum. This is intentional:
the JS bridge expects a plain string (`"none"`, `"full"`, `"selective"`), and `ExecutionResult`
is a transport struct that flows through IPC. The `validate_result()` helper converts the enum
to a string when populating this field.

**CRITICAL**: `FailureDetail` already exists in `validation_types.rs` (line 308-314) with
the correct `#[serde(rename_all = "camelCase")]` attribute. Do NOT re-define it in `types.rs`.
Import it via `use crate::validation_types::FailureDetail;` in `types.rs` or wherever needed.

**`build_result()` update required**: The `build_result()` helper in `executor.rs` (line 148)
creates `ExecutionResult` with all fields. It must be updated to include default values for
the new fields: `passed: None`, `failure_details: vec![]`, `validation_mode: String::new()`.
These defaults are populated later by `validate_result()`.

**No changes needed to `ProgressBatch`**: It already contains `Vec<ExecutionResult>` which
will automatically carry the new validation fields through IPC.

##### Step 8 — Update JS bridge (`src/features/test-runner/utils/rustBridge.ts`)

**Current state** (Tier 2): `prepareRustScenario()` serializes transport-only fields
(id, name, url, method, headers, body, groupName, weight, dataRowId, dataRowLabel).
Validation/assertions are NOT sent to Rust. `mapRustResult()` calls JS-side
`buildValidationResult()` with the original `scenario` object. `canUseRustExecutor()`
only checks for workflow mode, subWorkflow resolver, and OAuth2.

**Changes needed**:

1. **`prepareRustScenario()`**: Add `validation` config + `assertions` array to serialized plan.
   Serialize only the fields `validate()` needs:
   ```typescript
   return {
     // ... existing fields ...
     validation: {
       mode: scenario.validation.mode,
       expectedJson: scenario.validation.expectedJson ?? null,
       expectedFields: scenario.validation.expectedFields?.map(f => ({
         jsonPath: f.jsonPath,
         expectedValue: f.expectedValue,
         operator: f.operator ?? null,
         operatorValue: f.operatorValue ?? null,
         negate: f.negate ?? null,
       })) ?? null,
       unorderedArrays: scenario.validation.unorderedArrays ?? null,
     },
     assertions: (scenario.validation.assertions ?? []).filter(a => a.type !== 'custom'),
   };
   ```
   **Do NOT serialize**: `selectiveMode`, `excludedPaths`, `sampleJson`, `responseVersions`,
   `rulesVersions` — these are unused by `validate()` and would waste IPC bandwidth.
   **CRITICAL**: Filter out `custom` assertions at serialization time — they can't run in Rust.

2. **`RustScenario` TypeScript interface**: Add validation fields:
   ```typescript
   export interface RustScenario {
     // ... existing fields ...
     validation: {
       mode: string;
       expectedJson?: string | null;
       expectedFields?: Array<{
         jsonPath: string;
         expectedValue: string;
         operator?: string | null;
         operatorValue?: string | null;
         negate?: boolean | null;
       }> | null;
       unorderedArrays?: boolean | null;
     };
     assertions: Assertion[];
   }
   ```

3. **`RustExecutionResult` TypeScript interface**: Add validation output fields:
   ```typescript
   export interface RustExecutionResult {
     // ... existing fields ...
     passed?: boolean | null;           // undefined/null when validation not run
     failureDetails?: FailureDetail[];  // empty when passed
     validationMode?: string;           // "none"|"full"|"selective"
   }
   ```

4. **`canUseRustExecutor()`**: Add new gate — return false if any scenario has `custom`
   assertions. All other 15 assertion types are Rust-compatible.
   **Current checks** (workflow, subWorkflow, OAuth2) remain.
   ```typescript
   export function canUseRustExecutor(config, scenarios, resolveSubWorkflow?) {
     if (config.executionMode === 'workflow') return false;
     if (resolveSubWorkflow) return false;
     if (scenarios.some(s => s.auth.type === 'oauth2')) return false;
     // NEW: custom assertions require JS expression evaluator
     if (scenarios.some(s => (s.validation.assertions ?? []).some(a => a.type === 'custom'))) return false;
     return true;
   }
   ```
   **CORRECTION from re-evaluation (2026-05-19)**: The original plan mentioned checking for
   `expressionEvaluator` features. This is unnecessary — the only assertion type that uses
   `expressionEvaluator` is `custom`. Checking for `type === 'custom'` is sufficient.

5. **`mapRustResult()`**: When Rust result has `passed !== undefined`, passthrough
   `passed` and `failureDetails` directly — **no longer calls `buildValidationResult()`**.
   ```typescript
   export function mapRustResult(rustResult: RustExecutionResult, scenario: Scenario): RequestResult {
     // ... existing response parsing and error message extraction ...
     
     if (rustResult.passed !== undefined && rustResult.passed !== null) {
       // Rust-validated result — use Rust validation output directly
       let failureDetails = rustResult.failureDetails ?? [];
       
       // If scenario has custom assertions that were filtered out, run them in JS
       const customAssertions = (scenario.validation.assertions ?? []).filter(a => a.type === 'custom');
       if (customAssertions.length > 0) {
         const { failures: customFailures } = evaluateAssertions(customAssertions, {
           httpStatus: rustResult.httpStatus,
           responseTimeMs: rustResult.responseTimeMs,
           responseHeaders: rustResult.responseHeaders,
           responseBody: responseObj,
           rawBody: rustResult.responseBody,
         });
         failureDetails = [...failureDetails, ...customFailures];
       }
       
       const passed = failureDetails.length === 0 && rustResult.passed;
       // ... build RequestResult with passed, failureDetails, validationMode ...
     } else {
       // Legacy Tier 2 result — fall back to JS-side validation
       const assertions = scenario.validation.assertions ?? [];
       const vr = buildValidationResult({ ... });
       // ... existing logic ...
     }
   }
   ```
   **CRITICAL**: Custom assertion JS-side execution still requires the `responseObj` to be
   parsed. The existing response parsing logic in `mapRustResult()` (lines 404-419) already
   handles this correctly and should remain unchanged.

   **IMPORTANT — preserve existing error/retry logic**: The existing `mapRustResult()` code
   (lines 421-453) constructs `finalErrorMessage` which includes retry count info
   (`"Failed (after N attempts)"`). This logic must be preserved in both the passthrough
   and fallback paths. The error message extraction from response body (lines 423-435)
   also remains — it runs regardless of validation source.

   **CORRECTION from re-evaluation round 2 (2026-05-19)**: The backward compatibility check
   (`passed === undefined`) is needed for defensive coding only. In practice, Rust will always
   set `passed: Some(...)` after Sub-Group D is implemented — even for `mode: 'none'` with
   no assertions, `validate_result()` sets `passed = Some(http_ok)`. The `undefined` fallback
   should only fire if Rust fails to set the field at all (e.g., due to a bug or crash).

##### Step 9 — Unit tests

| Test file | Tests | Coverage target |
|-----------|-------|-----------------|
| `src-tauri/src/json_path_test.rs` | ✅ 67 tests | ✅ Done |
| `src-tauri/src/validation_types_test.rs` | ✅ 39 tests | ✅ Done |
| `src-tauri/src/deep_compare_test.rs` | ✅ 28 tests | ✅ Done |
| `src-tauri/src/subset_match_test.rs` | ✅ 20 tests | ✅ Done |
| `src-tauri/src/http_helpers_test.rs` | ✅ 38 tests | ✅ Done |
| `src-tauri/src/date_helpers_test.rs` | ✅ 23 tests | ✅ Done |
| `src-tauri/src/field_operator_test.rs` | ✅ 98 tests | ✅ Done |
| `src-tauri/src/assertion_evaluator_test.rs` | ✅ 60 tests | ✅ Done |
| `src-tauri/src/cross_module_test.rs` | ✅ 9 tests | ✅ Done |
| `src-tauri/src/json_validator_test.rs` | ~35 tests (full/selective/unordered/tryRemapPaths + negate + no-operator equality) | >90% |
| `src-tauri/src/validation_result_test.rs` | ~25 tests (HTTP overlay, status_asserted, mode gating, error passthrough) | >90% |
| `src-tauri/src/validation_integration_test.rs` | ~15 end-to-end parity tests | |

**JS-side parity tests**: Add integration tests in `rustBridge.test.ts` that compare
JS-validated results vs Rust-validated results for identical inputs.

**Critical parity edge cases to test**:
- HTTP 500 + no status assertion → `(http)` failure prepended, JSON validation dropped
- HTTP 500 + passing status assertion → JSON validation runs, all failures merged
- HTTP 0 (network error) + no status assertion → `(http)` failure + `network_error = true` → `passed = false`
- All selective fields undefined → `tryRemapPaths` kicks in
- `negate: true` with config errors (invalid regex) → errors survive negation
- `deepSubsetMatch` array matching: existential (any-match), not positional
- `deep_compare` with `null` vs missing array elements
- `custom` assertion filtered at serialization → JS fills in post-hoc, combined with Rust results
- `validateFieldsUnordered` — partial match with context display (quotes stripped from actual)
- `validateFieldsUnordered` — `usedIndices` prevents double-matching same row
- `validateFields` — no-operator equality: `JSON.parse(expected)` → `JSON.stringify()` normalization
- `tryRemapPaths` Strategy 1: array response + path has wrapper prefix → strip first segment
- `tryRemapPaths` Strategy 2: object response + paths start with `[0]` → try each root key as prefix
- `tryRemapPaths` Strategy 2b: also try resolving directly against nested value
- `mode: 'full'` with invalid expectedJson → `(parse)` failure returned
- `mode: 'full'` with empty expectedJson → empty failures
- `build_validation_result` error_message passthrough — input error_message returned unchanged

##### Step 10 — Performance benchmark

- Benchmark: 10,000 results with 5 assertions each
- Compare: JS `mapRustResult()` with JS-side validation vs Rust inline validation
- Target: >3x speedup on validation throughput
- **Methodology**: Measure wall-clock time for `mapRustResult()` with and without Rust
  validation passthrough. Use `performance.now()` in JS, `Instant::now()` in Rust benchmark tests.

**Files created/modified**:
| File | Status |
|------|--------|
| `src-tauri/src/validation_types.rs` | ✅ DONE — all validation types (16 assertion variants, 24 field operators, 39 serde tests) |
| `src-tauri/src/validation_types_test.rs` | ✅ DONE — 39 serde round-trip tests |
| `src-tauri/src/json_path.rs` | ✅ DONE — custom JSONPath engine (port of 122-line JS) |
| `src-tauri/src/json_path_test.rs` | ✅ DONE — 67 tests (ported + expanded from JS) |
| `src-tauri/src/deep_compare.rs` | ✅ DONE — recursive deep compare with JS typeof parity, MaybeOwned for array length |
| `src-tauri/src/deep_compare_test.rs` | ✅ DONE — 28 tests (including array-vs-object, length key, stringify parity) |
| `src-tauri/src/subset_match.rs` | ✅ DONE — existential/unordered deep subset match |
| `src-tauri/src/subset_match_test.rs` | ✅ DONE — 20 tests (ported from JS + edge cases) |
| `src-tauri/src/http_helpers.rs` | ✅ DONE — matchesStatusPattern (u32 safe), findHeader, evaluateHeaderOp |
| `src-tauri/src/http_helpers_test.rs` | ✅ DONE — 38 tests (including u16 overflow, empty/leading hyphen patterns) |
| `src-tauri/src/date_helpers.rs` | ✅ DONE — resolveDate, toDayString (float millis safe), truncateToUnit (div_euclid) |
| `src-tauri/src/date_helpers_test.rs` | ✅ DONE — 23 tests (including negative millis, float epoch, UTC parity) |
| `src-tauri/src/field_operator.rs` | ✅ DONE — 24-operator evaluator (437 LOC, 13 bugs found & fixed) |
| `src-tauri/src/field_operator_test.rs` | ✅ DONE — 98 tests |
| `src-tauri/src/assertion_evaluator.rs` | ✅ DONE — 16-type assertion evaluator with negate (725 LOC) |
| `src-tauri/src/assertion_evaluator_test.rs` | ✅ DONE — 60 tests |
| `src-tauri/src/cross_module_test.rs` | ✅ DONE — 9 integration tests |
| `src-tauri/src/json_validator.rs` | NEW — validate() + validateFields + validateFieldsUnordered + tryRemapPaths |
| `src-tauri/src/json_validator_test.rs` | NEW — ~35 tests |
| `src-tauri/src/validation_result.rs` | NEW — build_validation_result() combination logic (port of validationResult.ts) |
| `src-tauri/src/validation_result_test.rs` | NEW — ~25 tests for HTTP overlay, status_asserted, mode gating |
| `src-tauri/src/validation_integration_test.rs` | NEW — ~15 end-to-end parity tests |
| `src-tauri/src/executor.rs` | MODIFIED — wire validation at call sites (NOT inside execute_with_retry) |
| `src-tauri/src/types.rs` | MODIFIED — add validation fields to RustScenario + ExecutionResult |
| `src-tauri/src/lib.rs` | ✅ MODIFIED — mod declarations for Sub-Groups A + B + C modules |
| `src-tauri/Cargo.toml` | ✅ MODIFIED — added regex 1, jsonschema 0.27, chrono 0.4 |
| `src/features/test-runner/utils/rustBridge.ts` | MODIFIED — serialize validation, passthrough results, custom assertion fallback |
| `src/features/test-runner/utils/rustBridge.test.ts` | MODIFIED — parity tests |

**Estimated LOC for Sub-Group D**: ~600–800 lines (production) + ~600 lines (tests)

#### Phase 3A — Implementation Progress

| Sub-Group | Modules | Tests | Status | Date |
|-----------|---------|-------|--------|------|
| A: Types + JSONPath | `validation_types.rs` (341 LOC), `json_path.rs` (189 LOC) | 106 (39 serde + 67 JSONPath) | ✅ Done — 9 rounds re-evaluation, 0 bugs remaining | 2026-05-18 |
| B: Leaf Helpers | `deep_compare.rs` (164 LOC), `subset_match.rs` (120 LOC), `http_helpers.rs` (139 LOC), `date_helpers.rs` (69 LOC) | 109 (28 + 20 + 38 + 23) | ✅ Done — 9 rounds re-evaluation, 6 bugs found & fixed | 2026-05-18 |
| C: Core Evaluators | `field_operator.rs` (437 LOC), `assertion_evaluator.rs` (725 LOC) | 235 (98 field_op + 60 assertion + 9 cross-module + 68 existing) | ✅ Done — 20+ rounds re-evaluation, 16 bugs found & fixed | 2026-05-18 |
| D: Validation Engine + Wiring | `json_validator.rs` (508 LOC), `validation_result.rs` (100 LOC), executor wiring, JS bridge | 115 (56 json_validator + 38 validation_result + 21 cross_module) + 90 TS bridge + 15 perf | ✅ Done — 10 rounds re-evaluation, 3 bugs found & fixed | 2026-05-18 |

**Actual LOC**: 2,799 lines production + 5,277 lines tests = 8,076 total (Sub-Groups A + B + C + D) + 90 TS bridge tests + 15 perf benchmarks

**Bugs found & fixed during re-evaluation (Sub-Group C)**:
1. `assertion_evaluator.rs` — `arrayLength`/`arrayContains`/`each`: JS `typeof null === 'object'` not `'null'`; added `js_typeof_str()` helper
2. `assertion_evaluator.rs` — `Each` operator display: `FieldOperator::Debug` format gave PascalCase, JS expects snake_case; added `field_operator_name()` helper
3. `assertion_evaluator.rs` — `numeric` assertion `val_to_f64`: JS `Number(true)=1`, `Number(null)=0`, `Number("")=0`; Rust returned None for these
4. `assertion_evaluator.rs` — `datePrecise` precision label: `Debug` format gave PascalCase, JS expects lowercase; added `date_precision_name()` helper
5. `assertion_evaluator.rs` — `regex` actual truncation: `&s[..200]` byte-slicing panics on multi-byte UTF-8; changed to `.chars().take(200)`
6. `field_operator.rs` — `equals`/`not_equals` undefined actual: `json_stringify(Value::Null)` → `"null"`, but JS `JSON.stringify(undefined)` → `undefined`; added explicit None check
7. `field_operator.rs` — `in`/`not_in` undefined actual: None treated as Null could false-match `"null"` in list; added early return
8. `field_operator.rs` — string operators (`contains`, `starts_with`, `regex`) undefined: None → `"null"` instead of `""`; modified `stringify_for_string_ops` to accept Option
9. `field_operator.rs` — `is_type` undefined: `json_type_name(Null)` → `"null"`, JS `typeof undefined` → `"undefined"`; added explicit None check
10. `assertion_evaluator.rs` — `Each` assertion `operator_value` passing: `None` value was passed as `Some("")`, JS passes `undefined`; fixed to pass `value.as_deref()` directly
11. `field_operator.rs` — `close_to` NaN tolerance: Rust `.unwrap_or(0.01)` hid unparseable tolerance; JS `Number("abc")` → NaN makes comparison always fail
12. `assertion_evaluator.rs` — `val_to_f64` array parity: JS `Number([])=0`, `Number([42])=42`, `Number([1,2])=NaN`; Rust returned None for all arrays
13. `field_operator.rs` — `to_number` NaN string: Rust `"NaN".parse::<f64>()` returns `Ok(NaN)`, JS `toNumber("NaN")` returns null; added `is_nan()` filter

**Bugs found & fixed during re-evaluation (Sub-Groups A + B)**:
1. `deep_compare.rs` — Array vs Object type mismatch: JS `typeof [] === 'object'` requires special handling
2. `deep_compare.rs` — Object expected / Array actual: needed `get_by_string_key` helper for array index access
3. `deep_compare.rs` — Array `length` property: introduced `MaybeOwned` enum for computed properties
4. `http_helpers.rs` — Vacuous truth in range check: empty string before hyphen parsed as valid range start
5. `http_helpers.rs` — u16 overflow: `"99999".parse::<u16>()` silently overflowed; switched to u32
6. `date_helpers.rs` — Float epoch milliseconds: `as_i64()` returns None for floats; added `as_f64()` fallback
7. `date_helpers.rs` — `truncate_to_unit` negative millis: Rust integer division truncates toward zero vs JS `Math.floor`; fixed with `div_euclid`

---

#### 3B. Streaming Percentiles

**Goal**: Replace sort-based percentile calculation with streaming HDR histograms in Rust,
enabling accurate P50/P95/P99/P99.9 at 100K+ results without storing every datapoint or
resorting on each progress tick.

**Effort**: 1-2 weeks
**Target**: ~30,000 RPS (reduces progress event payload size + eliminates JS sort overhead)

**Crate dependencies** (add to `src-tauri/Cargo.toml`):
```toml
hdrhistogram = "7"          # High Dynamic Range histogram for streaming percentiles
```

**Current state (what changes)**:
- Today: JS `computeMetrics()` sorts ALL response times (O(n log n) per call).
  `computeIncrementalSummary()` in `useTestExecution` resorts a growing array every ~500ms.
  At 100K+ results, sorting becomes the bottleneck.
- Tier 3B: Rust maintains an HDR histogram, emits streaming percentiles in `ProgressBatch`.
  JS reads pre-computed percentiles — no sorting, no full result storage for metrics.

##### Step 1 — Rust histogram module (`src-tauri/src/histogram.rs`) — NEW

```rust
use hdrhistogram::Histogram;

pub struct StreamingMetrics {
    histogram: Histogram<u64>,
    total_count: u64,
    error_count: u64,
    sum_response_time: f64,
}

impl StreamingMetrics {
    pub fn new() -> Self { ... }
    pub fn record(&mut self, response_time_ms: f64, is_error: bool) { ... }
    pub fn snapshot(&self) -> MetricsSnapshot { ... }
}

pub struct MetricsSnapshot {
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
    pub p999: f64,     // NEW — not available today
    pub min: f64,
    pub max: f64,
    pub avg: f64,
    pub total: u64,
    pub errors: u64,
    pub tps: f64,       // computed from total / elapsed
}
```

HDR histogram config: range 1μs–5min (300,000ms), 3 significant digits.
Thread-safe: wrap in `Arc<Mutex<StreamingMetrics>>` for concurrent access from
spawned tasks.

##### Step 2 — Add MetricsSnapshot to ProgressBatch (`src-tauri/src/types.rs`)

```rust
pub struct ProgressBatch {
    // ... existing fields ...
    pub metrics: Option<MetricsSnapshot>,  // NEW
}
```

Emitted every `BATCH_INTERVAL` (100ms). `metrics` is always `Some` when results exist.

##### Step 3 — Wire into executors (`src-tauri/src/executor.rs`)

In `run_pool()` and `run_load_profile()`:
- Create `StreamingMetrics` alongside `CircuitBreakerState`
- After each `execute_with_retry()` result: `metrics.record(response_time_ms, is_error)`
- On batch emit: `metrics.snapshot()` → `ProgressBatch.metrics`

##### Step 4 — Update JS bridge (`src/features/test-runner/utils/rustBridge.ts`)

- Add `RustMetricsSnapshot` TypeScript type matching `MetricsSnapshot`
- In `runTestViaRust()`: extract `metrics` from each progress batch
- Forward `MetricsSnapshot` to `onProgress` as part of `ProgressMeta`

##### Step 5 — Update `useTestExecution.ts` + all ProgressMeta consumers

When Rust path is active: use `metrics.p50/p95/p99/p999` from `ProgressMeta` directly
for `liveSummary` (skip `computeIncrementalSummary` — eliminates O(n log n) resort).
When JS path: keep existing sort-based approach (backward compatible).
Final `computeMetrics()`: if Rust metrics available, use snapshot instead of re-sorting.

**ProgressMeta producers** (all need `MetricsSnapshot` field added):
| File | Notes |
|------|-------|
| `src/engine/executor.ts` | ProgressMeta type definition |
| `src/engine/loadProfileRunner.ts` | Emits meta every 500ms |
| `src/engine/requestExecution.ts` | runBatch, runPool emit meta |
| `src/features/workflow/engine/graphLoadRunner.ts` | Workflow iteration meta |
| `src/features/test-runner/utils/rustBridge.ts` | Maps RustProgressBatch → meta |
| `src/features/test-runner/hooks/useTestExecution.ts` | Synthetic meta for external execution |

**ProgressMeta consumers** (all need to handle optional `MetricsSnapshot`):
| File | Notes |
|------|-------|
| `src/features/test-runner/hooks/useTestExecution.ts` | `liveSummary`, time series |
| `src/features/test-runner/components/LiveProgressPanel.tsx` | Concurrency + elapsed display |
| `src/features/test-runner/utils/runnerProgressStorage.ts` | Persisted progress state |
| `src/engine/workerBridge.ts` | Worker ↔ main thread |
| `src/engine/workerProtocol.ts` | Typed message protocol |
| `src/engine/executionWorker.ts` | Worker entry point |
| `cli/index.ts` | **Currently ignores meta** — needs 4th param |

##### Step 6 — Add P99.9 to UI + Fix P50 in CLI

Add `p999ResponseTime` to `TestSummary` type (optional, backward compat).

**Files that need `p999ResponseTime`**:
| File | Change |
|------|--------|
| `src/shared/types/index.ts` | Add field to `TestSummary` |
| `src/engine/metrics.ts` | Compute P99.9 from sorted array |
| `src/features/test-runner/hooks/useTestExecution.ts` | `computeIncrementalSummary` |
| `src/features/results/ResultsDashboard.tsx` | New metric tile |
| `src/features/results/utils/reportGenerator.ts` | HTML + markdown reports |
| `src/features/results/components/RunComparisonPanel.tsx` | New metric option |
| `src/features/results/components/WorkflowResultsSummary.tsx` | Optional display |
| `src/features/results/components/ResponseTimeHistogram.tsx` | P99.9 reference line |
| `src/features/results/utils/runBaselines.ts` | `timeMetrics` array + thresholds |
| `cli/reporters.ts` | Console + markdown tables |

**Re-evaluation finding**: CLI `printConsoleSummary` and `buildMarkdownReport` currently
show P95 and P99 but **omit P50**. Fix: add P50 line to both reporters.

**Re-evaluation finding**: `LiveProgressPanel` computes `liveSummary: TestSummary` with
P50/P95/P99 but does NOT display them in the live cards (only TPS, avg, error rate).
With streaming metrics from Rust, consider adding live P95/P99 display during runs.

##### Step 7 — Reduce ProgressBatch payload size

With streaming metrics available, the UI no longer needs every `ExecutionResult` in
real-time for metrics computation. Add a `detailLevel` config:
- `'full'` (default): all results in batch (for assertion/validation inspection)
- `'metrics-only'`: only `MetricsSnapshot` + counts (for high-throughput mode)
- `'sampled'`: first N results + summary (configurable sample rate)

This dramatically reduces Tauri event serialization overhead at high RPS.

##### Step 8 — Unit tests

| Test file | Tests | Notes |
|-----------|-------|-------|
| `src-tauri/src/histogram_test.rs` | ~20 tests | P50/P95/P99/P99.9 accuracy, empty, single, boundary |
| `src-tauri/src/executor_test.rs` | +10 tests | Metrics in progress batch, concurrent recording |
| `rustBridgeIntegration.test.ts` | +5 tests | Metrics passthrough, JS/Rust percentile parity |

**Files created/modified**:
| File | Status |
|------|--------|
| `src-tauri/src/histogram.rs` | NEW |
| `src-tauri/src/histogram_test.rs` | NEW |
| `src-tauri/src/types.rs` | MODIFIED — add MetricsSnapshot to ProgressBatch |
| `src-tauri/src/executor.rs` | MODIFIED — wire histogram into pool/load-profile |
| `src-tauri/src/lib.rs` | MODIFIED — mod declarations |
| `src-tauri/Cargo.toml` | MODIFIED — add hdrhistogram |
| `src/features/test-runner/utils/rustBridge.ts` | MODIFIED — metrics types + passthrough |
| `src/features/test-runner/hooks/useTestExecution.ts` | MODIFIED — use streaming metrics |
| `src/shared/types/index.ts` | MODIFIED — add p999ResponseTime to TestSummary |
| `src/engine/metrics.ts` | MODIFIED — accept optional MetricsSnapshot |
| UI components (ResultsDashboard, LiveProgressPanel, CLI) | MODIFIED — show P99.9 |

---

##### Phase 3B — Detailed Implementation Sub-Phases

> Added 2026-05-20. Granular breakdown for implementation reference.

**Total effort**: ~5 days (1 week with buffer for re-evaluation rounds)
**Branch**: `feature/streaming-percentiles` from `develop`

---

###### Sub-Phase 3B.1: Rust Histogram Module (Days 1–2)

**New file**: `src-tauri/src/histogram.rs`

| Item | Detail |
|------|--------|
| Crate dependency | `hdrhistogram = "7"` in `src-tauri/Cargo.toml` |
| `StreamingMetrics` struct | Wraps `Histogram<u64>`, tracks `total_count: u64`, `error_count: u64`, `sum_response_time: f64` |
| Histogram config | Range: 1μs–300,000ms (5 min max), 3 significant digits |
| `new() → Self` | Creates histogram with above config |
| `record(response_time_ms: f64, is_error: bool)` | Converts to μs (×1000), records to histogram, increments counters |
| `snapshot(elapsed_ms: f64) → MetricsSnapshot` | Returns all percentiles + derived metrics |
| Thread safety | `Arc<Mutex<StreamingMetrics>>` — locked briefly per record/snapshot |
| `lib.rs` update | Add `pub mod histogram;` |

**Key design decisions**:
- Store response times as **microseconds (u64)** in the histogram for integer precision.
  Convert back to milliseconds (f64) on snapshot output.
- `min`/`max`: use histogram's `min()`/`max()` (automatically tracked).
- `avg`: `sum_response_time / total_count` (not from histogram — histogram loses precision).
- `tps`: `total_count as f64 / (elapsed_ms / 1000.0)`.
- Empty histogram: all fields return 0.0 (no panics).

**Tests** (~20 tests in `src-tauri/src/histogram_test.rs`):

| # | Test | Validates |
|---|------|-----------|
| 1 | `empty_snapshot_returns_zeros` | All fields are 0.0 when no records |
| 2 | `single_record_all_percentiles_equal` | P50=P95=P99=P999=min=max=avg for 1 sample |
| 3 | `two_records_min_max` | min/max correct with 2 distinct values |
| 4 | `known_uniform_distribution_p50` | 100 values [1..100] → P50 ≈ 50ms (±1) |
| 5 | `known_uniform_distribution_p95` | P95 ≈ 95ms (±1) |
| 6 | `known_uniform_distribution_p99` | P99 ≈ 99ms (±1) |
| 7 | `large_sample_p999` | 10,000 samples → P99.9 accuracy within 0.1% |
| 8 | `error_counting` | 3/10 errors → errors=3, total=10 |
| 9 | `tps_calculation` | 100 records over 2000ms elapsed → tps=50.0 |
| 10 | `avg_calculation` | Known sum/count → exact avg |
| 11 | `zero_response_time` | 0ms doesn't panic, records correctly |
| 12 | `max_range_boundary` | 300,000ms (5 min) records without error |
| 13 | `above_max_range_saturates` | >300,000ms saturates at max (doesn't panic) |
| 14 | `fractional_ms_precision` | 1.5ms → rounds to nearest μs (1500μs), output ≈ 1.5 |
| 15 | `snapshot_is_idempotent` | Two consecutive snapshots return same values |
| 16 | `incremental_recording` | Record 50, snapshot, record 50 more, snapshot shows all 100 |
| 17 | `all_errors_tps_still_correct` | 100% error rate doesn't affect TPS calculation |
| 18 | `elapsed_zero_tps_infinity_guard` | elapsed_ms=0 → tps=0.0 (not Inf/NaN) |
| 19 | `high_volume_10k_records` | Performance: 10K records < 5ms wall time |
| 20 | `histogram_reset` | If we add reset(), verify it clears all state |

---

###### Sub-Phase 3B.2: Types Update (Day 2)

**Modified file**: `src-tauri/src/types.rs`

Add `MetricsSnapshot` struct:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricsSnapshot {
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
    pub p999: f64,
    pub min: f64,
    pub max: f64,
    pub avg: f64,
    pub total: u64,
    pub errors: u64,
    pub tps: f64,
}
```

Add to `ProgressBatch`:
```rust
pub struct ProgressBatch {
    // ...existing fields...
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metrics: Option<MetricsSnapshot>,  // NEW
}
```

**Backward compatibility**: `metrics` is `Option` with `skip_serializing_if` — existing
JS consumers that don't know about this field will simply not see it (no breaking change).

---

###### Sub-Phase 3B.3: Executor Wiring (Days 2–3)

**Modified file**: `src-tauri/src/executor.rs`

Changes to `run_pool()`:
1. Create `let metrics = Arc::new(Mutex::new(StreamingMetrics::new()));` at function start
2. In the channel consumer loop, after `all_results.push(result)`:
   ```rust
   let is_error = !result.passed.unwrap_or(true);
   metrics.lock().unwrap().record(result.response_time_ms, is_error);
   ```
3. In each batch emit, add `metrics` field:
   ```rust
   metrics: Some(metrics.lock().unwrap().snapshot(start.elapsed().as_secs_f64() * 1000.0)),
   ```
4. Final drain batch also includes snapshot.

Changes to `run_load_profile()`:
- Same pattern — single `StreamingMetrics` instance shared via `Arc<Mutex<>>`.
- Record in the receiver loop (not in spawned tasks — avoids lock contention in hot path).

**Why record in receiver, not spawned tasks**: The receiver loop processes results
sequentially from the channel. Recording here means a single lock acquisition per result
(no contention). Recording in spawned tasks would require the lock under concurrent
access from N tasks simultaneously.

**Additional executor tests** (+10 in `src-tauri/src/executor_test.rs`):

| # | Test | Validates |
|---|------|-----------|
| 1 | `progress_batch_includes_metrics` | MetricsSnapshot present in emitted batch |
| 2 | `metrics_total_matches_completed_count` | metrics.total == completed after test |
| 3 | `metrics_errors_match_breaker_count` | metrics.errors aligns with breaker records |
| 4 | `metrics_tps_reasonable_range` | tps > 0 and < theoretical max |
| 5 | `metrics_percentiles_ordered` | p50 <= p95 <= p99 <= p999 |
| 6 | `load_profile_metrics_grow_over_time` | total increases across batches |
| 7 | `final_drain_includes_metrics` | Last batch has metrics even if < BATCH_INTERVAL |
| 8 | `pool_mode_metrics_accuracy` | Known response times → verify percentiles |
| 9 | `empty_scenarios_no_metrics` | 0 scenarios → metrics is None |
| 10 | `breaker_tripped_metrics_frozen` | After breaker trips, no new records added |

---

###### Sub-Phase 3B.4: TypeScript Bridge Update (Day 3)

**Modified file**: `src/features/test-runner/utils/rustBridge.ts`

Add interface:
```typescript
export interface RustMetricsSnapshot {
  p50: number;
  p95: number;
  p99: number;
  p999: number;
  min: number;
  max: number;
  avg: number;
  total: number;
  errors: number;
  tps: number;
}
```

Update `RustProgressBatch` interface:
```typescript
export interface RustProgressBatch {
  // ...existing...
  metrics?: RustMetricsSnapshot;  // NEW
}
```

In `runTestViaRust()` progress handler: extract `batch.metrics` and forward to
`onProgress` callback as part of `ProgressMeta`.

**Unit tests** (+5 in `rustBridge.test.ts`):
1. `metrics_passthrough_to_onProgress` — verify metrics forwarded
2. `metrics_undefined_when_absent` — no crash on missing metrics
3. `metrics_snapshot_type_shape` — all fields present and numeric
4. `metrics_forwarded_for_load_profile` — load-profile mode includes metrics
5. `metrics_not_duplicated_across_batches` — each batch has independent snapshot

---

###### Sub-Phase 3B.5: ProgressMeta + useTestExecution (Days 3–4)

**Modified files**:

1. `src/engine/executor.ts` — extend `ProgressMeta`:
   ```typescript
   export interface ProgressMeta {
     // ...existing...
     metrics?: {
       p50: number; p95: number; p99: number; p999: number;
       min: number; max: number; avg: number;
       total: number; errors: number; tps: number;
     };
   }
   ```

2. `src/features/test-runner/hooks/useTestExecution.ts`:
   - When `meta.metrics` is present (Rust path): use streaming values directly for
     `liveSummary` — skip `computeIncrementalSummary()` sort entirely.
   - When `meta.metrics` is absent (JS path): keep existing sort-based approach.
   - On test completion: if final batch has `metrics`, use those for the final summary
     instead of re-sorting all results.

3. `src/engine/workerBridge.ts` + `src/engine/workerProtocol.ts`:
   - Add `metrics` field to `WorkerProgressMessage` (future-ready for JS-side streaming).
   - Multi-worker aggregation: when multiple workers report metrics, average percentiles
     weighted by `total` count (approximation — true merge requires histogram merge).

**Key behavioral change**: In Rust execution mode, `liveSummary` updates will be
**O(1)** per progress tick instead of **O(n log n)**. This is the primary performance
win of Phase 3B for the UI thread.

---

###### Sub-Phase 3B.6: P99.9 in UI + CLI (Day 4)

**Modified files**:

| File | Change |
|------|--------|
| `src/shared/types/index.ts` | Add `p999ResponseTime?: number` to `TestSummary` |
| `src/engine/metrics.ts` | Add P99.9 computation: `sorted[Math.ceil(0.999 * n) - 1]` |
| `src/features/results/ResultsDashboard.tsx` | New metric tile "P99.9" |
| `src/features/results/components/ResponseTimeHistogram.tsx` | P99.9 vertical reference line (dashed, distinct color) |
| `src/features/results/utils/reportGenerator.ts` | Add P99.9 row to HTML + markdown reports |
| `src/features/results/components/RunComparisonPanel.tsx` | New "P99.9" metric option in comparisons |
| `src/features/results/utils/runBaselines.ts` | Add P99.9 to `timeMetrics` threshold array |
| `cli/reporters.ts` | Add P99.9 row to console summary + markdown report |

**Backward compatibility**: `p999ResponseTime` is optional — old saved results
without it simply show "—" in the UI.

---

###### Sub-Phase 3B.7: Payload Reduction — `detailLevel` (Day 5)

**Concept**: At high RPS (>10K), serializing every `ExecutionResult` across Tauri IPC
becomes the bottleneck. With streaming metrics, the UI doesn't need every result for
live display — only for post-hoc assertion inspection.

**New config field** in `ExecutionPlan` (all variants):
```rust
#[serde(rename = "detailLevel", default = "default_detail_level")]
pub detail_level: DetailLevel,

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename = "camelCase")]
pub enum DetailLevel {
    #[serde(rename = "full")]
    Full,           // Default — all results in every batch
    #[serde(rename = "metrics-only")]
    MetricsOnly,    // Only MetricsSnapshot + counts, results vec is empty
    #[serde(rename = "sampled")]
    Sampled,        // First N results per batch (configurable, default 10)
}
```

**Executor behavior**:
- `Full`: current behavior (unchanged)
- `MetricsOnly`: `ProgressBatch.results = vec![]` — only metrics/counts emitted.
  All results still stored in `all_results` for final `CompletionSummary`.
- `Sampled`: `ProgressBatch.results = batch[..min(N, batch.len())]`

**JS bridge**: Map from UI config option to `detailLevel` field.
- Default: `full` for pool/sequential (<1000 scenarios), `sampled` for load-profile
- User override available in runner config UI

**Expected impact**: At 10K RPS with `MetricsOnly`, Tauri event payload drops from
~2MB/batch (200 results × ~10KB each) to ~200 bytes (just metrics). This eliminates
the IPC serialization bottleneck.

---

###### Sub-Phase 3B.8: Verification & Cleanup (Day 5)

| Check | Command | Expected |
|-------|---------|----------|
| Rust unit tests | `cargo test` | All pass (62 existing + ~30 new) |
| Rust lint | `cargo clippy` | 0 warnings |
| TypeScript types | `npx tsc -b --noEmit` | 0 errors |
| JS unit tests (touched) | `npx vitest run src/features/test-runner/...` | All pass |
| JS unit tests (touched) | `npx vitest run src/engine/...` | All pass |
| Rust bridge tests | `npx vitest run src/features/test-runner/utils/rustBridge*.test.ts` | All pass |

**Re-evaluation checklist** (run after each sub-phase):
- [ ] Rust↔JS serde field names match (camelCase)
- [ ] `MetricsSnapshot` optional everywhere — no crash on `None`/`undefined`
- [ ] Existing tests unaffected (no regression)
- [ ] Worker bridge protocol stays backward compatible
- [ ] CLI reporters compile and format correctly
- [ ] No floating-point NaN/Infinity in edge cases (0 results, 0 elapsed)

---

###### Dependencies & Risk Assessment

| Risk | Mitigation |
|------|------------|
| `hdrhistogram` crate compatibility | Crate is mature (v7), widely used, no unsafe |
| Binary size increase | ~50KB — negligible vs existing 15MB+ app |
| Mutex contention in receiver | Single-threaded receiver — no contention |
| P99.9 accuracy at low sample count | HDR histogram is accurate to 3 significant digits even at <100 samples |
| Breaking JS consumers | All new fields are `Option`/optional — zero breaking changes |
| Multi-worker histogram merging | Deferred to Sub-Phase 3B.5 — approximate weighted average for now |

---

#### 3C. Constant Arrival Rate (Open Model)

**Goal**: Implement a "fire N requests/second regardless of response time" execution mode
(open model). This is k6's most distinctive feature and the key differentiator for realistic
load simulation. The closed model (Tier 2) adjusts throughput based on response latency;
the open model maintains constant pressure even when the server slows down.

**Effort**: 2-3 weeks
**Target**: ~50,000 RPS (arrival-rate limited, not response-time limited)

**Current state (what changes)**:
- All execution modes today are **closed model** (concurrency-based): pool, sequential,
  load-profile. Throughput is bounded by `concurrency × (1 / avg_response_time)`.
- `WebhookLoadDriver` has RPS-like pacing but is webhook-specific and still respects completion.
- Tier 3C adds a true open model: `tokio::time::interval` fires at fixed rate regardless of
  whether previous requests completed. Backpressure via configurable max in-flight limit.

##### Step 1 — Add `ConstantArrival` to ExecutionPlan (`src-tauri/src/types.rs`)

```rust
#[serde(rename = "constant-arrival")]
ConstantArrival {
    scenarios: Vec<RustScenario>,
    #[serde(rename = "targetRps")]
    target_rps: f64,                    // requests per second
    #[serde(rename = "durationSec")]
    duration_sec: u64,
    #[serde(rename = "maxInFlight")]
    max_in_flight: u32,                 // backpressure limit (default: target_rps * 10)
    #[serde(rename = "timeoutMs")]
    timeout_ms: u64,
    #[serde(rename = "retryCount")]
    retry_count: u32,
    #[serde(rename = "retryDelayMs")]
    retry_delay_ms: u64,
    #[serde(rename = "thinkTime")]
    think_time: ThinkTimeConfig,
    #[serde(rename = "circuitBreaker")]
    circuit_breaker: CircuitBreakerConfig,
    #[serde(rename = "rampConfig")]
    ramp_config: Option<ArrivalRampConfig>,
}

pub struct ArrivalRampConfig {
    pub start_rps: f64,
    pub end_rps: f64,
    pub ramp_duration_sec: u64,
}
```

##### Step 2 — Constant arrival executor (`src-tauri/src/arrival_executor.rs`) — NEW

Core algorithm using `tokio::time::interval`:
```
- interval = Duration::from_secs_f64(1.0 / target_rps)
- max_in_flight semaphore (backpressure)
- Loop:
    1. interval.tick().await (fires at constant wall-clock rate)
    2. If semaphore permits available → spawn request task
    3. If no permits → increment "dropped" counter (request not sent)
    4. Check duration / breaker / cancellation
- Ramped arrival: recalculate interval at each tick based on elapsed time
```

Key design decisions:
- **Backpressure**: When all `max_in_flight` slots are occupied, the request is **dropped**
  (not queued). This matches k6's `maxVUs` behavior. Dropped count reported in metrics.
- **Think time**: Applied AFTER request completes, BEFORE releasing in-flight slot.
  For open model, think time increases effective in-flight occupancy without changing
  arrival rate.
- **Ramped arrival**: Linear interpolation between `start_rps` and `end_rps` over
  `ramp_duration_sec`, then hold at `end_rps` for remaining duration.
- **Weighted scenarios**: Same `build_weighted_pool()` + round-robin as pool mode.

Progress batch format:
```rust
ProgressBatch {
    // existing fields ...
    target_rps: Option<f64>,     // NEW — current target arrival rate
    actual_rps: Option<f64>,     // NEW — achieved arrival rate
    dropped_requests: Option<u64>, // NEW — requests not sent due to backpressure
    metrics: Option<MetricsSnapshot>,
}
```

##### Step 3 — Wire into commands.rs

Add `ExecutionPlan::ConstantArrival` match arm in `start_load_test()` →
calls `arrival_executor::run_constant_arrival()`.

##### Step 4 — Add `ExecutionMode` value in JS

In `src/shared/types/index.ts`:
```typescript
export type ExecutionMode = 'sequential' | 'batch' | 'pool' | 'load-profile'
  | 'workflow' | 'constant-arrival';
```

In `src/shared/utils/executionMode.ts`: add label/description for constant-arrival.

##### Step 5 — JS bridge update (`src/features/test-runner/utils/rustBridge.ts`)

- `canUseRustExecutor()`: return true for `constant-arrival` mode
  (Note: constant-arrival is ONLY available via Rust executor — no JS fallback)
- `buildExecutionPlan()`: map `constant-arrival` → `ConstantArrival` plan with
  `targetRps`, `durationSec`, `maxInFlight`, optional `rampConfig`

##### Step 6 — Configuration UI (`src/features/test-runner/components/RunnerExecutionConfig.tsx`)

Add "Constant Arrival Rate" option to execution mode selector:
- **Target RPS**: numeric input (required)
- **Duration**: seconds (required)
- **Max In-Flight**: numeric input (default: target_rps × 10)
- **Ramp**: optional toggle with start_rps, end_rps, ramp_duration_sec
- **Profile preview**: show expected arrival rate over time as a chart

Note in UI: "Requires desktop app (Tauri)" — disabled when `!isTauri()`.

##### Step 7 — Live dashboard updates

- `LiveProgressPanel`: show Target RPS, Actual RPS, Dropped Requests when in constant-arrival mode
- `LiveCharts`: add RPS time series chart (target vs actual)
- `ResultsDashboard`: show dropped request count and peak actual RPS

##### Step 8 — Unit tests

| Test file | Tests | Notes |
|-----------|-------|-------|
| `src-tauri/src/arrival_executor_test.rs` | ~25 tests | Fixed rate, ramped, backpressure drops, breaker, cancel |
| `rustBridge.test.ts` | +10 tests | canUseRustExecutor for constant-arrival, buildExecutionPlan |
| `rustBridgeIntegration.test.ts` | +8 tests | End-to-end arrival rate execution |

**Files created/modified**:
| File | Status |
|------|--------|
| `src-tauri/src/arrival_executor.rs` | NEW |
| `src-tauri/src/arrival_executor_test.rs` | NEW |
| `src-tauri/src/types.rs` | MODIFIED — add ConstantArrival, ArrivalRampConfig, RPS fields |
| `src-tauri/src/commands.rs` | MODIFIED — new match arm |
| `src-tauri/src/lib.rs` | MODIFIED — mod declarations |
| `src/shared/types/index.ts` | MODIFIED — add 'constant-arrival' to ExecutionMode |
| `src/shared/utils/executionMode.ts` | MODIFIED — add label/description |
| `src/features/test-runner/utils/rustBridge.ts` | MODIFIED — new plan mapping |
| `src/features/test-runner/components/RunnerExecutionConfig.tsx` | MODIFIED — new UI |
| `src/features/test-runner/components/LiveProgressPanel.tsx` | MODIFIED — RPS display |
| `src/features/test-runner/components/LiveCharts.tsx` | MODIFIED — RPS chart |

---

#### 3D. Distributed Execution

**Goal**: Break past single-machine limits by coordinating load generation across multiple
machines/processes. A controller dispatches work to remote workers, aggregates results,
and streams combined metrics to the UI.

**Effort**: 4-6 weeks
**Target**: ~50,000+ RPS (horizontally scalable)
**Risk**: Highest of all phases — requires network protocol, discovery, fault tolerance

**Current state**: All execution is single-process (Tauri app or CLI). No multi-machine
coordination exists.

##### Step 1 — Architecture decision

**Option A: WebSocket-based** (recommended for v1)
- Lower complexity than gRPC (no protobuf codegen, no tonic dependency)
- `tokio-tungstenite` for Rust WebSocket server/client
- JSON message protocol (reuse existing `serde_json` types)
- Discovery: manual endpoint list or mDNS (later)

**Option B: gRPC** (future upgrade path)
- `tonic` + `prost` for protobuf
- Higher performance for very large clusters (>10 workers)
- More complex build (protobuf compiler required)

**Decision**: Start with WebSocket (Option A). Migrate to gRPC if >10 worker nodes needed.

##### Step 2 — Protocol design (`src-tauri/src/distributed/protocol.rs`) — NEW

```rust
enum ControllerMessage {
    AssignWork { plan_id: String, plan: ExecutionPlan, worker_share: f64 },
    Abort { plan_id: String },
    Ping,
}

enum WorkerMessage {
    Ready { worker_id: String, capabilities: WorkerCapabilities },
    Progress { plan_id: String, batch: ProgressBatch },
    Complete { plan_id: String, summary: CompletionSummary },
    Error { plan_id: String, error: String },
    Pong,
}

struct WorkerCapabilities {
    max_concurrency: u32,
    cpu_cores: u32,
    memory_mb: u64,
}
```

##### Step 3 — Worker mode (`src-tauri/src/distributed/worker.rs`) — NEW

A worker is a headless Rust binary (or Tauri app in worker mode) that:
1. Connects to controller WebSocket endpoint
2. Sends `Ready` with capabilities
3. Receives `AssignWork` with partial `ExecutionPlan` (subset of scenarios or reduced concurrency)
4. Runs `start_load_test()` locally (reuses existing executor)
5. Streams `Progress` batches back to controller
6. Sends `Complete` when done

**Worker binary**: The current `src-tauri/src/main.rs` is the Tauri app entry point.
For distributed workers, add a **standalone Rust binary** target:
```toml
# src-tauri/Cargo.toml
[[bin]]
name = "redfireforge-worker"
path = "src/worker_main.rs"
```

This binary reuses all executor/validation/histogram modules but links against
`tokio-tungstenite` instead of Tauri. No webview dependency.

**Note**: The current **Node.js CLI** (`cli/index.ts`) cannot serve as a distributed worker
because it uses the JS engine. The Rust worker binary replaces it for distributed scenarios.

**Entry points**:
- `redfireforge-worker --controller ws://host:port` — headless CLI worker
- Tauri app → Settings → Distributed → "Join as Worker" — GUI worker mode

##### Step 4 — Controller (`src-tauri/src/distributed/controller.rs`) — NEW

The controller (primary Tauri app) that:
1. Starts WebSocket server on configurable port (default 9876)
2. Accepts worker connections, tracks `WorkerCapabilities`
3. Splits `ExecutionPlan` across workers:
   - **Even split**: `N` total scenarios ÷ `W` workers = `N/W` per worker
   - **Capability-weighted**: split proportional to worker CPU cores
   - **Constant arrival**: each worker gets `target_rps / W` arrival rate
4. Aggregates `ProgressBatch` from all workers into combined batch
5. Merges `StreamingMetrics` histograms (HDR histograms are mergeable)
6. Emits combined progress to local UI via existing Tauri event system
7. Handles worker disconnection (reassign work or degrade gracefully)

##### Step 5 — Plan splitting logic (`src-tauri/src/distributed/planner.rs`) — NEW

```rust
pub fn split_plan(
    plan: ExecutionPlan,
    workers: &[WorkerCapabilities],
) -> Vec<(String, ExecutionPlan)> {
    // For pool/sequential: split scenario list across workers
    // For load-profile: each worker gets proportional concurrency
    // For constant-arrival: each worker gets proportional target_rps
    // Duration stays the same for all workers
}
```

##### Step 6 — UI for distributed mode

In `RunnerExecutionConfig.tsx`:
- "Distributed" toggle (only when Tauri)
- Worker list panel: connected workers with status/capabilities
- Start controller button with port config
- Live dashboard: per-worker progress + aggregated metrics

##### Step 7 — Worker discovery (optional, future)

- mDNS via `mdns-sd` crate for automatic LAN discovery
- Worker auto-registers on startup, controller discovers
- Fallback: manual endpoint list in settings

##### Step 8 — Fault tolerance

- Worker heartbeat (Ping/Pong every 5s)
- Worker disconnect: log warning, continue with remaining workers
- Controller disconnect: worker stops execution, attempts reconnect
- No work redistribution in v1 (simplicity > completeness)

##### Step 9 — Unit & integration tests

| Test file | Tests | Notes |
|-----------|-------|-------|
| `src-tauri/src/distributed/protocol_test.rs` | ~15 | Message serde round-trip |
| `src-tauri/src/distributed/planner_test.rs` | ~20 | Plan splitting (even, weighted, arrival) |
| `src-tauri/src/distributed/controller_test.rs` | ~15 | Aggregation, worker lifecycle |
| `src-tauri/src/distributed/worker_test.rs` | ~10 | Connection, execution, disconnect |
| `rustBridgeIntegration.test.ts` | +5 | Distributed config mapping |

**Files created/modified**:
| File | Status |
|------|--------|
| `src-tauri/src/distributed/mod.rs` | NEW |
| `src-tauri/src/distributed/protocol.rs` | NEW |
| `src-tauri/src/distributed/worker.rs` | NEW |
| `src-tauri/src/distributed/controller.rs` | NEW |
| `src-tauri/src/distributed/planner.rs` | NEW |
| `src-tauri/src/distributed/*_test.rs` | NEW (4 files) |
| `src-tauri/src/lib.rs` | MODIFIED |
| `src-tauri/Cargo.toml` | MODIFIED — tokio-tungstenite, optional mdns-sd |
| `src/features/test-runner/utils/rustBridge.ts` | MODIFIED — distributed config |
| `src/features/test-runner/components/RunnerExecutionConfig.tsx` | MODIFIED — distributed UI |

---

---

#### Pre-Tier-3: Ramp/Spike Parity Fix (REQUIRED before 3C)

**Re-evaluation finding**: Deep audit revealed **6 behavioral differences** between JS
`getTargetConcurrency()` (loadProfileRunner.ts) and Rust `get_target_concurrency()` (executor.rs):

| Gap | JS Behavior | Rust Behavior | Fix |
|-----|-------------|---------------|-----|
| Spike default start | `floor(durationSec * 0.3)` | `0` | Align Rust to JS formula |
| Spike default duration | `ceil(durationSec * 0.2)` | `10` (hardcoded) | Align Rust to JS formula |
| Spike default peak | `maxConcurrency * 3` | `max(1, maxConcurrency) * 2` | Align Rust to JS: `* 3` |
| Ramp formula | `ceil(1 + (M-1) × t)` (affine 1→M) | `ceil(t × max(M,1))` (linear from 0) | Align Rust to JS affine formula |
| `rampUpSec = 0` | `0 \|\| durationSec` → use durationSec | `Some(0)` → instant max_c | Align: treat 0 as "use durationSec" |
| `maxConcurrency = 0` sustained | Returns 0 | Returns 1 (max(0,1)) | Document: Rust enforces minimum 1 |

**Impact**: When user configures spike/ramp-up load profile without explicit overrides,
JS UI preview shows different curves than what Rust executor actually produces. This causes
confusion and incorrect test results.

**Fix location**: `src-tauri/src/executor.rs` → `get_target_concurrency()`.
Update `src-tauri/src/executor_test.rs` to match JS behavior.

---

#### Pre-Tier-3: CLI Rust Executor Path (Relevant for 3B, 3C, 3D)

**Re-evaluation finding**: The CLI (`cli/index.ts`) currently runs tests via the **JS engine**
only (`runTest` / `runGraphLoad` from `src/engine/executor.ts`). It cannot use the Rust
executor because:
1. No Tauri IPC available in Node.js CLI context
2. CLI progress handler doesn't accept `ProgressMeta` (only `completed, total, results`)
3. CLI reporters don't show P50 in console/markdown output (only P95/P99)

**For Tier 3B-3D**: The CLI needs a Rust execution path. Options:
- **Option A**: Build CLI as a Rust binary (replaces Node.js CLI) — highest performance
- **Option B**: Use `napi-rs` to call Rust from Node.js — moderate effort, keeps JS CLI
- **Option C**: Keep JS CLI at Tier 1 performance — lowest effort, desktop-only for high RPS

**Decision**: Defer to Phase 3D. For 3A-3C, the Rust executor is desktop-only (Tauri).
CLI continues at JS performance level. Revisit when distributed execution requires
standalone workers.

**Immediate fixes** (can be done now):
1. Add P50 to CLI console and markdown reporters (`cli/reporters.ts`)
2. Accept `ProgressMeta` in CLI progress handler for future streaming metrics

---

#### Tier 3 Implementation Order & Dependencies

```
Phase 3A: Full Validation in Rust (weeks 1-3)
  ├── validation_types.rs ← no deps (all type definitions)
  ├── json_path.rs ← no deps
  ├── deep_compare.rs ← no deps
  ├── subset_match.rs ← no deps
  ├── http_helpers.rs ← no deps
  ├── date_helpers.rs ← chrono
  ├── field_operator.rs ← json_path.rs
  ├── assertion_evaluator.rs ← json_path.rs, field_operator.rs, http_helpers, date_helpers, subset_match
  ├── json_validator.rs ← json_path.rs, field_operator.rs, deep_compare
  ├── validation_result.rs ← assertion_evaluator, json_validator (buildValidationResult combination)
  └── Wire into executor.rs ← validation_result (single entry point)

Phase 3B: Streaming Percentiles (weeks 3-4)
  ├── histogram.rs ← no deps (hdrhistogram crate)
  ├── Wire into executor.rs ← histogram.rs
  ├── Update ProgressBatch types ← histogram.rs
  └── JS bridge + UI updates ← types

Phase 3C: Constant Arrival Rate (weeks 5-7)
  ├── arrival_executor.rs ← executor.rs patterns, Phase 3B histogram
  ├── Update types.rs + commands.rs ← arrival_executor.rs
  ├── JS bridge + ExecutionMode ← types
  └── Configuration UI ← bridge

Phase 3D: Distributed Execution (weeks 7-12)
  ├── Protocol design ← all above settled
  ├── Worker mode ← executor.rs, protocol
  ├── Controller ← protocol, Phase 3B histogram merge
  ├── Plan splitter ← types
  └── UI ← controller API
```

**Critical path**: 3A → 3B → 3C → 3D (each builds on the previous)
**Parallel opportunity**: 3A and 3B can overlap (3B doesn't require validation)
**Risk mitigation**: 3D can be deferred without impacting single-machine throughput

---

## Implementation Roadmap

```
Phase     Timeline        Target RPS    Key Changes
─────────────────────────────────────────────────────────
PR 1 ✅   Hot-path micro  ~2,800        1O,1B,1H,1N,1J,1D,1E — COMPLETED 2026-05-18
PR 2 ✅   Transport       ~3,500        1A,1F,1C,1K,1G — COMPLETED 2026-05-18
PR 3 ✅   Caching         ~4,000        1I,1M — COMPLETED 2026-05-18
─── Tier 1 Week 1 complete ─── ~3,500-4,000 RPS ────────
PR 4 ✅   Multi-worker    ~6,000-8,000  1P — COMPLETED 2026-05-18
─── Tier 1 complete ─── ~6,000-8,000 RPS ────────────────
Tier 2A   Days 1-4        ~8,000        reqwest + tokio + executor.rs (think time, breaker, retry)
Tier 2B   Days 5-7        ~10,000       Tauri commands + event streaming + abort
Tier 2C   Days 8-11       ~12,000       JS integration, fallback, streaming validation
Tier 2D   Days 12-14      ~15,000       Integration tests, edge cases, JS↔Rust parity
─── Tier 2 complete ─── ~10,000-15,000 RPS (desktop) ───
Tier 3A   Month 3         ~20,000       Full validation in Rust
Tier 3B   Month 3-4       ~30,000       Streaming percentiles
Tier 3C   Month 4         ~50,000       Constant arrival rate
Tier 3D   Month 5-6       ~50,000+      Distributed execution
─── Tier 3 complete ─── ~50,000+ RPS ────────────────────
```

---

## Positioning Impact

| Milestone | Positioning Statement |
|-----------|----------------------|
| **Today (v0.5.8)** | "Good for functional/integration testing and moderate load (up to 2K RPS). For heavy load testing, use k6 or Gatling." |
| **After Tier 1** | "Handles real-world API testing loads (6-8K RPS on multi-core). Competitive with Artillery and surpasses JMeter." |
| **After Tier 2** | "Desktop app delivers 10-15K RPS via native Rust HTTP engine. Visual workflow design that scales." |
| **After Tier 3** | "Full enterprise load testing. Visual workflows at k6 throughput." |

---

## Competitive Context (May 2026)

| Tool | Max RPS | Architecture | Visual Workflow | Price |
|------|---------|-------------|-----------------|-------|
| **k6** | 50K+ | Go native + distributed | No (JS scripting) | Free / Grafana Cloud |
| **Gatling** | 50K+ | Scala/JVM + distributed | Injection profile only | €89+/mo |
| **JMeter** | 5-10K | Java threads | XML tree (dated) | Free |
| **Artillery** | 5-10K | Node.js | No (YAML) | Free / paid cloud |
| **RedfireForge (now)** | 1-2K | JS + Web Worker | **Full DAG (15+ nodes)** | Free |
| **RedfireForge (Tier 1)** | 6-8K | JS + Multi-Worker | **Full DAG** | Free |
| **RedfireForge (Tier 2)** | 10-15K | Rust executor + JS UI | **Full DAG** | Free |
| **RedfireForge (Tier 3)** | 50K+ | Full Rust + distributed | **Full DAG** | Free |

### Key Insight

Most users choosing RedfireForge over JMeter/Postman care about the **visual workflow + validation + catalog pipeline** — not raw RPS numbers. The users who need 50K RPS already know k6. Tier 1 makes us honest, Tier 2 makes us competitive, and Tier 3 is post-traction investment driven by community demand.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-18 | Tier 1 first, Tier 2 second | Low-risk optimizations before architectural change |
| 2026-05-18 | ~~Sidecar over embedded Rust~~ **REVISED** → `#[tauri::command]` | Sidecar adds build complexity (separate binary + target triples) and slow stdin/stdout IPC. `#[tauri::command]` runs on tokio's thread pool inside the same process — simpler build, faster IPC via Tauri invoke, shared connection pool. tokio does NOT block the Tauri main thread. |
| 2026-05-18 | Validation stays in JS for Tier 2 | HTTP I/O is the bottleneck, not CPU-bound validation. The 24-operator evaluator is 3K+ lines — porting to Rust doubles maintenance. Move to Rust only if profiling shows validation > 20% of total time. |
| 2026-05-18 | Browser/web stays at Tier 1 ceiling | Web mode is for functional testing; desktop for load |
| 2026-05-18 | Tier 3 is post-launch | Community demand should justify the 2-3 month investment |
| 2026-05-18 | Expanded Tier 1 from 6 to 16 items (1A-1P) | Second deep audit of 15 files (~2,500 lines) found 10 additional optimizations beyond original 6 |
| 2026-05-18 | `Promise.race` timeout leak is a bug | Dangling timers at scale add event loop noise; fix is trivial |
| 2026-05-18 | `graphLoadRunner` pool.indexOf bug | O(n) array scan per iteration completion; counter pattern is O(1) |
| 2026-05-18 | Vite proxy quadratic concatenation | `rawBody += chunk` is O(n²); `Buffer.concat` is O(n); high impact for large POST bodies |
| 2026-05-18 | Header caching is safe for all auth except OAuth2 | OAuth2 token rotates mid-run; cache base headers and inject token dynamically |
| 2026-05-18 | Conditional JSON.parse is safe | `buildValidationResult` and `validate()` already handle string `responseObj`; only `validateFields` and `evaluateAssertions` need parsed objects |
| 2026-05-18 | Template literal regex dedup saves real time | Workflows with 50+ variables cause 50 regex compilations per HTTP node; single combined regex is O(1) compilation |
| 2026-05-18 | Multi-worker stays Week 2-3 | Highest single impact but highest complexity; ship 1A-1O first to validate measurement baseline, then 1P on a clean foundation |
| 2026-05-18 | Workflow multi-worker deferred | Graph topology has cross-node dependencies (variable context, edge traversal); only iteration-level parallelism is safe in graphLoadRunner |
| 2026-05-18 | Keep `crypto.randomUUID` in Tauri worker bridge | Request IDs in `executionWorker.ts` L30 must be globally unique across main↔worker; monotonic counters would collide |
| 2026-05-18 | Tier 2 revised: sidecar → `#[tauri::command]` | Re-evaluation found sidecar overkill. In-process Rust executor is simpler (same Cargo.toml), has faster IPC (Tauri invoke vs stdin/stdout), and takes ~2 weeks vs ~4 weeks. Validation in Rust (2D) removed from Tier 2 — moved to Tier 3A. |
| 2026-05-18 | OAuth2 auth deferred in Rust executor | Token management (`tokenManager.ts`) is JS-side with in-memory caching and refresh logic. For Tier 2, OAuth2 scenarios fall back to JS executor. Tier 3 can add Rust token management. |
| 2026-05-18 | Tier 2 re-evaluation: 12 gaps found | Deep audit of all execution types (TestConfig, Scenario, RequestResult, LoadProfileConfig, ProgressMeta, AuthConfig) against Rust plan found: missing think time, circuit breaker, retry logic, weighted scenario iterator, request log, timing breakdown, data row fields, response body cap mismatch, streaming validation timing, load profile ramp/spike logic, `invoke`/`listen` not yet imported, and `RustScenario.headers` should be `HashMap` not `Vec<HeaderPair>` since JS pre-resolves headers. All 12 gaps addressed. |
| 2026-05-18 | Pre-resolve scenarios in JS, not Rust | `buildHeaders()`, `buildUrl()`, `serializeWithContentType()`, `resolveAuthHeaders()` are complex JS functions with form-data boundary generation, API key query injection, and auth type resolution. Duplicating in Rust is high-effort and error-prone. Instead, JS calls `prepareScenario()` for each scenario before invoking Rust. Rust receives fully-prepared data. |
| 2026-05-18 | Streaming validation, not batch-at-end | If validation only runs after test completes, the UI shows no pass/fail during execution. Validate each `load-test-progress` batch as it arrives (~100ms intervals) to match current JS executor UX. |
| 2026-05-18 | Circuit breaker in Rust, not JS | Breaker must react within the hot loop. If breaker logic is JS-side (via progress events), there's ~100ms latency before stopping. Rust-side breaker with atomic counters reacts instantly. `ProgressBatch.breaker_tripped` informs JS to stop UI updates. |
| 2026-05-18 | Tier 3A re-evaluation: 11 findings | Deep audit of validation engine found: (1) `buildValidationResult()` is a critical combination layer missing from plan — added as Step 5A with exact logic; (2) `validate()` does NOT use `selectiveMode`, `excludedPaths`, `sampleJson`, `responseVersions`, `rulesVersions`, or `assertions` fields — removed from Rust `ValidationConfig`; (3) HTTP failure overlay DROPS json_failures (intentional); (4) `tryRemapPaths()` heuristic was missing — added to Step 5; (5) any mode not 'none'/'full' falls through to selective; (6) `deepSubsetMatch` arrays are existential/unordered (not positional); (7) `exists`/`not_exists` treats null as "exists"; (8) header value comparison is exact (no case-fold); (9) `is_true`/`is_false` are case-sensitive; (10) `equals` uses JSON.stringify normalization not reference equality; (11) `close_to` default tolerance is 0.01. Dependency graph updated to include all 11 new Rust modules. |
| 2026-05-18 | Tier 3A Sub-Group A complete | `validation_types.rs` (341 LOC, 39 serde tests) + `json_path.rs` (189 LOC, 67 tests). 9 rounds of adversarial re-evaluation — 0 bugs found. serde `rename_all` + explicit `rename` interaction verified, JSONPath parity confirmed for all edge cases (wildcards, brackets, $-prefix, multi-byte UTF-8, leading-zero indices). |
| 2026-05-18 | Tier 3A Sub-Group B complete | 4 leaf helpers: `deep_compare.rs` (164 LOC, 28 tests), `subset_match.rs` (120 LOC, 20 tests), `http_helpers.rs` (139 LOC, 38 tests), `date_helpers.rs` (69 LOC, 23 tests). 9 rounds of adversarial re-evaluation found 7 bugs: (1) deep_compare Array-vs-Object JS typeof parity; (2) Object-expected/Array-actual needed index-as-string-key helper; (3) Array `length` property via `MaybeOwned` enum; (4) `matches_status_pattern` vacuous truth on empty range boundary; (5) `matches_status_pattern` u16 overflow to u32; (6) `to_day_string` float epoch millis fallback; (7) `truncate_to_unit` negative millis `div_euclid` for Math.floor parity. All fixed with tests. |
| 2026-05-18 | Tier 3A Sub-Group C re-evaluation: 8 findings | Deep audit of field_operator + assertion_evaluator plan against JS source found: (1) `is_false` does NOT check `=== 0` — only `false` and `"false"` (plan was wrong); (2) `stringify()` for strings returns raw string not JSON-quoted — JS line 21 `if typeof val === 'string' return val`; (3) `exists`/`not_exists` need `Option<&Value>` to distinguish null-at-path from path-not-found (undefined); (4) `compare()` and `format_op()` helper functions were missing from plan — needed by 6 assertion types; (5) `regex` assertion truncates actual to 200 chars in failure message (JS line 365); (6) `jsonSchema` path format includes assertion loop index `_ai`: `(jsonSchema#0:...)` not `(jsonSchema:...)`; (7) `bodySize` has fallback body source (`rawBody ?? JSON.stringify(responseBody)`) and display rounding (`Math.round * 100 / 100`); (8) `datePrecise.reference` is a raw string, not `DateReference` enum — requires chrono date parsing. Test scenarios expanded from ~40 to ~55 for assertion_evaluator and from ~25 to ~65 for field_operator. |
| 2026-05-19 | Tier 1P re-evaluation: 3 bugs found & fixed | (1) **Load-profile concurrency multiplication**: multi-worker mode divided `config.concurrency` per worker but left `loadProfile.maxConcurrency` unchanged — each worker launched full concurrency, causing N× intended load. Fixed: divide `maxConcurrency` and `spikeConcurrency` per worker in `workerBridge.ts`. (2) **Duplicate result IDs**: all workers called `resetResultIdCounter()` producing `r-1, r-2, ...` — colliding IDs across workers. Fixed: `resetResultIdCounter(workerIndex)` prefixes IDs as `w0-1, w1-1, ...` via `requestExecution.ts` + `executor.ts` + `executionWorker.ts`. (3) **CLI ProgressMeta not accepted**: CLI progress handler used 3-arg signature, ignoring `ProgressMeta`. Fixed: accept meta in `cli/index.ts`, show RPS and concurrency for load-profile runs. |
| 2026-05-19 | Phase 3A Sub-Group D complete | `json_validator.rs` (508 LOC, 56 tests), `validation_result.rs` (100 LOC, 38 tests), `cross_module_test.rs` (21 integration tests), executor wiring, JS bridge (90 TS tests), 15 perf benchmarks. Total validation engine: 2,799 LOC production + 5,277 LOC tests + 90 TS bridge tests. |
| 2026-05-19 | Re-evaluation round 3: 3 bugs found & fixed | (1) **Rust validation on truncated body**: `execute_one` capped body to 2000 chars BEFORE `validate_result` — large JSON responses would fail validation in Rust but pass in JS. Fixed: `validate_and_cap()` validates full body then caps for storage. (2) **Rust circuit breaker error definition**: used `http_status >= 400 \|\| !passed`, but JS uses `!passed` only — a 404 expected by status assertion would incorrectly trip the breaker in Rust. Fixed: breaker records error based on `!result.passed.unwrap_or(true)` only, matching JS semantics. (3) **Multi-worker ceil-division overshoot**: `ceil(maxConcurrency / workerCount)` per worker could sum above target (e.g. 8 target with 7 workers → 14 actual). Fixed: fair distribution using `floor + remainder` ensuring sum equals exactly the configured `maxConcurrency`. |
| 2026-05-19 | Re-evaluation round 4: 2 bugs found & fixed | (1) **Rust load-profile semaphore replacement on concurrency change**: when spike window ended and target dropped (e.g. 300→100), creating a new semaphore allowed producer to launch `target` MORE tasks while old ones held permits on the old semaphore — total in-flight could reach `old + new` instead of `new`. Fixed: replaced semaphore-based concurrency control with atomic `in_flight` counter check (matching JS `while (inFlight < target)` pattern). (2) **Multi-worker ProgressMeta not aggregated**: `currentInFlight` and `targetConcurrency` from last-reporting-worker-only caused UI to show ~1/N of actual concurrency. Fixed: aggregate `currentInFlight`, `targetConcurrency`, and `elapsedMs` across all workers before forwarding to `onProgress`. |
| 2026-05-19 | Re-evaluation round 5: 1 bug found & fixed | **Rust in_flight counter race in run_load_profile**: `in_flight.fetch_add(1)` was inside the spawned task (async) instead of the producer loop (synchronous). Between the `current_in_flight >= target` check and the increment, the producer could spawn another task, causing a brief overshoot of 1. JS avoids this because `inFlight++` is synchronous before async work. Fixed: moved `fetch_add(1)` to producer loop before `tokio::spawn`, matching JS pattern exactly. Also audited all Tier 1 JS implementations (1D, 1E, 1F, 1I, 1K, 1M) — all confirmed correct with no bugs. |
| 2026-05-19 | Re-evaluation round 6: 1 bug found & fixed | **Pool concurrency ceil-division overshoot in multi-worker mode**: `perWorkerConcurrency = Math.ceil(config.concurrency / workerCount)` applied to ALL workers caused the same overshoot previously fixed for load-profile. E.g., concurrency=10 with 3 workers → ceil(10/3)=4 per worker → 12 total (20% overshoot). Fixed: applied the same fair-distribution algorithm (`floor + remainder`) used for load-profile `maxConcurrency` — guarantees sum equals exactly the configured concurrency. Also re-audited: Rust `run_pool` (semaphore, validate_and_cap, breaker), `run_load_profile` (atomic in_flight, back-pressure), `commands.rs` (all 3 mode dispatches), `execute_with_retry` (full-body retention), `rustBridge.ts` (serde contract parity), `useTestExecution.ts` (Rust→worker→direct dispatch). All confirmed correct. |
