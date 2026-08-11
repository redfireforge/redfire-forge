/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { elementHasLayoutSize, useHasLayoutSize } from './useHasLayoutSize';

function mockBox(el: HTMLElement, width: number, height: number) {
  Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => height });
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function flushConfirmFrames() {
  act(() => {
    vi.runAllTimers();
  });
}

describe('useHasLayoutSize', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('elementHasLayoutSize requires positive width and height', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    mockBox(el, 0, 100);
    expect(elementHasLayoutSize(el)).toBe(false);

    mockBox(el, 400, 300);
    expect(elementHasLayoutSize(el)).toBe(true);
  });

  it('elementHasLayoutSize is false when an ancestor has the hidden attribute', () => {
    const mount = document.createElement('div');
    mount.setAttribute('hidden', '');
    const el = document.createElement('div');
    mount.appendChild(el);
    document.body.appendChild(mount);
    mockBox(el, 800, 600);
    expect(elementHasLayoutSize(el)).toBe(false);
  });

  it('elementHasLayoutSize is false when visibility is hidden', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    mockBox(el, 800, 600);
    el.style.visibility = 'hidden';
    expect(elementHasLayoutSize(el)).toBe(false);
  });

  it('elementHasLayoutSize respects checkVisibility when available', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    mockBox(el, 800, 600);
    (el as HTMLElement & { checkVisibility: () => boolean }).checkVisibility = () => false;
    expect(elementHasLayoutSize(el)).toBe(false);
    (el as HTMLElement & { checkVisibility: () => boolean }).checkVisibility = () => true;
    expect(elementHasLayoutSize(el)).toBe(true);
  });

  it('stays ready in Vitest/jsdom by default (no real layout)', () => {
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useHasLayoutSize(ref));
    expect(result.current).toBe(true);
  });

  it('tracks layout size when trackInTest is enabled', () => {
    vi.useFakeTimers();
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

    mockBox(el, 0, 0);

    const { result } = renderHook(() => useHasLayoutSize(ref, { trackInTest: true }));
    expect(result.current).toBe(false);

    mockBox(el, 800, 600);

    act(() => {
      _roCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });
    // Positive size is confirmed after double-rAF
    expect(result.current).toBe(false);
    flushConfirmFrames();
    expect(result.current).toBe(true);
  });

  it('returns false when tracking is enabled but ref.current is null', () => {
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useHasLayoutSize(ref, { trackInTest: true }));
    expect(result.current).toBe(false);
  });

  it('updates via MutationObserver when mount hidden attribute changes', () => {
    vi.useFakeTimers();
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

    mockBox(el, 640, 480);

    const { result } = renderHook(() => useHasLayoutSize(ref, { trackInTest: true }));
    flushConfirmFrames();
    expect(result.current).toBe(true);

    mount.setAttribute('hidden', '');
    act(() => {
      moCallback?.([] as unknown as MutationRecord[], {} as MutationObserver);
    });
    expect(result.current).toBe(false);
    void _roCallback;
  });

  it('collapses immediately when size returns to zero', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ref = { current: el };

    let _roCallback: ResizeObserverCallback | null = null;
    class MockRO {
      constructor(cb: ResizeObserverCallback) {
        _roCallback = cb;
      }
      observe() { /* noop */ }
      disconnect() { _roCallback = null; }
      unobserve() { /* noop */ }
    }
    vi.stubGlobal('ResizeObserver', MockRO);

    mockBox(el, 400, 300);
    const { result } = renderHook(() => useHasLayoutSize(ref, { trackInTest: true }));
    flushConfirmFrames();
    expect(result.current).toBe(true);

    mockBox(el, 0, 0);
    act(() => {
      _roCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });
    expect(result.current).toBe(false);
  });

  it('cancels a pending confirm frame when update runs again before it fires', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ref = { current: el };

    let _roCallback: ResizeObserverCallback | null = null;
    class MockRO {
      constructor(cb: ResizeObserverCallback) {
        _roCallback = cb;
      }
      observe() { /* noop */ }
      disconnect() { _roCallback = null; }
      unobserve() { /* noop */ }
    }
    vi.stubGlobal('ResizeObserver', MockRO);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');

    mockBox(el, 400, 300);
    renderHook(() => useHasLayoutSize(ref, { trackInTest: true }));

    // Trigger a second confirm cycle before the first double-rAF resolves —
    // clearConfirm() should cancel the still-pending frame from the first call.
    act(() => {
      _roCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });
    expect(cancelSpy).toHaveBeenCalled();
    flushConfirmFrames();
  });

  it('observes a distinct designer ancestor and console panel sibling', () => {
    vi.useFakeTimers();
    const designer = document.createElement('div');
    designer.className = 'wf-designer';
    const mount = document.createElement('div');
    mount.className = 'workflow-designer-mount';
    const el = document.createElement('div');
    mount.appendChild(el);
    const consolePanel = document.createElement('div');
    consolePanel.className = 'wf-console-panel';
    designer.appendChild(mount);
    designer.appendChild(consolePanel);
    document.body.appendChild(designer);
    const ref = { current: el };

    class MockRO {
      observe() { /* noop */ }
      disconnect() { /* noop */ }
      unobserve() { /* noop */ }
    }
    vi.stubGlobal('ResizeObserver', MockRO);

    const observedTargets: unknown[] = [];
    class MockMO {
      constructor(_cb: MutationCallback) { /* noop */ }
      observe(target: unknown) { observedTargets.push(target); }
      disconnect() { /* noop */ }
      takeRecords() { return []; }
    }
    vi.stubGlobal('MutationObserver', MockMO as unknown as typeof MutationObserver);

    mockBox(el, 640, 480);
    renderHook(() => useHasLayoutSize(ref, { trackInTest: true }));
    flushConfirmFrames();

    expect(observedTargets).toContain(mount);
    expect(observedTargets).toContain(designer);
    expect(observedTargets).toContain(consolePanel);
  });
});
