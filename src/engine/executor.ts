import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestConfig, RequestResult, AuthConfig, LoadProfileConfig, ScenarioWeight, ErrorPolicy } from '../types';
import { validate } from './validator';
import { httpFetch, type HttpResponse } from '../utils/httpClient';

export interface ProgressMeta {
  elapsedMs: number;
  targetConcurrency: number;
  currentInFlight: number;
  durationMs: number;
}

type ProgressCallback = (completed: number, total: number, results: RequestResult[], meta?: ProgressMeta) => void;

export async function proxyFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  return httpFetch(url, method, headers, body);
}

export async function acquireOAuth2Token(auth: AuthConfig): Promise<string> {
  if (!auth.tokenUrl || !auth.clientId || !auth.clientSecret) {
    throw new Error('OAuth2 requires tokenUrl, clientId, and clientSecret');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
  });
  const result = await proxyFetch(
    auth.tokenUrl,
    'POST',
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    body.toString()
  );
  if (result.error) {
    throw new Error(`OAuth2 token request failed: ${result.error}`);
  }
  if (result.status >= 400) {
    throw new Error(`OAuth2 token request failed: ${result.status} ${result.statusText} - ${result.body}`);
  }
  const data = JSON.parse(result.body);
  return data.access_token;
}

// ---------------------------------------------------------------------------
// TokenManager — shared, auto-refreshing OAuth2 token cache
// ---------------------------------------------------------------------------

const TOKEN_EXPIRY_BUFFER_SEC = 30;

function parseJwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

interface CachedToken {
  token: string;
  expiresSec: number;
}

export class TokenManager {
  private cache = new Map<string, CachedToken>();
  private pending = new Map<string, Promise<string>>();

  private credKey(auth: AuthConfig): string {
    return `${auth.tokenUrl}|${auth.clientId}|${auth.clientSecret}`;
  }

  private isExpired(entry: CachedToken): boolean {
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= entry.expiresSec - TOKEN_EXPIRY_BUFFER_SEC;
  }

  async getToken(scenario: Scenario): Promise<string | undefined> {
    if (scenario.auth.type !== 'oauth2') return undefined;

    const key = this.credKey(scenario.auth);
    const cached = this.cache.get(key);
    if (cached && !this.isExpired(cached)) return cached.token;

    // If another call is already refreshing this credential, wait for it
    const inflight = this.pending.get(key);
    if (inflight) return inflight;

    const refreshPromise = this.refresh(key, scenario.auth);
    this.pending.set(key, refreshPromise);
    try {
      return await refreshPromise;
    } finally {
      this.pending.delete(key);
    }
  }

  private async refresh(key: string, auth: AuthConfig): Promise<string> {
    const token = await acquireOAuth2Token(auth);
    const exp = parseJwtExpiry(token);
    const expiresSec = exp ?? Math.floor(Date.now() / 1000) + 1800;
    this.cache.set(key, { token, expiresSec });
    return token;
  }
}

