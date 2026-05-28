/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

  it('matches paths with quotes and brackets reliably', () => {
    const div = document.createElement('div');
    const body = document.createElement('div');
    body.className = 'dm-body';

    const sourcePanel = document.createElement('div');
    sourcePanel.className = 'dm-panel--source';
    const sourceNode = document.createElement('div');
    sourceNode.setAttribute('data-path', 'offers[1].rank');
    sourceNode.textContent = 'rank';
    sourcePanel.appendChild(sourceNode);

    const targetPanel = document.createElement('div');
    targetPanel.className = 'dm-panel--target';
    const targetNode = document.createElement('div');
    targetNode.setAttribute('data-path', '"ONZFONCP01MCAL9"');
    targetNode.textContent = 'code';
    targetPanel.appendChild(targetNode);

    body.appendChild(sourcePanel);
    body.appendChild(targetPanel);
    div.appendChild(body);
    document.body.appendChild(div);

    const ref = { current: div };
    const mappings: Mapping[] = [
      {
        id: 'm1',
        sourcePath: 'offers[1].rank',
        sourceId: 's1',
        targetPath: '"ONZFONCP01MCAL9"',
      },
    ];

    const { result } = renderHook(() => useConnectionLines(mappings, ref, 0));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].sourcePath).toBe('offers[1].rank');
    expect(result.current.lines[0].targetPath).toBe('"ONZFONCP01MCAL9"');
    document.body.removeChild(div);
  });

  it('uses dm-body bounds as the coordinate frame', () => {
    const div = document.createElement('div');
    const body = document.createElement('div');
    body.className = 'dm-body';
    body.innerHTML = `
      <div class="dm-panel--source"><div data-path="name">name</div></div>
      <div class="dm-panel--target"><div data-path="userName">userName</div></div>
    `;
    div.appendChild(body);
    document.body.appendChild(div);

    const sourceEl = div.querySelector('.dm-panel--source [data-path="name"]') as HTMLElement;
    const targetEl = div.querySelector('.dm-panel--target [data-path="userName"]') as HTMLElement;

    div.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 10,
      left: 0,
      right: 1000,
      bottom: 710,
      width: 1000,
      height: 700,
      toJSON: () => ({}),
    });
    body.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 110,
      left: 0,
      right: 1000,
      bottom: 610,
      width: 1000,
      height: 500,
      toJSON: () => ({}),
    });
    sourceEl.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 210,
      left: 0,
      right: 100,
      bottom: 230,
      width: 100,
      height: 20,
      toJSON: () => ({}),
    });
    targetEl.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 310,
      left: 900,
      right: 1000,
      bottom: 330,
      width: 100,
      height: 20,
      toJSON: () => ({}),
    });

    const ref = { current: div };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];

    const { result } = renderHook(() => useConnectionLines(mappings, ref, 0));
    expect(result.current.containerHeight).toBe(500);
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].sourceY).toBe(110);
    expect(result.current.lines[0].targetY).toBe(210);
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

  it('bumps tick when a scroll event fires on .dm-tree-container', async () => {
    const div = document.createElement('div');
    const scrollable = document.createElement('div');
    scrollable.className = 'dm-tree-container';
    div.appendChild(scrollable);
    document.body.appendChild(div);
    const ref = { current: div };
    const { result } = renderHook(() => useLayoutTick(ref));
    expect(result.current).toBe(0);
    await act(async () => {
      scrollable.dispatchEvent(new Event('scroll', { bubbles: false }));
    });
    expect(result.current).toBe(1);
    document.body.removeChild(div);
  });

  it('bumps tick when a DOM mutation occurs inside the container', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const ref = { current: div };
    const { result } = renderHook(() => useLayoutTick(ref));
    expect(result.current).toBe(0);
    await act(async () => {
      div.appendChild(document.createElement('span'));
      // Give MutationObserver microtask a chance to fire
      await Promise.resolve();
    });
    expect(result.current).toBeGreaterThanOrEqual(1);
    document.body.removeChild(div);
  });

  it('removes scroll listener on unmount (cleanup runs without error)', () => {
    const div = document.createElement('div');
    const scrollable = document.createElement('div');
    scrollable.className = 'dm-tree-container';
    div.appendChild(scrollable);
    document.body.appendChild(div);
    const ref = { current: div };
    const { unmount } = renderHook(() => useLayoutTick(ref));
    expect(() => unmount()).not.toThrow();
    document.body.removeChild(div);
  });
});
