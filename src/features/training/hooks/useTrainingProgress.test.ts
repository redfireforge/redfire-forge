/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useTrainingProgress,
  calculatePathProgress,
  calculateOverallStats,
  findLastViewedInProgress,
} from './useTrainingProgress';
import type { TrainingProgress, TrainingPath } from '../../../data/galleries/trainingPaths/types';
import * as storage from '../../../shared/utils/storage';

// Mock storage module
vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
}));

// Mock training paths
vi.mock('../../../data/galleries/trainingPaths', () => ({
  trainingPaths: [
    {
      id: 'test-path',
      name: 'Test Path',
      icon: '🧪',
      description: 'A test path',
      phases: [
        {
          id: 1,
          name: 'Phase 1',
          manuals: [
            { title: 'Manual 1', description: 'Desc 1', difficulty: 'easy', manualPath: 'test/manual1.html' },
            { title: 'Manual 2', description: 'Desc 2', difficulty: 'medium', manualPath: 'test/manual2.html' },
          ],
        },
        {
          id: 2,
          name: 'Phase 2',
          manuals: [
            { title: 'Manual 3', description: 'Desc 3', difficulty: 'advanced', manualPath: 'test/manual3.html' },
          ],
        },
      ],
    },
    {
      id: 'coming-soon-path',
      name: 'Coming Soon Path',
      icon: '🔜',
      description: 'Not available yet',
      comingSoon: true,
      phases: [{ id: 1, name: 'Phase 1', manuals: [] }],
    },
  ],
}));

const mockReadKey = vi.mocked(storage.readKey);
const mockWriteKey = vi.mocked(storage.writeKey);

describe('useTrainingProgress', () => {
  beforeEach(() => {
    resetAllMocks();
    mockReadKey.mockResolvedValue(null);
    mockWriteKey.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with empty progress when no stored data', async () => {
    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.progress.manuals).toEqual({});
    expect(result.current.progress.streak).toBe(0);
  });

  it('loads existing progress from storage', async () => {
    const existingProgress: TrainingProgress = {
      manuals: {
        'test/manual1.html': {
          manualPath: 'test/manual1.html',
          status: 'completed',
          lastViewedAt: 1000,
          completedAt: 1000,
        },
      },
      lastUpdated: 1000,
      streak: 3,
    };

    mockReadKey.mockResolvedValue(JSON.stringify(existingProgress));

    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.progress.manuals['test/manual1.html']?.status).toBe('completed');
    expect(result.current.progress.streak).toBe(3);
  });

  it('updates manual status and saves to storage', async () => {
    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateManualStatus('test/manual1.html', 'in_progress');
    });

    expect(result.current.progress.manuals['test/manual1.html']?.status).toBe('in_progress');
    expect(mockWriteKey).toHaveBeenCalled();
  });

  it('marks manual as in_progress when first viewed', async () => {
    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.markViewed('test/manual1.html');
    });

    expect(result.current.progress.manuals['test/manual1.html']?.status).toBe('in_progress');
    expect(result.current.progress.manuals['test/manual1.html']?.lastViewedAt).toBeDefined();
  });

  it('does not change status when viewing already completed manual', async () => {
    const existingProgress: TrainingProgress = {
      manuals: {
        'test/manual1.html': {
          manualPath: 'test/manual1.html',
          status: 'completed',
          lastViewedAt: 1000,
          completedAt: 1000,
        },
      },
      lastUpdated: 1000,
      streak: 1,
    };

    mockReadKey.mockResolvedValue(JSON.stringify(existingProgress));

    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.markViewed('test/manual1.html');
    });

    // Status should remain completed, only lastViewedAt should update
    expect(result.current.progress.manuals['test/manual1.html']?.status).toBe('completed');
  });

  it('returns correct manual status', async () => {
    const existingProgress: TrainingProgress = {
      manuals: {
        'test/manual1.html': {
          manualPath: 'test/manual1.html',
          status: 'in_progress',
          lastViewedAt: 1000,
        },
      },
      lastUpdated: 1000,
      streak: 0,
    };

    mockReadKey.mockResolvedValue(JSON.stringify(existingProgress));

    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getManualStatus('test/manual1.html')).toBe('in_progress');
    expect(result.current.getManualStatus('test/manual2.html')).toBe('not_started');
    expect(result.current.getManualStatus('nonexistent.html')).toBe('not_started');
  });

  it('resets progress', async () => {
    const existingProgress: TrainingProgress = {
      manuals: {
        'test/manual1.html': {
          manualPath: 'test/manual1.html',
          status: 'completed',
          lastViewedAt: 1000,
          completedAt: 1000,
        },
      },
      lastUpdated: 1000,
      streak: 5,
    };

    mockReadKey.mockResolvedValue(JSON.stringify(existingProgress));

    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.progress.streak).toBe(5);

    await act(async () => {
      await result.current.resetProgress();
    });

    expect(result.current.progress.manuals).toEqual({});
    expect(result.current.progress.streak).toBe(0);
  });

  it('handles storage read errors gracefully', async () => {
    mockReadKey.mockRejectedValue(new Error('Storage error'));

    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fall back to empty progress
    expect(result.current.progress.manuals).toEqual({});
  });
});

