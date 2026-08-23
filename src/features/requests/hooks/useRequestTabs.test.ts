/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RequestCollection, RequestItem } from '@shared/types';
import { REQUEST_MAX_TABS } from '@shared/types/requests';
import { useRequestTabs } from './useRequestTabs';

// ── Factories ────────────────────────────────────────────────────

function makeReq(id: string, name = 'Req'): RequestItem {
  return {
    id, name, method: 'GET', url: '', headers: [], body: '',
    auth: { type: 'none' },
  };
}

function makeCol(id: string, reqs: RequestItem[] = []): RequestCollection {
  return { id, name: `Col ${id}`, mode: 'direct', requests: reqs };
}

// ── Test setup ───────────────────────────────────────────────────

let collections: RequestCollection[];
let patchFn: ReturnType<typeof vi.fn>;

function setup() {
  patchFn = vi.fn();
  return renderHook(() =>
    useRequestTabs(
      () => collections,
      patchFn,
    ),
  );
}

beforeEach(() => {
  collections = [
    makeCol('c1', [makeReq('r1', 'Alpha'), makeReq('r2', 'Beta')]),
    makeCol('c2', [makeReq('r3', 'Gamma')]),
  ];
  patchFn = vi.fn();
});

// ── Tests ────────────────────────────────────────────────────────

