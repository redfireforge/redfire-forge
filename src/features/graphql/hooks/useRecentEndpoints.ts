/**
 * useRecentEndpoints.ts — Phase 1D
 *
 * Manages a persisted list of recently used GraphQL endpoints.
 * Uses the shared storage abstraction (readKey/writeKey) for Tauri compatibility.
 * Exposes push/remove helpers and the current list for the endpoint dropdown.
 */

import { useCallback, useEffect, useState } from 'react';
import { readKey, writeKey } from '@shared/utils/storage';

const STORAGE_KEY = 'gql_recent_endpoints_v1';
const MAX_RECENT  = 10;

function saveEndpoints(list: string[]): void {
  writeKey(STORAGE_KEY, JSON.stringify(list)).catch(() => { /* quota / unavailable */ });
}

export interface UseRecentEndpoints {
  endpoints: string[];
  /** Add an endpoint to the front, deduplicate, cap at MAX_RECENT */
  push: (url: string) => void;
  /** Remove a specific endpoint from the list */
  remove: (url: string) => void;
  /** Clear all recent endpoints */
  clear: () => void;
}

export function useRecentEndpoints(): UseRecentEndpoints {
  const [endpoints, setEndpoints] = useState<string[]>([]);

  // Load from storage on mount
  useEffect(() => {
    readKey(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        setEndpoints((parsed as unknown[]).filter((e): e is string => typeof e === 'string'));
      } catch { /* corrupt data — ignore */ }
    }).catch(() => { /* storage unavailable */ });
  }, []);

  const push = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setEndpoints((prev) => {
      const deduped = [trimmed, ...prev.filter((e) => e !== trimmed)].slice(0, MAX_RECENT);
      saveEndpoints(deduped);
      return deduped;
    });
  }, []);

  const remove = useCallback((url: string) => {
    setEndpoints((prev) => {
      const updated = prev.filter((e) => e !== url);
      saveEndpoints(updated);
      return updated;
    });
  }, []);

  const clear = useCallback(() => {
    setEndpoints([]);
    saveEndpoints([]);
  }, []);

  return { endpoints, push, remove, clear };
}
