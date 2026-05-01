/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarResize } from './useSidebarResize';

describe('useSidebarResize', () => {
  let originalBodyStyle: { cursor: string; userSelect: string };

  beforeEach(() => {
    // Save original body styles
    originalBodyStyle = {
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    };
  });

  afterEach(() => {
    // Restore original body styles
    document.body.style.cursor = originalBodyStyle.cursor;
    document.body.style.userSelect = originalBodyStyle.userSelect;
  });

  describe('initialization', () => {
    it('initializes with default width of 280px', () => {
      const { result } = renderHook(() => useSidebarResize());
      expect(result.current.sidebarWidth).toBe(280);
    });

    it('initializes with custom initial width', () => {
      const { result } = renderHook(() => useSidebarResize({ initialWidth: 320 }));
      expect(result.current.sidebarWidth).toBe(320);
    });

    it('initializes with sidebar not collapsed', () => {
      const { result } = renderHook(() => useSidebarResize());
      expect(result.current.sidebarCollapsed).toBe(false);
    });

    it('provides setSidebarWidth callback', () => {
      const { result } = renderHook(() => useSidebarResize());
      expect(typeof result.current.setSidebarWidth).toBe('function');
    });

    it('provides setSidebarCollapsed callback', () => {
      const { result } = renderHook(() => useSidebarResize());
      expect(typeof result.current.setSidebarCollapsed).toBe('function');
    });

    it('provides handleResizeStart callback', () => {
      const { result } = renderHook(() => useSidebarResize());
      expect(typeof result.current.handleResizeStart).toBe('function');
    });
  });

  describe('sidebar width state', () => {
    it('allows setting sidebar width directly', () => {
      const { result } = renderHook(() => useSidebarResize());
      
      act(() => {
        result.current.setSidebarWidth(400);
      });

      expect(result.current.sidebarWidth).toBe(400);
    });

    it('updates width through multiple set calls', () => {
      const { result } = renderHook(() => useSidebarResize());
      
      act(() => {
        result.current.setSidebarWidth(300);
      });
      expect(result.current.sidebarWidth).toBe(300);

      act(() => {
        result.current.setSidebarWidth(350);
      });
      expect(result.current.sidebarWidth).toBe(350);
    });
  });

  describe('sidebar collapsed state', () => {
    it('allows toggling collapsed state', () => {
      const { result } = renderHook(() => useSidebarResize());
      
      act(() => {
        result.current.setSidebarCollapsed(true);
      });

      expect(result.current.sidebarCollapsed).toBe(true);
    });

    it('allows toggling back to expanded', () => {
      const { result } = renderHook(() => useSidebarResize());
      
      act(() => {
        result.current.setSidebarCollapsed(true);
      });
      
      act(() => {
        result.current.setSidebarCollapsed(false);
      });

      expect(result.current.sidebarCollapsed).toBe(false);
    });
  });

  describe('resize interaction', () => {
    it('sets body cursor on resize start', () => {
      const { result } = renderHook(() => useSidebarResize());
      
      const mouseEvent = new MouseEvent('mousedown', { clientX: 280 }) as unknown as React.MouseEvent;
      
      act(() => {
        result.current.handleResizeStart(mouseEvent);
      });

      expect(document.body.style.cursor).toBe('col-resize');
    });

    it('disables text selection on resize start', () => {
      const { result } = renderHook(() => useSidebarResize());
      
      const mouseEvent = new MouseEvent('mousedown', { clientX: 280 }) as unknown as React.MouseEvent;
      
      act(() => {
        result.current.handleResizeStart(mouseEvent);
      });

      expect(document.body.style.userSelect).toBe('none');
    });

    it('enforces minimum width constraint', () => {
      const { result } = renderHook(() => useSidebarResize({ initialWidth: 280, minWidth: 200 }));
      
      const mouseDownEvent = new MouseEvent('mousedown', { clientX: 280, bubbles: true }) as unknown as React.MouseEvent;
      
      act(() => {
        result.current.handleResizeStart(mouseDownEvent);
      });

      // Simulate dragging left past minimum
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 100 });
      act(() => {
        document.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.sidebarWidth).toBe(200); // Should clamp to minWidth

      // Cleanup
      const mouseUpEvent = new MouseEvent('mouseup');
      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });
    });

    it('enforces maximum width constraint', () => {
      const { result } = renderHook(() => useSidebarResize({ initialWidth: 280, maxWidth: 500 }));
      
      const mouseDownEvent = new MouseEvent('mousedown', { clientX: 280, bubbles: true }) as unknown as React.MouseEvent;
      
      act(() => {
        result.current.handleResizeStart(mouseDownEvent);
      });

      // Simulate dragging right past maximum
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 1000 });
      act(() => {
        document.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.sidebarWidth).toBe(500); // Should clamp to maxWidth

      // Cleanup
      const mouseUpEvent = new MouseEvent('mouseup');
      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });
    });

    it('updates width during drag within bounds', () => {
      const { result } = renderHook(() => useSidebarResize({ initialWidth: 280, minWidth: 200, maxWidth: 500 }));
      
      const mouseDownEvent = new MouseEvent('mousedown', { clientX: 280, bubbles: true }) as unknown as React.MouseEvent;
      
      act(() => {
        result.current.handleResizeStart(mouseDownEvent);
      });

      // Simulate dragging right by 50px
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 330 });
      act(() => {
        document.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.sidebarWidth).toBe(330);

      // Cleanup
      const mouseUpEvent = new MouseEvent('mouseup');
      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });
    });

    it('restores body cursor on resize end', () => {
      const { result } = renderHook(() => useSidebarResize());
      
      const mouseDownEvent = new MouseEvent('mousedown', { clientX: 280, bubbles: true }) as unknown as React.MouseEvent;
      
      act(() => {
        result.current.handleResizeStart(mouseDownEvent);
      });

      expect(document.body.style.cursor).toBe('col-resize');

      const mouseUpEvent = new MouseEvent('mouseup');
      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });

      expect(document.body.style.cursor).toBe('');
    });

    it('restores text selection on resize end', () => {
      const { result } = renderHook(() => useSidebarResize());
      
      const mouseDownEvent = new MouseEvent('mousedown', { clientX: 280, bubbles: true }) as unknown as React.MouseEvent;
      
      act(() => {
        result.current.handleResizeStart(mouseDownEvent);
      });

      expect(document.body.style.userSelect).toBe('none');

      const mouseUpEvent = new MouseEvent('mouseup');
      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });

      expect(document.body.style.userSelect).toBe('');
    });

    it('stops tracking mouse movements after mouseup', () => {
      const { result } = renderHook(() => useSidebarResize({ initialWidth: 280 }));
      
      const mouseDownEvent = new MouseEvent('mousedown', { clientX: 280, bubbles: true }) as unknown as React.MouseEvent;
      
      act(() => {
        result.current.handleResizeStart(mouseDownEvent);
      });

      const mouseUpEvent = new MouseEvent('mouseup');
      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });

      const initialWidth = result.current.sidebarWidth;

      // Try to move mouse after mouseup - width should not change
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 500 });
      act(() => {
        document.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.sidebarWidth).toBe(initialWidth);
    });
  });

  describe('option validation', () => {
    it('accepts all custom options', () => {
      const { result } = renderHook(() => 
        useSidebarResize({ initialWidth: 350, minWidth: 250, maxWidth: 700 })
      );
      
      expect(result.current.sidebarWidth).toBe(350);
    });

    it('works with partial options', () => {
      const { result } = renderHook(() => useSidebarResize({ minWidth: 150 }));
      
      expect(result.current.sidebarWidth).toBe(280); // default initialWidth
    });

    it('works with empty options object', () => {
      const { result } = renderHook(() => useSidebarResize({}));
      
      expect(result.current.sidebarWidth).toBe(280);
      expect(result.current.sidebarCollapsed).toBe(false);
    });
  });
});
