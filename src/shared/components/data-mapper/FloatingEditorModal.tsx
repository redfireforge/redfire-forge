import { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ValidationCodeEditor from './ValidationCodeEditor';
import type { ParseError } from './utils/validationDsl';

interface FloatingEditorModalProps {
  value: string;
  onChange: (text: string) => void;
  errors: ParseError[];
  samplePaths: string[];
  onClose: () => void;
}

const DEFAULT_WIDTH = 620;
const DEFAULT_HEIGHT = 420;
const MIN_WIDTH = 380;
const MIN_HEIGHT = 260;

export default function FloatingEditorModal({
  value,
  onChange,
  errors,
  samplePaths,
  onClose,
}: FloatingEditorModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => ({
    x: Math.max(40, Math.round((window.innerWidth - DEFAULT_WIDTH) / 2)),
    y: Math.max(40, Math.round((window.innerHeight - DEFAULT_HEIGHT) / 3)),
  }));
  const [size, setSize] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
  const dragState = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeState = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };

    const handleMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      setPos({
        x: Math.max(0, dragState.current.startPosX + dx),
        y: Math.max(0, dragState.current.startPosY + dy),
      });
    };
    const handleUp = () => {
      dragState.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [pos.x, pos.y]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeState.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };

    const handleMove = (ev: MouseEvent) => {
      if (!resizeState.current) return;
      const dx = ev.clientX - resizeState.current.startX;
      const dy = ev.clientY - resizeState.current.startY;
      setSize({
        w: Math.max(MIN_WIDTH, resizeState.current.startW + dx),
        h: Math.max(MIN_HEIGHT, resizeState.current.startH + dy),
      });
    };
    const handleUp = () => {
      resizeState.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [size.w, size.h]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const editorHeight = size.h - 80;

  return createPortal(
    <div
      ref={modalRef}
      className="dm-floating-editor"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <div className="dm-floating-editor-drag" onMouseDown={handleDragStart}>
        <span className="dm-floating-editor-grip">⠿</span>
        <span className="dm-floating-editor-drag-title">Validation Rules</span>
        <button
          className="dm-floating-editor-close"
          onClick={onClose}
          title="Dock back to panel"
          aria-label="Close floating editor"
        >
          ✕
        </button>
      </div>
      <div className="dm-floating-editor-body">
        <ValidationCodeEditor
          value={value}
          onChange={onChange}
          errors={errors}
          samplePaths={samplePaths}
          height={editorHeight}
          isFloating
          onPopIn={onClose}
        />
      </div>
      <div className="dm-floating-editor-resize" onMouseDown={handleResizeStart} />
    </div>,
    document.body,
  );
}
