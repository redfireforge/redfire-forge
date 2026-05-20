/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharedDsCrud } from './useSharedDsCrud';
import { SharedDataSource, FeatureGroup } from '../../../shared/types';

function createMockSharedDs(id: string, name: string, rowCount = 2): SharedDataSource {
  return {
    id,
    name,
    dataSource: {
      id: `ds-${id}`,
      columns: [{ id: 'c1', name: 'col1', type: 'path', mapping: 'id' }],
      rows: Array.from({ length: rowCount }, (_, i) => ({
        id: `r${i}`,
        values: { c1: `val${i}` },
        enabled: true,
      })),
      source: { type: 'inline' },
    },
    updatedAt: Date.now(),
  };
}

function createMockFeatureGroup(id: string, sharedDsId?: string): FeatureGroup {
  return {
    id,
    name: `FG ${id}`,
    scenarios: [
      {
        id: `sc-${id}`,
        name: `Scenario ${id}`,
        tests: sharedDsId
          ? [{
              id: `t-${id}`,
              name: `Test ${id}`,
              url: 'https://api.example.com',
              method: 'GET',
              headers: [],
              body: '',
              auth: { type: 'none' },
              sharedDataSourceId: sharedDsId,
            }]
          : [],
      },
    ],
  };
}

describe('useSharedDsCrud', () => {
  let mockSources: SharedDataSource[];
  let mockFeatureGroups: FeatureGroup[];
  let mockOnUpdate: ReturnType<typeof vi.fn>;
  let mockSetSelectedId: ReturnType<typeof vi.fn>;
  let mockSetContextMenuId: ReturnType<typeof vi.fn>;
  let mockSetPendingNameFocusId: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSources = [
      createMockSharedDs('ds-1', 'Users', 3),
      createMockSharedDs('ds-2', 'Products', 5),
    ];
    mockFeatureGroups = [createMockFeatureGroup('fg-1')];
    mockOnUpdate = vi.fn();
    mockSetSelectedId = vi.fn();
    mockSetContextMenuId = vi.fn();
    mockSetPendingNameFocusId = vi.fn();
  });

  const renderCrudHook = (sources = mockSources, selectedId: string | null = 'ds-1') =>
    renderHook(() =>
      useSharedDsCrud({
        sharedDataSources: sources,
        onUpdate: mockOnUpdate,
        selectedId,
        setSelectedId: mockSetSelectedId,
        setContextMenuId: mockSetContextMenuId,
        setPendingNameFocusId: mockSetPendingNameFocusId,
        featureGroups: mockFeatureGroups,
      })
    );

  describe('handleCreate', () => {
    it('creates a new data source with default name', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.handleCreate();
      });
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
      const updated = mockOnUpdate.mock.calls[0][0];
      expect(updated).toHaveLength(3);
      expect(updated[2].name).toBe('Data Source 3');
    });

    it('selects the new data source', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.handleCreate();
      });
      expect(mockSetSelectedId).toHaveBeenCalled();
      const newId = mockOnUpdate.mock.calls[0][0][2].id;
      expect(mockSetSelectedId).toHaveBeenCalledWith(newId);
    });

    it('sets pending name focus for the new data source', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.handleCreate();
      });
      expect(mockSetPendingNameFocusId).toHaveBeenCalled();
    });

    it('creates data source with blank columns and rows', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.handleCreate();
      });
      const newDs = mockOnUpdate.mock.calls[0][0][2];
      expect(newDs.dataSource.columns).toHaveLength(1);
      expect(newDs.dataSource.rows).toHaveLength(1);
    });
  });

  describe('handleDuplicate', () => {
    it('creates a copy with "(copy)" suffix', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.handleDuplicate('ds-1');
      });
      expect(mockOnUpdate).toHaveBeenCalled();
      const updated = mockOnUpdate.mock.calls[0][0];
      expect(updated).toHaveLength(3);
      expect(updated[2].name).toBe('Users (copy)');
    });

    it('selects the duplicated data source', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.handleDuplicate('ds-1');
      });
      expect(mockSetSelectedId).toHaveBeenCalled();
    });

    it('clears context menu', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.handleDuplicate('ds-1');
      });
      expect(mockSetContextMenuId).toHaveBeenCalledWith(null);
    });

    it('does nothing for non-existent id', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.handleDuplicate('non-existent');
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleDelete', () => {
    it('deletes data source when not in use', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.handleDelete('ds-2');
      });
      expect(mockOnUpdate).toHaveBeenCalled();
      const updated = mockOnUpdate.mock.calls[0][0];
      expect(updated).toHaveLength(1);
      expect(updated[0].id).toBe('ds-1');
    });

    it('selects next available item when deleting selected', () => {
      const { result } = renderCrudHook(mockSources, 'ds-1');
      act(() => {
        result.current.handleDelete('ds-1');
      });
      expect(mockSetSelectedId).toHaveBeenCalledWith('ds-2');
    });

    it('sets selectedId to null when deleting last item', () => {
      const singleSource = [createMockSharedDs('ds-1', 'Users')];
      const { result } = renderCrudHook(singleSource, 'ds-1');
      act(() => {
        result.current.handleDelete('ds-1');
      });
      expect(mockSetSelectedId).toHaveBeenCalledWith(null);
    });

    it('sets pendingDeleteId when data source is in use', () => {
      const fgWithSharedDs = createMockFeatureGroup('fg-linked', 'ds-1');
      const { result } = renderHook(() =>
        useSharedDsCrud({
          sharedDataSources: mockSources,
          onUpdate: mockOnUpdate,
          selectedId: 'ds-1',
          setSelectedId: mockSetSelectedId,
          setContextMenuId: mockSetContextMenuId,
          setPendingNameFocusId: mockSetPendingNameFocusId,
          featureGroups: [fgWithSharedDs],
        })
      );
      act(() => {
        result.current.handleDelete('ds-1');
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
      expect(result.current.pendingDeleteId).toBe('ds-1');
    });
  });

  describe('confirmDelete', () => {
    it('deletes data source when confirmDelete is called', () => {
      const fgWithSharedDs = createMockFeatureGroup('fg-linked', 'ds-1');
      const { result } = renderHook(() =>
        useSharedDsCrud({
          sharedDataSources: mockSources,
          onUpdate: mockOnUpdate,
          selectedId: 'ds-1',
          setSelectedId: mockSetSelectedId,
          setContextMenuId: mockSetContextMenuId,
          setPendingNameFocusId: mockSetPendingNameFocusId,
          featureGroups: [fgWithSharedDs],
        })
      );
      act(() => {
        result.current.handleDelete('ds-1');
      });
      expect(result.current.pendingDeleteId).toBe('ds-1');
      
      act(() => {
        result.current.confirmDelete();
      });
      expect(mockOnUpdate).toHaveBeenCalled();
      expect(result.current.pendingDeleteId).toBe(null);
    });

    it('does nothing when pendingDeleteId is null', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.confirmDelete();
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleNameChange', () => {
    it('updates the selected data source name', () => {
      const { result } = renderCrudHook();
      act(() => {
        result.current.handleNameChange('New Name');
      });
      expect(mockOnUpdate).toHaveBeenCalled();
      const updated = mockOnUpdate.mock.calls[0][0];
      expect(updated.find((ds: SharedDataSource) => ds.id === 'ds-1')?.name).toBe('New Name');
    });

    it('does nothing when no data source is selected', () => {
      const { result } = renderCrudHook(mockSources, null);
      act(() => {
        result.current.handleNameChange('New Name');
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleDataSourceChange', () => {
    it('updates the data source content', () => {
      const { result } = renderCrudHook();
      const newDataSource = {
        id: 'ds-new',
        columns: [],
        rows: [],
        source: { type: 'inline' as const },
      };
      act(() => {
        result.current.handleDataSourceChange(newDataSource);
      });
      expect(mockOnUpdate).toHaveBeenCalled();
      const updated = mockOnUpdate.mock.calls[0][0];
      expect(updated.find((ds: SharedDataSource) => ds.id === 'ds-1')?.dataSource).toEqual(newDataSource);
    });
  });

  describe('usedByMap', () => {
    it('builds map of tests using each shared data source', () => {
      const fgWithSharedDs = createMockFeatureGroup('fg-linked', 'ds-1');
      const { result } = renderHook(() =>
        useSharedDsCrud({
          sharedDataSources: mockSources,
          onUpdate: mockOnUpdate,
          selectedId: 'ds-1',
          setSelectedId: mockSetSelectedId,
          setContextMenuId: mockSetContextMenuId,
          setPendingNameFocusId: mockSetPendingNameFocusId,
          featureGroups: [fgWithSharedDs],
        })
      );
      expect(result.current.usedByMap.has('ds-1')).toBe(true);
      expect(result.current.usedByMap.get('ds-1')).toHaveLength(1);
      expect(result.current.usedByMap.get('ds-1')?.[0].testName).toBe('Test fg-linked');
    });

    it('includes current editing draft', () => {
      const { result } = renderHook(() =>
        useSharedDsCrud({
          sharedDataSources: mockSources,
          onUpdate: mockOnUpdate,
          selectedId: 'ds-2',
          setSelectedId: mockSetSelectedId,
          setContextMenuId: mockSetContextMenuId,
          setPendingNameFocusId: mockSetPendingNameFocusId,
          featureGroups: mockFeatureGroups,
          currentEditingDraft: {
            fgName: 'Draft FG',
            scenarioName: 'Draft Scenario',
            test: {
              id: 't-draft',
              name: 'Draft Test',
              url: 'https://api.example.com',
              method: 'GET',
              headers: [],
              body: '',
              auth: { type: 'none' },
              sharedDataSourceId: 'ds-2',
            },
          },
        })
      );
      expect(result.current.usedByMap.has('ds-2')).toBe(true);
      expect(result.current.usedByMap.get('ds-2')?.[0].testName).toBe('Draft Test');
      expect(result.current.usedByMap.get('ds-2')?.[0].isEditing).toBe(true);
    });
    it('does not duplicate usedBy entries when editing path matches persisted test', () => {
      const fgLinked = createMockFeatureGroup('fg-linked', 'ds-1');
      const { result } = renderHook(() =>
        useSharedDsCrud({
          sharedDataSources: mockSources,
          onUpdate: mockOnUpdate,
          selectedId: 'ds-1',
          setSelectedId: mockSetSelectedId,
          setContextMenuId: mockSetContextMenuId,
          setPendingNameFocusId: mockSetPendingNameFocusId,
          featureGroups: [fgLinked],
          currentEditingDraft: {
            fgName: 'FG fg-linked',
            scenarioName: 'Scenario fg-linked',
            test: {
              id: 't-draft',
              name: 'Test fg-linked',
              url: 'https://api.example.com',
              method: 'GET',
              headers: [],
              body: '',
              auth: { type: 'none' },
              sharedDataSourceId: 'ds-1',
            },
          },
        }),
      );
      expect(result.current.usedByMap.get('ds-1')).toHaveLength(1);
    });

    it('confirmDelete leaves selection untouched when deleting a different source id', () => {
      const fgWithSharedDs = createMockFeatureGroup('fg-linked', 'ds-1');
      const { result } = renderHook(() =>
        useSharedDsCrud({
          sharedDataSources: mockSources,
          onUpdate: mockOnUpdate,
          selectedId: 'ds-2',
          setSelectedId: mockSetSelectedId,
          setContextMenuId: mockSetContextMenuId,
          setPendingNameFocusId: mockSetPendingNameFocusId,
          featureGroups: [fgWithSharedDs],
        }),
      );

      mockOnUpdate.mockClear();
      mockSetSelectedId.mockClear();

      act(() => {
        result.current.handleDelete('ds-1');
      });
      expect(result.current.pendingDeleteId).toBe('ds-1');

      act(() => {
        result.current.confirmDelete();
      });

      expect(mockSetSelectedId).not.toHaveBeenCalled();
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  describe('totalRows', () => {
    it('calculates total rows across all data sources', () => {
      const { result } = renderCrudHook();
      expect(result.current.totalRows).toBe(8); // 3 + 5
    });

    it('returns 0 for empty sources', () => {
      const { result } = renderCrudHook([]);
      expect(result.current.totalRows).toBe(0);
    });

    it('treats shared data sources without rows as zero', () => {
      const broken = { id: 'x', name: 'X', updatedAt: Date.now() } as SharedDataSource;
      const { result } = renderHook(() =>
        useSharedDsCrud({
          sharedDataSources: [broken],
          onUpdate: mockOnUpdate,
          selectedId: null,
          setSelectedId: mockSetSelectedId,
          setContextMenuId: mockSetContextMenuId,
          setPendingNameFocusId: mockSetPendingNameFocusId,
          featureGroups: mockFeatureGroups,
        }),
      );
      expect(result.current.totalRows).toBe(0);
    });
  });
});
