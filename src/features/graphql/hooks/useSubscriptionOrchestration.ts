/**
 * useSubscriptionOrchestration — bridges GraphqlStudioPage state with
 * useGraphqlSubscription, providing the resolved handlers used in
 * GraphqlConnectionBar and GqlRightPane.
 *
 * Phase 2.0 Sprint 2: extracted from GraphqlStudioPage.tsx to stay under 900 lines.
 */

import { useCallback } from 'react';
import { buildAuthHeaders } from '../utils/authUtils';
import { resolveEffectiveGqlAuth } from '../utils/gqlAuthResolve';
import { findUnresolvedVars, resolveVars } from '../utils/envUtils';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { GraphqlAuth, GraphqlEnvironment } from '../../../shared/types/graphql';
import type { UseGraphqlSubscriptionResult } from './useGraphqlSubscription';
import type { GqlStudioTab } from '../utils/tabPersistence';

interface OrchestrationParams {
  activeTab: GqlStudioTab | undefined;
  endpoint: string;
  auth: GraphqlAuth | null;
  activeEnvironment: GraphqlEnvironment | null | undefined;
  globalEnvMap?: Record<string, string>;
  activeTabHeaders: Record<string, string>;
  selectedOperation: string | undefined;
  skipTlsVerify: boolean;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  subscription: UseGraphqlSubscriptionResult;
  /** Phase 6F — block subscribe while a profile-linked endpoint is still resolving. */
  endpointLinkPending?: boolean;
  /** Global auth profiles for inherit resolution. */
  globalAuthProfiles?: GlobalAuthProfile[];
}

export interface SubscriptionOrchestration {
  handleSubscribe: () => void;
  handleStopSubscription: () => void;
  handleExportSubscription: () => void;
}

/**
 * Builds and memoizes the three subscription action handlers:
 *   - handleSubscribe   → open a new WS subscription
 *   - handleStopSubscription → disconnect the active subscription
 *   - handleExportSubscription → download buffered messages as JSON
 */
export function useSubscriptionOrchestration({
  activeTab,
  endpoint,
  auth,
  activeEnvironment,
  globalEnvMap,
  activeTabHeaders,
  selectedOperation,
  skipTlsVerify,
  tlsCaCert,
  tlsClientCert,
  tlsClientKey,
  subscription,
  endpointLinkPending = false,
  globalAuthProfiles = [],
}: OrchestrationParams): SubscriptionOrchestration {
  const handleSubscribe = useCallback(() => {
    if (endpointLinkPending) return;
    if (!activeTab || !endpoint.trim() || !activeTab.query.trim()) return;
    if (findUnresolvedVars(endpoint, activeEnvironment, globalEnvMap).length > 0) return;
    const resolvedEndpoint = resolveVars(endpoint, activeEnvironment, globalEnvMap);
    const authH = buildAuthHeaders(auth, globalAuthProfiles);
    const resolvedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...authH, ...activeTabHeaders })) {
      resolvedHeaders[k] = resolveVars(v, activeEnvironment, globalEnvMap);
    }
    const resolvedVariables = resolveVars(activeTab.variables, activeEnvironment, globalEnvMap);
    let parsedVariables: Record<string, unknown> = {};
    try {
      const t = resolvedVariables.trim();
      if (t && t !== '{}') {
        const p = JSON.parse(t) as unknown;
        if (p && typeof p === 'object' && !Array.isArray(p)) {
          parsedVariables = p as Record<string, unknown>;
        }
      }
    } catch { /* keep empty */ }

    subscription.subscribe({
      query: activeTab.query,
      variables: parsedVariables,
      operationName: selectedOperation,
      endpoint: resolvedEndpoint,
      headers: resolvedHeaders,
      auth: resolveEffectiveGqlAuth(auth, globalAuthProfiles),
      skipTlsVerify,
      tlsCaCert,
      tlsClientCert,
      tlsClientKey,
      subscriptionTransport: activeTab.subscriptionTransport,
    });
  }, [activeTab, endpoint, auth, activeEnvironment, globalEnvMap, activeTabHeaders, selectedOperation,
    skipTlsVerify, tlsCaCert, tlsClientCert, tlsClientKey, subscription, endpointLinkPending, globalAuthProfiles]);

  const handleStopSubscription = useCallback(() => {
    subscription.disconnect();
  }, [subscription]);

  const handleExportSubscription = useCallback(() => {
    const { messages, stats, sessionId } = subscription;
    const operationName = activeTab?.operationType === 'subscription'
      ? (selectedOperation ?? 'Subscription')
      : 'Subscription';
    const exportData = {
      _meta: {
        exportedAt: new Date().toISOString(),
        operationName,
        totalMessages: stats.totalMessages,
        durationMs: stats.connectedDurationMs,
        transport: subscription.transport ?? 'graphql-transport-ws',
        sessionId,
      },
      messages: messages.map((m) => ({
        index: m.index,
        offsetMs: m.offsetMs,
        data: m.data,
        errors: m.errors ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Sanitize: lowercase, spaces → hyphens, strip non-alphanumeric-hyphen-underscore
    const safeName = operationName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
    a.download = `graphql-subscription-${safeName || 'export'}-${Date.now()}.json`;
    // Append to DOM so Firefox triggers the download correctly
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after a tick to let the browser start the download
    setTimeout(() => URL.revokeObjectURL(url), 150);
  }, [subscription, activeTab, selectedOperation]);

  return { handleSubscribe, handleStopSubscription, handleExportSubscription };
}
