import { useCallback, useEffect, useState } from 'react';
import type { WsConnectionHistoryEntry, WsProtocolMode } from '@shared/websocket/types';
import { loadWsHistory, MAX_HISTORY_ENTRIES, saveWsHistory } from '@shared/websocket/websocketStorage';

export interface UseWebSocketHistoryReturn {
  history: WsConnectionHistoryEntry[];
  addEntry: (url: string, protocol: WsProtocolMode) => void;
  removeEntry: (url: string) => void;
  clearHistory: () => void;
}

export function useWebSocketHistory(): UseWebSocketHistoryReturn {
  const [history, setHistory] = useState<WsConnectionHistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadWsHistory().then((loaded) => {
      if (!cancelled) setHistory(loaded);
    }).catch(() => {
      // storage read failed — keep empty history
    });
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback((next: WsConnectionHistoryEntry[]) => {
    setHistory(next);
    saveWsHistory(next);
  }, []);

  const addEntry = useCallback(
    (url: string, protocol: WsProtocolMode) => {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) return;
      setHistory((prev) => {
        const existing = prev.find((e) => e.url === trimmedUrl);
        const entry: WsConnectionHistoryEntry = {
          url: trimmedUrl,
          protocol,
          lastUsed: new Date().toISOString(),
          connectCount: existing ? existing.connectCount + 1 : 1,
        };
        const filtered = prev.filter((e) => e.url !== trimmedUrl);
        const next = [entry, ...filtered].slice(0, MAX_HISTORY_ENTRIES);
        saveWsHistory(next);
        return next;
      });
    },
    [],
  );

  const removeEntry = useCallback(
    (url: string) => {
      setHistory((prev) => {
        const next = prev.filter((e) => e.url !== url);
        saveWsHistory(next);
        return next;
      });
    },
    [],
  );

  const clearHistory = useCallback(() => {
    persist([]);
  }, [persist]);

  return { history, addEntry, removeEntry, clearHistory };
}
