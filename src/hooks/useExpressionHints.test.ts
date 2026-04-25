/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpressionHints } from './useExpressionHints';
import type { WorkflowVariableHint } from '../utils/workflowVariableHints';

const sampleHints: WorkflowVariableHint[] = [
  { ref: 'myVar', description: 'A test var', source: { nodeId: 'n1', nodeLabel: 'Node1' } },
  { ref: 'userId', description: 'User ID', source: { nodeId: 'n2', nodeLabel: 'Node2' } },
];

describe('useExpressionHints', () => {
  it('shows variable hints when {{ is typed', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{', 2); });
    expect(result.current.hintState.open).toBe(true);
    expect(result.current.hintState.items.length).toBeGreaterThan(0);
    expect(result.current.hintState.items[0].kind).toBe('variable');
  });

  it('shows function hints when {{$ is typed', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{$', 3); });
    expect(result.current.hintState.open).toBe(true);
    expect(result.current.hintState.items.length).toBeGreaterThan(0);
    expect(result.current.hintState.items[0].kind).toBe('function');
  });

  it('filters function hints when {{$up is typed', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{$up', 5); });
    expect(result.current.hintState.open).toBe(true);
    expect(result.current.hintState.items.some(i => i.label === '$upper')).toBe(true);
  });

  it('shows function hints when bare $ is typed at start', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('$', 1); });
    expect(result.current.hintState.open).toBe(true);
    expect(result.current.hintState.items.length).toBeGreaterThan(0);
    expect(result.current.hintState.items[0].kind).toBe('function');
    expect(result.current.hintState.triggerKind).toBe('bare');
  });

  it('shows function hints when bare $ is typed after text', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('hello $', 7); });
    expect(result.current.hintState.open).toBe(true);
    expect(result.current.hintState.items[0].kind).toBe('function');
    expect(result.current.hintState.triggerKind).toBe('bare');
  });

  it('filters bare $ hints when more chars typed', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('$co', 3); });
    expect(result.current.hintState.open).toBe(true);
    const labels = result.current.hintState.items.map(i => i.label);
    expect(labels).toContain('$concat');
    expect(labels).toContain('$count');
    expect(labels).toContain('$coalesce');
    expect(labels).toContain('$contains');
  });

  it('closes when no match', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('hello', 5); });
    expect(result.current.hintState.open).toBe(false);
  });

  it('closes after }} is typed', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{myVar}}', 9); });
    expect(result.current.hintState.open).toBe(false);
  });

  it('filters variable hints by partial text', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{user', 6); });
    expect(result.current.hintState.open).toBe(true);
    expect(result.current.hintState.items.some(i => i.label === 'userId')).toBe(true);
    expect(result.current.hintState.items.some(i => i.label === 'myVar')).toBe(false);
  });

  it('bare $ inside {{...}} uses braces trigger path', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{$concat(foo,$', 15); });
    // Inside {{ — the braces trigger fires. Fragment is "$concat(foo,$" which starts
    // with `$`, so function filter runs. No function matches the full fragment,
    // so the dropdown is closed. This is expected: user is editing function args.
    expect(result.current.hintState.open).toBe(false);
  });

  it('triggerStart is correct for bare $', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('test $up', 8); });
    expect(result.current.hintState.triggerStart).toBe(5);
  });

  it('exposes triggerKind for braces trigger', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{$', 3); });
    expect(result.current.hintState.triggerKind).toBe('braces');
  });
});
