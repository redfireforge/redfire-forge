/** Notes icon button with has-content indicator dot. */

interface LessonNotesIconProps {
  lessonName: string;
  hasContent: boolean;
  onClick: () => void;
  className?: string;
  testId?: string;
  /** Compact 32×32 sizing for lesson list rows */
  compact?: boolean;
}

export function NotesIconSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      <path d="M15 5l3 3" />
    </svg>
  );
}

export default function LessonNotesIcon({
  lessonName,
  hasContent,
  onClick,
  className = '',
  testId,
  compact = false,
}: LessonNotesIconProps) {
  const label = hasContent
    ? `Open notes for ${lessonName} (has saved notes)`
    : `Open notes for ${lessonName}`;

  return (
    <button
      type="button"
      className={[
        'demo-lesson-notes-btn',
        compact ? 'demo-lesson-notes-btn--compact' : '',
        hasContent ? 'has-notes' : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      title={hasContent ? 'Notes (saved)' : 'Notes'}
      data-testid={testId ?? 'demo-lesson-note-btn'}
    >
      <NotesIconSvg />
      {hasContent && <span className="demo-lesson-note-dot" aria-hidden="true" />}
    </button>
  );
}
