/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePopulateFromApi } from './usePopulateFromApi';
import type { Scenario, DataSource } from '@shared/types';
import { proxyFetch } from '@engine/core/executor';
import { resolveScenarioFromDataRow } from '@engine/core/dataSourceExpander';

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
    resetAllMocks();
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

});
