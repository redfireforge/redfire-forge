/**
 * useGraphqlHistory — Phase 3A (task 3A-1)
 *
 * IndexedDB-backed ring buffer of executed GraphQL operations, per-connection.
 * Features:
 *  - max `historyMaxItems` entries per connection (default 100, range 10–500)
 *  - FIFO eviction per connection when limit exceeded
 *  - `response` stored as JSON string capped at 512KB
 *  - in-memory "recent" cache: top 5 most recently executed items
 *  - load / save / delete / clear / search
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  idbSaveHistoryItem,
  idbLoadHistory,
  idbDeleteHistoryItem,
  idbClearHistory,
  RESPONSE_CAP_BYTES,
} from '@shared/utils/idbGraphqlHistory';
import { GQL_HISTORY_RELOAD_EVENT } from '../utils/gqlDemoCollectionsCleanup';
import type { GraphqlHistoryItem, GraphqlOperation, GraphqlResponse } from '@shared/types/graphql';
import { filterHistoryItems } from '../utils/historyCompare';
import { deriveExecutionStatusFromGraphqlResponse } from '../utils/syncBatchResultsToTabResponses';

export const DEFAULT_MAX_ITEMS = 100;
export const RECENT_COUNT = 5;

export interface UseGraphqlHistoryResult {
  /** All history items for the current connection, newest-first */
  items: GraphqlHistoryItem[];
  /** Top-N most recently executed items (subset of `items`) */
  recentItems: GraphqlHistoryItem[];
  /** Save a new history entry. Constructs the HistoryItem from raw execution data. */
  saveHistory: (params: SaveHistoryParams) => Promise<void>;
  /** Delete a single history entry by id */
  deleteItem: (id: string) => Promise<void>;
  /** Clear all history for the current connection */
  clearAll: () => Promise<void>;
  /** Filter items by name, query, variables JSON, or response body (client-side, case-insensitive) */
  search: (query: string) => GraphqlHistoryItem[];
  /** True while loading initial history from IDB */
  loading: boolean;
}

export interface SaveHistoryParams {
  connectionId: string;
  operation: GraphqlOperation;
  response: GraphqlResponse;
}

export function useGraphqlHistory(
  connectionId: string | null | undefined,
  maxItems = DEFAULT_MAX_ITEMS,
): UseGraphqlHistoryResult {
  const [items, setItems] = useState<GraphqlHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const prevConnectionIdRef = useRef<string | null | undefined>(null);

  const clampedMax = Math.max(10, Math.min(500, maxItems));

  // Keep a ref so async load callbacks can read the latest clampedMax without
  // needing to add it to the connection-load effect's dependency array.
  const clampedMaxRef = useRef(clampedMax);
  clampedMaxRef.current = clampedMax;

  // Trim in-memory history when maxItems is lowered by the user.
  // IDB eviction happens naturally on the next save; this effect keeps the
  // displayed list in sync immediately when the setting changes.
  useEffect(() => {
    setItems((prev) => prev.length > clampedMax ? prev.slice(0, clampedMax) : prev);
  }, [clampedMax]);

  // Reload history when connection changes; clear when connectionId becomes falsy.
  useEffect(() => {
    if (!connectionId) {
      prevConnectionIdRef.current = connectionId;
      setItems([]);
      // Ensure the loading spinner doesn't get stuck if a load was in flight for
      // the previous connection. The stale-connection guard in the async callbacks
      // below prevents them from calling setLoading(false) for this new null state,
      // so we clear it explicitly here.
      setLoading(false);
      return;
    }
    prevConnectionIdRef.current = connectionId;
    setLoading(true);
    // Capture connectionId before the async boundary so a rapid A→B connection
    // switch cannot apply A's history to B's in-memory state.
    const loadingFor = connectionId;
    idbLoadHistory(loadingFor)
      .then((loaded) => {
        if (prevConnectionIdRef.current === loadingFor) {
          // Cap to current maxItems immediately on load so the UI always respects
          // the configured limit, even before the next save triggers IDB eviction.
          setItems(loaded.slice(0, clampedMaxRef.current));
        }
      })
      .catch(() => {
        if (prevConnectionIdRef.current === loadingFor) setItems([]);
      })
      .finally(() => {
        if (prevConnectionIdRef.current === loadingFor) setLoading(false);
      });
  }, [connectionId]);

  useEffect(() => {
    const reloadForCurrent = () => {
      if (!connectionId) {
        setItems([]);
        return;
      }
      const loadingFor = connectionId;
      idbLoadHistory(loadingFor)
        .then((loaded) => {
          if (prevConnectionIdRef.current === loadingFor) {
            setItems(loaded.slice(0, clampedMaxRef.current));
          }
        })
        .catch(() => {
          if (prevConnectionIdRef.current === loadingFor) setItems([]);
        });
    };
    window.addEventListener(GQL_HISTORY_RELOAD_EVENT, reloadForCurrent);
    return () => window.removeEventListener(GQL_HISTORY_RELOAD_EVENT, reloadForCurrent);
  }, [connectionId]);

  const saveHistory = useCallback(async ({ connectionId: cid, operation, response }: SaveHistoryParams) => {
    if (!cid) return;
    let serialized = JSON.stringify(response);
    // Cap response in-memory to match the IDB 512KB limit, so the React state
    // never holds a larger string than what is persisted.
    if (new Blob([serialized]).size > RESPONSE_CAP_BYTES) {
      const encoder = new TextEncoder();
      while (new Blob([serialized]).size > RESPONSE_CAP_BYTES - 64) {
        const excess = encoder.encode(serialized).length - (RESPONSE_CAP_BYTES - 64);
        serialized = serialized.slice(0, Math.max(0, serialized.length - Math.ceil(excess / 2)));
      }
      serialized = serialized + '\n__TRUNCATED__';
    }
    const status: GraphqlHistoryItem['status'] =
      deriveExecutionStatusFromGraphqlResponse(response);
    const item: GraphqlHistoryItem = {
      id: crypto.randomUUID(),
      connectionId: cid,
      operation,
      response: serialized,
      timestamp: response.timestamp,
      latencyMs: response.latencyMs,
      status,
    };
    try {
      await idbSaveHistoryItem(item, clampedMax);
      if (cid === prevConnectionIdRef.current) {
        setItems((prev) => {
          const updated = [item, ...prev];
          return updated.slice(0, clampedMax);
        });
      }
    } catch { /* IDB unavailable — silent */ }
  }, [clampedMax]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await idbDeleteHistoryItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch { /* silent */ }
  }, []);

  const clearAll = useCallback(async () => {
    if (!connectionId) return;
    // Capture the connection before the async boundary. If the user switches
    // connections while idbClearHistory is in flight, we must not wipe the new
    // connection's in-memory history when the old IDB call resolves.
    const clearingFor = connectionId;
    try {
      await idbClearHistory(clearingFor);
      if (prevConnectionIdRef.current === clearingFor) setItems([]);
    } catch { /* silent */ }
  }, [connectionId]);

  const search = useCallback((query: string): GraphqlHistoryItem[] => {
    return filterHistoryItems(items, query);
  }, [items]);

  const recentItems = useMemo(() => items.slice(0, RECENT_COUNT), [items]);

  return { items, recentItems, saveHistory, deleteItem, clearAll, search, loading };
}
