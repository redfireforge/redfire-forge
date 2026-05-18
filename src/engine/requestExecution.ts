import { v4 as uuidv4 } from 'uuid';
import type { Scenario, RequestResult, TimingBreakdown } from '../shared/types';
import { httpFetch, type HttpResponse } from '../shared/utils/httpClient';
import { serializeWithContentType } from '../shared/utils/bodySerializer';
import { buildHeaders, buildUrl, type ProgressMeta } from './executor';
import type { TokenManager } from './tokenManager';
import { CircuitBreaker } from './circuitBreaker';
import { applyThinkTime } from './thinkTime';
import { buildValidationResult } from './validationResult';

async function executeRequest(
  scenario: Scenario,
  headers: Record<string, string>,
  reqBody: string | undefined,
  timeoutMs?: number
): Promise<RequestResult> {
  const id = uuidv4();
  const start = performance.now();
  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let responseHeaders: Record<string, string> = {};
  let errorMessage: string | undefined;
  let timing: TimingBreakdown | undefined;

  try {
    const url = buildUrl(scenario);

    let resultPromise: Promise<HttpResponse> = httpFetch(url, scenario.method, headers, reqBody);

    if (timeoutMs && timeoutMs > 0) {
      const timeoutPromise = new Promise<HttpResponse>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout (${(timeoutMs / 1000).toFixed(0)}s)`)), timeoutMs);
      });
      resultPromise = Promise.race([resultPromise, timeoutPromise]);
    }

    const result = await resultPromise;
    timing = result.timing;

    if (result.error) {
      httpStatus = 0;
      errorMessage = result.error;
    } else {
      httpStatus = result.status;
      responseBody = result.body;
      responseHeaders = result.headers;
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

  // Extract error message from response body for HTTP failures (load-test specific)
  const httpFailed = (httpStatus >= 400 || httpStatus === 0);
  if (httpFailed && !errorMessage && responseBody) {
    try {
      const parsed = typeof responseObj === 'object' && responseObj !== null ? responseObj as Record<string, unknown> : null;
      const raw = parsed?.message ?? parsed?.error ?? parsed?.detail ?? parsed?.errorMessage;
      if (typeof raw === 'string') errorMessage = raw;
      else if (raw != null) errorMessage = JSON.stringify(raw);
      else errorMessage = responseBody.slice(0, 300);
    } catch {
      errorMessage = responseBody.slice(0, 300);
    }
  }

  const assertions = scenario.validation.assertions ?? [];
  const vr = buildValidationResult({
    httpStatus, responseTimeMs, responseHeaders, responseBody, responseObj,
    errorMessage, validation: scenario.validation, assertions,
  });

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
    responseBody: responseBody.slice(0, 2000),
    responseHeaders,
    timestamp: Date.now(),
    passed: vr.passed,
    validationMode: scenario.validation.mode,
    failureDetails: vr.failureDetails,
    errorMessage: vr.errorMessage,
    timing,
    requestLog: { headers, body: reqBody },
    dataRowId: scenario.dataRowId,
    dataRowLabel: scenario.dataRowLabel,
  };
}

async function executeWithRetry(
  scenario: Scenario,
  headers: Record<string, string>,
  reqBody: string | undefined,
  timeoutMs?: number,
  retryCount = 0,
  retryDelayMs = 1000
): Promise<RequestResult> {
  let result = await executeRequest(scenario, headers, reqBody, timeoutMs);
  let attempt = 0;
  while (!result.passed && attempt < retryCount) {
    attempt++;
    if (retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
    result = await executeRequest(scenario, headers, reqBody, timeoutMs);
  }
  if (attempt > 0) {
    result.errorMessage = result.passed
      ? undefined
      : `${result.errorMessage ?? 'Failed'} (after ${attempt + 1} attempts)`;
  }
  return result;
}

export interface RunOpts {
  tokenManager: TokenManager;
  timeoutMs?: number;
  retryCount: number;
  retryDelayMs: number;
  breaker: CircuitBreaker;
  onProgress: (completed: number, total: number, results: RequestResult[], meta?: ProgressMeta) => void;
  abortSignal?: AbortSignal;
  getThinkTimeMs: () => number;
}

export async function runSequential(queue: Scenario[], opts: RunOpts): Promise<RequestResult[]> {
  const { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal, getThinkTimeMs } = opts;
  const allResults: RequestResult[] = [];

  for (const scenario of queue) {
    if (abortSignal?.aborted || breaker.shouldStop) break;
    const { body: reqBody, contentType } = serializeWithContentType(scenario);
    const token = await tokenManager.getToken(scenario);
    const headers = buildHeaders(scenario, token, contentType);
    const result = await executeWithRetry(scenario, headers, reqBody, timeoutMs, retryCount, retryDelayMs);
    allResults.push(result);
    breaker.record(result);
    onProgress(allResults.length, queue.length, allResults);
    await applyThinkTime(getThinkTimeMs, abortSignal);
  }

  return allResults;
}

export async function runBatch(queue: Scenario[], concurrency: number, opts: RunOpts): Promise<RequestResult[]> {
  const { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal, getThinkTimeMs } = opts;
  const allResults: RequestResult[] = [];
  let completed = 0;

  for (let i = 0; i < queue.length; i += concurrency) {
    if (abortSignal?.aborted || breaker.shouldStop) break;

    const batch = queue.slice(i, i + concurrency);
    const batchPromises = batch.map(async (scenario) => {
      const { body: reqBody, contentType } = serializeWithContentType(scenario);
      const token = await tokenManager.getToken(scenario);
      const headers = buildHeaders(scenario, token, contentType);
      return executeWithRetry(scenario, headers, reqBody, timeoutMs, retryCount, retryDelayMs);
    });

    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);
    batchResults.forEach((r) => breaker.record(r));
    completed += batchResults.length;
    onProgress(completed, queue.length, allResults, {
      elapsedMs: 0,
      targetConcurrency: concurrency,
      currentInFlight: Math.min(concurrency, queue.length - completed),
      durationMs: 0,
    });
    await applyThinkTime(getThinkTimeMs, abortSignal);
  }

  return allResults;
}

export async function runPool(queue: Scenario[], concurrency: number, opts: RunOpts): Promise<RequestResult[]> {
  const { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal, getThinkTimeMs } = opts;
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
        const { body: reqBody, contentType } = serializeWithContentType(scenario);
        tokenManager.getToken(scenario).then((token) => {
          const headers = buildHeaders(scenario, token, contentType);
          return executeWithRetry(scenario, headers, reqBody, timeoutMs, retryCount, retryDelayMs);
        }).then((result) => {
          allResults.push(result);
          breaker.record(result);
        }).catch((err) => {
          const errorResult: RequestResult = {
            id: `err-${Date.now()}`,
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
            failureDetails: [{ path: '(error)', expected: 'success', actual: err instanceof Error ? err.message : String(err) }],
            errorMessage: err instanceof Error ? err.message : String(err),
            responseHeaders: {},
            requestLog: { headers: {}, body: reqBody },
          };
          allResults.push(errorResult);
          breaker.record(errorResult);
        }).finally(() => {
          inFlight--;
          onProgress(allResults.length, total, allResults, {
            elapsedMs: 0,
            targetConcurrency: concurrency,
            currentInFlight: inFlight,
            durationMs: 0,
          });
          if (allResults.length >= total || abortSignal?.aborted || breaker.shouldStop) {
            resolve(allResults);
          } else {
            applyThinkTime(getThinkTimeMs, abortSignal).then(launch);
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

export { executeWithRetry };
