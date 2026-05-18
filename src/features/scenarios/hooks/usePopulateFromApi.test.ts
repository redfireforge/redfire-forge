/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePopulateFromApi } from './usePopulateFromApi';
import type { Scenario, DataSource } from '../../../shared/types';
import { proxyFetch } from '../../../engine/executor';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';

vi.mock('../../../engine/executor', () => ({
  proxyFetch: vi.fn(),
  buildHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
}));

vi.mock('../../../engine/dataSourceExpander', () => ({
  resolveScenarioFromDataRow: vi.fn((draft) => draft),
}));

const createMockScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: 'test-1',
  name: 'Test Scenario',
  url: 'https://api.example.com/users',
  method: 'GET',
  headers: [],
  ...overrides,
});

const createMockDataTable = (overrides: Partial<DataSource> = {}): DataSource => ({
  columns: [],
  rows: [],
  source: { type: 'inline' },
  ...overrides,
});

describe('usePopulateFromApi', () => {
  const mockProxyFetch = vi.mocked(proxyFetch);
  const mockResolveRow = vi.mocked(resolveScenarioFromDataRow);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetch transport', () => {
    it('uses proxyFetch when onFetchRow is omitted', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: 1 }]),
        headers: {},
        duration: 0,
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
        }),
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(mockProxyFetch).toHaveBeenCalled();
      expect(result.current.step).toBe('map');
    });

    it('resolves the first enabled data row before fetching', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: 'x' }]),
        headers: {},
        duration: 0,
      });
      mockResolveRow.mockImplementation((_d, _c, row) => ({
        ...createMockScenario({ url: 'https://default' }),
        url: row ? `https://row-${row.id}` : 'https://no-row',
      }));

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario({ url: 'https://default' }),
          dataTable: createMockDataTable({
            rows: [
              { id: 'r-skip', values: {}, enabled: false },
              { id: 'r-hit', values: {}, enabled: true },
            ],
          }),
        }),
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(mockResolveRow).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ id: 'r-hit' }),
        expect.any(Number),
      );
    });
  });

  describe('initial state', () => {
    it('starts in fetch step', () => {
      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
        })
      );

      expect(result.current.step).toBe('fetch');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.responseObj).toBeNull();
      expect(result.current.selectedArray).toBe('');
      expect(result.current.fieldMappings).toEqual([]);
      expect(result.current.insertMode).toBe('append');
    });
  });

  describe('handleFetch', () => {
    it('sets loading state during fetch', async () => {
      const mockFetch = vi.fn(() => new Promise(() => {})); // Never resolves
      
      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      act(() => {
        void result.current.handleFetch();
      });

      expect(result.current.loading).toBe(true);
    });

    it('parses response and detects arrays', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.step).toBe('map');
      expect(result.current.selectedArray).toBe('$');
      expect(result.current.detectedArrays).toHaveLength(1);
      expect(result.current.arrayItems).toHaveLength(2);
      expect(result.current.fieldMappings).toHaveLength(2);
    });

    it('handles nested arrays', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ data: { users: [{ id: 1 }] } }),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.selectedArray).toBe('data.users');
    });

    it('sets error when no arrays found', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ message: 'Hello' }),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.error).toBe('No arrays of objects found in the response');
      expect(result.current.step).toBe('fetch');
    });

    it('sets error for invalid JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: 'not valid json',
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.error).toBe('Response is not valid JSON');
    });

    it('sets error for HTTP errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
        body: '',
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.error).toBe('HTTP 404: Not Found');
    });

    it('sets error from response error field', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '',
        error: 'Connection refused',
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.error).toBe('Connection refused');
    });

    it('stores request and response debug info', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: 1 }]),
        sentUrl: 'https://resolved.example.com',
        sentMethod: 'POST',
        sentHeaders: { Authorization: 'Bearer token' },
        sentBody: '{}',
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.lastRequest).toEqual({
        method: 'POST',
        url: 'https://resolved.example.com',
        headers: { Authorization: 'Bearer token' },
        body: '{}',
      });
      expect(result.current.lastResponse).toEqual({
        status: 200,
        statusText: 'OK',
        error: undefined,
        body: JSON.stringify([{ id: 1 }]),
      });
    });
  });

  describe('handleArrayChange', () => {
    it('updates selected array and field mappings', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({
          users: [{ id: 1, name: 'Alice' }],
          products: [{ sku: 'A', price: 10 }],
        }),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.fieldMappings.map(m => m.field).sort()).toEqual(['id', 'name']);

      act(() => {
        result.current.handleArrayChange('products');
      });

      expect(result.current.selectedArray).toBe('products');
      expect(result.current.fieldMappings.map(m => m.field).sort()).toEqual(['price', 'sku']);
    });
  });

  describe('toggleField', () => {
    it('toggles field enabled state', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: 1, name: 'Alice' }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      const idMapping = result.current.fieldMappings.find(m => m.field === 'id');
      expect(idMapping?.enabled).toBe(true);

      act(() => {
        result.current.toggleField('id');
      });

      const updatedMapping = result.current.fieldMappings.find(m => m.field === 'id');
      expect(updatedMapping?.enabled).toBe(false);
    });
  });

  describe('changeFieldType', () => {
    it('changes field column type', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ email: 'test@example.com' }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.fieldMappings[0].colType).toBe('validate');

      act(() => {
        result.current.changeFieldType('email', 'header');
      });

      expect(result.current.fieldMappings[0].colType).toBe('header');
    });
  });

  describe('setInsertMode', () => {
    it('changes insert mode', () => {
      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
        })
      );

      expect(result.current.insertMode).toBe('append');

      act(() => {
        result.current.setInsertMode('replace');
      });

      expect(result.current.insertMode).toBe('replace');
    });
  });

  describe('array change edge cases', () => {
    it('does not rebuild field mappings for primitive arrays', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({
          items: [{ name: 'a' }],
          scores: [10, 20],
        }),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        }),
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      const before = result.current.fieldMappings.map(m => m.field);
      act(() => {
        result.current.handleArrayChange('scores');
      });
      expect(result.current.selectedArray).toBe('scores');
      expect(result.current.fieldMappings.map(m => m.field)).toEqual(before);
    });
  });

  describe('duplicate detection', () => {
    it('detects duplicate rows', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: '1' }, { id: '2' }, { id: '3' }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable({
            columns: [{ id: 'col-1', name: 'id', type: 'path', mapping: 'id' }],
            rows: [
              { id: 'row-1', values: { 'col-1': '1' }, enabled: true },
              { id: 'row-2', values: { 'col-1': '2' }, enabled: true },
            ],
          }),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.duplicateFlags).toEqual([true, true, false]);
      expect(result.current.duplicateCount).toBe(2);
    });

    it('auto-deselects duplicate rows', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: '1' }, { id: '3' }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable({
            columns: [{ id: 'col-1', name: 'id', type: 'path', mapping: 'id' }],
            rows: [{ id: 'row-1', values: { 'col-1': '1' }, enabled: true }],
          }),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.effectiveSelections).toEqual([false, true]);
      expect(result.current.selectedCount).toBe(1);
    });

    it('honors explicit rowSelections when length matches API items', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: '1' }, { id: '2' }, { id: '3' }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        }),
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      act(() => {
        result.current.setRowSelections([false, true, false]);
      });

      expect(result.current.effectiveSelections).toEqual([false, true, false]);
      expect(result.current.selectedCount).toBe(1);
    });
  });

  describe('buildPopulatedData', () => {
    it('returns null when no enabled mappings', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: 1 }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      act(() => {
        result.current.toggleField('id');
      });

      const data = result.current.buildPopulatedData();
      expect(data).toBeNull();
    });

    it('builds rows from array items', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      const data = result.current.buildPopulatedData();
      expect(data).not.toBeNull();
      expect(data!.columns).toHaveLength(2);
      expect(data!.rows).toHaveLength(2);
      expect(data!.columns.map(c => c.name).sort()).toEqual(['id', 'name']);
    });

    it('reuses existing columns by name', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: '1', name: 'Alice' }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable({
            columns: [{ id: 'existing-col', name: 'id', type: 'path', mapping: 'id' }],
            rows: [],
          }),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      const data = result.current.buildPopulatedData();
      expect(data).not.toBeNull();
      const idCol = data!.columns.find(c => c.name === 'id');
      expect(idCol?.id).toBe('existing-col');
    });

    it('respects row selections in append mode', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: '1' }, { id: '2' }, { id: '3' }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      act(() => {
        result.current.setRowSelections([true, false, true]);
      });

      const data = result.current.buildPopulatedData();
      expect(data!.rows).toHaveLength(2);
    });

    it('includes all rows in replace mode', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify([{ id: '1' }, { id: '2' }, { id: '3' }]),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      act(() => {
        result.current.setInsertMode('replace');
        result.current.setRowSelections([true, false, true]);
      });

      const data = result.current.buildPopulatedData();
      expect(data!.rows).toHaveLength(3);
    });

    it('handles indexed columns alongside new API fields in buildPopulatedData', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({
          items: [{ name: 'Alice', region: 'east' }, { name: 'Bob', region: 'west' }],
        }),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable({
            columns: [
              { id: 'col-name-0', name: 'nm0', type: 'path', mapping: 'items[0].name' },
              { id: 'col-name-1', name: 'nm1', type: 'path', mapping: 'items[1].name' },
            ],
            rows: [
              { id: 'row-1', values: { 'col-name-0': '', 'col-name-1': '' }, enabled: true },
            ],
          }),
          onFetchRow: mockFetch,
        }),
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      const data = result.current.buildPopulatedData();
      expect(data).not.toBeNull();
      expect(data!.columns.some(c => c.name === 'region')).toBe(true);
      expect(data!.rows).toHaveLength(1);
    });

    it('handles indexed columns in buildPopulatedData', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ items: [{ name: 'Alice' }, { name: 'Bob' }] }),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable({
            columns: [
              { id: 'col-0', name: 'name_0', type: 'validate', mapping: 'items[0].name' },
              { id: 'col-1', name: 'name_1', type: 'validate', mapping: 'items[1].name' },
            ],
            rows: [
              { id: 'row-1', values: { 'col-0': 'prev0', 'col-1': 'prev1' }, enabled: true },
            ],
          }),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      const data = result.current.buildPopulatedData();
      expect(data).not.toBeNull();
      expect(data!.rows).toHaveLength(1);
      expect(data!.rows[0].values['col-0']).toBe('Alice');
      expect(data!.rows[0].values['col-1']).toBe('Bob');
    });

    it('handles indexed columns with mixed non-indexed fields', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ items: [{ name: 'Alice' }, { name: 'Bob' }] }),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable({
            columns: [
              { id: 'col-0', name: 'name_0', type: 'validate', mapping: 'items[0].name' },
              { id: 'col-1', name: 'name_1', type: 'validate', mapping: 'items[1].name' },
              { id: 'col-id', name: 'id', type: 'path', mapping: 'id' },
            ],
            rows: [
              { id: 'row-1', values: { 'col-0': '', 'col-1': '', 'col-id': '99' }, enabled: true },
            ],
          }),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      const data = result.current.buildPopulatedData();
      expect(data).not.toBeNull();
      // Indexed columns are populated with per-index values
      expect(data!.rows[0].values['col-0']).toBe('Alice');
      expect(data!.rows[0].values['col-1']).toBe('Bob');
      // Non-indexed existing column retains baseline value
      expect(data!.rows[0].values['col-id']).toBe('99');
    });

    it('indexed mode creates columns for object fields without per-index mappings', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({
          items: [{ name: 'Alice', tag: 'a1' }, { name: 'Bob', tag: 'b1' }],
        }),
      });

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable({
            columns: [
              { id: 'col-name-0', name: 'nm0', type: 'path', mapping: 'items[0].name' },
              { id: 'col-name-1', name: 'nm1', type: 'path', mapping: 'items[1].name' },
            ],
            rows: [
              { id: 'row-1', values: { 'col-name-0': '', 'col-name-1': '' }, enabled: true },
            ],
          }),
          onFetchRow: mockFetch,
        }),
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      const data = result.current.buildPopulatedData();
      expect(data).not.toBeNull();
      expect(data!.columns.some(c => c.name === 'tag')).toBe(true);
    });
  });

  describe('unresolved tokens', () => {
    it('sets error for unresolved variables', async () => {
      const mockFetch = vi.fn();
      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario({ url: 'https://api.example.com/{{userId}}/orders' }),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.error).toContain('Unresolved variables');
      expect(result.current.error).toContain('{{userId}}');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('stores request info even with unresolved tokens', async () => {
      const mockFetch = vi.fn();
      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario({ url: 'https://api.example.com/{{id}}/data' }),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.lastRequest).not.toBeNull();
      expect(result.current.lastRequest!.url).toBe('https://api.example.com/{{id}}/data');
    });
  });

  describe('fetch error handling', () => {
    it('handles network exception', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.error).toBe('Network failure');
      expect(result.current.lastResponse?.error).toBe('Network failure');
      expect(result.current.loading).toBe(false);
    });

    it('handles non-Error throw', async () => {
      const mockFetch = vi.fn().mockRejectedValue('string error');

      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
          onFetchRow: mockFetch,
        })
      );

      await act(async () => {
        await result.current.handleFetch();
      });

      expect(result.current.error).toBe('string error');
    });
  });

  describe('setStep', () => {
    it('manually changes step', () => {
      const { result } = renderHook(() =>
        usePopulateFromApi({
          draft: createMockScenario(),
          dataTable: createMockDataTable(),
        })
      );

      act(() => {
        result.current.setStep('map');
      });

      expect(result.current.step).toBe('map');
    });
  });
});
