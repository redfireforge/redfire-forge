/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadCliBaselines,
  saveCliBaselines,
  addCliBaseline,
  findLatestBaseline,
  findBaselineById,
  LATEST_BASELINE_SENTINEL,
  type CliBaseline,
} from './baselineStorage';
import type { TestSummary } from '../src/types';

// ── Mock node:fs ────────────────────────────────────────────────────────────

// baselineStorage.ts imports from 'fs' (not 'node:fs')
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { existsSync as mockExists, readFileSync as mockRead, writeFileSync as mockWrite, mkdirSync as mockMkdir } from 'fs';

const mockExistsFn = vi.mocked(mockExists);
const mockReadFn = vi.mocked(mockRead);
const mockWriteFn = vi.mocked(mockWrite);
const mockMkdirFn = vi.mocked(mockMkdir);

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<TestSummary> = {}): TestSummary {
  return {
    tps: 100,
    avgResponseTime: 50,
    minResponseTime: 10,
    maxResponseTime: 200,
    p50ResponseTime: 45,
    p95ResponseTime: 120,
    p99ResponseTime: 180,
    p999ResponseTime: 190,
    errorRate: 1,
    errorsByStatus: {},
    totalRequests: 1000,
    successfulRequests: 990,
    failedRequests: 10,
    failedValidations: 0,
    totalDurationMs: 10000,
    ...overrides,
  };
}

function makeBaseline(overrides: Partial<CliBaseline> = {}): CliBaseline {
  return {
    runId: 'run-001',
    label: 'Test baseline',
    savedAt: 1_700_000_000_000,
    projectPath: '/project/test.yaml',
    summary: makeSummary(),
    ...overrides,
  };
}

const TEST_DIR = '.redfireforge/baselines';

beforeEach(() => {
  resetAllMocks();
});

// ── loadCliBaselines ─────────────────────────────────────────────────────────

describe('loadCliBaselines', () => {
  it('returns empty array when store file does not exist', () => {
    mockExistsFn.mockReturnValue(false);
    expect(loadCliBaselines(TEST_DIR)).toEqual([]);
  });

  it('returns parsed baselines from existing store', () => {
    const baselines: CliBaseline[] = [makeBaseline()];
    mockExistsFn.mockReturnValue(true);
    mockReadFn.mockReturnValue(JSON.stringify(baselines));
    expect(loadCliBaselines(TEST_DIR)).toEqual(baselines);
  });

  it('returns empty array on invalid JSON', () => {
    mockExistsFn.mockReturnValue(true);
    mockReadFn.mockReturnValue('not-json{{');
    expect(loadCliBaselines(TEST_DIR)).toEqual([]);
  });

  it('returns empty array when parsed value is not an array', () => {
    mockExistsFn.mockReturnValue(true);
    mockReadFn.mockReturnValue(JSON.stringify({ data: 'wrong shape' }));
    expect(loadCliBaselines(TEST_DIR)).toEqual([]);
  });
});

// ── saveCliBaselines ─────────────────────────────────────────────────────────

describe('saveCliBaselines', () => {
  it('creates directory if it does not exist', () => {
    mockExistsFn.mockReturnValue(false);
    saveCliBaselines([], TEST_DIR);
    expect(mockMkdirFn).toHaveBeenCalledWith(expect.stringContaining('baselines'), { recursive: true });
  });

  it('writes the baselines to the store file as JSON', () => {
    mockExistsFn.mockReturnValue(true);
    const baselines: CliBaseline[] = [makeBaseline()];
    saveCliBaselines(baselines, TEST_DIR);
    expect(mockWriteFn).toHaveBeenCalledWith(
      expect.stringContaining('store.json'),
      JSON.stringify(baselines, null, 2),
    );
  });

  it('does not call mkdirSync when directory already exists', () => {
    mockExistsFn.mockReturnValue(true);
    saveCliBaselines([], TEST_DIR);
    expect(mockMkdirFn).not.toHaveBeenCalled();
  });
});

// ── addCliBaseline ───────────────────────────────────────────────────────────

