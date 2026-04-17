import { useState, useCallback, useRef, useEffect } from 'react';
import type { HttpResponse } from '../utils/httpClient';

export interface ConsoleLine {
  prefix: '' | '*' | '>' | '<' | '#';
  text: string;
}

export type CachedResponse = {
  response: HttpResponse | null;
  responseTime: number;
  sendAllResults: { envName: string; response: HttpResponse; time: number }[] | null;
  consoleLines: ConsoleLine[];
};

const EMPTY_CACHED: CachedResponse = { response: null, responseTime: 0, sendAllResults: null, consoleLines: [] };

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

  const setResponse = useCallback((r: HttpResponse | null) => { _setResponse(r); updateCache('response', r); }, [updateCache]);
  const setResponseTime = useCallback((t: number) => { _setResponseTime(t); updateCache('responseTime', t); }, [updateCache]);
  const setSendAllResults = useCallback((r: CachedResponse['sendAllResults']) => { _setSendAllResults(r); updateCache('sendAllResults', r); }, [updateCache]);
  const setConsoleLines = useCallback((l: ConsoleLine[]) => { _setConsoleLines(l); updateCache('consoleLines', l); }, [updateCache]);

  const syncFromCache = useCallback(() => {
    const cached = getCached();
    _setResponse(cached.response);
    _setResponseTime(cached.responseTime);
    _setSendAllResults(cached.sendAllResults);
    _setConsoleLines(cached.consoleLines);
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
  };
}
