import type { Workflow } from '../../features/workflow/types/workflow';

export type SampleCategory = 'api-patterns' | 'flow-control' | 'event-driven' | 'orchestration';
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
  /**
   * If set, marks this entry as a simulator/counterpart-demo for another
   * sample (the value is the id of the main sample). Used by the Template
   * Gallery to render a "Simulator for: X" badge and group the pair together.
   */
  simulatorOf?: string;
}
