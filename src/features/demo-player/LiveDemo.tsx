/** Live Demo — floating narration panel during live step execution */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { DemoLesson, DemoProgress, SpeedMultiplier, StepPhase } from './types';
import DemoSpotlight from './DemoSpotlight';
import { renderMarkdown } from './ConceptSlide';
import StepOverviewDrawer from './StepOverviewDrawer';

interface LiveDemoProps {
  lesson: DemoLesson;
  stepIndex: number;
  isPlaying: boolean;
  speed: SpeedMultiplier;
  progress: DemoProgress;
  stepPhase: StepPhase;
  onNext: () => void;
  onPrev: () => void;
  onGoToStep: (index: number) => void;
  onTogglePlay: () => void;
  onSetSpeed: (speed: SpeedMultiplier) => void;
  onSkipReading: () => void;
  onExit: () => void;
}

/** Returns inline style + drag handlers to make an element freely draggable.
 *  The element must have `position: fixed`. Pass `onMouseDown` to the handle. */
function useDraggable(panelRef: React.RefObject<HTMLDivElement | null>) {
  // null = use CSS bottom/right defaults; once dragged, switch to top/left
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const dragging = useRef(false);
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Ignore clicks on buttons inside the header
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
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
  }, [panelRef]);

  const style: React.CSSProperties = pos
    ? { top: pos.top, left: pos.left, bottom: 'auto', right: 'auto' }
    : {};

  return { style, onMouseDown };
}

export default function LiveDemo({
  lesson,
  stepIndex,
  isPlaying,
  speed,
  stepPhase,
  onNext,
  onPrev,
  onGoToStep,
  onTogglePlay,
  onSetSpeed,
  onSkipReading,
  onExit,
}: LiveDemoProps) {
  const step = lesson.steps[stepIndex];
  const [targetFound, setTargetFound] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { style: dragStyle, onMouseDown: onDragMouseDown } = useDraggable(panelRef);

  // Retry-based spotlight: poll every 100ms for up to 2s
  useEffect(() => {
    if (!step?.highlight) { setTargetFound(false); return; }

    let attempts = 0;
    const maxAttempts = 20; // 20 × 100ms = 2s

    const poll = () => {
      // When multiple tabs render the same testid, find the first VISIBLE match
      // (e.g. left-tab-auth exists once per connection tab; inactive tabs have 0×0 size)
      const all = document.querySelectorAll(step.highlight!);
      const el = all.length > 0
        ? Array.from(all).find(e => isElementVisible(e)) ?? null
        : null;
      if (el) {
        setTargetFound(true);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      } else if (++attempts >= maxAttempts) {
        setTargetFound(false);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    };

    // Reset and start polling
    setTargetFound(false);
    pollRef.current = setInterval(poll, 100);
    poll(); // immediate first check

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [step?.highlight, stepIndex]);

  if (!step) return null;

  const totalSteps = lesson.steps.length;
  const progressPct = ((stepIndex + 1) / totalSteps) * 100;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= totalSteps - 1;

  // Phase label for user feedback
  const phaseLabel = stepPhase === 'reading' ? '👀 Reading'
    : stepPhase === 'action' ? '⚡ Acting'
    : stepPhase === 'verify' ? '✓ Verifying'
    : null;

  return (
    <>
      {/* Spotlight ring on target element */}
      {targetFound && step.highlight && (
        <DemoSpotlight selector={step.highlight} active={true} />
      )}

      {/* Steps overview — independent draggable modal */}
      {overviewOpen && (
        <StepOverviewDrawer
          lesson={lesson}
          currentStepIndex={stepIndex}
          onGoToStep={onGoToStep}
          onClose={() => setOverviewOpen(false)}
        />
      )}

      {/* Floating narration panel */}
      <div className="demo-live-panel" ref={panelRef} style={dragStyle}>
        <div className="demo-live-panel-header demo-live-panel-header--draggable" onMouseDown={onDragMouseDown}>
          <span className="demo-live-drag-handle" aria-hidden="true">⠿</span>
          <span className="demo-live-lesson-name">{lesson.name}</span>
          <span className="demo-live-step-counter">
            {stepIndex + 1} / {totalSteps}
          </span>
          <span className={`demo-live-mode-badge ${targetFound ? 'live' : 'guide'}`}>
            {targetFound ? '🟢 Live' : '📖 Guide'}
          </span>
          <button
            className={`demo-live-overview-btn${overviewOpen ? ' active' : ''}`}
            onClick={() => setOverviewOpen(o => !o)}
            title="View all steps"
            aria-label="Toggle steps overview"
            aria-expanded={overviewOpen}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="4" x2="14" y2="4"/>
              <line x1="2" y1="8" x2="14" y2="8"/>
              <line x1="2" y1="12" x2="14" y2="12"/>
            </svg>
          </button>
        </div>

        <div className="demo-live-progress-bar">
          <div className="demo-live-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="demo-live-panel-body">
          <h4 className="demo-live-step-title">{step.title}</h4>
          <p className="demo-live-step-desc" dangerouslySetInnerHTML={{ __html: renderMarkdown(step.description) }} />
          {phaseLabel && (
            <span
              className={`demo-live-phase-badge${stepPhase === 'reading' ? ' skippable' : ''}`}
              onClick={stepPhase === 'reading' ? onSkipReading : undefined}
              title={stepPhase === 'reading' ? 'Click to skip reading pause' : undefined}
            >
              {phaseLabel}{stepPhase === 'reading' ? ' — click to skip' : ''}
            </span>
          )}
        </div>

        <div className="demo-live-panel-controls">
          <button
            className="demo-live-btn"
            onClick={onPrev}
            disabled={isFirst}
            title="Previous (←)"
          >
            ◀
          </button>
          <button
            className="demo-live-btn demo-live-play-btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <div className="demo-live-speed" role="group" aria-label="Playback speed">
            {([0.5, 1, 1.5, 2] as SpeedMultiplier[]).map(s => (
              <button
                key={s}
                className={`demo-live-speed-btn${speed === s ? ' active' : ''}`}
                onClick={() => onSetSpeed(s)}
                aria-label={`${s}× speed`}
                aria-pressed={speed === s}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            className="demo-live-btn"
            onClick={onNext}
            disabled={isLast}
            title="Next (→)"
          >
            ▶
          </button>
          <button
            className="demo-live-btn demo-live-exit-btn"
            onClick={onExit}
            title="Exit (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="demo-live-keyboard-hints">
          ← → navigate · Space play/pause · Esc exit
        </div>
      </div>
    </>
  );
}

function isElementVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}
