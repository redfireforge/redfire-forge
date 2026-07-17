/** Lesson List — shows lessons within a domain with optional category tabs */
import { useState, useEffect, type KeyboardEvent } from 'react';
import type { DemoDomain, DemoLesson, DemoProgress } from './types';
import { isLessonDesktopOnlyBlocked } from './utils/lessonPlatform';
import LessonNotesIcon from './LessonNotesIcon';
import { useLessonNotesContext } from './LessonNotesContext';

function hasActiveTextSelection(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && selection.toString().length > 0);
}

interface LessonListProps {
  domain: DemoDomain;
  progress: DemoProgress;
  onSelect: (lesson: DemoLesson) => void;
  onBack: () => void;
  onResetLesson: (lessonId: string) => void;
  onResetAll: () => void;
  /** When navigating back from a lesson, pre-select this category so the
   *  user lands on the tab that contains the lesson they came from. */
  initialCategory?: string;
  /** Called whenever the user clicks a category tab — used to persist the
   *  active tab so a hard refresh restores the correct protocol tab. */
  onCategoryChange?: (categoryId: string) => void;
}

export default function LessonList({ domain, progress, onSelect, onBack, onResetLesson, onResetAll, initialCategory, onCategoryChange }: LessonListProps) {
  const { hasNote, openPanel } = useLessonNotesContext();
  const hasCategories = domain.categories && domain.categories.length > 0;
  const [activeCategory, setActiveCategory] = useState<string | null>(() => {
    if (!hasCategories) return null;
    // Prefer the category of the lesson the user navigated back from
    if (initialCategory && domain.categories!.some(c => c.id === initialCategory)) {
      return initialCategory;
    }
    const firstWithLessons = domain.categories!.find(c =>
      domain.lessons.some(l => l.category === c.id),
    );
    return firstWithLessons?.id ?? domain.categories![0].id;
  });

  // Keep activeCategory in sync when navigating back from a lesson.
  // LessonList is unmounted while in concept/live view and remounts on back-navigation,
  // so useState runs fresh — but if the prop changes while mounted (e.g. progress update),
  // this effect ensures the tab follows the lesson the user came from.
  useEffect(() => {
    if (!hasCategories) return;
    if (initialCategory && domain.categories!.some(c => c.id === initialCategory)) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory, domain, hasCategories]);

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
    progress.completedLessons.includes(l.id) ||
    progress.lessonSteps[l.id] !== undefined,
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

      {/* Category filter tabs */}
      {hasCategories && (
        <div className="demo-category-tabs">
          {domain.categories!.map(cat => {
            const catLessons = domain.lessons.filter(l => l.category === cat.id);
            const completedCount = catLessons.filter(l =>
              progress.completedLessons.includes(l.id),
            ).length;
            const needsDocker = catLessons.some(
              (l) => Boolean(l.dockerEndpoint) || Boolean(l.dockerEndpoints?.length),
            );
            const isActive = activeCategory === cat.id;
            const isEmpty = catLessons.length === 0;

            return (
              <button
                key={cat.id}
                className={`demo-category-tab ${isActive ? 'active' : ''} ${isEmpty ? 'empty' : ''}`}
                onClick={() => {
                  setActiveCategory(cat.id);
                  onCategoryChange?.(cat.id);
                }}
                disabled={isEmpty}
                title={isEmpty ? `${cat.label} — coming soon` : undefined}
              >
                <span className="demo-category-icon-wrap">
                  <span className="demo-category-icon">{cat.icon}</span>
                  {needsDocker && (
                    <span
                      className="demo-category-docker-badge"
                      aria-label={`${cat.label} lessons require Docker`}
                      title="Some lessons require Docker"
                    >
                      🐳
                    </span>
                  )}
                </span>
                <span className="demo-category-label">{cat.label}</span>
                {catLessons.length > 0 && (
                  <span className={`demo-category-count${completedCount === catLessons.length ? ' all-done' : ''}`}>
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
          const isInProgress = lastStep !== undefined && !isComplete;
          const isPendingReset = pendingResetId === lesson.id;
          const desktopBlocked = isLessonDesktopOnlyBlocked(lesson);

          const statusClass = isComplete ? 'completed' : isInProgress ? 'in-progress' : '';

          const openLesson = () => {
            if (isPendingReset || desktopBlocked) return;
            onSelect(lesson);
          };

          const handleLessonKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
            if (isPendingReset || desktopBlocked) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openLesson();
            }
          };

          return (
            <div
              key={lesson.id}
              className={`demo-lesson-row ${statusClass}${desktopBlocked ? ' demo-lesson-row--desktop-blocked' : ''}`}
            >
              <div
                role="button"
                tabIndex={desktopBlocked || isPendingReset ? -1 : 0}
                className={`demo-lesson-item ${statusClass}${desktopBlocked ? ' demo-lesson-item--desktop-blocked' : ''}`}
                onClick={() => {
                  if (hasActiveTextSelection()) return;
                  openLesson();
                }}
                onKeyDown={handleLessonKeyDown}
                aria-disabled={desktopBlocked || isPendingReset ? true : undefined}
                title={desktopBlocked ? 'Desktop app required — open RedfireForge on desktop to run this demo' : undefined}
              >
                <span className={`demo-lesson-status ${statusClass}`}>
                  <span className="demo-lesson-number">{idx + 1}</span>
                  {isComplete && <span className="demo-lesson-check" aria-label="Completed">✓</span>}
                  {isInProgress && <span className="demo-lesson-progress-dot" aria-label="In progress">▶</span>}
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
                  {desktopBlocked ? (
                    <span className="demo-lesson-desktop-badge" aria-label="Desktop app required">
                      Desktop only
                    </span>
                  ) : isInProgress ? (
                    <span className="demo-lesson-resume-badge">Resume</span>
                  ) : !isComplete ? (
                    <span className="demo-lesson-start-badge">Start</span>
                  ) : !isPendingReset ? (
                    <span className="demo-lesson-restart-badge">Restart</span>
                  ) : null}
                </div>
              </div>

              <div
                className={`demo-lesson-row-actions${isPendingReset ? ' demo-lesson-row-actions--reset-pending' : ''}`}
              >
                <div className="demo-lesson-row-actions-slot demo-lesson-row-actions-slot--notes">
                  <LessonNotesIcon
                    lessonName={lesson.name}
                    hasContent={hasNote(lesson.id)}
                    onClick={() => openPanel({ lessonId: lesson.id, lessonName: lesson.name })}
                    testId={`demo-lesson-note-btn-${lesson.id}`}
                    compact
                  />
                </div>
                <div className="demo-lesson-row-actions-slot demo-lesson-row-actions-slot--reset">
                  {(isComplete || isInProgress) && (
                    isPendingReset ? (
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
                    )
                  )}
                </div>
              </div>
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
