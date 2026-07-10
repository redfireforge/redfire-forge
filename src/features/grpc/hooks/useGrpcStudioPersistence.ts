/**
 * Per-tab and session-level state persistence for gRPC Studio.
 * Saves tab state to localStorage on every change and restores on mount.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { GrpcStudioSessionState } from './grpcStudioSessionHelpers';
import type { GrpcStudioTabState, GrpcTabDescriptorState } from '../grpcStudioTypes';
import type { GrpcDescriptor, GrpcDescriptorSourceFingerprint } from '../../../shared/grpc/contracts';

const GRPC_STUDIO_SESSION_STORAGE_KEY = 'grpc-studio-session-v1';
const GRPC_STUDIO_DESCRIPTORS_STORAGE_KEY = 'grpc-studio-descriptors-v1';

/**
 * Properties of GrpcStudioTabState that should be persisted.
 * Excludes in-flight call state, streaming sessions, and large descriptors.
 */
type PersistableTabState = Pick<
  GrpcStudioTabState,
  | 'id'
  | 'title'
  | 'target'
  | 'tlsMode'
  | 'tlsConfig'
  | 'auth'
  | 'metadata'
  | 'timeoutMs'
  | 'connectionId'
  | 'requestMode'
  | 'body'
  | 'envVarOverrides'
  | 'servicesCollapsed'
>;

/**
 * Minimal descriptor state for persistence.
 * Stores only metadata, not the full descriptor binary.
 */
type PersistableDescriptorState = Pick<
  GrpcTabDescriptorState,
  | 'sourceSelection'
  | 'expandedServiceIds'
  | 'protoIngest'
>;

interface GrpcStudioPersistedSession {
  version: number;
  activeTabId: string;
  tabs: PersistableTabState[];
  tabDescriptors: Record<string, PersistableDescriptorState>;
  descriptorSnapshots?: Record<string, PersistedDescriptorSnapshot>;
  timestamp: number;
}

interface PersistedDescriptorSnapshot {
  descriptor?: GrpcDescriptor;
  lastKnownGoodDescriptor?: GrpcDescriptor;
  sourceFingerprint?: GrpcDescriptorSourceFingerprint;
}

interface PersistedDescriptorSnapshotEnvelope {
  version: number;
  timestamp: number;
  tabSnapshots: Record<string, PersistedDescriptorSnapshot>;
}

/**
 * Filter out non-persistable properties from session state.
 */
function extractPersistableSession(session: GrpcStudioSessionState): GrpcStudioPersistedSession {
  const tabs = Array.isArray(session.tabs) ? session.tabs : [];
  const activeTabId = typeof session.activeTabId === 'string' ? session.activeTabId : (tabs[0]?.id ?? '');
  const tabDescriptors = session.tabDescriptors ?? {};

  return {
    version: 1,
    activeTabId,
    tabs: tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      target: tab.target,
      tlsMode: tab.tlsMode,
      tlsConfig: tab.tlsConfig,
      auth: tab.auth,
      metadata: tab.metadata,
      timeoutMs: tab.timeoutMs,
      connectionId: tab.connectionId,
      requestMode: tab.requestMode,
      body: tab.body,
      envVarOverrides: tab.envVarOverrides,
      servicesCollapsed: tab.servicesCollapsed,
    })),
    tabDescriptors: Object.fromEntries(
      Object.entries(tabDescriptors).map(([tabId, desc]) => [
        tabId,
        {
          sourceSelection: desc.sourceSelection,
          expandedServiceIds: desc.expandedServiceIds,
          protoIngest: desc.protoIngest,
        },
      ]),
    ),
    timestamp: Date.now(),
  };
}
/**
 * Restore persisted session from localStorage.
 * Returns null if no valid persisted session is found or if it's too old (>24h).
 */
