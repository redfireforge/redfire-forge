/** Lesson Player — concept slide view with lesson overview */
import type { DemoLesson, SpeedMultiplier } from './types';
import ConceptSlide from './ConceptSlide';

interface LessonPlayerProps {
  lesson: DemoLesson;
  speed: SpeedMultiplier;
  onStartDemo: () => void;
  onSetSpeed: (speed: SpeedMultiplier) => void;
  onBack: () => void;
}

export default function LessonPlayer({ lesson, speed, onStartDemo, onSetSpeed, onBack: _onBack }: LessonPlayerProps) {
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
          <button className="demo-start-btn" onClick={onStartDemo}>
            Start Demo →
          </button>
        </div>
      </div>
    </div>
  );
}
