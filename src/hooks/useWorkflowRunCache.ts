import { useState, useCallback, useRef, useEffect } from 'react';
import type { NodeRunStatus } from '../types/workflow';
import type { ConsoleLine } from './useResponseCache';

export interface WorkflowRunStepSummary {
  nodeId: string;
  label: string;
  state: 'pass' | 'fail' | 'skipped';
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
}

export interface WorkflowRunHistoryEntry {
  id: string;
  timestamp: number;
  durationMs: number;
  passed: boolean;
  nodeStatuses: Record<string, NodeRunStatus>;
  variableSnapshot: Record<string, string> | null;
  stepsExecuted: number;
  stepSummaries: WorkflowRunStepSummary[];
  error: string | null;
}

export interface CachedWorkflowRun {
  nodeStatuses: Record<string, NodeRunStatus>;
  lastRunStatus: 'idle' | 'running' | 'pass' | 'fail';
  lastRunTime: number | undefined;
  lastRunError: string | null;
  runVariableSnapshot: Record<string, string> | null;
  history: WorkflowRunHistoryEntry[];
  consoleLines: ConsoleLine[];
}

const MAX_HISTORY = 10;
const MAX_CONSOLE_LINES = 500;
let _historyIdCounter = 0;

const STORAGE_KEY = 'rfg-workflow-run-cache';

function loadCacheFromStorage(): Map<string, CachedWorkflowRun> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const entries: [string, CachedWorkflowRun][] = JSON.parse(raw);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveCacheToStorage(cache: Map<string, CachedWorkflowRun>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...cache.entries()]));
  } catch { /* quota exceeded – ignore */ }
}

const EMPTY_CACHED: CachedWorkflowRun = {
  nodeStatuses: {},
  lastRunStatus: 'idle',
  lastRunTime: undefined,
  lastRunError: null,
  runVariableSnapshot: null,
  history: [],
  consoleLines: [],
};

/**
 * Caches workflow run state (node statuses, run history) across workflow switches.
 * Uses an in-memory Map keyed by workflowId — similar to useResponseCache.
 */
