/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharedDsListPanel } from './useSharedDsListPanel';
import type { SharedDataSource } from '../../../shared/types';

function createMockSharedDs(id: string, name: string): SharedDataSource {
  return {
    id,
    name,
    dataSource: { id: `ds-${id}`, columns: [], rows: [], source: { type: 'inline' } },
    updatedAt: Date.now(),
  };
}

describe('useSharedDsListPanel', () => {
  const mockDs1 = createMockSharedDs('ds-1', 'Users');
  const mockDs2 = createMockSharedDs('ds-2', 'Products');
  const mockDs3 = createMockSharedDs('ds-3', 'Orders');
  let mockSources: SharedDataSource[];
  let mockOnUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSources = [mockDs1, mockDs2, mockDs3];
    mockOnUpdate = vi.fn();
  });

  describe('selection', () => {
    it('selects first item by default when no initialSelectedId', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      expect(result.current.selectedId).toBe('ds-1');
      expect(result.current.selected?.name).toBe('Users');
    });

    it('uses initialSelectedId when provided', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, initialSelectedId: 'ds-2', onUpdate: mockOnUpdate })
      );
      expect(result.current.selectedId).toBe('ds-2');
      expect(result.current.selected?.name).toBe('Products');
    });

    it('returns null when no data sources', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: [], onUpdate: mockOnUpdate })
      );
      expect(result.current.selectedId).toBe(null);
      expect(result.current.selected).toBe(null);
    });

    it('allows changing selection', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.setSelectedId('ds-3');
      });
      expect(result.current.selectedId).toBe('ds-3');
      expect(result.current.selected?.name).toBe('Orders');
    });
  });

  describe('filtering', () => {
    it('returns all items when search is empty', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      expect(result.current.filteredList).toHaveLength(3);
    });

    it('filters by name case-insensitively', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.setListSearch('prod');
      });
      expect(result.current.filteredList).toHaveLength(1);
      expect(result.current.filteredList[0].name).toBe('Products');
    });

    it('returns empty when no matches', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.setListSearch('xyz');
      });
      expect(result.current.filteredList).toHaveLength(0);
    });

    it('returns all items when search is whitespace only', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.setListSearch('   ');
      });
      expect(result.current.filteredList).toHaveLength(3);
    });
  });

  describe('context menu', () => {
    it('starts with no context menu open', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      expect(result.current.contextMenuId).toBe(null);
    });

    it('can open and close context menu', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.setContextMenuId('ds-1');
      });
      expect(result.current.contextMenuId).toBe('ds-1');
      
      act(() => {
        result.current.setContextMenuId(null);
      });
      expect(result.current.contextMenuId).toBe(null);
    });
  });

  describe('renaming', () => {
    it('starts with no renaming active', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      expect(result.current.renamingId).toBe(null);
    });

    it('startRenaming sets up rename state and clears context menu', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.setContextMenuId('ds-1');
        result.current.startRenaming('ds-1', 'Users');
      });
      expect(result.current.renamingId).toBe('ds-1');
      expect(result.current.renameValue).toBe('Users');
      expect(result.current.contextMenuId).toBe(null);
    });

    it('handleRename updates the data source', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.startRenaming('ds-1', 'Users');
        result.current.handleRename('ds-1', 'New Users Name');
      });
      expect(mockOnUpdate).toHaveBeenCalled();
      const updated = mockOnUpdate.mock.calls[0][0];
      expect(updated.find((ds: SharedDataSource) => ds.id === 'ds-1')?.name).toBe('New Users Name');
      expect(result.current.renamingId).toBe(null);
    });

    it('handleRename does nothing for empty name', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.startRenaming('ds-1', 'Users');
        result.current.handleRename('ds-1', '');
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
      expect(result.current.renamingId).toBe(null);
    });

    it('handleRename treats whitespace-only name as empty', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.startRenaming('ds-1', 'Users');
        result.current.handleRename('ds-1', '   ');
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
      expect(result.current.renamingId).toBe(null);
    });

    it('cancelRenaming clears renaming state', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.startRenaming('ds-1', 'Users');
        result.current.cancelRenaming();
      });
      expect(result.current.renamingId).toBe(null);
    });
  });

  describe('panel collapse', () => {
    it('starts expanded', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      expect(result.current.listPanelCollapsed).toBe(false);
    });

    it('can toggle collapse state', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.setListPanelCollapsed(true);
      });
      expect(result.current.listPanelCollapsed).toBe(true);
      
      act(() => {
        result.current.setListPanelCollapsed(false);
      });
      expect(result.current.listPanelCollapsed).toBe(false);
    });
  });

  describe('resize', () => {
    it('starts with default width of 220', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      expect(result.current.listPanelWidth).toBe(220);
    });

    it('starts not resizing', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      expect(result.current.isResizing).toBe(false);
    });

    it('handleResizeMouseDown starts resizing', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 220,
      } as unknown as React.MouseEvent<HTMLDivElement>;

      act(() => {
        result.current.handleResizeMouseDown(mockEvent);
      });
      expect(result.current.isResizing).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('updates width on mousemove while resizing', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 200,
      } as unknown as React.MouseEvent<HTMLDivElement>;

      act(() => {
        result.current.handleResizeMouseDown(mockEvent);
      });
      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 250 }));
      });
      expect(result.current.listPanelWidth).toBe(270);
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
      });
      expect(result.current.isResizing).toBe(false);
    });

    it('clamps resize width between 180 and 450 (min)', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.handleResizeMouseDown({
          preventDefault: vi.fn(),
          clientX: 300,
        } as unknown as React.MouseEvent<HTMLDivElement>);
      });
      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: -500 }));
      });
      expect(result.current.listPanelWidth).toBe(180);
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
      });
    });

    it('clamps resize width to max 450', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.handleResizeMouseDown({
          preventDefault: vi.fn(),
          clientX: 300,
        } as unknown as React.MouseEvent<HTMLDivElement>);
      });
      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 99999 }));
      });
      expect(result.current.listPanelWidth).toBe(450);
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
      });
    });
  });

  describe('pendingNameFocusId', () => {
    it('starts as null', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      expect(result.current.pendingNameFocusId).toBe(null);
    });

    it('can be set and cleared', () => {
      const { result } = renderHook(() =>
        useSharedDsListPanel({ sharedDataSources: mockSources, onUpdate: mockOnUpdate })
      );
      act(() => {
        result.current.setPendingNameFocusId('ds-1');
      });
      expect(result.current.pendingNameFocusId).toBe('ds-1');
      
      act(() => {
        result.current.setPendingNameFocusId(null);
      });
      expect(result.current.pendingNameFocusId).toBe(null);
    });
  });
});
