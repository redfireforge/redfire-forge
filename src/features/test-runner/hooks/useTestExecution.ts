import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestConfig, RequestResult, TestSummary, TestRun } from '../../../shared/types';
import type { Workflow } from '../../workflow/types/workflow';
import { runTest } from '../../../engine/executor';
import type { ProgressMeta } from '../../../engine/executor';
import { runTestMultiWorker } from '../../../engine/workerBridge';
import { computeMetrics } from '../../../engine/metrics';
import { saveTestRun, forceSaveTestRun } from '../../../shared/utils/storage';
import { supportsWorkers } from '../../../shared/utils/platform';
import { isRustExecutorAvailable, canUseRustExecutor, runTestViaRust } from '../utils/rustBridge';

export interface TimeSeriesPoint {
  elapsedSec: number;
  avgResponseTime: number;
  tps: number;
  errorRate: number;
  concurrency: number;
}

interface TestExecutionState {
  isRunning: boolean;
  completed: number;
  total: number;
  liveResults: RequestResult[];
  liveSummary: TestSummary | null;
  finalRun: TestRun | null;
  error: string | null;
  pendingRun: TestRun | null;
  profileMeta: ProgressMeta | null;
  timeSeries: TimeSeriesPoint[];
}

const PROGRESS_THROTTLE_MS = 500;
const MAX_LIVE_RESULTS = 500;

function capResults(results: RequestResult[]): RequestResult[] {
  if (results.length <= MAX_LIVE_RESULTS) return results;
  const failed = results.filter(r => !r.passed);
  const passed = results.filter(r => r.passed);
  const passedBudget = Math.max(0, MAX_LIVE_RESULTS - failed.length);
  const step = passed.length > passedBudget ? Math.ceil(passed.length / passedBudget) : 1;
  const sampled: RequestResult[] = [];
  for (let i = 0; i < passed.length && sampled.length < passedBudget; i += step) {
    sampled.push(passed[i]);
  }
  return [...failed, ...sampled];
}

