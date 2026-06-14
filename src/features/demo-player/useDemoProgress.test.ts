/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoProgress } from './useDemoProgress';

describe('useDemoProgress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with default progress when no saved data', () => {
    const { result } = renderHook(() => useDemoProgress());
    expect(result.current.data).toEqual({
      completedLessons: [],
      lessonSteps: {},
      speed: 1,
    });
  });

  it('loads saved progress from localStorage', () => {
    const saved = { completedLessons: ['lesson-1'], lessonSteps: { 'lesson-1': 3 }, speed: 2 };
    localStorage.setItem('redfire-demo-progress-v2', JSON.stringify(saved));
    const { result } = renderHook(() => useDemoProgress());
    expect(result.current.data.completedLessons).toEqual(['lesson-1']);
    expect(result.current.data.lessonSteps).toEqual({ 'lesson-1': 3 });
    expect(result.current.data.speed).toBe(2);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('redfire-demo-progress-v2', 'not-json');
    const { result } = renderHook(() => useDemoProgress());
    expect(result.current.data.completedLessons).toEqual([]);
  });

  it('markLessonComplete adds a lesson', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.markLessonComplete('lesson-1'));
    expect(result.current.data.completedLessons).toContain('lesson-1');
  });

  it('markLessonComplete is idempotent', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.markLessonComplete('lesson-1'));
    act(() => result.current.markLessonComplete('lesson-1'));
    expect(result.current.data.completedLessons.filter(l => l === 'lesson-1')).toHaveLength(1);
  });

  it('setLessonStep saves step index', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.setLessonStep('lesson-1', 5));
    expect(result.current.data.lessonSteps['lesson-1']).toBe(5);
  });

  it('setLastDomain saves domain id', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.setLastDomain('protocols'));
    expect(result.current.data.lastDomain).toBe('protocols');
  });

  it('setLastLesson saves lesson id', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.setLastLesson('ws-basics'));
    expect(result.current.data.lastLesson).toBe('ws-basics');
  });

  it('setSpeed updates speed multiplier', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.setSpeed(2));
    expect(result.current.data.speed).toBe(2);
  });

  it('isLessonComplete returns correct state', () => {
    const { result } = renderHook(() => useDemoProgress());
    expect(result.current.isLessonComplete('lesson-1')).toBe(false);
    act(() => result.current.markLessonComplete('lesson-1'));
    expect(result.current.isLessonComplete('lesson-1')).toBe(true);
  });

  it('getLessonStep returns 0 for unvisited lessons', () => {
    const { result } = renderHook(() => useDemoProgress());
    expect(result.current.getLessonStep('lesson-1')).toBe(0);
  });

  it('getLessonStep returns saved step', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.setLessonStep('lesson-1', 7));
    expect(result.current.getLessonStep('lesson-1')).toBe(7);
  });

  it('resetProgress clears all data', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => {
      result.current.markLessonComplete('lesson-1');
      result.current.setLessonStep('lesson-1', 3);
      result.current.setSpeed(2);
    });
    act(() => result.current.resetProgress());
    expect(result.current.data).toEqual({
      completedLessons: [],
      lessonSteps: {},
      speed: 1,
    });
  });

  it('persists changes to localStorage', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.markLessonComplete('lesson-1'));
    const stored = JSON.parse(localStorage.getItem('redfire-demo-progress-v2')!);
    expect(stored.completedLessons).toContain('lesson-1');
  });

  it('merges partial saved data with defaults', () => {
    localStorage.setItem('redfire-demo-progress-v2', JSON.stringify({ completedLessons: ['x'] }));
    const { result } = renderHook(() => useDemoProgress());
    expect(result.current.data.completedLessons).toEqual(['x']);
    expect(result.current.data.lessonSteps).toEqual({});
    expect(result.current.data.speed).toBe(1);
  });
});
