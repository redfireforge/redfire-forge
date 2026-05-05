/**
 * Training Path definitions for the Gallery.
 *
 * Split into domain modules for maintainability:
 * - corePaths: Versioning, Workflow Patterns, Auth Strategies, Assertion Mastery
 * - contentPaths: Requests, Tests, API Catalog
 * - workflowPaths: 8 workflow category paths (Flow Control, API Patterns, etc.)
 * - manualMetadata: Timestamps for "What's New" detection
 */

export type {
  TrainingManual,
  TrainingPhase,
  TrainingPath,
  ManualStatus,
  ManualProgress,
  TrainingProgress,
  ManualMetadata,
} from './types';

import type { TrainingPath } from './types';
import { corePaths } from './corePaths';
import { contentPaths } from './contentPaths';
import { workflowPaths } from './workflowPaths';

// Re-export metadata utilities
export { manualMetadata, metadataByPath, getManualMetadata } from './manualMetadata';

/** All registered training paths. */
export const trainingPaths: TrainingPath[] = [
  ...corePaths,
  ...contentPaths,
  ...workflowPaths,
];
