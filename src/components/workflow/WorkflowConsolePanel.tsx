import { useState, useEffect, useRef, useCallback } from 'react';
import type { ConsoleLine } from '../../hooks/useResponseCache';

const prefixClass: Record<string, string> = {
  '*': 'wf-cl-info',
  '>': 'wf-cl-out',
  '<': 'wf-cl-in',
  '#': 'wf-cl-extract',
  '!': 'wf-cl-error',
  '': 'wf-cl-plain',
};

const prefixIcon: Record<string, string> = {
  '*': '●',
  '>': '→',
  '<': '←',
  '#': '⬡',
  '!': '✗',
  '': '',
};

function fmtTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions);
}

type PanelMode = 'docked' | 'maximized' | 'floating';

const MIN_DOCKED_H = 80;
const MAX_DOCKED_H = 600;
const DEFAULT_DOCKED_H = 200;
const MIN_FLOAT_W = 320;
const MIN_FLOAT_H = 180;

interface Props {
  lines: ConsoleLine[];
  onClear: () => void;
  onClose: () => void;
}

export default function WorkflowConsolePanel({ lines, onClear, onClose }: Props) {
  const [mode, setMode] = useState<PanelMode>('docked');
  const [dockedHeight, setDockedHeight] = useState(DEFAULT_DOCKED_H);

  // ── Floating state ──
  const [floatPos, setFloatPos] = useState({ x: 80, y: 80 });
  const [floatSize, setFloatSize] = useState({ w: 600, h: 340 });

  // ── Auto-scroll ──
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (autoScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [lines.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    autoScrollRef.current = atBottom;
  };

  // ── Docked resize (drag top edge) ──
  const dockedDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onDockedResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dockedDragRef.current = { startY: e.clientY, startH: dockedHeight };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [dockedHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dockedDragRef.current) return;
      const delta = dockedDragRef.current.startY - e.clientY;
      setDockedHeight(Math.max(MIN_DOCKED_H, Math.min(MAX_DOCKED_H, dockedDragRef.current.startH + delta)));
    };
    const onUp = () => {
      if (dockedDragRef.current) {
        dockedDragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Floating drag (title bar) ──
  const floatDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onFloatDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    floatDragRef.current = { startX: e.clientX, startY: e.clientY, origX: floatPos.x, origY: floatPos.y };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, [floatPos]);

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
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Floating resize (bottom-right corner) ──
  const floatResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const onFloatResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    floatResizeRef.current = { startX: e.clientX, startY: e.clientY, origW: floatSize.w, origH: floatSize.h };
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  }, [floatSize]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!floatResizeRef.current) return;
      const dx = e.clientX - floatResizeRef.current.startX;
      const dy = e.clientY - floatResizeRef.current.startY;
      setFloatSize({
        w: Math.max(MIN_FLOAT_W, floatResizeRef.current.origW + dx),
        h: Math.max(MIN_FLOAT_H, floatResizeRef.current.origH + dy),
      });
    };
    const onUp = () => {
      if (floatResizeRef.current) {
        floatResizeRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Mode actions ──
  const toggleMaximize = () => setMode(prev => prev === 'maximized' ? 'docked' : 'maximized');
  const toggleFloat = () => setMode(prev => prev === 'floating' ? 'docked' : 'floating');

  const rootClass = `wf-console-panel wf-console-${mode}`;
  const rootStyle: React.CSSProperties =
    mode === 'docked' ? { height: dockedHeight } :
    mode === 'floating' ? { left: floatPos.x, top: floatPos.y, width: floatSize.w, height: floatSize.h } :
    {};

  return (
    <div className={rootClass} style={rootStyle}>
      {mode === 'docked' && (
        <div className="wf-console-resize-handle" onMouseDown={onDockedResizeStart} />
      )}

      <div
        className="wf-console-header"
        onMouseDown={mode === 'floating' ? onFloatDragStart : undefined}
        style={mode === 'floating' ? { cursor: 'grab' } : undefined}
      >
        <span className="wf-console-title">Console</span>
        <span className="wf-console-count">{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
        <div className="wf-console-actions">
          <button type="button" className="wf-console-action-btn" onClick={onClear} title="Clear console">
            Clear
          </button>
          <span className="wf-console-actions-sep" />
          <button
            type="button"
            className="wf-console-action-btn"
            onClick={toggleFloat}
            title={mode === 'floating' ? 'Dock panel' : 'Pop out to floating window'}
          >
            {mode === 'floating' ? '⬓' : '⧉'}
          </button>
          <button
            type="button"
            className="wf-console-action-btn"
            onClick={toggleMaximize}
            title={mode === 'maximized' ? 'Restore panel size' : 'Maximize panel'}
          >
            {mode === 'maximized' ? '⬒' : '⬜'}
          </button>
          <button type="button" className="wf-console-action-btn" onClick={onClose} title="Close console">
            ✕
          </button>
        </div>
      </div>
      <div className="wf-console-body" ref={containerRef} onScroll={handleScroll}>
        {lines.length === 0 ? (
          <div className="wf-console-empty">Run a Quick Test to see activity logs</div>
        ) : (
          lines.map((line, i) => {
            const cls = prefixClass[line.prefix] ?? 'wf-cl-plain';
            const icon = prefixIcon[line.prefix] ?? '';
            const time = fmtTime(line.ts);
            return (
              <div key={i} className={`wf-cl-line ${cls}`}>
                {time && <span className="wf-cl-ts">{time}</span>}
                {icon && <span className="wf-cl-icon">{icon}</span>}
                <span className="wf-cl-text">{line.text}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {mode === 'floating' && (
        <div className="wf-console-float-grip" onMouseDown={onFloatResizeStart} />
      )}
    </div>
  );
}
