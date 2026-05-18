import { useMemo, useState, useCallback } from 'react';
import { trainingPaths } from '../../../data/galleries/trainingPaths';
import type { 
  TrainingPath, 
  TrainingPhase, 
  TrainingManual, 
  TrainingProgress,
} from '../../../data/galleries/trainingPaths/types';

export type DifficultyFilter = 'all' | 'easy' | 'medium' | 'advanced';
export type StatusFilter = 'all' | 'not_started' | 'in_progress' | 'completed';

export interface SearchFilters {
  searchTerm: string;
  difficulty: DifficultyFilter;
  status: StatusFilter;
}

export interface FilteredManual {
  manual: TrainingManual;
  path: TrainingPath;
  phase: TrainingPhase;
}

export interface FilteredPath {
  path: TrainingPath;
  phases: FilteredPhase[];
  matchCount: number;
}

export interface FilteredPhase {
  phase: TrainingPhase;
  manuals: TrainingManual[];
}

/**
 * Filter manuals based on search criteria.
 */
export function filterManuals(
  filters: SearchFilters,
  progress: TrainingProgress
): FilteredPath[] {
  const { searchTerm, difficulty, status } = filters;
  const searchLower = searchTerm.toLowerCase().trim();
  
  const results: FilteredPath[] = [];

  for (const path of trainingPaths) {
    if (path.comingSoon) continue;

    const filteredPhases: FilteredPhase[] = [];
    let pathMatchCount = 0;

    for (const phase of path.phases) {
      const filteredManuals: TrainingManual[] = [];

      for (const manual of phase.manuals) {
        if (!manual.manualPath) continue;

        // Check difficulty filter
        if (difficulty !== 'all' && manual.difficulty !== difficulty) {
          continue;
        }

        // Check status filter
        if (status !== 'all') {
          const manualStatus = progress.manuals[manual.manualPath]?.status ?? 'not_started';
          if (manualStatus !== status) {
            continue;
          }
        }

        // Check search term
        if (searchLower) {
          const titleMatch = manual.title.toLowerCase().includes(searchLower);
          const descMatch = manual.description.toLowerCase().includes(searchLower);
          const pathMatch = path.name.toLowerCase().includes(searchLower);
          const phaseMatch = phase.name.toLowerCase().includes(searchLower);
          
          if (!titleMatch && !descMatch && !pathMatch && !phaseMatch) {
            continue;
          }
        }

        filteredManuals.push(manual);
        pathMatchCount++;
      }

      if (filteredManuals.length > 0) {
        filteredPhases.push({ phase, manuals: filteredManuals });
      }
    }

    if (filteredPhases.length > 0) {
      results.push({ path, phases: filteredPhases, matchCount: pathMatchCount });
    }
  }

  return results;
}

/**
 * Get all unique manuals that match the filters (flat list).
 */
export function getFlatFilteredManuals(
  filters: SearchFilters,
  progress: TrainingProgress
): FilteredManual[] {
  const results: FilteredManual[] = [];
  const filteredPaths = filterManuals(filters, progress);

  for (const fp of filteredPaths) {
    for (const fph of fp.phases) {
      for (const manual of fph.manuals) {
        results.push({
          manual,
          path: fp.path,
          phase: fph.phase,
        });
      }
    }
  }

  return results;
}

/**
 * Hook for searching and filtering training manuals.
 * 
 * Provides:
 * - Filter state management
 * - Filtered results (grouped by path/phase or flat)
 * - Filter setters
 * - Result counts
 */
export function useManualSearch(progress: TrainingProgress) {
  const [searchTerm, setSearchTerm] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filters: SearchFilters = useMemo(() => ({
    searchTerm,
    difficulty,
    status,
  }), [searchTerm, difficulty, status]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return searchTerm.trim() !== '' || difficulty !== 'all' || status !== 'all';
  }, [searchTerm, difficulty, status]);

  // Filtered paths (grouped)
  const filteredPaths = useMemo(
    () => filterManuals(filters, progress),
    [filters, progress]
  );

  // Flat list of filtered manuals
  const filteredManuals = useMemo(
    () => getFlatFilteredManuals(filters, progress),
    [filters, progress]
  );

  // Total match count
  const matchCount = useMemo(
    () => filteredManuals.length,
    [filteredManuals]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setDifficulty('all');
    setStatus('all');
  }, []);

  // Update search term with debounce-friendly setter
  const updateSearchTerm = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  return {
    // Current filter values
    searchTerm,
    difficulty,
    status,
    filters,
    hasActiveFilters,
    
    // Setters
    setSearchTerm: updateSearchTerm,
    setDifficulty,
    setStatus,
    clearFilters,
    
    // Results
    filteredPaths,
    filteredManuals,
    matchCount,
  };
}

export type UseManualSearchReturn = ReturnType<typeof useManualSearch>;
