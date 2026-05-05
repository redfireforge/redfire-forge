import type { TestConfig, Scenario, RequestResult } from '../shared/types';
import { httpFetch, type HttpResponse } from '../shared/utils/httpClient';
import { getEffectiveBodyType } from '../shared/utils/bodySerializer';
import { resolveAuthHeaders } from '../shared/utils/authHeaders';
import { TokenManager } from './tokenManager';
import { CircuitBreaker } from './circuitBreaker';
import { runSequential, runBatch, runPool, type RunOpts } from './requestExecution';
import { runLoadProfile } from './loadProfileRunner';
import { createThinkTimeDelay } from './thinkTime';
import { runWorkflow, runWorkflowLoad, VariableContext } from '../features/workflow/engine';
import { expandQueue } from './dataSourceExpander';

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

export function buildHeaders(scenario: Scenario, token?: string, contentType?: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const h of scenario.headers) {
    if (h.key.trim()) {
      if (h.key.trim().toLowerCase() === 'authorization' && scenario.auth.type !== 'none') {
        continue;
      }
      headers[h.key.trim()] = h.value;
    }
  }
  Object.assign(headers, resolveAuthHeaders(scenario.auth, token));
  const bt = getEffectiveBodyType(scenario);
  if (contentType) {
    if (bt === 'form-data') {
      headers['Content-Type'] = contentType;
    } else if (!headers['Content-Type']) {
      headers['Content-Type'] = contentType;
    }
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
export { CircuitBreaker } from './circuitBreaker';
export { getTargetConcurrency } from './loadProfileRunner';

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

  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  // Expand data sources — replace parameterized scenarios with per-row resolved copies
  const expandedQueue = expandQueue(queue);

  // Cap expanded queue at the configured total — "transactions" means total HTTP requests
  if (total > 0 && expandedQueue.length > total) {
    expandedQueue.length = total;
  }

  const mode = config.executionMode ?? 'batch';
  const getThinkTimeMs = createThinkTimeDelay(config.thinkTime);
  const opts: RunOpts = { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal, getThinkTimeMs };

  if (mode === 'workflow') {
    const ctx = new VariableContext(config.workflowVariables);
    const iterations = config.totalTransactions || 1;
    if (iterations <= 1) {
      return runWorkflow(scenarios, opts, ctx);
    }
    return runWorkflowLoad(scenarios, iterations, config.concurrency, opts, ctx);
  }
  if (mode === 'load-profile' && config.loadProfile) {
    return runLoadProfile(config.loadProfile, scenarios, config.scenarioWeights, opts);
  }
  if (mode === 'sequential') {
    return runSequential(expandedQueue, opts);
  }
  if (mode === 'pool') {
    return runPool(expandedQueue, config.concurrency, opts);
  }
  return runBatch(expandedQueue, config.concurrency, opts);
}
