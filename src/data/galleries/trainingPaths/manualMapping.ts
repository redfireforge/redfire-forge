/**
 * Builds a reverse mapping from sample IDs to related training manuals.
 * This allows gallery entries to display links to their associated manuals.
 */

import type { RelatedManual, GalleryDifficulty } from '../types';
import type { TrainingPath } from './types';
import { trainingPaths } from './index';

export interface ManualsBySampleId {
  [sampleId: string]: RelatedManual[];
}

/**
 * Scans all training paths and builds a map of sampleId → related manuals.
 * Called once at module load time.
 */
function buildManualMapping(paths: TrainingPath[]): ManualsBySampleId {
  const map: ManualsBySampleId = {};

  for (const path of paths) {
    for (const phase of path.phases) {
      for (const manual of phase.manuals) {
        if (manual.sampleId && manual.manualPath) {
          if (!map[manual.sampleId]) {
            map[manual.sampleId] = [];
          }
          map[manual.sampleId].push({
            title: manual.title,
            description: manual.description,
            difficulty: manual.difficulty as GalleryDifficulty,
            path: manual.manualPath,
          });
        }
      }
    }
  }

  return map;
}

/** Pre-computed mapping from sample IDs to their related training manuals. */
export const manualsBySampleId: ManualsBySampleId = buildManualMapping(trainingPaths);

/**
 * Returns the related manuals for a given sample ID, or undefined if none exist.
 */
export function getRelatedManuals(sampleId: string): RelatedManual[] | undefined {
  const manuals = manualsBySampleId[sampleId];
  return manuals && manuals.length > 0 ? manuals : undefined;
}
