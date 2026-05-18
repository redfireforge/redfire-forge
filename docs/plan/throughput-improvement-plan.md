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
  1L  Pre-allocate result arrays          [—]       ⊘ SKIP — marginal gain, not worth the complexity

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
| Validation (`buildValidationResult`) | 24-operator evaluator stays in JS — runs on batched results after Rust returns |
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

#### ~~2E. Validation in Rust~~ — REMOVED

Validation stays in JS for Tier 2. Rationale:
- The 24-operator evaluator, JSONPath engine, custom expressions, and DSL parser are 3,000+ lines
- Porting to Rust would take 2-3 weeks alone and duplicate logic that must stay in sync
- HTTP I/O is the bottleneck, not CPU-bound validation
- Validation of batched results in JS is fast enough (the batch arrives every 100ms)
- Revisit only if profiling after Tier 2 shows validation > 20% of total time

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

#### 3A. Full Validation in Rust

- Port `evaluateAssertions` (24 operators) to Rust
- JSONPath evaluation via `jsonpath-rust` or `serde_json_path` crate
- Regex via `regex` crate
- Zero-copy validation: parse JSON once, validate in-place
- Eliminates JS post-processing overhead for high-throughput runs

#### 3B. Streaming Percentiles

- `hdrhistogram` crate for P50/P95/P99 without storing every datapoint
- Enables accurate metrics at 100K+ results without OOM
- Real-time streaming to UI via Tauri events

#### 3C. Constant Arrival Rate

- "Send exactly N requests/second regardless of response time" (open model)
- Automatic worker scaling with backpressure
- Queue-based request dispatching with `tokio::time::interval`
- This is k6's killer feature — essential for parity

#### 3D. Distributed Execution

- Controller/worker architecture
- Coordinate load across multiple machines/processes
- Break past single-machine limits
- Protocol: gRPC or WebSocket between controller and workers

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
