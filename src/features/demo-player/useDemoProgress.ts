/** Demo Progress v2 — localStorage persistence hook */
import { useState, useCallback } from 'react';
import type { DemoProgress, SpeedMultiplier } from './types';

const STORAGE_KEY = 'redfire-demo-progress-v2';

const DEFAULT_PROGRESS: DemoProgress = {
  completedLessons: [],
  lessonSteps: {},
  speed: 1,
};

function loadProgress(): DemoProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROGRESS, ...parsed };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function saveProgress(data: DemoProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* noop — quota exceeded or private mode */ }
}

export function useDemoProgress() {
  const [data, setData] = useState<DemoProgress>(loadProgress);

  const update = useCallback((updater: (prev: DemoProgress) => DemoProgress) => {
    setData(prev => {
      const next = updater(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const markLessonComplete = useCallback((lessonId: string) => {
    update(prev => ({
      ...prev,
      completedLessons: prev.completedLessons.includes(lessonId)
        ? prev.completedLessons
        : [...prev.completedLessons, lessonId],
    }));
  }, [update]);

  const setLessonStep = useCallback((lessonId: string, stepIndex: number) => {
    update(prev => ({
      ...prev,
      lessonSteps: { ...prev.lessonSteps, [lessonId]: stepIndex },
    }));
  }, [update]);

  const setLastDomain = useCallback((domainId: string) => {
    update(prev => ({ ...prev, lastDomain: domainId }));
  }, [update]);

  const setLastLesson = useCallback((lessonId: string) => {
    update(prev => ({ ...prev, lastLesson: lessonId }));
  }, [update]);

  const setSpeed = useCallback((speed: SpeedMultiplier) => {
    update(prev => ({ ...prev, speed }));
  }, [update]);

  const isLessonComplete = useCallback((lessonId: string) => {
    return data.completedLessons.includes(lessonId);
  }, [data.completedLessons]);

  const getLessonStep = useCallback((lessonId: string): number => {
    return data.lessonSteps[lessonId] ?? 0;
  }, [data.lessonSteps]);

  const resetProgress = useCallback(() => {
    update(() => DEFAULT_PROGRESS);
  }, [update]);

  return {
    data,
    markLessonComplete,
    setLessonStep,
    setLastDomain,
    setLastLesson,
    setSpeed,
    isLessonComplete,
    getLessonStep,
    resetProgress,
  };
}
