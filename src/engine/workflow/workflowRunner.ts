import { v4 as uuidv4 } from 'uuid';
import type { Scenario, RequestResult, TimingBreakdown } from '../../types';
import { httpFetch } from '../../utils/httpClient';
import { serializeWithContentType } from '../../utils/bodySerializer';
import { buildHeaders, buildUrl } from '../executor';
import { validate, evaluateAssertions } from '../validator';
import { TokenManager } from '../tokenManager';
import { applyThinkTime } from '../thinkTime';
import { VariableContext } from './variableContext';
import { resolveScenario } from './resolveScenario';
import { ensureAbsoluteUrlWithBase } from './absoluteUrl';
import { extractVariables, type ResponseData } from './extractVariables';
import type { RunOpts } from '../requestExecution';

export interface WorkflowProgress {
  stepIndex: number;
  stepName: string;
  extracted: Record<string, string>;
  variables: Record<string, string>;
}

/**
 * Execute an ordered list of scenarios as a workflow chain.
 * Each step can extract response values into the shared VariableContext,
 * which subsequent steps can reference via {{varName}} placeholders.
 *
 * Uses its own HTTP pipeline (not executeRequest) to access the full
 * response body and headers for extraction before truncation.
 */
export async function runWorkflow(
  steps: Scenario[],
  opts: RunOpts,
  ctx: VariableContext,
  onStepComplete?: (progress: WorkflowProgress) => void,
): Promise<RequestResult[]> {
  const { tokenManager, timeoutMs, breaker, onProgress, abortSignal, getThinkTimeMs } = opts;
  const results: WorkflowStepResult[] = [];

  for (let i = 0; i < steps.length; i++) {
    if (abortSignal?.aborted || breaker.shouldStop) break;

    const rawScenario = steps[i];
    const resolved = resolveScenario(rawScenario, ctx);
    const resolvedAbs: Scenario = {
      ...resolved,
      url: ensureAbsoluteUrlWithBase(resolved.url, ctx),
    };

    const result = await executeWorkflowStep(resolvedAbs, tokenManager, timeoutMs);
    results.push(result);
    breaker.record(result);

    let extracted: Record<string, string> = {};
    if (rawScenario.extractions?.length) {
      const responseData: ResponseData = {
        status: result.httpStatus,
        headers: result.responseHeaders ?? {},
        body: result._fullResponseBody,
      };
      extracted = extractVariables(rawScenario.extractions, responseData, ctx, rawScenario.id);
    }
    if (ctx.get('status') === undefined) {
      ctx.set('status', String(result.httpStatus));
      ctx.setForNode(rawScenario.id, 'status', String(result.httpStatus));
      extracted = { ...extracted, status: String(result.httpStatus) };
    }

    onStepComplete?.({
      stepIndex: i,
      stepName: rawScenario.name,
      extracted,
      variables: ctx.snapshot(),
    });

    onProgress(results.length, steps.length, results);
    if (i < steps.length - 1) {
      await applyThinkTime(getThinkTimeMs, abortSignal);
    }
  }

  return results.map(stripTransientFields);
}

/**
 * Run the workflow N times with the given concurrency.
 * Each iteration gets its own child VariableContext (isolated variables).
 */
export async function runWorkflowLoad(
  steps: Scenario[],
  iterations: number,
  concurrency: number,
  opts: RunOpts,
  ctx: VariableContext,
  onStepComplete?: (progress: WorkflowProgress) => void,
): Promise<RequestResult[]> {
  const allResults: RequestResult[] = [];
  let completedIterations = 0;
  const totalSteps = steps.length * iterations;

  const runOne = async (): Promise<void> => {
    const childCtx = ctx.child();
    const iterResults = await runWorkflow(steps, {
      ...opts,
      onProgress: (completed, _total, results) => {
        opts.onProgress(allResults.length + completed, totalSteps, [...allResults, ...results]);
      },
    }, childCtx, onStepComplete);
    allResults.push(...iterResults);
    completedIterations++;
  };

  if (concurrency <= 1) {
    for (let i = 0; i < iterations; i++) {
      if (opts.abortSignal?.aborted || opts.breaker.shouldStop) break;
      await runOne();
    }
  } else {
    let launched = 0;
    const pool: Promise<void>[] = [];
    while (launched < iterations) {
      if (opts.abortSignal?.aborted || opts.breaker.shouldStop) break;
      while (pool.length < concurrency && launched < iterations) {
        launched++;
        const p = runOne().then(() => { pool.splice(pool.indexOf(p), 1); });
        pool.push(p);
      }
      if (pool.length > 0) await Promise.race(pool);
    }
    await Promise.all(pool);
  }

  return allResults;
}

