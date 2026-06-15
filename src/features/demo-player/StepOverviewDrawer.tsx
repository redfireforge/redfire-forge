/** StepOverviewModal — independent draggable floating modal showing all lesson steps.
 *  Can be repositioned freely while the demo is running. */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { DemoLesson } from './types';
import { renderMarkdown } from './ConceptSlide';

interface Props {
  lesson: DemoLesson;
  currentStepIndex: number;
  onGoToStep: (index: number) => void;
  onClose: () => void;
}

function useDraggableModal(ref: React.RefObject<HTMLDivElement | null>) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const dragging = useRef(false);
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragging.current = true;
    origin.current = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - origin.current.mx;
      const dy = ev.clientY - origin.current.my;
      const newLeft = Math.max(0, Math.min(window.innerWidth - rect.width, origin.current.px + dx));
      const newTop  = Math.max(0, Math.min(window.innerHeight - rect.height, origin.current.py + dy));
      setPos({ top: newTop, left: newLeft });
    };

    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [ref]);

  const style: React.CSSProperties = pos
    ? { top: pos.top, left: pos.left, bottom: 'auto', right: 'auto' }
    : {};

  return { dragStyle: style, onDragMouseDown: onMouseDown };
}

export default function StepOverviewDrawer({ lesson, currentStepIndex, onGoToStep, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const { dragStyle, onDragMouseDown } = useDraggableModal(modalRef);

  // Scroll current step into view on open
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const completedCount = currentStepIndex;
  const totalSteps = lesson.steps.length;
  const progressPct = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  return (
    <div
      className="demo-overview-modal"
      ref={modalRef}
      style={dragStyle}
      role="dialog"
      aria-label="All steps overview"
      aria-modal="false"
    >
      {/* ── Header (drag handle) ── */}
      <div
        className="demo-overview-modal-header demo-overview-modal-header--draggable"
        onMouseDown={onDragMouseDown}
      >
        <span className="demo-overview-drag-handle" aria-hidden="true">⠿</span>
        <span className="demo-overview-modal-title">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="4" x2="14" y2="4"/>
            <line x1="2" y1="8" x2="14" y2="8"/>
            <line x1="2" y1="12" x2="14" y2="12"/>
          </svg>
          {lesson.name}
        </span>
        <span className="demo-overview-modal-counter">
          {completedCount} / {totalSteps}
        </span>
        <button
          className="demo-overview-modal-close"
          onClick={onClose}
          aria-label="Close steps overview"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div className="demo-overview-modal-progress-bar">
        <div className="demo-overview-modal-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ── Step list ── */}
      <div className="demo-overview-modal-list">
        {lesson.steps.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          const isDone   = idx < currentStepIndex;

          return (
            <button
              key={step.id}
              ref={isActive ? activeItemRef : undefined}
              className={`demo-overview-modal-item${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
              onClick={() => { onGoToStep(idx); }}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="demo-overview-modal-item-num">
                {isDone
                  ? (
                    <svg
                      className="demo-overview-check"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="2,6 5,9 10,3"/>
                    </svg>
                  )
                  : <span>{idx + 1}</span>
                }
              </span>
              <span className="demo-overview-modal-item-body">
                <span className="demo-overview-modal-item-title">{step.title}</span>
                <span
                  className="demo-overview-modal-item-desc"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(step.description) }}
                />
              </span>
              {isActive && <span className="demo-overview-modal-current-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* ── Footer hint ── */}
      <div className="demo-overview-modal-footer">
        Click any step to jump · Drag to reposition · Esc to close
      </div>
    </div>
  );
}