export function useWorkflowRunCache(workflowId: string | null) {
  const cacheRef = useRef<Map<string, CachedWorkflowRun>>(loadCacheFromStorage());

  const getCached = useCallback((): CachedWorkflowRun => {
    if (!workflowId) return EMPTY_CACHED;
    const raw = cacheRef.current.get(workflowId);
    if (!raw) return EMPTY_CACHED;
    return { ...EMPTY_CACHED, ...raw };
  }, [workflowId]);

  const updateCache = useCallback(<K extends keyof CachedWorkflowRun>(key: K, val: CachedWorkflowRun[K]) => {
    if (!workflowId) return;
    const c = cacheRef.current.get(workflowId) ?? { ...EMPTY_CACHED };
    cacheRef.current.set(workflowId, { ...c, [key]: val });
    saveCacheToStorage(cacheRef.current);
  }, [workflowId]);

  const [nodeStatuses, _setNodeStatuses] = useState<Record<string, NodeRunStatus>>(() => getCached().nodeStatuses);
  const [lastRunStatus, _setLastRunStatus] = useState<CachedWorkflowRun['lastRunStatus']>(() => getCached().lastRunStatus);
  const [lastRunTime, _setLastRunTime] = useState<number | undefined>(() => getCached().lastRunTime);
  const [lastRunError, _setLastRunError] = useState<string | null>(() => getCached().lastRunError);
  const [runVariableSnapshot, _setRunVariableSnapshot] = useState<Record<string, string> | null>(() => getCached().runVariableSnapshot);
  const [history, _setHistory] = useState<WorkflowRunHistoryEntry[]>(() => getCached().history);
  const [consoleLines, _setConsoleLines] = useState<ConsoleLine[]>(() => getCached().consoleLines);

  const setNodeStatuses = useCallback((v: Record<string, NodeRunStatus> | ((prev: Record<string, NodeRunStatus>) => Record<string, NodeRunStatus>)) => {
    _setNodeStatuses(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      updateCache('nodeStatuses', next);
      return next;
    });
  }, [updateCache]);

  const setLastRunStatus = useCallback((v: CachedWorkflowRun['lastRunStatus']) => {
    _setLastRunStatus(v);
    updateCache('lastRunStatus', v);
  }, [updateCache]);

  const setLastRunTime = useCallback((v: number | undefined) => {
    _setLastRunTime(v);
    updateCache('lastRunTime', v);
  }, [updateCache]);

  const setLastRunError = useCallback((v: string | null) => {
    _setLastRunError(v);
    updateCache('lastRunError', v);
  }, [updateCache]);

  const setRunVariableSnapshot = useCallback((v: Record<string, string> | null) => {
    _setRunVariableSnapshot(v);
    updateCache('runVariableSnapshot', v);
  }, [updateCache]);

  // Sync state from cache when workflowId changes
  useEffect(() => {
    const cached = getCached();
    _setNodeStatuses(cached.nodeStatuses);
    _setLastRunStatus(cached.lastRunStatus);
    _setLastRunTime(cached.lastRunTime);
    _setLastRunError(cached.lastRunError);
    _setRunVariableSnapshot(cached.runVariableSnapshot);
    _setHistory(cached.history);
    _setConsoleLines(cached.consoleLines);
  }, [workflowId, getCached]);

  const pushHistory = useCallback((entry: Omit<WorkflowRunHistoryEntry, 'id'>): string => {
    const id = `wrh-${++_historyIdCounter}-${Date.now()}`;
    const full: WorkflowRunHistoryEntry = { ...entry, id };
    if (!workflowId) return id;
    const prev = cacheRef.current.get(workflowId)?.history ?? [];
    const next = [full, ...prev].slice(0, MAX_HISTORY);
    updateCache('history', next);
    _setHistory(next);
    return id;
  }, [workflowId, updateCache]);

  const restoreFromHistory = useCallback((entryId: string) => {
    if (!workflowId) return;
    const cached = cacheRef.current.get(workflowId);
    const entry = cached?.history.find(h => h.id === entryId);
    if (!entry) return;
    _setNodeStatuses(entry.nodeStatuses);
    updateCache('nodeStatuses', entry.nodeStatuses);
    _setLastRunStatus(entry.passed ? 'pass' : 'fail');
    updateCache('lastRunStatus', entry.passed ? 'pass' : 'fail');
    _setLastRunTime(entry.durationMs);
    updateCache('lastRunTime', entry.durationMs);
    _setLastRunError(entry.error);
    updateCache('lastRunError', entry.error);
    _setRunVariableSnapshot(entry.variableSnapshot);
    updateCache('runVariableSnapshot', entry.variableSnapshot);
  }, [workflowId, updateCache]);

  const deleteHistoryEntry = useCallback((entryId: string) => {
    if (!workflowId) return;
    const prev = cacheRef.current.get(workflowId)?.history ?? [];
    const next = prev.filter(h => h.id !== entryId);
    updateCache('history', next);
    _setHistory(next);
  }, [workflowId, updateCache]);

  const clearHistory = useCallback(() => {
    updateCache('history', []);
    _setHistory([]);
    setNodeStatuses({});
    setLastRunStatus('idle');
    setLastRunTime(undefined);
    setLastRunError(null);
    setRunVariableSnapshot(null);
    updateCache('consoleLines', []);
    _setConsoleLines([]);
  }, [updateCache, setNodeStatuses, setLastRunStatus, setLastRunTime, setLastRunError, setRunVariableSnapshot]);

  const pushConsoleLine = useCallback((line: ConsoleLine) => {
    _setConsoleLines(prev => {
      const next = [...prev, line].slice(-MAX_CONSOLE_LINES);
      updateCache('consoleLines', next);
      return next;
    });
  }, [updateCache]);

  const clearConsole = useCallback(() => {
    updateCache('consoleLines', []);
    _setConsoleLines([]);
  }, [updateCache]);

  return {
    nodeStatuses,
    setNodeStatuses,
    lastRunStatus,
    setLastRunStatus,
    lastRunTime,
    setLastRunTime,
    lastRunError,
    setLastRunError,
    runVariableSnapshot,
    setRunVariableSnapshot,
    history,
    pushHistory,
    restoreFromHistory,
    deleteHistoryEntry,
    clearHistory,
    consoleLines,
    pushConsoleLine,
    clearConsole,
  };
}
