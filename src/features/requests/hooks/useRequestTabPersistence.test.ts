/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RequestTab, RequestCollection, RequestItem } from '../../../shared/types';
import {
  scheduleSave,
  flushSave,
  loadPersistedTabs,
  migrateFromLegacySelection,
  _clearPendingSave,
  _STORAGE_KEY,
} from './useRequestTabPersistence';

// ─── Mock storage ────────────────────────────────────────────────

let _store: Record<string, string> = {};

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(async (key: string) => _store[key] ?? null),
  writeKey: vi.fn(async (key: string, value: string) => { _store[key] = value; }),
}));

// ─── Factories ───────────────────────────────────────────────────

function makeReq(id: string, name = 'Req'): RequestItem {
  return { id, name, method: 'GET', url: '', headers: [], body: '', auth: { type: 'none' } };
}

function makeCol(id: string, reqs: RequestItem[] = []): RequestCollection {
  return { id, name: `Col ${id}`, mode: 'direct', requests: reqs } as RequestCollection;
}

function makeTab(overrides: Partial<RequestTab> = {}): RequestTab {
  return {
    id: 'req-tab-1',
    collectionId: 'c1',
    requestId: 'r1',
    label: 'Test',
    activeSubTab: 'params',
    responseSubTab: 'preview',
    inputMode: 'builder',
    ...overrides,
  };
}

// ─── Setup ───────────────────────────────────────────────────────

beforeEach(() => {
  _store = {};
  _clearPendingSave();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  _clearPendingSave();
});

// ─── Tests ───────────────────────────────────────────────────────

