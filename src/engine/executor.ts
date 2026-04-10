import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestConfig, RequestResult, AuthConfig } from '../types';
import { validate } from './validator';

type ProgressCallback = (completed: number, total: number, results: RequestResult[]) => void;

interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

export async function proxyFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<ProxyResponse> {
  const resp = await fetch('/__proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method, headers, body }),
  });
  return resp.json();
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
      // Skip manual Authorization header when OAuth2 is active (token will be set automatically)
      if (h.key.trim().toLowerCase() === 'authorization' && scenario.auth.type !== 'none') {
        continue;
      }
      headers[h.key.trim()] = h.value;
    }
  }
  if (scenario.auth.type === 'basic' && scenario.auth.username) {
    const encoded = btoa(`${scenario.auth.username}:${scenario.auth.password ?? ''}`);
    headers['Authorization'] = `Basic ${encoded}`;
  }
  if (scenario.auth.type === 'oauth2' && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (scenario.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
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
    const result = await proxyFetch(scenario.url, scenario.method, headers, reqBody);

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

  // Build request queue based on weights, guaranteeing each scenario with
  // weight > 0 appears at least once.
  const activeWeights = config.scenarioWeights.filter((w) => w.weight > 0);
  const totalWeight = activeWeights.reduce((s, w) => s + w.weight, 0);
  const effectiveTotal = Math.max(config.totalTransactions, activeWeights.length);
  const queue: Scenario[] = [];

  // First pass: give every active scenario at least 1 slot
  const counts = new Map<string, number>();
  let allocated = 0;
  for (const sw of activeWeights) {
    counts.set(sw.scenarioId, 1);
    allocated++;
  }
  // Second pass: distribute the remaining slots by weight
  const remaining = effectiveTotal - allocated;
  if (remaining > 0 && totalWeight > 0) {
    for (const sw of activeWeights) {
      const extra = Math.round((sw.weight / totalWeight) * remaining);
      counts.set(sw.scenarioId, (counts.get(sw.scenarioId) ?? 0) + extra);
    }
  }

  for (const sw of activeWeights) {
    const scenario = scenarios.find((s) => s.id === sw.scenarioId);
    if (!scenario) continue;
    const count = counts.get(sw.scenarioId) ?? 1;
    for (let i = 0; i < count; i++) {
      queue.push(scenario);
    }
  }
  // Adjust to exact total
  while (queue.length < effectiveTotal && scenarios.length > 0) {
    queue.push(scenarios[0]);
  }
  while (queue.length > effectiveTotal) {
    queue.pop();
  }

  // Shuffle for realistic distribution
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  // Execute in batches
  const allResults: RequestResult[] = [];
  let completed = 0;

  for (let i = 0; i < queue.length; i += config.concurrency) {
    if (abortSignal?.aborted) break;

    const batch = queue.slice(i, i + config.concurrency);
    const batchPromises = batch.map((scenario) => {
      const headers = buildHeaders(scenario, tokenMap.get(scenario.id));
      return executeRequest(scenario, headers);
    });

    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);
    completed += batchResults.length;
    onProgress(completed, config.totalTransactions, allResults);
  }

  return allResults;
}
