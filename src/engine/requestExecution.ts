import type { Scenario, RequestResult, TimingBreakdown } from '../shared/types';
import { buildGrpcHarnessRowTraceKey } from '../shared/grpc/grpcHarnessRowIdentity';
import { httpFetch } from '../shared/utils/httpClient';
import { serializeWithContentType } from '../shared/utils/bodySerializer';
import { buildHeaders, buildUrl, type ProgressMeta } from './executor';
import type { TokenManager } from './tokenManager';
import { CircuitBreaker } from './circuitBreaker';
import { applyThinkTime } from './thinkTime';
import { buildValidationResult } from './validationResult';
import { toErrorMessage, parseJsonOrRaw } from '../shared/utils/helpers';

let _resultIdCounter = 0;
let _resultIdPrefix = 'r';
export function resetResultIdCounter(workerIndex?: number): void {
  _resultIdCounter = 0;
  _resultIdPrefix = workerIndex != null ? `w${workerIndex}` : 'r';
}
export function nextResultId(): string { return `${_resultIdPrefix}-${++_resultIdCounter}`; }

export function buildErrorResult(scenario: Scenario, err: unknown, reqBody?: string): RequestResult {
  const msg = toErrorMessage(err);
  const result: RequestResult = {
    id: nextResultId(),
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
    validationMode: scenario.validation?.mode ?? 'none',
    failureDetails: [{ path: '(error)', expected: 'success', actual: msg }],
    errorMessage: msg,
    responseHeaders: {},
    requestLog: { headers: {}, body: reqBody },
    scenarioTags: scenario.scenarioTags,
  };
  if (scenario.dataRowId) result.dataRowId = scenario.dataRowId;
  if (scenario.dataRowLabel) result.dataRowLabel = scenario.dataRowLabel;
  if (scenario.actionType && scenario.actionType !== 'http') {
    result.transportType = scenario.actionType as RequestResult['transportType'];
  }
  return result;
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timerId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`Request timeout (${(timeoutMs / 1000).toFixed(0)}s)`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timerId!));
}

interface PreparedScenario {
  body: string | undefined;
  contentType: string | null;
  baseHeaders: Record<string, string>;
  resolvedUrl: string;
  needsOAuth: boolean;
}

const _prepCache = new Map<string, PreparedScenario>();

export function clearPrepCache(): void { _prepCache.clear(); }

export function prepareScenario(scenario: Scenario): PreparedScenario {
  const cacheKey = scenario.dataRowId
    ? buildGrpcHarnessRowTraceKey(scenario.id, scenario.dataRowId)
    : scenario.id;
  const cached = _prepCache.get(cacheKey);
  if (cached) return cached;
  const { body, contentType } = serializeWithContentType(scenario);
  const baseHeaders = buildHeaders(scenario, undefined, contentType);
  const resolvedUrl = buildUrl(scenario);
  const needsOAuth = scenario.auth?.type === 'oauth2';
  const prep: PreparedScenario = { body, contentType, baseHeaders, resolvedUrl, needsOAuth };
  _prepCache.set(cacheKey, prep);
  return prep;
}

