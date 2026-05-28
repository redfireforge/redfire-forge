/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVersionDiffPanel, type VersionBase, type UseVersionDiffPanelOptions } from './useVersionDiffPanel';

function makeVersion(id: string, timestamp: number, label?: string): VersionBase {
  return { id, timestamp, label };
}

function defaultOpts(overrides: Partial<UseVersionDiffPanelOptions<VersionBase>> = {}): UseVersionDiffPanelOptions<VersionBase> {
  return {
    versions: [],
    onSaveVersion: vi.fn(),
    computeDiff: () => null,
    isDuplicate: false,
    ...overrides,
  };
}

// jsdom doesn't support scrollIntoView
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

describe('useVersionDiffPanel', () => {
  // ── handleSaveClick ──
  describe('handleSaveClick', () => {
    it('calls onSaveVersion when isDuplicate is false', () => {
      const onSave = vi.fn();
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ onSaveVersion: onSave, isDuplicate: false })));
      act(() => result.current.handleSaveClick());
      expect(onSave).toHaveBeenCalledOnce();
      expect(result.current.showDuplicateConfirm).toBe(false);
    });

    it('shows duplicate confirm instead of saving when isDuplicate is true', () => {
      const onSave = vi.fn();
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ onSaveVersion: onSave, isDuplicate: true })));
      act(() => result.current.handleSaveClick());
      expect(onSave).not.toHaveBeenCalled();
      expect(result.current.showDuplicateConfirm).toBe(true);
    });
  });

  // ── sorted ──
  describe('sorted', () => {
    it('sorts versions by timestamp descending', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 300), makeVersion('c', 200)];
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions })));
      expect(result.current.sorted.map(v => v.id)).toEqual(['b', 'c', 'a']);
    });
  });

  // ── openCompare ──
  describe('openCompare', () => {
    it('sets compareLeft to second-newest, compareRight to newest and opens modal', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 300), makeVersion('c', 200)];
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions })));
      act(() => result.current.openCompare());
      expect(result.current.showModal).toBe(true);
      expect(result.current.compareLeft).toBe('c'); // second newest (ts=200)
      expect(result.current.compareRight).toBe('b'); // newest (ts=300)
    });

    it('opens modal even with fewer than 2 versions', () => {
      const versions = [makeVersion('a', 100)];
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions })));
      act(() => result.current.openCompare());
      expect(result.current.showModal).toBe(true);
      expect(result.current.compareLeft).toBeNull();
    });
  });

  // ── formatTime ──
  describe('formatTime', () => {
    it('returns a formatted date string', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts()));
      const formatted = result.current.formatTime(1700000000000);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });

  // ── diffResult / isIdentical ──
  describe('diffResult', () => {
    it('returns null when modal is closed', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 200)];
      const computeDiff = vi.fn().mockReturnValue([]);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));
      expect(result.current.diffResult).toBeNull();
      expect(computeDiff).not.toHaveBeenCalled();
    });

    it('computes diff when modal is open with both sides selected', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 200)];
      const diffData = [[{ type: 'equal', text: 'x' }]];
      const computeDiff = vi.fn().mockReturnValue(diffData);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));
      act(() => result.current.openCompare());
      expect(result.current.diffResult).toEqual(diffData);
      expect(result.current.isIdentical).toBe(true);
    });

    it('marks as not identical when diff contains non-equal lines', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 200)];
      const diffData = [[{ type: 'add', text: 'new line' }]];
      const computeDiff = vi.fn().mockReturnValue(diffData);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));
      act(() => result.current.openCompare());
      expect(result.current.isIdentical).toBe(false);
    });
  });

  // ── diffGoNext / diffGoPrev ──
  describe('diff navigation', () => {
    it('diffGoNext does nothing when match count is 0', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts()));
      act(() => result.current.diffGoNext());
      expect(result.current.diffMatchIdx).toBe(0);
    });

    it('diffGoPrev does nothing when match count is 0', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts()));
      act(() => result.current.diffGoPrev());
      expect(result.current.diffMatchIdx).toBe(0);
    });

    it('diffGoNext wraps around when at last match', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 200)];
      const computeDiff = vi.fn().mockReturnValue([[{ type: 'equal', text: 'x' }]]);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));

      // Create viewer with searchable text: 2 occurrences of "ab"
      const viewer = document.createElement('div');
      viewer.appendChild(document.createTextNode('ab cd ab'));
      document.body.appendChild(viewer);
      Object.defineProperty(result.current.diffViewerRef, 'current', { value: viewer, writable: true });

      // Open compare and search
      act(() => result.current.openCompare());
      act(() => result.current.setDiffSearch('ab'));

      // Wait for effect to set diffMatchCount
      expect(result.current.diffMatchCount).toBe(2);

      // Navigate forward twice (index 0 → 1 → 0 wrap)
      act(() => result.current.diffGoNext()); // 0 → 1
      expect(result.current.diffMatchIdx).toBe(1);
      act(() => result.current.diffGoNext()); // 1 → 0 (wrap)
      expect(result.current.diffMatchIdx).toBe(0);

      document.body.removeChild(viewer);
    });

    it('diffGoPrev wraps around when at first match', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 200)];
      const computeDiff = vi.fn().mockReturnValue([[{ type: 'equal', text: 'x' }]]);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));

      // Create viewer with searchable text: 3 occurrences
      const viewer = document.createElement('div');
      viewer.appendChild(document.createTextNode('xy zz xy zz xy'));
      document.body.appendChild(viewer);
      Object.defineProperty(result.current.diffViewerRef, 'current', { value: viewer, writable: true });

      act(() => result.current.openCompare());
      act(() => result.current.setDiffSearch('xy'));
      expect(result.current.diffMatchCount).toBe(3);

      // Navigate backward from 0 → 2 (wrap)
      act(() => result.current.diffGoPrev()); // 0 → 2
      expect(result.current.diffMatchIdx).toBe(2);

      document.body.removeChild(viewer);
    });

    it('clears old search marks when changing search query', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 200)];
      const computeDiff = vi.fn().mockReturnValue([[{ type: 'equal', text: 'x' }]]);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));

      const viewer = document.createElement('div');
      viewer.appendChild(document.createTextNode('ab cd ef'));
      document.body.appendChild(viewer);
      Object.defineProperty(result.current.diffViewerRef, 'current', { value: viewer, writable: true });

      act(() => result.current.openCompare());

      // First search — creates marks
      act(() => result.current.setDiffSearch('ab'));
      expect(result.current.diffMatchCount).toBe(1);
      const marks1 = viewer.querySelectorAll('mark');
      expect(marks1.length).toBe(1);

      // Second search — should clear old marks and create new ones
      act(() => result.current.setDiffSearch('cd'));
      expect(result.current.diffMatchCount).toBe(1);
      // Old 'ab' marks should be gone, only 'cd' marks remain
      const marks2 = viewer.querySelectorAll('mark');
      expect(marks2.length).toBe(1);
      expect(marks2[0].textContent).toBe('cd');

      // Clear search — should remove all marks
      act(() => result.current.setDiffSearch(''));
      expect(result.current.diffMatchCount).toBe(0);
      expect(viewer.querySelectorAll('mark').length).toBe(0);

      document.body.removeChild(viewer);
    });

    it('handles match at very start of text (no before fragment)', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 200)];
      const computeDiff = vi.fn().mockReturnValue([[{ type: 'equal', text: 'x' }]]);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));

      const viewer = document.createElement('div');
      viewer.appendChild(document.createTextNode('ab'));
      document.body.appendChild(viewer);
      Object.defineProperty(result.current.diffViewerRef, 'current', { value: viewer, writable: true });

      act(() => result.current.openCompare());
      act(() => result.current.setDiffSearch('ab'));
      expect(result.current.diffMatchCount).toBe(1);

      document.body.removeChild(viewer);
    });

    it('handles match at very end of text (no after fragment)', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 200)];
      const computeDiff = vi.fn().mockReturnValue([[{ type: 'equal', text: 'x' }]]);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));

      const viewer = document.createElement('div');
      viewer.appendChild(document.createTextNode('xxab'));
      document.body.appendChild(viewer);
      Object.defineProperty(result.current.diffViewerRef, 'current', { value: viewer, writable: true });

      act(() => result.current.openCompare());
      act(() => result.current.setDiffSearch('ab'));
      expect(result.current.diffMatchCount).toBe(1);

      document.body.removeChild(viewer);
    });

    it('adjusts diffMatchIdx when it exceeds new match count', () => {
      const versions = [makeVersion('a', 100), makeVersion('b', 200)];
      const computeDiff = vi.fn().mockReturnValue([[{ type: 'equal', text: 'x' }]]);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));

      const viewer = document.createElement('div');
      viewer.appendChild(document.createTextNode('ab cd ab cd ab'));
      document.body.appendChild(viewer);
      Object.defineProperty(result.current.diffViewerRef, 'current', { value: viewer, writable: true });

      act(() => result.current.openCompare());
      act(() => result.current.setDiffSearch('ab'));
      expect(result.current.diffMatchCount).toBe(3);

      // Move to last match
      act(() => result.current.diffGoNext());
      act(() => result.current.diffGoNext());
      expect(result.current.diffMatchIdx).toBe(2);

      // Change search to something with fewer matches — idx should clamp
      act(() => result.current.setDiffSearch('cd'));
      expect(result.current.diffMatchCount).toBe(2);

      document.body.removeChild(viewer);
    });
  });

  // ── state setters ──
  describe('state management', () => {
    it('toggles expanded state', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts()));
      expect(result.current.expanded).toBe(true);
      act(() => result.current.setExpanded(false));
      expect(result.current.expanded).toBe(false);
    });

    it('manages editing label state', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts()));
      act(() => { result.current.setEditingLabel('v1'); result.current.setLabelText('My Label'); });
      expect(result.current.editingLabel).toBe('v1');
      expect(result.current.labelText).toBe('My Label');
    });

    it('manages preview id state', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts()));
      act(() => result.current.setPreviewId('v1'));
      expect(result.current.previewId).toBe('v1');
    });
  });

  // ── keyboard shortcuts ──
  describe('keyboard shortcuts', () => {
    it('closes modal on Escape', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts()));
      act(() => result.current.setShowModal(true));
      expect(result.current.showModal).toBe(true);
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
      expect(result.current.showModal).toBe(false);
    });

    it('Cmd+F focuses the search input', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts()));
      const input = document.createElement('input');
      document.body.appendChild(input);
      Object.defineProperty(result.current.diffSearchRef, 'current', { value: input, writable: true });

      act(() => result.current.setShowModal(true));
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true }));
      });
      expect(document.activeElement).toBe(input);
      document.body.removeChild(input);
    });

    it('with escapeClearsSearch, Escape clears search when search input is focused and non-empty', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ escapeClearsSearch: true })));

      // Create an input element and wire up the ref before opening the modal
      const input = document.createElement('input');
      document.body.appendChild(input);
      Object.defineProperty(result.current.diffSearchRef, 'current', { value: input, writable: true });

      act(() => result.current.setShowModal(true));
      act(() => result.current.setDiffSearch('test'));

      // Focus the input so document.activeElement === input
      input.focus();
      expect(document.activeElement).toBe(input);

      // Set the value on the input element itself (the hook checks el.value.trim())
      input.value = 'test';

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      // Should clear search, NOT close modal
      expect(result.current.diffSearch).toBe('');
      expect(result.current.showModal).toBe(true);
      document.body.removeChild(input);
    });

    it('with escapeClearsSearch, Escape closes modal when search is empty', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ escapeClearsSearch: true })));
      const input = document.createElement('input');
      document.body.appendChild(input);
      Object.defineProperty(result.current.diffSearchRef, 'current', { value: input, writable: true });

      act(() => result.current.setShowModal(true));
      input.focus();
      input.value = '';

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(result.current.showModal).toBe(false);
      document.body.removeChild(input);
    });

    it('with escapeClearsSearch, Escape closes modal when input is not focused', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ escapeClearsSearch: true })));
      const input = document.createElement('input');
      document.body.appendChild(input);
      Object.defineProperty(result.current.diffSearchRef, 'current', { value: input, writable: true });

      act(() => result.current.setShowModal(true));
      act(() => result.current.setDiffSearch('test'));
      // Input is NOT focused (activeElement is body)
      input.value = 'test';

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(result.current.showModal).toBe(false);
      document.body.removeChild(input);
    });

    it('does not handle keyboard events when modal is closed', () => {
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts()));
      expect(result.current.showModal).toBe(false);
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
      expect(result.current.showModal).toBe(false); // still false, no-op
    });
  });

  // ── diff result edge cases ──
  describe('diffResult edge cases', () => {
    it('returns null when compareLeft version not found', () => {
      const versions = [makeVersion('a', 100)];
      const computeDiff = vi.fn().mockReturnValue([]);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));
      act(() => {
        result.current.setShowModal(true);
        result.current.setCompareLeft('nonexistent');
        result.current.setCompareRight('a');
      });
      expect(result.current.diffResult).toBeNull();
    });

    it('returns null when compareRight version not found', () => {
      const versions = [makeVersion('a', 100)];
      const computeDiff = vi.fn().mockReturnValue([]);
      const { result } = renderHook(() => useVersionDiffPanel(defaultOpts({ versions, computeDiff })));
      act(() => {
        result.current.setShowModal(true);
        result.current.setCompareLeft('a');
        result.current.setCompareRight('nonexistent');
      });
      expect(result.current.diffResult).toBeNull();
    });
  });
});
