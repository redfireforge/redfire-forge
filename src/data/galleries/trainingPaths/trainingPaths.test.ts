import { describe, it, expect } from 'vitest';
import { trainingPaths } from './index';
import { corePaths } from './corePaths';
import { contentPaths } from './contentPaths';
import { workflowPaths } from './workflowPaths';
import type { TrainingPath, TrainingManual } from './types';

/* ── Structural Integrity ── */

describe('trainingPaths barrel export', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(trainingPaths)).toBe(true);
    expect(trainingPaths.length).toBeGreaterThan(0);
  });

  it('is the union of corePaths + contentPaths + workflowPaths', () => {
    expect(trainingPaths).toEqual([...corePaths, ...contentPaths, ...workflowPaths]);
  });

  it('has exactly 17 paths', () => {
    expect(trainingPaths).toHaveLength(17);
  });
});

describe('corePaths module', () => {
  it('contains 4 paths', () => {
    expect(corePaths).toHaveLength(4);
  });

  it('has expected path IDs', () => {
    const ids = corePaths.map(p => p.id);
    expect(ids).toEqual(['versioning', 'workflow-patterns', 'auth-strategies', 'assertion-mastery']);
  });
});

describe('contentPaths module', () => {
  it('contains 4 paths', () => {
    expect(contentPaths).toHaveLength(4);
  });

  it('has expected path IDs', () => {
    const ids = contentPaths.map(p => p.id);
    expect(ids).toEqual(['requests', 'tests', 'catalog', 'data-mapper']);
  });
});

describe('workflowPaths module', () => {
  it('contains 9 paths', () => {
    expect(workflowPaths).toHaveLength(9);
  });

  it('has expected path IDs', () => {
    const ids = workflowPaths.map(p => p.id);
    expect(ids).toEqual([
      'wf-flow-control',
      'wf-api-patterns',
      'wf-diverse-apis',
      'wf-script-node',
      'wf-event-driven',
      'wf-async-correlation',
      'wf-orchestration',
      'wf-node-reference',
      'wf-runner',
    ]);
  });
});

/* ── Data Uniqueness ── */

describe('training path uniqueness', () => {
  it('has no duplicate path IDs', () => {
    const ids = trainingPaths.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate path names', () => {
    const names = trainingPaths.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has no duplicate manualPath values across all paths', () => {
    const allManualPaths: string[] = [];
    for (const path of trainingPaths) {
      for (const phase of path.phases) {
        for (const manual of phase.manuals) {
          if (manual.manualPath) {
            allManualPaths.push(manual.manualPath);
          }
        }
      }
    }
    const duplicates = allManualPaths.filter((p, i) => allManualPaths.indexOf(p) !== i);
    expect(duplicates).toEqual([]);
  });
});

/* ── Shape Validation ── */

describe('training path shape', () => {
  it.each(trainingPaths.map(p => [p.id, p] as const))('%s has required fields', (_id, path) => {
    expect(path.id).toBeTruthy();
    expect(path.name).toBeTruthy();
    expect(path.icon).toBeTruthy();
    expect(path.description).toBeTruthy();
    expect(path.phases.length).toBeGreaterThan(0);
  });

  it.each(trainingPaths.map(p => [p.id, p] as const))('%s phases have required fields', (_id, path) => {
    for (const phase of path.phases) {
      expect(phase.id).toBeDefined();
      expect(phase.name).toBeTruthy();
      expect(phase.manuals.length).toBeGreaterThan(0);
    }
  });

  it.each(trainingPaths.map(p => [p.id, p] as const))('%s manuals have required fields', (_id, path) => {
    for (const phase of path.phases) {
      for (const manual of phase.manuals) {
        expect(manual.title).toBeTruthy();
        expect(manual.description).toBeTruthy();
        expect(['easy', 'medium', 'advanced']).toContain(manual.difficulty);
      }
    }
  });
});

/* ── Manual Count Verification ── */

