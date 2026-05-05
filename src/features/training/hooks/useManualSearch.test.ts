/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useManualSearch, filterManuals, getFlatFilteredManuals } from './useManualSearch';
import type { TrainingProgress } from '../../../data/galleries/trainingPaths/types';

// Mock trainingPaths
vi.mock('../../../data/galleries/trainingPaths', () => ({
  trainingPaths: [
    {
      id: 'test-path',
      name: 'Test Suites',
      icon: '🧪',
      description: 'Testing path',
      phases: [
        {
          id: 1,
          name: 'Getting Started',
          manuals: [
            { title: 'Basics', description: 'Learn basics', difficulty: 'easy', manualPath: 'tests/basics.html' },
            { title: 'Intermediate', description: 'Learn more', difficulty: 'medium', manualPath: 'tests/intermediate.html' },
          ],
        },
        {
          id: 2,
          name: 'Advanced Topics',
          manuals: [
            { title: 'Advanced Testing', description: 'Complex tests', difficulty: 'advanced', manualPath: 'tests/advanced.html' },
          ],
        },
      ],
    },
    {
      id: 'workflow-path',
      name: 'Workflow Patterns',
      icon: '⚡',
      description: 'Workflow path',
      phases: [
        {
          id: 1,
          name: 'Flow Control',
          manuals: [
            { title: 'Branching', description: 'If-else logic', difficulty: 'easy', manualPath: 'workflow/branching.html' },
            { title: 'Loops', description: 'Loop patterns', difficulty: 'medium', manualPath: 'workflow/loops.html' },
          ],
        },
      ],
    },
    {
      id: 'coming-soon',
      name: 'Coming Soon',
      icon: '🔜',
      description: 'Future content',
      comingSoon: true,
      phases: [],
    },
  ],
}));

