import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestConfig, RequestResult, TestSummary, TestRun } from '../types';
import { runTest } from '../engine/executor';
import type { ProgressMeta } from '../engine/executor';
import { computeMetrics } from '../engine/metrics';
import { saveTestRun, forceSaveTestRun } from '../utils/storage';

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

  const execute = useCallback(async (config: TestConfig, scenarios: Scenario[], meta?: { projectName?: string; envName?: string; svcName?: string; baseUrl?: string }) => {
    abortRef.current = new AbortController();
    startTimeRef.current = performance.now();
    lastSnapshotRef.current = 0;
    prevCompletedRef.current = 0;
    prevSnapshotTimeRef.current = performance.now();

    setState({
      isRunning: true,
      completed: 0,
      total: config.executionMode === 'load-profile' ? -1 : config.totalTransactions,
      liveResults: [],
      liveSummary: null,
      finalRun: null,
      error: null,
      pendingRun: null,
      profileMeta: null,
      timeSeries: [],
    });

    try {
      const results = await runTest(
        config,
        scenarios,
        (completed, total, allResults, profileMeta) => {
          const now = performance.now();
          const elapsed = now - startTimeRef.current;
          const summary = computeMetrics(allResults, elapsed);

          const elapsedSec = Math.round(elapsed / 1000);
          let newPoint: TimeSeriesPoint | null = null;

          if (elapsedSec > lastSnapshotRef.current && allResults.length > 0) {
            const intervalMs = now - prevSnapshotTimeRef.current;
            const intervalCompleted = completed - prevCompletedRef.current;
            const intervalTps = intervalMs > 0 ? (intervalCompleted / intervalMs) * 1000 : 0;

            const recentWindow = allResults.slice(-Math.max(intervalCompleted, 1));
            const avgRecent = recentWindow.reduce((s, r) => s + r.responseTimeMs, 0) / recentWindow.length;

            const failedInWindow = recentWindow.filter(r => r.httpStatus >= 400 || r.httpStatus === 0).length;
            const errorPct = recentWindow.length > 0 ? (failedInWindow / recentWindow.length) * 100 : 0;

            newPoint = {
              elapsedSec,
              avgResponseTime: Math.round(avgRecent * 10) / 10,
              tps: Math.round(intervalTps * 10) / 10,
              errorRate: Math.round(errorPct * 10) / 10,
              concurrency: profileMeta?.currentInFlight ?? 0,
            };

            lastSnapshotRef.current = elapsedSec;
            prevCompletedRef.current = completed;
            prevSnapshotTimeRef.current = now;
          }

          setState((prev) => ({
            ...prev,
            completed,
            total,
            liveResults: allResults,
            liveSummary: summary,
            profileMeta: profileMeta ?? prev.profileMeta,
            timeSeries: newPoint ? [...prev.timeSeries, newPoint] : prev.timeSeries,
          }));
        },
        abortRef.current.signal
      );

      const totalDuration = performance.now() - startTimeRef.current;
      const summary = computeMetrics(results, totalDuration);
      const testRun: TestRun = {
        id: uuidv4(),
        timestamp: Date.now(),
        config,
        summary,
        results,
        projectName: meta?.projectName,
        envName: meta?.envName,
        svcName: meta?.svcName,
        baseUrl: meta?.baseUrl,
      };

      const saveResult = await saveTestRun(testRun);

      if (saveResult.quotaError) {
        setState((prev) => ({
          ...prev,
          isRunning: false,
          pendingRun: testRun,
          liveSummary: summary,
          liveResults: results,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isRunning: false,
          finalRun: testRun,
          liveSummary: summary,
          liveResults: results,
          pendingRun: null,
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isRunning: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

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

  return { ...state, execute, abort, confirmSavePendingRun, dismissPendingRun };
}
