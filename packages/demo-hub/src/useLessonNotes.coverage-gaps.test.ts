/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLessonNotes } from './useLessonNotes';
import { LESSON_NOTES_STORAGE_KEY } from './lessonNotesStorage';

describe('useLessonNotes — coverage gaps', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clearNote removes an existing note', () => {
    localStorage.setItem(LESSON_NOTES_STORAGE_KEY, JSON.stringify({ l1: 'note' }));
    const { result } = renderHook(() => useLessonNotes());
    act(() => result.current.clearNote('l1'));
    expect(result.current.hasNote('l1')).toBe(false);
    expect(JSON.parse(localStorage.getItem(LESSON_NOTES_STORAGE_KEY)!)).toEqual({});
  });

  it('clearNote is a no-op when lesson has no note', () => {
    const { result } = renderHook(() => useLessonNotes());
    act(() => result.current.clearNote('missing'));
    expect(result.current.notes).toEqual({});
  });

  it('getNote returns empty string for unknown lesson', () => {
    const { result } = renderHook(() => useLessonNotes());
    expect(result.current.getNote('unknown')).toBe('');
  });

  it('hasNote returns false for whitespace-only stored note after normalization', () => {
    localStorage.setItem(LESSON_NOTES_STORAGE_KEY, JSON.stringify({ l1: '   ' }));
    const { result } = renderHook(() => useLessonNotes());
    expect(result.current.hasNote('l1')).toBe(false);
  });
});
