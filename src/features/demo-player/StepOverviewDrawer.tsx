/** StepOverviewModal — independent draggable + resizable floating modal showing all lesson steps.
 *  Can be repositioned and resized freely while the demo is running. */
import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { DemoLesson, DemoStep } from './types';
import { renderMarkdown } from './ConceptSlide';

interface Props {
  lesson: DemoLesson;
  currentStepIndex: number;
  /** When omitted the overview is read-only — step items are not clickable. */
  onGoToStep?: (index: number) => void;
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

const MIN_W = 280;
const MAX_W = 720;
const MIN_H = 300;
const MAX_H = 900;

function useResizable(defaultWidth: number, defaultHeight: number) {
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const startRef = useRef({ mx: 0, my: 0, w: defaultWidth, h: defaultHeight });

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { mx: e.clientX, my: e.clientY, w: size.width, h: size.height };

    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(MIN_W, Math.min(MAX_W, startRef.current.w + ev.clientX - startRef.current.mx));
      const newH = Math.max(MIN_H, Math.min(MAX_H, startRef.current.h + ev.clientY - startRef.current.my));
      setSize({ width: newW, height: newH });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [size]);

  return { size, onResizeMouseDown };
}

const OverviewStepItem = memo(function OverviewStepItem({
  step,
  idx,
  currentStepIndex,
  onGoToStep,
  activeItemRef,
}: {
  step: DemoStep;
  idx: number;
  currentStepIndex: number;
  onGoToStep?: (index: number) => void;
  activeItemRef?: (el: HTMLElement | null) => void;
}) {
  const descriptionHtml = useMemo(() => renderMarkdown(step.description), [step.description]);
  const isActive = idx === currentStepIndex;
  const isDone = idx < currentStepIndex;

  const itemContent = (
    <>
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
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      </span>
      {isActive && <span className="demo-overview-modal-current-dot" aria-hidden="true" />}
    </>
  );

  if (onGoToStep) {
    return (
      <button
        ref={isActive ? activeItemRef : undefined}
        className={`demo-overview-modal-item${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
        onClick={() => { onGoToStep(idx); }}
        aria-current={isActive ? 'step' : undefined}
      >
        {itemContent}
      </button>
    );
  }

  return (
    <div
      ref={isActive ? activeItemRef : undefined}
      className={`demo-overview-modal-item demo-overview-modal-item--readonly${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
      aria-current={isActive ? 'step' : undefined}
    >
      {itemContent}
    </div>
  );
});

function StepOverviewDrawer({ lesson, currentStepIndex, onGoToStep, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { dragStyle, onDragMouseDown } = useDraggableModal(modalRef);
  const { size, onResizeMouseDown } = useResizable(360, 500);
  const activeScrollStepRef = useRef(-1);

  const activeItemRef = useCallback((el: HTMLElement | null) => {
    if (!el || activeScrollStepRef.current === currentStepIndex) return;
    activeScrollStepRef.current = currentStepIndex;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [currentStepIndex]);

  // Close on Escape — use capture phase with stopImmediatePropagation so the
  // global demo shortcut handler (useDemoShortcuts) doesn't also exit the demo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  const currentStepNumber = currentStepIndex + 1;
  const totalSteps = lesson.steps.length;
  const progressPct = totalSteps > 0 ? (currentStepNumber / totalSteps) * 100 : 0;

  return (
    <div
      className="demo-overview-modal"
      ref={modalRef}
      style={{ ...dragStyle, width: size.width, height: size.height }}
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
          {currentStepNumber} / {totalSteps}
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
        {lesson.steps.map((step, idx) => (
          <OverviewStepItem
            key={step.id}
            step={step}
            idx={idx}
            currentStepIndex={currentStepIndex}
            onGoToStep={onGoToStep}
            activeItemRef={activeItemRef}
          />
        ))}
      </div>

      {/* ── Footer hint ── */}
      <div className="demo-overview-modal-footer">
        {onGoToStep ? 'Click a step to jump · ' : ''}Drag header to reposition · ✕ or Esc to close
      </div>

      {/* ── Resize handle (bottom-right corner) ── */}
      <div
        className="demo-overview-resize-handle"
        onMouseDown={onResizeMouseDown}
        aria-label="Resize panel"
        title="Drag to resize"
      />
    </div>
  );
}

export default memo(StepOverviewDrawer, (prev, next) => (
  prev.lesson === next.lesson
  && prev.currentStepIndex === next.currentStepIndex
  && prev.onClose === next.onClose
  && prev.onGoToStep === next.onGoToStep
));