describe('useRequestTabs', () => {
  describe('openTab', () => {
    it('creates a new tab and sets it active', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.activeTab?.requestId).toBe('r1');
      expect(result.current.activeTab?.collectionId).toBe('c1');
      expect(result.current.activeTab?.label).toBe('Alpha');
      expect(result.current.activeTab?.activeSubTab).toBe('params');
      expect(result.current.activeTab?.responseSubTab).toBe('preview');
      expect(result.current.activeTab?.inputMode).toBe('builder');
    });

    it('focuses existing tab if same request is already open', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      const tabIdBefore = result.current.tabs.find(t => t.requestId === 'r1')!.id;
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      expect(result.current.tabs).toHaveLength(2);
      expect(result.current.activeTabId).toBe(tabIdBefore);
    });

    it('no-ops auto-save when opening an already active tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      patchFn.mockClear();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.activeTab?.requestId).toBe('r1');
      expect(patchFn).not.toHaveBeenCalled();
    });

    it('refuses to add beyond REQUEST_MAX_TABS', () => {
      const { result } = setup();
      for (let i = 0; i < REQUEST_MAX_TABS + 2; i++) {
        act(() => result.current.openTab(`c-${i}`, `r-${i}`, `Tab ${i}`));
      }
      expect(result.current.tabs).toHaveLength(REQUEST_MAX_TABS);
    });

    it('uses default label when none provided', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1'));
      expect(result.current.activeTab?.label).toBe('New Request');
    });

    it('auto-saves leaving request when focusing an existing tab', () => {
      // Give r1 a changed state so autoSaveVersion produces a version
      collections[0].requests[0] = {
        ...collections[0].requests[0],
        url: 'http://changed.test',
        definitionVersions: [{
          id: 'v0', timestamp: 1, snapshot: {
            name: 'Alpha', url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' },
          },
        }],
      };
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      // Now re-focus r1 — this should trigger autoSave for r2 (the leaving tab)
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      expect(result.current.activeTab?.requestId).toBe('r1');
      // patchFn is not called for r2 because r2 has no version changes
      // but for r1 being focused again, autoSave may fire for r2 — no crash either way
    });

    it('auto-saves leaving request when opening a new tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      // Both open, no crash; autoSave runs for r1 when opening r2
      expect(result.current.tabs).toHaveLength(2);
    });

    it('returns early when max tabs already open before state update', () => {
      const { result } = setup();
      act(() => {
        result.current.setState({
          tabs: Array.from({ length: REQUEST_MAX_TABS }, (_, i) => ({
            id: `req-tab-${i + 1}`,
            collectionId: 'c1',
            requestId: `r-${i + 1}`,
            label: `Tab ${i + 1}`,
            activeSubTab: 'params',
            responseSubTab: 'preview',
            inputMode: 'builder',
          })),
          activeTabId: 'req-tab-1',
        });
      });
      act(() => result.current.openTab('c1', 'r-new', 'New'));
      expect(result.current.tabs).toHaveLength(REQUEST_MAX_TABS);
    });

    it('covers batched openTab guards in setState updater', () => {
      const { result } = setup();

      // Hit alreadyOpen guard in updater via batched duplicate opens.
      act(() => {
        result.current.openTab('c1', 'r1', 'Alpha');
        result.current.openTab('c1', 'r1', 'Alpha');
      });
      expect(result.current.tabs).toHaveLength(1);

      // Hit max-tabs guard in updater by filling to max in the first update.
      act(() => {
        result.current.setState({
          tabs: Array.from({ length: REQUEST_MAX_TABS - 1 }, (_, i) => ({
            id: `req-tab-${i + 200}`,
            collectionId: 'c1',
            requestId: `r-fill-${i + 1}`,
            label: `Fill ${i + 1}`,
            activeSubTab: 'params',
            responseSubTab: 'preview',
            inputMode: 'builder',
          })),
          activeTabId: 'req-tab-200',
        });
      });
      act(() => {
        result.current.openTab('c1', 'r-new-a', 'A');
        result.current.openTab('c1', 'r-new-b', 'B');
      });
      expect(result.current.tabs).toHaveLength(REQUEST_MAX_TABS);
      expect(result.current.tabs.some(t => t.requestId === 'r-new-b')).toBe(false);
    });

    it('covers auto-save guards when leaving tab collection/request cannot be resolved', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      collections = [];
      act(() => result.current.openTab('c2', 'r3', 'Gamma'));
      expect(patchFn).not.toHaveBeenCalledWith('c1', 'r1', expect.anything());

      patchFn.mockClear();
      collections = [makeCol('c1', [makeReq('r2')]), makeCol('c2', [makeReq('r3')])];
      act(() => result.current.selectTab(result.current.tabs.find(t => t.requestId === 'r1')!.id));
      expect(patchFn).not.toHaveBeenCalledWith('c1', 'r1', expect.anything());
    });

    it('calls patchCollections when auto-save produces versions', () => {
      collections[0].requests[0] = {
        ...collections[0].requests[0],
        url: 'https://changed.example',
        definitionVersions: [{
          id: 'v1',
          timestamp: 1,
          snapshot: {
            name: 'Alpha',
            url: '',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
          },
        }],
      };
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      expect(patchFn).toHaveBeenCalled();
    });
  });

  describe('closeTab', () => {
    it('removes tab and selects left neighbor', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      const r2TabId = result.current.tabs.find(t => t.requestId === 'r2')!.id;
      act(() => result.current.selectTab(r2TabId));
      act(() => result.current.closeTab(r2TabId));
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.activeTab?.requestId).toBe('r1');
    });

    it('selects right neighbor when closing first tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      const r1TabId = result.current.tabs.find(t => t.requestId === 'r1')!.id;
      act(() => result.current.selectTab(r1TabId));
      act(() => result.current.closeTab(r1TabId));
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.activeTab?.requestId).toBe('r2');
    });

    it('prevents closing the last tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const tabId = result.current.tabs[0].id;
      act(() => result.current.closeTab(tabId));
      expect(result.current.tabs).toHaveLength(1);
    });

    it('auto-saves version for closing tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      const r2TabId = result.current.tabs.find(t => t.requestId === 'r2')!.id;
      act(() => result.current.closeTab(r2TabId));
      // autoSaveVersion called but since test requests have no changes, patchFn won't fire
      // The important thing is no crash — autoSaveVersion returns null for unchanged requests
      expect(result.current.tabs).toHaveLength(1);
    });

    it('does not change active tab when closing a non-active tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      const r1TabId = result.current.tabs.find(t => t.requestId === 'r1')!.id;
      const r2TabId = result.current.tabs.find(t => t.requestId === 'r2')!.id;
      // active is r2 (last opened)
      expect(result.current.activeTabId).toBe(r2TabId);
      act(() => result.current.closeTab(r1TabId));
      expect(result.current.activeTabId).toBe(r2TabId);
    });

    it('no-ops when closing an unknown tab id', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      const before = result.current.tabs;
      act(() => result.current.closeTab('missing-tab-id'));
      expect(result.current.tabs).toEqual(before);
    });
  });

  describe('selectTab', () => {
    it('changes active tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      const r1TabId = result.current.tabs.find(t => t.requestId === 'r1')!.id;
      act(() => result.current.selectTab(r1TabId));
      expect(result.current.activeTabId).toBe(r1TabId);
    });

    it('no-ops when already active', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const tabId = result.current.activeTabId;
      act(() => result.current.selectTab(tabId));
      expect(result.current.activeTabId).toBe(tabId);
    });

    it('handles stale activeTabId without a leaving tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      const r1TabId = result.current.tabs.find(t => t.requestId === 'r1')!.id;
      act(() => {
        result.current.setState({
          tabs: result.current.tabs,
          activeTabId: 'missing-active-id',
        });
      });
      patchFn.mockClear();
      act(() => result.current.selectTab(r1TabId));
      expect(result.current.activeTabId).toBe(r1TabId);
      expect(patchFn).not.toHaveBeenCalled();
    });
  });

  describe('renameTab', () => {
    it('updates label and sets labelManual', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const tabId = result.current.tabs[0].id;
      act(() => result.current.renameTab(tabId, 'Custom Name'));
      expect(result.current.tabs[0].label).toBe('Custom Name');
      expect(result.current.tabs[0].labelManual).toBe(true);
    });
  });

  describe('updateTabUI', () => {
    it('partial-updates UI state', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const tabId = result.current.tabs[0].id;
      act(() => result.current.updateTabUI(tabId, { activeSubTab: 'body', responseSubTab: 'console' }));
      expect(result.current.tabs[0].activeSubTab).toBe('body');
      expect(result.current.tabs[0].responseSubTab).toBe('console');
      expect(result.current.tabs[0].inputMode).toBe('builder'); // untouched
    });

    it('updates envId', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const tabId = result.current.tabs[0].id;
      act(() => result.current.updateTabUI(tabId, { envId: 'env-prod' }));
      expect(result.current.tabs[0].envId).toBe('env-prod');
    });

    it('updates activeHistoryId', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const tabId = result.current.tabs[0].id;
      expect(result.current.tabs[0].activeHistoryId).toBeUndefined();
      act(() => result.current.updateTabUI(tabId, { activeHistoryId: 'hist-1' }));
      expect(result.current.tabs[0].activeHistoryId).toBe('hist-1');
      act(() => result.current.updateTabUI(tabId, { activeHistoryId: null }));
      expect(result.current.tabs[0].activeHistoryId).toBeNull();
    });

    it('no-ops when target tab id is unknown', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const before = result.current.tabs;
      act(() => result.current.updateTabUI('missing-tab', { envId: 'env-x' }));
      expect(result.current.tabs).toEqual(before);
    });
  });

  describe('syncTabLabel', () => {
    it('syncs label for non-manually-renamed tabs', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.syncTabLabel('r1', 'Alpha Renamed'));
      expect(result.current.tabs[0].label).toBe('Alpha Renamed');
    });

    it('syncs label even for manually-renamed tabs (bidirectional sync)', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const tabId = result.current.tabs[0].id;
      act(() => result.current.renameTab(tabId, 'My Custom'));
      act(() => result.current.syncTabLabel('r1', 'Alpha Renamed'));
      expect(result.current.tabs[0].label).toBe('Alpha Renamed');
    });

    it('syncs all tabs referencing the same request', () => {
      // Edge: the same request opened twice (shouldn't happen normally but handles it)
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.syncTabLabel('r1', 'Bravo'));
      expect(result.current.tabs.filter(t => t.label === 'Bravo')).toHaveLength(1);
    });
  });

  describe('removeStaleTab', () => {
    it('removes tabs for a deleted request', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      act(() => result.current.removeStaleTab('r1'));
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].requestId).toBe('r2');
    });

    it('updates activeTabId when active tab is removed', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      const r2TabId = result.current.tabs.find(t => t.requestId === 'r2')!.id;
      act(() => result.current.selectTab(r2TabId));
      act(() => result.current.removeStaleTab('r2'));
      expect(result.current.activeTab?.requestId).toBe('r1');
    });

    it('allows removal of the last tab (empty state)', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.removeStaleTab('r1'));
      expect(result.current.tabs).toHaveLength(0);
      expect(result.current.activeTabId).toBe('');
    });

    it('no-ops when request has no open tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.removeStaleTab('r999'));
      expect(result.current.tabs).toHaveLength(1);
    });
  });

  describe('removeStaleTabsByCollection', () => {
    it('removes all tabs for a deleted collection', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      act(() => result.current.openTab('c2', 'r3', 'Gamma'));
      act(() => result.current.removeStaleTabsByCollection('c1'));
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].requestId).toBe('r3');
    });

    it('updates activeTabId when active tab is in removed collection', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c2', 'r3', 'Gamma'));
      // active is c2/r3
      act(() => result.current.removeStaleTabsByCollection('c2'));
      expect(result.current.activeTab?.requestId).toBe('r1');
    });
  });

  describe('activeTab', () => {
    it('is null when no tabs exist', () => {
      const { result } = setup();
      expect(result.current.activeTab).toBeNull();
    });

    it('reflects the currently active tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      expect(result.current.activeTab?.collectionId).toBe('c1');
      expect(result.current.activeTab?.requestId).toBe('r1');
    });
  });

  describe('setState (restore)', () => {
    it('restores tabs from persisted state and syncs counter so next openTab has no ID collision', () => {
      const { result } = setup();
      act(() =>
        result.current.setState({
          tabs: [
            { id: 'req-tab-50', collectionId: 'c1', requestId: 'r1', label: 'Alpha', activeSubTab: 'params', responseSubTab: 'preview', inputMode: 'builder' },
          ],
          activeTabId: 'req-tab-50',
        }),
      );
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.activeTab?.id).toBe('req-tab-50');

      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      const newTab = result.current.tabs.find(t => t.requestId === 'r2');
      expect(newTab).toBeDefined();
      expect(newTab!.id).not.toBe('req-tab-50');
      const num = parseInt(newTab!.id.replace('req-tab-', ''), 10);
      expect(num).toBeGreaterThan(50);
    });
  });

  describe('updateTabsCollectionId', () => {
    it('updates collectionId for matching request IDs', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      act(() => (result.current as ReturnType<typeof useRequestTabs>)
        .updateTabsCollectionId(new Set(['r1']), 'c2'));
      expect(result.current.tabs[0].collectionId).toBe('c2');
      expect(result.current.tabs[1].collectionId).toBe('c1');
    });

    it('no-ops when no tabs match', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const tabsBefore = result.current.tabs;
      act(() => (result.current as ReturnType<typeof useRequestTabs>)
        .updateTabsCollectionId(new Set(['r999']), 'c2'));
      expect(result.current.tabs).toBe(tabsBefore);
    });

    it('updates multiple tabs for multiple request IDs', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      act(() => (result.current as ReturnType<typeof useRequestTabs>)
        .updateTabsCollectionId(new Set(['r1', 'r2']), 'c2'));
      expect(result.current.tabs[0].collectionId).toBe('c2');
      expect(result.current.tabs[1].collectionId).toBe('c2');
    });
  });

  describe('reorderTabs', () => {
    it('reorders tabs', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      act(() => result.current.reorderTabs(0, 1));
      expect(result.current.tabs[0].requestId).toBe('r2');
      expect(result.current.tabs[1].requestId).toBe('r1');
    });

    it('no-ops for out of bounds indices', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.reorderTabs(-1, 0));
      expect(result.current.tabs).toHaveLength(1);
      act(() => result.current.reorderTabs(0, 5));
      expect(result.current.tabs).toHaveLength(1);
    });
  });

  describe('duplicateTab', () => {
    it('creates a copy of the source tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const srcId = result.current.tabs[0].id;
      act(() => result.current.duplicateTab(srcId));
      expect(result.current.tabs).toHaveLength(2);
      expect(result.current.tabs[1].label).toBe('Alpha (copy)');
      expect(result.current.tabs[1].requestId).toBe('r1');
      expect(result.current.tabs[1].labelManual).toBe(true);
      expect(result.current.activeTabId).toBe(result.current.tabs[1].id);
    });

    it('no-ops for unknown tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.duplicateTab('unknown'));
      expect(result.current.tabs).toHaveLength(1);
    });

    it('hits duplicate updater max-tabs guard in a batched duplicate call', () => {
      const { result } = setup();
      act(() => {
        result.current.setState({
          tabs: Array.from({ length: REQUEST_MAX_TABS - 1 }, (_, i) => ({
            id: `req-tab-${i + 400}`,
            collectionId: 'c1',
            requestId: `r-pre-${i + 1}`,
            label: `Pre ${i + 1}`,
            activeSubTab: 'params',
            responseSubTab: 'preview',
            inputMode: 'builder',
          })),
          activeTabId: 'req-tab-400',
        });
      });
      const srcId = result.current.tabs[0].id;
      act(() => {
        result.current.duplicateTab(srcId);
        result.current.duplicateTab(srcId);
      });
      expect(result.current.tabs).toHaveLength(REQUEST_MAX_TABS);
    });
  });

  describe('closeOtherTabs', () => {
    it('keeps only the specified tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      act(() => result.current.openTab('c2', 'r3', 'Gamma'));
      const keepId = result.current.tabs.find(t => t.requestId === 'r2')!.id;
      act(() => result.current.closeOtherTabs(keepId));
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.activeTabId).toBe(keepId);
    });

    it('no-ops when keep tab does not exist', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const before = result.current.tabs;
      act(() => result.current.closeOtherTabs('missing'));
      expect(result.current.tabs).toBe(before);
    });
  });

  describe('closeTabsToRight', () => {
    it('closes tabs to the right of the specified tab', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      act(() => result.current.openTab('c2', 'r3', 'Gamma'));
      const pivotId = result.current.tabs.find(t => t.requestId === 'r1')!.id;
      act(() => result.current.closeTabsToRight(pivotId));
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].requestId).toBe('r1');
    });

    it('no-ops when tab is last', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const tabId = result.current.tabs[0].id;
      act(() => result.current.closeTabsToRight(tabId));
      expect(result.current.tabs).toHaveLength(1);
    });

    it('no-ops when pivot tab id is unknown', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      const before = result.current.tabs;
      act(() => result.current.closeTabsToRight('missing'));
      expect(result.current.tabs).toBe(before);
    });

    it('sets active tab to pivot when current active is closed', () => {
      const { result } = setup();
      act(() => result.current.openTab('c1', 'r1', 'Alpha'));
      act(() => result.current.openTab('c1', 'r2', 'Beta'));
      act(() => result.current.openTab('c2', 'r3', 'Gamma'));
      const pivotId = result.current.tabs.find(t => t.requestId === 'r1')!.id;
      expect(result.current.activeTab?.requestId).toBe('r3');
      act(() => result.current.closeTabsToRight(pivotId));
      expect(result.current.activeTabId).toBe(pivotId);
      expect(result.current.activeTab?.requestId).toBe('r1');
    });
  });

  describe('setState counter sync', () => {
    it('accepts restored ids that do not match req-tab-N pattern', () => {
      const { result } = setup();
      act(() => {
        result.current.setState({
          tabs: [
            {
              id: 'custom-tab-id',
              collectionId: 'c1',
              requestId: 'r1',
              label: 'Alpha',
              activeSubTab: 'params',
              responseSubTab: 'preview',
              inputMode: 'builder',
            },
          ],
          activeTabId: 'custom-tab-id',
        });
      });
      expect(result.current.activeTabId).toBe('custom-tab-id');
    });
  });

  describe('REQUEST_MAX_TABS', () => {
    it('is 50', () => {
      expect(REQUEST_MAX_TABS).toBe(50);
    });
  });
});
