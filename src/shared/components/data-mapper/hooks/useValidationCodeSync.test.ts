/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValidationCodeSync } from './useValidationCodeSync';
import type { ExpectedField, Assertion } from '../../../types';
import type { Mapping } from '../types';

describe('useValidationCodeSync', () => {
  const mockOnUpdateFields = vi.fn();
  const mockOnUpdateAssertions = vi.fn();

  const defaultOptions = {
    mappings: [] as Mapping[],
    assertions: [] as Assertion[],
    fields: [] as ExpectedField[],
    onUpdateFields: mockOnUpdateFields,
    onUpdateAssertions: mockOnUpdateAssertions,
    enabled: true,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnUpdateFields.mockClear();
    mockOnUpdateAssertions.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with empty DSL text when no fields/assertions', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));
    expect(result.current.dslText).toBe('');
    expect(result.current.parseErrors).toHaveLength(0);
    expect(result.current.ruleCount).toBe(0);
  });

  it('serializes fields to DSL text when enabled', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.name', expectedValue: 'test', operator: 'equals' },
    ];
    const { result } = renderHook(() => useValidationCodeSync({ ...defaultOptions, fields }));
    expect(result.current.dslText).toContain('name');
    expect(result.current.dslText).toContain('equals');
  });

  it('does not serialize when disabled', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.name', expectedValue: 'test' },
    ];
    const { result } = renderHook(() => useValidationCodeSync({ ...defaultOptions, fields, enabled: false }));
    expect(result.current.dslText).toBe('');
  });

  it('parses code changes and updates fields after debounce', async () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('name equals "Alice"');
    });

    expect(mockOnUpdateFields).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockOnUpdateFields).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ jsonPath: '$.name', operator: undefined }),
      ]),
    );
  });

  it('reports parse errors for invalid lines', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('bad_path');
      vi.advanceTimersByTime(350);
    });

    expect(result.current.parseErrors.length).toBeGreaterThan(0);
  });

  it('clears errors when text becomes valid', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('bad_path');
      vi.advanceTimersByTime(350);
    });
    expect(result.current.parseErrors.length).toBeGreaterThan(0);

    act(() => {
      result.current.handleCodeChange('name equals "ok"');
      vi.advanceTimersByTime(350);
    });
    expect(result.current.parseErrors).toHaveLength(0);
  });

  it('exportJson produces valid JSON', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.name', expectedValue: 'test' },
    ];
    const { result } = renderHook(() => useValidationCodeSync({ ...defaultOptions, fields }));
    const json = result.current.exportJson();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('importText with valid DSL updates state', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      const err = result.current.importText('age > 18');
      expect(err).toBeNull();
    });

    expect(mockOnUpdateFields).toHaveBeenCalled();
    expect(result.current.dslText).toContain('age');
  });

  it('importText with invalid content returns error', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      const err = result.current.importText('[invalid json');
      expect(err).not.toBeNull();
    });
  });

  it('importText with JSON format', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));
    const json = JSON.stringify([{ path: 'x', operator: 'exists' }]);

    act(() => {
      const err = result.current.importText(json);
      expect(err).toBeNull();
    });

    expect(mockOnUpdateAssertions).toHaveBeenCalled();
  });

  it('ruleCount reflects non-comment, non-empty lines', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('# comment\nname equals "x"\n\nage > 5');
      vi.advanceTimersByTime(350);
    });

    expect(result.current.ruleCount).toBe(2);
  });

  it('syncVisualToCode re-serializes fields', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.a', expectedValue: '1' },
    ];
    const { result, rerender } = renderHook(
      (props) => useValidationCodeSync(props),
      { initialProps: { ...defaultOptions, fields: [] as ExpectedField[] } },
    );

    rerender({ ...defaultOptions, fields });

    expect(result.current.dslText).toContain('a');
  });

  it('handles rapid code changes (debounce coalescence)', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('x equals "1"');
    });
    act(() => {
      result.current.handleCodeChange('x equals "12"');
    });
    act(() => {
      result.current.handleCodeChange('x equals "123"');
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Only the last change should have been applied
    expect(mockOnUpdateFields).toHaveBeenCalledTimes(1);
    expect(mockOnUpdateFields).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ operatorValue: '123' }),
      ]),
    );
  });

  it('handles empty text correctly', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('');
      vi.advanceTimersByTime(350);
    });

    expect(mockOnUpdateFields).toHaveBeenCalledWith([]);
    expect(mockOnUpdateAssertions).toHaveBeenCalledWith([]);
  });

  it('handles assertions in code change', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('items length >= 3');
      vi.advanceTimersByTime(350);
    });

    expect(mockOnUpdateAssertions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'arrayLength' }),
      ]),
    );
  });

  it('flushPending applies pending debounced code change immediately', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('name equals "flush"');
    });
    expect(mockOnUpdateFields).not.toHaveBeenCalled();

    act(() => {
      result.current.flushPending();
    });

    expect(mockOnUpdateFields).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ jsonPath: '$.name' }),
      ]),
    );
  });

  it('flushPending does nothing when no pending debounce', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.flushPending();
    });

    expect(mockOnUpdateFields).not.toHaveBeenCalled();
  });

  it('unmount flushes pending debounced changes', () => {
    const { result, unmount } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('age > 21');
    });
    expect(mockOnUpdateFields).not.toHaveBeenCalled();

    unmount();

    expect(mockOnUpdateFields).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ jsonPath: '$.age' }),
      ]),
    );
  });

  it('preserves non-DSL assertions across code change', () => {
    const nonDslAssertions: Assertion[] = [
      { type: 'statusCode', field: 'status', operator: 'equals', value: '200' },
    ];
    const { result } = renderHook(() => useValidationCodeSync({
      ...defaultOptions,
      assertions: nonDslAssertions,
    }));

    act(() => {
      result.current.handleCodeChange('name equals "test"');
      vi.advanceTimersByTime(350);
    });

    expect(mockOnUpdateAssertions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'statusCode' }),
      ]),
    );
  });

  it('syncVisualToCode cancels pending debounce when syncDirection is code', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.name', expectedValue: 'original', operator: 'equals' },
    ];
    const { result } = renderHook(
      (props) => useValidationCodeSync(props),
      { initialProps: { ...defaultOptions, fields } },
    );

    act(() => {
      result.current.handleCodeChange('age > 5');
    });

    act(() => {
      result.current.syncVisualToCode();
    });

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(mockOnUpdateFields).not.toHaveBeenCalled();
  });

  it('enabled becoming false triggers cleanup flush of pending changes', () => {
    const { result, rerender } = renderHook(
      (props) => useValidationCodeSync(props),
      { initialProps: { ...defaultOptions, enabled: true } },
    );

    act(() => {
      result.current.handleCodeChange('x equals "val"');
    });
    expect(mockOnUpdateFields).not.toHaveBeenCalled();

    act(() => {
      rerender({ ...defaultOptions, enabled: false });
    });

    expect(mockOnUpdateFields).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ jsonPath: '$.x' }),
      ]),
    );
  });

  it('unmount cleanup path when no pending debounce does nothing', () => {
    const { result, unmount } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('name equals "x"');
      vi.advanceTimersByTime(350);
    });

    mockOnUpdateFields.mockClear();
    unmount();

    expect(mockOnUpdateFields).not.toHaveBeenCalled();
  });

  it('flushPending with only invalid lines does not update fields', () => {
    const { result } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('totally invalid line');
    });

    mockOnUpdateFields.mockClear();
    act(() => {
      result.current.flushPending();
    });

    expect(mockOnUpdateFields).not.toHaveBeenCalled();
  });

  it('unmount with pending invalid-only text does not flush to fields', () => {
    const { result, unmount } = renderHook(() => useValidationCodeSync(defaultOptions));

    act(() => {
      result.current.handleCodeChange('invalid only!');
    });

    mockOnUpdateFields.mockClear();
    unmount();

    expect(mockOnUpdateFields).not.toHaveBeenCalled();
  });

});
