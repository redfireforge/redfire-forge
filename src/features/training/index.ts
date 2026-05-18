/**
 * Training feature module.
 *
 * Provides:
 * - Progress tracking for training manuals
 * - "What's New" detection for recently added/updated content
 */

// Hooks
export { useTrainingProgress, calculatePathProgress, calculateOverallStats, findLastViewedInProgress } from './hooks/useTrainingProgress';
export type { UseTrainingProgressReturn } from './hooks/useTrainingProgress';

export { useWhatsNew, getWhatsNewItems, isManualNew, isManualUpdated, getManualBadge } from './hooks/useWhatsNew';
export type { UseWhatsNewReturn, WhatsNewItem, WhatsNewType } from './hooks/useWhatsNew';

// Re-export types for convenience
export type {
  ManualStatus,
  ManualProgress,
  TrainingProgress,
  ManualMetadata,
} from '../../data/galleries/trainingPaths/types';
