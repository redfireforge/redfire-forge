import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsConnectionDraft, WsConnectionProfile, WsProtocolMode, WsBackoffMultiplier, WsTlsConfig } from '../../shared/websocket/types';
import { profileToDraft, resolveBackoffMultiplier } from '../../shared/websocket/types';
import { loadWsProfiles, saveWsProfiles } from '../../shared/websocket/websocketStorage';

const VALID_PROTOCOL_MODES: ReadonlySet<string> = new Set<WsProtocolMode>([
  'auto', 'raw', 'socket-io', 'stomp', 'graphql-ws',
]);

function isValidProtocolMode(value: unknown): value is WsProtocolMode {
  return typeof value === 'string' && VALID_PROTOCOL_MODES.has(value);
}

const VALID_BACKOFF_VALUES = new Set<number>([1, 1.5, 2]);

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function sanitizeTlsConfig(raw: unknown): WsTlsConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const obj = raw as Record<string, unknown>;
  const tls: WsTlsConfig = {};
  if (typeof obj.rejectUnauthorized === 'boolean') tls.rejectUnauthorized = obj.rejectUnauthorized;
  if (typeof obj.caCert === 'string' && obj.caCert.length > 0) tls.caCert = obj.caCert;
  return Object.keys(tls).length > 0 ? tls : undefined;
}

export interface UseWebSocketProfilesReturn {
  profiles: WsConnectionProfile[];
  loading: boolean;
  error: string | null;

