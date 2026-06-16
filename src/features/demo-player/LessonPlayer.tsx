/** Lesson Player — concept slide view with lesson overview */
import { useState } from 'react';
import type { DemoLesson } from './types';
import ConceptSlide from './ConceptSlide';
import PrerequisiteGate from './components/PrerequisiteGate';
import { renderMarkdown } from './ConceptSlide';

interface LessonPlayerProps {
  lesson: DemoLesson;
  onStartDemo: () => void;
}

export default function LessonPlayer({ lesson, onStartDemo }: LessonPlayerProps) {
  // When a docker prerequisite is met via the gate, allow the footer button too
  const [gateCleared, setGateCleared] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const needsGate = Boolean(lesson.dockerEndpoint);
  const canStart  = !needsGate || gateCleared;

  return (
    <div className="demo-lesson-player">
      <div className="demo-lesson-player-sidebar">
        <div className="demo-sidebar-section">
          <div className="demo-sidebar-item active">📖 Concept</div>
          {lesson.steps.map((step, idx) => {
            const isExpanded = expandedStep === idx;
            return (
              <div key={step.id} className={`demo-sidebar-item demo-sidebar-item--expandable${isExpanded ? ' expanded' : ''}`}>
                <button
                  className="demo-sidebar-step-header"
                  onClick={() => setExpandedStep(isExpanded ? null : idx)}
                  aria-expanded={isExpanded}
                >
                  <span className="demo-sidebar-step-num">{idx + 1}</span>
                  <span className="demo-sidebar-step-title">{step.title}</span>
                  <svg
                    className="demo-sidebar-step-chevron"
                    viewBox="0 0 10 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="1,1 5,5 9,1"/>
                  </svg>
                </button>
                {isExpanded && (
                  <div
                    className="demo-sidebar-step-desc"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(step.description) }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="demo-lesson-player-content">
        <ConceptSlide concept={lesson.concept} />

        {needsGate && (
          <PrerequisiteGate
            endpoint={lesson.dockerEndpoint!}
            dockerCommand={lesson.dockerCommand ?? `docker compose -f docker/websocket/socketio/docker-compose.yml up`}
            onServerReady={() => setGateCleared(true)}
          />
        )}

        <div className="demo-lesson-player-footer">
          <button
            className={`demo-start-btn ${needsGate && canStart ? 'demo-start-btn--ready' : ''}`}
            onClick={onStartDemo}
            disabled={!canStart}
            title={!canStart ? 'Start the Docker container first (see above)' : undefined}
          >
            {needsGate && !canStart ? '⏳ Waiting for Docker…' : 'Start Demo →'}
          </button>
        </div>
      </div>
    </div>
  );
}
