/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSplitPaneResize, type SplitPaneResizeOptions } from './useSplitPaneResize';

function makeContainer(clientWidth: number): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  document.body.appendChild(el);
  return el;
}

function baseOptions(
  container: HTMLElement | null,
  overrides?: Partial<SplitPaneResizeOptions>,
): SplitPaneResizeOptions {
  return {
    storageKey: 'test-split',
    defaultWidth: 400,
    minWidth: 100,
    minOppositeWidth: 100,
    containerRef: { current: container },
    ...overrides,
  };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function keyEvent(key: string, shiftKey = false): React.KeyboardEvent {
  return { key, shiftKey, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
}

describe('useSplitPaneResize', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts at the default width and exposes separator semantics', () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    expect(result.current.width).toBe(400);
    const dp = result.current.dividerProps;
    expect(dp.role).toBe('separator');
    expect(dp['aria-orientation']).toBe('vertical');
    expect(dp['aria-label']).toBe('Resize panels');
    expect(dp.tabIndex).toBe(0);
    expect(dp['aria-valuenow']).toBe(400);
    expect(dp['aria-valuemin']).toBe(100);
    // Measured max = clientWidth - minOpposite = 1000 - 100.
    expect(result.current.maxWidth).toBe(900);
    expect(dp['aria-valuemax']).toBe(900);
  });

  it('uses a custom label when provided', () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() =>
      useSplitPaneResize(baseOptions(container, { label: 'Resize columns' })),
    );
    expect(result.current.dividerProps['aria-label']).toBe('Resize columns');
  });

  it('loads a persisted width on mount', async () => {
    localStorage.setItem('test-split', '650');
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    expect(result.current.width).toBe(650);
  });

  it('clamps a persisted width above the container maximum', async () => {
    localStorage.setItem('test-split', '5000');
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    expect(result.current.width).toBe(900);
  });

  it('applies maxWidthRatio when clamping persisted width', async () => {
    localStorage.setItem('test-split', '650');
    const container = makeContainer(1000);
    const { result } = renderHook(() =>
      useSplitPaneResize(baseOptions(container, { maxWidthRatio: 0.42 })),
    );
    await act(async () => {
      await tick();
    });
    expect(result.current.width).toBe(420);
    expect(result.current.maxWidth).toBe(420);
  });

  it('ignores a non-numeric persisted value', async () => {
    localStorage.setItem('test-split', 'not-a-number');
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    expect(result.current.width).toBe(400);
  });

  it('steps the width with Arrow keys', async () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowRight')));
    expect(result.current.width).toBe(416);
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowLeft')));
    expect(result.current.width).toBe(400);
  });

  it('uses the page step for Shift+Arrow and PageUp/PageDown', async () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowRight', true)));
    expect(result.current.width).toBe(464);
    act(() => result.current.dividerProps.onKeyDown(keyEvent('PageDown')));
    expect(result.current.width).toBe(400);
    act(() => result.current.dividerProps.onKeyDown(keyEvent('PageUp')));
    expect(result.current.width).toBe(464);
  });

  it('jumps to the minimum on Home and the container maximum on End', async () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('Home')));
    expect(result.current.width).toBe(100);
    act(() => result.current.dividerProps.onKeyDown(keyEvent('End')));
    expect(result.current.width).toBe(900);
  });

  it('clamps below the minimum width', async () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('Home')));
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowLeft')));
    expect(result.current.width).toBe(100);
  });

  it('caps width at defaultWidth before the container is measured', async () => {
    const { result } = renderHook(() =>
      useSplitPaneResize(baseOptions(null)),
    );
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowRight')));
    expect(result.current.width).toBe(400);
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowRight')));
    expect(result.current.width).toBe(400);
  });

  it('re-clamps the width down when the container shrinks on resize', async () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    // Grow the left pane to the old container maximum (1000 - 100 = 900).
    act(() => result.current.dividerProps.onKeyDown(keyEvent('End')));
    expect(result.current.width).toBe(900);
    // Shrink the container and fire a window resize.
    Object.defineProperty(container, 'clientWidth', { value: 500, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    // New max = 500 - 100 = 400; the width clamps down so the pane never overflows.
    expect(result.current.maxWidth).toBe(400);
    expect(result.current.width).toBe(400);
  });

  it('does not grow the width when the container expands on resize', async () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    expect(result.current.width).toBe(400);
    Object.defineProperty(container, 'clientWidth', { value: 2000, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    // Width stays put; only the measured maximum grows.
    expect(result.current.width).toBe(400);
    expect(result.current.maxWidth).toBe(1900);
  });

  it('ignores non-navigation keys', async () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    const evt = keyEvent('Enter');
    act(() => result.current.dividerProps.onKeyDown(evt));
    expect(result.current.width).toBe(400);
    expect(evt.preventDefault).not.toHaveBeenCalled();
  });

  it('persists the width (debounced) after a change', async () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowRight')));
    await act(async () => {
      await wait(350);
    });
    expect(localStorage.getItem('test-split')).toBe('416');
  });

  it('flushes the latest width on unmount', async () => {
    const container = makeContainer(1000);
    const { result, unmount } = renderHook(() =>
      useSplitPaneResize(baseOptions(container)),
    );
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowRight')));
    act(() => {
      unmount();
    });
    await tick();
    expect(localStorage.getItem('test-split')).toBe('416');
  });

  it('updates the drag width via the divider mouse handlers', async () => {
    const container = makeContainer(1000);
    const { result } = renderHook(() => useSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => {
      result.current.dividerProps.onMouseDown({
        clientX: 400,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 520 }));
    });
    expect(result.current.width).toBe(520);
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
  });
});