describe('useManualSearch', () => {
  const emptyProgress: TrainingProgress = {
    manuals: {},
    lastUpdated: Date.now(),
    streak: 0,
  };

  const progressWithStatuses: TrainingProgress = {
    manuals: {
      'tests/basics.html': { manualPath: 'tests/basics.html', status: 'completed', completedAt: Date.now() },
      'tests/intermediate.html': { manualPath: 'tests/intermediate.html', status: 'in_progress', lastViewedAt: Date.now() },
      'workflow/branching.html': { manualPath: 'workflow/branching.html', status: 'in_progress', lastViewedAt: Date.now() },
    },
    lastUpdated: Date.now(),
    streak: 1,
  };

  describe('filterManuals', () => {
    it('returns all manuals with no filters', () => {
      const results = filterManuals(
        { searchTerm: '', difficulty: 'all', status: 'all' },
        emptyProgress
      );

      expect(results.length).toBe(2); // 2 paths (excluding coming soon)
      expect(results[0].matchCount).toBe(3); // Test Suites has 3 manuals
      expect(results[1].matchCount).toBe(2); // Workflow Patterns has 2 manuals
    });

    it('filters by search term in title', () => {
      const results = filterManuals(
        { searchTerm: 'basics', difficulty: 'all', status: 'all' },
        emptyProgress
      );

      expect(results.length).toBe(1);
      expect(results[0].phases[0].manuals.length).toBe(1);
      expect(results[0].phases[0].manuals[0].title).toBe('Basics');
    });

    it('filters by search term in description', () => {
      const results = filterManuals(
        { searchTerm: 'if-else', difficulty: 'all', status: 'all' },
        emptyProgress
      );

      expect(results.length).toBe(1);
      expect(results[0].path.name).toBe('Workflow Patterns');
      expect(results[0].phases[0].manuals[0].title).toBe('Branching');
    });

    it('filters by search term in path name', () => {
      const results = filterManuals(
        { searchTerm: 'workflow', difficulty: 'all', status: 'all' },
        emptyProgress
      );

      expect(results.length).toBe(1);
      expect(results[0].path.name).toBe('Workflow Patterns');
      expect(results[0].matchCount).toBe(2); // All manuals in this path match
    });

    it('filters by difficulty easy', () => {
      const results = filterManuals(
        { searchTerm: '', difficulty: 'easy', status: 'all' },
        emptyProgress
      );

      const allManuals = results.flatMap(r => r.phases.flatMap(p => p.manuals));
      expect(allManuals.every(m => m.difficulty === 'easy')).toBe(true);
      expect(allManuals.length).toBe(2); // Basics + Branching
    });

    it('filters by difficulty medium', () => {
      const results = filterManuals(
        { searchTerm: '', difficulty: 'medium', status: 'all' },
        emptyProgress
      );

      const allManuals = results.flatMap(r => r.phases.flatMap(p => p.manuals));
      expect(allManuals.every(m => m.difficulty === 'medium')).toBe(true);
      expect(allManuals.length).toBe(2); // Intermediate + Loops
    });

    it('filters by difficulty advanced', () => {
      const results = filterManuals(
        { searchTerm: '', difficulty: 'advanced', status: 'all' },
        emptyProgress
      );

      const allManuals = results.flatMap(r => r.phases.flatMap(p => p.manuals));
      expect(allManuals.every(m => m.difficulty === 'advanced')).toBe(true);
      expect(allManuals.length).toBe(1); // Advanced Testing
    });

    it('filters by status completed', () => {
      const results = filterManuals(
        { searchTerm: '', difficulty: 'all', status: 'completed' },
        progressWithStatuses
      );

      expect(results.length).toBe(1);
      expect(results[0].phases[0].manuals[0].title).toBe('Basics');
    });

    it('filters by status in_progress', () => {
      const results = filterManuals(
        { searchTerm: '', difficulty: 'all', status: 'in_progress' },
        progressWithStatuses
      );

      const allManuals = results.flatMap(r => r.phases.flatMap(p => p.manuals));
      expect(allManuals.length).toBe(2); // Intermediate + Branching
    });

    it('filters by status not_started', () => {
      const results = filterManuals(
        { searchTerm: '', difficulty: 'all', status: 'not_started' },
        progressWithStatuses
      );

      const allManuals = results.flatMap(r => r.phases.flatMap(p => p.manuals));
      expect(allManuals.length).toBe(2); // Advanced Testing + Loops
    });

    it('combines multiple filters', () => {
      const results = filterManuals(
        { searchTerm: '', difficulty: 'easy', status: 'in_progress' },
        progressWithStatuses
      );

      expect(results.length).toBe(1);
      expect(results[0].phases[0].manuals[0].title).toBe('Branching');
    });

    it('excludes coming soon paths', () => {
      const results = filterManuals(
        { searchTerm: 'coming', difficulty: 'all', status: 'all' },
        emptyProgress
      );

      expect(results.length).toBe(0);
    });
  });

  describe('getFlatFilteredManuals', () => {
    it('returns flat list of matching manuals', () => {
      const results = getFlatFilteredManuals(
        { searchTerm: '', difficulty: 'easy', status: 'all' },
        emptyProgress
      );

      expect(results.length).toBe(2);
      expect(results[0].manual.title).toBe('Basics');
      expect(results[0].path.name).toBe('Test Suites');
      expect(results[0].phase.name).toBe('Getting Started');
    });
  });

  describe('useManualSearch hook', () => {
    it('initializes with default filter values', () => {
      const { result } = renderHook(() => useManualSearch(emptyProgress));

      expect(result.current.searchTerm).toBe('');
      expect(result.current.difficulty).toBe('all');
      expect(result.current.status).toBe('all');
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('updates search term', () => {
      const { result } = renderHook(() => useManualSearch(emptyProgress));

      act(() => {
        result.current.setSearchTerm('basics');
      });

      expect(result.current.searchTerm).toBe('basics');
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('updates difficulty filter', () => {
      const { result } = renderHook(() => useManualSearch(emptyProgress));

      act(() => {
        result.current.setDifficulty('medium');
      });

      expect(result.current.difficulty).toBe('medium');
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('updates status filter', () => {
      const { result } = renderHook(() => useManualSearch(emptyProgress));

      act(() => {
        result.current.setStatus('completed');
      });

      expect(result.current.status).toBe('completed');
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('clears all filters', () => {
      const { result } = renderHook(() => useManualSearch(emptyProgress));

      act(() => {
        result.current.setSearchTerm('test');
        result.current.setDifficulty('easy');
        result.current.setStatus('completed');
      });

      expect(result.current.hasActiveFilters).toBe(true);

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.searchTerm).toBe('');
      expect(result.current.difficulty).toBe('all');
      expect(result.current.status).toBe('all');
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('computes filteredPaths correctly', () => {
      const { result } = renderHook(() => useManualSearch(emptyProgress));

      expect(result.current.filteredPaths.length).toBe(2);

      act(() => {
        result.current.setDifficulty('advanced');
      });

      expect(result.current.filteredPaths.length).toBe(1);
      expect(result.current.filteredPaths[0].path.name).toBe('Test Suites');
    });

    it('computes matchCount correctly', () => {
      const { result } = renderHook(() => useManualSearch(emptyProgress));

      expect(result.current.matchCount).toBe(5); // All manuals

      act(() => {
        result.current.setDifficulty('easy');
      });

      expect(result.current.matchCount).toBe(2);
    });

    it('returns filters object', () => {
      const { result } = renderHook(() => useManualSearch(emptyProgress));

      act(() => {
        result.current.setSearchTerm('test');
        result.current.setDifficulty('medium');
        result.current.setStatus('in_progress');
      });

      expect(result.current.filters).toEqual({
        searchTerm: 'test',
        difficulty: 'medium',
        status: 'in_progress',
      });
    });
  });
});
