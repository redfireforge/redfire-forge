import { useCallback } from 'react';
import type { GraphqlAuth, GraphqlSubscriptionAssertion } from '../../../shared/types/graphql';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import { deriveOperationType } from '../utils/monacoGraphqlSetup';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import {
  resolveTabLabelEndpoint,
  findProfileById,
  isTabAuthOverridden,
} from '../utils/tabConnectionResolution';
import { withAutoTabLabel, isAutoLabelEligible } from '../utils/tabLabelUtils';
import { clampPollingIntervalSeconds } from '../utils/pollingIntervalUtils';
import {
  type GqlStudioTab,
  computeTabAuthStoredValue,
  graphqlAuthEquals,
} from '../utils/tabPersistence';

export interface GqlTabFieldPageDefaults {
  endpoint: string;
  endpointResolved?: string;
  skipTlsVerify: boolean;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  pollingEnabled: boolean;
  pollingIntervalSeconds: number;
  auth: GraphqlAuth | null;
}

export interface UseGqlTabFieldUpdatersOptions {
  setTabs: React.Dispatch<React.SetStateAction<GqlStudioTab[]>>;
  activeTabIdRef: React.MutableRefObject<string>;
  pageDefaults: GqlTabFieldPageDefaults;
  profiles: ConnectionProfile[];
  tabCount: number;
}

