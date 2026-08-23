/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { TestRun } from '@shared/types';

const mockResolve = vi.fn();
const mockSave = vi.fn();
const mockCompute = vi.fn();

vi.mock('../utils/slaTargets', () => ({
  resolveTargetsForRun: (...args: unknown[]) => mockResolve(...args),
  saveRunSlaTargets: (...args: unknown[]) => mockSave(...args),
  computeRunSlaStatus: (...args: unknown[]) => mockCompute(...args),
}));

import { useSlaManagement } from './useSlaManagement';

function makeRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    id: 'run-1',
    config: {},
    results: [],
    ...overrides,
  } as unknown as TestRun;
}

describe('useSlaManagement', () => {
  beforeEach(() => {
    mockResolve.mockReset();
    mockSave.mockReset();
    mockCompute.mockReset();
    mockResolve.mockResolvedValue({ targets: [], scope: null });
    mockSave.mockResolvedValue(undefined);
    mockCompute.mockResolvedValue('pass');
  });

  it('clears targets when there is no selected run', async () => {
    const { result } = renderHook(() => useSlaManagement(null, '', []));
    expect(result.current.slaTargets).toEqual([]);
    expect(result.current.slaScope).toBeNull();
  });

  it('loads resolved targets for the selected run', async () => {
    const targets = [{ metric: 'p95', threshold: 100 }];
    mockResolve.mockResolvedValue({ targets, scope: null });
    const run = makeRun();
    const { result } = renderHook(() => useSlaManagement(run, run.id, [run]));
    await waitFor(() => expect(result.current.slaTargets).toEqual(targets));
    expect(result.current.slaScope).toBeNull();
  });

  it('maps run scope to workflow-def when the run has a workflowId', async () => {
    mockResolve.mockResolvedValue({ targets: [], scope: 'run' });
    const run = makeRun({ config: { workflowId: 'wf-1' } } as Partial<TestRun>);
    const { result } = renderHook(() => useSlaManagement(run, run.id, [run]));
    await waitFor(() => expect(result.current.slaScope).toBe('workflow-def'));
  });

  it('keeps run scope when there is no workflowId', async () => {
    mockResolve.mockResolvedValue({ targets: [], scope: 'run' });
    const run = makeRun();
    const { result } = renderHook(() => useSlaManagement(run, run.id, [run]));
    await waitFor(() => expect(result.current.slaScope).toBe('run'));
  });

  it('saves ad-hoc targets and recomputes statuses', async () => {
    mockResolve.mockResolvedValue({ targets: [], scope: null });
    const run = makeRun();
    const { result } = renderHook(() => useSlaManagement(run, run.id, [run]));
    await waitFor(() => expect(result.current.slaTargets).toEqual([]));
    const newTargets = [{ metric: 'p99', threshold: 200 }];
    await result.current.handleSaveSlaTargets(newTargets as never);
    await waitFor(() => expect(result.current.slaTargets).toEqual(newTargets));
    expect(mockSave).toHaveBeenCalledWith('run-1', newTargets);
    expect(result.current.slaScope).toBeNull();
  });

  it('does not save when scope is run or workflow-def', async () => {
    mockResolve.mockResolvedValue({ targets: [], scope: 'run' });
    const run = makeRun();
    const { result } = renderHook(() => useSlaManagement(run, run.id, [run]));
    await waitFor(() => expect(result.current.slaScope).toBe('run'));
    await result.current.handleSaveSlaTargets([] as never);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('computes SLA status dots for every visible run', async () => {
    const run = makeRun();
    const { result } = renderHook(() => useSlaManagement(run, run.id, [run]));
    await waitFor(() => expect(result.current.runSlaStatuses.get('run-1')).toBe('pass'));
  });

  it('swallows compute errors silently', async () => {
    mockCompute.mockRejectedValue(new Error('boom'));
    const run = makeRun();
    const { result } = renderHook(() => useSlaManagement(run, run.id, [run]));
    await waitFor(() => expect(result.current.slaTargets).toEqual([]));
    expect(result.current.runSlaStatuses.size).toBe(0);
  });

  it('uses empty targets when resolveTargetsForRun returns null', async () => {
    mockResolve.mockResolvedValue(null);
    const run = makeRun();
    const { result } = renderHook(() => useSlaManagement(run, run.id, [run]));
    await waitFor(() => expect(result.current.slaTargets).toEqual([]));
    expect(result.current.slaScope).toBeNull();
  });

  it('ignores stale resolve results after the selected run changes', async () => {
    let resolveSlow!: (v: unknown) => void;
    mockResolve.mockImplementationOnce(() => new Promise((r) => { resolveSlow = r; }));
    const run1 = makeRun({ id: 'run-1' });
    const run2 = makeRun({ id: 'run-2' });
    const { result, rerender } = renderHook(
      ({ run, id }) => useSlaManagement(run, id, [run]),
      { initialProps: { run: run1, id: run1.id } },
    );
    rerender({ run: run2, id: run2.id });
    mockResolve.mockResolvedValue({ targets: [{ metric: 'p95', threshold: 1 }], scope: null });
    resolveSlow({ targets: [{ metric: 'stale', threshold: 9 }], scope: null });
    await waitFor(() => expect(result.current.slaTargets).toEqual([]));
  });

  it('does not save when scope is workflow-def', async () => {
    mockResolve.mockResolvedValue({ targets: [], scope: 'run' });
    const run = makeRun({ config: { workflowId: 'wf-1' } } as Partial<TestRun>);
    const { result } = renderHook(() => useSlaManagement(run, run.id, [run]));
    await waitFor(() => expect(result.current.slaScope).toBe('workflow-def'));
    await result.current.handleSaveSlaTargets([] as never);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('does not save when selectedRun is null', async () => {
    const { result } = renderHook(() => useSlaManagement(null, '', []));
    await result.current.handleSaveSlaTargets([] as never);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('does not update runSlaStatuses after unmount (cancelled=true)', async () => {
    let resolveCompute!: (v: unknown) => void;
    mockResolve.mockResolvedValue({ targets: [], scope: null });
    mockCompute.mockImplementation(() => new Promise((r) => { resolveCompute = r; }));
    const run = makeRun();
    const { result, unmount } = renderHook(() => useSlaManagement(run, run.id, [run]));
    unmount();
    await waitFor(() => {});
    resolveCompute?.('pass');
    // Should not crash; runSlaStatuses stays empty
    expect(result.current.runSlaStatuses.size).toBe(0);
  });
});