describe('calculatePathProgress', () => {
  const testPath: TrainingPath = {
    id: 'test',
    name: 'Test',
    icon: '🧪',
    description: 'Test path',
    phases: [
      {
        id: 1,
        name: 'Phase 1',
        manuals: [
          { title: 'M1', description: 'D1', difficulty: 'easy', manualPath: 'p1.html' },
          { title: 'M2', description: 'D2', difficulty: 'medium', manualPath: 'p2.html' },
          { title: 'M3', description: 'D3', difficulty: 'advanced', manualPath: 'p3.html' },
        ],
      },
    ],
  };

  it('calculates zero progress for empty progress', () => {
    const progress: TrainingProgress = {
      manuals: {},
      lastUpdated: 0,
      streak: 0,
    };

    const result = calculatePathProgress(testPath, progress);

    expect(result.completed).toBe(0);
    expect(result.inProgress).toBe(0);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(0);
  });

  it('calculates partial progress correctly', () => {
    const progress: TrainingProgress = {
      manuals: {
        'p1.html': { manualPath: 'p1.html', status: 'completed', lastViewedAt: 1000, completedAt: 1000 },
        'p2.html': { manualPath: 'p2.html', status: 'in_progress', lastViewedAt: 1000 },
      },
      lastUpdated: 1000,
      streak: 1,
    };

    const result = calculatePathProgress(testPath, progress);

    expect(result.completed).toBe(1);
    expect(result.inProgress).toBe(1);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(33); // 1/3 = 33%
  });

  it('calculates 100% for all completed', () => {
    const progress: TrainingProgress = {
      manuals: {
        'p1.html': { manualPath: 'p1.html', status: 'completed', lastViewedAt: 1000, completedAt: 1000 },
        'p2.html': { manualPath: 'p2.html', status: 'completed', lastViewedAt: 1000, completedAt: 1000 },
        'p3.html': { manualPath: 'p3.html', status: 'completed', lastViewedAt: 1000, completedAt: 1000 },
      },
      lastUpdated: 1000,
      streak: 3,
    };

    const result = calculatePathProgress(testPath, progress);

    expect(result.completed).toBe(3);
    expect(result.inProgress).toBe(0);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(100);
  });

  it('handles paths without manualPath (skips them)', () => {
    const pathWithMissingManualPath: TrainingPath = {
      id: 'test',
      name: 'Test',
      icon: '🧪',
      description: 'Test path',
      phases: [
        {
          id: 1,
          name: 'Phase 1',
          manuals: [
            { title: 'M1', description: 'D1', difficulty: 'easy', manualPath: 'p1.html' },
            { title: 'M2', description: 'D2', difficulty: 'medium' }, // No manualPath
          ],
        },
      ],
    };

    const progress: TrainingProgress = {
      manuals: {},
      lastUpdated: 0,
      streak: 0,
    };

    const result = calculatePathProgress(pathWithMissingManualPath, progress);

    expect(result.total).toBe(1); // Only counts manual with manualPath
  });

  it('returns 0% when no manuals have manualPath', () => {
    const emptyPath: TrainingPath = {
      id: 'e',
      name: 'E',
      icon: '🧪',
      description: 'd',
      phases: [{ id: 1, name: 'P', manuals: [{ title: 'm', description: '', difficulty: 'easy' }] }],
    };
    const progress: TrainingProgress = { manuals: {}, lastUpdated: 0, streak: 0 };
    const result = calculatePathProgress(emptyPath, progress);
    expect(result.total).toBe(0);
    expect(result.percentage).toBe(0);
  });
});

describe('calculateOverallStats', () => {
  it('calculates overall stats across all paths', () => {
    const progress: TrainingProgress = {
      manuals: {
        'test/manual1.html': { manualPath: 'test/manual1.html', status: 'completed', lastViewedAt: 1000, completedAt: 1000 },
        'test/manual2.html': { manualPath: 'test/manual2.html', status: 'in_progress', lastViewedAt: 1000 },
      },
      lastUpdated: 1000,
      streak: 2,
    };

    const stats = calculateOverallStats(progress);

    expect(stats.totalCompleted).toBe(1);
    expect(stats.totalInProgress).toBe(1);
    expect(stats.totalManuals).toBe(3); // 3 manuals in mock path
    expect(stats.pathsStarted).toBe(1);
    expect(stats.totalPaths).toBe(1); // Excludes comingSoon path
    expect(stats.streak).toBe(2);
  });

  it('excludes comingSoon paths from total count', () => {
    const progress: TrainingProgress = {
      manuals: {},
      lastUpdated: 0,
      streak: 0,
    };

    const stats = calculateOverallStats(progress);

    expect(stats.totalPaths).toBe(1); // Only test-path, not coming-soon-path
  });
});

