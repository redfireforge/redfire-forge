import { useState, useCallback, useRef, useEffect } from 'react';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import type { LogLine } from '../../../shared/types/server-api';

export type { LogLine as ConsoleLine };

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

export function useResponseCache(requestId: string) {
  const cacheRef = useRef<Map<string, CachedResponse>>(new Map());
  const prevReqId = useRef<string>(requestId);

  const getCached = useCallback((): CachedResponse => {
    return cacheRef.current.get(requestId) ?? EMPTY_CACHED;
  }, [requestId]);

  const updateCache = useCallback(<K extends keyof CachedResponse>(key: K, val: CachedResponse[K]) => {
    const c = cacheRef.current.get(requestId) ?? EMPTY_CACHED;
    cacheRef.current.set(requestId, { ...c, [key]: val });
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
    const prev = cacheRef.current.get(requestId)?.history ?? [];
    const next = [full, ...prev].slice(0, MAX_HISTORY);
    updateCache('history', next);
    _setHistory(next);
    return id;
  }, [requestId, updateCache]);

  const restoreFromHistory = useCallback((entryId: string) => {
    const cached = cacheRef.current.get(requestId);
    const entry = cached?.history.find(h => h.id === entryId);
    if (!entry) return;
    setResponse(entry.response);
    setResponseTime(entry.responseTime);
    setConsoleLines(entry.consoleLines);
    setSendAllResults(null);
  }, [requestId, setResponse, setResponseTime, setConsoleLines, setSendAllResults]);

  const deleteHistoryEntry = useCallback((entryId: string) => {
    const prev = cacheRef.current.get(requestId)?.history ?? [];
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
