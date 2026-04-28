import type { Workflow } from '../../features/workflow/types/workflow';

export type SampleCategory = 'basics' | 'triggers' | 'logic' | 'advanced';
export type SampleDifficulty = 'easy' | 'medium' | 'advanced';

export interface SampleWorkflowEntry {
  id: string;
  name: string;
  description: string;
  category: SampleCategory;
  difficulty: SampleDifficulty;
  icon: string;
  nodeCount: number;
  /** Primary nodes this sample teaches (main learning focus). */
  primaryNodes: string[];
  /** Secondary nodes used but not the main focus. */
  secondaryNodes: string[];
  factory: () => Workflow;
  /** Additional workflows bundled with this sample (e.g. child sub-workflows). */
  companionFactories?: Array<() => Workflow>;
}
