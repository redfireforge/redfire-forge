import { describe, it, expect } from 'vitest';
import { executionModes, getExecutionModeMeta } from './executionMode';

describe('executionModes', () => {
  it('exports array of all execution modes', () => {
    expect(executionModes).toEqual([
      'sequential',
      'batch',
      'pool',
      'load-profile',
      'workflow',
    ]);
  });

  it('contains exactly 5 modes', () => {
    expect(executionModes).toHaveLength(5);
  });

  it('contains only unique values', () => {
    const uniqueModes = new Set(executionModes);
    expect(uniqueModes.size).toBe(executionModes.length);
  });
});

describe('getExecutionModeMeta', () => {
  it('returns metadata for sequential mode', () => {
    const meta = getExecutionModeMeta('sequential');
    expect(meta).toEqual({
      label: 'Sequential',
      title: 'Executes requests one by one in sequence. No parallelism.',
      hint: 'Executes one request at a time in order - no parallelism',
      progressLabel: 'Sequential',
    });
  });

  it('returns metadata for batch mode', () => {
    const meta = getExecutionModeMeta('batch');
    expect(meta).toEqual({
      label: 'Batch',
      title: 'Fires N requests, waits for ALL to finish, then fires the next N.',
      hint: 'Fires N requests, waits for all to complete, then fires next N',
      progressLabel: 'Batch',
    });
  });

  it('returns metadata for pool mode', () => {
    const meta = getExecutionModeMeta('pool');
    expect(meta).toEqual({
      label: 'Continuous Pool',
      title: 'Maintains N concurrent requests at all times.',
      hint: 'Keeps N requests in-flight at all times - a new request starts as soon as one finishes',
      progressLabel: 'Continuous Pool',
    });
  });

  it('returns metadata for load-profile mode', () => {
    const meta = getExecutionModeMeta('load-profile');
    expect(meta).toEqual({
      label: 'Load Profile',
      title: 'Time-based load profiles: ramp-up, sustained, spike, soak',
      hint: 'Time-based execution with dynamic concurrency shaping',
      progressLabel: 'Load Profile',
    });
  });

  it('returns metadata for workflow mode', () => {
    const meta = getExecutionModeMeta('workflow');
    expect(meta).toEqual({
      label: 'Workflow',
      title: 'Multi-step workflow with variable chaining between requests',
      hint: 'Multi-step chain: each request can extract values for the next step',
      progressLabel: 'Workflow',
    });
  });

  it('returns all required metadata fields for each mode', () => {
    executionModes.forEach((mode) => {
      const meta = getExecutionModeMeta(mode);
      expect(meta).toHaveProperty('label');
      expect(meta).toHaveProperty('title');
      expect(meta).toHaveProperty('hint');
      expect(meta).toHaveProperty('progressLabel');
      expect(typeof meta.label).toBe('string');
      expect(typeof meta.title).toBe('string');
      expect(typeof meta.hint).toBe('string');
      expect(typeof meta.progressLabel).toBe('string');
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.title.length).toBeGreaterThan(0);
      expect(meta.hint.length).toBeGreaterThan(0);
      expect(meta.progressLabel.length).toBeGreaterThan(0);
    });
  });

  it('returns unique labels for each mode', () => {
    const labels = executionModes.map(mode => getExecutionModeMeta(mode).label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(executionModes.length);
  });

  it('has consistent progressLabel matching label for most modes', () => {
    const meta = getExecutionModeMeta('sequential');
    expect(meta.progressLabel).toBe(meta.label);
  });

  it('handles all modes without throwing', () => {
    executionModes.forEach((mode) => {
      expect(() => getExecutionModeMeta(mode)).not.toThrow();
    });
  });
});
