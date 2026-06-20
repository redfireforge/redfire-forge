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
import { loadAuth, saveAuth, ENDPOINT_BASE_STORAGE_KEY, ENDPOINT_STORAGE_KEY, POLLING_STORAGE_KEY, TLS_STORAGE_KEY } from '../utils/tabPersistence';

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
  saveProfile: ReturnType<typeof useGraphqlConnectionProfiles>['saveProfile'];
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
  envModalOpen: boolean;
  setEnvModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useGraphqlConnectionSettings(
  resolvedBaseUrl?: string,
): GraphqlConnectionSettingsResult {
  // ── Endpoint ───────────────────────────────────────────────────────────────
  const [endpoint, setEndpoint] = useState(resolvedBaseUrl ?? '');
  const initialResolvedBaseUrl  = useRef(resolvedBaseUrl);
  const prevBaseUrlRef          = useRef<string | undefined>(resolvedBaseUrl);

  // Keep historyConnectionId in sync with endpoint (also used by history / adv-settings hooks)
  const [historyConnectionId, setHistoryConnectionId] = useState<string | null>(
    () => resolvedBaseUrl || null,
  );

  useEffect(() => {
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
  }, [resolvedBaseUrl]);

  useEffect(() => {
    writeKey(ENDPOINT_STORAGE_KEY, endpoint).catch(() => { /* quota / unavailable — silent */ });
    setHistoryConnectionId(endpoint || null);
  }, [endpoint]);

  // ── TLS + polling ──────────────────────────────────────────────────────────
  const [skipTlsVerify, setSkipTlsVerify]               = useState(false);
  const [pollingEnabled, setPollingEnabled]             = useState(false);
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState(30);
  const pollingIntervalMs = pollingEnabled ? pollingIntervalSeconds * 1000 : 0;

  const handleSkipTlsVerifyChange = useCallback((skip: boolean) => {
    setSkipTlsVerify(skip);
    writeKey(TLS_STORAGE_KEY, String(skip)).catch(() => { /* no-op */ });
  }, []);

  const handlePollingChange = useCallback((enabled: boolean, intervalSeconds: number) => {
    setPollingEnabled(enabled);
    setPollingIntervalSeconds(intervalSeconds);
    writeKey(POLLING_STORAGE_KEY, JSON.stringify({ enabled, intervalSeconds })).catch(() => { /* no-op */ });
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
  const { profiles, saveProfile, deleteProfile } = useGraphqlConnectionProfiles();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // ── Environments ───────────────────────────────────────────────────────────
  const {
    environments, activeEnvironment,
    createEnvironment, deleteEnvironment, setActiveEnvironment,
    updateEnvironmentName, updateVariables, importEnvironment, exportEnvironment,
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
            setEndpoint(rbUrl);
          } else {
            setEndpoint(saved);
          }
        }
      } catch { /* fall through */ }

      try {
        const tlsRaw = await readKey(TLS_STORAGE_KEY);
        if (tlsRaw !== null) setSkipTlsVerify(tlsRaw === 'true');
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

      const savedAuth = await loadAuth();
      if (savedAuth) setAuth(savedAuth);
    })();
  }, []);

  return {
    endpoint, setEndpoint, historyConnectionId, setHistoryConnectionId, prevBaseUrlRef,
    skipTlsVerify, handleSkipTlsVerifyChange,
    pollingEnabled, pollingIntervalSeconds, pollingIntervalMs, handlePollingChange,
    auth, handleAuthChange,
    recentEndpoints, pushRecentEndpoint, removeRecentEndpoint,
    profiles, saveProfile, deleteProfile, profileModalOpen, setProfileModalOpen,
    environments, activeEnvironment,
    createEnvironment, deleteEnvironment, setActiveEnvironment,
    updateEnvironmentName, updateVariables, importEnvironment, exportEnvironment,
    envModalOpen, setEnvModalOpen,
  };
}
