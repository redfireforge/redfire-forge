/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useConnectionLines, useLayoutTick } from './useConnectionLines';
import type { Mapping } from '../types';

describe('useConnectionLines', () => {
  it('returns empty when containerRef.current is null', () => {
    const ref = { current: null };
    const { result } = renderHook(() => useConnectionLines([], ref, 0));
    expect(result.current).toEqual({ lines: [], containerHeight: 0 });
  });

  it('returns empty when mappings is empty', () => {
    const div = document.createElement('div');
    const ref = { current: div };
    const { result } = renderHook(() => useConnectionLines([], ref, 0));
    expect(result.current.lines).toEqual([]);
  });

  it('returns empty lines when DOM nodes are not found', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const ref = { current: div };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { result } = renderHook(() => useConnectionLines(mappings, ref, 0));
    expect(result.current.lines).toEqual([]);
    document.body.removeChild(div);
  });

  it('computes line positions when DOM nodes exist', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="dm-panel--source"><div data-path="name" style="height:26px">name</div></div>
      <div class="dm-panel--target"><div data-path="userName" style="height:26px">userName</div></div>
    `;
    document.body.appendChild(div);
    const ref = { current: div };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { result } = renderHook(() => useConnectionLines(mappings, ref, 0));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].mappingId).toBe('m1');
    expect(result.current.lines[0].hasExpression).toBe(false);
    expect(result.current.lines[0].isAutoMapped).toBe(false);
    document.body.removeChild(div);
  });

  it('detects expression and auto-mapped flags', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="dm-panel--source"><div data-path="name">name</div></div>
      <div class="dm-panel--target"><div data-path="out">out</div></div>
    `;
    document.body.appendChild(div);
    const ref = { current: div };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out', expression: '$upper($.name)', isAutoMapped: true },
    ];
    const { result } = renderHook(() => useConnectionLines(mappings, ref, 0));
    expect(result.current.lines[0].hasExpression).toBe(true);
    expect(result.current.lines[0].isAutoMapped).toBe(true);
    document.body.removeChild(div);
  });

  it('sets hasTypeMismatch from mismatchIds', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="dm-panel--source"><div data-path="price">price</div></div>
      <div class="dm-panel--target"><div data-path="count">count</div></div>
    `;
    document.body.appendChild(div);
    const ref = { current: div };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'price', sourceId: 's1', targetPath: 'count' },
    ];
    const mismatchIds = new Set(['m1']);
    const { result } = renderHook(() => useConnectionLines(mappings, ref, 0, mismatchIds));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].hasTypeMismatch).toBe(true);
    document.body.removeChild(div);
  });

  it('sets hasTypeMismatch false when not in mismatchIds', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="dm-panel--source"><div data-path="name">name</div></div>
      <div class="dm-panel--target"><div data-path="out">out</div></div>
    `;
    document.body.appendChild(div);
    const ref = { current: div };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out' },
    ];
    const { result } = renderHook(() => useConnectionLines(mappings, ref, 0, new Set()));
    expect(result.current.lines[0].hasTypeMismatch).toBe(false);
    document.body.removeChild(div);
  });

  it('recomputes when layoutTick changes', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="dm-panel--source"><div data-path="a">a</div></div>
      <div class="dm-panel--target"><div data-path="b">b</div></div>
    `;
    document.body.appendChild(div);
    const ref = { current: div };
    const mappings: Mapping[] = [{ id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' }];
    const { result, rerender } = renderHook(
      ({ tick }) => useConnectionLines(mappings, ref, tick),
      { initialProps: { tick: 0 } },
    );
    const lines1 = result.current.lines;
    rerender({ tick: 1 });
    const lines2 = result.current.lines;
    expect(lines1).not.toBe(lines2);
    expect(lines2).toHaveLength(1);
    document.body.removeChild(div);
  });
});

describe('useLayoutTick', () => {
  it('returns 0 initially', () => {
    const ref = { current: null };
    const { result } = renderHook(() => useLayoutTick(ref));
    expect(result.current).toBe(0);
  });

  it('returns 0 when container exists but no events fired', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const ref = { current: div };
    const { result } = renderHook(() => useLayoutTick(ref));
    expect(result.current).toBe(0);
    document.body.removeChild(div);
  });
});
