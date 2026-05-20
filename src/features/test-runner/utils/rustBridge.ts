/**
 * Bridge between the React frontend and the Rust executor backend via Tauri IPC.
 *
 * This module wraps Tauri's invoke/listen APIs to provide a typed interface for:
 *   - Detecting Rust executor availability
 *   - Sending execution plans to the Rust backend
 *   - Receiving streaming progress events
 *   - Aborting running tests
 *   - Converting TestConfig+Scenario[] → RustExecutionPlan (Phase 2C)
 *   - Mapping RustExecutionResult → RequestResult with JS-side validation (Phase 2C)
 *
 * Only usable inside a Tauri desktop shell — callers must guard with isTauri().
 */

import { isTauri } from '../../../shared/utils/platform';
import type { TestConfig, Scenario, RequestResult, ScenarioWeight, FailureDetail, ValidationMode } from '../../../shared/types';
import type { ProgressMeta } from '../../../engine/executor';
import type { TestResult } from '../../../engine/executor';
import { buildHeaders, buildUrl } from '../../../engine/executor';
import { serializeWithContentType } from '../../../shared/utils/bodySerializer';
import { expandQueue } from '../../../engine/dataSourceExpander';
import { computeAllocation } from '../../../engine/allocationEngine';
import { buildValidationResult } from '../../../engine/validationResult';
import { evaluateAssertions } from '../../../engine/validator';

/* ── Rust-side types (must match src-tauri/src/types.rs) ─────────── */

export interface RustScenarioValidation {
  mode: string;
  expectedJson?: string;
  expectedFields?: Array<{
    jsonPath: string;
    expectedValue: string;
    operator?: string;
    operatorValue?: string;
    negate?: boolean;
  }>;
  unorderedArrays?: boolean;
}

export interface RustScenario {
  id: string;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | null;
  featureGroupName?: string | null;
  groupName?: string | null;
  weight?: number | null;
  dataRowId?: string | null;
  dataRowLabel?: string | null;
  validation?: RustScenarioValidation;
  assertions?: Record<string, unknown>[];
}

export type RustThinkTimeConfig =
  | { type: 'none' }
  | { type: 'constant'; delayMs: number }
  | { type: 'uniform'; minMs: number; maxMs: number }
  | { type: 'gaussian'; meanMs: number; stdDevMs: number };

export type RustCircuitBreakerConfig =
  | { policy: 'continue' }
  | { policy: 'stop-first' }
  | { policy: 'stop-threshold'; maxErrors: number; maxErrorRate: number; minSampleSize: number };

export type RustExecutionPlan =
  | {
      mode: 'pool';
      scenarios: RustScenario[];
      concurrency: number;
      timeoutMs: number;
      retryCount: number;
      retryDelayMs: number;
      thinkTime: RustThinkTimeConfig;
      circuitBreaker: RustCircuitBreakerConfig;
    }
  | {
      mode: 'sequential';
      scenarios: RustScenario[];
      timeoutMs: number;
      retryCount: number;
      retryDelayMs: number;
      thinkTime: RustThinkTimeConfig;
      circuitBreaker: RustCircuitBreakerConfig;
    }
  | {
      mode: 'load-profile';
      scenarios: RustScenario[];
      concurrency: number;
      durationSec: number;
      timeoutMs: number;
      retryCount: number;
      retryDelayMs: number;
      thinkTime: RustThinkTimeConfig;
      circuitBreaker: RustCircuitBreakerConfig;
      profileType: string;
      rampUpSec?: number | null;
      spikeConcurrency?: number | null;
      spikeStartSec?: number | null;
      spikeDurationSec?: number | null;
    };

export interface RustTimingBreakdown {
  dnsLookup: number;
  tcpConnect: number;
  tlsHandshake: number;
  ttfb: number;
  download: number;
  total: number;
}

export interface RustRequestLog {
  headers: Record<string, string>;
  body?: string | null;
}

export interface RustExecutionResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  featureGroupName?: string | null;
  groupName?: string | null;
  url: string;
  method: string;
  httpStatus: number;
  responseTimeMs: number;
  responseBody: string;
  responseHeaders: Record<string, string>;
  timestamp: number;
  errorMessage?: string | null;
  dataRowId?: string | null;
  dataRowLabel?: string | null;
  requestLog: RustRequestLog;
  timing: RustTimingBreakdown;
  retryCount: number;
  passed?: boolean;
  failureDetails?: FailureDetail[];
  validationMode?: string;
}

