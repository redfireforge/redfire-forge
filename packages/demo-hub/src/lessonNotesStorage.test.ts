/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  LESSON_NOTES_STORAGE_KEY,
  hasLessonNoteContent,
  loadLessonNotes,
  saveLessonNotes,
} from './lessonNotesStorage';

describe('lessonNotesStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty map when storage is missing', () => {
    expect(loadLessonNotes()).toEqual({});
  });

  it('loads and saves lesson notes', () => {
    saveLessonNotes({ l1: 'My note' });
    expect(loadLessonNotes()).toEqual({ l1: 'My note' });
    expect(localStorage.getItem(LESSON_NOTES_STORAGE_KEY)).toContain('My note');
  });

  it('handles corrupt storage gracefully', () => {
    localStorage.setItem(LESSON_NOTES_STORAGE_KEY, 'not-json');
    expect(loadLessonNotes()).toEqual({});
  });

  it('hasLessonNoteContent is false for blank strings', () => {
    expect(hasLessonNoteContent('')).toBe(false);
    expect(hasLessonNoteContent('   \n  ')).toBe(false);
    expect(hasLessonNoteContent('hello')).toBe(true);
  });
});
