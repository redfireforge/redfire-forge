/** Shared lesson-notes state for list, concept, and live demo surfaces. */
/* eslint-disable react-refresh/only-export-components -- context module exports provider + hooks */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLessonNotes } from './useLessonNotes';

export interface LessonNotesTarget {
  lessonId: string;
  lessonName: string;
}

/** App-level shortcut guard — true while the floating notes panel is open. */
export const lessonNotesPanelOpenRef = { current: false };

interface LessonNotesContextValue {
  getNote: (lessonId: string) => string;
  hasNote: (lessonId: string) => boolean;
  saveNote: (lessonId: string, text: string) => void;
  clearNote: (lessonId: string) => void;
  panelOpen: boolean;
  panelTarget: LessonNotesTarget | null;
  openPanel: (target: LessonNotesTarget) => void;
  closePanel: () => void;
}

const LessonNotesContext = createContext<LessonNotesContextValue | null>(null);

export function LessonNotesProvider({ children }: { children: ReactNode }) {
  const { getNote, hasNote, saveNote, clearNote } = useLessonNotes();
  const [panelTarget, setPanelTarget] = useState<LessonNotesTarget | null>(null);

  const openPanel = useCallback((target: LessonNotesTarget) => {
    setPanelTarget(target);
  }, []);

  const closePanel = useCallback(() => {
    setPanelTarget(null);
  }, []);

  useEffect(() => {
    lessonNotesPanelOpenRef.current = panelTarget !== null;
    return () => {
      lessonNotesPanelOpenRef.current = false;
    };
  }, [panelTarget]);

  const value = useMemo<LessonNotesContextValue>(() => ({
    getNote,
    hasNote,
    saveNote,
    clearNote,
    panelOpen: panelTarget !== null,
    panelTarget,
    openPanel,
    closePanel,
  }), [getNote, hasNote, saveNote, clearNote, panelTarget, openPanel, closePanel]);

  return (
    <LessonNotesContext.Provider value={value}>
      {children}
    </LessonNotesContext.Provider>
  );
}

export function useLessonNotesContext(): LessonNotesContextValue {
  const ctx = useContext(LessonNotesContext);
  if (!ctx) {
    throw new Error('useLessonNotesContext must be used within LessonNotesProvider');
  }
  return ctx;
}

export function useLessonNotesContextOptional(): LessonNotesContextValue | null {
  return useContext(LessonNotesContext);
}
