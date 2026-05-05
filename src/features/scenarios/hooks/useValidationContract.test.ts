/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValidationContract } from './useValidationContract';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';

function makeDataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: 'ds-1',
    columns: [],
    rows: [],
    source: { type: 'inline' },
    ...overrides,
  };
}

function makeDraft(dt?: DataSource): Scenario {
  return {
    id: 'sc-1',
    name: 'Test',
    url: 'https://example.com',
    method: 'GET',
    headers: [],
    auth: { type: 'none' },
    validation: { mode: 'none' },
    dataSource: dt,
  } as Scenario;
}

function makeValidateCol(id: string, mapping: string): DataSourceColumn {
  return { id, name: id, type: 'validate', mapping };
}

describe('useValidationContract', () => {
  describe('contractPatterns', () => {
    it('returns empty array when no data source', () => {
      const draft = makeDraft();
      const { result } = renderHook(() => useValidationContract(undefined, draft, vi.fn()));
      expect(result.current.contractPatterns).toEqual([]);
    });

    it('returns empty when no validate columns with array indices', () => {
      const dt = makeDataSource({ columns: [{ id: 'c1', name: 'status', type: 'validate', mapping: 'status' }] });
      const draft = makeDraft(dt);
      const { result } = renderHook(() => useValidationContract(dt, draft, vi.fn()));
      expect(result.current.contractPatterns).toEqual([]);
    });

    it('detects array patterns from validate columns', () => {
      const dt = makeDataSource({
        columns: [
          makeValidateCol('c1', 'items[0].name'),
          makeValidateCol('c2', 'items[1].name'),
          makeValidateCol('c3', 'items[0].price'),
        ],
      });
      const draft = makeDraft(dt);
      const { result } = renderHook(() => useValidationContract(dt, draft, vi.fn()));
      expect(result.current.contractPatterns).toHaveLength(2);
      const namePattern = result.current.contractPatterns.find(p => p.pattern === 'items[*].name');
      expect(namePattern).toBeDefined();
      expect(namePattern!.count).toBe(2);
      expect(namePattern!.isDynamic).toBe(false);
    });

    it('marks patterns as dynamic when in validationContract', () => {
      const dt = makeDataSource({
        columns: [makeValidateCol('c1', 'items[0].name')],
        validationContract: ['items[*].name'],
      });
      const draft = makeDraft(dt);
      const { result } = renderHook(() => useValidationContract(dt, draft, vi.fn()));
      expect(result.current.contractPatterns[0].isDynamic).toBe(true);
    });
  });

  describe('toggleContractPattern', () => {
    it('adds pattern to contract when making dynamic', () => {
      const dt = makeDataSource({ columns: [makeValidateCol('c1', 'items[0].name')] });
      const draft = makeDraft(dt);
      const onChange = vi.fn();
      const { result } = renderHook(() => useValidationContract(dt, draft, onChange));

      act(() => result.current.toggleContractPattern('items[*].name', true));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dataSource: expect.objectContaining({ validationContract: ['items[*].name'] }),
        }),
      );
    });

    it('removes pattern from contract when making fixed', () => {
      const dt = makeDataSource({
        columns: [makeValidateCol('c1', 'items[0].name')],
        validationContract: ['items[*].name', 'other[*].x'],
      });
      const draft = makeDraft(dt);
      const onChange = vi.fn();
      const { result } = renderHook(() => useValidationContract(dt, draft, onChange));

      act(() => result.current.toggleContractPattern('items[*].name', false));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dataSource: expect.objectContaining({ validationContract: ['other[*].x'] }),
        }),
      );
    });
  });

  describe('addContractPattern', () => {
    it('adds a new pattern', () => {
      const dt = makeDataSource({ columns: [makeValidateCol('c1', 'items[0].name')] });
      const draft = makeDraft(dt);
      const onChange = vi.fn();
      const { result } = renderHook(() => useValidationContract(dt, draft, onChange));

      act(() => result.current.addContractPattern('items[*].name'));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dataSource: expect.objectContaining({ validationContract: ['items[*].name'] }),
        }),
      );
    });

    it('does not duplicate existing pattern', () => {
      const dt = makeDataSource({
        columns: [makeValidateCol('c1', 'items[0].name')],
        validationContract: ['items[*].name'],
      });
      const draft = makeDraft(dt);
      const onChange = vi.fn();
      const { result } = renderHook(() => useValidationContract(dt, draft, onChange));

      act(() => result.current.addContractPattern('items[*].name'));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('removeContractPattern', () => {
    it('removes pattern and matching columns', () => {
      const dt = makeDataSource({
        columns: [
          makeValidateCol('c1', 'items[0].name'),
          makeValidateCol('c2', 'items[1].name'),
          { id: 'c3', name: 'status', type: 'validate', mapping: 'status' },
        ],
        rows: [{ id: 'r1', values: { c1: 'a', c2: 'b', c3: 'ok' }, enabled: true }],
        validationContract: ['items[*].name'],
      });
      const draft = makeDraft(dt);
      const onChange = vi.fn();
      const { result } = renderHook(() => useValidationContract(dt, draft, onChange));

      act(() => result.current.removeContractPattern('items[*].name'));

      const call = onChange.mock.calls[0][0];
      expect(call.dataSource.columns).toHaveLength(1);
      expect(call.dataSource.columns[0].id).toBe('c3');
      expect(call.dataSource.rows[0].values).toEqual({ c3: 'ok' });
      expect(call.dataSource.validationContract).toBeUndefined();
    });
  });

  describe('toggleArrayMode', () => {
    it('toggles from ordered to unordered', () => {
      const dt = makeDataSource({ columns: [makeValidateCol('c1', 'items[0].name')] });
      const draft = makeDraft(dt);
      const onChange = vi.fn();
      const { result } = renderHook(() => useValidationContract(dt, draft, onChange));

      act(() => result.current.toggleArrayMode('items[*]'));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dataSource: expect.objectContaining({ arrayValidationMode: { 'items[*]': 'unordered' } }),
        }),
      );
    });

    it('toggles from unordered back to ordered', () => {
      const dt = makeDataSource({
        columns: [makeValidateCol('c1', 'items[0].name')],
        arrayValidationMode: { 'items[*]': 'unordered' },
      });
      const draft = makeDraft(dt);
      const onChange = vi.fn();
      const { result } = renderHook(() => useValidationContract(dt, draft, onChange));

      act(() => result.current.toggleArrayMode('items[*]'));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dataSource: expect.objectContaining({ arrayValidationMode: { 'items[*]': 'ordered' } }),
        }),
      );
    });
  });
});
