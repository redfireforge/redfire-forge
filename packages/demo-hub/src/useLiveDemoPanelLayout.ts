/** Live demo floating panel — drag + edge resize (top, left, right, bottom, corner) with persistence. */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import {
  DEMO_PANEL_CLEAR_TARGET_EVENT,
  type DemoPanelClearTargetDetail,
} from './demoSpotlightUtils';

export const DEMO_LIVE_PANEL_DEFAULT_WIDTH = 400;
export const DEMO_LIVE_PANEL_DEFAULT_HEIGHT = 440;
export const DEMO_LIVE_PANEL_MIN_WIDTH = 300;
export const DEMO_LIVE_PANEL_MIN_HEIGHT = 260;
export const DEMO_LIVE_PANEL_STORAGE_KEY = 'redfire-demo-live-panel-geometry-v2';

export interface LiveDemoPanelGeometry {
  top: number;
  left: number;
  width: number;
  height: number;
}

type ResizeEdge = 'top' | 'left' | 'right' | 'bottom' | 'corner';

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

function isSameGeometry(a: LiveDemoPanelGeometry, b: LiveDemoPanelGeometry): boolean {
  return a.top === b.top
    && a.left === b.left
    && a.width === b.width
    && a.height === b.height;
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
    top: 84,
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
  /** Last user/default position — never overwritten by spotlight dodge. */
  const anchorRef = useRef<LiveDemoPanelGeometry>(geometry);
  /** True while showing a temporary vertical dodge away from a spotlight. */
  const ephemeralDodgeRef = useRef(false);

  const commitGeometry = useCallback((
    next: LiveDemoPanelGeometry,
    opts?: { persist?: boolean; ephemeral?: boolean },
  ) => {
    const clamped = clampGeometry(next);
    const persist = opts?.persist !== false;
    setGeometry((prev) => {
      if (isSameGeometry(prev, clamped)) {
        geometryRef.current = prev;
        return prev;
      }
      geometryRef.current = clamped;
      if (persist) {
        saveGeometry(clamped);
        anchorRef.current = clamped;
        ephemeralDodgeRef.current = false;
      } else {
        ephemeralDodgeRef.current = opts?.ephemeral !== false;
      }
      return clamped;
    });
  }, []);

  useEffect(() => {
    const onResize = () => {
      // Viewport change: clamp the user anchor (not a transient dodge).
      commitGeometry(anchorRef.current);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [commitGeometry]);

  // Spotlight targets under the narration card — nudge vertically only.
  // Never slide left/right: that looked like the modal jumping between steps,
  // and those moves used to persist into localStorage.
  useEffect(() => {
    const overlaps = (
      panel: LiveDemoPanelGeometry,
      target: DemoPanelClearTargetDetail,
      pad = 16,
    ): boolean => !(
      panel.left + panel.width + pad <= target.left
      || panel.left - pad >= target.right
      || panel.top + panel.height + pad <= target.top
      || panel.top - pad >= target.bottom
    );

    const onClearTarget = (event: Event) => {
      const target = (event as CustomEvent<DemoPanelClearTargetDetail>).detail;
      if (!target) return;

      const anchor = anchorRef.current;
      const { width, height, left } = anchor;

      // Target clear of the user's place → snap back if we had dodged.
      if (!overlaps(anchor, target)) {
        if (ephemeralDodgeRef.current) {
          commitGeometry(anchor, { persist: false, ephemeral: false });
        }
        return;
      }

      // Vertical-only candidates — keep the same left edge.
      const candidates: LiveDemoPanelGeometry[] = [
        { width, height, left, top: target.bottom + 20 },
        { width, height, left, top: Math.max(8, target.top - height - 20) },
      ];

      for (const candidate of candidates) {
        const clamped = clampGeometry(candidate);
        // clampGeometry can shift left on tiny viewports; re-pin to anchor left.
        const verticalOnly: LiveDemoPanelGeometry = {
          ...clamped,
          left: clamp(left, 8, window.innerWidth - clamped.width - 8),
        };
        if (!overlaps(verticalOnly, target)) {
          commitGeometry(verticalOnly, { persist: false, ephemeral: true });
          return;
        }
      }
      // Cannot clear without changing left — stay put (panel is clickthrough).
    };

    window.addEventListener(DEMO_PANEL_CLEAR_TARGET_EVENT, onClearTarget as EventListener);
    return () => {
      window.removeEventListener(DEMO_PANEL_CLEAR_TARGET_EVENT, onClearTarget as EventListener);
    };
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
      } else if (edge === 'bottom') {
        height = startRect.height + dy;
      } else if (edge === 'corner') {
        width = startRect.width + dx;
        height = startRect.height + dy;
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
