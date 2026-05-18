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

### Tier 2 — Tauri Sidecar Executor (Pragmatic Leap)

**Target**: ~10,000+ RPS (desktop only)
**Effort**: 3-4 weeks
**Risk**: Medium — new Rust component, but isolated from existing JS

#### Architecture

```
Current (Tauri mode):
  Worker → postMessage → Main Thread → @tauri-apps/plugin-http → Response → postMessage → Worker
  Bottleneck: per-request IPC serialization, single connection pool

Proposed (Sidecar mode):
  Main Thread → Tauri Command → Rust Sidecar Process → Batched Results → Main Thread
  Advantage: dedicated process with native async runtime, batch IPC
```

#### 2A. Rust Sidecar Binary

**New file**: `src-tauri/sidecar/src/main.rs`

- Standalone Rust binary, spawned by Tauri as a sidecar process
- Accepts test plan as JSON via stdin or Tauri event
- Uses `reqwest::Client` + `tokio` async runtime for HTTP execution
- Connection pooling via `reqwest`'s built-in `hyper` pool (HTTP/1.1 + HTTP/2)
- Streams batched `RequestResult[]` back via stdout or Tauri events

```
[Rust Sidecar]
  ├── reqwest::Client (shared, with connection pool)
  ├── tokio::spawn per virtual user
  ├── Semaphore for concurrency control
  ├── Results channel → batch aggregator → emit every 100ms
  └── Supports: sequential, pool, batch, load-profile modes
```

#### 2B. Test Plan Protocol

Define a JSON protocol between JS and Rust:

```json
{
  "type": "start",
  "plan": {
    "mode": "load-profile",
    "profile": { "type": "sustained", "concurrency": 100, "durationSec": 60 },
    "scenarios": [...],
    "variables": {...},
    "auth": {...}
  }
}
```

Response stream:
```json
{ "type": "progress", "completed": 150, "results": [...batch of 50...] }
{ "type": "complete", "totalResults": 3000, "durationMs": 60000 }
```

#### 2C. JS Integration

**Files**: `src/engine/workerBridge.ts`, `src/engine/executor.ts`

- Detect Tauri + sidecar available → route to sidecar executor
- Fallback to current JS executor if sidecar unavailable
- Results mapping: Rust `RequestResult` → existing JS `RequestResult` type
- Validation can stay in JS (receive responses, validate in UI thread) or move to Rust

#### 2D. Validation in Rust (Optional)

- Port `evaluateAssertions` to Rust for zero-copy validation
- JSONPath evaluation via `jsonpath-rust` crate
- Regex via `regex` crate (already fast)
- Only needed if validation becomes the bottleneck after HTTP is offloaded

### Tier 3 — Full Rust Executor (Endgame)

**Target**: ~50,000+ RPS
**Effort**: 2-3 months
**Risk**: High — major engine rewrite
**Prerequisite**: Tier 2 sidecar proves the architecture

#### 3A. Native Rust HTTP Engine

- Full execution engine in Rust: `hyper`/`reqwest` + `tokio` async runtime
- Eliminates all JS overhead for HTTP execution
- Native TLS handling, HTTP/2 multiplexing
- Zero-copy response processing

#### 3B. Streaming Percentiles

- `hdrhistogram` crate for P50/P95/P99 without storing every datapoint
- Enables accurate metrics at 100K+ results without OOM
- Real-time streaming to UI via Tauri events

#### 3C. Constant Arrival Rate

- "Send exactly N requests/second regardless of response time" (open model)
- Automatic worker scaling with backpressure
- Queue-based request dispatching
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
Tier 2A   Week 4-5        ~8,000        Rust sidecar binary
Tier 2B   Week 5-6        ~8,000        Test plan protocol
Tier 2C   Week 6-7        ~10,000       JS integration + fallback
Tier 2D   Week 7-8        ~12,000       Validation in Rust (optional)
─── Tier 2 complete ─── ~10,000+ RPS (desktop) ──────────
Tier 3A   Month 3-4       ~30,000       Full Rust engine
Tier 3B   Month 4         ~30,000       Streaming percentiles
Tier 3C   Month 4-5       ~50,000       Constant arrival rate
Tier 3D   Month 5-6       ~50,000+      Distributed execution
─── Tier 3 complete ─── ~50,000+ RPS ────────────────────
```

---

## Positioning Impact

| Milestone | Positioning Statement |
|-----------|----------------------|
| **Today (v0.5.8)** | "Good for functional/integration testing and moderate load (up to 2K RPS). For heavy load testing, use k6 or Gatling." |
| **After Tier 1** | "Handles real-world API testing loads (6-8K RPS on multi-core). Competitive with Artillery and surpasses JMeter." |
| **After Tier 2** | "Desktop app delivers 10K+ RPS via native Rust executor. Visual workflow design that scales." |
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
| **RedfireForge (Tier 2)** | 10K+ | Rust sidecar + JS UI | **Full DAG** | Free |
| **RedfireForge (Tier 3)** | 50K+ | Full Rust + distributed | **Full DAG** | Free |

### Key Insight

Most users choosing RedfireForge over JMeter/Postman care about the **visual workflow + validation + catalog pipeline** — not raw RPS numbers. The users who need 50K RPS already know k6. Tier 1 makes us honest, Tier 2 makes us competitive, and Tier 3 is post-traction investment driven by community demand.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-18 | Tier 1 first, Tier 2 second | Low-risk optimizations before architectural change |
| 2026-05-18 | Sidecar over embedded Rust | Separate process avoids blocking Tauri main; own thread pool |
| 2026-05-18 | Validation stays in JS initially | Only move to Rust if validation becomes the bottleneck |
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
