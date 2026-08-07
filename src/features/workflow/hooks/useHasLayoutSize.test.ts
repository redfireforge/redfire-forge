/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { elementHasLayoutSize, useHasLayoutSize } from './useHasLayoutSize';

describe('useHasLayoutSize', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('elementHasLayoutSize requires positive width and height', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 0,
      height: 100,
      top: 0,
      left: 0,
      bottom: 100,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    expect(elementHasLayoutSize(el)).toBe(false);

    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    expect(elementHasLayoutSize(el)).toBe(true);
  });

  it('elementHasLayoutSize is false when an ancestor has the hidden attribute', () => {
    const mount = document.createElement('div');
    mount.setAttribute('hidden', '');
    const el = document.createElement('div');
    mount.appendChild(el);
    document.body.appendChild(mount);
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    expect(elementHasLayoutSize(el)).toBe(false);
  });

  it('stays ready in Vitest/jsdom by default (no real layout)', () => {
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useHasLayoutSize(ref));
    expect(result.current).toBe(true);
  });

  it('tracks layout size when trackInTest is enabled', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ref = { current: el };

    let _roCallback: ResizeObserverCallback | null = null;
    class MockRO {
      constructor(cb: ResizeObserverCallback) {
        _roCallback = cb;
      }
      observe() {
        /* noop */
      }
      disconnect() {
        _roCallback = null;
      }
      unobserve() {
        /* noop */
      }
    }
    vi.stubGlobal('ResizeObserver', MockRO);

    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const { result } = renderHook(() => useHasLayoutSize(ref, { trackInTest: true }));
    expect(result.current).toBe(false);

    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    act(() => {
      _roCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });
    expect(result.current).toBe(true);
  });

  it('returns false when tracking is enabled but ref.current is null', () => {
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useHasLayoutSize(ref, { trackInTest: true }));
    expect(result.current).toBe(false);
  });

  it('updates via MutationObserver when mount hidden attribute changes', () => {
    const mount = document.createElement('div');
    mount.className = 'workflow-designer-mount';
    const el = document.createElement('div');
    mount.appendChild(el);
    document.body.appendChild(mount);
    const ref = { current: el };

    let _roCallback: ResizeObserverCallback | null = null;
    class MockRO {
      constructor(cb: ResizeObserverCallback) {
        _roCallback = cb;
      }
      observe() {
        /* noop */
      }
      disconnect() {
        _roCallback = null;
      }
      unobserve() {
        /* noop */
      }
    }
    vi.stubGlobal('ResizeObserver', MockRO);

    let moCallback: MutationCallback | null = null;
    class MockMO {
      constructor(cb: MutationCallback) {
        moCallback = cb;
      }
      observe() {
        /* noop */
      }
      disconnect() {
        moCallback = null;
      }
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('MutationObserver', MockMO as unknown as typeof MutationObserver);

    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 480,
      top: 0,
      left: 0,
      bottom: 480,
      right: 640,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const { result } = renderHook(() => useHasLayoutSize(ref, { trackInTest: true }));
    expect(result.current).toBe(true);

    mount.setAttribute('hidden', '');
    act(() => {
      moCallback?.([] as unknown as MutationRecord[], {} as MutationObserver);
    });
    expect(result.current).toBe(false);
  });
});