export function useGqlTabFieldUpdaters({
  setTabs,
  activeTabIdRef,
  pageDefaults,
  profiles,
  tabCount,
}: UseGqlTabFieldUpdatersOptions) {
  const relabelTab = useCallback(
    (tab: GqlStudioTab): GqlStudioTab => {
      if (!isAutoLabelEligible(tab)) return tab;
      const profile = findProfileById(profiles, tab.connectionId);
      const labelEndpoint = resolveTabLabelEndpoint(
        tab,
        profiles,
        pageDefaults.endpoint,
        pageDefaults.endpointResolved,
      );
      return withAutoTabLabel(tab, profile?.name ?? null, labelEndpoint);
    },
    [profiles, pageDefaults.endpoint, pageDefaults.endpointResolved],
  );

  const updateActiveTab = useCallback(
    (patch: Partial<GqlStudioTab>) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabIdRef.current ? { ...t, ...patch, unsavedChanges: true } : t,
        ),
      );
    },
    [setTabs, activeTabIdRef],
  );

  const clearActiveTabEndpoint = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.endpoint === undefined && t.connectionId === undefined) return t;
        return relabelTab({
          ...t,
          endpoint: undefined,
          connectionId: undefined,
          unsavedChanges: true,
        });
      }),
    );
  }, [setTabs, activeTabIdRef, relabelTab]);

  const updateActiveTabEndpoint = useCallback((endpoint: string) => {
    const trimmed = endpoint.trim();
    const pageDefault = pageDefaults.endpoint.trim();
    let nextEndpoint: string | undefined;
    if (!trimmed) {
      nextEndpoint = tabCount > 1 ? '' : undefined;
    } else if (trimmed === pageDefault) {
      nextEndpoint = undefined;
    } else {
      nextEndpoint = trimmed;
    }
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.endpoint === nextEndpoint && t.connectionId === undefined) return t;
        return relabelTab({
          ...t,
          endpoint: nextEndpoint,
          connectionId: undefined,
          unsavedChanges: true,
        });
      }),
    );
  }, [setTabs, activeTabIdRef, pageDefaults.endpoint, relabelTab, tabCount]);

  const applyProfileToActiveTab = useCallback((profile: ConnectionProfile) => {
    const trimmed = profile.endpoint.trim();
    const nextEndpoint = trimmed || undefined;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (
          t.connectionId === profile.id
          && t.endpoint === nextEndpoint
          && !isTabAuthOverridden(t)
        ) {
          return t;
        }
        const { auth: _auth, ...base } = t;
        return relabelTab({
          ...base,
          connectionId: profile.id,
          endpoint: nextEndpoint,
          unsavedChanges: true,
        });
      }),
    );
  }, [setTabs, activeTabIdRef, relabelTab]);

  const clearConnectionIdsForProfile = useCallback((profileId: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.connectionId === profileId
          ? { ...t, connectionId: undefined, unsavedChanges: true }
          : t,
      ),
    );
  }, [setTabs]);

  const clearActiveTabProfileLink = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current || t.connectionId === undefined) return t;
        return relabelTab({ ...t, connectionId: undefined, unsavedChanges: true });
      }),
    );
  }, [setTabs, activeTabIdRef, relabelTab]);

  const updateActiveTabSkipTlsVerify = useCallback((skip: boolean) => {
    const nextSkip = skip === pageDefaults.skipTlsVerify ? undefined : skip;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.skipTlsVerify === nextSkip) return t;
        return { ...t, skipTlsVerify: nextSkip, unsavedChanges: true };
      }),
    );
  }, [setTabs, activeTabIdRef, pageDefaults.skipTlsVerify]);

  const updateActiveTabTlsSettings = useCallback((patch: Partial<GqlTlsSettings>) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        let next = t;
        if (patch.skipTlsVerify !== undefined) {
          const nextSkip = patch.skipTlsVerify === pageDefaults.skipTlsVerify ? undefined : patch.skipTlsVerify;
          if (next.skipTlsVerify !== nextSkip) {
            next = { ...next, skipTlsVerify: nextSkip };
          }
        }
        if ('caCert' in patch) {
          const nextCa = patch.caCert || undefined;
          const inherited = nextCa === (pageDefaults.tlsCaCert || undefined);
          const tabCa = inherited ? undefined : nextCa;
          if (next.tlsCaCert !== tabCa) {
            next = { ...next, tlsCaCert: tabCa };
          }
        }
        if ('clientCert' in patch) {
          const nextCert = patch.clientCert || undefined;
          const inherited = nextCert === (pageDefaults.tlsClientCert || undefined);
          const tabCert = inherited ? undefined : nextCert;
          if (next.tlsClientCert !== tabCert) {
            next = { ...next, tlsClientCert: tabCert };
          }
        }
        if ('clientKey' in patch) {
          const nextKey = patch.clientKey || undefined;
          const inherited = nextKey === (pageDefaults.tlsClientKey || undefined);
          const tabKey = inherited ? undefined : nextKey;
          if (next.tlsClientKey !== tabKey) {
            next = { ...next, tlsClientKey: tabKey };
          }
        }
        if (next === t) return t;
        return { ...next, unsavedChanges: true };
      }),
    );
  }, [setTabs, activeTabIdRef, pageDefaults.skipTlsVerify, pageDefaults.tlsCaCert, pageDefaults.tlsClientCert, pageDefaults.tlsClientKey]);

  const updateActiveTabPolling = useCallback((enabled: boolean, intervalSeconds: number) => {
    const clamped = clampPollingIntervalSeconds(intervalSeconds);
    const nextEnabled = enabled === pageDefaults.pollingEnabled ? undefined : enabled;
    const nextInterval = clamped === pageDefaults.pollingIntervalSeconds ? undefined : clamped;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.pollingEnabled === nextEnabled && t.pollingIntervalSeconds === nextInterval) return t;
        return {
          ...t,
          pollingEnabled: nextEnabled,
          pollingIntervalSeconds: nextInterval,
          unsavedChanges: true,
        };
      }),
    );
  }, [setTabs, activeTabIdRef, pageDefaults.pollingEnabled, pageDefaults.pollingIntervalSeconds]);

  const clearActiveTabPolling = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.pollingEnabled === undefined && t.pollingIntervalSeconds === undefined) return t;
        return {
          ...t,
          pollingEnabled: undefined,
          pollingIntervalSeconds: undefined,
          unsavedChanges: true,
        };
      }),
    );
  }, [setTabs, activeTabIdRef]);

  const updateActiveTabAuth = useCallback((
    newAuth: GraphqlAuth | null,
    options?: { clearProfileLink?: boolean },
  ) => {
    const nextStored = computeTabAuthStoredValue(newAuth, pageDefaults.auth);
    const shouldClearProfileLink = options?.clearProfileLink && nextStored !== undefined;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;

        let next = t;
        if (shouldClearProfileLink && t.connectionId !== undefined) {
          next = relabelTab({ ...next, connectionId: undefined });
        }

        if (nextStored === undefined) {
          if (next.auth === undefined) {
            return next === t ? next : { ...next, unsavedChanges: true };
          }
          const { auth: _auth, ...rest } = next;
          return { ...rest, unsavedChanges: true };
        }

        if (graphqlAuthEquals(next.auth, nextStored)) {
          return next === t ? next : { ...next, unsavedChanges: true };
        }

        return { ...next, auth: nextStored, unsavedChanges: true };
      }),
    );
  }, [setTabs, activeTabIdRef, pageDefaults.auth, relabelTab]);

  const clearActiveTabAuth = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabIdRef.current) return t;
        if (t.auth === undefined) return t;
        const { auth: _auth, ...rest } = t;
        return { ...rest, unsavedChanges: true };
      }),
    );
  }, [setTabs, activeTabIdRef]);

  const handleQueryChange = useCallback(
    (value: string) => {
      const operationType = deriveOperationType(value);
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabIdRef.current) return t;
          const nextTab = { ...t, query: value, operationType, unsavedChanges: true };
          return relabelTab(nextTab);
        }),
      );
    },
    [setTabs, activeTabIdRef, relabelTab],
  );

  const handleVariablesChange = useCallback(
    (value: string) => updateActiveTab({ variables: value }),
    [updateActiveTab],
  );

  const handleHeadersChange = useCallback(
    (headers: GqlStudioTab['headers']) => updateActiveTab({ headers }),
    [updateActiveTab],
  );

  const handleAssertionsChange = useCallback(
    (assertions: GraphqlSubscriptionAssertion[]) => updateActiveTab({ subscriptionAssertions: assertions }),
    [updateActiveTab],
  );

  const handleSubscriptionTransportChange = useCallback(
    (t: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse') => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabIdRef.current ? { ...tab, subscriptionTransport: t } : tab,
        ),
      );
    },
    [setTabs, activeTabIdRef],
  );

  const handleSelectOperation = useCallback(
    (name: string) => updateActiveTab({ selectedOperation: name }),
    [updateActiveTab],
  );

  return {
    relabelTab,
    updateActiveTab,
    clearActiveTabEndpoint,
    updateActiveTabEndpoint,
    applyProfileToActiveTab,
    clearConnectionIdsForProfile,
    clearActiveTabProfileLink,
    updateActiveTabSkipTlsVerify,
    updateActiveTabTlsSettings,
    updateActiveTabPolling,
    clearActiveTabPolling,
    updateActiveTabAuth,
    clearActiveTabAuth,
    handleQueryChange,
    handleVariablesChange,
    handleHeadersChange,
    handleAssertionsChange,
    handleSubscriptionTransportChange,
    handleSelectOperation,
  };
}
