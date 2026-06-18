/** Lesson List — shows lessons within a domain with optional category tabs */
import { useState } from 'react';
import type { DemoDomain, DemoLesson, DemoProgress } from './types';

interface LessonListProps {
  domain: DemoDomain;
  progress: DemoProgress;
  onSelect: (lesson: DemoLesson) => void;
  onBack: () => void;
  onResetLesson: (lessonId: string) => void;
  onResetAll: () => void;
}

export default function LessonList({ domain, progress, onSelect, onBack, onResetLesson, onResetAll }: LessonListProps) {
  const hasCategories = domain.categories && domain.categories.length > 0;
  const [activeCategory, setActiveCategory] = useState<string | null>(() => {
    if (!hasCategories) return null;
    const firstWithLessons = domain.categories!.find(c =>
      domain.lessons.some(l => l.category === c.id),
    );
    return firstWithLessons?.id ?? domain.categories![0].id;
  });

  /** Lesson id that is pending single-lesson reset confirmation */
  const [pendingResetId, setPendingResetId] = useState<string | null>(null);
  /** Whether the "reset all" confirmation is showing */
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const visibleLessons = activeCategory
    ? domain.lessons.filter(l => l.category === activeCategory)
    : domain.lessons;

  const activeMeta = hasCategories
    ? domain.categories!.find(c => c.id === activeCategory)
    : null;

  const anyCompleted = domain.lessons.some(l =>
    progress.completedLessons.includes(l.id),
  );

  const handleResetLesson = (lessonId: string) => {
    onResetLesson(lessonId);
    setPendingResetId(null);
  };

  const handleResetAll = () => {
    onResetAll();
    setConfirmResetAll(false);
  };

  return (
    <div className="demo-lesson-list">
      <p className="demo-hub-subtitle">{domain.description}</p>

      {/* Category filter tabs */}
      {hasCategories && (
        <div className="demo-category-tabs">
          {domain.categories!.map(cat => {
            const catLessons = domain.lessons.filter(l => l.category === cat.id);
            const completedCount = catLessons.filter(l =>
              progress.completedLessons.includes(l.id),
            ).length;
            const isActive = activeCategory === cat.id;
            const isEmpty = catLessons.length === 0;

            return (
              <button
                key={cat.id}
                className={`demo-category-tab ${isActive ? 'active' : ''} ${isEmpty ? 'empty' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
                disabled={isEmpty}
                title={isEmpty ? `${cat.label} — coming soon` : undefined}
              >
                <span className="demo-category-icon">{cat.icon}</span>
                <span className="demo-category-label">{cat.label}</span>
                {catLessons.length > 0 && (
                  <span className="demo-category-count">
                    {completedCount}/{catLessons.length}
                  </span>
                )}
                {isEmpty && (
                  <span className="demo-category-soon">soon</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Lessons for active category */}
      <div className="demo-lesson-items">
        {visibleLessons.length === 0 && activeMeta && (
          <div className="demo-category-empty">
            No {activeMeta.label} lessons yet — coming soon.
          </div>
        )}
        {visibleLessons.map((lesson, idx) => {
          const isComplete = progress.completedLessons.includes(lesson.id);
          const lastStep = progress.lessonSteps[lesson.id];
          const hasProgress = lastStep !== undefined && lastStep > 0 && !isComplete;
          const isPendingReset = pendingResetId === lesson.id;

          return (
            <div
              key={lesson.id}
              className={`demo-lesson-row ${isComplete ? 'completed' : ''}`}
            >
              <button
                className={`demo-lesson-item ${isComplete ? 'completed' : ''}`}
                onClick={() => {
                  if (isPendingReset) return;
                  onSelect(lesson);
                }}
              >
                <span className={`demo-lesson-status ${isComplete ? 'completed' : ''}`}>
                  <span className="demo-lesson-number">{idx + 1}</span>
                  {isComplete && <span className="demo-lesson-check" aria-label="Completed">✓</span>}
                </span>
                <div className="demo-lesson-info">
                  <span className="demo-lesson-name">
                    {lesson.name}
                    {lesson.tag && (
                      <span className="demo-lesson-tag">{lesson.tag}</span>
                    )}
                  </span>
                  <span className="demo-lesson-desc">{lesson.description}</span>
                </div>
                <div className="demo-lesson-meta">
                  <span className="demo-lesson-time">~{lesson.estimatedMinutes} min</span>
                  {hasProgress && (
                    <span className="demo-lesson-resume-badge">Resume</span>
                  )}
                  {!hasProgress && !isComplete && (
                    <span className="demo-lesson-start-badge">Start</span>
                  )}
                  {isComplete && !isPendingReset && (
                    <span className="demo-lesson-restart-badge">Restart</span>
                  )}
                </div>
              </button>

              {/* Per-lesson reset controls — only for completed lessons */}
              {isComplete && (
                <div className="demo-lesson-reset-zone">
                  {isPendingReset ? (
                    <div className="demo-lesson-reset-confirm" data-testid={`reset-confirm-${lesson.id}`}>
                      <span className="demo-lesson-reset-confirm-label">Reset progress?</span>
                      <button
                        className="demo-lesson-reset-yes"
                        onClick={() => handleResetLesson(lesson.id)}
                        aria-label={`Confirm reset for ${lesson.name}`}
                      >
                        ↺ Yes
                      </button>
                      <button
                        className="demo-lesson-reset-no"
                        onClick={() => setPendingResetId(null)}
                        aria-label="Cancel reset"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className="demo-lesson-reset-btn"
                      onClick={(e) => { e.stopPropagation(); setPendingResetId(lesson.id); }}
                      title="Reset completion for this lesson"
                      aria-label={`Reset progress for ${lesson.name}`}
                      data-testid={`reset-lesson-${lesson.id}`}
                    >
                      ↺
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: global reset + back */}
      <div className="demo-lesson-list-footer">
        {anyCompleted && (
          confirmResetAll ? (
            <div className="demo-reset-all-confirm" data-testid="reset-all-confirm">
              <span className="demo-reset-all-confirm-label">Reset all progress?</span>
              <button
                className="demo-reset-all-yes"
                onClick={handleResetAll}
                data-testid="reset-all-yes"
              >
                ↺ Reset all
              </button>
              <button
                className="demo-reset-all-no"
                onClick={() => setConfirmResetAll(false)}
                data-testid="reset-all-no"
              >
                ✕ Cancel
              </button>
            </div>
          ) : (
            <button
              className="demo-reset-all-btn"
              onClick={() => setConfirmResetAll(true)}
              data-testid="reset-all-btn"
            >
              ↺ Reset all progress
            </button>
          )
        )}
        <button className="demo-back-btn" onClick={onBack}>
          ← Back to all domains
        </button>
      </div>
    </div>
  );
}
