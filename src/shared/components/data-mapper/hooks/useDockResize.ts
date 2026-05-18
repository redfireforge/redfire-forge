import { useCallback, useState, type RefObject } from 'react';

/**
 * Manages the dock panel resize interaction (drag-to-resize) and
 * the collapse/expand state for Source/Target panels.
 */
export function useDockResize(containerRef: RefObject<HTMLDivElement | null>) {
  const [dockHeight, setDockHeight] = useState<number | null>(null);
  const [panelsCollapsed, setPanelsCollapsed] = useState(false);

  const handleDockResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = dockHeight
      ?? containerRef.current?.querySelector('.dm-bottom-utility-dock')?.getBoundingClientRect().height
      ?? 200;
    const containerHeight = containerRef.current?.getBoundingClientRect().height ?? 600;
    const minHeight = 80;
    const maxHeight = containerHeight * 0.75;

    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setDockHeight(Math.max(minHeight, Math.min(maxHeight, startHeight + delta)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [dockHeight, containerRef]);

  const togglePanelsCollapsed = useCallback(() => {
    setPanelsCollapsed(v => !v);
  }, []);

  return {
    dockHeight,
    panelsCollapsed,
    handleDockResizeStart,
    togglePanelsCollapsed,
  };
}
