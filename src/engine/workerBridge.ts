import type { TestConfig, Scenario, RequestResult, WorkflowExecutionTrace } from '../shared/types';
import type { Workflow } from '../features/workflow/types/workflow';
import type { ProgressMeta, TestResult } from './executor';
import type { MainToWorkerMessage, WorkerToMainMessage } from './workerProtocol';
import { httpFetch } from '../shared/utils/httpClient';
import { isTauri } from '../shared/utils/platform';
import { toErrorMessage } from '../shared/utils/helpers';

type ProgressCallback = (
  completed: number,
  total: number,
  results: RequestResult[],
  meta?: ProgressMeta,
) => void;

const MIN_SCENARIOS_FOR_MULTI = 8;

export function getWorkerCount(): number {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 2) : 2;
  return Math.max(1, Math.min(cores - 1, 8));
}

/**
 * Run a test inside a Web Worker. Has the same signature as `runTest`
 * so it can be used as a drop-in replacement.
 *
 * - Browser mode: the worker uses proxyFetch (relative `/api/*` via native fetch,
 *   absolute URLs via POST /__proxy) like the main thread.
 * - Tauri mode:  HTTP requests are proxied through the main thread
 *   via postMessage so the Tauri HTTP plugin (main-thread only) is used.
 */
export function runTestInWorker(
  config: TestConfig,
  scenarios: Scenario[],
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal,
  /** Optional workflow for graph-based execution (when config.workflowId is set). */
  workflow?: Workflow,
  grpcHarnessEnv?: Record<string, string>,
): Promise<TestResult> {
  return new Promise<TestResult>((resolve, reject) => {
    const allResults: RequestResult[] = [];
    let executionTrace: WorkflowExecutionTrace | undefined;

    const worker = new Worker(
      new URL('./executionWorker.ts', import.meta.url),
      { type: 'module' },
    );

    let settled = false;

    function cleanup() {
      worker.removeEventListener('message', onMessage);
      worker.terminate();
    }

    function onMessage(e: MessageEvent<WorkerToMainMessage>) {
      const msg = e.data;

      switch (msg.type) {
        case 'progress':
          for (const r of msg.newResults) allResults.push(r);
          onProgress(msg.completed, msg.total, allResults, msg.meta);
          break;

        case 'done':
          for (const r of msg.newResults) allResults.push(r);
          executionTrace = msg.trace;
          settled = true;
          cleanup();
          resolve({ results: allResults, trace: executionTrace });
          break;

        case 'error':
          settled = true;
          cleanup();
          reject(new Error(msg.message));
          break;

        case 'http-request':
          httpFetch(msg.url, msg.method, msg.headers, msg.body)
            .then((response) => {
              worker.postMessage({
                type: 'http-response',
                id: msg.id,
                response,
              } satisfies MainToWorkerMessage);
            })
            .catch((err) => {
              worker.postMessage({
                type: 'http-response',
                id: msg.id,
                response: {
                  status: 0,
                  statusText: '',
                  headers: {},
                  body: '',
                  error: toErrorMessage(err),
                },
              } satisfies MainToWorkerMessage);
            });
          break;
      }
    }

    worker.addEventListener('message', onMessage);

    worker.addEventListener('error', (e) => {
      if (settled) return;
      settled = true;
      cleanup();
      const detail = e.message || (e.filename ? `Failed to load worker module: ${e.filename}` : 'Worker failed to initialize — try restarting the dev server');
      reject(new Error(detail));
    });

    if (abortSignal) {
      if (abortSignal.aborted) {
        cleanup();
        reject(new Error('Aborted'));
        return;
      }
      abortSignal.addEventListener('abort', () => {
        worker.postMessage({ type: 'abort' } satisfies MainToWorkerMessage);
      }, { once: true });
    }

    worker.postMessage({
      type: 'start',
      config,
      scenarios,
      useTauriProxy: isTauri(),
      workflow,
      grpcHarnessEnv,
    } satisfies MainToWorkerMessage);
  });
}

/**
 * Run a test across N Web Workers for multi-core utilization.
 * Splits scenarios evenly, aggregates results, and coordinates abort/circuit-breaker.
 * Falls back to single-worker for workflow mode or small scenario counts.
 */