export interface RustProgressBatch {
  completed: number;
  total: number;
  results: RustExecutionResult[];
  elapsedMs: number;
  currentInFlight: number;
  targetConcurrency: number;
  breakerTripped: boolean;
}

export interface RustCompletionSummary {
  totalResults: number;
  durationMs: number;
  breakerTripped: boolean;
}

/* ── Availability check ──────────────────────────────────────────── */

let _available: boolean | null = null;

export async function isRustExecutorAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  if (!isTauri()) {
    _available = false;
    return false;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    _available = await invoke<boolean>('is_rust_executor_available');
  } catch {
    _available = false;
  }
  return _available;
}

/** Reset the cached availability flag (for testing). */
export function resetAvailabilityCache(): void {
  _available = null;
}

/* ── Start / Abort ───────────────────────────────────────────────── */

export async function startRustLoadTest(
  plan: RustExecutionPlan,
  onProgress: (batch: RustProgressBatch) => void,
  onComplete: (summary: RustCompletionSummary) => void,
  onError?: (err: unknown) => void,
): Promise<{ unlisten: () => void }> {
  if (!isTauri()) {
    const err = new Error('startRustLoadTest called outside Tauri');
    if (onError) onError(err); else throw err;
    return { unlisten: () => {} };
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const { listen } = await import('@tauri-apps/api/event');

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    unlistenProgress();
    unlistenComplete();
  };

  const unlistenProgress = await listen<RustProgressBatch>('load-test-progress', (event) => {
    onProgress(event.payload);
  });

  const unlistenComplete = await listen<RustCompletionSummary>('load-test-complete', (event) => {
    cleanup();
    onComplete(event.payload);
  });

  invoke<RustCompletionSummary>('start_load_test', { plan }).catch((err) => {
    console.error('[rustBridge] start_load_test failed:', err);
    cleanup();
    if (onError) {
      onError(err);
    } else {
      onComplete({ totalResults: 0, durationMs: 0, breakerTripped: false });
    }
  });

  return { unlisten: cleanup };
}

export async function abortRustLoadTest(): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('abort_load_test');
}

/* ── Phase 2C: Execution plan builder ────────────────────────────── */

/**
 * Check whether Rust executor can handle this test configuration.
 * Falls back to JS when: workflow mode, OAuth2 auth, or sub-workflow resolver needed.
 */
export function canUseRustExecutor(
  config: TestConfig,
  scenarios: Scenario[],
  resolveSubWorkflow?: (id: string) => unknown,
): boolean {
  if (config.executionMode === 'workflow') return false;
  if (resolveSubWorkflow) return false;
  if (scenarios.some((s) => s.auth.type === 'oauth2')) return false;
  return true;
}

function mapThinkTime(config: TestConfig): RustThinkTimeConfig {
  const tt = config.thinkTime;
  if (!tt || tt.mode === 'none') return { type: 'none' };
  switch (tt.mode) {
    case 'constant':
      return { type: 'constant', delayMs: Math.max(0, Math.round(tt.constantMs ?? 1000)) };
    case 'uniform':
      return { type: 'uniform', minMs: Math.max(0, Math.round(tt.minMs ?? 500)), maxMs: Math.max(0, Math.round(tt.maxMs ?? 2000)) };
    case 'gaussian':
      return { type: 'gaussian', meanMs: Math.max(0, Math.round(tt.meanMs ?? 1000)), stdDevMs: Math.max(0, Math.round(tt.stdDevMs ?? 300)) };
    default:
      return { type: 'none' };
  }
}

function mapCircuitBreaker(config: TestConfig): RustCircuitBreakerConfig {
  const policy = config.errorPolicy ?? 'continue';
  if (policy === 'continue') return { policy: 'continue' };
  if (policy === 'stop-first') return { policy: 'stop-first' };
  const jsRate = config.maxErrorRate ?? 50;
  return {
    policy: 'stop-threshold',
    maxErrors: config.maxErrors ?? 10,
    maxErrorRate: jsRate / 100,
    minSampleSize: 10,
  };
}

