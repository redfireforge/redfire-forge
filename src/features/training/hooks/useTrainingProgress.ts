import { useState, useEffect, useCallback, useMemo } from 'react';
import { readKey, writeKey } from '@shared/utils/storage';
import type { TrainingProgress, ManualProgress, ManualStatus, TrainingPath } from '../../../data/galleries/trainingPaths/types';
import { trainingPaths } from '../../../data/galleries/trainingPaths';

const TRAINING_PROGRESS_KEY = 'perf-test-training-progress';

/** Default empty progress state */
function createEmptyProgress(): TrainingProgress {
  return {
    manuals: {},
    lastUpdated: Date.now(),
    streak: 0,
  };
}

/** Get today's date as YYYY-MM-DD string */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/** Check if two date strings are consecutive days */
function areConsecutiveDays(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

/** Load progress from storage */
async function loadProgress(): Promise<TrainingProgress> {
  try {
    const raw = await readKey(TRAINING_PROGRESS_KEY);
    if (raw) {
      return JSON.parse(raw) as TrainingProgress;
    }
  } catch {
    // Ignore parse errors
  }
  return createEmptyProgress();
}

/** Save progress to storage */
async function saveProgress(progress: TrainingProgress): Promise<void> {
  await writeKey(TRAINING_PROGRESS_KEY, JSON.stringify(progress));
}

/** Calculate progress stats for a given training path */
export function calculatePathProgress(
  path: TrainingPath,
  progress: TrainingProgress
): { completed: number; inProgress: number; total: number; percentage: number } {
  const allManuals = path.phases.flatMap(p => p.manuals);
  let completed = 0;
  let inProgress = 0;

  for (const manual of allManuals) {
    if (!manual.manualPath) continue;
    const mp = progress.manuals[manual.manualPath];
    if (mp?.status === 'completed') {
      completed++;
    } else if (mp?.status === 'in_progress') {
      inProgress++;
    }
  }

  const total = allManuals.filter(m => m.manualPath).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, inProgress, total, percentage };
}

/** Calculate overall stats across all training paths */
export function calculateOverallStats(progress: TrainingProgress): {
  totalCompleted: number;
  totalInProgress: number;
  totalManuals: number;
  pathsStarted: number;
  totalPaths: number;
  streak: number;
} {
  let totalCompleted = 0;
  let totalInProgress = 0;
  let totalManuals = 0;
  let pathsStarted = 0;

  for (const path of trainingPaths) {
    if (path.comingSoon) continue;
    
    const stats = calculatePathProgress(path, progress);
    totalCompleted += stats.completed;
    totalInProgress += stats.inProgress;
    totalManuals += stats.total;

    if (stats.completed > 0 || stats.inProgress > 0) {
      pathsStarted++;
    }
  }

  return {
    totalCompleted,
    totalInProgress,
    totalManuals,
    pathsStarted,
    totalPaths: trainingPaths.filter(p => !p.comingSoon).length,
    streak: progress.streak,
  };
}

/** Find the most recently viewed manual that is in-progress */
export function findLastViewedInProgress(progress: TrainingProgress): ManualProgress | null {
  let lastViewed: ManualProgress | null = null;

  for (const mp of Object.values(progress.manuals)) {
    if (mp.status === 'in_progress' && mp.lastViewedAt) {
      if (!lastViewed || (mp.lastViewedAt > (lastViewed.lastViewedAt ?? 0))) {
        lastViewed = mp;
      }
    }
  }

  return lastViewed;
}

/**
 * Hook for managing training manual progress.
 * 
 * Provides:
 * - Current progress state
 * - Functions to update manual status
 * - Calculated stats for paths and overall progress
 * - Last viewed in-progress manual for "Continue Learning"
 */
export function useTrainingProgress() {
  const [progress, setProgress] = useState<TrainingProgress>(createEmptyProgress);
  const [isLoading, setIsLoading] = useState(true);

  // Load progress on mount
  useEffect(() => {
    let cancelled = false;
    
    loadProgress().then(loaded => {
      if (!cancelled) {
        setProgress(loaded);
        setIsLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, []);

  // Update a manual's status
  const updateManualStatus = useCallback(async (
    manualPath: string,
    status: ManualStatus
  ) => {
    setProgress(prev => {
      const now = Date.now();
      const today = getTodayDateString();
      
      const existing = prev.manuals[manualPath];
      const updated: ManualProgress = {
        manualPath,
        status,
        lastViewedAt: now,
        completedAt: status === 'completed' ? now : existing?.completedAt,
      };

      // Calculate new streak
      let newStreak = prev.streak;
      let newLastCompletionDate = prev.lastCompletionDate;

      if (status === 'completed') {
        if (!prev.lastCompletionDate) {
          // First completion ever
          newStreak = 1;
          newLastCompletionDate = today;
        } else if (prev.lastCompletionDate === today) {
          // Already completed something today, streak unchanged
        } else if (areConsecutiveDays(prev.lastCompletionDate, today)) {
          // Consecutive day, increment streak
          newStreak = prev.streak + 1;
          newLastCompletionDate = today;
        } else {
          // Streak broken, start fresh
          newStreak = 1;
          newLastCompletionDate = today;
        }
      }

      const newProgress: TrainingProgress = {
        ...prev,
        manuals: {
          ...prev.manuals,
          [manualPath]: updated,
        },
        lastUpdated: now,
        streak: newStreak,
        lastCompletionDate: newLastCompletionDate,
      };

      // Save async (fire and forget)
      saveProgress(newProgress);

      return newProgress;
    });
  }, []);

  // Mark a manual as viewed (updates lastViewedAt without changing status)
  const markViewed = useCallback(async (manualPath: string) => {
    setProgress(prev => {
      const now = Date.now();
      const existing = prev.manuals[manualPath];
      
      // If not started, mark as in_progress when first viewed
      const newStatus: ManualStatus = existing?.status ?? 'in_progress';
      
      const updated: ManualProgress = {
        manualPath,
        status: newStatus,
        lastViewedAt: now,
        completedAt: existing?.completedAt,
      };

      const newProgress: TrainingProgress = {
        ...prev,
        manuals: {
          ...prev.manuals,
          [manualPath]: updated,
        },
        lastUpdated: now,
      };

      saveProgress(newProgress);
      return newProgress;
    });
  }, []);

  // Get status for a specific manual
  const getManualStatus = useCallback((manualPath: string): ManualStatus => {
    return progress.manuals[manualPath]?.status ?? 'not_started';
  }, [progress.manuals]);

  // Get progress for a specific manual
  const getManualProgress = useCallback((manualPath: string): ManualProgress | undefined => {
    return progress.manuals[manualPath];
  }, [progress.manuals]);

  // Calculate overall stats
  const overallStats = useMemo(() => calculateOverallStats(progress), [progress]);

  // Find last viewed in-progress manual
  const lastViewedInProgress = useMemo(() => findLastViewedInProgress(progress), [progress]);

  // Reset all progress (for testing/debug)
  const resetProgress = useCallback(async () => {
    const empty = createEmptyProgress();
    setProgress(empty);
    await saveProgress(empty);
  }, []);

  return {
    progress,
    isLoading,
    updateManualStatus,
    markViewed,
    getManualStatus,
    getManualProgress,
    overallStats,
    lastViewedInProgress,
    resetProgress,
  };
}

export type UseTrainingProgressReturn = ReturnType<typeof useTrainingProgress>;
