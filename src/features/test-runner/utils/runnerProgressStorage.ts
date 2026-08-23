import type { ExecutionMode, LoadProfileConfig, LoadProfileType, TestSummary, ThinkTimeConfig, ArrivalRateConfig } from '@shared/types';
import type { TimeSeriesPoint } from '../hooks/useTestExecution';
import type { ProgressMeta } from '@engine/executor';

export interface PersistedProgress {
  summary: TestSummary;
  timeSeries: TimeSeriesPoint[];
  completed: number;
  total: number;
  profileMeta: ProgressMeta | null;
  isTimeBased: boolean;
  executionMode: ExecutionMode;
  concurrency: number;
  loadProfile: LoadProfileConfig;
  arrivalRate?: ArrivalRateConfig;
  thinkTime?: ThinkTimeConfig;
  resultCount: number;
  durationMs: number;
}

export function thinkTimeLabel(cfg?: ThinkTimeConfig): string | null {
  if (!cfg || cfg.mode === 'none') return null;
  switch (cfg.mode) {
    case 'constant': return `Think: ${cfg.constantMs ?? 1000}ms`;
    case 'uniform': return `Think: ${cfg.minMs ?? 500}–${cfg.maxMs ?? 2000}ms`;
    case 'gaussian': return `Think: μ${cfg.meanMs ?? 1000}ms σ${cfg.stdDevMs ?? 300}ms`;
    default: return null;
  }
}

export const profileDescriptions: Record<LoadProfileType, string> = {
  'ramp-up': 'Gradually increase from 1 to N concurrent users over a ramp period, then sustain',
  sustained: 'Maintain a constant number of concurrent users for the full duration',
  spike: 'Run at base concurrency, then burst to a peak for a short window',
};

const PROGRESS_STORAGE_KEY = 'perf-test-last-progress';

export function saveProgress(key: string, data: PersistedProgress) {
  try {
    localStorage.setItem(`${PROGRESS_STORAGE_KEY}:${key}`, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function loadProgress(key: string): PersistedProgress | null {
  try {
    const raw = localStorage.getItem(`${PROGRESS_STORAGE_KEY}:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearProgress(key: string) {
  try {
    localStorage.removeItem(`${PROGRESS_STORAGE_KEY}:${key}`);
  } catch {
    /* ignore */
  }
}