/**
 * Prepare a single Scenario into a RustScenario with fully resolved headers, URL, and body.
 * Reuses the same logic as the JS executor (prepareScenario) but outputs a flat struct.
 */
export function prepareRustScenario(scenario: Scenario): RustScenario {
  const { body, contentType } = serializeWithContentType(scenario);
  const headers = buildHeaders(scenario, undefined, contentType);
  const url = buildUrl(scenario);

  const allAssertions = scenario.validation.assertions ?? [];
  const rustAssertions = allAssertions.filter(a => a.type !== 'custom');

  return {
    id: scenario.id,
    name: scenario.name,
    url,
    method: scenario.method,
    headers,
    body: body ?? null,
    featureGroupName: scenario.featureGroupName ?? null,
    groupName: scenario.groupName ?? null,
    weight: null,
    dataRowId: scenario.dataRowId ?? null,
    dataRowLabel: scenario.dataRowLabel ?? null,
    validation: {
      mode: scenario.validation.mode,
      expectedJson: scenario.validation.expectedJson,
      expectedFields: scenario.validation.expectedFields?.map(f => ({
        jsonPath: f.jsonPath,
        expectedValue: f.expectedValue,
        operator: f.operator,
        operatorValue: f.operatorValue,
        negate: f.negate,
      })),
      unorderedArrays: scenario.validation.unorderedArrays,
    },
    assertions: rustAssertions.length > 0
      ? rustAssertions as unknown as Record<string, unknown>[]
      : undefined,
  };
}

/**
 * Build a RustExecutionPlan from TestConfig + Scenario[].
 * Performs the same allocation → shuffle → expand pipeline as the JS executor,
 * then maps each expanded scenario through prepareRustScenario().
 *
 * Returns null if the configuration can't be handled by Rust (e.g., workflow mode).
 */
export function buildExecutionPlan(
  config: TestConfig,
  scenarios: Scenario[],
): RustExecutionPlan | null {
  if (config.executionMode === 'workflow') return null;

  const mode = config.executionMode ?? 'batch';
  const timeoutMs = (config.timeoutSec ?? 0) > 0 ? Math.round(config.timeoutSec! * 1000) : 0;
  const retryCount = config.retryCount ?? 0;
  const retryDelayMs = config.retryDelayMs ?? 1000;
  const thinkTime = mapThinkTime(config);
  const circuitBreaker = mapCircuitBreaker(config);

  if (mode === 'load-profile' && config.loadProfile) {
    const weightMap = new Map(config.scenarioWeights.map((w) => [w.scenarioId, w.weight]));
    const rustScenarios = scenarios.map((s) => {
      const rs = prepareRustScenario(s);
      rs.weight = weightMap.get(s.id) ?? null;
      return rs;
    });
    return {
      mode: 'load-profile',
      scenarios: rustScenarios,
      concurrency: config.loadProfile.maxConcurrency,
      durationSec: config.loadProfile.durationSec,
      timeoutMs,
      retryCount,
      retryDelayMs,
      thinkTime,
      circuitBreaker,
      profileType: config.loadProfile.type,
      rampUpSec: config.loadProfile.rampUpSec ?? null,
      spikeConcurrency: config.loadProfile.spikeConcurrency ?? null,
      spikeStartSec: config.loadProfile.spikeStartSec ?? null,
      spikeDurationSec: config.loadProfile.spikeDurationSec ?? null,
    };
  }

  const expandedQueue = buildExpandedQueue(config, scenarios);

  if (mode === 'sequential') {
    return {
      mode: 'sequential',
      scenarios: expandedQueue.map(prepareRustScenario),
      timeoutMs,
      retryCount,
      retryDelayMs,
      thinkTime,
      circuitBreaker,
    };
  }

  // pool and batch both map to pool (batch = pool with same concurrency semantics)
  return {
    mode: 'pool',
    scenarios: expandedQueue.map(prepareRustScenario),
    concurrency: Math.max(1, config.concurrency),
    timeoutMs,
    retryCount,
    retryDelayMs,
    thinkTime,
    circuitBreaker,
  };
}

/**
 * Replicates the allocation → shuffle → expand pipeline from the JS executor.
 */