function restorePersistedSession(): GrpcStudioPersistedSession | null {
  try {
    const stored = localStorage.getItem(GRPC_STUDIO_SESSION_STORAGE_KEY);
    if (!stored) return null;

    const session: GrpcStudioPersistedSession = JSON.parse(stored);

    // Validate structure
    if (session.version !== 1 || !session.tabs || !Array.isArray(session.tabs)) {
      return null;
    }

    // Reject sessions older than 7 days
    if (session.timestamp && Date.now() - session.timestamp > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }

    const descriptorSnapshots = restorePersistedDescriptorSnapshots();
    if (descriptorSnapshots) {
      session.descriptorSnapshots = descriptorSnapshots;
    }

    return session;
  } catch {
    return null;
  }
}

function extractPersistedDescriptorSnapshots(
  session: GrpcStudioSessionState,
): Record<string, PersistedDescriptorSnapshot> {
  const descriptors = session.tabDescriptors ?? {};
  return Object.fromEntries(
    Object.entries(descriptors)
      .filter(([, descriptorState]) => Boolean(
        descriptorState?.descriptor || descriptorState?.lastKnownGoodDescriptor,
      ))
      .map(([tabId, descriptorState]) => [
        tabId,
        {
          descriptor: descriptorState.descriptor,
          lastKnownGoodDescriptor: descriptorState.lastKnownGoodDescriptor,
          sourceFingerprint: descriptorState.sourceFingerprint,
        },
      ]),
  );
}

function restorePersistedDescriptorSnapshots(): Record<string, PersistedDescriptorSnapshot> | null {
  try {
    const raw = localStorage.getItem(GRPC_STUDIO_DESCRIPTORS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedDescriptorSnapshotEnvelope;
    if (!parsed || parsed.version !== 1 || typeof parsed !== 'object') {
      return null;
    }
    if (!parsed.tabSnapshots || typeof parsed.tabSnapshots !== 'object') {
      return null;
    }
    if (parsed.timestamp && Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return parsed.tabSnapshots;
  } catch {
    return null;
  }
}

/**
 * Clear persisted session from localStorage.
 */
export function clearGrpcStudioPersistence(): void {
  try {
    localStorage.removeItem(GRPC_STUDIO_SESSION_STORAGE_KEY);
    localStorage.removeItem(GRPC_STUDIO_DESCRIPTORS_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

/**
 * Hook to persist and restore gRPC Studio session state.
 * - On mount: loads persisted session if available
 * - On session change: saves to localStorage
 */
export function useGrpcStudioPersistence(
  session: GrpcStudioSessionState | { tabs: GrpcStudioTabState[]; activeTabId: string; tabDescriptors: Record<string, GrpcTabDescriptorState> },
  onRestoreSession: (persisted: GrpcStudioPersistedSession) => void,
) {
  // Stable ref so the mount-only effect doesn't need onRestoreSession in its dep array
  const onRestoreSessionRef = useRef(onRestoreSession);
  onRestoreSessionRef.current = onRestoreSession;

  // Restore persisted session on mount
  useEffect(() => {
    const persisted = restorePersistedSession();
    if (persisted) {
      onRestoreSessionRef.current(persisted);
    }
  }, []); // run once on mount

  // Save session to localStorage whenever it changes
  const saveSession = useCallback(() => {
    try {
      const persistable = extractPersistableSession(session as GrpcStudioSessionState);
      const descriptorSnapshots = extractPersistedDescriptorSnapshots(session as GrpcStudioSessionState);
      localStorage.setItem(
        GRPC_STUDIO_SESSION_STORAGE_KEY,
        JSON.stringify(persistable),
      );
      localStorage.setItem(
        GRPC_STUDIO_DESCRIPTORS_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          timestamp: Date.now(),
          tabSnapshots: descriptorSnapshots,
        } satisfies PersistedDescriptorSnapshotEnvelope),
      );
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }, [session]);

  // Debounced save on session change
  useEffect(() => {
    const timer = setTimeout(saveSession, 500); // Save 500ms after last change
    return () => clearTimeout(timer);
  }, [session, saveSession]);

  // Hard refresh can occur before the debounce timer fires. Flush immediately on unload.
  useEffect(() => {
    const flush = () => {
      saveSession();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [saveSession]);
}

export type { GrpcStudioPersistedSession };
