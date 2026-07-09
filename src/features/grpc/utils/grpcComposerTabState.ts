import type { GrpcStudioTabState } from '../grpcStudioTypes';

export type GrpcComposerTab = 'form' | 'metadata' | 'auth' | 'files';

function parsePersistedComposerTab(raw: string | null): GrpcComposerTab | null {
  if (raw === 'form' || raw === 'metadata' || raw === 'auth' || raw === 'files') {
    return raw;
  }
  return null;
}

export function buildGrpcComposerTabStorageKey(tabId: string): string {
  return `grpc-composer-tab:${tabId}`;
}

export function resolveInitialComposerTab(tab: GrpcStudioTabState): GrpcComposerTab {
  try {
    const persisted = parsePersistedComposerTab(sessionStorage.getItem(buildGrpcComposerTabStorageKey(tab.id)));
    if (persisted) return persisted;
  } catch {
    // sessionStorage can be unavailable in some test/runtime environments.
  }
  return 'form';
}

export function persistComposerTab(tabId: string, composerTab: GrpcComposerTab): void {
  try {
    sessionStorage.setItem(buildGrpcComposerTabStorageKey(tabId), composerTab);
  } catch {
    // Best effort only.
  }
}