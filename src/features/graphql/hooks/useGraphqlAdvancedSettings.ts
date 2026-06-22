/**
 * useGraphqlAdvancedSettings — manages Phase 3F advanced query settings.
 *
 * Handles:
 *  - APQ (Automatic Persisted Queries) enable/disable + unsupported detection
 *  - Batch enable/disable + unsupported detection
 *  - Deduplication, complexity gate settings
 *  - Global persistence (localStorage) + per-connection detection flags
 *  - Auto-dismiss toasts for APQ/batch unsupported detection
 *
 * Extracted from GraphqlStudioPage.tsx to reduce its line count.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAutoDismiss } from '../../../shared/hooks/useAutoDismiss';
import { readKey, writeKey } from '../../../shared/utils/storage';
import type { AdvancedSettingsValues } from '../components/GraphqlAdvancedSettings';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const ADV_SETTINGS_KEY = 'gql_adv_settings_v1';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApqInfo {
  unsupported?: boolean;
  cacheHit?: boolean;
  hash?: string;
  /** Endpoint/connection that produced this APQ result (Phase 6 multi-tab) */
  connectionId?: string;
}

export interface UseGraphqlAdvancedSettingsResult {
  advSettingsOpen: boolean;
  setAdvSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  advSettingsBtnRef: React.RefObject<HTMLButtonElement | null>;
  advSettings: AdvancedSettingsValues;
  advSettingsRef: React.RefObject<AdvancedSettingsValues>;
  setAdvSettings: React.Dispatch<React.SetStateAction<AdvancedSettingsValues>>;
  apqUnsupportedToast: boolean;
  setApqUnsupportedToast: (v: boolean) => void;
  batchUnsupportedToast: boolean;
  setBatchUnsupportedToast: (v: boolean) => void;
  connectionIdRef: React.RefObject<string | null>;
  handleAdvSettingsChange: (patch: Partial<AdvancedSettingsValues>) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGraphqlAdvancedSettings(
  historyConnectionId: string | null,
  apqInfo: ApqInfo | undefined | null,
): UseGraphqlAdvancedSettingsResult {
  const [advSettingsOpen, setAdvSettingsOpen] = useState(false);
  const advSettingsBtnRef = useRef<HTMLButtonElement | null>(null);

  const [advSettings, setAdvSettings] = useState<AdvancedSettingsValues>(() => ({
    apqEnabled: false,
    apqUseGet: false,
    apqUnsupportedDetected: false,
    batchEnabled: false,
    batchTimeoutMs: 30000,
    batchUnsupportedDetected: false,
    dedupEnabled: true,
    complexityBlockEnabled: false,
    complexityBlockThreshold: 1000,
    // Phase 2 Deferred — Transport + Limits defaults
    subscriptionTransport: 'auto',
    sseMode: 'distinct',
    wsEndpointOverride: '',
    historyMaxItems: 100,
    subscriptionBufferSize: 5000,
    maxFileSizeMb: 50,
  }));

  const [apqUnsupportedToast, setApqUnsupportedToast] = useState(false);
  const [batchUnsupportedToast, setBatchUnsupportedToast] = useState(false);

  useAutoDismiss(apqUnsupportedToast, setApqUnsupportedToast);
  useAutoDismiss(batchUnsupportedToast, setBatchUnsupportedToast);

  // Persist global advanced settings to localStorage (excludes detection flags)
  useEffect(() => {
    const { apqUnsupportedDetected: _a, batchUnsupportedDetected: _b, ...globalSettings } = advSettings;
    writeKey(ADV_SETTINGS_KEY, JSON.stringify(globalSettings)).catch(() => { /* no-op */ });
  }, [advSettings]);

  // Load persisted global advanced settings on mount
  useEffect(() => {
    void (async () => {
      try {
        const raw = await readKey(ADV_SETTINGS_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<AdvancedSettingsValues>;
        const { apqUnsupportedDetected: _a, batchUnsupportedDetected: _b, ...globalSettings } = saved;
        setAdvSettings((prev) => ({ ...prev, ...globalSettings }));
      } catch { /* ignore */ }
    })();
  }, []);

  // Track connectionId for per-connection detection persistence
  const connectionIdRef = useRef<string | null>(null);

  // Per-connection APQ/batch detection flags
  useEffect(() => {
    const connId = historyConnectionId;
    if (connId === connectionIdRef.current) return;
    connectionIdRef.current = connId;
    setAdvSettings((prev) => ({
      ...prev,
      apqUnsupportedDetected: false,
      batchUnsupportedDetected: false,
    }));
    if (!connId) return;
    void (async () => {
      try {
        const raw = await readKey(`gql_conn_detection_${connId}`);
        if (connectionIdRef.current !== connId) return;
        if (!raw) return;
        const saved = JSON.parse(raw) as { apq?: boolean; batch?: boolean };
        setAdvSettings((prev) => ({
          ...prev,
          apqUnsupportedDetected: saved.apq ?? false,
          batchUnsupportedDetected: saved.batch ?? false,
        }));
      } catch { /* ignore */ }
    })();
  }, [historyConnectionId]);

  const handleAdvSettingsChange = useCallback((patch: Partial<AdvancedSettingsValues>) => {
    setAdvSettings((prev) => ({ ...prev, ...patch }));
    const connId = connectionIdRef.current;
    if (connId && (patch.apqUnsupportedDetected === false || patch.batchUnsupportedDetected === false)) {
      void readKey(`gql_conn_detection_${connId}`)
        .then((raw) => {
          const existing = raw ? (JSON.parse(raw) as { apq?: boolean; batch?: boolean }) : {};
          if (patch.apqUnsupportedDetected === false) existing.apq = false;
          if (patch.batchUnsupportedDetected === false) existing.batch = false;
          return writeKey(`gql_conn_detection_${connId}`, JSON.stringify(existing));
        })
        .catch(() => { /* no-op */ });
    }
  }, []);

  // Stable ref so APQ auto-disable effect doesn't re-fire when settings change
  const advSettingsRef = useRef(advSettings);
  advSettingsRef.current = advSettings;

  // APQ unsupported detection → auto-disable + show toast
  useEffect(() => {
    if (apqInfo?.unsupported && advSettingsRef.current.apqEnabled) {
      setAdvSettings((prev) => ({ ...prev, apqEnabled: false, apqUnsupportedDetected: true }));
      setApqUnsupportedToast(true);
      const connId = apqInfo.connectionId ?? connectionIdRef.current;
      if (connId) {
        void readKey(`gql_conn_detection_${connId}`)
          .then((raw) => {
            const existing = raw ? (JSON.parse(raw) as { apq?: boolean; batch?: boolean }) : {};
            return writeKey(`gql_conn_detection_${connId}`, JSON.stringify({ ...existing, apq: true }));
          })
          .catch(() => { /* no-op */ });
      }
    }
  }, [apqInfo]);

  return {
    advSettingsOpen,
    setAdvSettingsOpen,
    advSettingsBtnRef,
    advSettings,
    advSettingsRef,
    setAdvSettings,
    apqUnsupportedToast,
    setApqUnsupportedToast,
    batchUnsupportedToast,
    setBatchUnsupportedToast,
    connectionIdRef,
    handleAdvSettingsChange,
  };
}
