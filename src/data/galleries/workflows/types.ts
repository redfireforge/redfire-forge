import type { Workflow } from '../../../features/workflow/types/workflow';
import type { GalleryEntry } from '../types';

export type SampleCategory = 'api-patterns' | 'flow-control' | 'event-driven' | 'orchestration' | 'performance';

/** @deprecated Use GalleryDifficulty from galleries/types instead. */
export type SampleDifficulty = 'easy' | 'medium' | 'advanced';

export interface SampleWorkflowEntry extends GalleryEntry<Workflow> {
  category: SampleCategory;
  nodeCount: number;
  /** Primary nodes this sample teaches (main learning focus). */
  primaryNodes: string[];
  /** Secondary nodes used but not the main focus. */
  secondaryNodes: string[];
  /** Additional workflows bundled with this sample (e.g. child sub-workflows). */
  companionFactories?: Array<() => Workflow>;
}
