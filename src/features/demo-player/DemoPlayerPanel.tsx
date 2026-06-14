/** Demo Player — floating panel with playback controls */
import type { DemoPlayerState } from './types-v1';
import DemoSpotlight from './DemoSpotlight';

interface DemoPlayerPanelProps {
  state: DemoPlayerState;
  onNext: () => void;
  onPrev: () => void;
  onGoToStep: (index: number) => void;
  onToggleAutoPlay: () => void;
  onSetPlaySpeed: (speed: number) => void;
  onClose: () => void;
  onChangeSuite: () => void;
}

export default function DemoPlayerPanel({
  state,
  onNext,
  onPrev,
  onGoToStep,
  onToggleAutoPlay,
  onSetPlaySpeed,
  onClose,
  onChangeSuite,
}: DemoPlayerPanelProps) {
  if (!state.isOpen || !state.suite) return null;

  const suite = state.suite;
  const step = suite.steps[state.stepIndex];
  const isFirst = state.stepIndex === 0;
  const isLast = state.stepIndex === suite.steps.length - 1;
  const progress = ((state.stepIndex + 1) / suite.steps.length) * 100;

  return (
    <>
      <DemoSpotlight
        selector={step?.highlight}
        active={state.isOpen}
      />

      <div className="demo-player" data-testid="demo-player-panel">
        {/* Header */}
        <div className="demo-player-header">
          <div className="demo-player-title-row">
            <button className="demo-btn demo-btn-icon demo-btn-suite" onClick={onChangeSuite} title="Switch demo">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M1 4h14v1H1zM1 7.5h14v1H1zM1 11h14v1H1z" />
              </svg>
            </button>
            <span className="demo-player-suite-name">{suite.icon} {suite.name}</span>
            <button className="demo-btn demo-btn-icon demo-btn-close" onClick={onClose} title="Close demo">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path d="M8 6.586L12.293 2.293l1.414 1.414L9.414 8l4.293 4.293-1.414 1.414L8 9.414l-4.293 4.293-1.414-1.414L6.586 8 2.293 3.707l1.414-1.414z" />
              </svg>
            </button>
          </div>
          <div className="demo-player-step-counter">
            Step {state.stepIndex + 1} of {suite.steps.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="demo-progress-bar">
          <div className="demo-progress-fill" style={{ width: `${progress}%` }} />
          {/* Step dots */}
          <div className="demo-progress-dots">
            {suite.steps.map((_, i) => (
              <button
                key={i}
                className={`demo-progress-dot ${i === state.stepIndex ? 'active' : ''} ${i < state.stepIndex ? 'done' : ''}`}
                onClick={() => onGoToStep(i)}
                title={suite.steps[i].title}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="demo-player-content">
          <h3 className="demo-step-title">{step?.title}</h3>
          <p className="demo-step-description">{step?.description}</p>
        </div>

        {/* Controls */}
        <div className="demo-player-controls">
          <div className="demo-controls-left">
            <button
              className="demo-btn demo-btn-secondary"
              onClick={onPrev}
              disabled={isFirst}
              title="Previous step"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M10 3L5 8l5 5V3z" />
              </svg>
              Back
            </button>
          </div>

          <div className="demo-controls-center">
            <button
              className={`demo-btn demo-btn-icon demo-autoplay-btn ${state.isPlaying ? 'playing' : ''}`}
              onClick={onToggleAutoPlay}
              title={state.isPlaying ? 'Pause auto-play' : 'Start auto-play'}
            >
              {state.isPlaying ? (
                <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
                  <rect x="4" y="3" width="3" height="10" rx="0.5" />
                  <rect x="9" y="3" width="3" height="10" rx="0.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
                  <path d="M4 2.5v11l9-5.5z" />
                </svg>
              )}
            </button>
            {/* Speed selector */}
            <div className="demo-speed-selector">
              {[2, 3, 5].map(s => (
                <button
                  key={s}
                  className={`demo-speed-btn ${state.playSpeed === s ? 'active' : ''}`}
                  onClick={() => onSetPlaySpeed(s)}
                  title={`${s} seconds per step`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>

          <div className="demo-controls-right">
            <button
              className="demo-btn demo-btn-primary"
              onClick={isLast ? onClose : onNext}
              title={isLast ? 'Finish demo' : 'Next step'}
            >
              {isLast ? 'Finish' : 'Next'}
              {!isLast && (
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                  <path d="M6 3l5 5-5 5V3z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="demo-keyboard-hints">
          <kbd>←</kbd> <kbd>→</kbd> navigate · <kbd>Space</kbd> auto-play · <kbd>Esc</kbd> close
        </div>
      </div>
    </>
  );
}
