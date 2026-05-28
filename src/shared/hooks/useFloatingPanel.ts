import { useState, useRef, useCallback, useEffect } from 'react';

export const PANEL_LIMITS = {
  MIN_DOCKED_H: 80,
  MAX_DOCKED_H: 600,
  MIN_FLOAT_W: 320,
  MIN_FLOAT_H: 180,
} as const;

interface UseFloatingPanelOptions {
  defaultDockedHeight?: number;
  floatWidthRatio?: number;
  floatHeightRatio?: number;
}

function getViewportBounds() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 800;
  const h = typeof window !== 'undefined' ? window.innerHeight : 600;
  return { w, h };
}

export function useFloatingPanel(opts: UseFloatingPanelOptions = {}) {
  const {
    defaultDockedHeight = 200,
    floatWidthRatio = 0.45,
    floatHeightRatio = 0.6,
  } = opts;

  const [dockedHeight, setDockedHeight] = useState(defaultDockedHeight);

  const [floatPos, setFloatPos] = useState(() => {
    const { w, h } = getViewportBounds();
    return {
      x: Math.round(w * 0.15),
      y: Math.round(h * 0.1),
    };
  });
  const [floatSize, setFloatSize] = useState(() => {
    const { w, h } = getViewportBounds();
    return {
      w: Math.max(PANEL_LIMITS.MIN_FLOAT_W, Math.round(w * floatWidthRatio)),
      h: Math.max(PANEL_LIMITS.MIN_FLOAT_H, Math.round(h * floatHeightRatio)),
    };
  });

  const beginMouseSession = useCallback((cursor: string) => {
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';
  }, []);

  const endMouseSession = useCallback(() => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Docked resize
  const dockedDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onDockedResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dockedDragRef.current = { startY: e.clientY, startH: dockedHeight };
    beginMouseSession('row-resize');
  }, [beginMouseSession, dockedHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dockedDragRef.current) return;
      const delta = dockedDragRef.current.startY - e.clientY;
      setDockedHeight(Math.max(PANEL_LIMITS.MIN_DOCKED_H, Math.min(PANEL_LIMITS.MAX_DOCKED_H, dockedDragRef.current.startH + delta)));
    };
    const onUp = () => {
      if (dockedDragRef.current) {
        dockedDragRef.current = null;
        endMouseSession();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [endMouseSession]);

  // Floating drag
  const floatDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onFloatDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    e.preventDefault();
    floatDragRef.current = { startX: e.clientX, startY: e.clientY, origX: floatPos.x, origY: floatPos.y };
    beginMouseSession('grabbing');
  }, [beginMouseSession, floatPos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!floatDragRef.current) return;
      const dx = e.clientX - floatDragRef.current.startX;
      const dy = e.clientY - floatDragRef.current.startY;
      const { w, h } = getViewportBounds();
      const maxX = Math.max(0, w - floatSize.w);
      const maxY = Math.max(0, h - floatSize.h);
      setFloatPos({
        x: Math.min(maxX, Math.max(0, floatDragRef.current.origX + dx)),
        y: Math.min(maxY, Math.max(0, floatDragRef.current.origY + dy)),
      });
    };
    const onUp = () => {
      if (floatDragRef.current) {
        floatDragRef.current = null;
        endMouseSession();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [endMouseSession, floatSize.h, floatSize.w]);

  // Floating resize (bottom-right corner)
  const floatResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const onFloatResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    floatResizeRef.current = { startX: e.clientX, startY: e.clientY, origW: floatSize.w, origH: floatSize.h };
    beginMouseSession('nwse-resize');
  }, [beginMouseSession, floatSize]);

  // Floating resize (right edge)
  const floatEdgeResizeRef = useRef<{ startX: number; origW: number } | null>(null);

  const onRightEdgeResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    floatEdgeResizeRef.current = { startX: e.clientX, origW: floatSize.w };
    beginMouseSession('ew-resize');
  }, [beginMouseSession, floatSize]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (floatResizeRef.current) {
        const dx = e.clientX - floatResizeRef.current.startX;
        const dy = e.clientY - floatResizeRef.current.startY;
        const { w, h } = getViewportBounds();
        const maxW = Math.max(PANEL_LIMITS.MIN_FLOAT_W, w - floatPos.x);
        const maxH = Math.max(PANEL_LIMITS.MIN_FLOAT_H, h - floatPos.y);
        setFloatSize({
          w: Math.min(maxW, Math.max(PANEL_LIMITS.MIN_FLOAT_W, floatResizeRef.current.origW + dx)),
          h: Math.min(maxH, Math.max(PANEL_LIMITS.MIN_FLOAT_H, floatResizeRef.current.origH + dy)),
        });
      } else if (floatEdgeResizeRef.current) {
        const dx = e.clientX - floatEdgeResizeRef.current.startX;
        const { w } = getViewportBounds();
        const maxW = Math.max(PANEL_LIMITS.MIN_FLOAT_W, w - floatPos.x);
        setFloatSize(prev => ({
          ...prev,
          w: Math.min(maxW, Math.max(PANEL_LIMITS.MIN_FLOAT_W, floatEdgeResizeRef.current!.origW + dx)),
        }));
      }
    };
    const onUp = () => {
      if (floatResizeRef.current || floatEdgeResizeRef.current) {
        floatResizeRef.current = null;
        floatEdgeResizeRef.current = null;
        endMouseSession();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [endMouseSession, floatPos.x, floatPos.y]);

  return {
    dockedHeight, setDockedHeight,
    floatPos, setFloatPos,
    floatSize, setFloatSize,
    onDockedResizeStart,
    onFloatDragStart,
    onFloatResizeStart,
    onRightEdgeResizeStart,
  };
}
