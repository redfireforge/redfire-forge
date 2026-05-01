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
