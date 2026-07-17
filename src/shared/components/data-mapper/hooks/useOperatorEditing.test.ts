/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOperatorEditing } from './useOperatorEditing';
import { Mapping, FieldOperator } from '../types';

function makeMapping(overrides: Partial<Mapping> = {}): Mapping {
  return {
    id: 'm1',
    sourcePath: '$.name',
    targetPath: 'name',
    ...overrides,
  } as Mapping;
}

function makeRef<T>(value: T | null = null) {
  return { current: value };
}

describe('useOperatorEditing', () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    resetAllMocks();
  });

  it('defaults currentOp to equals when no mapping', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: undefined,
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    expect(result.current.currentOp).toBe('equals');
    expect(result.current.showOperators).toBe(false);
  });

  it('derives currentOp from mapping.operator', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ operator: 'contains' as FieldOperator }),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    expect(result.current.currentOp).toBe('contains');
    expect(result.current.showOperators).toBe(true);
  });

  it('uses autoMapDefaultOperator when mapping is auto-mapped', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ isAutoMapped: true, operator: undefined }),
      capabilities: { operators: true, autoMapDefaultOperator: 'not_equals' as FieldOperator },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    expect(result.current.currentOp).toBe('not_equals');
  });

  it('handleOperatorSelect with needsValue operator starts editing', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping(),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.handleOperatorSelect('greater_than' as FieldOperator); });
    expect(onUpdate).toHaveBeenCalledWith('m1', 'greater_than', '');
    expect(result.current.editingOperatorValue).toBe(true);
    expect(result.current.showOperatorPicker).toBe(false);
  });

  it('handleOperatorSelect with no-value operator clears editing', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping(),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.handleOperatorSelect('exists' as FieldOperator); });
    expect(onUpdate).toHaveBeenCalledWith('m1', 'exists', undefined);
    expect(result.current.editingOperatorValue).toBe(false);
  });

  it('handleOperatorSelect with existing value does not start editing', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ operatorValue: '42' }),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.handleOperatorSelect('equals' as FieldOperator); });
    expect(result.current.editingOperatorValue).toBe(false);
  });

  it('handleOperatorSelect does nothing without mapping', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: undefined,
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.handleOperatorSelect('equals' as FieldOperator); });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('handleOperatorValueCommit calls onUpdate and stops editing', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ operator: 'equals' as FieldOperator }),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.startEditOperatorValue(); });
    act(() => { result.current.setLocalOperatorValue('test-value'); });
    act(() => { result.current.handleOperatorValueCommit(); });
    expect(onUpdate).toHaveBeenCalledWith('m1', 'equals', 'test-value');
    expect(result.current.editingOperatorValue).toBe(false);
  });

  it('handleOperatorValueCommit does nothing without mapping', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: undefined,
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.handleOperatorValueCommit(); });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('handleRangeCommit combines two parts and calls onUpdate', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ operator: 'between' as FieldOperator }),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.handleRangeCommit('10', '20'); });
    expect(onUpdate).toHaveBeenCalledWith('m1', 'between', '10, 20');
  });

  it('handleRangeCommit does nothing without mapping', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: undefined,
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.handleRangeCommit('10', '20'); });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('handleOperatorValueKeyDown commits on Enter', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ operator: 'equals' as FieldOperator }),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    const e = { key: 'Enter', preventDefault: vi.fn() };
    act(() => { result.current.handleOperatorValueKeyDown(e as never); });
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('handleOperatorValueKeyDown cancels on Escape', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping(),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.startEditOperatorValue(); });
    expect(result.current.editingOperatorValue).toBe(true);
    const e = { key: 'Escape', preventDefault: vi.fn() };
    act(() => { result.current.handleOperatorValueKeyDown(e as never); });
    expect(result.current.editingOperatorValue).toBe(false);
  });

  it('startEditOperatorValue sets local value from mapping', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ operatorValue: '42' }),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.startEditOperatorValue(); });
    expect(result.current.editingOperatorValue).toBe(true);
    expect(result.current.localOperatorValue).toBe('42');
  });

  it('startEditOperatorValue does nothing without mapping', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: undefined,
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.startEditOperatorValue(); });
    expect(result.current.editingOperatorValue).toBe(false);
  });

  it('handleTypeSelectChange updates value and calls onUpdate', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ operator: 'is_type' as FieldOperator }),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.handleTypeSelectChange('string'); });
    expect(onUpdate).toHaveBeenCalledWith('m1', 'is_type', 'string');
    expect(result.current.editingOperatorValue).toBe(false);
  });

  it('toggleOperatorPicker toggles open/close', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping(),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    expect(result.current.showOperatorPicker).toBe(false);
    const e = { stopPropagation: vi.fn() };
    act(() => { result.current.toggleOperatorPicker(e as never); });
    expect(result.current.showOperatorPicker).toBe(true);
    act(() => { result.current.toggleOperatorPicker(e as never); });
    expect(result.current.showOperatorPicker).toBe(false);
  });

  it('toggleOperatorPicker computes position when pill ref is available', () => {
    const pill = document.createElement('button');
    pill.getBoundingClientRect = () => ({
      top: 100, bottom: 120, left: 50, right: 200,
      width: 150, height: 20, x: 50, y: 100, toJSON: () => '',
    });
    document.body.appendChild(pill);
    const ref = { current: pill };
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping(),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: ref,
    }));
    const e = { stopPropagation: vi.fn() };
    act(() => { result.current.toggleOperatorPicker(e as never); });
    expect(result.current.pickerPos.left).toBeGreaterThanOrEqual(8);
    document.body.removeChild(pill);
  });

  it('isRangeOperator is true for between', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ operator: 'between' as FieldOperator }),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    expect(result.current.isRangeOperator).toBe(true);
  });

  it('isRangeOperator is true for close_to', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ operator: 'close_to' as FieldOperator }),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    expect(result.current.isRangeOperator).toBe(true);
  });

  it('isRangeOperator is false for equals', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping({ operator: 'equals' as FieldOperator }),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    expect(result.current.isRangeOperator).toBe(false);
  });

  it('click outside closes picker after timeout', async () => {
    vi.useFakeTimers();
    const pickerDiv = document.createElement('div');
    const pillBtn = document.createElement('button');
    document.body.appendChild(pickerDiv);
    document.body.appendChild(pillBtn);

    const pillRefObj = { current: pillBtn };
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping(),
      capabilities: { operators: true },
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: pillRefObj,
    }));
    // Manually set the internal pickerRef by patching — we need the hook to see our picker
    // Instead, toggle the picker open
    const e = { stopPropagation: vi.fn() };
    act(() => { result.current.toggleOperatorPicker(e as never); });
    expect(result.current.showOperatorPicker).toBe(true);

    // Assign our pickerDiv to the hook's pickerRef
    (result.current.pickerRef as { current: HTMLDivElement }).current = pickerDiv;

    act(() => { vi.advanceTimersByTime(100); });

    // Click outside both refs
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    act(() => {
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(result.current.showOperatorPicker).toBe(false);

    document.body.removeChild(pickerDiv);
    document.body.removeChild(pillBtn);
    document.body.removeChild(outside);
    vi.useRealTimers();
  });

  it('setPickerPos updates picker position', () => {
    const { result } = renderHook(() => useOperatorEditing({
      mapping: makeMapping(),
      onUpdateMappingOperator: onUpdate,
      operatorPillRef: makeRef(),
    }));
    act(() => { result.current.setPickerPos({ top: 50, left: 100, openUp: true }); });
    expect(result.current.pickerPos).toEqual({ top: 50, left: 100, openUp: true });
  });
});