export function buildHeaders(scenario: Scenario, token?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const h of scenario.headers) {
    if (h.key.trim()) {
      if (h.key.trim().toLowerCase() === 'authorization' && scenario.auth.type !== 'none') {
        continue;
      }
      headers[h.key.trim()] = h.value;
    }
  }
  const auth = scenario.auth;
  if (auth.type === 'basic' && auth.username) {
    const encoded = btoa(`${auth.username}:${auth.password ?? ''}`);
    headers['Authorization'] = `Basic ${encoded}`;
  }
  if (auth.type === 'bearer' && auth.token) {
    const prefix = auth.prefix?.trim() || 'Bearer';
    headers['Authorization'] = `${prefix} ${auth.token}`;
  }
  if (auth.type === 'apikey' && auth.apiKeyName && auth.apiKeyValue) {
    if (auth.apiKeyIn === 'header') {
      headers[auth.apiKeyName] = auth.apiKeyValue;
    }
  }
  if (auth.type === 'digest' && auth.username) {
    const encoded = btoa(`${auth.username}:${auth.password ?? ''}`);
    headers['Authorization'] = `Basic ${encoded}`;
  }
  if (auth.type === 'oauth2' && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (scenario.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export function buildUrl(scenario: Scenario): string {
  const auth = scenario.auth;
  if (auth.type === 'apikey' && auth.apiKeyIn === 'query' && auth.apiKeyName && auth.apiKeyValue) {
    const url = new URL(scenario.url);
    url.searchParams.set(auth.apiKeyName, auth.apiKeyValue);
    return url.toString();
  }
  return scenario.url;
}

async function executeRequest(
  scenario: Scenario,
  headers: Record<string, string>,
  timeoutMs?: number
): Promise<RequestResult> {
  const id = uuidv4();
  const start = performance.now();
  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let errorMessage: string | undefined;

  try {
    const reqBody = (scenario.body && scenario.method !== 'GET') ? scenario.body : undefined;
    const url = buildUrl(scenario);

    let resultPromise: Promise<HttpResponse> = proxyFetch(url, scenario.method, headers, reqBody);

    if (timeoutMs && timeoutMs > 0) {
      const timeoutPromise = new Promise<HttpResponse>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout (${(timeoutMs / 1000).toFixed(0)}s)`)), timeoutMs);
      });
      resultPromise = Promise.race([resultPromise, timeoutPromise]);
    }

    const result = await resultPromise;

    if (result.error) {
      httpStatus = 0;
      errorMessage = result.error;
    } else {
      httpStatus = result.status;
      responseBody = result.body;
      try {
        responseObj = JSON.parse(responseBody);
      } catch {
        responseObj = responseBody;
      }
    }
  } catch (err) {
    httpStatus = 0;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const responseTimeMs = Math.round((performance.now() - start) * 100) / 100;

  // Validate
  let failureDetails = scenario.validation.mode !== 'none' && httpStatus > 0 && httpStatus < 400
    ? validate(scenario.validation, responseObj)
    : [];

  const httpFailed = httpStatus >= 400 || httpStatus === 0;
  if (httpFailed && !errorMessage && responseBody) {
    try {
      const parsed = typeof responseObj === 'object' && responseObj !== null ? responseObj as Record<string, unknown> : null;
      errorMessage = (parsed?.message ?? parsed?.error ?? parsed?.detail ?? parsed?.errorMessage) as string | undefined
        || responseBody.slice(0, 300);
    } catch {
      errorMessage = responseBody.slice(0, 300);
    }
  }
  if (httpFailed && errorMessage) {
    failureDetails = [{ path: '(http)', expected: '2xx', actual: errorMessage }];
  }

  const passed = !httpFailed && failureDetails.length === 0;

  return {
    id,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    featureGroupName: scenario.featureGroupName,
    groupName: scenario.groupName,
    url: scenario.url,
    method: scenario.method,
    httpStatus,
    responseTimeMs,
    responseBody: responseBody.slice(0, 2000), // truncate for storage
    timestamp: Date.now(),
    passed,
    validationMode: scenario.validation.mode,
    failureDetails,
    errorMessage,
  };
}

// ---------------------------------------------------------------------------
// Retry wrapper
// ---------------------------------------------------------------------------

async function executeWithRetry(
  scenario: Scenario,
  headers: Record<string, string>,
  timeoutMs?: number,
  retryCount = 0,
  retryDelayMs = 1000
): Promise<RequestResult> {
  let result = await executeRequest(scenario, headers, timeoutMs);
  let attempt = 0;
  while (!result.passed && attempt < retryCount) {
    attempt++;
    if (retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
    result = await executeRequest(scenario, headers, timeoutMs);
  }
  if (attempt > 0) {
    result.errorMessage = result.passed
      ? undefined
      : `${result.errorMessage ?? 'Failed'} (after ${attempt + 1} attempts)`;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Circuit Breaker — tracks errors and decides whether to stop
// ---------------------------------------------------------------------------

class CircuitBreaker {
  private errorCount = 0;
  private totalCount = 0;
  private tripped = false;

  constructor(
    private policy: ErrorPolicy = 'continue',
    private maxErrors: number = 10,
    private maxErrorRate: number = 50,
    private minSampleSize: number = 10
  ) {}

  record(result: RequestResult): void {
    this.totalCount++;
    if (!result.passed) this.errorCount++;
    if (this.policy === 'continue') return;
    if (this.policy === 'stop-first' && !result.passed) {
      this.tripped = true;
      return;
    }
    if (this.policy === 'stop-threshold') {
      if (this.errorCount >= this.maxErrors) { this.tripped = true; return; }
      if (this.totalCount >= this.minSampleSize) {
        const rate = (this.errorCount / this.totalCount) * 100;
        if (rate >= this.maxErrorRate) this.tripped = true;
      }
    }
  }

  get shouldStop(): boolean { return this.tripped; }
  get reason(): string {
    if (this.policy === 'stop-first') return 'Stopped: first error encountered';
    if (this.errorCount >= this.maxErrors) return `Stopped: ${this.errorCount} errors reached max (${this.maxErrors})`;
    return `Stopped: error rate ${((this.errorCount / this.totalCount) * 100).toFixed(1)}% exceeded ${this.maxErrorRate}%`;
  }
}

export async function runTest(
  config: TestConfig,
  scenarios: Scenario[],
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<RequestResult[]> {
  const tokenManager = new TokenManager();
  const timeoutMs = (config.timeoutSec ?? 0) > 0 ? (config.timeoutSec! * 1000) : undefined;
  const retryCount = config.retryCount ?? 0;
  const retryDelayMs = config.retryDelayMs ?? 1000;
  const breaker = new CircuitBreaker(
    config.errorPolicy ?? 'continue',
    config.maxErrors ?? 10,
    config.maxErrorRate ?? 50
  );

  // Build request queue: distribute totalTransactions across active scenarios by weight.
  const activeWeights = config.scenarioWeights.filter((w) => w.weight > 0);
  const totalWeight = activeWeights.reduce((s, w) => s + w.weight, 0);
  const total = config.totalTransactions;
  const queue: Scenario[] = [];

  if (total >= activeWeights.length) {
    const counts = new Map<string, number>();
    for (const sw of activeWeights) counts.set(sw.scenarioId, 1);
    const remaining = total - activeWeights.length;
    if (remaining > 0 && totalWeight > 0) {
      for (const sw of activeWeights) {
        const extra = Math.round((sw.weight / totalWeight) * remaining);
        counts.set(sw.scenarioId, (counts.get(sw.scenarioId) ?? 0) + extra);
      }
    }
    for (const sw of activeWeights) {
      const scenario = scenarios.find((s) => s.id === sw.scenarioId);
      if (!scenario) continue;
      for (let i = 0; i < (counts.get(sw.scenarioId) ?? 1); i++) queue.push(scenario);
    }
  } else {
    const sorted = [...activeWeights].sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return Math.random() - 0.5;
    });
    const picked = sorted.slice(0, total);
    for (const sw of picked) {
      const scenario = scenarios.find((s) => s.id === sw.scenarioId);
      if (scenario) queue.push(scenario);
    }
  }
  while (queue.length < total && scenarios.length > 0) queue.push(scenarios[0]);
  while (queue.length > total) queue.pop();

  // Shuffle for realistic distribution
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  const mode = config.executionMode ?? 'batch';
  const opts: RunOpts = { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal };

  if (mode === 'load-profile' && config.loadProfile) {
    return runLoadProfile(config.loadProfile, scenarios, config.scenarioWeights, opts);
  }
  if (mode === 'sequential') {
    return runSequential(queue, opts);
  }
  if (mode === 'pool') {
    return runPool(queue, config.concurrency, opts);
  }
  return runBatch(queue, config.concurrency, opts);
}

interface RunOpts {
  tokenManager: TokenManager;
  timeoutMs?: number;
  retryCount: number;
  retryDelayMs: number;
  breaker: CircuitBreaker;
  onProgress: ProgressCallback;
  abortSignal?: AbortSignal;
}

async function runSequential(queue: Scenario[], opts: RunOpts): Promise<RequestResult[]> {
  const { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal } = opts;
  const allResults: RequestResult[] = [];

  for (const scenario of queue) {
    if (abortSignal?.aborted || breaker.shouldStop) break;
    const token = await tokenManager.getToken(scenario);
    const headers = buildHeaders(scenario, token);
    const result = await executeWithRetry(scenario, headers, timeoutMs, retryCount, retryDelayMs);
    allResults.push(result);
    breaker.record(result);
    onProgress(allResults.length, queue.length, allResults);
  }

  return allResults;
}

async function runBatch(queue: Scenario[], concurrency: number, opts: RunOpts): Promise<RequestResult[]> {
  const { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal } = opts;
  const allResults: RequestResult[] = [];
  let completed = 0;

  for (let i = 0; i < queue.length; i += concurrency) {
    if (abortSignal?.aborted || breaker.shouldStop) break;

    const batch = queue.slice(i, i + concurrency);
    const batchPromises = batch.map(async (scenario) => {
      const token = await tokenManager.getToken(scenario);
      const headers = buildHeaders(scenario, token);
      return executeWithRetry(scenario, headers, timeoutMs, retryCount, retryDelayMs);
    });

    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);
    batchResults.forEach((r) => breaker.record(r));
    completed += batchResults.length;
    onProgress(completed, queue.length, allResults);
  }

  return allResults;
}

async function runPool(queue: Scenario[], concurrency: number, opts: RunOpts): Promise<RequestResult[]> {
  const { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal } = opts;
  const allResults: RequestResult[] = [];
  let nextIdx = 0;
  let inFlight = 0;
  const total = queue.length;

  return new Promise((resolve) => {
    function launch() {
      while (inFlight < concurrency && nextIdx < total) {
        if (abortSignal?.aborted || breaker.shouldStop) break;
        const scenario = queue[nextIdx++];
        inFlight++;
        tokenManager.getToken(scenario).then((token) => {
          const headers = buildHeaders(scenario, token);
          return executeWithRetry(scenario, headers, timeoutMs, retryCount, retryDelayMs);
        }).then((result) => {
          allResults.push(result);
          breaker.record(result);
          inFlight--;
          onProgress(allResults.length, total, allResults);
          if (allResults.length >= total || abortSignal?.aborted || breaker.shouldStop) {
            resolve(allResults);
          } else {
            launch();
          }
        });
      }
      if (nextIdx >= total && inFlight === 0) {
        resolve(allResults);
      }
    }
    launch();
  });
}

// ---------------------------------------------------------------------------
// Load Profile Engine
// ---------------------------------------------------------------------------

export function getTargetConcurrency(profile: LoadProfileConfig, elapsedMs: number): number {
  const elapsed = elapsedMs / 1000;
  const { type, durationSec, maxConcurrency } = profile;

  if (elapsed >= durationSec) return 0;

  switch (type) {
    case 'sustained':
      return maxConcurrency;

    case 'ramp-up': {
      const rampSec = profile.rampUpSec ?? durationSec;
      if (elapsed >= rampSec) return maxConcurrency;
      const t = elapsed / rampSec;
      return Math.max(1, Math.ceil(1 + (maxConcurrency - 1) * t));
    }

    case 'spike': {
      const spikeStart = profile.spikeStartSec ?? Math.floor(durationSec * 0.3);
      const spikeDur = profile.spikeDurationSec ?? Math.ceil(durationSec * 0.2);
      const spikePeak = profile.spikeConcurrency ?? maxConcurrency * 3;
      if (elapsed >= spikeStart && elapsed < spikeStart + spikeDur) {
        return Math.max(1, spikePeak);
      }
      return Math.max(1, maxConcurrency);
    }

    default:
      return maxConcurrency;
  }
}

function buildWeightedIterator(
  scenarios: Scenario[],
  weights: ScenarioWeight[]
): () => Scenario {
  const active = weights.filter((w) => w.weight > 0);
  const pool: Scenario[] = [];
  for (const sw of active) {
    const sc = scenarios.find((s) => s.id === sw.scenarioId);
    if (sc) {
      for (let i = 0; i < sw.weight; i++) pool.push(sc);
    }
  }
  if (pool.length === 0 && scenarios.length > 0) {
    pool.push(scenarios[0]);
  }
  // Shuffle once
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let idx = 0;
  return () => {
    const sc = pool[idx % pool.length];
    idx++;
    return sc;
  };
}

async function runLoadProfile(
  profile: LoadProfileConfig,
  scenarios: Scenario[],
  weights: ScenarioWeight[],
  opts: RunOpts
): Promise<RequestResult[]> {
  const { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal } = opts;
  const allResults: RequestResult[] = [];
  let inFlight = 0;
  const durationMs = profile.durationSec * 1000;
  const startTime = performance.now();
  const nextScenario = buildWeightedIterator(scenarios, weights);

  return new Promise((resolve) => {
    let resolved = false;
    let timerStopped = false;

    function finish() {
      if (resolved) return;
      resolved = true;
      timerStopped = true;
      clearInterval(ticker);
      resolve(allResults);
    }

    function launchOne() {
      const scenario = nextScenario();
      inFlight++;
      tokenManager.getToken(scenario).then((token) => {
        const headers = buildHeaders(scenario, token);
        return executeWithRetry(scenario, headers, timeoutMs, retryCount, retryDelayMs);
      }).then((result) => {
        allResults.push(result);
        breaker.record(result);
        inFlight--;
        const elapsed = performance.now() - startTime;
        const target = getTargetConcurrency(profile, elapsed);
        onProgress(allResults.length, -1, allResults, {
          elapsedMs: elapsed,
          targetConcurrency: target,
          currentInFlight: inFlight,
          durationMs,
        });
        if (breaker.shouldStop) {
          timerStopped = true;
          if (inFlight === 0) finish();
          return;
        }
        if (timerStopped && inFlight === 0) {
          finish();
        } else if (!timerStopped) {
          fillPool();
        }
      });
    }

    function fillPool() {
      if (abortSignal?.aborted || breaker.shouldStop) {
        timerStopped = true;
        if (inFlight === 0) finish();
        return;
      }
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        timerStopped = true;
        if (inFlight === 0) finish();
        return;
      }
      const target = getTargetConcurrency(profile, elapsed);
      while (inFlight < target && !abortSignal?.aborted && !breaker.shouldStop) {
        launchOne();
      }
    }

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
        elapsedMs: elapsed,
        targetConcurrency: target,
        currentInFlight: inFlight,
        durationMs,
      });
    }, 500);

    fillPool();
  });
}
