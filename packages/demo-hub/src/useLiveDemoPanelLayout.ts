/** Live demo floating panel — drag + edge resize (top, left, right) with persistence. */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';

export const DEMO_LIVE_PANEL_DEFAULT_WIDTH = 400;
export const DEMO_LIVE_PANEL_DEFAULT_HEIGHT = 440;
export const DEMO_LIVE_PANEL_MIN_WIDTH = 300;
export const DEMO_LIVE_PANEL_MIN_HEIGHT = 260;
export const DEMO_LIVE_PANEL_STORAGE_KEY = 'redfire-demo-live-panel-geometry-v1';

export interface LiveDemoPanelGeometry {
  top: number;
  left: number;
  width: number;
  height: number;
}

type ResizeEdge = 'top' | 'left' | 'right';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function maxPanelWidth(viewportWidth: number): number {
  return Math.min(560, viewportWidth - 32);
}

function maxPanelHeight(viewportHeight: number): number {
  return Math.min(640, viewportHeight - 32);
}

function clampGeometry(geom: LiveDemoPanelGeometry): LiveDemoPanelGeometry {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = clamp(geom.width, DEMO_LIVE_PANEL_MIN_WIDTH, maxPanelWidth(vw));
  const height = clamp(geom.height, DEMO_LIVE_PANEL_MIN_HEIGHT, maxPanelHeight(vh));
  const left = clamp(geom.left, 8, vw - width - 8);
  const top = clamp(geom.top, 8, vh - height - 8);
  return { top, left, width, height };
}

export function createDefaultLiveDemoPanelGeometry(
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900,
): LiveDemoPanelGeometry {
  const width = clamp(DEMO_LIVE_PANEL_DEFAULT_WIDTH, DEMO_LIVE_PANEL_MIN_WIDTH, maxPanelWidth(viewportWidth));
  const height = clamp(DEMO_LIVE_PANEL_DEFAULT_HEIGHT, DEMO_LIVE_PANEL_MIN_HEIGHT, maxPanelHeight(viewportHeight));
  return {
    width,
    height,
    left: viewportWidth - width - 16,
    top: viewportHeight - height - 16,
  };
}

function loadSavedGeometry(): LiveDemoPanelGeometry | null {
  try {
    const raw = localStorage.getItem(DEMO_LIVE_PANEL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveDemoPanelGeometry>;
    if (
      typeof parsed.top !== 'number'
      || typeof parsed.left !== 'number'
      || typeof parsed.width !== 'number'
      || typeof parsed.height !== 'number'
    ) {
      return null;
    }
    return clampGeometry(parsed as LiveDemoPanelGeometry);
  } catch {
    return null;
  }
}

function saveGeometry(geom: LiveDemoPanelGeometry): void {
  try {
    localStorage.setItem(DEMO_LIVE_PANEL_STORAGE_KEY, JSON.stringify(geom));
  } catch {
    /* ignore quota / private mode */
  }
}

export function useLiveDemoPanelLayout(): {
  panelRef: RefObject<HTMLDivElement | null>;
  panelStyle: CSSProperties;
  onDragMouseDown: (e: ReactMouseEvent) => void;
  onResizeMouseDown: (edge: ResizeEdge) => (e: ReactMouseEvent) => void;
} {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = useState<LiveDemoPanelGeometry>(() => (
    loadSavedGeometry() ?? createDefaultLiveDemoPanelGeometry()
  ));
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  const commitGeometry = useCallback((next: LiveDemoPanelGeometry) => {
    const clamped = clampGeometry(next);
    geometryRef.current = clamped;
    setGeometry(clamped);
    saveGeometry(clamped);
  }, []);

  useEffect(() => {
    const onResize = () => {
      commitGeometry(geometryRef.current);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [commitGeometry]);

  const onDragMouseDown = useCallback((e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('.demo-live-lesson-name')) return;
    e.preventDefault();

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const origin = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top };
    const startSize = { width: rect.width, height: rect.height };

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - origin.mx;
      const dy = ev.clientY - origin.my;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = startSize.width;
      const height = startSize.height;
      commitGeometry({
        width,
        height,
        left: clamp(origin.px + dx, 8, vw - width - 8),
        top: clamp(origin.py + dy, 8, vh - height - 8),
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [commitGeometry]);

  const onResizeMouseDown = useCallback((edge: ResizeEdge) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const panel = panelRef.current;
    if (!panel) return;

    const startRect = panel.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let width = startRect.width;
      let height = startRect.height;
      let left = startRect.left;
      let top = startRect.top;

      if (edge === 'right') {
        width = startRect.width + dx;
      } else if (edge === 'left') {
        width = startRect.width - dx;
        left = startRect.right - width;
      } else {
        height = startRect.height - dy;
        top = startRect.bottom - height;
      }

      commitGeometry({ top, left, width, height });
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
    height: geometry.height,
    bottom: 'auto',
    right: 'auto',
  };

  return { panelRef, panelStyle, onDragMouseDown, onResizeMouseDown };
}
