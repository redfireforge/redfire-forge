/**
 * useGraphqlBatchExecution — manages Phase 3F batch query execution.
 *
 * Handles:
 *  - Per-tab batch-checked state (batchTabOverrides)
 *  - Batch execution via `/api/graphql/batch` proxy
 *  - Batch timeout handling with partial results
 *  - Batch unsupported detection + per-connection persistence
 *  - Complexity gate modal state (complexityGatePending)
 *
 * Extracted from GraphqlStudioPage.tsx to reduce its line count.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { GraphqlAuth, GraphqlBatchResult, GraphqlError, GraphqlEnvironment } from '../../../shared/types/graphql';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { AdvancedSettingsValues } from '../components/GraphqlAdvancedSettings';
import { buildAuthHeaders } from '../utils/authUtils';
import { findUnresolvedVars, resolveVars } from '../utils/envUtils';
import { readKey, writeKey } from '../../../shared/utils/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseGraphqlBatchExecutionParams {
  tabs: GqlStudioTab[];
  endpoint: string;
  auth: GraphqlAuth | null;
  activeEnvironment: GraphqlEnvironment | null;
  skipTlsVerify: boolean;
  advSettingsRef: React.RefObject<AdvancedSettingsValues>;
  connectionIdRef: React.RefObject<string | null>;
  setAdvSettings: React.Dispatch<React.SetStateAction<AdvancedSettingsValues>>;
  setBatchUnsupportedToast: (v: boolean) => void;
  setRightView: (view: 'response' | 'schema') => void;
  gqlProxyBase: string;
}

export interface UseGraphqlBatchExecutionResult {
  batchResult: GraphqlBatchResult | null;
  setBatchResult: React.Dispatch<React.SetStateAction<GraphqlBatchResult | null>>;
  batchExecuting: boolean;
  batchExecutingRef: React.RefObject<boolean>;
  complexityGatePending: boolean;
  setComplexityGatePending: React.Dispatch<React.SetStateAction<boolean>>;
  pendingExecuteAfterGateRef: React.RefObject<(() => void) | null>;
  skipComplexityGateRef: React.RefObject<boolean>;
  sessionBypassComplexityGateRef: React.RefObject<boolean>;
  batchTabOverrides: Map<string, boolean>;
  effectiveBatchedTabs: GqlStudioTab[];
  batchedTabIdsSet: Set<string>;
  handleToggleBatch: (tabId: string) => void;
  handleSendBatch: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGraphqlBatchExecution({
  tabs,
  endpoint,
  auth,
  activeEnvironment,
  skipTlsVerify,
  advSettingsRef,
  connectionIdRef,
  setAdvSettings,
  setBatchUnsupportedToast,
  setRightView,
  gqlProxyBase,
}: UseGraphqlBatchExecutionParams): UseGraphqlBatchExecutionResult {
  const [batchResult, setBatchResult] = useState<GraphqlBatchResult | null>(null);
  const [batchExecuting, setBatchExecuting] = useState(false);
  const batchExecutingRef = useRef(false);
  if (!batchExecuting) batchExecutingRef.current = false;

  const [complexityGatePending, setComplexityGatePending] = useState(false);
  const pendingExecuteAfterGateRef = useRef<(() => void) | null>(null);
  const skipComplexityGateRef = useRef(false);
  const sessionBypassComplexityGateRef = useRef(false);

  const [batchTabOverrides, setBatchTabOverrides] = useState<Map<string, boolean>>(new Map());

  const handleToggleBatch = useCallback((tabId: string) => {
    setBatchTabOverrides((prev) => {
      const next = new Map(prev);
      next.set(tabId, !(prev.get(tabId) ?? false));
      return next;
    });
  }, []);

  const effectiveBatchedTabs = useMemo(
    () => tabs.filter((t) => batchTabOverrides.get(t.id) === true && t.operationType !== 'subscription'),
    [tabs, batchTabOverrides],
  );

  const batchedTabIdsSet = useMemo(
    () => new Set(effectiveBatchedTabs.map((t) => t.id)),
    [effectiveBatchedTabs],
  );

  const handleSendBatch = useCallback(() => {
    if (effectiveBatchedTabs.length < 2 || batchExecuting || batchExecutingRef.current) return;
    if (!endpoint.trim()) return;
    if (findUnresolvedVars(endpoint, activeEnvironment).length > 0) return;
    if (effectiveBatchedTabs.some((t) => !t.query.trim())) return;

    batchExecutingRef.current = true;
    setBatchExecuting(true);
    setBatchResult(null);

    const batchConnId = connectionIdRef.current;
    const resolvedEndpoint = resolveVars(endpoint, activeEnvironment);
    const authH = buildAuthHeaders(auth);

    const buildTabHeaders = (tab: GqlStudioTab): Record<string, string> => {
      const tabHeaderMap: Record<string, string> = {};
      for (const h of tab.headers) {
        if (h.enabled && h.key.trim()) tabHeaderMap[h.key.trim()] = h.value;
      }
      const merged: Record<string, string> = {};
      for (const [k, v] of Object.entries({ ...authH, ...tabHeaderMap })) {
        merged[k] = resolveVars(v, activeEnvironment);
      }
      return merged;
    };

    const resolvedHeaders = buildTabHeaders(effectiveBatchedTabs[0]!);

    const batchOperations = effectiveBatchedTabs.map((t) => ({
      query: t.query,
      variables: (() => {
        try {
          const trimmed = resolveVars(t.variables, activeEnvironment).trim();
          if (trimmed && trimmed !== '{}') return JSON.parse(trimmed) as unknown;
          return undefined;
        } catch { return undefined; }
      })(),
      operationName: t.selectedOperation,
      headers: buildTabHeaders(t),
    }));

    void (async () => {
      try {
        const resp = await fetch(`${gqlProxyBase}/api/graphql/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: resolvedEndpoint,
            operations: batchOperations,
            headers: resolvedHeaders,
            skipTlsVerify,
            tryArrayBatch: !advSettingsRef.current.batchUnsupportedDetected,
            batchTimeoutMs: advSettingsRef.current.batchTimeoutMs,
          }),
        });

        const json = await resp.json() as {
          results: Array<{ data?: unknown; errors?: unknown[]; _httpStatus?: number; _index?: number }>;
          batchUnsupported?: boolean;
          error?: string;
        };

        if (resp.status === 408) {
          const rawMs = advSettingsRef.current.batchTimeoutMs;
          const displayMs = Number.isFinite(rawMs) && rawMs > 0 ? rawMs : 30000;
          const displayLabel = displayMs >= 1000 ? `${displayMs / 1000}s` : `${displayMs}ms`;
          const partialResults = Array.isArray(json.results) && json.results.length > 0
            ? json.results
            : null;
          setBatchResult({
            batchUnsupported: json.batchUnsupported === true,
            results: effectiveBatchedTabs.map((_, i) => {
              const partial = partialResults?.[i];
              if (partial && partial._httpStatus !== 408) {
                return {
                  index: i,
                  operationName: effectiveBatchedTabs[i]?.selectedOperation ?? effectiveBatchedTabs[i]?.label,
                  response: {
                    data: (partial.data as unknown) ?? null,
                    errors: Array.isArray(partial.errors) ? partial.errors as GraphqlError[] : undefined,
                    httpStatus: typeof partial._httpStatus === 'number' ? partial._httpStatus : 200,
                    httpHeaders: {},
                    latencyMs: 0,
                    timestamp: Date.now(),
                  },
                };
              }
              return {
                index: i,
                operationName: effectiveBatchedTabs[i]?.selectedOperation ?? effectiveBatchedTabs[i]?.label,
                response: {
                  data: null,
                  errors: [{ message: `Batch timed out after ${displayLabel}` }],
                  httpStatus: 408,
                  httpHeaders: {},
                  latencyMs: displayMs,
                  timestamp: Date.now(),
                },
              };
            }),
          });
          setRightView('response');
          return;
        }

        const batchResults: GraphqlBatchResult = {
          batchUnsupported: json.batchUnsupported === true,
          results: (json.results ?? []).map((r, i) => ({
            index: i,
            operationName: effectiveBatchedTabs[i]?.selectedOperation ?? effectiveBatchedTabs[i]?.label,
            response: {
              data: (r.data as unknown) ?? null,
              errors: Array.isArray(r.errors) ? r.errors as GraphqlError[] : undefined,
              httpStatus: typeof r._httpStatus === 'number' ? r._httpStatus : 200,
              httpHeaders: {},
              latencyMs: 0,
              timestamp: Date.now(),
            },
          })),
        };

        if (json.batchUnsupported && !advSettingsRef.current.batchUnsupportedDetected) {
          setAdvSettings((prev) => ({ ...prev, batchUnsupportedDetected: true }));
          setBatchUnsupportedToast(true);
          if (batchConnId) {
            void readKey(`gql_conn_detection_${batchConnId}`)
              .then((raw) => {
                const existing = raw ? (JSON.parse(raw) as { apq?: boolean; batch?: boolean }) : {};
                return writeKey(`gql_conn_detection_${batchConnId}`, JSON.stringify({ ...existing, batch: true }));
              })
              .catch(() => { /* no-op */ });
          }
        }

        setBatchResult(batchResults);
        setRightView('response');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Batch request failed';
        setBatchResult({
          batchUnsupported: false,
          results: effectiveBatchedTabs.map((_, i) => ({
            index: i,
            response: {
              data: null,
              errors: [{ message: msg }],
              httpStatus: 0,
              httpHeaders: {},
              latencyMs: 0,
              timestamp: Date.now(),
            },
          })),
        });
      } finally {
        setBatchExecuting(false);
      }
    })();
  }, [effectiveBatchedTabs, batchExecuting, endpoint, activeEnvironment, auth,
    skipTlsVerify, setRightView, advSettingsRef, connectionIdRef, setAdvSettings,
    setBatchUnsupportedToast, gqlProxyBase]);

  return {
    batchResult,
    setBatchResult,
    batchExecuting,
    batchExecutingRef,
    complexityGatePending,
    setComplexityGatePending,
    pendingExecuteAfterGateRef,
    skipComplexityGateRef,
    sessionBypassComplexityGateRef,
    batchTabOverrides,
    effectiveBatchedTabs,
    batchedTabIdsSet,
    handleToggleBatch,
    handleSendBatch,
  };
}
