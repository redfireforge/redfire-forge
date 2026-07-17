import { useCallback, useState } from 'react';

const STORAGE_KEY = 'gql_history_max_items';
const DEFAULT_MAX = 100;

function readPersistedMax(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n)) return Math.max(10, Math.min(500, n));
    }
  } catch { /* silent */ }
  return DEFAULT_MAX;
}

/** Persisted GraphQL history list size (10–500 items). */
export function useGraphqlHistoryMaxItems() {
  const [historyMaxItems, setHistoryMaxItems] = useState<number>(readPersistedMax);

  const handleHistoryMaxItemsChange = useCallback((n: number) => {
    setHistoryMaxItems(n);
    try { localStorage.setItem(STORAGE_KEY, String(n)); } catch { /* silent */ }
  }, []);

  return { historyMaxItems, handleHistoryMaxItemsChange };
}
