/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResizablePanels } from './useResizablePanels';

function windowMouseEvent(type: string, clientX: number): MouseEvent {
  return new MouseEvent(type, { clientX, bubbles: true });
}

describe('useResizablePanels', () => {
  afterEach(() => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  describe('initialization', () => {
    it('returns default palette and config widths and startDrag', () => {
      const { result } = renderHook(() => useResizablePanels());
      expect(result.current.paletteWidth).toBe(260);
      expect(result.current.configWidth).toBe(320);
      expect(typeof result.current.startDrag).toBe('function');
    });

    it('uses custom initial widths', () => {
      const { result } = renderHook(() =>
        useResizablePanels({ initialPaletteWidth: 300, initialConfigWidth: 400 }),
      );
      expect(result.current.paletteWidth).toBe(300);
      expect(result.current.configWidth).toBe(400);
    });

    it('treats empty options as defaults', () => {
      const { result } = renderHook(() => useResizablePanels({}));
      expect(result.current.paletteWidth).toBe(260);
      expect(result.current.configWidth).toBe(320);
    });

    it('merges partial options with defaults', () => {
      const { result } = renderHook(() => useResizablePanels({ initialPaletteWidth: 100 }));
      expect(result.current.paletteWidth).toBe(100);
      expect(result.current.configWidth).toBe(320);
    });
  });

  describe('left splitter (palette width)', () => {
    it('increases palette width when dragging right', () => {
      const { result } = renderHook(() => useResizablePanels());

      const down = { clientX: 200 } as unknown as React.MouseEvent;
      act(() => result.current.startDrag('left', down));
      expect(document.body.style.cursor).toBe('col-resize');
      expect(document.body.style.userSelect).toBe('none');

      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 250));
      });
      // startW 260 + (250 - 200) = 310
      expect(result.current.paletteWidth).toBe(310);

      act(() => {
        window.dispatchEvent(windowMouseEvent('mouseup', 250));
      });
      expect(document.body.style.cursor).toBe('');
      expect(document.body.style.userSelect).toBe('');
    });

    it('decreases palette width when dragging left', () => {
      const { result } = renderHook(() =>
        useResizablePanels({ initialPaletteWidth: 300, minPaletteWidth: 180, maxPaletteWidth: 500 }),
      );

      act(() => result.current.startDrag('left', { clientX: 400 } as unknown as React.MouseEvent));
      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 350));
      });
      expect(result.current.paletteWidth).toBe(250);
      act(() => {
        window.dispatchEvent(windowMouseEvent('mouseup', 350));
      });
    });

    it('clamps palette width to min and max', () => {
      const { result } = renderHook(() =>
        useResizablePanels({
          initialPaletteWidth: 200,
          minPaletteWidth: 180,
          maxPaletteWidth: 220,
        }),
      );

      act(() => result.current.startDrag('left', { clientX: 100 } as unknown as React.MouseEvent));
      // Huge drag right: 200 + (900 - 100) would overflow; clamp to 220
      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 900));
      });
      expect(result.current.paletteWidth).toBe(220);

      act(() => {
        window.dispatchEvent(windowMouseEvent('mouseup', 900));
      });

      act(() => result.current.startDrag('left', { clientX: 500 } as unknown as React.MouseEvent));
      // Drag left hard: 220 + (0 - 500) = -280; clamp to 180
      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 0));
      });
      expect(result.current.paletteWidth).toBe(180);

      act(() => {
        window.dispatchEvent(windowMouseEvent('mouseup', 0));
      });
    });
  });

  describe('right splitter (config width)', () => {
    it('decreases config width when dragging right (inverted delta)', () => {
      const { result } = renderHook(() => useResizablePanels({ initialConfigWidth: 400 }));

      act(() => result.current.startDrag('right', { clientX: 300 } as unknown as React.MouseEvent));
      // newW = startW - (clientX - startX) = 400 - (350 - 300) = 350
      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 350));
      });
      expect(result.current.configWidth).toBe(350);

      act(() => {
        window.dispatchEvent(windowMouseEvent('mouseup', 350));
      });
    });

    it('increases config width when dragging left', () => {
      const { result } = renderHook(() => useResizablePanels({ initialConfigWidth: 350 }));

      act(() => result.current.startDrag('right', { clientX: 500 } as unknown as React.MouseEvent));
      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 400));
      });
      // 350 - (400 - 500) = 450
      expect(result.current.configWidth).toBe(450);

      act(() => {
        window.dispatchEvent(windowMouseEvent('mouseup', 400));
      });
    });

    it('clamps config width to min and max', () => {
      const { result } = renderHook(() =>
        useResizablePanels({
          initialConfigWidth: 400,
          minConfigWidth: 300,
          maxConfigWidth: 450,
        }),
      );

      act(() => result.current.startDrag('right', { clientX: 200 } as unknown as React.MouseEvent));
      // 400 - (50 - 200) = 550, clamp 450
      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 50));
      });
      expect(result.current.configWidth).toBe(450);

      act(() => {
        window.dispatchEvent(windowMouseEvent('mouseup', 50));
      });

      act(() => result.current.startDrag('right', { clientX: 600 } as unknown as React.MouseEvent));
      // 450 - (900 - 600) = 150, clamp 300
      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 900));
      });
      expect(result.current.configWidth).toBe(300);

      act(() => {
        window.dispatchEvent(windowMouseEvent('mouseup', 900));
      });
    });
  });

  describe('drag lifecycle and window listeners', () => {
    it('does not change widths on mousemove before any startDrag', () => {
      const { result } = renderHook(() => useResizablePanels());

      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 999));
      });
      expect(result.current.paletteWidth).toBe(260);
      expect(result.current.configWidth).toBe(320);
    });

    it('does not update widths after mouseup until a new drag', () => {
      const { result } = renderHook(() => useResizablePanels());

      act(() => result.current.startDrag('left', { clientX: 100 } as unknown as React.MouseEvent));
      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 120));
      });
      const wAfterMove = result.current.paletteWidth;
      act(() => {
        window.dispatchEvent(windowMouseEvent('mouseup', 120));
      });
      act(() => {
        window.dispatchEvent(windowMouseEvent('mousemove', 500));
      });
      expect(result.current.paletteWidth).toBe(wAfterMove);
    });

    it('mousemove no-ops when drag ended (handler sees null ref)', () => {
      let moveHandler: ((e: MouseEvent) => void) | undefined;
      const realAdd = window.addEventListener.bind(window);
      const addSpy = vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
        if (type === 'mousemove' && typeof listener === 'function') {
          moveHandler = listener as (e: MouseEvent) => void;
        }
        return realAdd(type, listener as EventListener, options);
      });

      try {
        const { result } = renderHook(() => useResizablePanels());
        act(() => result.current.startDrag('left', { clientX: 200 } as unknown as React.MouseEvent));
        act(() => {
          window.dispatchEvent(windowMouseEvent('mouseup', 200));
        });
        const w = result.current.paletteWidth;
        expect(moveHandler).toBeDefined();
        act(() => {
          moveHandler!(windowMouseEvent('mousemove', 999));
        });
        expect(result.current.paletteWidth).toBe(w);
      } finally {
        addSpy.mockRestore();
      }
    });

    it('removes window listeners on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useResizablePanels());
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      removeSpy.mockRestore();
    });
  });
});
