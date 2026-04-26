import { useState, useCallback, useRef } from 'react';

interface UseSidebarResizeOptions {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function useSidebarResize({ initialWidth = 280, minWidth = 180, maxWidth = 600 }: UseSidebarResizeOptions = {}) {
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isResizingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newW = Math.min(maxWidth, Math.max(minWidth, startW + ev.clientX - startX));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth, minWidth, maxWidth]);

  return { sidebarWidth, setSidebarWidth, sidebarCollapsed, setSidebarCollapsed, handleResizeStart };
}