describe('manual counts per path', () => {
  function countManuals(path: TrainingPath): number {
    return path.phases.reduce((sum, phase) => sum + phase.manuals.length, 0);
  }

  it('versioning has 17 manuals (8 phases)', () => {
    const path = trainingPaths.find(p => p.id === 'versioning')!;
    expect(path.phases).toHaveLength(8);
    expect(countManuals(path)).toBe(17);
  });

  it('assertion-mastery has 17 manuals (4 phases)', () => {
    const path = trainingPaths.find(p => p.id === 'assertion-mastery')!;
    expect(path.phases).toHaveLength(4);
    expect(countManuals(path)).toBe(17);
  });

  it('requests has 14 manuals (3 phases)', () => {
    const path = trainingPaths.find(p => p.id === 'requests')!;
    expect(path.phases).toHaveLength(3);
    expect(countManuals(path)).toBe(14);
  });

  it('tests has 37 manuals (6 phases)', () => {
    const path = trainingPaths.find(p => p.id === 'tests')!;
    expect(path.phases).toHaveLength(6);
    expect(countManuals(path)).toBe(37);
  });

  it('catalog has 11 manuals (4 phases)', () => {
    const path = trainingPaths.find(p => p.id === 'catalog')!;
    expect(path.phases).toHaveLength(4);
    expect(countManuals(path)).toBe(11);
  });

  it('wf-flow-control has 6 manuals (3 phases)', () => {
    const path = trainingPaths.find(p => p.id === 'wf-flow-control')!;
    expect(path.phases).toHaveLength(3);
    expect(countManuals(path)).toBe(6);
  });

  it('wf-api-patterns has 6 manuals (2 phases)', () => {
    const path = trainingPaths.find(p => p.id === 'wf-api-patterns')!;
    expect(path.phases).toHaveLength(2);
    expect(countManuals(path)).toBe(6);
  });

  it('wf-diverse-apis has 5 manuals (2 phases)', () => {
    const path = trainingPaths.find(p => p.id === 'wf-diverse-apis')!;
    expect(path.phases).toHaveLength(2);
    expect(countManuals(path)).toBe(5);
  });

  it('wf-node-reference has 7 manuals (2 phases)', () => {
    const path = trainingPaths.find(p => p.id === 'wf-node-reference')!;
    expect(path.phases).toHaveLength(2);
    expect(countManuals(path)).toBe(7);
  });

  it('total manual count across all paths', () => {
    const total = trainingPaths.reduce((sum, path) => sum + countManuals(path), 0);
    expect(total).toBeGreaterThanOrEqual(100);
  });
});

/* ── ManualPath Format Validation ── */

describe('manualPath format', () => {
  const allManuals: { pathId: string; title: string; manual: TrainingManual }[] = [];
  for (const path of trainingPaths) {
    for (const phase of path.phases) {
      for (const manual of phase.manuals) {
        allManuals.push({ pathId: path.id, title: manual.title, manual });
      }
    }
  }

  it('all manualPath values end with .html', () => {
    const withPath = allManuals.filter(m => m.manual.manualPath);
    for (const { pathId, title, manual } of withPath) {
      expect(manual.manualPath, `${pathId}/${title}`).toMatch(/\.html$/);
    }
  });

  it('no manualPath contains backslashes', () => {
    const withPath = allManuals.filter(m => m.manual.manualPath);
    for (const { manual } of withPath) {
      expect(manual.manualPath).not.toContain('\\');
    }
  });

  it('no manualPath starts with a slash', () => {
    const withPath = allManuals.filter(m => m.manual.manualPath);
    for (const { manual } of withPath) {
      expect(manual.manualPath).not.toMatch(/^\//);
    }
  });
});

/* ── Type guard tests ── */

describe('TrainingPhase id types', () => {
  it('all phase IDs are either number or string', () => {
    for (const path of trainingPaths) {
      for (const phase of path.phases) {
        expect(typeof phase.id === 'number' || typeof phase.id === 'string').toBe(true);
      }
    }
  });
});
