import { useState, useRef, useEffect } from 'react';

interface ResizablePanelsOptions {
  initialPaletteWidth?: number;
  initialConfigWidth?: number;
  minPaletteWidth?: number;
  maxPaletteWidth?: number;
  minConfigWidth?: number;
  maxConfigWidth?: number;
}

export function useResizablePanels({
  initialPaletteWidth = 260,
  initialConfigWidth = 320,
  minPaletteWidth = 180,
  maxPaletteWidth = 500,
  minConfigWidth = 220,
  maxConfigWidth = 600,
}: ResizablePanelsOptions = {}) {
  const [paletteWidth, setPaletteWidth] = useState(initialPaletteWidth);
  const [configWidth, setConfigWidth] = useState(initialConfigWidth);
  const dragRef = useRef<{ side: 'left' | 'right'; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { side, startX, startW } = dragRef.current;
      const delta = e.clientX - startX;
      if (side === 'left') {
        setPaletteWidth(Math.max(minPaletteWidth, Math.min(maxPaletteWidth, startW + delta)));
      } else {
        setConfigWidth(Math.max(minConfigWidth, Math.min(maxConfigWidth, startW - delta)));
      }
    };
    const onMouseUp = () => { dragRef.current = null; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDrag = (side: 'left' | 'right', e: React.MouseEvent) => {
    dragRef.current = { side, startX: e.clientX, startW: side === 'left' ? paletteWidth : configWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return { paletteWidth, configWidth, startDrag };
}
