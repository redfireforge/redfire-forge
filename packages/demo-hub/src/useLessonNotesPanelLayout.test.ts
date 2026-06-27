/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createDefaultLessonNotesPanelGeometry,
  LESSON_NOTES_PANEL_DEFAULT_WIDTH,
  LESSON_NOTES_PANEL_STORAGE_KEY,
  useLessonNotesPanelLayout,
} from './useLessonNotesPanelLayout';

describe('useLessonNotesPanelLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 900);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses default geometry anchored top-right', () => {
    const geom = createDefaultLessonNotesPanelGeometry(1280);
    expect(geom.width).toBe(LESSON_NOTES_PANEL_DEFAULT_WIDTH);
    expect(geom.left).toBe(1280 - LESSON_NOTES_PANEL_DEFAULT_WIDTH - 28);
    expect(geom.top).toBe(72);
  });

  it('restores saved geometry from localStorage', () => {
    localStorage.setItem(
      LESSON_NOTES_PANEL_STORAGE_KEY,
      JSON.stringify({ top: 100, left: 220, width: 520 }),
    );
    const { result } = renderHook(() => useLessonNotesPanelLayout());
    expect(result.current.panelStyle).toMatchObject({
      top: 100,
      left: 220,
      width: 520,
    });
  });

  it('updates position when dragging the header', () => {
    const { result } = renderHook(() => useLessonNotesPanelLayout());
    const panel = document.createElement('div');
    Object.defineProperty(result.current.panelRef, 'current', { value: panel, writable: true });
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      top: 72,
      left: 772,
      width: 480,
      height: 400,
      right: 1252,
      bottom: 472,
      x: 772,
      y: 72,
      toJSON: () => ({}),
    });

    act(() => {
      result.current.onDragMouseDown({
        preventDefault: vi.fn(),
        clientX: 800,
        clientY: 90,
        target: panel,
      } as unknown as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 820, clientY: 120 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.panelStyle.left).toBe(792);
    expect(result.current.panelStyle.top).toBe(102);
  });
});
