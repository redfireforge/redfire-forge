import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestConfig, RequestResult, TestSummary, TestRun } from '../types';
import { runTest } from '../engine/executor';
import { computeMetrics } from '../engine/metrics';
import { saveTestRun, forceSaveTestRun } from '../utils/storage';

interface TestExecutionState {
  isRunning: boolean;
  completed: number;
  total: number;
  liveResults: RequestResult[];
  liveSummary: TestSummary | null;
  finalRun: TestRun | null;
  error: string | null;
  pendingRun: TestRun | null;
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
  });

  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const execute = useCallback(async (config: TestConfig, scenarios: Scenario[], meta?: { envName?: string; svcName?: string; baseUrl?: string }) => {
    abortRef.current = new AbortController();
    startTimeRef.current = performance.now();

    setState({
      isRunning: true,
      completed: 0,
      total: config.totalTransactions,
      liveResults: [],
      liveSummary: null,
      finalRun: null,
      error: null,
      pendingRun: null,
    });

    try {
      const results = await runTest(
        config,
        scenarios,
        (completed, total, allResults) => {
          const elapsed = performance.now() - startTimeRef.current;
          const summary = computeMetrics(allResults, elapsed);
          setState((prev) => ({
            ...prev,
            completed,
            total,
            liveResults: allResults,
            liveSummary: summary,
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
        envName: meta?.envName,
        svcName: meta?.svcName,
        baseUrl: meta?.baseUrl,
      };

      const saveResult = saveTestRun(testRun);

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

  const confirmSavePendingRun = useCallback(() => {
    setState((prev) => {
      if (!prev.pendingRun) return prev;
      const result = forceSaveTestRun(prev.pendingRun);
      if (result.ok) {
        return { ...prev, finalRun: prev.pendingRun, pendingRun: null };
      }
      return { ...prev, error: 'Storage is full. Please clear data manually in Settings → Storage.', pendingRun: null };
    });
  }, []);

  const dismissPendingRun = useCallback(() => {
    setState((prev) => ({ ...prev, pendingRun: null }));
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { ...state, execute, abort, confirmSavePendingRun, dismissPendingRun };
}
