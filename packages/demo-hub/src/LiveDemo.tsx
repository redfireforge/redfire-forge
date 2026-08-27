/** Live Demo — floating narration panel during live step execution */
import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { DemoLesson, StepPhase } from './types';
import DemoSpotlight from './DemoSpotlight';
import DemoTerminal from './DemoTerminal';
import { renderMarkdown } from './ConceptSlide';
import StepOverviewDrawer from './StepOverviewDrawer';
import { useLiveDemoPanelLayout } from './useLiveDemoPanelLayout';
import LessonNotesIcon from './LessonNotesIcon';
import { useLessonNotesContextOptional } from './LessonNotesContext';
import {
  findFirstVisibleElement,
  hasDemoHubTextSelection,
  isElementVisibleInViewport,
  isDemoAutoScrollPaused,
  isSpotlightSuppressedForModal,
  installDemoUserScrollListeners,
  scrollDemoTargetIntoView,
} from './demoSpotlightUtils';

interface LiveDemoProps {
  lesson: DemoLesson;
  stepIndex: number;
  isPlaying: boolean;
  stepPhase: StepPhase;
  /** False while Preparing boot veil is up — keep spotlight off until Studio is revealed. */
  surfaceReady?: boolean;
  onNext: () => void;
  onTogglePlay: () => void;
  onSkipReading: () => void;
  onRestart: () => void;
  onExit: () => void;
  onComplete: () => void;
}

/** Isolated narration body — avoids re-rendering step copy when spotlight poll updates. */
const DemoLiveNarration = memo(function DemoLiveNarration({
  title,
  description,
  diagram,
}: {
  title: string;
  description: string;
  diagram?: string;
}) {
  const descriptionHtml = useMemo(() => renderMarkdown(description), [description]);
  return (
    <div className="demo-live-panel-body">
      <h4 className="demo-live-step-title">{title}</h4>
      <div className="demo-live-step-desc" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
      {diagram && (
        <div
          className="demo-step-diagram demo-step-diagram--live"
          dangerouslySetInnerHTML={{ __html: diagram }}
        />
      )}
    </div>
  );
});

