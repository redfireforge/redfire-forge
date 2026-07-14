/** Floating notes panel — opened from lesson list or live demo header. */
import { useEffect } from 'react';
import LessonNotesEditor from './LessonNotesEditor';
import { useLessonNotesContext } from './LessonNotesContext';
import { useLessonNotesPanelLayout } from './useLessonNotesPanelLayout';

export default function LessonNotesPanel() {
  const {
    panelOpen,
    panelTarget,
    getNote,
    saveNote,
    closePanel,
  } = useLessonNotesContext();
  const { panelRef, panelStyle, onDragMouseDown } = useLessonNotesPanelLayout();

  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Don't steal Escape while the user is composing text in the textarea.
      if (document.activeElement?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closePanel();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [panelOpen, closePanel]);

  if (!panelOpen || !panelTarget) return null;

  const { lessonId, lessonName } = panelTarget;

  const handleSave = (text: string) => {
    saveNote(lessonId, text);
    closePanel();
  };

  return (
    <div
      className="demo-lesson-notes-panel open"
      ref={panelRef}
      style={panelStyle}
      role="dialog"
      aria-modal="true"
      aria-label={`Notes for ${lessonName}`}
      data-testid="demo-lesson-notes-panel"
    >
      <div
        className="demo-lesson-notes-panel-header demo-lesson-notes-panel-header--draggable"
        onMouseDown={onDragMouseDown}
      >
        <span className="demo-lesson-notes-drag-handle" aria-hidden="true">⠿</span>
        <div className="demo-lesson-notes-panel-title">
          Notes
          <span>{lessonName}</span>
        </div>
      </div>
      <div className="demo-lesson-notes-panel-body">
        <LessonNotesEditor
          lessonId={lessonId}
          lessonName={lessonName}
          savedText={getNote(lessonId)}
          onSave={handleSave}
          onClose={closePanel}
        />
      </div>
    </div>
  );
}
