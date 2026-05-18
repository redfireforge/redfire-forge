import { useState, useCallback, useRef, useEffect } from 'react';

export type VrModalMode = 'docked' | 'floating' | 'maximized';

const MODE_KEY = 'vr-modal-default-mode';
const REF_KEY = 'vr-modal-reference';
const MIN_DOCKED_H = 80;
const MAX_DOCKED_H = 600;
const DEFAULT_DOCKED_H = 260;
const MIN_FLOAT_W = 420;
const MIN_FLOAT_H = 260;

function loadMode(): VrModalMode {
  const v = localStorage.getItem(MODE_KEY);
  if (v === 'docked' || v === 'floating' || v === 'maximized') return v;
  return 'docked';
}

function loadRef(): boolean {
  return localStorage.getItem(REF_KEY) !== 'false';
}

export function useValidationRulesModal() {
  const [mode, setModeRaw] = useState<VrModalMode>(loadMode);
  const [referenceVisible, setRefVisible] = useState(loadRef);
  const [dockedHeight, setDockedHeight] = useState(DEFAULT_DOCKED_H);

  const [floatPos, setFloatPos] = useState(() => ({
    x: Math.round(window.innerWidth * 0.12),
    y: Math.round(window.innerHeight * 0.08),
  }));
  const [floatSize, setFloatSize] = useState(() => ({
    w: Math.max(MIN_FLOAT_W, Math.round(window.innerWidth * 0.52)),
    h: Math.max(MIN_FLOAT_H, Math.round(window.innerHeight * 0.7)),
  }));

  const setMode = useCallback((m: VrModalMode) => {
    setModeRaw(m);
    localStorage.setItem(MODE_KEY, m);
  }, []);

  const toggleReference = useCallback(() => {
    setRefVisible(prev => {
      const next = !prev;
      localStorage.setItem(REF_KEY, String(next));
      return next;
    });
  }, []);

  // Shared drag-state helpers: set/clear body cursor + userSelect safely.
  // All drag operations go through these so cleanup is guaranteed.
  const activeDragCount = useRef(0);

  const startBodyDrag = useCallback((cursor: string) => {
    activeDragCount.current += 1;
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';
  }, []);

  const endBodyDrag = useCallback(() => {
    activeDragCount.current = Math.max(0, activeDragCount.current - 1);
    if (activeDragCount.current === 0) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, []);

  // Safety net: on unmount, always clear body drag styles
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // ── Docked resize ──
  const dockedDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onDockedResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dockedDragRef.current = { startY: e.clientY, startH: dockedHeight };
    startBodyDrag('row-resize');
  }, [dockedHeight, startBodyDrag]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dockedDragRef.current) return;
      const delta = dockedDragRef.current.startY - e.clientY;
      setDockedHeight(Math.max(MIN_DOCKED_H, Math.min(MAX_DOCKED_H, dockedDragRef.current.startH + delta)));
    };
    const onUp = () => {
      if (dockedDragRef.current) {
        dockedDragRef.current = null;
        endBodyDrag();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [endBodyDrag]);

  // ── Floating drag ──
  const floatDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onFloatDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    e.preventDefault();
    floatDragRef.current = { startX: e.clientX, startY: e.clientY, origX: floatPos.x, origY: floatPos.y };
    startBodyDrag('grabbing');
  }, [floatPos, startBodyDrag]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!floatDragRef.current) return;
      const dx = e.clientX - floatDragRef.current.startX;
      const dy = e.clientY - floatDragRef.current.startY;
      setFloatPos({ x: Math.max(0, floatDragRef.current.origX + dx), y: Math.max(0, floatDragRef.current.origY + dy) });
    };
    const onUp = () => {
      if (floatDragRef.current) {
        floatDragRef.current = null;
        endBodyDrag();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [endBodyDrag]);

  // ── Floating corner resize ──
  const floatResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const onFloatResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    floatResizeRef.current = { startX: e.clientX, startY: e.clientY, origW: floatSize.w, origH: floatSize.h };
    startBodyDrag('nwse-resize');
  }, [floatSize, startBodyDrag]);

  // ── Floating right-edge resize ──
  const floatEdgeRef = useRef<{ startX: number; origW: number } | null>(null);

  const onRightEdgeResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    floatEdgeRef.current = { startX: e.clientX, origW: floatSize.w };
    startBodyDrag('ew-resize');
  }, [floatSize, startBodyDrag]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (floatResizeRef.current) {
        const dx = e.clientX - floatResizeRef.current.startX;
        const dy = e.clientY - floatResizeRef.current.startY;
        setFloatSize({
          w: Math.max(MIN_FLOAT_W, floatResizeRef.current.origW + dx),
          h: Math.max(MIN_FLOAT_H, floatResizeRef.current.origH + dy),
        });
      } else if (floatEdgeRef.current) {
        const dx = e.clientX - floatEdgeRef.current.startX;
        setFloatSize(prev => ({ ...prev, w: Math.max(MIN_FLOAT_W, floatEdgeRef.current!.origW + dx) }));
      }
    };
    const onUp = () => {
      if (floatResizeRef.current || floatEdgeRef.current) {
        floatResizeRef.current = null;
        floatEdgeRef.current = null;
        endBodyDrag();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [endBodyDrag]);

  return {
    mode,
    setMode,
    referenceVisible,
    toggleReference,
    dockedHeight,
    onDockedResizeStart,
    floatPos,
    floatSize,
    onFloatDragStart,
    onFloatResizeStart,
    onRightEdgeResizeStart,
  };
}
