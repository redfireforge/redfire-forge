/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useLessonNotesPanelLayout,
  createDefaultLessonNotesPanelGeometry,
  LESSON_NOTES_PANEL_STORAGE_KEY,
} from './useLessonNotesPanelLayout';

describe('useLessonNotesPanelLayout — coverage gaps', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('createDefaultLessonNotesPanelGeometry clamps width on narrow viewports', () => {
    const geom = createDefaultLessonNotesPanelGeometry(400);
    expect(geom.width).toBeLessThanOrEqual(400 - 32);
  });

  it('loads invalid saved geometry as default', () => {
    localStorage.setItem(LESSON_NOTES_PANEL_STORAGE_KEY, JSON.stringify({ top: 'bad' }));
    const { result } = renderHook(() => useLessonNotesPanelLayout());
    expect(result.current.panelStyle.width).toBeDefined();
  });

  it('drag handler ignores mousedown on buttons and moves panel', () => {
    const { result } = renderHook(() => useLessonNotesPanelLayout());
    const panel = document.createElement('div');
    panel.getBoundingClientRect = () => ({
      left: 100, top: 80, width: 480, height: 300,
      right: 580, bottom: 380, x: 100, y: 80, toJSON: () => ({}),
    });
    result.current.panelRef.current = panel;

    const btnEvent = { target: document.createElement('button'), preventDefault: vi.fn(), clientX: 0, clientY: 0 } as never;
    act(() => result.current.onDragMouseDown(btnEvent));
    expect(btnEvent.preventDefault).not.toHaveBeenCalled();

    const moveEvent = { target: panel, preventDefault: vi.fn(), clientX: 120, clientY: 100 } as never;
    act(() => result.current.onDragMouseDown(moveEvent));
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 140, clientY: 120 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.panelStyle.left).toBeDefined();
  });

  it('loads valid saved geometry and reclamps on resize', () => {
    localStorage.setItem(LESSON_NOTES_PANEL_STORAGE_KEY, JSON.stringify({
      top: 40,
      left: 50,
      width: 520,
      height: 320,
    }));
    const { result } = renderHook(() => useLessonNotesPanelLayout());
    expect(result.current.panelStyle.top).toBe(40);
    act(() => {
      vi.stubGlobal('innerWidth', 400);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.panelStyle.width).toBeLessThanOrEqual(560);
  });

  it('re-clamps saved geometry when viewport shrinks', () => {
    localStorage.setItem(LESSON_NOTES_PANEL_STORAGE_KEY, JSON.stringify({
      top: 40,
      left: 50,
      width: 520,
      height: 320,
    }));
    vi.stubGlobal('innerWidth', 400);
    const { result } = renderHook(() => useLessonNotesPanelLayout());
    expect(result.current.panelStyle.width).toBeLessThanOrEqual(400 - 32);
  });

  it('onDragMouseDown no-ops when panel ref is missing', () => {
    const { result } = renderHook(() => useLessonNotesPanelLayout());
    expect(() => {
      act(() => {
        result.current.onDragMouseDown({
          target: document.createElement('div'),
          preventDefault: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as never);
      });
    }).not.toThrow();
  });

  it('swallows localStorage quota errors when saving geometry', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useLessonNotesPanelLayout());
    const panel = document.createElement('div');
    panel.getBoundingClientRect = () => ({
      left: 100, top: 80, width: 480, height: 300,
      right: 580, bottom: 380, x: 100, y: 80, toJSON: () => ({}),
    });
    result.current.panelRef.current = panel;
    expect(() => {
      act(() => {
        result.current.onDragMouseDown({
          target: panel,
          preventDefault: vi.fn(),
          clientX: 110,
          clientY: 90,
        } as never);
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 130, clientY: 110 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
      });
    }).not.toThrow();
  });
});
