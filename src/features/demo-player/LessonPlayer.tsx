/** Lesson Player — sidebar navigation + right-panel content view */
import { useState } from 'react';
import type { DemoLesson } from './types';
import ConceptSlide from './ConceptSlide';
import PrerequisiteGate from './components/PrerequisiteGate';
import { renderMarkdown } from './ConceptSlide';

interface LessonPlayerProps {
  lesson: DemoLesson;
  onStartDemo: () => void;
}

type SelectedPanel = 'concept' | number;

export default function LessonPlayer({ lesson, onStartDemo }: LessonPlayerProps) {
  const [gateCleared, setGateCleared] = useState(false);
  const [selected, setSelected] = useState<SelectedPanel>('concept');

  const needsGate = Boolean(lesson.dockerEndpoint);
  const canStart  = !needsGate || gateCleared;

  const selectedStep = typeof selected === 'number' ? lesson.steps[selected] : null;
  const isFirstStep  = selected === 0;
  const isLastStep   = typeof selected === 'number' && selected === lesson.steps.length - 1;

  const startBtn = (
    <button
      className={`demo-start-btn ${needsGate && canStart ? 'demo-start-btn--ready' : ''}`}
      onClick={onStartDemo}
      disabled={!canStart}
      title={!canStart ? 'Start the Docker container first (see above)' : undefined}
    >
      {needsGate && !canStart ? '⏳ Waiting for Docker…' : 'Start Demo →'}
    </button>
  );

  return (
    <div className="demo-lesson-player">
      {/* ── Left sidebar ── */}
      <div className="demo-lesson-player-sidebar">
        <div className="demo-sidebar-section">
          <button
            className={`demo-sidebar-nav-item ${selected === 'concept' ? 'active' : ''}`}
            onClick={() => setSelected('concept')}
          >
            <span className="demo-sidebar-nav-icon">📖</span>
            <span className="demo-sidebar-nav-label">Concept</span>
          </button>

          <div className="demo-sidebar-steps-label">Steps</div>
          {lesson.steps.map((step, idx) => (
            <button
              key={step.id}
              className={`demo-sidebar-nav-item ${selected === idx ? 'active' : ''}`}
              onClick={() => setSelected(idx)}
            >
              <span className="demo-sidebar-step-num">{idx + 1}</span>
              <span className="demo-sidebar-nav-label">{step.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right content panel ── */}
      <div className="demo-lesson-player-content">
        {selected === 'concept' ? (
          <ConceptSlide concept={lesson.concept} />
        ) : selectedStep ? (
          <div className="demo-step-detail">
            <div className="demo-step-detail-header">
              <span className="demo-step-detail-num">Step {(selected as number) + 1}</span>
              <h2 className="demo-step-detail-title">{selectedStep.title}</h2>
            </div>
            <div
              className="demo-step-detail-body"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedStep.description) }}
            />
          </div>
        ) : null}

        {/* Docker prerequisite gate — only relevant when on Concept view */}
        {selected === 'concept' && needsGate && (
          <PrerequisiteGate
            endpoint={lesson.dockerEndpoint!}
            dockerCommand={lesson.dockerCommand ?? `docker compose -f docker/websocket/socketio/docker-compose.yml up`}
            onServerReady={() => setGateCleared(true)}
          />
        )}

        {/* Footer — always visible; step nav on left, Start Demo pinned right */}
        <div className="demo-lesson-player-footer">
          {typeof selected === 'number' ? (
            <div className="demo-step-detail-nav">
              {!isFirstStep && (
                <button
                  className="demo-step-nav-btn"
                  onClick={() => setSelected((selected as number) - 1)}
                >
                  ← Prev
                </button>
              )}
              {!isLastStep && (
                <button
                  className="demo-step-nav-btn"
                  onClick={() => setSelected((selected as number) + 1)}
                >
                  Next →
                </button>
              )}
            </div>
          ) : (
            // Empty left side when on Concept view — keeps Start Demo right-aligned
            <span />
          )}
          {startBtn}
        </div>
      </div>
    </div>
  );
}
