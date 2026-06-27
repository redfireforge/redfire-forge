/** Floating lesson-notes panel — drag + width with persistence. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';

export const LESSON_NOTES_PANEL_DEFAULT_WIDTH = 480;
export const LESSON_NOTES_PANEL_MIN_WIDTH = 360;
export const LESSON_NOTES_PANEL_MAX_WIDTH = 640;
export const LESSON_NOTES_PANEL_STORAGE_KEY = 'redfire-demo-lesson-notes-panel-geometry-v1';

export interface LessonNotesPanelGeometry {
  top: number;
  left: number;
  width: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function maxPanelWidth(viewportWidth: number): number {
  return Math.min(LESSON_NOTES_PANEL_MAX_WIDTH, viewportWidth - 32);
}

function clampGeometry(geom: LessonNotesPanelGeometry): LessonNotesPanelGeometry {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = clamp(geom.width, LESSON_NOTES_PANEL_MIN_WIDTH, maxPanelWidth(vw));
  const minHeight = 200;
  const left = clamp(geom.left, 8, vw - width - 8);
  const top = clamp(geom.top, 8, vh - minHeight - 8);
  return { top, left, width };
}

export function createDefaultLessonNotesPanelGeometry(
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280,
): LessonNotesPanelGeometry {
  const width = clamp(
    LESSON_NOTES_PANEL_DEFAULT_WIDTH,
    LESSON_NOTES_PANEL_MIN_WIDTH,
    maxPanelWidth(viewportWidth),
  );
  return {
    width,
    left: viewportWidth - width - 28,
    top: 72,
  };
}

function loadSavedGeometry(): LessonNotesPanelGeometry | null {
  try {
    const raw = localStorage.getItem(LESSON_NOTES_PANEL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LessonNotesPanelGeometry>;
    if (
      typeof parsed.top !== 'number'
      || typeof parsed.left !== 'number'
      || typeof parsed.width !== 'number'
    ) {
      return null;
    }
    return clampGeometry(parsed as LessonNotesPanelGeometry);
  } catch {
    return null;
  }
}

function saveGeometry(geom: LessonNotesPanelGeometry): void {
  try {
    localStorage.setItem(LESSON_NOTES_PANEL_STORAGE_KEY, JSON.stringify(geom));
  } catch { /* quota / private mode */ }
}

export function useLessonNotesPanelLayout(): {
  panelRef: RefObject<HTMLDivElement | null>;
  panelStyle: CSSProperties;
  onDragMouseDown: (e: ReactMouseEvent) => void;
} {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = useState<LessonNotesPanelGeometry>(() => (
    loadSavedGeometry() ?? createDefaultLessonNotesPanelGeometry()
  ));
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  const commitGeometry = useCallback((next: LessonNotesPanelGeometry) => {
    const clamped = clampGeometry(next);
    geometryRef.current = clamped;
    setGeometry(clamped);
    saveGeometry(clamped);
  }, []);

  useEffect(() => {
    const onResize = () => commitGeometry(geometryRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [commitGeometry]);

  const onDragMouseDown = useCallback((e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const origin = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top };
    const startWidth = rect.width;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - origin.mx;
      const dy = ev.clientY - origin.my;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = startWidth;
      commitGeometry({
        width,
        left: clamp(origin.px + dx, 8, vw - width - 8),
        top: clamp(origin.py + dy, 8, vh - 200 - 8),
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [commitGeometry]);

  const panelStyle: CSSProperties = {
    top: geometry.top,
    left: geometry.left,
    width: geometry.width,
    right: 'auto',
  };

  return { panelRef, panelStyle, onDragMouseDown };
}
