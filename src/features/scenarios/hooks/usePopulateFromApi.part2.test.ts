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
  const _mockProxyFetch = vi.mocked(proxyFetch);
  const _mockResolveRow = vi.mocked(resolveScenarioFromDataRow);

  beforeEach(() => {
    resetAllMocks();
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
