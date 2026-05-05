/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useWhatsNew,
  getWhatsNewItems,
  isManualNew,
  isManualUpdated,
  getManualBadge,
} from './useWhatsNew';

// Mock manual metadata
vi.mock('../../../data/galleries/trainingPaths/manualMetadata', () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const mockMetadata = [
    // New manual (added 5 days ago)
    { manualPath: 'test/new-manual.html', addedAt: now - 5 * day },
    // Updated manual (added 30 days ago, updated 3 days ago)
    { manualPath: 'test/updated-manual.html', addedAt: now - 30 * day, updatedAt: now - 3 * day, changeNote: 'Added new section' },
    // Old manual (added 30 days ago, never updated)
    { manualPath: 'test/old-manual.html', addedAt: now - 30 * day },
    // Very old updated (updated 20 days ago - outside window)
    { manualPath: 'test/old-updated.html', addedAt: now - 60 * day, updatedAt: now - 20 * day },
  ];

  return {
    manualMetadata: mockMetadata,
    metadataByPath: new Map(mockMetadata.map(m => [m.manualPath, m])),
    getManualMetadata: (path: string) => mockMetadata.find(m => m.manualPath === path),
  };
});

// Mock training paths
vi.mock('../../../data/galleries/trainingPaths', () => ({
  trainingPaths: [
    {
      id: 'test-path',
      name: 'Test Path',
      icon: '🧪',
      description: 'A test path',
      phases: [
        {
          id: 1,
          name: 'Phase 1',
          manuals: [
            { title: 'New Manual', description: 'A new manual', difficulty: 'easy', manualPath: 'test/new-manual.html', sampleId: 'sample-1' },
            { title: 'Updated Manual', description: 'An updated manual', difficulty: 'medium', manualPath: 'test/updated-manual.html' },
            { title: 'Old Manual', description: 'An old manual', difficulty: 'advanced', manualPath: 'test/old-manual.html' },
            { title: 'Old Updated Manual', description: 'An old updated manual', difficulty: 'easy', manualPath: 'test/old-updated.html' },
          ],
        },
      ],
    },
  ],
}));

describe('isManualNew', () => {
  it('returns true for manual added within default window (14 days)', () => {
    expect(isManualNew('test/new-manual.html')).toBe(true);
  });

  it('returns false for manual added outside default window', () => {
    expect(isManualNew('test/old-manual.html')).toBe(false);
  });

  it('returns false for non-existent manual', () => {
    expect(isManualNew('test/nonexistent.html')).toBe(false);
  });

  it('respects custom window parameter', () => {
    // New manual was added 5 days ago
    expect(isManualNew('test/new-manual.html', 3)).toBe(false); // 3 day window
    expect(isManualNew('test/new-manual.html', 7)).toBe(true);  // 7 day window
  });
});

describe('isManualUpdated', () => {
  it('returns true for manual updated within default window', () => {
    expect(isManualUpdated('test/updated-manual.html')).toBe(true);
  });

  it('returns false for manual never updated', () => {
    expect(isManualUpdated('test/old-manual.html')).toBe(false);
  });

  it('returns false for manual updated outside window', () => {
    expect(isManualUpdated('test/old-updated.html')).toBe(false);
  });

  it('returns false for non-existent manual', () => {
    expect(isManualUpdated('test/nonexistent.html')).toBe(false);
  });

  it('returns false for new manual (not considered update)', () => {
    // A manual that was just added should show as "new", not "updated"
    expect(isManualUpdated('test/new-manual.html')).toBe(false);
  });
});

describe('getManualBadge', () => {
  it('returns "new" for recently added manual', () => {
    expect(getManualBadge('test/new-manual.html')).toBe('new');
  });

  it('returns "updated" for recently updated manual', () => {
    expect(getManualBadge('test/updated-manual.html')).toBe('updated');
  });

  it('returns null for old manual', () => {
    expect(getManualBadge('test/old-manual.html')).toBeNull();
  });

  it('returns null for non-existent manual', () => {
    expect(getManualBadge('test/nonexistent.html')).toBeNull();
  });
});

