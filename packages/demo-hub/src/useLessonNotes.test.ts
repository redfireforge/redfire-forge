/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLessonNotes } from './useLessonNotes';
import { LESSON_NOTES_STORAGE_KEY } from './lessonNotesStorage';

describe('useLessonNotes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveNote persists to localStorage', () => {
    const { result } = renderHook(() => useLessonNotes());
    act(() => result.current.saveNote('l1', 'hello'));
    expect(result.current.hasNote('l1')).toBe(true);
    const stored = JSON.parse(localStorage.getItem(LESSON_NOTES_STORAGE_KEY)!);
    expect(stored.l1).toBe('hello');
  });

  it('saveNote removes entry when content is blank', () => {
    localStorage.setItem(LESSON_NOTES_STORAGE_KEY, JSON.stringify({ l1: 'old' }));
    const { result } = renderHook(() => useLessonNotes());
    act(() => result.current.saveNote('l1', '   '));
    expect(result.current.hasNote('l1')).toBe(false);
  });

  it('saveNote stores trimmed text', () => {
    const { result } = renderHook(() => useLessonNotes());
    act(() => result.current.saveNote('l1', '  hello  '));
    expect(result.current.getNote('l1')).toBe('hello');
  });

  it('normalizes untrimmed notes loaded from storage', () => {
    localStorage.setItem(LESSON_NOTES_STORAGE_KEY, JSON.stringify({ l1: '  legacy  ', l2: '   ' }));
    const { result } = renderHook(() => useLessonNotes());
    expect(result.current.getNote('l1')).toBe('legacy');
    expect(result.current.hasNote('l2')).toBe(false);
    const stored = JSON.parse(localStorage.getItem(LESSON_NOTES_STORAGE_KEY)!);
    expect(stored).toEqual({ l1: 'legacy' });
  });
});
