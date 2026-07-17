/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadLessonNotes,
  saveLessonNotes,
  hasLessonNoteContent,
  LESSON_NOTES_STORAGE_KEY,
} from './lessonNotesStorage';

describe('lessonNotesStorage — coverage gaps', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadLessonNotes returns empty object for invalid JSON shape', () => {
    localStorage.setItem(LESSON_NOTES_STORAGE_KEY, JSON.stringify(['not-a-map']));
    expect(loadLessonNotes()).toEqual({});
  });

  it('loadLessonNotes skips non-string values', () => {
    localStorage.setItem(LESSON_NOTES_STORAGE_KEY, JSON.stringify({ ok: 'note', bad: 42 }));
    expect(loadLessonNotes()).toEqual({ ok: 'note' });
  });

  it('saveLessonNotes swallows quota errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveLessonNotes({ l1: 'x' })).not.toThrow();
  });

  it('hasLessonNoteContent treats whitespace as empty', () => {
    expect(hasLessonNoteContent('   ')).toBe(false);
    expect(hasLessonNoteContent('note')).toBe(true);
  });
});
