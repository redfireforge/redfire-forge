/**
 * Training Path type definitions for the Gallery.
 *
 * A training path is a structured learning journey composed of phases,
 * each phase containing one or more manuals linked to gallery samples.
 */

export interface TrainingManual {
  /** Manual filename (without directory). */
  title: string;
  /** Short description of what the manual covers. */
  description: string;
  difficulty: 'easy' | 'medium' | 'advanced';
  /** Gallery sample ID used in this manual. Undefined if no sample (e.g., audit log). */
  sampleId?: string;
  /** Relative path to the HTML manual file from docs/training-manuals/. */
  manualPath?: string;
}

export interface TrainingPhase {
  id: number | string;
  name: string;
  manuals: TrainingManual[];
}

export interface TrainingPath {
  id: string;
  name: string;
  icon: string;
  description: string;
  phases: TrainingPhase[];
  /** If true, the path is not yet available (shown as "Coming soon"). */
  comingSoon?: boolean;
}

// ============================================================================
// Progress Tracking Types
// ============================================================================

/** Manual completion status */
export type ManualStatus = 'not_started' | 'in_progress' | 'completed';

/** User progress for a single manual */
export interface ManualProgress {
  /** Unique identifier (manualPath) */
  manualPath: string;
  /** Current completion status */
  status: ManualStatus;
  /** Unix timestamp when last viewed */
  lastViewedAt?: number;
  /** Unix timestamp when marked completed */
  completedAt?: number;
}

/** Aggregated user progress across all manuals */
export interface TrainingProgress {
  /** Progress entries keyed by manualPath */
  manuals: Record<string, ManualProgress>;
  /** Unix timestamp of last update */
  lastUpdated: number;
  /** Consecutive days with activity (streak) */
  streak: number;
  /** Last date (YYYY-MM-DD) when a manual was completed — used for streak calculation */
  lastCompletionDate?: string;
}

// ============================================================================
// Manual Metadata Types (for "What's New" detection)
// ============================================================================

/** Metadata for tracking when manuals were added or updated */
export interface ManualMetadata {
  /** Relative path to the manual (matches TrainingManual.manualPath) */
  manualPath: string;
  /** Unix timestamp when the manual was first added */
  addedAt: number;
  /** Unix timestamp of last significant update (undefined if never updated) */
  updatedAt?: number;
  /** Brief description of what changed (for updated manuals) */
  changeNote?: string;
}
