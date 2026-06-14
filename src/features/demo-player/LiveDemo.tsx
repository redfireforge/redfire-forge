/** Live Demo — floating narration panel during live step execution */
import { useState, useEffect, useRef } from 'react';
import type { DemoLesson, DemoProgress, SpeedMultiplier, StepPhase } from './types';
import DemoSpotlight from './DemoSpotlight';

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

export default function LiveDemo({
  lesson,
  stepIndex,
  isPlaying,
  speed,
  stepPhase,
  onNext,
  onPrev,
  onGoToStep: _onGoToStep,
  onTogglePlay,
  onSetSpeed,
  onSkipReading,
  onExit,
}: LiveDemoProps) {
  const step = lesson.steps[stepIndex];
  const [targetFound, setTargetFound] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Retry-based spotlight: poll every 100ms for up to 2s
  useEffect(() => {
    if (!step?.highlight) { setTargetFound(false); return; }

    let attempts = 0;
    const maxAttempts = 20; // 20 × 100ms = 2s

    const poll = () => {
      const el = document.querySelector(step.highlight!);
      if (el && isElementVisible(el)) {
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

      {/* Floating narration panel */}
      <div className="demo-live-panel">
        <div className="demo-live-panel-header">
          <span className="demo-live-lesson-name">{lesson.name}</span>
          <span className="demo-live-step-counter">
            {stepIndex + 1} / {totalSteps}
          </span>
          <span className={`demo-live-mode-badge ${targetFound ? 'live' : 'guide'}`}>
            {targetFound ? '🟢 Live' : '📖 Guide'}
          </span>
        </div>

        <div className="demo-live-progress-bar">
          <div className="demo-live-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="demo-live-panel-body">
          <h4 className="demo-live-step-title">{step.title}</h4>
          <p className="demo-live-step-desc">{step.description}</p>
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
          <div className="demo-live-speed">
            <select
              value={speed}
              onChange={(e) => onSetSpeed(Number(e.target.value) as SpeedMultiplier)}
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
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
