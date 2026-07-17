/** React hook for per-lesson note CRUD. */
import { useCallback, useRef, useState } from 'react';
import {
  hasLessonNoteContent,
  loadLessonNotes,
  saveLessonNotes,
  type LessonNotesMap,
} from './lessonNotesStorage';

export function useLessonNotes() {
  const [notes, setNotes] = useState<LessonNotesMap>(() => {
    const loaded = loadLessonNotes();
    const normalized: LessonNotesMap = {};
    for (const [id, text] of Object.entries(loaded)) {
      const trimmed = text.trim();
      if (trimmed) normalized[id] = trimmed;
    }
    if (JSON.stringify(normalized) !== JSON.stringify(loaded)) {
      saveLessonNotes(normalized);
    }
    return normalized;
  });
  const latestNotesRef = useRef<LessonNotesMap>(notes);

  // Keep latest notes available to stable callbacks without recreating them.
  latestNotesRef.current = notes;

  const getNote = useCallback((lessonId: string): string => {
    return latestNotesRef.current[lessonId] ?? '';
  }, []);

  const hasNote = useCallback((lessonId: string): boolean => {
    return hasLessonNoteContent(latestNotesRef.current[lessonId]);
  }, []);

  const saveNote = useCallback((lessonId: string, text: string) => {
    setNotes(prev => {
      const trimmed = text.trim();
      const next = { ...prev };
      if (trimmed) next[lessonId] = trimmed;
      else delete next[lessonId];
      saveLessonNotes(next);
      return next;
    });
  }, []);

  const clearNote = useCallback((lessonId: string) => {
    setNotes(prev => {
      if (!(lessonId in prev)) return prev;
      const next = { ...prev };
      delete next[lessonId];
      saveLessonNotes(next);
      return next;
    });
  }, []);

  return { getNote, hasNote, saveNote, clearNote, notes };
}