// ── Internal: execute a single workflow step ─────────

interface WorkflowStepResult extends RequestResult {
  responseHeaders?: Record<string, string>;
  _fullResponseBody: unknown;
}

async function executeWorkflowStep(
  scenario: Scenario,
  tokenManager: TokenManager,
  timeoutMs?: number,
): Promise<WorkflowStepResult> {
  const id = uuidv4();
  const { body: reqBody, contentType } = serializeWithContentType(scenario);
  const token = await tokenManager.getToken(scenario);
  const headers = buildHeaders(scenario, token, contentType);
  const url = buildUrl(scenario);

  const start = performance.now();
  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let responseHeaders: Record<string, string> = {};
  let timing: TimingBreakdown | undefined;
  let errorMessage: string | undefined;

  try {
    let resultPromise = httpFetch(url, scenario.method, headers, reqBody);
    if (timeoutMs && timeoutMs > 0) {
      const timeoutP = new Promise<typeof resultPromise extends Promise<infer T> ? T : never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout (${(timeoutMs / 1000).toFixed(0)}s)`)), timeoutMs);
      });
      resultPromise = Promise.race([resultPromise, timeoutP]);
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
      try { responseObj = JSON.parse(responseBody); } catch { responseObj = responseBody; }
    }
  } catch (err) {
    httpStatus = 0;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const responseTimeMs = Math.round((performance.now() - start) * 100) / 100;

  const assertions = scenario.validation.assertions ?? [];
  const { failures: assertionFailures, statusAsserted } = assertions.length > 0
    ? evaluateAssertions(assertions, { httpStatus, responseTimeMs, responseHeaders, responseBody: responseObj })
    : { failures: [], statusAsserted: false };

  const httpOk = httpStatus > 0 && httpStatus < 400;
  const statusOk = statusAsserted
    ? assertionFailures.every(f => f.path !== '(status)')
    : httpOk;

  const jsonFailures = scenario.validation.mode !== 'none' && statusOk
    ? validate(scenario.validation, responseObj)
    : [];

  let failureDetails = [...assertionFailures, ...jsonFailures];

  const httpFailed = !statusAsserted && (httpStatus >= 400 || httpStatus === 0);
  if (httpFailed && !errorMessage && responseBody) {
    try {
      const parsed = typeof responseObj === 'object' && responseObj !== null ? responseObj as Record<string, unknown> : null;
      const raw = parsed?.message ?? parsed?.error ?? parsed?.detail ?? parsed?.errorMessage;
      if (typeof raw === 'string') errorMessage = raw;
      else if (raw != null) errorMessage = JSON.stringify(raw);
      else errorMessage = responseBody.slice(0, 300);
    } catch { errorMessage = responseBody.slice(0, 300); }
  }
  if (httpFailed && errorMessage) {
    failureDetails = [{ path: '(http)', expected: '2xx', actual: errorMessage }, ...assertionFailures];
  }

  const networkError = httpStatus === 0 && !statusAsserted;
  const passed = !networkError && failureDetails.length === 0;

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
    timestamp: Date.now(),
    passed,
    validationMode: scenario.validation.mode,
    failureDetails,
    errorMessage,
    timing,
    responseHeaders,
    _fullResponseBody: responseObj,
  };
}

function stripTransientFields(result: WorkflowStepResult): RequestResult {
  const { _fullResponseBody: _, responseHeaders: _h, ...clean } = result;
  return clean;
}