async function executeRequest(
  scenario: Scenario,
  headers: Record<string, string>,
  reqBody: string | undefined,
  timeoutMs?: number,
  resolvedUrl?: string,
): Promise<RequestResult> {
  const id = nextResultId();
  const start = performance.now();
  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let responseHeaders: Record<string, string> = {};
  let errorMessage: string | undefined;
  let timing: TimingBreakdown | undefined;

  try {
    const url = resolvedUrl ?? buildUrl(scenario);

    const result = await withTimeout(httpFetch(url, scenario.method, headers, reqBody), timeoutMs ?? 0);
    timing = result.timing;

    if (result.error) {
      httpStatus = 0;
      errorMessage = result.error;
    } else {
      httpStatus = result.status;
      responseBody = result.body;
      responseHeaders = result.headers;
      const isHttpError = httpStatus >= 400 || httpStatus === 0;
      const needsParse = isHttpError
        || (scenario.validation?.mode ?? 'none') !== 'none'
        || (scenario.validation?.assertions?.length ?? 0) > 0
        || (scenario.validation?.expectedFields?.length ?? 0) > 0;
      if (needsParse && responseBody) {
        responseObj = parseJsonOrRaw(responseBody);
      } else {
        responseObj = responseBody;
      }
    }
  } catch (err) {
    httpStatus = 0;
    errorMessage = toErrorMessage(err);
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

  const validation = scenario.validation ?? { mode: 'none' as const };
  const assertions = validation.assertions ?? [];
  const vr = buildValidationResult({
    httpStatus, responseTimeMs, responseHeaders, responseBody, responseObj,
    errorMessage, validation, assertions,
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
    validationMode: scenario.validation?.mode ?? 'none',
    failureDetails: vr.failureDetails,
    errorMessage: vr.errorMessage,
    timing,
    requestLog: { headers, body: reqBody },
    dataRowId: scenario.dataRowId,
    dataRowLabel: scenario.dataRowLabel,
    scenarioTags: scenario.scenarioTags,
  };
}

async function executeWithRetry(
  scenario: Scenario,
  headers: Record<string, string>,
  reqBody: string | undefined,
  timeoutMs?: number,
  retryCount = 0,
  retryDelayMs = 1000,
  resolvedUrl?: string,
): Promise<RequestResult> {
  let result = await executeRequest(scenario, headers, reqBody, timeoutMs, resolvedUrl);
  let attempt = 0;
  while (!result.passed && attempt < retryCount) {
    attempt++;
    if (retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
    result = await executeRequest(scenario, headers, reqBody, timeoutMs, resolvedUrl);
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
  /**
   * Optional per-scenario dispatch for non-HTTP actions.
   * When set, called instead of the HTTP runner for any scenario where
   * `(scenario.actionType ?? 'http') !== 'http'`.
   * Kafka (and future protocol) logic lives in the callback — not in this file.
   */
  executeNonHttp?: (scenario: Scenario) => Promise<RequestResult>;
  /** Env map for gRPC harness template resolution (`{{grpcHost}}`, etc.). */
  grpcHarnessEnv?: Record<string, string>;
}

export async function runSequential(queue: Scenario[], opts: RunOpts): Promise<RequestResult[]> {
  const { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal, getThinkTimeMs } = opts;
  const allResults: RequestResult[] = [];

  for (const scenario of queue) {
    if (abortSignal?.aborted || breaker.shouldStop) break;
    // Route non-HTTP actions (e.g. Kafka) through the caller-supplied callback.
    if (opts.executeNonHttp && (scenario.actionType ?? 'http') !== 'http') {
      const result = await opts.executeNonHttp(scenario);
      allResults.push(result);
      breaker.record(result);
      onProgress(allResults.length, queue.length, allResults);
      await applyThinkTime(getThinkTimeMs, abortSignal);
      continue;
    }
    const prep = prepareScenario(scenario);
    const token = prep.needsOAuth ? await tokenManager.getToken(scenario) : undefined;
    const headers = token ? { ...prep.baseHeaders, Authorization: `Bearer ${token}` } : prep.baseHeaders;
    const result = await executeWithRetry(scenario, headers, prep.body, timeoutMs, retryCount, retryDelayMs, prep.resolvedUrl);
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
      // Route non-HTTP actions through the caller-supplied callback.
      if (opts.executeNonHttp && (scenario.actionType ?? 'http') !== 'http') {
        return opts.executeNonHttp(scenario);
      }
      const prep = prepareScenario(scenario);
      const token = prep.needsOAuth ? await tokenManager.getToken(scenario) : undefined;
      const headers = token ? { ...prep.baseHeaders, Authorization: `Bearer ${token}` } : prep.baseHeaders;
      return executeWithRetry(scenario, headers, prep.body, timeoutMs, retryCount, retryDelayMs, prep.resolvedUrl);
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
        // Route non-HTTP actions through the caller-supplied callback.
        const isNonHttp = opts.executeNonHttp && (scenario.actionType ?? 'http') !== 'http';
        const httpPrep = isNonHttp ? null : prepareScenario(scenario);
        const execPromise = isNonHttp
          ? opts.executeNonHttp!(scenario)
          : (() => {
              const tokenPromise = httpPrep!.needsOAuth ? tokenManager.getToken(scenario) : Promise.resolve(undefined);
              return tokenPromise.then((token) => {
                const headers = token ? { ...httpPrep!.baseHeaders, Authorization: `Bearer ${token}` } : httpPrep!.baseHeaders;
                return executeWithRetry(scenario, headers, httpPrep!.body, timeoutMs, retryCount, retryDelayMs, httpPrep!.resolvedUrl);
              });
            })();
        execPromise.then((result) => {
          allResults.push(result);
          breaker.record(result);
        }).catch((err) => {
          const errorResult = buildErrorResult(scenario, err, httpPrep?.body);
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
