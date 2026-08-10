/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadTestRuns = vi.fn();
const loadBaselines = vi.fn();
const saveBaselines = vi.fn();
const markAsBaseline = vi.fn();

vi.mock('../../../../../src/shared/utils/storage', () => ({
  loadTestRuns: (...args: unknown[]) => loadTestRuns(...args),
}));

vi.mock('../../../../../src/features/results/utils/runBaselines', () => ({
  loadBaselines: (...args: unknown[]) => loadBaselines(...args),
  saveBaselines: (...args: unknown[]) => saveBaselines(...args),
  markAsBaseline: (...args: unknown[]) => markAsBaseline(...args),
}));

describe('TH-20 dataset health', () => {
  beforeEach(() => {
    vi.resetModules();
    loadTestRuns.mockReset();
    loadBaselines.mockReset();
    saveBaselines.mockReset();
    markAsBaseline.mockReset();
    delete (window as unknown as Record<string, unknown>).__demoSeedTestRun;
    delete (window as unknown as Record<string, unknown>).__demoDeleteTestRuns;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isTh20DatasetHealthy requires 2 runs and 2 matching baselines', async () => {
    const { isTh20DatasetHealthy } = await import('./th-demo-helpers');

    loadTestRuns.mockResolvedValue([{ id: 'demo-th20-run-0-1', timestamp: 1 }]);
    loadBaselines.mockResolvedValue([{ runId: 'demo-th20-run-0-1', markedAt: 1 }]);
    expect(await isTh20DatasetHealthy()).toBe(false);

    loadTestRuns.mockResolvedValue([
      { id: 'demo-th20-run-0-1', timestamp: 1 },
      { id: 'demo-th20-run-1-2', timestamp: 2 },
    ]);
    loadBaselines.mockResolvedValue([
      { runId: 'demo-th20-run-0-1', markedAt: 1 },
      { runId: 'orphan-other', markedAt: 2 },
    ]);
    expect(await isTh20DatasetHealthy()).toBe(false);

    loadBaselines.mockResolvedValue([
      { runId: 'demo-th20-run-0-1', markedAt: 1 },
      { runId: 'demo-th20-run-1-2', markedAt: 2 },
    ]);
    expect(await isTh20DatasetHealthy()).toBe(true);
  });

  it('ensureTh20RunsExist reseeds when only one run remains after delete', async () => {
    const seeded: unknown[] = [];
    const deleted: string[] = [];
    (window as unknown as Record<string, unknown>).__demoDeleteTestRuns = async (prefix: string) => {
      deleted.push(prefix);
    };
    (window as unknown as Record<string, unknown>).__demoSeedTestRun = async (run: unknown) => {
      seeded.push(run);
    };

    loadTestRuns.mockResolvedValue([{ id: 'demo-th20-run-0-old', timestamp: 1 }]);
    loadBaselines.mockResolvedValue([]);
    markAsBaseline.mockImplementation(async (runId: string, label?: string) => [
      { runId, markedAt: Date.now(), label },
    ]);
    saveBaselines.mockResolvedValue(undefined);

    const { ensureTh20RunsExist } = await import('./th-demo-helpers');
    const repaired = await ensureTh20RunsExist();

    expect(repaired).toBe(true);
    expect(deleted).toContain('demo-th20-run');
    expect(seeded).toHaveLength(2);
    expect(markAsBaseline).toHaveBeenCalledTimes(2);
  });

  it('ensureTh20RunsExist is a no-op when dataset is healthy', async () => {
    loadTestRuns.mockResolvedValue([
      { id: 'demo-th20-run-0-1', timestamp: 1 },
      { id: 'demo-th20-run-1-2', timestamp: 2 },
    ]);
    loadBaselines.mockResolvedValue([
      { runId: 'demo-th20-run-0-1', markedAt: 1 },
      { runId: 'demo-th20-run-1-2', markedAt: 2 },
    ]);

    const { ensureTh20RunsExist } = await import('./th-demo-helpers');
    expect(await ensureTh20RunsExist()).toBe(false);
  });
});