describe('getWhatsNewItems', () => {
  it('returns new and updated items sorted by timestamp descending', () => {
    const items = getWhatsNewItems();

    expect(items.length).toBe(2); // new-manual and updated-manual
    
    // Should include the new manual
    const newItem = items.find(i => i.metadata.manualPath === 'test/new-manual.html');
    expect(newItem).toBeDefined();
    expect(newItem?.type).toBe('new');
    expect(newItem?.manual.title).toBe('New Manual');
    expect(newItem?.pathName).toBe('Test Path');
    expect(newItem?.phaseName).toBe('Phase 1');

    // Should include the updated manual
    const updatedItem = items.find(i => i.metadata.manualPath === 'test/updated-manual.html');
    expect(updatedItem).toBeDefined();
    expect(updatedItem?.type).toBe('updated');
    expect(updatedItem?.metadata.changeNote).toBe('Added new section');
  });

  it('excludes items outside the time window', () => {
    const items = getWhatsNewItems();
    
    // Should NOT include old-manual (added 30 days ago)
    const oldItem = items.find(i => i.metadata.manualPath === 'test/old-manual.html');
    expect(oldItem).toBeUndefined();

    // Should NOT include old-updated (updated 20 days ago)
    const oldUpdatedItem = items.find(i => i.metadata.manualPath === 'test/old-updated.html');
    expect(oldUpdatedItem).toBeUndefined();
  });

  it('respects custom time window', () => {
    // With 2-day window, nothing should be new (newest is 3 days old)
    const items = getWhatsNewItems(2);
    expect(items.length).toBe(0);
  });

  it('sorts items by timestamp descending (most recent first)', () => {
    const items = getWhatsNewItems();
    
    // Check that timestamps are in descending order
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].timestamp).toBeGreaterThanOrEqual(items[i].timestamp);
    }
  });
});

describe('useWhatsNew', () => {
  it('returns all items and display items', () => {
    const { result } = renderHook(() => useWhatsNew());

    expect(result.current.allItems.length).toBe(2);
    expect(result.current.displayedItems.length).toBe(2); // Less than limit
  });

  it('counts new and updated items correctly', () => {
    const { result } = renderHook(() => useWhatsNew());

    expect(result.current.counts.newCount).toBe(1);
    expect(result.current.counts.updatedCount).toBe(1);
    expect(result.current.counts.total).toBe(2);
  });

  it('toggles expanded state', () => {
    const { result } = renderHook(() => useWhatsNew());

    expect(result.current.isExpanded).toBe(true);

    act(() => {
      result.current.toggleExpanded();
    });

    expect(result.current.isExpanded).toBe(false);

    act(() => {
      result.current.toggleExpanded();
    });

    expect(result.current.isExpanded).toBe(true);
  });

  it('toggles showAll state', () => {
    const { result } = renderHook(() => useWhatsNew());

    expect(result.current.showAll).toBe(false);

    act(() => {
      result.current.toggleShowAll();
    });

    expect(result.current.showAll).toBe(true);
  });

  it('provides helper functions that match standalone functions', () => {
    const { result } = renderHook(() => useWhatsNew());

    // checkIsNew should match isManualNew
    expect(result.current.checkIsNew('test/new-manual.html')).toBe(true);
    expect(result.current.checkIsNew('test/old-manual.html')).toBe(false);

    // checkIsUpdated should match isManualUpdated
    expect(result.current.checkIsUpdated('test/updated-manual.html')).toBe(true);
    expect(result.current.checkIsUpdated('test/old-manual.html')).toBe(false);

    // getBadge should match getManualBadge
    expect(result.current.getBadge('test/new-manual.html')).toBe('new');
    expect(result.current.getBadge('test/updated-manual.html')).toBe('updated');
    expect(result.current.getBadge('test/old-manual.html')).toBeNull();
  });

  it('respects custom withinDays parameter', () => {
    const { result } = renderHook(() => useWhatsNew(2)); // 2-day window

    // With 2-day window, nothing is new (newest item is 3 days old)
    expect(result.current.allItems.length).toBe(0);
    expect(result.current.counts.total).toBe(0);
  });

  it('hasMore is false when items are under limit', () => {
    const { result } = renderHook(() => useWhatsNew());

    // We only have 2 items, which is less than the default limit of 5
    expect(result.current.hasMore).toBe(false);
  });
});

describe('WhatsNewItem structure', () => {
  it('includes all required fields', () => {
    const items = getWhatsNewItems();
    const item = items[0];

    expect(item).toHaveProperty('type');
    expect(item).toHaveProperty('metadata');
    expect(item).toHaveProperty('manual');
    expect(item).toHaveProperty('pathName');
    expect(item).toHaveProperty('pathIcon');
    expect(item).toHaveProperty('phaseName');
    expect(item).toHaveProperty('timestamp');

    // Check metadata has expected fields
    expect(item.metadata).toHaveProperty('manualPath');
    expect(item.metadata).toHaveProperty('addedAt');

    // Check manual has expected fields
    expect(item.manual).toHaveProperty('title');
    expect(item.manual).toHaveProperty('description');
    expect(item.manual).toHaveProperty('difficulty');
  });

  it('includes sampleId when manual has one', () => {
    const items = getWhatsNewItems();
    const newItem = items.find(i => i.metadata.manualPath === 'test/new-manual.html');
    
    expect(newItem?.manual.sampleId).toBe('sample-1');
  });
});
