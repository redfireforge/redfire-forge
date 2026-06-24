/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useVerticalSplitPaneResize,
  type VerticalSplitPaneResizeOptions,
} from './useVerticalSplitPaneResize';

function makeContainer(clientHeight: number): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  document.body.appendChild(el);
  return el;
}

function baseOptions(
  container: HTMLElement | null,
  overrides?: Partial<VerticalSplitPaneResizeOptions>,
): VerticalSplitPaneResizeOptions {
  return {
    storageKey: 'test-vsplit',
    defaultHeight: 300,
    minHeight: 80,
    minOppositeHeight: 80,
    containerRef: { current: container },
    ...overrides,
  };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function keyEvent(key: string, shiftKey = false): React.KeyboardEvent {
  return { key, shiftKey, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
}

describe('useVerticalSplitPaneResize', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts at the default height and exposes horizontal separator semantics', () => {
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    expect(result.current.height).toBe(300);
    const dp = result.current.dividerProps;
    expect(dp.role).toBe('separator');
    expect(dp['aria-orientation']).toBe('horizontal');
    expect(dp['aria-label']).toBe('Resize panels');
    expect(dp.tabIndex).toBe(0);
    expect(result.current.maxHeight).toBe(720);
  });

  it('uses a custom label when provided', () => {
    const container = makeContainer(800);
    const { result } = renderHook(() =>
      useVerticalSplitPaneResize(baseOptions(container, { label: 'Resize rows' })),
    );
    expect(result.current.dividerProps['aria-label']).toBe('Resize rows');
  });

  it('loads a persisted height on mount', async () => {
    localStorage.setItem('test-vsplit', '420');
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    expect(result.current.height).toBe(420);
  });

  it('clamps a persisted height above the container maximum', async () => {
    localStorage.setItem('test-vsplit', '5000');
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    expect(result.current.height).toBe(720);
  });

  it('applies maxHeightRatio when clamping persisted height', async () => {
    localStorage.setItem('test-vsplit', '500');
    const container = makeContainer(800);
    const { result } = renderHook(() =>
      useVerticalSplitPaneResize(baseOptions(container, { maxHeightRatio: 0.5 })),
    );
    await act(async () => {
      await tick();
    });
    expect(result.current.height).toBe(400);
    expect(result.current.maxHeight).toBe(400);
  });

  it('ignores a non-numeric persisted value', async () => {
    localStorage.setItem('test-vsplit', 'not-a-number');
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    expect(result.current.height).toBe(300);
  });

  it('steps the height with Arrow keys (up grows bottom panel)', async () => {
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowUp')));
    expect(result.current.height).toBe(316);
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowDown')));
    expect(result.current.height).toBe(300);
  });

  it('uses the page step for Shift+Arrow and PageUp/PageDown', async () => {
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowUp', true)));
    expect(result.current.height).toBe(364);
    act(() => result.current.dividerProps.onKeyDown(keyEvent('PageDown')));
    expect(result.current.height).toBe(300);
    act(() => result.current.dividerProps.onKeyDown(keyEvent('PageUp')));
    expect(result.current.height).toBe(364);
  });

  it('jumps to the minimum on Home and the container maximum on End', async () => {
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('Home')));
    expect(result.current.height).toBe(80);
    act(() => result.current.dividerProps.onKeyDown(keyEvent('End')));
    expect(result.current.height).toBe(720);
  });

  it('ignores non-navigation keys', async () => {
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    const evt = keyEvent('Enter');
    act(() => result.current.dividerProps.onKeyDown(evt));
    expect(result.current.height).toBe(300);
    expect(evt.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores non-left mouse button on drag start', async () => {
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => {
      result.current.dividerProps.onMouseDown({
        button: 2,
        clientY: 300,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 200 }));
    });
    expect(result.current.height).toBe(300);
  });

  it('persists the height (debounced) after a change', async () => {
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('ArrowUp')));
    await act(async () => {
      await wait(350);
    });
    expect(localStorage.getItem('test-vsplit')).toBe('316');
  });

  it('updates the drag height via the divider mouse handlers', async () => {
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => {
      result.current.dividerProps.onMouseDown({
        button: 0,
        clientY: 400,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 320 }));
    });
    expect(result.current.height).toBe(380);
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });
  });

  it('re-clamps height when the container shrinks on resize', async () => {
    const container = makeContainer(800);
    const { result } = renderHook(() => useVerticalSplitPaneResize(baseOptions(container)));
    await act(async () => {
      await tick();
    });
    act(() => result.current.dividerProps.onKeyDown(keyEvent('End')));
    expect(result.current.height).toBe(720);

    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await act(async () => {
      await tick();
    });
    expect(result.current.maxHeight).toBe(320);
    expect(result.current.height).toBe(320);
  });
});