export function buildExpandedQueue(config: TestConfig, scenarios: Scenario[]): Scenario[] {
  const activeIds = new Set(
    config.scenarioWeights.filter((w: ScenarioWeight) => w.weight > 0).map((w: ScenarioWeight) => w.scenarioId),
  );
  const activeScenarios = activeIds.size > 0
    ? scenarios.filter((s) => activeIds.has(s.id))
    : scenarios;

  const kind = activeScenarios.some((s) => s.dataSource || s.sharedDataSourceId)
    ? ('parameterized' as const)
    : ('standard' as const);

  const allocation = computeAllocation(activeScenarios, config.iterations, kind);

  const queue: Scenario[] = [];
  for (const item of allocation.items) {
    const scenario = activeScenarios.find((s) => s.id === item.testId);
    if (!scenario) continue;
    for (let i = 0; i < item.iterations; i++) queue.push(scenario);
  }

  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  return expandQueue(queue);
}

/* ── Phase 2C: Result mapper ─────────────────────────────────────── */

/**
 * Map a RustExecutionResult to a RequestResult.
 *
 * When Rust emits `passed` (not undefined), we passthrough the Rust validation results
 * and only run custom assertions JS-side (Rust skips them). When `passed` is undefined
 * (backward compat with older Rust binary), we fall back to full JS-side validation.
 */
export function mapRustResult(
  rustResult: RustExecutionResult,
  scenario: Scenario,
): RequestResult {
  let errorMessage = rustResult.errorMessage ?? undefined;

  const httpFailed = rustResult.httpStatus >= 400 || rustResult.httpStatus === 0;
  if (httpFailed && !errorMessage && rustResult.responseBody) {
    try {
      const parsed = JSON.parse(rustResult.responseBody);
      const obj = typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
      const raw = obj?.message ?? obj?.error ?? obj?.detail ?? obj?.errorMessage;
      if (typeof raw === 'string') errorMessage = raw;
      else if (raw != null) errorMessage = JSON.stringify(raw);
      else errorMessage = rustResult.responseBody.slice(0, 300);
    } catch {
      errorMessage = rustResult.responseBody.slice(0, 300);
    }
  }

  if (rustResult.passed !== undefined) {
    return mapRustResultPassthrough(rustResult, scenario, errorMessage);
  }
  return mapRustResultJsFallback(rustResult, scenario, errorMessage);
}

/**
 * Passthrough path: Rust validated — trust passed/failureDetails from Rust,
 * then evaluate any custom assertions JS-side and merge.
 */
function mapRustResultPassthrough(
  rustResult: RustExecutionResult,
  scenario: Scenario,
  errorMessage: string | undefined,
): RequestResult {
  let passed = rustResult.passed!;
  let failureDetails: FailureDetail[] = rustResult.failureDetails ?? [];

  const customAssertions = (scenario.validation.assertions ?? [])
    .filter(a => a.type === 'custom');

  if (customAssertions.length > 0) {
    let responseObj: unknown = null;
    if (rustResult.responseBody) {
      try { responseObj = JSON.parse(rustResult.responseBody); } catch { /* use null */ }
    }
    const { failures: customFailures } = evaluateAssertions(customAssertions, {
      httpStatus: rustResult.httpStatus,
      responseTimeMs: rustResult.responseTimeMs,
      responseHeaders: rustResult.responseHeaders,
      responseBody: responseObj,
      rawBody: rustResult.responseBody,
    });
    if (customFailures.length > 0) {
      failureDetails = [...failureDetails, ...customFailures];
      passed = false;
    }
  }

  let finalErrorMessage = errorMessage;
  if (rustResult.retryCount > 0 && !passed) {
    finalErrorMessage = `${finalErrorMessage ?? 'Failed'} (after ${rustResult.retryCount + 1} attempts)`;
  }

  return {
    id: rustResult.id,
    scenarioId: rustResult.scenarioId,
    scenarioName: rustResult.scenarioName,
    featureGroupName: rustResult.featureGroupName ?? undefined,
    groupName: rustResult.groupName ?? undefined,
    url: rustResult.url,
    method: rustResult.method,
    httpStatus: rustResult.httpStatus,
    responseTimeMs: rustResult.responseTimeMs,
    responseBody: rustResult.responseBody,
    responseHeaders: rustResult.responseHeaders,
    timestamp: rustResult.timestamp,
    passed,
    validationMode: (rustResult.validationMode ?? scenario.validation.mode) as ValidationMode,
    failureDetails,
    errorMessage: finalErrorMessage,
    timing: rustResult.timing,
    requestLog: {
      headers: rustResult.requestLog.headers,
      body: rustResult.requestLog.body ?? undefined,
    },
    dataRowId: rustResult.dataRowId ?? undefined,
    dataRowLabel: rustResult.dataRowLabel ?? undefined,
  };
}

