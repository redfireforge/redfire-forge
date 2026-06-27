/** Per-lesson personal notes — localStorage persistence (separate from demo progress). */

export const LESSON_NOTES_STORAGE_KEY = 'redfire-demo-lesson-notes-v1';

export type LessonNotesMap = Record<string, string>;

export function loadLessonNotes(): LessonNotesMap {
  try {
    const raw = localStorage.getItem(LESSON_NOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: LessonNotesMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveLessonNotes(notes: LessonNotesMap): void {
  try {
    localStorage.setItem(LESSON_NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch { /* quota / private mode */ }
}

export function hasLessonNoteContent(text: string | undefined): boolean {
  return !!text?.trim();
}