export function runTestMultiWorker(
  config: TestConfig,
  scenarios: Scenario[],
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal,
  workflow?: Workflow,
  grpcHarnessEnv?: Record<string, string>,
): Promise<TestResult> {
  const isLoadProfile = config.executionMode === 'load-profile' && !!config.loadProfile;
  const N = getWorkerCount();
  if (N <= 1 || workflow || (!isLoadProfile && scenarios.length < MIN_SCENARIOS_FOR_MULTI)) {
    return runTestInWorker(config, scenarios, onProgress, abortSignal, workflow, grpcHarnessEnv);
  }

  const actualWorkerCount = isLoadProfile
    ? Math.min(N, config.concurrency ?? 1)
    : N;
  const chunks: Scenario[][] = [];
  if (isLoadProfile) {
    for (let i = 0; i < actualWorkerCount; i++) chunks.push(scenarios);
  } else {
    const chunkSize = Math.ceil(scenarios.length / actualWorkerCount);
    for (let i = 0; i < actualWorkerCount; i++) {
      const chunk = scenarios.slice(i * chunkSize, (i + 1) * chunkSize);
      if (chunk.length > 0) chunks.push(chunk);
    }
  }
  const workerCount = chunks.length;
  if (workerCount <= 1) {
    return runTestInWorker(config, scenarios, onProgress, abortSignal, workflow, grpcHarnessEnv);
  }
  const totalConcurrency = config.concurrency ?? 1;
  const baseConcurrency = Math.floor(totalConcurrency / workerCount);
  const extraConcurrency = totalConcurrency - baseConcurrency * workerCount;

  return new Promise<TestResult>((resolve, reject) => {
    const allResults: RequestResult[] = [];
    const workers: Worker[] = [];
    const completedPerWorker: number[] = new Array(workerCount).fill(0);
    const totalPerWorker: number[] = new Array(workerCount).fill(0);
    const metaPerWorker: (ProgressMeta | undefined)[] = new Array(workerCount).fill(undefined);
    let doneCount = 0;
    let settled = false;
    const useTauriProxy = isTauri();

    function cleanupAll() {
      for (const w of workers) {
        try { w.terminate(); } catch { /* ignore */ }
      }
    }

    function abortAll() {
      for (const w of workers) {
        try { w.postMessage({ type: 'abort' } satisfies MainToWorkerMessage); } catch { /* ignore */ }
      }
    }

    function createWorkerHandler(workerIdx: number, w: Worker) {
      return (e: MessageEvent<WorkerToMainMessage>) => {
        if (settled) return;
        const msg = e.data;

        switch (msg.type) {
          case 'progress':
            for (const r of msg.newResults) allResults.push(r);
            completedPerWorker[workerIdx] = msg.completed;
            totalPerWorker[workerIdx] = msg.total;
            metaPerWorker[workerIdx] = msg.meta;
            {
              let aggregatedMeta = msg.meta;
              if (msg.meta && workerCount > 1) {
                let totalInFlight = 0;
                let totalTarget = 0;
                let maxElapsed = 0;
                for (const m of metaPerWorker) {
                  if (m) {
                    totalInFlight += m.currentInFlight;
                    totalTarget += m.targetConcurrency;
                    if (m.elapsedMs > maxElapsed) maxElapsed = m.elapsedMs;
                  }
                }
                aggregatedMeta = {
                  elapsedMs: maxElapsed,
                  targetConcurrency: isLoadProfile ? totalTarget : totalConcurrency,
                  currentInFlight: isLoadProfile ? totalInFlight : totalConcurrency,
                  durationMs: msg.meta.durationMs,
                };
              }
              onProgress(
                completedPerWorker.reduce((a, b) => a + b, 0),
                isLoadProfile ? -1 : totalPerWorker.reduce((a, b) => a + b, 0),
                allResults,
                aggregatedMeta,
              );
            }
            break;

          case 'done':
            for (const r of msg.newResults) allResults.push(r);
            doneCount++;
            if (doneCount >= workerCount) {
              settled = true;
              cleanupAll();
              resolve({ results: allResults });
            }
            break;

          case 'error':
            if (!settled) {
              settled = true;
              abortAll();
              cleanupAll();
              reject(new Error(msg.message));
            }
            break;

          case 'http-request':
            httpFetch(msg.url, msg.method, msg.headers, msg.body)
              .then((response) => {
                w.postMessage({ type: 'http-response', id: msg.id, response } satisfies MainToWorkerMessage);
              })
              .catch((err) => {
                w.postMessage({
                  type: 'http-response', id: msg.id,
                  response: { status: 0, statusText: '', headers: {}, body: '', error: toErrorMessage(err) },
                } satisfies MainToWorkerMessage);
              });
            break;
        }
      };
    }

    if (abortSignal) {
      if (abortSignal.aborted) {
        reject(new Error('Aborted'));
        return;
      }
      abortSignal.addEventListener('abort', () => {
        if (!settled) abortAll();
      }, { once: true });
    }

    for (let i = 0; i < workerCount; i++) {
      const w = new Worker(
        new URL('./executionWorker.ts', import.meta.url),
        { type: 'module' },
      );
      workers.push(w);
      w.addEventListener('message', createWorkerHandler(i, w));
      w.addEventListener('error', (e) => {
        if (settled) return;
        settled = true;
        abortAll();
        cleanupAll();
        const detail = e.message || (e.filename ? `Failed to load worker module: ${e.filename}` : 'Worker failed to initialize — try restarting the dev server');
        reject(new Error(detail));
      });
      const perWorkerConcurrency = Math.max(1, baseConcurrency + (i < extraConcurrency ? 1 : 0));
      const workerConfig = { ...config, concurrency: perWorkerConcurrency };
      if (isLoadProfile && workerConfig.loadProfile) {
        const lp = workerConfig.loadProfile;
        const baseMax = Math.floor(lp.maxConcurrency / workerCount);
        const extraMax = lp.maxConcurrency - baseMax * workerCount;
        const perWorkerMax = Math.max(1, baseMax + (i < extraMax ? 1 : 0));
        workerConfig.loadProfile = { ...lp, maxConcurrency: perWorkerMax };
        if (lp.spikeConcurrency) {
          const baseSpike = Math.floor(lp.spikeConcurrency / workerCount);
          const extraSpike = lp.spikeConcurrency - baseSpike * workerCount;
          workerConfig.loadProfile.spikeConcurrency = Math.max(1, baseSpike + (i < extraSpike ? 1 : 0));
        }
      }
      w.postMessage({
        type: 'start',
        config: workerConfig,
        scenarios: chunks[i],
        useTauriProxy,
        workerIndex: i,
        totalWorkers: workerCount,
        grpcHarnessEnv,
      } satisfies MainToWorkerMessage);
    }
  });
}