  saveProfile: (fields: Omit<WsConnectionProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProfile: (id: string, patch: Partial<WsConnectionProfile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  /** Wipe all profiles (storage + React state) — used by quiet demo setup. */
  clearAllProfiles: () => Promise<void>;
  duplicateProfile: (id: string) => Promise<void>;
  importProfiles: (json: string) => Promise<{ imported: number; errors: string[] }>;
  exportProfiles: () => string;
  loadProfileAsDraft: (id: string) => WsConnectionDraft | null;
}

function sanitizeKvEntries(entries: unknown[]): WsConnectionProfile['headers'] {
  return entries
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map((e) => ({
      key: typeof e.key === 'string' ? e.key : String(e.key ?? ''),
      value: typeof e.value === 'string' ? e.value : String(e.value ?? ''),
      enabled: typeof e.enabled === 'boolean' ? e.enabled : true,
    }));
}

let profileIdCounter = 0;
function generateProfileId(): string {
  profileIdCounter += 1;
  return `ws-profile-${Date.now()}-${profileIdCounter}`;
}

export function useWebSocketProfiles(): UseWebSocketProfilesReturn {
  const [profiles, setProfiles] = useState<WsConnectionProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadWsProfiles()
      .then((loaded) => {
        if (mountedRef.current) {
          setProfiles(loaded);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persist = useCallback(async (next: WsConnectionProfile[]) => {
    setProfiles(next);
    try {
      await saveWsProfiles(next);
      if (mountedRef.current) setError(null);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, []);

  const saveProfile = useCallback(
    async (fields: Omit<WsConnectionProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const newProfile: WsConnectionProfile = {
        ...fields,
        id: generateProfileId(),
        createdAt: now,
        updatedAt: now,
      };
      await persist([...profiles, newProfile]);
    },
    [profiles, persist],
  );

  const updateProfile = useCallback(
    async (id: string, patch: Partial<WsConnectionProfile>) => {
      const idx = profiles.findIndex((p) => p.id === id);
      if (idx === -1) return;
      const updated = { ...profiles[idx], ...patch, updatedAt: new Date().toISOString() };
      const next = [...profiles];
      next[idx] = updated;
      await persist(next);
    },
    [profiles, persist],
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      await persist(profiles.filter((p) => p.id !== id));
    },
    [profiles, persist],
  );

  const clearAllProfiles = useCallback(async () => {
    await persist([]);
  }, [persist]);

  const duplicateProfile = useCallback(
    async (id: string) => {
      const source = profiles.find((p) => p.id === id);
      if (!source) return;
      const now = new Date().toISOString();
      const copy: WsConnectionProfile = {
        ...source,
        id: generateProfileId(),
        name: `${source.name} (copy)`,
        headers: source.headers.map((h) => ({ ...h })),
        queryParams: source.queryParams.map((p) => ({ ...p })),
        tlsConfig: source.tlsConfig ? { ...source.tlsConfig } : undefined,
        createdAt: now,
        updatedAt: now,
      };
      await persist([...profiles, copy]);
    },
    [profiles, persist],
  );

  const importProfiles = useCallback(
    async (json: string): Promise<{ imported: number; errors: string[] }> => {
      const errors: string[] = [];
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return { imported: 0, errors: ['Invalid JSON'] };
      }
      if (!Array.isArray(parsed)) {
        return { imported: 0, errors: ['Expected a JSON array of profiles'] };
      }

      const now = new Date().toISOString();
      const valid: WsConnectionProfile[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (typeof item !== 'object' || item === null) {
          errors.push(`Item ${i}: not an object`);
          continue;
        }
        const obj = item as Record<string, unknown>;
        if (typeof obj.name !== 'string' || typeof obj.url !== 'string') {
          errors.push(`Item ${i}: missing name or url`);
          continue;
        }
        const rawBackoff = typeof obj.backoffMultiplier === 'number' ? obj.backoffMultiplier : undefined;
        valid.push({
          id: generateProfileId(),
          name: String(obj.name),
          url: String(obj.url),
          headers: Array.isArray(obj.headers) ? sanitizeKvEntries(obj.headers) : [],
          queryParams: Array.isArray(obj.queryParams) ? sanitizeKvEntries(obj.queryParams) : [],
          subprotocols: typeof obj.subprotocols === 'string' ? obj.subprotocols : '',
          protocolMode: isValidProtocolMode(obj.protocolMode) ? obj.protocolMode : 'auto',
          autoReconnect: typeof obj.autoReconnect === 'boolean' ? obj.autoReconnect : false,
          maxReconnectAttempts: typeof obj.maxReconnectAttempts === 'number' ? clamp(obj.maxReconnectAttempts, 1, 50) : 5,
          reconnectIntervalMs: typeof obj.reconnectIntervalMs === 'number' ? clamp(obj.reconnectIntervalMs, 500, 60000) : 3000,
          backoffMultiplier: rawBackoff !== undefined && VALID_BACKOFF_VALUES.has(rawBackoff)
            ? resolveBackoffMultiplier(rawBackoff as WsBackoffMultiplier)
            : undefined,
          maxMessages: typeof obj.maxMessages === 'number' ? clamp(obj.maxMessages, 100, 50000) : 1000,
          tlsConfig: sanitizeTlsConfig(obj.tlsConfig),
          notes: typeof obj.notes === 'string' ? obj.notes : undefined,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (valid.length > 0) {
        await persist([...profiles, ...valid]);
      }
      return { imported: valid.length, errors };
    },
    [profiles, persist],
  );

  const exportProfiles = useCallback(() => {
    const sanitized = profiles.map((p) => {
      const { tlsConfig, ...rest } = p;
      if (!tlsConfig) return rest;
      const { clientKey, clientCert, ...safeTls } = tlsConfig;
      const hasRemainingTls = Object.keys(safeTls).length > 0 &&
        (safeTls.rejectUnauthorized !== undefined || safeTls.caCert !== undefined);
      return hasRemainingTls ? { ...rest, tlsConfig: safeTls } : rest;
    });
    return JSON.stringify(sanitized, null, 2);
  }, [profiles]);

  const loadProfileAsDraft = useCallback(
    (id: string): WsConnectionDraft | null => {
      const profile = profiles.find((p) => p.id === id);
      if (!profile) return null;
      return profileToDraft(profile);
    },
    [profiles],
  );

  return {
    profiles,
    loading,
    error,
    saveProfile,
    updateProfile,
    deleteProfile,
    clearAllProfiles,
    duplicateProfile,
    importProfiles,
    exportProfiles,
    loadProfileAsDraft,
  };
}
