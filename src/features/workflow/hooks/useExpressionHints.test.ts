/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpressionHints } from './useExpressionHints';
import { WorkflowVariableHint } from '../utils/workflowVariableHints';

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

  // ── accept() tests ──

  it('accept replaces bare $ trigger with function text', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    // Open hints with bare $
    act(() => { result.current.onInputChange('test $up', 8); });
    expect(result.current.hintState.open).toBe(true);
    const item = result.current.hintState.items.find(i => i.label === '$upper');
    expect(item).toBeDefined();
    let newValue = '';
    act(() => { result.current.accept(item!, 'test $up', (v) => { newValue = v; }); });
    expect(newValue).toContain('$upper');
    expect(result.current.hintState.open).toBe(false);
  });

  it('accept replaces braces variable trigger with {{varName}}', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{my', 4); });
    expect(result.current.hintState.open).toBe(true);
    const item = result.current.hintState.items.find(i => i.label === 'myVar');
    expect(item).toBeDefined();
    let newValue = '';
    act(() => { result.current.accept(item!, '{{my', (v) => { newValue = v; }); });
    expect(newValue).toBe('{{myVar}}');
    expect(result.current.hintState.open).toBe(false);
  });

  it('accept replaces braces function trigger with {{$fn(}}', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{$up', 5); });
    expect(result.current.hintState.open).toBe(true);
    const item = result.current.hintState.items.find(i => i.label === '$upper');
    expect(item).toBeDefined();
    let newValue = '';
    act(() => { result.current.accept(item!, '{{$up', (v) => { newValue = v; }); });
    expect(newValue).toContain('{{$upper(');
    expect(result.current.hintState.open).toBe(false);
  });

  it('accept replaces braces function with no args trigger with {{$fn()}}', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{$no', 5); });
    expect(result.current.hintState.open).toBe(true);
    const item = result.current.hintState.items.find(i => i.label === '$now');
    expect(item).toBeDefined();
    let newValue = '';
    act(() => { result.current.accept(item!, '{{$no', (v) => { newValue = v; }); });
    expect(newValue).toBe('{{$now()}}');
    expect(result.current.hintState.open).toBe(false);
  });

  it('accept replaces existing variable with closing braces already present', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{my}}', 4); });
    expect(result.current.hintState.open).toBe(true);
    const item = result.current.hintState.items.find(i => i.label === 'myVar');
    expect(item).toBeDefined();
    let newValue = '';
    act(() => { result.current.accept(item!, '{{my}}', (v) => { newValue = v; }); });
    expect(newValue).toBe('{{myVar}}');
  });

  it('accept does nothing when triggerStart is -1 (closed state)', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    // State is CLOSED initially, triggerStart=-1
    const item = { kind: 'variable' as const, label: 'x', detail: '', insertText: 'x', meta: sampleHints[0] };
    let called = false;
    act(() => { result.current.accept(item, 'test', () => { called = true; }); });
    expect(called).toBe(false);
  });

  it('accept for bare $ with no-arg function', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('$no', 3); });
    expect(result.current.hintState.open).toBe(true);
    const item = result.current.hintState.items.find(i => i.label === '$now');
    expect(item).toBeDefined();
    let newValue = '';
    act(() => { result.current.accept(item!, '$no', (v) => { newValue = v; }); });
    expect(newValue).toBe('$now()');
  });

  // ── onKeyDown() tests ──

  it('onKeyDown does nothing when dropdown is closed', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    const e = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    let consumed = false;
    act(() => { consumed = result.current.onKeyDown(e, '', () => {}); });
    expect(consumed).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('onKeyDown ArrowDown moves selection down', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{', 2); });
    expect(result.current.hintState.selectedIndex).toBe(0);
    const e = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => { result.current.onKeyDown(e, '{{', () => {}); });
    expect(result.current.hintState.selectedIndex).toBe(1);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('onKeyDown ArrowUp moves selection up', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{', 2); });
    // Move down first
    const eDown = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => { result.current.onKeyDown(eDown, '{{', () => {}); });
    expect(result.current.hintState.selectedIndex).toBe(1);
    // Now up
    const eUp = { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => { result.current.onKeyDown(eUp, '{{', () => {}); });
    expect(result.current.hintState.selectedIndex).toBe(0);
  });

  it('onKeyDown Enter accepts the selected item', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{', 2); });
    let newValue = '';
    const e = { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => { result.current.onKeyDown(e, '{{', (v) => { newValue = v; }); });
    expect(newValue).toContain('{{');
    expect(result.current.hintState.open).toBe(false);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('onKeyDown Tab accepts the selected item', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{', 2); });
    let newValue = '';
    const e = { key: 'Tab', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => { result.current.onKeyDown(e, '{{', (v) => { newValue = v; }); });
    expect(newValue).toContain('{{');
    expect(result.current.hintState.open).toBe(false);
  });

  it('onKeyDown Escape closes the dropdown', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{', 2); });
    expect(result.current.hintState.open).toBe(true);
    const e = { key: 'Escape', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => { result.current.onKeyDown(e, '{{', () => {}); });
    expect(result.current.hintState.open).toBe(false);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('onKeyDown with unknown key returns false', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{', 2); });
    const e = { key: 'a', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    let consumed = false;
    act(() => { consumed = result.current.onKeyDown(e, '{{', () => {}); });
    expect(consumed).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  // ── close() test ──

  it('close() closes the dropdown', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('{{', 2); });
    expect(result.current.hintState.open).toBe(true);
    act(() => { result.current.close(); });
    expect(result.current.hintState.open).toBe(false);
  });

  // ── varName / uniqueVarHints tests ──

  it('deduplicates scoped and unscoped hints with same name', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'myVar', description: 'unscoped' },
      { ref: 'node:"Step".myVar', description: 'scoped', source: { nodeId: 'n1', nodeLabel: 'Step' } },
    ];
    const { result } = renderHook(() => useExpressionHints(hints));
    act(() => { result.current.onInputChange('{{', 2); });
    // Should only have one 'myVar' entry, not two
    const myVarItems = result.current.hintState.items.filter(i => i.label === 'myVar');
    expect(myVarItems.length).toBe(1);
  });

  it('extracts variable name from node:"Label".name pattern', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:"My Step".token', description: 'scoped ref', source: { nodeId: 'n1', nodeLabel: 'My Step' } },
    ];
    const { result } = renderHook(() => useExpressionHints(hints));
    act(() => { result.current.onInputChange('{{tok', 5); });
    expect(result.current.hintState.open).toBe(true);
    expect(result.current.hintState.items.some(i => i.label === 'token')).toBe(true);
  });

  it('extracts variable name from node:id.name pattern (no quotes)', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:abc-123.status', description: 'legacy ref' },
    ];
    const { result } = renderHook(() => useExpressionHints(hints));
    act(() => { result.current.onInputChange('{{stat', 6); });
    expect(result.current.hintState.open).toBe(true);
    expect(result.current.hintState.items.some(i => i.label === 'status')).toBe(true);
  });

  it('shows function hints after $, filtered after comma', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('abc,$up', 7); });
    expect(result.current.hintState.open).toBe(true);
    expect(result.current.hintState.triggerKind).toBe('bare');
  });

  it('shows function hints after $ in paren context', () => {
    const { result } = renderHook(() => useExpressionHints(sampleHints));
    act(() => { result.current.onInputChange('fn($up', 6); });
    expect(result.current.hintState.open).toBe(true);
    expect(result.current.hintState.triggerKind).toBe('bare');
  });
});
