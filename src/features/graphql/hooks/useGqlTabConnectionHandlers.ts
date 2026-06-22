import { useCallback } from 'react';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import { clampPollingIntervalSeconds } from '../utils/pollingIntervalUtils';

export interface UseGqlTabConnectionHandlersParams {
  tabsLength: number;
  hasActiveTabEndpointOverride: boolean;
  hasActiveTabProfileLink: boolean;
  /** When true, auth edits unlink connectionId (any tab with connectionId set). */
  hasActiveTabConnectionId: boolean;
  hasActiveTabSkipTlsOverride: boolean;
  hasActiveTabTlsCertOverride: boolean;
  hasActiveTabPollingOverride: boolean;
  setEndpoint: (url: string) => void;
  updateActiveTabEndpoint: (url: string) => void;
  handleSkipTlsVerifyChange: (skip: boolean) => void;
  handleTlsCertsChange: (patch: Partial<GqlTlsSettings>) => void;
  updateActiveTabSkipTlsVerify: (skip: boolean) => void;
  updateActiveTabTlsSettings: (patch: Partial<GqlTlsSettings>) => void;
  handlePollingChange: (enabled: boolean, intervalSeconds: number) => void;
  updateActiveTabPolling: (enabled: boolean, intervalSeconds: number) => void;
  handleAuthChange: (newAuth: GraphqlAuth | null) => void;
  clearActiveTabProfileLink: () => void;
}

export interface UseGqlTabConnectionHandlersResult {
  handleConnectionEndpointChange: (url: string) => void;
  handleConnectionSkipTlsChange: (skip: boolean) => void;
  handleConnectionTlsChange: (patch: Partial<GqlTlsSettings>) => void;
  handleConnectionPollingChange: (enabled: boolean, intervalSeconds: number) => void;
  handleConnectionAuthChange: (newAuth: GraphqlAuth | null) => void;
}

/**
 * Phase 6 PT-5/PT-6 — route connection-bar edits to page default or per-tab override.
 * Single inheriting tab edits page storage; multi-tab or existing override edits active tab.
 */
export function useGqlTabConnectionHandlers({
  tabsLength,
  hasActiveTabEndpointOverride,
  hasActiveTabProfileLink,
  hasActiveTabConnectionId,
  hasActiveTabSkipTlsOverride,
  hasActiveTabTlsCertOverride,
  hasActiveTabPollingOverride,
  setEndpoint,
  updateActiveTabEndpoint,
  handleSkipTlsVerifyChange,
  handleTlsCertsChange,
  updateActiveTabSkipTlsVerify,
  updateActiveTabTlsSettings,
  handlePollingChange,
  updateActiveTabPolling,
  handleAuthChange,
  clearActiveTabProfileLink,
}: UseGqlTabConnectionHandlersParams): UseGqlTabConnectionHandlersResult {
  const usesPageDefaultConnection =
    tabsLength === 1 && !hasActiveTabEndpointOverride && !hasActiveTabProfileLink;

  const usesPageDefaultPolling =
    tabsLength === 1 && !hasActiveTabPollingOverride;

  const handleConnectionEndpointChange = useCallback(
    (url: string) => {
      if (usesPageDefaultConnection) {
        setEndpoint(url.trim());
        return;
      }
      updateActiveTabEndpoint(url);
    },
    [usesPageDefaultConnection, setEndpoint, updateActiveTabEndpoint],
  );

  const handleConnectionSkipTlsChange = useCallback(
    (skip: boolean) => {
      if (tabsLength === 1 && !hasActiveTabSkipTlsOverride) {
        handleSkipTlsVerifyChange(skip);
        return;
      }
      updateActiveTabSkipTlsVerify(skip);
    },
    [tabsLength, hasActiveTabSkipTlsOverride, handleSkipTlsVerifyChange, updateActiveTabSkipTlsVerify],
  );

  return {
    handleConnectionEndpointChange,
    handleConnectionSkipTlsChange,
    handleConnectionTlsChange: useCallback(
      (patch: Partial<GqlTlsSettings>) => {
        if (patch.skipTlsVerify !== undefined) {
          handleConnectionSkipTlsChange(patch.skipTlsVerify);
        }
        const certPatch: Partial<GqlTlsSettings> = {};
        if ('caCert' in patch) certPatch.caCert = patch.caCert;
        if ('clientCert' in patch) certPatch.clientCert = patch.clientCert;
        if ('clientKey' in patch) certPatch.clientKey = patch.clientKey;
        if (Object.keys(certPatch).length > 0) {
          if (tabsLength === 1 && !hasActiveTabTlsCertOverride) {
            handleTlsCertsChange(certPatch);
          } else {
            updateActiveTabTlsSettings(certPatch);
          }
        }
      },
      [handleConnectionSkipTlsChange, handleTlsCertsChange, updateActiveTabTlsSettings, tabsLength, hasActiveTabTlsCertOverride],
    ),
    handleConnectionPollingChange: useCallback(
      (enabled: boolean, intervalSeconds: number) => {
        const clamped = clampPollingIntervalSeconds(intervalSeconds);
        if (usesPageDefaultPolling) {
          handlePollingChange(enabled, clamped);
          return;
        }
        updateActiveTabPolling(enabled, clamped);
      },
      [usesPageDefaultPolling, handlePollingChange, updateActiveTabPolling],
    ),
    handleConnectionAuthChange: useCallback(
      (newAuth: GraphqlAuth | null) => {
        if (hasActiveTabConnectionId) clearActiveTabProfileLink();
        handleAuthChange(newAuth);
      },
      [hasActiveTabConnectionId, clearActiveTabProfileLink, handleAuthChange],
    ),
  };
}
