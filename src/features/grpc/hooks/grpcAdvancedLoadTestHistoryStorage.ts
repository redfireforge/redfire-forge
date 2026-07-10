import type { GrpcTabLoadTestRunHistoryEntry } from '../grpcStudioAdvancedTypes';

export const GRPC_LOAD_TEST_HISTORY_LIMIT = 10;
export const GRPC_LOAD_TEST_HISTORY_STORAGE_KEY = 'grpc-load-test-run-history-v1';

interface PersistedGrpcLoadTestHistoryEnvelope {
  version: 1;
  tabHistory: Record<string, GrpcTabLoadTestRunHistoryEntry[]>;
  updatedAt: number;
}

export function readPersistedLoadTestHistoryByTab(): Record<string, GrpcTabLoadTestRunHistoryEntry[]> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(GRPC_LOAD_TEST_HISTORY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as PersistedGrpcLoadTestHistoryEnvelope;
    if (!parsed || parsed.version !== 1 || typeof parsed.tabHistory !== 'object') {
      return {};
    }
    return parsed.tabHistory;
  } catch {
    return {};
  }
}

export function writePersistedLoadTestHistoryByTab(
  tabHistory: Record<string, GrpcTabLoadTestRunHistoryEntry[]>,
): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const envelope: PersistedGrpcLoadTestHistoryEnvelope = {
      version: 1,
      tabHistory,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(GRPC_LOAD_TEST_HISTORY_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // localStorage persistence is best-effort only
  }
}
