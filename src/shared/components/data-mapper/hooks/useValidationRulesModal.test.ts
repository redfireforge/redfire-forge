/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValidationRulesModal } from './useValidationRulesModal';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

function mouseEvent(type: string, opts: Partial<MouseEvent> = {}) {
  return new MouseEvent(type, { bubbles: true, ...opts });
}

describe('useValidationRulesModal', () => {
  it('initializes with default mode "docked" and reference visible', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    expect(result.current.mode).toBe('docked');
    expect(result.current.referenceVisible).toBe(true);
    expect(result.current.dockedHeight).toBe(260);
  });

  it('setMode persists to localStorage', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    act(() => {
      result.current.setMode('floating');
    });

    expect(result.current.mode).toBe('floating');
    expect(localStorage.getItem('vr-modal-default-mode')).toBe('floating');
  });

  it('restores mode from localStorage', () => {
    localStorage.setItem('vr-modal-default-mode', 'maximized');

    const { result } = renderHook(() => useValidationRulesModal());
    expect(result.current.mode).toBe('maximized');
  });

  it('ignores invalid localStorage mode values', () => {
    localStorage.setItem('vr-modal-default-mode', 'bogus');

    const { result } = renderHook(() => useValidationRulesModal());
    expect(result.current.mode).toBe('docked');
  });

  it('toggleReference flips visibility and persists', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    expect(result.current.referenceVisible).toBe(true);

    act(() => {
      result.current.toggleReference();
    });

    expect(result.current.referenceVisible).toBe(false);
    expect(localStorage.getItem('vr-modal-reference')).toBe('false');

    act(() => {
      result.current.toggleReference();
    });

    expect(result.current.referenceVisible).toBe(true);
    expect(localStorage.getItem('vr-modal-reference')).toBe('true');
  });

  it('restores referenceVisible false from localStorage', () => {
    localStorage.setItem('vr-modal-reference', 'false');

    const { result } = renderHook(() => useValidationRulesModal());
    expect(result.current.referenceVisible).toBe(false);
  });

  it('floatPos and floatSize have reasonable initial values', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    expect(result.current.floatPos.x).toBeGreaterThanOrEqual(0);
    expect(result.current.floatPos.y).toBeGreaterThanOrEqual(0);
    expect(result.current.floatSize.w).toBeGreaterThanOrEqual(420);
    expect(result.current.floatSize.h).toBeGreaterThanOrEqual(260);
  });

  it('handler references remain stable across renders', () => {
    const { result, rerender } = renderHook(() => useValidationRulesModal());

    const first = {
      setMode: result.current.setMode,
      toggleReference: result.current.toggleReference,
    };

    rerender();

    expect(result.current.setMode).toBe(first.setMode);
    expect(result.current.toggleReference).toBe(first.toggleReference);
  });

  it('cycles through all three modes', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    act(() => result.current.setMode('floating'));
    expect(result.current.mode).toBe('floating');

    act(() => result.current.setMode('maximized'));
    expect(result.current.mode).toBe('maximized');

    act(() => result.current.setMode('docked'));
    expect(result.current.mode).toBe('docked');
  });

  // ── Docked resize ──

  it('docked resize adjusts height on mousemove and resets on mouseup', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    const syntheticEvent = {
      clientY: 500,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.onDockedResizeStart(syntheticEvent);
    });

    expect(document.body.style.cursor).toBe('row-resize');
    expect(document.body.style.userSelect).toBe('none');

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientY: 450 }));
    });

    expect(result.current.dockedHeight).toBe(310);

    act(() => {
      window.dispatchEvent(mouseEvent('mouseup'));
    });

    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('docked resize clamps to minimum height', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    const syntheticEvent = {
      clientY: 500,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.onDockedResizeStart(syntheticEvent);
    });

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientY: 900 }));
    });

    expect(result.current.dockedHeight).toBe(80);
  });

  it('docked resize clamps to maximum height', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    const syntheticEvent = {
      clientY: 500,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.onDockedResizeStart(syntheticEvent);
    });

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientY: -500 }));
    });

    expect(result.current.dockedHeight).toBe(600);
  });

  it('docked mousemove without active drag does nothing', () => {
    const { result } = renderHook(() => useValidationRulesModal());
    const initialHeight = result.current.dockedHeight;

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientY: 100 }));
    });

    expect(result.current.dockedHeight).toBe(initialHeight);
  });

  it('docked mouseup without active drag does nothing', () => {
    renderHook(() => useValidationRulesModal());

    act(() => {
      window.dispatchEvent(mouseEvent('mouseup'));
    });

    expect(document.body.style.cursor).toBe('');
  });

  // ── Floating drag ──

  it('floating drag moves position on mousemove and resets on mouseup', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    const syntheticEvent = {
      clientX: 200,
      clientY: 200,
      target: document.createElement('div'),
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.onFloatDragStart(syntheticEvent);
    });

    expect(document.body.style.cursor).toBe('grabbing');

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientX: 250, clientY: 230 }));
    });

    const origX = result.current.floatPos.x;
    const origY = result.current.floatPos.y;
    expect(origX).toBeGreaterThanOrEqual(0);
    expect(origY).toBeGreaterThanOrEqual(0);

    act(() => {
      window.dispatchEvent(mouseEvent('mouseup'));
    });

    expect(document.body.style.cursor).toBe('');
  });

  it('floating drag clamps position to minimum 0', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    const syntheticEvent = {
      clientX: 200,
      clientY: 200,
      target: document.createElement('div'),
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.onFloatDragStart(syntheticEvent);
    });

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientX: -9999, clientY: -9999 }));
    });

    expect(result.current.floatPos.x).toBe(0);
    expect(result.current.floatPos.y).toBe(0);

    act(() => {
      window.dispatchEvent(mouseEvent('mouseup'));
    });
  });

  it('floating drag aborts when target is a button', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    const btn = document.createElement('button');
    document.body.appendChild(btn);

    const syntheticEvent = {
      clientX: 100,
      clientY: 100,
      target: btn,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    const posBefore = { ...result.current.floatPos };

    act(() => {
      result.current.onFloatDragStart(syntheticEvent);
    });

    expect(document.body.style.cursor).not.toBe('grabbing');

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientX: 300, clientY: 300 }));
    });

    expect(result.current.floatPos.x).toBe(posBefore.x);
    expect(result.current.floatPos.y).toBe(posBefore.y);

    document.body.removeChild(btn);
  });

  it('floating mousemove without active drag does nothing', () => {
    const { result } = renderHook(() => useValidationRulesModal());
    const before = { ...result.current.floatPos };

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientX: 999, clientY: 999 }));
    });

    expect(result.current.floatPos).toEqual(before);
  });

  // ── Floating corner resize ──

  it('floating corner resize adjusts width and height', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    const syntheticEvent = {
      clientX: 600,
      clientY: 400,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;

    const sizeBefore = { ...result.current.floatSize };

    act(() => {
      result.current.onFloatResizeStart(syntheticEvent);
    });

    expect(document.body.style.cursor).toBe('nwse-resize');

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientX: 700, clientY: 500 }));
    });

    expect(result.current.floatSize.w).toBe(Math.max(420, sizeBefore.w + 100));
    expect(result.current.floatSize.h).toBe(Math.max(260, sizeBefore.h + 100));

    act(() => {
      window.dispatchEvent(mouseEvent('mouseup'));
    });

    expect(document.body.style.cursor).toBe('');
  });

  it('floating corner resize enforces minimum dimensions', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    const syntheticEvent = {
      clientX: 600,
      clientY: 400,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.onFloatResizeStart(syntheticEvent);
    });

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientX: -9999, clientY: -9999 }));
    });

    expect(result.current.floatSize.w).toBe(420);
    expect(result.current.floatSize.h).toBe(260);

    act(() => {
      window.dispatchEvent(mouseEvent('mouseup'));
    });
  });

  // ── Floating right-edge resize ──

  it('right-edge resize adjusts only width', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    const syntheticEvent = {
      clientX: 600,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;

    const hBefore = result.current.floatSize.h;

    act(() => {
      result.current.onRightEdgeResizeStart(syntheticEvent);
    });

    expect(document.body.style.cursor).toBe('ew-resize');

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientX: 700 }));
    });

    expect(result.current.floatSize.h).toBe(hBefore);

    act(() => {
      window.dispatchEvent(mouseEvent('mouseup'));
    });

    expect(document.body.style.cursor).toBe('');
  });

  it('right-edge resize enforces minimum width', () => {
    const { result } = renderHook(() => useValidationRulesModal());

    const syntheticEvent = {
      clientX: 600,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.onRightEdgeResizeStart(syntheticEvent);
    });

    act(() => {
      window.dispatchEvent(mouseEvent('mousemove', { clientX: -9999 }));
    });

    expect(result.current.floatSize.w).toBe(420);

    act(() => {
      window.dispatchEvent(mouseEvent('mouseup'));
    });
  });

  // ── Cleanup on unmount ──

  it('removes window event listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useValidationRulesModal());

    unmount();

    const types = removeSpy.mock.calls.map(c => c[0]);
    expect(types.filter(t => t === 'mousemove').length).toBe(3);
    expect(types.filter(t => t === 'mouseup').length).toBe(3);

    removeSpy.mockRestore();
  });
});