describe('useRequestTabPersistence', () => {
  describe('scheduleSave', () => {
    it('writes to storage after debounce', async () => {
      const state = { tabs: [makeTab()], activeTabId: 'req-tab-1' };
      scheduleSave(state);
      expect(_store[_STORAGE_KEY]).toBeUndefined();

      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(_store[_STORAGE_KEY]).toBeDefined();
      expect(JSON.parse(_store[_STORAGE_KEY])).toEqual(state);
    });

    it('deduplicates rapid saves (only last one writes)', async () => {
      const state1 = { tabs: [makeTab({ label: 'First' })], activeTabId: 'req-tab-1' };
      const state2 = { tabs: [makeTab({ label: 'Second' })], activeTabId: 'req-tab-1' };

      scheduleSave(state1);
      vi.advanceTimersByTime(200);
      scheduleSave(state2);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      const written = JSON.parse(_store[_STORAGE_KEY]);
      expect(written.tabs[0].label).toBe('Second');
    });
  });

  describe('flushSave', () => {
    it('writes immediately and cancels pending debounce', async () => {
      const pendingState = { tabs: [makeTab({ label: 'Pending' })], activeTabId: 'req-tab-1' };
      const flushState = { tabs: [makeTab({ label: 'Flushed' })], activeTabId: 'req-tab-1' };

      scheduleSave(pendingState);
      flushSave(flushState);
      await vi.runAllTimersAsync();

      const written = JSON.parse(_store[_STORAGE_KEY]);
      expect(written.tabs[0].label).toBe('Flushed');
    });
  });

  describe('loadPersistedTabs', () => {
    it('returns null when no data stored', async () => {
      const result = await loadPersistedTabs([makeCol('c1', [makeReq('r1')])]);
      expect(result).toBeNull();
    });

    it('loads valid tabs', async () => {
      const tab = makeTab();
      _store[_STORAGE_KEY] = JSON.stringify({ tabs: [tab], activeTabId: tab.id });

      const result = await loadPersistedTabs([makeCol('c1', [makeReq('r1')])]);
      expect(result).not.toBeNull();
      expect(result!.tabs).toHaveLength(1);
      expect(result!.activeTabId).toBe(tab.id);
    });

    it('prunes tabs with missing collections', async () => {
      const validTab = makeTab({ id: 't1', collectionId: 'c1', requestId: 'r1' });
      const staleTab = makeTab({ id: 't2', collectionId: 'c-gone', requestId: 'r-gone' });
      _store[_STORAGE_KEY] = JSON.stringify({
        tabs: [validTab, staleTab],
        activeTabId: staleTab.id,
      });

      const result = await loadPersistedTabs([makeCol('c1', [makeReq('r1')])]);
      expect(result).not.toBeNull();
      expect(result!.tabs).toHaveLength(1);
      expect(result!.tabs[0].id).toBe('t1');
      expect(result!.activeTabId).toBe('t1');
    });

    it('prunes tabs with missing requests', async () => {
      const tab = makeTab({ requestId: 'r-deleted' });
      _store[_STORAGE_KEY] = JSON.stringify({ tabs: [tab], activeTabId: tab.id });

      const result = await loadPersistedTabs([makeCol('c1', [makeReq('r1')])]);
      expect(result).toBeNull();
    });

    it('recovers activeTabId when it becomes stale', async () => {
      const t1 = makeTab({ id: 't1' });
      const t2 = makeTab({ id: 't2', collectionId: 'c-gone', requestId: 'r-gone' });
      _store[_STORAGE_KEY] = JSON.stringify({ tabs: [t1, t2], activeTabId: 't2' });

      const result = await loadPersistedTabs([makeCol('c1', [makeReq('r1')])]);
      expect(result!.activeTabId).toBe('t1');
    });

    it('returns null for invalid JSON', async () => {
      _store[_STORAGE_KEY] = 'not-json';
      const result = await loadPersistedTabs([makeCol('c1', [makeReq('r1')])]);
      expect(result).toBeNull();
    });

    it('returns null for non-object data', async () => {
      _store[_STORAGE_KEY] = JSON.stringify('hello');
      const result = await loadPersistedTabs([makeCol('c1', [makeReq('r1')])]);
      expect(result).toBeNull();
    });
  });

  describe('migrateFromLegacySelection', () => {
    it('seeds a tab from valid legacy selection', () => {
      const collections = [makeCol('c1', [makeReq('r1', 'My Request')])];
      const result = migrateFromLegacySelection(
        { selectedCollectionId: 'c1', selectedRequestId: 'r1', selectedEnvId: 'env1' },
        collections,
      );
      expect(result).not.toBeNull();
      expect(result!.tabs).toHaveLength(1);
      expect(result!.tabs[0].requestId).toBe('r1');
      expect(result!.tabs[0].collectionId).toBe('c1');
      expect(result!.tabs[0].envId).toBe('env1');
      expect(result!.tabs[0].label).toBe('My Request');
    });

    it('returns null for missing collection', () => {
      const result = migrateFromLegacySelection(
        { selectedCollectionId: 'c-gone', selectedRequestId: 'r1' },
        [makeCol('c1', [makeReq('r1')])],
      );
      expect(result).toBeNull();
    });

    it('returns null for missing request', () => {
      const result = migrateFromLegacySelection(
        { selectedCollectionId: 'c1', selectedRequestId: 'r-gone' },
        [makeCol('c1', [makeReq('r1')])],
      );
      expect(result).toBeNull();
    });

    it('returns null for empty legacy selection', () => {
      expect(migrateFromLegacySelection({}, [makeCol('c1')])).toBeNull();
      expect(migrateFromLegacySelection(
        { selectedCollectionId: 'c1' },
        [makeCol('c1')],
      )).toBeNull();
    });

    it('uses url as label when name is empty', () => {
      const req = makeReq('r1', '');
      req.url = 'https://api.example.com';
      const result = migrateFromLegacySelection(
        { selectedCollectionId: 'c1', selectedRequestId: 'r1' },
        [makeCol('c1', [req])],
      );
      expect(result!.tabs[0].label).toBe('https://api.example.com');
    });
  });
});