/**
 * Fallback path: Rust didn't validate (passed === undefined) — run full JS-side validation.
 * Backward compatible with older Rust binaries that don't emit validation fields.
 */
function mapRustResultJsFallback(
  rustResult: RustExecutionResult,
  scenario: Scenario,
  errorMessage: string | undefined,
): RequestResult {
  let responseObj: unknown = null;
  const needsParse =
    (rustResult.httpStatus >= 400 || rustResult.httpStatus === 0) ||
    scenario.validation.mode !== 'none' ||
    (scenario.validation.assertions?.length ?? 0) > 0 ||
    (scenario.validation.expectedFields?.length ?? 0) > 0;

  if (needsParse && rustResult.responseBody) {
    try {
      responseObj = JSON.parse(rustResult.responseBody);
    } catch {
      responseObj = rustResult.responseBody;
    }
  } else {
    responseObj = rustResult.responseBody;
  }

  const assertions = scenario.validation.assertions ?? [];
  const vr = buildValidationResult({
    httpStatus: rustResult.httpStatus,
    responseTimeMs: rustResult.responseTimeMs,
    responseHeaders: rustResult.responseHeaders,
    responseBody: rustResult.responseBody,
    responseObj,
    errorMessage,
    validation: scenario.validation,
    assertions,
  });

  let finalErrorMessage = vr.errorMessage ?? errorMessage;
  if (rustResult.retryCount > 0 && !vr.passed) {
    finalErrorMessage = `${finalErrorMessage ?? 'Failed'} (after ${rustResult.retryCount + 1} attempts)`;
  }

  return {
    id: rustResult.id,
    scenarioId: rustResult.scenarioId,
    scenarioName: rustResult.scenarioName,
    featureGroupName: rustResult.featureGroupName ?? undefined,
    groupName: rustResult.groupName ?? undefined,
    url: rustResult.url,
    method: rustResult.method,
    httpStatus: rustResult.httpStatus,
    responseTimeMs: rustResult.responseTimeMs,
    responseBody: rustResult.responseBody,
    responseHeaders: rustResult.responseHeaders,
    timestamp: rustResult.timestamp,
    passed: vr.passed,
    validationMode: scenario.validation.mode,
    failureDetails: vr.failureDetails,
    errorMessage: finalErrorMessage,
    timing: rustResult.timing,
    requestLog: {
      headers: rustResult.requestLog.headers,
      body: rustResult.requestLog.body ?? undefined,
    },
    dataRowId: rustResult.dataRowId ?? undefined,
    dataRowLabel: rustResult.dataRowLabel ?? undefined,
  };
}

/* ── Phase 2C: Full Rust execution flow ──────────────────────────── */

/**
 * Build a lookup map from scenario ID → Scenario for efficient result mapping.
 * For data-source-expanded scenarios, also maps by composite key "id::dataRowId".
 */
function buildScenarioLookup(scenarios: Scenario[], expandedQueue: Scenario[]): Map<string, Scenario> {
  const lookup = new Map<string, Scenario>();
  for (const s of scenarios) {
    lookup.set(s.id, s);
  }
  for (const s of expandedQueue) {
    if (s.dataRowId) {
      lookup.set(`${s.id}::${s.dataRowId}`, s);
    }
    if (!lookup.has(s.id)) {
      lookup.set(s.id, s);
    }
  }
  return lookup;
}

function findScenario(lookup: Map<string, Scenario>, result: RustExecutionResult): Scenario | undefined {
  if (result.dataRowId) {
    const composite = lookup.get(`${result.scenarioId}::${result.dataRowId}`);
    if (composite) return composite;
  }
  return lookup.get(result.scenarioId);
}

/**
 * Execute a test plan via the Rust executor with streaming progress.
 *
 * Calls buildExecutionPlan(), sends to Rust via startRustLoadTest(), accumulates results
 * across progress batches, runs mapRustResult() on each result (passthrough when Rust
 * validated, JS fallback otherwise), and calls the standard onProgress() callback.
 */
