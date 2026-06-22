import { useMemo } from 'react';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import type { GqlStudioTab } from '../utils/tabPersistence';
import { resolveTabConnection, tabConnectionTls, type TabConnectionResolution } from '../utils/tabConnectionResolution';

export interface UseGqlActiveTabConnectionParams {
  activeTab: GqlStudioTab | undefined;
  profiles: ConnectionProfile[];
  endpoint: string;
  auth: GraphqlAuth | null;
  skipTlsVerify: boolean;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  pollingEnabled: boolean;
  pollingIntervalSeconds: number;
}

export interface UseGqlActiveTabConnectionResult {
  activeTabConnection: TabConnectionResolution | null;
  resolvedTabAuth: GraphqlAuth | null;
  resolvedTabSkipTlsVerify: boolean;
  resolvedTabTls: GqlTlsSettings;
  resolvedTabPollingEnabled: boolean;
  resolvedTabPollingIntervalSeconds: number;
  resolvedTabPollingIntervalMs: number;
}

/** Phase 6F — resolve active-tab endpoint, auth, TLS from tab → profile → page defaults. */
export function useGqlActiveTabConnection({
  activeTab,
  profiles,
  endpoint,
  auth,
  skipTlsVerify,
  tlsCaCert,
  tlsClientCert,
  tlsClientKey,
  pollingEnabled,
  pollingIntervalSeconds,
}: UseGqlActiveTabConnectionParams): UseGqlActiveTabConnectionResult {
  const pageDefaults = useMemo(
    () => ({
      endpoint,
      auth,
      skipTlsVerify,
      tlsCaCert,
      tlsClientCert,
      tlsClientKey,
      pollingEnabled,
      pollingIntervalSeconds,
    }),
    [endpoint, auth, skipTlsVerify, tlsCaCert, tlsClientCert, tlsClientKey, pollingEnabled, pollingIntervalSeconds],
  );

  const activeTabConnection = useMemo(
    () => (activeTab ? resolveTabConnection(activeTab, profiles, pageDefaults) : null),
    [activeTab, profiles, pageDefaults],
  );

  const resolvedTabAuth = activeTabConnection?.auth ?? auth;
  const resolvedTabSkipTlsVerify = activeTabConnection?.skipTlsVerify ?? skipTlsVerify;
  const resolvedTabTls = activeTabConnection
    ? tabConnectionTls(activeTabConnection)
    : { skipTlsVerify: skipTlsVerify || undefined };
  const resolvedTabPollingEnabled = activeTabConnection?.pollingEnabled ?? pollingEnabled;
  const resolvedTabPollingIntervalSeconds = activeTabConnection?.pollingIntervalSeconds ?? pollingIntervalSeconds;
  const resolvedTabPollingIntervalMs = resolvedTabPollingEnabled
    ? resolvedTabPollingIntervalSeconds * 1000
    : 0;

  return {
    activeTabConnection,
    resolvedTabAuth,
    resolvedTabSkipTlsVerify,
    resolvedTabTls,
    resolvedTabPollingEnabled,
    resolvedTabPollingIntervalSeconds,
    resolvedTabPollingIntervalMs,
  };
}
