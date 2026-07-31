/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
      completedVersions: {},
      completedStepCounts: {},
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
      completedVersions: {},
      completedStepCounts: {},
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

  it('setLastView saves view', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.setLastView('concept'));
    expect(result.current.data.lastView).toBe('concept');
    act(() => result.current.setLastView('lessons'));
    expect(result.current.data.lastView).toBe('lessons');
  });

  it('getLessonStatus returns not_started, in_progress, and completed', () => {
    const { result } = renderHook(() => useDemoProgress());
    expect(result.current.getLessonStatus('lesson-1')).toBe('not_started');
    act(() => result.current.setLessonStep('lesson-1', 2));
    expect(result.current.getLessonStatus('lesson-1')).toBe('in_progress');
    act(() => result.current.markLessonComplete('lesson-1'));
    expect(result.current.getLessonStatus('lesson-1')).toBe('completed');
  });

  it('resetLesson clears completion and step for one lesson only', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => {
      result.current.markLessonComplete('lesson-1');
      result.current.setLessonStep('lesson-1', 3);
      result.current.setLessonStep('lesson-2', 1);
    });
    act(() => result.current.resetLesson('lesson-1'));
    expect(result.current.data.completedLessons).not.toContain('lesson-1');
    expect(result.current.data.lessonSteps['lesson-1']).toBeUndefined();
    expect(result.current.data.lessonSteps['lesson-2']).toBe(1);
  });

  it('handles localStorage setItem failure gracefully', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.markLessonComplete('lesson-1'));
    expect(result.current.data.completedLessons).toContain('lesson-1');
    setItemSpy.mockRestore();
  });

  // ── contentVersion / isLessonUpdated ─────────────────────────
  it('markLessonComplete stores contentVersion', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.markLessonComplete('lesson-1', 2));
    expect(result.current.data.completedVersions['lesson-1']).toBe(2);
  });

  it('markLessonComplete stores step count', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.markLessonComplete('lesson-1', 1, 6));
    expect(result.current.data.completedStepCounts['lesson-1']).toBe(6);
  });

  it('markLessonComplete defaults to version 1 when omitted', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.markLessonComplete('lesson-1'));
    expect(result.current.data.completedVersions['lesson-1']).toBe(1);
  });

  it('isLessonUpdated returns false for non-completed lessons', () => {
    const { result } = renderHook(() => useDemoProgress());
    expect(result.current.isLessonUpdated('lesson-1', 2)).toBe(false);
  });

  it('isLessonUpdated returns true when lesson version exceeds completed version', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.markLessonComplete('lesson-1', 1));
    expect(result.current.isLessonUpdated('lesson-1', 2)).toBe(true);
  });

  it('isLessonUpdated returns false when versions match', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.markLessonComplete('lesson-1', 2));
    expect(result.current.isLessonUpdated('lesson-1', 2)).toBe(false);
  });

  it('re-completing an updated lesson clears the updated state', () => {
    const { result } = renderHook(() => useDemoProgress());
    act(() => result.current.markLessonComplete('lesson-1', 1));
    expect(result.current.isLessonUpdated('lesson-1', 2)).toBe(true);
    act(() => result.current.markLessonComplete('lesson-1', 2));
    expect(result.current.isLessonUpdated('lesson-1', 2)).toBe(false);
    expect(result.current.data.completedVersions['lesson-1']).toBe(2);
  });
});
