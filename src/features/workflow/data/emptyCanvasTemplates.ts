/**
 * Template suggestions shown on empty workflow canvas.
 * These are curated starters from the gallery catalog.
 */
import type { SampleWorkflowEntry } from '../../../data/galleries/workflows/types';
import { sampleWorkflowCatalog } from '../../../data/galleries/workflows';

export interface EmptyCanvasTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodeCount: number;
  difficulty: 'easy' | 'medium' | 'advanced';
  galleryEntry: SampleWorkflowEntry;
}

const FEATURED_TEMPLATE_IDS = [
  'sample-workflow-001',           // Create → Extract → Verify (sequential basics)
  'sample-workflow-parallel',      // Parallel API Calls (fork/join)
  'sample-workflow-branching',     // Conditional Branching
  'perf-workflow-simple',          // Perf: Simple POST → GET (minimal)
];

export const emptyCanvasTemplates: EmptyCanvasTemplate[] = FEATURED_TEMPLATE_IDS
  .map(id => {
    const entry = sampleWorkflowCatalog.find(e => e.id === id);
    if (!entry) return null;
    return {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      icon: entry.icon,
      nodeCount: entry.nodeCount,
      difficulty: entry.difficulty,
      galleryEntry: entry,
    };
  })
  .filter((t): t is EmptyCanvasTemplate => t !== null);
