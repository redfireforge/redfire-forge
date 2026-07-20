import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

export interface DefinitionVersionDiffModalProps {
  title: string;
  olderLabel: string;
  newerLabel: string;
  onClose: () => void;
  tabs: Array<{ id: string; label: string; count: number }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
  className?: string;
}

const MIN_W = 520;
const MIN_H = 360;

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const RESIZE_CURSORS: Record<ResizeDir, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function DefinitionVersionDiffModal({
  title,
  olderLabel,
  newerLabel,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  children,
  className = 'test-def-diff',
}: DefinitionVersionDiffModalProps) {
  const [size, setSize] = useState(() => ({
    w: Math.min(640, Math.round(window.innerWidth * 0.55)),
    h: Math.min(420, Math.round(window.innerHeight * 0.55)),
  }));
  const [pos, setPos] = useState(() => {
    const w = Math.min(640, Math.round(window.innerWidth * 0.55));
    const h = Math.min(420, Math.round(window.innerHeight * 0.55));
    return {
      x: Math.max(0, Math.round((window.innerWidth - w) / 2)),
      y: Math.max(0, Math.round((window.innerHeight - h) / 2)),
    };
  });

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<
    { dir: ResizeDir; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null
  >(null);

  const startBodyCursor = useCallback((cursor: string) => {
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';
  }, []);
  const endBodyCursor = useCallback(() => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
      startBodyCursor('grabbing');
    },
    [pos, startBodyCursor],
  );

  const onResizeMouseDown = useCallback(
    (dir: ResizeDir) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        dir,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
        origW: size.w,
        origH: size.h,
      };
      startBodyCursor(RESIZE_CURSORS[dir]);
    },
    [pos, size, startBodyCursor],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPos({
          x: clamp(dragRef.current.origX + dx, 0, Math.max(0, window.innerWidth - 120)),
          y: clamp(dragRef.current.origY + dy, 0, Math.max(0, window.innerHeight - 60)),
        });
      } else if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = e.clientX - r.startX;
        const dy = e.clientY - r.startY;
        let x = r.origX;
        let y = r.origY;
        let w = r.origW;
        let h = r.origH;
        if (r.dir.includes('e')) w = r.origW + dx;
        if (r.dir.includes('s')) h = r.origH + dy;
        if (r.dir.includes('w')) {
          w = r.origW - dx;
          x = r.origX + dx;
        }
        if (r.dir.includes('n')) {
          h = r.origH - dy;
          y = r.origY + dy;
        }
        if (w < MIN_W) {
          if (r.dir.includes('w')) x = r.origX + (r.origW - MIN_W);
          w = MIN_W;
        }
        if (h < MIN_H) {
          if (r.dir.includes('n')) y = r.origY + (r.origH - MIN_H);
          h = MIN_H;
        }
        setSize({ w, h });
        setPos({ x, y });
      }
    };
    const onUp = () => {
      if (dragRef.current || resizeRef.current) {
        dragRef.current = null;
        resizeRef.current = null;
        endBodyCursor();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [endBodyCursor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [onClose]);

  const resizeDirs: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  return (
    <div
      className={`${className}-overlay modal-overlay`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${className}-modal`}
        style={{ position: 'absolute', left: pos.x, top: pos.y, width: size.w, height: size.h }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${className}-header`} onMouseDown={onHeaderMouseDown}>
          <h3>{title}</h3>
          <span className={`${className}-range`}>
            {olderLabel} → {newerLabel}
          </span>
        </div>

        <div className={`${className}-tabs`}>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`${className}-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
              {t.count > 0 && <span className={`${className}-tab-count`}>{t.count}</span>}
            </button>
          ))}
        </div>

        <div className={`${className}-body`}>{children}</div>

        <div className={`${className}-footer`}>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>

        {resizeDirs.map((dir) => (
          <span
            key={dir}
            className={`${className}-resize ${className}-resize-${dir}`}
            onMouseDown={onResizeMouseDown(dir)}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
