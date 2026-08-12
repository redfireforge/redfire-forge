import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiMockConsoleLine {
  ts?: string;
  level?: string;
  message: string;
}

const MAX_LINES = 300;

/**
 * Subscribes to the companion's SSE log stream and collects API Mock lines.
 * The stream carries all server logs; we keep only `source === 'api-mock'`.
 * Safe when the companion is down or EventSource is unavailable (tests/SSR).
 */
export function useApiMockConsole(active: boolean): { lines: ApiMockConsoleLine[]; clear: () => void } {
  const [lines, setLines] = useState<ApiMockConsoleLine[]>([]);
  const clearedAtRef = useRef(0);

  const clear = useCallback(() => {
    setLines([]);
    clearedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!active || typeof EventSource === 'undefined') return;
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/logs/stream');
      es.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data) as { source?: string; ts?: string; level?: string; message?: string; text?: string };
          if (raw?.source !== 'api-mock') return;
          const line: ApiMockConsoleLine = { ts: raw.ts, level: raw.level, message: raw.message ?? raw.text ?? '' };
          setLines(prev => {
            const next = [...prev, line];
            return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
          });
        } catch { /* ignore malformed lines */ }
      };
      es.onerror = () => { /* companion may be down; EventSource retries automatically */ };
    } catch { /* EventSource unavailable */ }
    return () => { es?.close(); };
  }, [active]);

  return { lines, clear };
}