export default function LiveDemo({
  lesson,
  stepIndex,
  isPlaying,
  stepPhase,
  surfaceReady = true,
  onNext,
  onTogglePlay,
  onSkipReading,
  onRestart,
  onExit,
  onComplete,
}: LiveDemoProps) {
  const step = lesson.steps[stepIndex];
  const [targetFound, setTargetFound] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetFoundRef = useRef(false);
  const autoScrolledRef = useRef(false);
  const { panelRef, panelStyle, onDragMouseDown, onResizeMouseDown } = useLiveDemoPanelLayout();
  const closeOverview = useCallback(() => setOverviewOpen(false), []);
  const notesCtx = useLessonNotesContextOptional();
  const notesOpen = notesCtx?.panelTarget?.lessonId === lesson.id && notesCtx.panelOpen;

  useEffect(() => installDemoUserScrollListeners(), []);

  // Continuous spotlight poll: runs for the full lifetime of each step so the ring
  // can appear even when the action navigates to a different page mid-step.
  // Paused while the steps overview is open or the user is copying panel text.
  useEffect(() => {
    if (overviewOpen || !step?.highlight) {
      if (!step?.highlight) {
        targetFoundRef.current = false;
        setTargetFound(false);
      }
      return;
    }

    autoScrolledRef.current = false;

    const poll = () => {
      if (hasDemoHubTextSelection()) return;

      const el = findFirstVisibleElement(step.highlight!);
      const found = !!(el && !isSpotlightSuppressedForModal(el));

      if (found !== targetFoundRef.current) {
        targetFoundRef.current = found;
        setTargetFound(found);
      }

      // Auto-scroll once per step so manual scroll-up in Metadata/Auth is not fought.
      if (
        found
        && el
        && !autoScrolledRef.current
        && !step.skipHighlightScroll
        && !isDemoAutoScrollPaused()
        && !isElementVisibleInViewport(el)
      ) {
        scrollDemoTargetIntoView(el);
        autoScrolledRef.current = true;
      }
    };

    targetFoundRef.current = false;
    setTargetFound(false);
    pollRef.current = setInterval(poll, 500);
    poll();

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [step?.highlight, step?.skipHighlightScroll, stepIndex, overviewOpen]);

  if (!step) return null;

  // Terminal steps (CLI-domain lessons) have no DOM to spotlight — the transcript
  // is pinned, real output, so it's always immediately "available", unlike a DOM
  // target that must be polled for. Feeds the same Live/Guide badge as DOM steps.
  const isTerminalStep = Boolean(step.terminalCommand || step.terminalOutput);
  const stepReady = targetFound || isTerminalStep;

  const totalSteps = lesson.steps.length;
  const progressPct = ((stepIndex + 1) / totalSteps) * 100;
  const isLast = stepIndex >= totalSteps - 1;
  // Next / → only after the step finishes (done). Disabled during Reading so
  // viewers cannot skip the action tour — skip reading via the phase badge,
  // then wait for Acting/Verifying to complete before advancing.
  const canNavigate = stepPhase === 'done';
  const nextDisabledReason = stepPhase === 'reading'
    ? 'Finish reading first — click the Reading badge to skip'
    : 'Please wait — action in progress';
  const nextTitle = 'Next (→)';

  // Phase label for user feedback (pinned above controls — always visible)
  const phaseLabel = stepPhase === 'pre' ? '⏳ Preparing'
    : stepPhase === 'reading' ? '👀 Reading'
    : stepPhase === 'action' ? '⚡ Acting'
    : stepPhase === 'verify' ? '✓ Verifying'
    : null;
  const phaseSkippable = stepPhase === 'reading';

  return (
    <>
      {/* Reading-phase ring only — hide during action/done so in-action spotlights never overlap
          and finished steps don't leave a stale ring on the original target.
          Also wait for boot veil lift so the ring does not float over opacity-0 Studio. */}
      {surfaceReady && targetFound && step.highlight && stepPhase === 'reading' && !overviewOpen && (
        <DemoSpotlight
          key={`${stepIndex}:${step.highlight}`}
          trackKey={`${stepIndex}:${step.highlight}`}
          selector={step.highlight}
          active={true}
          frozen={false}
        />
      )}

      {/* Hidden-mode restore pill — tiny fixed dot so user can always get the panel back */}
      {hidden && (
        <button
          className="demo-live-restore-pill"
          onClick={() => setHidden(false)}
          title="Restore demo panel"
          aria-label="Restore demo panel"
          data-testid="demo-live-restore-pill"
        >
          ▶
        </button>
      )}

      {/* Terminal surface — CLI-domain lessons render a pinned transcript instead of a DOM spotlight. */}
      {surfaceReady && isTerminalStep && !overviewOpen && (
        <DemoTerminal
          command={step.terminalCommand}
          output={step.terminalOutput}
          highlightLines={step.terminalHighlightLines}
        />
      )}

      {/* Steps overview — read-only floating modal, no jump-to-step */}
      {overviewOpen && (
        <StepOverviewDrawer
          lesson={lesson}
          currentStepIndex={stepIndex}
          onClose={closeOverview}
        />
      )}

      {/* Floating narration panel */}
      {!hidden && (
      <div
        className="demo-live-panel demo-live-panel--clickthrough"
        ref={panelRef}
        style={panelStyle}
        data-testid="demo-live-panel"
        data-step-phase={stepPhase}
      >
        <div
          className="demo-live-resize-handle demo-live-resize-handle--top"
          onMouseDown={onResizeMouseDown('top')}
          aria-hidden="true"
          data-testid="demo-live-resize-top"
        />
        <div
          className="demo-live-resize-handle demo-live-resize-handle--left"
          onMouseDown={onResizeMouseDown('left')}
          aria-hidden="true"
          data-testid="demo-live-resize-left"
        />
        <div
          className="demo-live-resize-handle demo-live-resize-handle--right"
          onMouseDown={onResizeMouseDown('right')}
          aria-hidden="true"
          data-testid="demo-live-resize-right"
        />
        <div
          className="demo-live-resize-handle demo-live-resize-handle--bottom"
          onMouseDown={onResizeMouseDown('bottom')}
          aria-hidden="true"
          data-testid="demo-live-resize-bottom"
        />
        <div
          className="demo-live-resize-handle demo-live-resize-handle--corner"
          onMouseDown={onResizeMouseDown('corner')}
          title="Resize panel"
          aria-label="Resize panel"
          data-testid="demo-live-resize-corner"
        />
        <div className="demo-live-panel-header demo-live-panel-header--draggable">
          <span
            className="demo-live-drag-handle"
            onMouseDown={onDragMouseDown}
            title="Drag panel"
            aria-hidden="true"
          >
            ⠿
          </span>
          <span className="demo-live-lesson-name" onMouseDown={(e) => e.stopPropagation()}>{lesson.name}</span>
          <span className="demo-live-step-counter">
            {stepIndex + 1} / {totalSteps}
          </span>
          <span className={`demo-live-mode-badge ${stepReady ? 'live' : 'guide'}`}>
            {stepReady ? '🟢 Live' : '📖 Guide'}
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
          {notesCtx && (
            <span className="demo-live-notes-btn-wrap">
              <LessonNotesIcon
                lessonName={lesson.name}
                hasContent={notesCtx.hasNote(lesson.id)}
                onClick={() => {
                  if (notesOpen) notesCtx.closePanel();
                  else notesCtx.openPanel({ lessonId: lesson.id, lessonName: lesson.name });
                }}
                className={`demo-live-notes-btn${notesOpen ? ' active' : ''}`}
                testId="demo-live-notes-btn"
              />
            </span>
          )}
          <button
            className="demo-live-btn demo-live-hide-btn"
            onClick={() => setHidden(true)}
            title="Hide panel"
            aria-label="Hide demo panel"
            data-testid="demo-live-hide-btn"
          >
            👁
          </button>
        </div>

        <div className="demo-live-progress-bar">
          <div className="demo-live-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <DemoLiveNarration
          title={step.title}
          description={step.description}
          diagram={step.diagram}
        />

        {phaseLabel && (
          <div className="demo-live-panel-status">
            <span
              className={`demo-live-phase-badge${phaseSkippable ? ' skippable' : ''}`}
              onClick={phaseSkippable ? onSkipReading : undefined}
              onKeyDown={phaseSkippable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onSkipReading(); } : undefined}
              role={phaseSkippable ? 'button' : undefined}
              tabIndex={phaseSkippable ? 0 : undefined}
              title={phaseSkippable ? 'Click to skip reading pause' : undefined}
              data-testid="demo-live-phase-badge"
            >
              {phaseLabel}{phaseSkippable ? ' — click to skip' : ''}
            </span>
          </div>
        )}

        <div className="demo-live-panel-controls">
          <button
            className="demo-live-btn demo-live-restart-btn"
            onClick={onRestart}
            title="Restart demo from beginning"
            aria-label="Restart demo"
          >
            ↺
          </button>
          <button
            className="demo-live-btn demo-live-play-btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause auto-play (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause auto-play' : 'Play auto-play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            className="demo-live-btn"
            onClick={onNext}
            disabled={isLast || !canNavigate}
            title={isLast ? 'Last step' : canNavigate ? nextTitle : nextDisabledReason}
            aria-label="Next step"
          >
            →
          </button>
          {isLast && canNavigate && (
            <button
              className="demo-live-btn demo-live-complete-btn"
              onClick={onComplete}
              title="Mark lesson as complete"
              aria-label="Complete lesson"
            >
              ✓ Complete
            </button>
          )}
          <button
            type="button"
            className="demo-live-btn demo-live-exit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
            title="Close (Esc)"
            aria-label="Exit demo"
          >
            ✕
          </button>
        </div>

        <div className="demo-live-keyboard-hints">
          Space play/pause · → next · Esc exit
        </div>
      </div>
      )}
    </>
  );
}
