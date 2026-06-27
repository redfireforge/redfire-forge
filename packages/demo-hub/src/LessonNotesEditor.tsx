/** Shared textarea + Save / Close footer for per-lesson notes. */
import { useCallback, useEffect, useRef, useState } from 'react';

interface LessonNotesEditorProps {
  lessonId: string;
  lessonName: string;
  savedText: string;
  onSave: (text: string) => void;
  onClose: () => void;
  showHeader?: boolean;
}

export default function LessonNotesEditor({
  lessonId,
  lessonName,
  savedText,
  onSave,
  onClose,
  showHeader = false,
}: LessonNotesEditorProps) {
  const [draft, setDraft] = useState(savedText);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const saveFeedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(savedText);
  }, [lessonId, savedText]);

  useEffect(() => {
    setSaveFeedback(null);
  }, [lessonId]);

  useEffect(() => () => {
    if (saveFeedbackTimerRef.current !== null) {
      window.clearTimeout(saveFeedbackTimerRef.current);
    }
  }, []);

  const isDirty = draft.trim() !== savedText;

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    onSave(draft);
    setDraft(trimmed);
    setSaveFeedback('Saved locally');
    if (saveFeedbackTimerRef.current !== null) {
      window.clearTimeout(saveFeedbackTimerRef.current);
    }
    saveFeedbackTimerRef.current = window.setTimeout(() => {
      setSaveFeedback(null);
      saveFeedbackTimerRef.current = null;
    }, 2500);
  }, [draft, onSave]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <div className="demo-lesson-notes-editor">
      {showHeader && (
        <div className="demo-lesson-notes-inline-header">
          <h2 className="demo-lesson-notes-inline-title">My notes</h2>
          <p className="demo-lesson-notes-inline-sub">{lessonName}</p>
        </div>
      )}
      <textarea
        className="demo-lesson-notes-textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Jot down key takeaways, commands to try later, or questions…"
        aria-label={`Notes for ${lessonName}`}
        data-testid="demo-lesson-notes-textarea"
      />
      <p className="demo-lesson-notes-hint">
        Personal notes for this lesson. Stored locally on this device.
        {isDirty && !saveFeedback ? ' · Unsaved changes' : ''}
      </p>
      <div className="demo-lesson-notes-footer">
        <span className="demo-lesson-notes-status" data-testid="demo-lesson-notes-status">
          {saveFeedback && (
            <>
              <span className="demo-lesson-notes-status-dot" aria-hidden="true" />
              {saveFeedback}
            </>
          )}
        </span>
        <div className="demo-lesson-notes-actions">
          <button
            type="button"
            className="demo-lesson-notes-close-btn"
            onClick={handleClose}
            data-testid="demo-lesson-notes-close-btn"
          >
            Close
          </button>
          <button
            type="button"
            className="demo-lesson-notes-save-btn"
            onClick={handleSave}
            data-testid="demo-lesson-notes-save-btn"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
