/**
 * useGraphqlConnectionSettings — manages all connection-level settings for
 * GraphQL Studio: endpoint, TLS, polling, auth, recent endpoints, connection
 * profiles, and environment/profile modal visibility.
 *
 * Extracted from GraphqlStudioPage.tsx to reduce its line count.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import React from 'react';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import { readKey, writeKey } from '../../../shared/utils/storage';
import { useRecentEndpoints } from './useRecentEndpoints';
import { useGraphqlConnectionProfiles } from './useGraphqlConnectionProfiles';
import { useGraphqlEnvironments } from './useGraphqlEnvironments';
import { loadAuth, saveAuth, loadTlsCerts, saveTlsCerts, ENDPOINT_BASE_STORAGE_KEY, ENDPOINT_STORAGE_KEY, POLLING_STORAGE_KEY, TLS_STORAGE_KEY, type GqlTlsCertsStorage } from '../utils/tabPersistence';
import { GQL_PAGE_AUTH_RELOAD_EVENT, GQL_PAGE_ENDPOINT_RELOAD_EVENT, loadDemoSession } from '../utils/gqlDemoWorkspace';
import { clampPollingIntervalSeconds } from '../utils/pollingIntervalUtils';
import { normalizeGraphqlEndpoint } from '../utils/graphqlEndpointUtils';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';

export interface GraphqlConnectionSettingsResult {
  // Endpoint
  endpoint: string;
  setEndpoint: React.Dispatch<React.SetStateAction<string>>;
  historyConnectionId: string | null;
  setHistoryConnectionId: React.Dispatch<React.SetStateAction<string | null>>;
  prevBaseUrlRef: React.MutableRefObject<string | undefined>;

  // TLS / Polling
  skipTlsVerify: boolean;
  handleSkipTlsVerifyChange: (skip: boolean) => void;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  handleTlsCertsChange: (patch: Partial<GqlTlsSettings>) => void;
  pollingEnabled: boolean;
  pollingIntervalSeconds: number;
  pollingIntervalMs: number;
  handlePollingChange: (enabled: boolean, intervalSeconds: number) => void;

  // Auth
  auth: GraphqlAuth | null;
  handleAuthChange: (newAuth: GraphqlAuth | null) => void;

  // Recent endpoints
  recentEndpoints: string[];
  pushRecentEndpoint: (ep: string) => void;
  removeRecentEndpoint: (ep: string) => void;

  // Connection profiles
  profiles: ReturnType<typeof useGraphqlConnectionProfiles>['profiles'];
  profilesReady: ReturnType<typeof useGraphqlConnectionProfiles>['profilesReady'];
  saveProfile: ReturnType<typeof useGraphqlConnectionProfiles>['saveProfile'];
  updateProfile: ReturnType<typeof useGraphqlConnectionProfiles>['updateProfile'];
  deleteProfile: ReturnType<typeof useGraphqlConnectionProfiles>['deleteProfile'];
  profileModalOpen: boolean;
  setProfileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Environments
  environments: ReturnType<typeof useGraphqlEnvironments>['environments'];
  activeEnvironment: ReturnType<typeof useGraphqlEnvironments>['activeEnvironment'];
  createEnvironment: ReturnType<typeof useGraphqlEnvironments>['createEnvironment'];
  deleteEnvironment: ReturnType<typeof useGraphqlEnvironments>['deleteEnvironment'];
  setActiveEnvironment: ReturnType<typeof useGraphqlEnvironments>['setActiveEnvironment'];
  updateEnvironmentName: ReturnType<typeof useGraphqlEnvironments>['updateEnvironmentName'];
  updateVariables: ReturnType<typeof useGraphqlEnvironments>['updateVariables'];
  importEnvironment: ReturnType<typeof useGraphqlEnvironments>['importEnvironment'];
  exportEnvironment: ReturnType<typeof useGraphqlEnvironments>['exportEnvironment'];
  upsertEnvironment: ReturnType<typeof useGraphqlEnvironments>['upsertEnvironment'];
  deleteEnvironmentByName: ReturnType<typeof useGraphqlEnvironments>['deleteEnvironmentByName'];
  envModalOpen: boolean;
  setEnvModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useGraphqlConnectionSettings(
  resolvedBaseUrl?: string,
): GraphqlConnectionSettingsResult {
  // ── Endpoint ───────────────────────────────────────────────────────────────
  // Start empty — restore from storage before persisting (avoids wiping saved URL on remount).
  const [endpoint, setEndpoint] = useState('');
  const [endpointHydrated, setEndpointHydrated] = useState(false);
  const initialResolvedBaseUrl  = useRef(resolvedBaseUrl);
  const prevBaseUrlRef          = useRef<string | undefined>(resolvedBaseUrl);

  // Keep historyConnectionId in sync with endpoint (also used by history / adv-settings hooks)
  const [historyConnectionId, setHistoryConnectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!endpointHydrated) return;
    if (resolvedBaseUrl === undefined) return;
    const prev = prevBaseUrlRef.current;
    prevBaseUrlRef.current = resolvedBaseUrl;
    setEndpoint((cur) => {
      if (cur === '' || cur === prev) {
        writeKey(ENDPOINT_BASE_STORAGE_KEY, resolvedBaseUrl).catch(() => { /* silent */ });
        return resolvedBaseUrl;
      }
      return cur;
    });
  }, [resolvedBaseUrl, endpointHydrated]);

  useEffect(() => {
    if (!endpointHydrated) return;
    void (async () => {
      try {
        const normalized = normalizeGraphqlEndpoint(endpoint);
        const session = await loadDemoSession();
        if (session && normalized === '{{graphqlUrl}}') return;
        // Demo teardown restores the user's endpoint in storage while React may
        // still hold `{{graphqlUrl}}` briefly — do not overwrite the restore.
        if (!session && normalized === '{{graphqlUrl}}') {
          const saved = await readKey(ENDPOINT_STORAGE_KEY);
          if (saved && saved !== '{{graphqlUrl}}') return;
        }
        await writeKey(ENDPOINT_STORAGE_KEY, normalized);
        setHistoryConnectionId(endpoint || null);
      } catch { /* silent — quota / private mode */ }
    })();
  }, [endpoint, endpointHydrated]);

  // ── TLS + polling ──────────────────────────────────────────────────────────
  const [skipTlsVerify, setSkipTlsVerify]               = useState(false);
  const [tlsCerts, setTlsCerts]                         = useState<GqlTlsCertsStorage>({});
  const [pollingEnabled, setPollingEnabled]             = useState(false);
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState(30);
  const pollingIntervalMs = pollingEnabled ? pollingIntervalSeconds * 1000 : 0;

  const handleSkipTlsVerifyChange = useCallback((skip: boolean) => {
    setSkipTlsVerify(skip);
    writeKey(TLS_STORAGE_KEY, String(skip)).catch(() => { /* no-op */ });
  }, []);

  const handleTlsCertsChange = useCallback((patch: Partial<GqlTlsSettings>) => {
    setTlsCerts((prev) => {
      const next: GqlTlsCertsStorage = { ...prev };
      if ('caCert' in patch) next.caCert = patch.caCert || undefined;
      if ('clientCert' in patch) next.clientCert = patch.clientCert || undefined;
      if ('clientKey' in patch) next.clientKey = patch.clientKey || undefined;
      void saveTlsCerts(next);
      return next;
    });
  }, []);

  const handlePollingChange = useCallback((enabled: boolean, intervalSeconds: number) => {
    const clamped = clampPollingIntervalSeconds(intervalSeconds);
    setPollingEnabled(enabled);
    setPollingIntervalSeconds(clamped);
    writeKey(POLLING_STORAGE_KEY, JSON.stringify({ enabled, intervalSeconds: clamped })).catch(() => { /* no-op */ });
  }, []);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const [auth, setAuth] = useState<GraphqlAuth | null>(null);
  const handleAuthChange = useCallback((newAuth: GraphqlAuth | null) => {
    setAuth(newAuth);
    saveAuth(newAuth);
  }, []);

  // ── Recent endpoints ───────────────────────────────────────────────────────
  const { endpoints: recentEndpoints, push: pushRecentEndpoint, remove: removeRecentEndpoint } = useRecentEndpoints();

  // ── Connection profiles ────────────────────────────────────────────────────
  const { profiles, profilesReady, saveProfile, updateProfile, deleteProfile } = useGraphqlConnectionProfiles();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // ── Environments ───────────────────────────────────────────────────────────
  const {
    environments, activeEnvironment,
    createEnvironment, deleteEnvironment, setActiveEnvironment,
    updateEnvironmentName, updateVariables, importEnvironment, exportEnvironment,
    upsertEnvironment, deleteEnvironmentByName,
  } = useGraphqlEnvironments();
  const [envModalOpen, setEnvModalOpen] = useState(false);

  // ── Restore settings from storage (once on mount) ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await readKey(ENDPOINT_STORAGE_KEY);
        if (saved) {
          const savedBase = await readKey(ENDPOINT_BASE_STORAGE_KEY);
          const rbUrl = initialResolvedBaseUrl.current;
          if (saved === savedBase && rbUrl && rbUrl !== savedBase) {
            setEndpoint(normalizeGraphqlEndpoint(rbUrl));
          } else {
            setEndpoint(normalizeGraphqlEndpoint(saved));
          }
        } else {
          const rbUrl = initialResolvedBaseUrl.current;
          if (rbUrl) setEndpoint(normalizeGraphqlEndpoint(rbUrl));
        }
      } catch { /* fall through */ }

      try {
        const tlsRaw = await readKey(TLS_STORAGE_KEY);
        if (tlsRaw !== null) setSkipTlsVerify(tlsRaw === 'true');
      } catch { /* ignore */ }

      try {
        const savedCerts = await loadTlsCerts();
        if (savedCerts.caCert || savedCerts.clientCert || savedCerts.clientKey) {
          setTlsCerts(savedCerts);
        }
      } catch { /* ignore */ }

      try {
        const raw = await readKey(POLLING_STORAGE_KEY);
        if (raw) {
          const p = JSON.parse(raw) as { enabled?: boolean; intervalSeconds?: number };
          if (p.enabled === true) setPollingEnabled(true);
          const s = p.intervalSeconds;
          if (typeof s === 'number' && s >= 10) setPollingIntervalSeconds(s);
        }
      } catch { /* ignore */ }

      try {
        const savedAuth = await loadAuth();
        if (savedAuth) setAuth(savedAuth);
      } catch { /* ignore */ }

      setEndpointHydrated(true);
    })();
  }, []);

  useEffect(() => {
    const handler = () => {
      void loadAuth().then((savedAuth) => { setAuth(savedAuth); });
    };
    window.addEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, handler);
    return () => window.removeEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      void readKey(ENDPOINT_STORAGE_KEY).then((saved) => {
        if (saved !== null) setEndpoint(normalizeGraphqlEndpoint(saved));
      }).catch(() => { /* ignore */ });
    };
    window.addEventListener(GQL_PAGE_ENDPOINT_RELOAD_EVENT, handler);
    return () => window.removeEventListener(GQL_PAGE_ENDPOINT_RELOAD_EVENT, handler);
  }, []);

  return {
    endpoint, setEndpoint, historyConnectionId, setHistoryConnectionId, prevBaseUrlRef,
    skipTlsVerify, handleSkipTlsVerifyChange,
    tlsCaCert: tlsCerts.caCert,
    tlsClientCert: tlsCerts.clientCert,
    tlsClientKey: tlsCerts.clientKey,
    handleTlsCertsChange,
    pollingEnabled, pollingIntervalSeconds, pollingIntervalMs, handlePollingChange,
    auth, handleAuthChange,
    recentEndpoints, pushRecentEndpoint, removeRecentEndpoint,
    profiles, profilesReady, saveProfile, updateProfile, deleteProfile, profileModalOpen, setProfileModalOpen,
    environments, activeEnvironment,
    createEnvironment, deleteEnvironment, setActiveEnvironment,
    updateEnvironmentName, updateVariables, importEnvironment, exportEnvironment,
    upsertEnvironment, deleteEnvironmentByName,
    envModalOpen, setEnvModalOpen,
  };
}
