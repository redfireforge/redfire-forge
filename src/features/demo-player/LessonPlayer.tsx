/** Lesson Player — concept slide view with lesson overview */
import { useState } from 'react';
import type { DemoLesson, SpeedMultiplier } from './types';
import ConceptSlide from './ConceptSlide';
import PrerequisiteGate from './components/PrerequisiteGate';

interface LessonPlayerProps {
  lesson: DemoLesson;
  speed: SpeedMultiplier;
  onStartDemo: () => void;
  onSetSpeed: (speed: SpeedMultiplier) => void;
  onBack: () => void;
}

export default function LessonPlayer({ lesson, speed, onStartDemo, onSetSpeed, onBack: _onBack }: LessonPlayerProps) {
  // When a docker prerequisite is met via the gate, allow the footer button too
  const [gateCleared, setGateCleared] = useState(false);

  const needsGate = Boolean(lesson.dockerEndpoint);
  const canStart  = !needsGate || gateCleared;

  return (
    <div className="demo-lesson-player">
      <div className="demo-lesson-player-sidebar">
        <div className="demo-sidebar-section">
          <div className="demo-sidebar-item active">📖 Concept</div>
          {lesson.steps.map((step, idx) => (
            <div key={step.id} className="demo-sidebar-item">
              {idx + 1}. {step.title}
            </div>
          ))}
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
          <div className="demo-speed-selector">
            {([0.5, 1, 1.5, 2] as SpeedMultiplier[]).map(s => (
              <button
                key={s}
                className={`demo-speed-btn ${speed === s ? 'active' : ''}`}
                onClick={() => onSetSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
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