describe('addCliBaseline', () => {
  it('appends a new baseline to an empty store', () => {
    mockExistsFn.mockReturnValue(false);
    const bl = makeBaseline();
    addCliBaseline(bl, TEST_DIR);
    const written = JSON.parse(vi.mocked(mockWrite).mock.calls[0][1] as string) as CliBaseline[];
    expect(written).toHaveLength(1);
    expect(written[0].runId).toBe('run-001');
  });

  it('replaces an existing entry with the same projectPath + runId', () => {
    const existing: CliBaseline[] = [makeBaseline({ label: 'old' })];
    mockExistsFn.mockReturnValue(true);
    mockReadFn.mockReturnValue(JSON.stringify(existing));
    addCliBaseline(makeBaseline({ label: 'new' }), TEST_DIR);
    const written = JSON.parse(vi.mocked(mockWrite).mock.calls[0][1] as string) as CliBaseline[];
    // Should have exactly one entry with the updated label
    expect(written).toHaveLength(1);
    expect(written[0].label).toBe('new');
  });

  it('appends rather than replaces when runId differs', () => {
    const existing: CliBaseline[] = [makeBaseline({ runId: 'run-001' })];
    mockExistsFn.mockReturnValue(true);
    mockReadFn.mockReturnValue(JSON.stringify(existing));
    addCliBaseline(makeBaseline({ runId: 'run-002' }), TEST_DIR);
    const written = JSON.parse(vi.mocked(mockWrite).mock.calls[0][1] as string) as CliBaseline[];
    expect(written).toHaveLength(2);
  });
});

// ── findLatestBaseline ───────────────────────────────────────────────────────

describe('findLatestBaseline', () => {
  it('returns null when no baselines exist', () => {
    mockExistsFn.mockReturnValue(false);
    expect(findLatestBaseline('/project/test.yaml', TEST_DIR)).toBeNull();
  });

  it('returns null when no baselines match the projectPath', () => {
    const baselines: CliBaseline[] = [makeBaseline({ projectPath: '/other/file.yaml' })];
    mockExistsFn.mockReturnValue(true);
    mockReadFn.mockReturnValue(JSON.stringify(baselines));
    expect(findLatestBaseline('/project/test.yaml', TEST_DIR)).toBeNull();
  });

  it('returns the most-recently-saved baseline for the given projectPath', () => {
    const older = makeBaseline({ runId: 'run-001', savedAt: 1_000, projectPath: '/project/test.yaml' });
    const newer = makeBaseline({ runId: 'run-002', savedAt: 2_000, projectPath: '/project/test.yaml' });
    mockExistsFn.mockReturnValue(true);
    mockReadFn.mockReturnValue(JSON.stringify([older, newer]));
    const result = findLatestBaseline('/project/test.yaml', TEST_DIR);
    expect(result?.runId).toBe('run-002');
  });

  it('ignores baselines for different projectPaths', () => {
    const bl1 = makeBaseline({ runId: 'run-001', savedAt: 9_999, projectPath: '/other/file.yaml' });
    const bl2 = makeBaseline({ runId: 'run-002', savedAt: 1_000, projectPath: '/project/test.yaml' });
    mockExistsFn.mockReturnValue(true);
    mockReadFn.mockReturnValue(JSON.stringify([bl1, bl2]));
    const result = findLatestBaseline('/project/test.yaml', TEST_DIR);
    expect(result?.runId).toBe('run-002');
  });
});

// ── findBaselineById ─────────────────────────────────────────────────────────

describe('findBaselineById', () => {
  it('returns null when not found', () => {
    mockExistsFn.mockReturnValue(false);
    expect(findBaselineById('missing-id', TEST_DIR)).toBeNull();
  });

  it('returns the matching baseline by runId', () => {
    const baselines: CliBaseline[] = [
      makeBaseline({ runId: 'run-001' }),
      makeBaseline({ runId: 'run-002' }),
    ];
    mockExistsFn.mockReturnValue(true);
    mockReadFn.mockReturnValue(JSON.stringify(baselines));
    expect(findBaselineById('run-002', TEST_DIR)?.runId).toBe('run-002');
  });
});

// ── LATEST_BASELINE_SENTINEL ────────────────────────────────────────────────

describe('LATEST_BASELINE_SENTINEL', () => {
  it('equals "latest-baseline"', () => {
    expect(LATEST_BASELINE_SENTINEL).toBe('latest-baseline');
  });
});
