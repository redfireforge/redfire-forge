/**
 * useSubscriptionOrchestration — bridges GraphqlStudioPage state with
 * useGraphqlSubscription, providing the resolved handlers used in
 * GraphqlConnectionBar and GqlRightPane.
 *
 * Phase 2.0 Sprint 2: extracted from GraphqlStudioPage.tsx to stay under 900 lines.
 */

import { useCallback } from 'react';
import { buildAuthHeaders } from '../utils/authUtils';
import { findUnresolvedVars, resolveVars } from '../utils/envUtils';
import type { GraphqlAuth, GraphqlEnvironment } from '../../../shared/types/graphql';
import type { UseGraphqlSubscriptionResult } from './useGraphqlSubscription';
import type { GqlStudioTab } from '../utils/tabPersistence';

interface OrchestrationParams {
  activeTab: GqlStudioTab | undefined;
  endpoint: string;
  auth: GraphqlAuth | null;
  activeEnvironment: GraphqlEnvironment | null | undefined;
  activeTabHeaders: Record<string, string>;
  selectedOperation: string | undefined;
  skipTlsVerify: boolean;
  subscription: UseGraphqlSubscriptionResult;
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
  activeTabHeaders,
  selectedOperation,
  skipTlsVerify,
  subscription,
}: OrchestrationParams): SubscriptionOrchestration {
  const handleSubscribe = useCallback(() => {
    if (!activeTab || !endpoint.trim() || !activeTab.query.trim()) return;
    if (findUnresolvedVars(endpoint, activeEnvironment).length > 0) return;
    const resolvedEndpoint = resolveVars(endpoint, activeEnvironment);
    const authH = buildAuthHeaders(auth);
    const resolvedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...authH, ...activeTabHeaders })) {
      resolvedHeaders[k] = resolveVars(v, activeEnvironment);
    }
    const resolvedVariables = resolveVars(activeTab.variables, activeEnvironment);
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
      auth: auth ?? null,
      skipTlsVerify,
      subscriptionTransport: activeTab.subscriptionTransport,
    });
  }, [activeTab, endpoint, auth, activeEnvironment, activeTabHeaders, selectedOperation, skipTlsVerify, subscription]);

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