export function useTestExecution() {
  const [state, setState] = useState<TestExecutionState>({
    isRunning: false,
    completed: 0,
    total: 0,
    liveResults: [],
    liveSummary: null,
    finalRun: null,
    error: null,
    pendingRun: null,
    profileMeta: null,
    timeSeries: [],
  });

  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastSnapshotRef = useRef<number>(0);
  const prevCompletedRef = useRef<number>(0);
  const prevSnapshotTimeRef = useRef<number>(0);

  const lastFlushRef = useRef<number>(0);
  const pendingUpdateRef = useRef<{
    completed: number;
    total: number;
    allResults: RequestResult[];
    profileMeta?: ProgressMeta;
  } | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeSeriesRef = useRef<TimeSeriesPoint[]>([]);
  const incrementalRef = useRef({
    sum: 0,
    min: Infinity,
    max: -Infinity,
    failedRequests: 0,
    failedValidations: 0,
    errorsByStatus: {} as Record<number, number>,
    count: 0,
    times: [] as number[],
  });

  const resetIncrementals = () => {
    incrementalRef.current = {
      sum: 0, min: Infinity, max: -Infinity,
      failedRequests: 0, failedValidations: 0,
      errorsByStatus: {}, count: 0, times: [],
    };
    timeSeriesRef.current = [];
  };

  const computeIncrementalSummary = (elapsedMs: number): TestSummary => {
    const inc = incrementalRef.current;
    const n = inc.count;
    if (n === 0) {
      return {
        tps: 0, avgResponseTime: 0, minResponseTime: 0, maxResponseTime: 0,
        p50ResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0, errorRate: 0, errorsByStatus: {},
        totalRequests: 0, successfulRequests: 0, failedRequests: 0, failedValidations: 0,
        totalDurationMs: Math.round(elapsedMs),
      };
    }

    const sorted = [...inc.times].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(n * 0.95)] ?? inc.max;
    const p99 = sorted[Math.floor(n * 0.99)] ?? inc.max;
    const tps = elapsedMs > 0 ? (n / elapsedMs) * 1000 : 0;
    const errorRate = n > 0 ? (inc.failedRequests / n) * 100 : 0;

    return {
      tps: Math.round(tps * 100) / 100,
      avgResponseTime: Math.round((inc.sum / n) * 100) / 100,
      minResponseTime: Math.round(inc.min * 100) / 100,
      maxResponseTime: Math.round(inc.max * 100) / 100,
      p95ResponseTime: Math.round(p95 * 100) / 100,
      p50ResponseTime: Math.round(sorted[Math.floor(n * 0.5)] * 100) / 100,
      p99ResponseTime: Math.round(p99 * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      errorsByStatus: { ...inc.errorsByStatus },
      totalRequests: n,
      successfulRequests: n - inc.failedRequests,
      failedRequests: inc.failedRequests,
      failedValidations: inc.failedValidations,
      totalDurationMs: Math.round(elapsedMs),
    };
  };

  const trackResult = (r: RequestResult) => {
    const inc = incrementalRef.current;
    inc.count++;
    inc.sum += r.responseTimeMs;
    if (r.responseTimeMs < inc.min) inc.min = r.responseTimeMs;
    if (r.responseTimeMs > inc.max) inc.max = r.responseTimeMs;
    inc.times.push(r.responseTimeMs);
    if (r.httpStatus >= 400 || r.httpStatus === 0) {
      inc.failedRequests++;
      inc.errorsByStatus[r.httpStatus] = (inc.errorsByStatus[r.httpStatus] || 0) + 1;
    }
    if (!r.passed && r.failureDetails.length > 0) {
      inc.failedValidations++;
    }
  };

  const flushToState = useCallback(() => {
    const pending = pendingUpdateRef.current;
    if (!pending) return;
    pendingUpdateRef.current = null;

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const summary = computeIncrementalSummary(elapsed);

    const elapsedSec = Math.round(elapsed / 1000);

    if (elapsedSec > lastSnapshotRef.current && pending.allResults.length > 0) {
      const intervalMs = now - prevSnapshotTimeRef.current;
      const intervalCompleted = pending.completed - prevCompletedRef.current;
      const intervalTps = intervalMs > 0 ? (intervalCompleted / intervalMs) * 1000 : 0;

      const recentWindow = pending.allResults.slice(-Math.max(intervalCompleted, 1));
      const avgRecent = recentWindow.reduce((s, r) => s + r.responseTimeMs, 0) / recentWindow.length;

      const failedInWindow = recentWindow.filter(r => r.httpStatus >= 400 || r.httpStatus === 0).length;
      const errorPct = (failedInWindow / recentWindow.length) * 100;

      const point: TimeSeriesPoint = {
        elapsedSec,
        avgResponseTime: Math.round(avgRecent * 10) / 10,
        tps: Math.round(intervalTps * 10) / 10,
        errorRate: Math.round(errorPct * 10) / 10,
        concurrency: pending.profileMeta
          ? (pending.total === -1 ? pending.profileMeta.currentInFlight : pending.profileMeta.targetConcurrency)
          : 0,
      };

      lastSnapshotRef.current = elapsedSec;
      prevCompletedRef.current = pending.completed;
      prevSnapshotTimeRef.current = now;

      timeSeriesRef.current = [...timeSeriesRef.current, point];
    }

    setState((prev) => ({
      ...prev,
      completed: pending.completed,
      total: pending.total,
      liveResults: capResults(pending.allResults),
      liveSummary: {
        ...summary,
        avgIterationTime: pending.profileMeta?.avgIterationTimeMs ?? prev.liveSummary?.avgIterationTime ?? summary.avgIterationTime,
      },
      profileMeta: pending.profileMeta ?? prev.profileMeta,
      timeSeries: timeSeriesRef.current,
    }));
    lastFlushRef.current = now;
  }, []);

  const execute = useCallback(async (config: TestConfig, scenarios: Scenario[], meta?: { projectName?: string; envName?: string; svcName?: string; baseUrl?: string }, workflow?: Workflow, resolveSubWorkflow?: (id: string) => Workflow | undefined) => {
    abortRef.current = new AbortController();
    startTimeRef.current = performance.now();
    lastSnapshotRef.current = 0;
    prevCompletedRef.current = 0;
    prevSnapshotTimeRef.current = performance.now();
    lastFlushRef.current = 0;
    pendingUpdateRef.current = null;
    resetIncrementals();

    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    setState({
      isRunning: true,
      completed: 0,
      total: config.executionMode === 'load-profile' ? -1 : config.iterations,
      liveResults: [],
      liveSummary: null,
      finalRun: null,
      error: null,
      pendingRun: null,
      profileMeta: null,
      timeSeries: [],
    });

    let lastTrackedCount = 0;
    const useWorker = supportsWorkers() && !resolveSubWorkflow;

    const onProgress = (completed: number, total: number, allResults: RequestResult[], profileMeta?: ProgressMeta) => {
      for (let i = lastTrackedCount; i < allResults.length; i++) {
        trackResult(allResults[i]);
      }
      lastTrackedCount = allResults.length;

      pendingUpdateRef.current = { completed, total, allResults, profileMeta };

      const now = performance.now();
      const sinceLast = now - lastFlushRef.current;

      if (sinceLast >= PROGRESS_THROTTLE_MS) {
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        flushToState();
      } else if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          flushToState();
        }, PROGRESS_THROTTLE_MS - sinceLast);
      }
    };

    try {
      const useRust = !workflow && !resolveSubWorkflow
        && canUseRustExecutor(config, scenarios)
        && await isRustExecutorAvailable();

      const testResult = useRust
        ? await runTestViaRust(config, scenarios, onProgress, abortRef.current.signal)
        : useWorker
          ? await runTestMultiWorker(config, scenarios, onProgress, abortRef.current.signal, workflow)
          : await runTest(config, scenarios, onProgress, abortRef.current.signal, workflow, resolveSubWorkflow);

      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      const totalDuration = performance.now() - startTimeRef.current;
      const summary = computeMetrics(testResult.results, totalDuration);

      // Calculate avgIterationTime from trace for workflow runs
      if (testResult.trace && testResult.trace.iterations.length > 0) {
        const iterationDurations = testResult.trace.iterations.map(iter => iter.durationMs);
        summary.avgIterationTime = Math.round(
          iterationDurations.reduce((a, b) => a + b, 0) / iterationDurations.length * 100
        ) / 100;
      }

      const testRun: TestRun = {
        id: uuidv4(),
        timestamp: Date.now(),
        config,
        summary,
        results: testResult.results,
        projectName: meta?.projectName,
        envName: meta?.envName,
        svcName: meta?.svcName,
        baseUrl: meta?.baseUrl,
        workflowName: workflow?.name,
        executionTrace: testResult.trace, // Phase 7e: Store execution trace
      };

      const saveResult = await saveTestRun(testRun);

      const finalCompleted = config.executionMode === 'workflow' ? (config.iterations || 1) : testResult.results.length;
      const finalTotal = finalCompleted;

      if (saveResult.quotaError) {
        setState((prev) => ({
          ...prev,
          isRunning: false,
          completed: finalCompleted,
          total: finalTotal,
          pendingRun: testRun,
          liveSummary: summary,
          liveResults: capResults(testResult.results),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isRunning: false,
          completed: finalCompleted,
          total: finalTotal,
          finalRun: testRun,
          liveSummary: summary,
          liveResults: capResults(testResult.results),
          pendingRun: null,
        }));
      }
    } catch (err) {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        isRunning: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [flushToState]);

  const confirmSavePendingRun = useCallback(async () => {
    const pending = state.pendingRun;
    if (!pending) return;
    const result = await forceSaveTestRun(pending);
    if (result.ok) {
      setState((prev) => ({ ...prev, finalRun: prev.pendingRun, pendingRun: null }));
    } else {
      setState((prev) => ({ ...prev, error: 'Storage is full. Please clear data manually in Settings → Storage.', pendingRun: null }));
    }
  }, [state.pendingRun]);

  const dismissPendingRun = useCallback(() => {
    setState((prev) => ({ ...prev, pendingRun: null }));
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /**
   * Start tracking progress for an external execution (e.g., webhook load driver).
   * Returns callbacks to report progress and completion.
   */
  const startExternalExecution = useCallback((total: number, meta?: { projectName?: string }) => {
    abortRef.current = new AbortController();
    startTimeRef.current = performance.now();
    lastSnapshotRef.current = 0;
    prevCompletedRef.current = 0;
    prevSnapshotTimeRef.current = performance.now();
    lastFlushRef.current = 0;
    pendingUpdateRef.current = null;
    resetIncrementals();

    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    setState({
      isRunning: true,
      completed: 0,
      total,
      liveResults: [],
      liveSummary: null,
      finalRun: null,
      error: null,
      pendingRun: null,
      profileMeta: null,
      timeSeries: [],
    });

    let lastTrackedCount = 0;
    const allResults: RequestResult[] = [];

    const reportProgress = (results: RequestResult[], completed: number) => {
      // Add new results
      for (const r of results) {
        if (!allResults.find(existing => existing.id === r.id)) {
          allResults.push(r);
        }
      }

      // Track metrics for new results
      for (let i = lastTrackedCount; i < allResults.length; i++) {
        trackResult(allResults[i]);
      }
      lastTrackedCount = allResults.length;

      const profileMeta: ProgressMeta = {
        elapsedMs: performance.now() - startTimeRef.current,
        targetConcurrency: 1,
        currentInFlight: 0,
        durationMs: 0,
      };

      pendingUpdateRef.current = { completed, total, allResults, profileMeta };

      const now = performance.now();
      const sinceLast = now - lastFlushRef.current;

      if (sinceLast >= PROGRESS_THROTTLE_MS) {
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        flushToState();
      } else if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          flushToState();
        }, PROGRESS_THROTTLE_MS - sinceLast);
      }
    };

    const complete = async (config: TestConfig, executionTrace?: import('../../../shared/types').WorkflowExecutionTrace) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      const totalDuration = performance.now() - startTimeRef.current;
      const summary = computeMetrics(allResults, totalDuration);
      
      // Calculate avgIterationTime from trace for workflow runs (reuse existing pattern)
      if (executionTrace && executionTrace.iterations.length > 0) {
        const iterationDurations = executionTrace.iterations.map(iter => iter.durationMs);
        summary.avgIterationTime = Math.round(
          iterationDurations.reduce((a, b) => a + b, 0) / iterationDurations.length * 100
        ) / 100;
      }

      const testRun: TestRun = {
        id: uuidv4(),
        timestamp: Date.now(),
        config,
        summary,
        results: allResults,
        projectName: meta?.projectName,
        executionTrace, // Include execution trace for Results Explorer
      };

      const saveResult = await saveTestRun(testRun);

      if (saveResult.quotaError) {
        setState((prev) => ({
          ...prev,
          isRunning: false,
          completed: allResults.length,
          total: allResults.length,
          pendingRun: testRun,
          liveSummary: summary,
          liveResults: capResults(allResults),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isRunning: false,
          completed: allResults.length,
          total: allResults.length,
          finalRun: testRun,
          liveSummary: summary,
          liveResults: capResults(allResults),
          pendingRun: null,
        }));
      }
    };

    const fail = (error: string) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        isRunning: false,
        error,
      }));
    };

    return {
      reportProgress,
      complete,
      fail,
      abortSignal: abortRef.current.signal,
    };
  }, [flushToState]);

  return { ...state, execute, abort, confirmSavePendingRun, dismissPendingRun, startExternalExecution };
}
