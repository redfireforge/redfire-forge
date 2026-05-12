import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_CANVAS_WIDTH = 120;
const MIN_PANEL_WIDTH = 150;
const MIN_CANVAS_WIDTH = 60;

export interface UsePanelResizeReturn {
  sourcePanelWidth: number | null;
  targetPanelWidth: number | null;
  canvasWidth: number;
  handleResizeStart: (side: 'source' | 'target', e: React.MouseEvent) => void;
}

export function usePanelResize(containerRef: React.RefObject<HTMLDivElement | null>): UsePanelResizeReturn {
  const [sourcePanelWidth, setSourcePanelWidth] = useState<number | null>(null);
  const [targetPanelWidth, setTargetPanelWidth] = useState<number | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);

  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { resizeCleanupRef.current?.(); };
  }, []);

  const handleResizeStart = useCallback(
    (side: 'source' | 'target', e: React.MouseEvent) => {
      e.preventDefault();
      resizeCleanupRef.current?.();
      const startX = e.clientX;
      const body = containerRef.current?.querySelector('.dm-body') as HTMLElement | null;
      if (!body) return;
      const panelWrappers = body.querySelectorAll('.dm-panel-wrapper');
      const sourceWrapper = panelWrappers[0] as HTMLElement | undefined;
      const targetWrapper = panelWrappers[1] as HTMLElement | undefined;
      const canvasWrapper = body.querySelector('.dm-canvas-wrapper') as HTMLElement | null;
      const bodyRect = body.getBoundingClientRect();
      const measuredSourceW = sourceWrapper?.getBoundingClientRect().width ?? 0;
      const measuredTargetW = targetWrapper?.getBoundingClientRect().width ?? 0;
      const measuredCanvasW = canvasWrapper?.getBoundingClientRect().width ?? 0;
      const fallbackPanelW = bodyRect.width > 0 ? bodyRect.width * 0.38 : MIN_PANEL_WIDTH * 2;
      const startSourceW = sourcePanelWidth ?? (measuredSourceW > 0 ? measuredSourceW : fallbackPanelW);
      const startTargetW = targetPanelWidth ?? (measuredTargetW > 0 ? measuredTargetW : fallbackPanelW);
      const startCanvasW = measuredCanvasW > 0 ? measuredCanvasW : canvasWidth;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        if (side === 'source') {
          const maxSourceW = Math.max(MIN_PANEL_WIDTH, startSourceW + startCanvasW - MIN_CANVAS_WIDTH);
          const newSourceW = Math.max(MIN_PANEL_WIDTH, Math.min(maxSourceW, startSourceW + delta));
          const newCanvasW = Math.max(MIN_CANVAS_WIDTH, startCanvasW - (newSourceW - startSourceW));
          setSourcePanelWidth(newSourceW);
          setCanvasWidth(newCanvasW);
        } else {
          const maxTargetW = Math.max(MIN_PANEL_WIDTH, startTargetW + startCanvasW - MIN_CANVAS_WIDTH);
          const newTargetW = Math.max(MIN_PANEL_WIDTH, Math.min(maxTargetW, startTargetW - delta));
          const newCanvasW = Math.max(MIN_CANVAS_WIDTH, startCanvasW - (newTargetW - startTargetW));
          setTargetPanelWidth(newTargetW);
          setCanvasWidth(newCanvasW);
        }
      };
      const cleanup = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        resizeCleanupRef.current = null;
      };
      const onUp = () => { cleanup(); };
      resizeCleanupRef.current = cleanup;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [canvasWidth, sourcePanelWidth, targetPanelWidth, containerRef],
  );

  return { sourcePanelWidth, targetPanelWidth, canvasWidth, handleResizeStart };
}
