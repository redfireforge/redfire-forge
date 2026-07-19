import { useState, useCallback, useRef, useEffect } from 'react';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import type { LogLine } from '../../../shared/types/server-api';

type ConsoleLine = LogLine;
export type { ConsoleLine };

export interface ResponseHistoryEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  response: HttpResponse;
  responseTime: number;
  consoleLines: ConsoleLine[];
}

export type CachedResponse = {
  response: HttpResponse | null;
  responseTime: number;
  sendAllResults: { envName: string; response: HttpResponse; time: number }[] | null;
  consoleLines: ConsoleLine[];
  history: ResponseHistoryEntry[];
};

const MAX_HISTORY = 10;

const EMPTY_CACHED: CachedResponse = { response: null, responseTime: 0, sendAllResults: null, consoleLines: [], history: [] };

let _historyIdCounter = 0;

// ─── Module-level singleton ─────────────────────────────────────
// Survives component unmounts and tab switches. Keyed by requestId.
const _cache = new Map<string, CachedResponse>();

/**
 * Remove cached response data for a single request.
 * Call from closeTab() or deleteRequest() to prevent unbounded growth.
 */
export function pruneResponseCache(requestId: string): void {
  _cache.delete(requestId);
}

/**
 * Remove cached response data for every request in the given set.
 * Call when an entire collection is deleted.
 */
export function pruneResponseCacheMany(requestIds: Iterable<string>): void {
  for (const id of requestIds) _cache.delete(id);
}

/** Read-only access for testing. */
export function _getResponseCacheSize(): number {
  return _cache.size;
}

/** Reset the singleton — ONLY for tests. */
export function _resetResponseCache(): void {
  _cache.clear();
}

// ─── Hook ───────────────────────────────────────────────────────

export function useResponseCache(requestId: string) {
  const prevReqId = useRef<string>(requestId);

  const getCached = useCallback((): CachedResponse => {
    return _cache.get(requestId) ?? EMPTY_CACHED;
  }, [requestId]);

  const updateCache = useCallback(<K extends keyof CachedResponse>(key: K, val: CachedResponse[K]) => {
    const c = _cache.get(requestId) ?? EMPTY_CACHED;
    _cache.set(requestId, { ...c, [key]: val });
  }, [requestId]);

  const [response, _setResponse] = useState<HttpResponse | null>(() => getCached().response);
  const [responseTime, _setResponseTime] = useState(() => getCached().responseTime);
  const [sendAllResults, _setSendAllResults] = useState<CachedResponse['sendAllResults']>(() => getCached().sendAllResults);
  const [consoleLines, _setConsoleLines] = useState<ConsoleLine[]>(() => getCached().consoleLines);
  const [history, _setHistory] = useState<ResponseHistoryEntry[]>(() => getCached().history);

  const setResponse = useCallback((r: HttpResponse | null) => { _setResponse(r); updateCache('response', r); }, [updateCache]);
  const setResponseTime = useCallback((t: number) => { _setResponseTime(t); updateCache('responseTime', t); }, [updateCache]);
  const setSendAllResults = useCallback((r: CachedResponse['sendAllResults']) => { _setSendAllResults(r); updateCache('sendAllResults', r); }, [updateCache]);
  const setConsoleLines = useCallback((l: ConsoleLine[]) => { _setConsoleLines(l); updateCache('consoleLines', l); }, [updateCache]);

  const pushHistory = useCallback((entry: Omit<ResponseHistoryEntry, 'id'>): string => {
    const id = `rh-${++_historyIdCounter}-${Date.now()}`;
    const full: ResponseHistoryEntry = { ...entry, id };
    const prev = _cache.get(requestId)?.history ?? [];
    const next = [full, ...prev].slice(0, MAX_HISTORY);
    updateCache('history', next);
    _setHistory(next);
    return id;
  }, [requestId, updateCache]);

  const restoreFromHistory = useCallback((entryId: string) => {
    const cached = _cache.get(requestId);
    const entry = cached?.history.find(h => h.id === entryId);
    if (!entry) return;
    setResponse(entry.response);
    setResponseTime(entry.responseTime);
    setConsoleLines(entry.consoleLines);
    setSendAllResults(null);
  }, [requestId, setResponse, setResponseTime, setConsoleLines, setSendAllResults]);

  const deleteHistoryEntry = useCallback((entryId: string) => {
    const prev = _cache.get(requestId)?.history ?? [];
    const next = prev.filter(h => h.id !== entryId);
    updateCache('history', next);
    _setHistory(next);
  }, [requestId, updateCache]);

  const clearHistory = useCallback(() => {
    updateCache('history', []);
    _setHistory([]);
    setResponse(null);
    setResponseTime(0);
    setConsoleLines([]);
    setSendAllResults(null);
  }, [updateCache, setResponse, setResponseTime, setConsoleLines, setSendAllResults]);

  const syncFromCache = useCallback(() => {
    const cached = getCached();
    _setResponse(cached.response);
    _setResponseTime(cached.responseTime);
    _setSendAllResults(cached.sendAllResults);
    _setConsoleLines(cached.consoleLines);
    _setHistory(cached.history);
  }, [getCached]);

  useEffect(() => {
    if (prevReqId.current !== requestId) {
      prevReqId.current = requestId;
      syncFromCache();
    }
  }, [requestId, syncFromCache]);

  return {
    response, setResponse,
    responseTime, setResponseTime,
    sendAllResults, setSendAllResults,
    consoleLines, setConsoleLines,
    history, pushHistory, restoreFromHistory, deleteHistoryEntry, clearHistory,
  };
}
