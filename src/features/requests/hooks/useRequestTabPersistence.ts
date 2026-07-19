import type { RequestTab, RequestCollection } from '../../../shared/types';
import { readKey, writeKey } from '../../../shared/utils/storage';
import { findRequestInCollection } from '../utils/requestTree';

const STORAGE_KEY = 'redfire-request-tabs-v1';
const SAVE_DEBOUNCE_MS = 500;

export interface PersistedRequestTabState {
  tabs: RequestTab[];
  activeTabId: string;
}

// ─── Save ────────────────────────────────────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSave(state: PersistedRequestTabState): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    void writeKey(STORAGE_KEY, JSON.stringify(state));
  }, SAVE_DEBOUNCE_MS);
}

export function flushSave(state: PersistedRequestTabState): void {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  void writeKey(STORAGE_KEY, JSON.stringify(state));
}

// ─── Load & Validate ─────────────────────────────────────────────

export async function loadPersistedTabs(
  collections: RequestCollection[],
): Promise<PersistedRequestTabState | null> {
  try {
    const raw = await readKey(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRequestTabState;
    if (!parsed || !Array.isArray(parsed.tabs)) return null;
    return validateTabState(parsed, collections);
  } catch {
    return null;
  }
}

function validateTabState(
  state: PersistedRequestTabState,
  collections: RequestCollection[],
): PersistedRequestTabState | null {
  const validTabs = state.tabs.filter((tab) => {
    const col = collections.find((c) => c.id === tab.collectionId);
    if (!col) return false;
    return !!findRequestInCollection(col, tab.requestId);
  });

  if (validTabs.length === 0) return null;

  const activeStillValid = validTabs.some((t) => t.id === state.activeTabId);
  return {
    tabs: validTabs,
    activeTabId: activeStillValid ? state.activeTabId : validTabs[0].id,
  };
}

// ─── Legacy Migration ────────────────────────────────────────────

export interface LegacySelection {
  selectedCollectionId?: string;
  selectedRequestId?: string;
  selectedEnvId?: string;
}

/**
 * One-time migration: if no persisted tab state exists but the legacy
 * `RequestsData` has a valid selection, seed a single tab from it.
 */
export function migrateFromLegacySelection(
  legacy: LegacySelection,
  collections: RequestCollection[],
): PersistedRequestTabState | null {
  const { selectedCollectionId, selectedRequestId, selectedEnvId } = legacy;
  if (!selectedCollectionId || !selectedRequestId) return null;

  const col = collections.find((c) => c.id === selectedCollectionId);
  if (!col) return null;

  const req = findRequestInCollection(col, selectedRequestId);
  if (!req) return null;

  const tab: RequestTab = {
    id: 'req-tab-1',
    collectionId: selectedCollectionId,
    requestId: selectedRequestId,
    label: req.name || req.url || 'Untitled',
    activeSubTab: 'params',
    responseSubTab: 'preview',
    inputMode: 'builder',
    envId: selectedEnvId,
  };

  return { tabs: [tab], activeTabId: tab.id };
}

// ─── Test Helpers ────────────────────────────────────────────────

export function _clearPendingSave(): void {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
}

export { STORAGE_KEY as _STORAGE_KEY };