describe('findLastViewedInProgress', () => {
  it('returns null when no in-progress manuals', () => {
    const progress: TrainingProgress = {
      manuals: {
        'test/manual1.html': { manualPath: 'test/manual1.html', status: 'completed', lastViewedAt: 1000, completedAt: 1000 },
      },
      lastUpdated: 1000,
      streak: 1,
    };

    const result = findLastViewedInProgress(progress);
    expect(result).toBeNull();
  });

  it('returns the most recently viewed in-progress manual', () => {
    const progress: TrainingProgress = {
      manuals: {
        'test/manual1.html': { manualPath: 'test/manual1.html', status: 'in_progress', lastViewedAt: 1000 },
        'test/manual2.html': { manualPath: 'test/manual2.html', status: 'in_progress', lastViewedAt: 2000 },
        'test/manual3.html': { manualPath: 'test/manual3.html', status: 'in_progress', lastViewedAt: 1500 },
      },
      lastUpdated: 2000,
      streak: 0,
    };

    const result = findLastViewedInProgress(progress);
    expect(result?.manualPath).toBe('test/manual2.html');
  });

  it('findLastViewedInProgress prefers higher lastViewedAt when prior entry lacks it', () => {
    const progress: TrainingProgress = {
      manuals: {
        'a.html': { manualPath: 'a.html', status: 'in_progress', lastViewedAt: 100 },
        'b.html': { manualPath: 'b.html', status: 'in_progress' },
      },
      lastUpdated: 100,
      streak: 0,
    };
    expect(findLastViewedInProgress(progress)?.manualPath).toBe('a.html');
  });
});

describe('streak calculation', () => {
  it('starts streak at 1 on first completion', async () => {
    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateManualStatus('test/manual1.html', 'completed');
    });

    expect(result.current.progress.streak).toBe(1);
    expect(result.current.progress.lastCompletionDate).toBeDefined();
  });

  it('does not increment streak for same-day completions', async () => {
    const today = new Date().toISOString().split('T')[0];
    const existingProgress: TrainingProgress = {
      manuals: {
        'test/manual1.html': {
          manualPath: 'test/manual1.html',
          status: 'completed',
          lastViewedAt: Date.now() - 1000,
          completedAt: Date.now() - 1000,
        },
      },
      lastUpdated: Date.now() - 1000,
      streak: 1,
      lastCompletionDate: today,
    };

    mockReadKey.mockResolvedValue(JSON.stringify(existingProgress));

    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateManualStatus('test/manual2.html', 'completed');
    });

    expect(result.current.progress.streak).toBe(1);
  });

  it('increments streak on consecutive-day completion', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];

    const existingProgress: TrainingProgress = {
      manuals: {},
      lastUpdated: 1000,
      streak: 2,
      lastCompletionDate: yStr,
    };

    mockReadKey.mockResolvedValue(JSON.stringify(existingProgress));

    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateManualStatus('test/manual1.html', 'completed');
    });

    expect(result.current.progress.streak).toBe(3);
  });

  it('resets streak when last completion was not consecutive', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    const oldStr = old.toISOString().split('T')[0];

    const existingProgress: TrainingProgress = {
      manuals: {},
      lastUpdated: 1000,
      streak: 4,
      lastCompletionDate: oldStr,
    };

    mockReadKey.mockResolvedValue(JSON.stringify(existingProgress));

    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateManualStatus('test/manual1.html', 'completed');
    });

    expect(result.current.progress.streak).toBe(1);
  });
});

describe('useTrainingProgress edge cases', () => {
  it('ignores invalid JSON in storage', async () => {
    mockReadKey.mockResolvedValue('{broken');

    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.progress.manuals).toEqual({});
  });

  it('exposes getManualProgress and lastViewedInProgress from loaded state', async () => {
    const existingProgress: TrainingProgress = {
      manuals: {
        'test/manual2.html': {
          manualPath: 'test/manual2.html',
          status: 'in_progress',
          lastViewedAt: 5000,
        },
      },
      lastUpdated: 5000,
      streak: 0,
    };

    mockReadKey.mockResolvedValue(JSON.stringify(existingProgress));

    const { result } = renderHook(() => useTrainingProgress());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getManualProgress('test/manual2.html')?.status).toBe('in_progress');
    expect(result.current.lastViewedInProgress?.manualPath).toBe('test/manual2.html');
  });
});
