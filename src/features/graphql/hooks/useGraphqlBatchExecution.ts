/**
 * useGraphqlBatchExecution — manages Phase 3F batch query execution.
 *
 * Phase 6G: tabs are grouped by resolved endpoint; checkboxes and Send Batch
 * count are scoped to the active group. Demo lessons filter groups to demo tabs only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphqlAuth, GraphqlBatchResult, GraphqlError, GraphqlEnvironment } from '../../../shared/types/graphql';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import type { AdvancedSettingsValues } from '../components/GraphqlAdvancedSettings';
import { buildAuthHeaders } from '../utils/authUtils';
import {
  buildBatchGroups,
  evaluateBatchEndpointParity,
  type BatchEndpointGroup,
} from '../utils/batchEndpointUtils';
import { findUnresolvedVars, resolveVars } from '../utils/envUtils';
import { readKey, writeKey } from '../../../shared/utils/storage';
import {
  resolveTabConnection,
  isTabProfileLinkPending,
  tabConnectionTls,
  type TabConnectionPageDefaults,
} from '../utils/tabConnectionResolution';
import { serializeGqlTlsForProxy } from '../../../shared/types/gqlTls';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseGraphqlBatchExecutionParams {
  tabs: GqlStudioTab[];
  activeTabId: string | null;
  /** When set, batch groups contain only demo tabs for this lesson (§11.0). */
  activeDemoLessonId?: string | null;
  /** Page-level default endpoint (before per-tab overrides). Phase 6A-8. */
  pageDefaultEndpoint: string;
  /** Saved connection profiles for endpoint resolution (Phase 6F). */
  profiles?: ConnectionProfile[];
  /** Page-level auth fallback for tabs without profile link (Phase 6F — not active-tab auth). */
  pageDefaultAuth: GraphqlAuth | null;
  activeEnvironment: GraphqlEnvironment | null;
  globalEnvMap?: Record<string, string>;
  /** Page-level TLS skip default (before per-tab overrides). */
  pageDefaultSkipTlsVerify: boolean;
  pageDefaultTlsCaCert?: string;
  pageDefaultTlsClientCert?: string;
  pageDefaultTlsClientKey?: string;
  /** Global auth profiles for inherit resolution (Phase 6F). */
  globalAuthProfiles?: GlobalAuthProfile[];
  advSettingsRef: React.RefObject<AdvancedSettingsValues>;
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
  batchGroups: BatchEndpointGroup[];
  activeBatchGroupKey: string | null;
  activeBatchGroup: BatchEndpointGroup | null;
  batchCheckboxTabIds: Set<string>;
  handleSetActiveBatchGroup: (groupKey: string) => void;
  handleToggleBatch: (tabId: string) => void;
  handleSendBatch: () => void;
  setBatchTabOverrides: React.Dispatch<React.SetStateAction<Map<string, boolean>>>;
  /** True when two or more checked tabs resolve to different endpoints (Phase 6A-8). */
  batchEndpointMismatch: boolean;
  /** True when batched tabs share a non-empty resolved endpoint (Phase 6A-8). */
  batchEndpointReady: boolean;
  /** True when any checked tab has an unresolved profile link (Phase 6F). */
  batchProfileLinkPending: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGraphqlBatchExecution({
  tabs,
  activeTabId,
  activeDemoLessonId = null,
  pageDefaultEndpoint,
  profiles = [],
  pageDefaultAuth,
  activeEnvironment,
  globalEnvMap,
  pageDefaultSkipTlsVerify,
  pageDefaultTlsCaCert,
  pageDefaultTlsClientCert,
  pageDefaultTlsClientKey,
  globalAuthProfiles = [],
  advSettingsRef,
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
  const [activeBatchGroupKey, setActiveBatchGroupKey] = useState<string | null>(null);

  const batchGroups = useMemo(
    () => buildBatchGroups(
      tabs,
      pageDefaultEndpoint,
      activeEnvironment,
      globalEnvMap,
      profiles,
      { demoLessonId: activeDemoLessonId },
    ),
    [tabs, pageDefaultEndpoint, activeEnvironment, globalEnvMap, profiles, activeDemoLessonId],
  );

  useEffect(() => {
    if (batchGroups.length === 0) {
      setActiveBatchGroupKey(null);
      return;
    }
    setActiveBatchGroupKey((prev) => {
      const groupForActive = activeTabId
        ? batchGroups.find((g) => g.tabIds.includes(activeTabId))
        : undefined;
      if (groupForActive) return groupForActive.key;
      if (prev && batchGroups.some((g) => g.key === prev)) return prev;
      const preferred = batchGroups.find((g) => g.tabIds.length >= 2) ?? batchGroups[0]!;
      return preferred.key;
    });
  }, [batchGroups, activeTabId]);

  const activeBatchGroup = useMemo(
    () => batchGroups.find((g) => g.key === activeBatchGroupKey) ?? null,
    [batchGroups, activeBatchGroupKey],
  );

  const batchCheckboxTabIds = useMemo(
    () => new Set(activeBatchGroup?.tabIds ?? []),
    [activeBatchGroup],
  );

  const handleSetActiveBatchGroup = useCallback((groupKey: string) => {
    if (batchGroups.some((g) => g.key === groupKey)) {
      setActiveBatchGroupKey(groupKey);
    }
  }, [batchGroups]);

  const handleToggleBatch = useCallback((tabId: string) => {
    if (!batchCheckboxTabIds.has(tabId)) return;
    setBatchTabOverrides((prev) => {
      const next = new Map(prev);
      next.set(tabId, !(prev.get(tabId) ?? false));
      return next;
    });
  }, [batchCheckboxTabIds]);

  const effectiveBatchedTabs = useMemo(
    () => tabs.filter(
      (t) => batchTabOverrides.get(t.id) === true && batchCheckboxTabIds.has(t.id),
    ),
    [tabs, batchTabOverrides, batchCheckboxTabIds],
  );

  const batchedTabIdsSet = useMemo(
    () => new Set(effectiveBatchedTabs.map((t) => t.id)),
    [effectiveBatchedTabs],
  );

  const batchEndpointParity = useMemo(
    () => evaluateBatchEndpointParity(
      effectiveBatchedTabs,
      pageDefaultEndpoint,
      activeEnvironment,
      globalEnvMap,
      profiles,
    ),
    [effectiveBatchedTabs, pageDefaultEndpoint, activeEnvironment, globalEnvMap, profiles],
  );

  const batchEndpointMismatch = batchEndpointParity.mismatch;

  const batchProfileLinkPending = useMemo(
    () => effectiveBatchedTabs.some((t) => isTabProfileLinkPending(t, profiles)),
    [effectiveBatchedTabs, profiles],
  );

  const batchEndpointReady = useMemo(
    () => effectiveBatchedTabs.length >= 2
      && batchEndpointParity.hasParity
      && Boolean(batchEndpointParity.commonResolvedEndpoint?.trim())
      && !batchProfileLinkPending,
    [effectiveBatchedTabs.length, batchEndpointParity, batchProfileLinkPending],
  );

  const batchSkipTlsVerify = useMemo(() => {
    const first = effectiveBatchedTabs[0];
    return first?.skipTlsVerify ?? pageDefaultSkipTlsVerify;
  }, [effectiveBatchedTabs, pageDefaultSkipTlsVerify]);

  const batchConnectionDefaults = useMemo<TabConnectionPageDefaults>(
    () => ({
      endpoint: pageDefaultEndpoint,
      auth: pageDefaultAuth,
      skipTlsVerify: pageDefaultSkipTlsVerify,
      tlsCaCert: pageDefaultTlsCaCert,
      tlsClientCert: pageDefaultTlsClientCert,
      tlsClientKey: pageDefaultTlsClientKey,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    }),
    [
      pageDefaultEndpoint,
      pageDefaultAuth,
      pageDefaultSkipTlsVerify,
      pageDefaultTlsCaCert,
      pageDefaultTlsClientCert,
      pageDefaultTlsClientKey,
    ],
  );

  const batchTls = useMemo(() => {
    const first = effectiveBatchedTabs[0];
    if (!first) return {};
    return tabConnectionTls(resolveTabConnection(first, profiles, batchConnectionDefaults));
  }, [effectiveBatchedTabs, profiles, batchConnectionDefaults]);

  const handleSendBatch = useCallback(() => {
    if (effectiveBatchedTabs.length < 2 || batchExecuting || batchExecutingRef.current) return;
    if (batchProfileLinkPending) return;
    if (batchEndpointParity.mismatch) return;
    const resolvedEndpoint = batchEndpointParity.commonResolvedEndpoint;
    if (!resolvedEndpoint) return;
    if (findUnresolvedVars(resolvedEndpoint, activeEnvironment, globalEnvMap).length > 0) return;
    if (effectiveBatchedTabs.some((t) => !t.query.trim())) return;

    batchExecutingRef.current = true;
    setBatchExecuting(true);
    setBatchResult(null);

    const buildTabHeaders = (tab: GqlStudioTab): Record<string, string> => {
      const tabAuth = resolveTabConnection(tab, profiles, batchConnectionDefaults).auth;
      const authH = buildAuthHeaders(tabAuth, globalAuthProfiles);
      const tabHeaderMap: Record<string, string> = {};
      for (const h of tab.headers) {
        if (h.enabled && h.key.trim()) tabHeaderMap[h.key.trim()] = h.value;
      }
      const merged: Record<string, string> = {};
      for (const [k, v] of Object.entries({ ...authH, ...tabHeaderMap })) {
        merged[k] = resolveVars(v, activeEnvironment, globalEnvMap);
      }
      return merged;
    };

    const resolvedHeaders = buildTabHeaders(effectiveBatchedTabs[0]!);

    const batchOperations = effectiveBatchedTabs.map((t) => ({
      query: t.query,
      variables: (() => {
        try {
          const trimmed = resolveVars(t.variables, activeEnvironment, globalEnvMap).trim();
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
            skipTlsVerify: batchSkipTlsVerify,
            ...serializeGqlTlsForProxy(batchTls),
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
          const batchConnId = resolvedEndpoint;
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
  }, [effectiveBatchedTabs, batchExecuting, batchProfileLinkPending, batchEndpointParity, batchSkipTlsVerify, batchTls,
    activeEnvironment, globalEnvMap, profiles, globalAuthProfiles, batchConnectionDefaults, setRightView, advSettingsRef,
    setAdvSettings, setBatchUnsupportedToast, gqlProxyBase]);

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
    batchGroups,
    activeBatchGroupKey,
    activeBatchGroup,
    batchCheckboxTabIds,
    handleSetActiveBatchGroup,
    handleToggleBatch,
    handleSendBatch,
    setBatchTabOverrides,
    batchEndpointMismatch,
    batchEndpointReady,
    batchProfileLinkPending,
  };
}
