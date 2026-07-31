/** Demo Progress — localStorage persistence hook */
import { useState, useCallback } from 'react';
import type { DemoProgress, SpeedMultiplier } from './types';

const STORAGE_KEY = 'redfire-demo-progress-v2';

const DEFAULT_PROGRESS: DemoProgress = {
  completedLessons: [],
  lessonSteps: {},
  completedVersions: {},
  completedStepCounts: {},
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

  const markLessonComplete = useCallback((lessonId: string, contentVersion?: number, stepCount?: number) => {
    update(prev => ({
      ...prev,
      completedLessons: prev.completedLessons.includes(lessonId)
        ? prev.completedLessons
        : [...prev.completedLessons, lessonId],
      completedVersions: {
        ...prev.completedVersions,
        [lessonId]: contentVersion ?? prev.completedVersions[lessonId] ?? 1,
      },
      completedStepCounts: stepCount != null
        ? { ...prev.completedStepCounts, [lessonId]: stepCount }
        : prev.completedStepCounts,
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

  const setLastView = useCallback((view: 'domains' | 'lessons' | 'concept') => {
    update(prev => ({ ...prev, lastView: view }));
  }, [update]);

  const setLastCategory = useCallback((categoryId: string) => {
    update(prev => ({ ...prev, lastCategory: categoryId }));
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

  const getLessonStatus = useCallback((lessonId: string): 'not_started' | 'in_progress' | 'completed' => {
    if (data.completedLessons.includes(lessonId)) return 'completed';
    if (data.lessonSteps[lessonId] !== undefined) return 'in_progress';
    return 'not_started';
  }, [data.completedLessons, data.lessonSteps]);

  /** True when the user completed an older version of the lesson. */
  const isLessonUpdated = useCallback((lessonId: string, currentVersion?: number): boolean => {
    if (!data.completedLessons.includes(lessonId)) return false;
    const ver = currentVersion ?? 1;
    const completedVer = data.completedVersions[lessonId] ?? 1;
    return ver > completedVer;
  }, [data.completedLessons, data.completedVersions]);

  const resetLesson = useCallback((lessonId: string) => {
    update(prev => {
      const lessonSteps = { ...prev.lessonSteps };
      delete lessonSteps[lessonId];
      return {
        ...prev,
        completedLessons: prev.completedLessons.filter(id => id !== lessonId),
        lessonSteps,
      };
    });
  }, [update]);

  const resetProgress = useCallback(() => {
    update(() => DEFAULT_PROGRESS);
  }, [update]);

  const resetLessons = useCallback((lessonIds: string[]) => {
    update(prev => {
      const lessonSteps = { ...prev.lessonSteps };
      for (const id of lessonIds) {
        delete lessonSteps[id];
      }
      return {
        ...prev,
        completedLessons: prev.completedLessons.filter(id => !lessonIds.includes(id)),
        lessonSteps,
      };
    });
  }, [update]);

  return {
    data,
    markLessonComplete,
    setLessonStep,
    setLastDomain,
    setLastLesson,
    setLastView,
    setLastCategory,
    setSpeed,
    isLessonComplete,
    getLessonStep,
    getLessonStatus,
    resetLesson,
    resetProgress,
    resetLessons,
    isLessonUpdated,
  };
}
