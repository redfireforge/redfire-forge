/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataMapperValidation } from './useDataMapperValidation';
import type { DataMapperValidationDeps } from './useDataMapperValidation';
import type { Mapping } from '../types';

function makeDeps(overrides: Partial<DataMapperValidationDeps> = {}): DataMapperValidationDeps {
  return {
    caps: { codeEditor: true },
    adapter: {
      label: 'test',
      contextId: 'ctx',
      sources: [{ id: 'src1', label: 'Source 1' }],
      target: { label: 'Target', allowCustomFields: false },
      serialize: vi.fn().mockReturnValue({ expectedFields: [] }),
      deserialize: vi.fn().mockReturnValue([]),
    } as unknown as DataMapperValidationDeps['adapter'],
    mappings: [],
    activeSourceId: 'src1',
    setMappings: vi.fn(),
    onChange: vi.fn(),
    skipNextOnChangeRef: { current: false },
    initialData: undefined,
    effectiveTarget: {},
    onAssertionsChange: vi.fn(),
    flushRef: undefined,
    showRulesView: false,
    handleFetchTargetSchema: vi.fn().mockResolvedValue(undefined),
    setToast: vi.fn(),
    ...overrides,
  };
}

describe('useDataMapperValidation', () => {
  it('initializes with empty assertions when no initialData', () => {
    const { result } = renderHook(() => useDataMapperValidation(makeDeps()));
    expect(result.current.validationSamplePaths).toEqual([]);
    expect(result.current.validationSync).toBeDefined();
  });

  it('computes validationSamplePaths from effectiveTarget.sampleData', () => {
    const deps = makeDeps({
      effectiveTarget: { sampleData: JSON.stringify({ a: 1, b: { c: 2 } }) },
    });
    const { result } = renderHook(() => useDataMapperValidation(deps));
    expect(result.current.validationSamplePaths).toContain('a');
    expect(result.current.validationSamplePaths).toContain('b.c');
  });

  it('computes validationFields from adapter.serialize', () => {
    const adapter = {
      label: 'test',
      contextId: 'ctx',
      sources: [{ id: 'src1', label: 'Source 1' }],
      target: { label: 'Target', allowCustomFields: false },
      serialize: vi.fn().mockReturnValue({
        expectedFields: [{ jsonPath: 'status', operator: 'equals', operatorValue: 'active' }],
      }),
      deserialize: vi.fn().mockReturnValue([]),
    } as unknown as DataMapperValidationDeps['adapter'];
    const deps = makeDeps({ adapter, mappings: [{ id: 'm1', sourcePath: 'status', targetPath: 'status', sourceId: 'src1' }] });
    const { result } = renderHook(() => useDataMapperValidation(deps));
    expect(result.current.validationSync).toBeDefined();
  });

  it('handleAddArrayAssertion adds a length assertion', () => {
    const onAssertionsChange = vi.fn();
    const deps = makeDeps({ onAssertionsChange });
    const { result } = renderHook(() => useDataMapperValidation(deps));

    act(() => {
      result.current.handleAddArrayAssertion('items', 'length');
    });

    expect(onAssertionsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ type: 'arrayLength', jsonPath: '$.items' })]),
    );
  });

  it('handleAddArrayAssertion adds a contains assertion', () => {
    const onAssertionsChange = vi.fn();
    const deps = makeDeps({ onAssertionsChange });
    const { result } = renderHook(() => useDataMapperValidation(deps));

    act(() => {
      result.current.handleAddArrayAssertion('data', 'contains');
    });

    expect(onAssertionsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ type: 'arrayContains', jsonPath: '$.data' })]),
    );
  });

  it('handleAddArrayAssertion adds each and subset assertions', () => {
    const onAssertionsChange = vi.fn();
    const deps = makeDeps({ onAssertionsChange });
    const { result } = renderHook(() => useDataMapperValidation(deps));

    act(() => { result.current.handleAddArrayAssertion('arr', 'each'); });
    expect(onAssertionsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ type: 'each' })]),
    );

    act(() => { result.current.handleAddArrayAssertion('$.arr2', 'subset'); });
    expect(onAssertionsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ type: 'containsSubset', jsonPath: '$.arr2' })]),
    );
  });

  it('handleVerifyAll enables verify and calls verifyAll', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useDataMapperValidation(deps));
    act(() => { result.current.handleVerifyAll(); });
    expect(result.current.verifyHook.result).toBeDefined();
  });

  it('handleToggleAutoVerify toggles auto-verify state', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useDataMapperValidation(deps));
    expect(result.current.autoVerifyEnabled).toBe(false);
    act(() => { result.current.handleToggleAutoVerify(); });
    expect(result.current.autoVerifyEnabled).toBe(true);
    act(() => { result.current.handleToggleAutoVerify(); });
    expect(result.current.autoVerifyEnabled).toBe(false);
  });

  it('handleFetchAndVerify calls fetchTargetSchema and enables verify', async () => {
    const handleFetchTargetSchema = vi.fn().mockResolvedValue(undefined);
    const adapter = {
      label: 'test',
      contextId: 'ctx',
      sources: [{ id: 'src1', label: 'Source 1' }],
      target: { label: 'Target', allowCustomFields: false },
      serialize: vi.fn().mockReturnValue({}),
      deserialize: vi.fn().mockReturnValue([]),
      fetchTargetSchema: vi.fn(),
    } as unknown as DataMapperValidationDeps['adapter'];
    const setToast = vi.fn();
    const deps = makeDeps({ adapter, handleFetchTargetSchema, setToast });
    const { result } = renderHook(() => useDataMapperValidation(deps));

    await act(async () => { await result.current.handleFetchAndVerify(); });
    expect(handleFetchTargetSchema).toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith('Fetching live response…');
  });

  it('handleFetchAndVerify handles errors', async () => {
    const handleFetchTargetSchema = vi.fn().mockRejectedValue(new Error('network'));
    const adapter = {
      label: 'test',
      contextId: 'ctx',
      sources: [{ id: 'src1', label: 'Source 1' }],
      target: { label: 'Target', allowCustomFields: false },
      serialize: vi.fn().mockReturnValue({}),
      deserialize: vi.fn().mockReturnValue([]),
      fetchTargetSchema: vi.fn(),
    } as unknown as DataMapperValidationDeps['adapter'];
    const setToast = vi.fn();
    const deps = makeDeps({ adapter, handleFetchTargetSchema, setToast });
    const { result } = renderHook(() => useDataMapperValidation(deps));

    await act(async () => { await result.current.handleFetchAndVerify(); });
    expect(setToast).toHaveBeenCalledWith(expect.stringContaining('Fetch failed'));
  });

  it('handleUpdateValidationFields merges fields with existing mappings', () => {
    const setMappings = vi.fn();
    const onChange = vi.fn();
    const existingMapping: Mapping = {
      id: 'm1',
      sourcePath: 'status',
      sourceId: 'src1',
      targetPath: 'status',
    };
    const deps = makeDeps({ mappings: [existingMapping], setMappings, onChange });
    const { result } = renderHook(() => useDataMapperValidation(deps));

    act(() => {
      result.current.handleUpdateValidationFields([
        { jsonPath: 'status', operator: 'equals' as const, operatorValue: 'active' },
        { jsonPath: 'name', operator: 'exists' as const },
      ]);
    });

    expect(setMappings).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ targetPath: 'status', operator: 'equals' }),
      expect.objectContaining({ targetPath: 'name', operator: 'exists' }),
    ]));
    expect(onChange).toHaveBeenCalled();
  });

  it('handleUpdateValidationFields keeps expression-based mappings', () => {
    const setMappings = vi.fn();
    const existingMapping: Mapping = {
      id: 'm1',
      sourcePath: 'x',
      sourceId: 'src1',
      targetPath: 'y',
      expression: '$upper(x)',
    };
    const deps = makeDeps({ mappings: [existingMapping], setMappings });
    const { result } = renderHook(() => useDataMapperValidation(deps));

    act(() => {
      result.current.handleUpdateValidationFields([]);
    });

    expect(setMappings).toHaveBeenCalledWith([existingMapping]);
  });

  it('initializes assertions from initialData', () => {
    const initialAssertions = [{ type: 'arrayLength' as const, jsonPath: '$.items', operator: '>=', value: 1 }];
    const onAssertionsChange = vi.fn();
    const deps = makeDeps({
      initialData: { assertions: initialAssertions } as unknown,
      onAssertionsChange,
    });
    renderHook(() => useDataMapperValidation(deps));
    expect(onAssertionsChange).toHaveBeenCalledWith(initialAssertions);
  });
});