export function runTestViaRust(
  config: TestConfig,
  scenarios: Scenario[],
  onProgress: (completed: number, total: number, results: RequestResult[], meta?: ProgressMeta) => void,
  abortSignal?: AbortSignal,
): Promise<TestResult> {
  const plan = buildExecutionPlan(config, scenarios);
  if (!plan) {
    return Promise.reject(new Error('Cannot build Rust execution plan for this configuration'));
  }

  const isLoadProfile = config.executionMode === 'load-profile';
  const expandedQueue = isLoadProfile ? scenarios : buildExpandedQueue(config, scenarios);
  const scenarioLookup = buildScenarioLookup(scenarios, expandedQueue);
  const allResults: RequestResult[] = [];

  if (abortSignal?.aborted) {
    return Promise.resolve({ results: [] });
  }

  const onAbort = () => {
    abortRustLoadTest().catch(() => {});
  };

  if (abortSignal) {
    abortSignal.addEventListener('abort', onAbort, { once: true });
  }

  return new Promise<TestResult>((resolve, reject) => {
    let unlistenFn: (() => void) | null = null;
    let settled = false;

    const cleanup = () => {
      if (abortSignal) {
        abortSignal.removeEventListener('abort', onAbort);
      }
      if (unlistenFn) {
        unlistenFn();
        unlistenFn = null;
      }
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    startRustLoadTest(
      plan,
      (batch: RustProgressBatch) => {
        for (const rustResult of batch.results) {
          const scenario = findScenario(scenarioLookup, rustResult);
          if (scenario) {
            allResults.push(mapRustResult(rustResult, scenario));
          } else {
            allResults.push(mapRustResultWithoutValidation(rustResult));
          }
        }

        const total = isLoadProfile ? -1 : plan.scenarios.length;
        const meta: ProgressMeta = {
          elapsedMs: batch.elapsedMs,
          targetConcurrency: batch.targetConcurrency,
          currentInFlight: batch.currentInFlight,
          durationMs: isLoadProfile && config.loadProfile ? config.loadProfile.durationSec * 1000 : 0,
        };
        onProgress(allResults.length, total, allResults, meta);
      },
      (_summary: RustCompletionSummary) => {
        settle(() => resolve({ results: allResults }));
      },
      (err: unknown) => {
        settle(() => reject(err instanceof Error ? err : new Error(String(err))));
      },
    ).then((handle) => {
      unlistenFn = handle.unlisten;
    }).catch((err) => {
      settle(() => reject(err instanceof Error ? err : new Error(String(err))));
    });
  });
}

/**
 * Fallback for when a scenario can't be found in the lookup (shouldn't happen normally).
 * Creates a minimal RequestResult without validation.
 */
function mapRustResultWithoutValidation(rustResult: RustExecutionResult): RequestResult {
  const httpFailed = rustResult.httpStatus >= 400 || rustResult.httpStatus === 0;
  return {
    id: rustResult.id,
    scenarioId: rustResult.scenarioId,
    scenarioName: rustResult.scenarioName,
    featureGroupName: rustResult.featureGroupName ?? undefined,
    groupName: rustResult.groupName ?? undefined,
    url: rustResult.url,
    method: rustResult.method,
    httpStatus: rustResult.httpStatus,
    responseTimeMs: rustResult.responseTimeMs,
    responseBody: rustResult.responseBody,
    responseHeaders: rustResult.responseHeaders,
    timestamp: rustResult.timestamp,
    passed: !httpFailed,
    validationMode: 'none',
    failureDetails: httpFailed
      ? [{ path: '(http)', expected: '2xx', actual: rustResult.errorMessage ?? (rustResult.httpStatus === 0 ? 'network error' : `HTTP ${rustResult.httpStatus}`) }]
      : [],
    errorMessage: rustResult.errorMessage ?? undefined,
    timing: rustResult.timing,
    requestLog: {
      headers: rustResult.requestLog.headers,
      body: rustResult.requestLog.body ?? undefined,
    },
    dataRowId: rustResult.dataRowId ?? undefined,
    dataRowLabel: rustResult.dataRowLabel ?? undefined,
  };
}
