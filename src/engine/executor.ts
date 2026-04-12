import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestConfig, RequestResult, AuthConfig } from '../types';
import { validate } from './validator';
import { httpFetch, type HttpResponse } from '../utils/httpClient';

type ProgressCallback = (completed: number, total: number, results: RequestResult[]) => void;

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
  headers: Record<string, string>
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
    const result = await proxyFetch(url, scenario.method, headers, reqBody);

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
  if (httpFailed && errorMessage) {
    failureDetails = [{ path: '(http)', expected: '2xx', actual: errorMessage }];
  }

  const passed = !httpFailed && failureDetails.length === 0;

  return {
    id,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
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

export async function runTest(
  config: TestConfig,
  scenarios: Scenario[],
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<RequestResult[]> {
  // Acquire OAuth2 tokens
  const tokenMap = new Map<string, string>();
  for (const scenario of scenarios) {
    if (scenario.auth.type === 'oauth2') {
      const token = await acquireOAuth2Token(scenario.auth);
      tokenMap.set(scenario.id, token);
    }
  }

  // Build request queue: distribute totalTransactions across active scenarios by weight.
  // If totalTransactions < active count, pick top-weighted scenarios (random tiebreak).
  const activeWeights = config.scenarioWeights.filter((w) => w.weight > 0);
  const totalWeight = activeWeights.reduce((s, w) => s + w.weight, 0);
  const total = config.totalTransactions;
  const queue: Scenario[] = [];

  if (total >= activeWeights.length) {
    // Enough slots: give each at least 1, distribute remainder by weight
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
    // Fewer slots than scenarios: pick top-weighted, shuffle ties randomly
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

  if (mode === 'sequential') {
    return runSequential(queue, tokenMap, onProgress, abortSignal);
  }
  if (mode === 'pool') {
    return runPool(queue, config.concurrency, tokenMap, onProgress, abortSignal);
  }
  return runBatch(queue, config.concurrency, tokenMap, onProgress, abortSignal);
}

async function runSequential(
  queue: Scenario[],
  tokenMap: Map<string, string>,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<RequestResult[]> {
  const allResults: RequestResult[] = [];

  for (const scenario of queue) {
    if (abortSignal?.aborted) break;
    const headers = buildHeaders(scenario, tokenMap.get(scenario.id));
    const result = await executeRequest(scenario, headers);
    allResults.push(result);
    onProgress(allResults.length, queue.length, allResults);
  }

  return allResults;
}

async function runBatch(
  queue: Scenario[],
  concurrency: number,
  tokenMap: Map<string, string>,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<RequestResult[]> {
  const allResults: RequestResult[] = [];
  let completed = 0;

  for (let i = 0; i < queue.length; i += concurrency) {
    if (abortSignal?.aborted) break;

    const batch = queue.slice(i, i + concurrency);
    const batchPromises = batch.map((scenario) => {
      const headers = buildHeaders(scenario, tokenMap.get(scenario.id));
      return executeRequest(scenario, headers);
    });

    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);
    completed += batchResults.length;
    onProgress(completed, queue.length, allResults);
  }

  return allResults;
}

async function runPool(
  queue: Scenario[],
  concurrency: number,
  tokenMap: Map<string, string>,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<RequestResult[]> {
  const allResults: RequestResult[] = [];
  let nextIdx = 0;
  let inFlight = 0;
  const total = queue.length;

  return new Promise((resolve) => {
    function launch() {
      while (inFlight < concurrency && nextIdx < total) {
        if (abortSignal?.aborted) break;
        const scenario = queue[nextIdx++];
        inFlight++;
        const headers = buildHeaders(scenario, tokenMap.get(scenario.id));
        executeRequest(scenario, headers).then((result) => {
          allResults.push(result);
          inFlight--;
          onProgress(allResults.length, total, allResults);
          if (allResults.length >= total || abortSignal?.aborted) {
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
