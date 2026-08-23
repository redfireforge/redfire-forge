/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_DESCRIPTOR_KEY } from '@shared/grpc/contractFixtures';
import type { GrpcSchemaDiffChange } from '@shared/grpc/grpcSchemaDiffContracts';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import { createEmptyTabDescriptorState, createGrpcStudioTab } from '../grpcStudioTypes';
import * as schemaDiffAck from '../utils/grpcSchemaDiffAck';
import { useGrpcAdvancedSchemaDiffSession } from './useGrpcAdvancedSchemaDiffSession';
import type { StudioSlice } from './useGrpcStudioAdvancedFeaturesTypes';

const SAMPLE_CHANGE: GrpcSchemaDiffChange = {
  entityType: 'field',
  entityPath: 'echo.EchoRequest.message',
  changeType: 'removed',
};
const SCHEMA_DIFF_STORAGE_KEY = 'grpc-schema-diff-state-v1:tab-1';

function makeTabState(overrides: Partial<ReturnType<typeof createInitialGrpcTabAdvancedFeaturesUiState>> = {}) {
  return {
    ...createInitialGrpcTabAdvancedFeaturesUiState(),
    schemaDiff: {
      ...createInitialGrpcTabAdvancedFeaturesUiState().schemaDiff,
      baselineDescriptor: FIXTURE_DESCRIPTOR,
      baselineCapturedAt: '2026-07-01T00:00:00.000Z',
      ...overrides.schemaDiff,
    },
    ...overrides,
  };
}

function makeStudio(descriptor = FIXTURE_DESCRIPTOR): StudioSlice {
  const tab = createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY });
  return {
    activeTab: tab,
    activeTabId: tab.id,
    tabs: [tab],
    profiles: [],
    prepareExecuteSnapshot: vi.fn(),
    activeTabDescriptor: {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded',
      descriptor,
    },
  };
}

function invokePatchUpdaters(patchTabState: ReturnType<typeof vi.fn>) {
  for (const call of patchTabState.mock.calls) {
    const updater = call[1];
    if (typeof updater === 'function') {
      updater(createInitialGrpcTabAdvancedFeaturesUiState());
    }
  }
}

describe('useGrpcAdvancedSchemaDiffSession coverage gaps', () => {
  const getAcksMock = vi.spyOn(schemaDiffAck, 'getGrpcSchemaDiffAcks');
  const addAckMock = vi.spyOn(schemaDiffAck, 'addGrpcSchemaDiffAck');
  const deleteAckMock = vi.spyOn(schemaDiffAck, 'deleteGrpcSchemaDiffAck');
  const deleteBaselineAcksMock = vi.spyOn(schemaDiffAck, 'deleteGrpcSchemaDiffAcksForBaseline');

  beforeEach(() => {
    window.localStorage.clear();
    getAcksMock.mockReset();
    addAckMock.mockReset();
    deleteAckMock.mockReset();
    deleteBaselineAcksMock.mockReset();
    getAcksMock.mockResolvedValue([]);
    addAckMock.mockResolvedValue(undefined);
    deleteAckMock.mockResolvedValue(undefined);
    deleteBaselineAcksMock.mockResolvedValue(undefined);
    vi.spyOn(schemaDiffAck, 'grpcSchemaDiffChangeId').mockReturnValue('change-1');
    vi.spyOn(schemaDiffAck, 'grpcSchemaDiffAckId').mockReturnValue('ack-1');
  });

  it('refreshes acknowledgements and clears state when baseline key is missing or fetch fails', async () => {
    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: { severityFilter: 'all', hideAcknowledged: false },
    }));
    const patchTabState = vi.fn();

    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    await waitFor(() => {
      expect(result.current.schemaDiffAckChangeIds.size).toBe(0);
    });

    getTabState.mockReturnValue(makeTabState());
    getAcksMock.mockResolvedValueOnce([{ changeId: 'change-1' } as never]);
    await act(async () => {
      await result.current.acknowledgeSchemaDiffChange(SAMPLE_CHANGE);
    });
    expect(result.current.isSchemaDiffChangeAcknowledged(SAMPLE_CHANGE)).toBe(true);

    getAcksMock.mockRejectedValueOnce(new Error('idb down'));
    await act(async () => {
      await result.current.unacknowledgeSchemaDiffChange(SAMPLE_CHANGE);
    });
    expect(result.current.schemaDiffAckChangeIds.size).toBe(0);
  });

  it('patches severity and hide-acknowledged filters', async () => {
    const patchTabState = vi.fn();
    const getTabState = vi.fn(() => makeTabState());

    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    await waitFor(() => {
      expect(result.current.schemaDiffAckChangeIds.size).toBe(0);
    });

    act(() => {
      result.current.setSchemaDiffSeverityFilter('breaking');
      result.current.setSchemaDiffHideAcknowledged(true);
    });

    invokePatchUpdaters(patchTabState);
    expect(patchTabState).toHaveBeenCalledTimes(2);
  });

  it('refreshSchemaDiffAcks clears acknowledgements when baseline key is absent', async () => {
    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: { severityFilter: 'all', hideAcknowledged: false },
    }));
    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.schemaDiffAckChangeIds.size).toBe(0);
    });
  });

  it('refreshSchemaDiffAcks clears acknowledgements when fetch fails', async () => {
    getAcksMock.mockRejectedValueOnce(new Error('idb read failed'));
    const getTabState = vi.fn(() => makeTabState());
    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.schemaDiffAckChangeIds.size).toBe(0);
    });
  });

  it('acknowledge and unacknowledge no-op without baseline and surface persistence failures', async () => {
    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: { severityFilter: 'all', hideAcknowledged: false },
    }));
    const patchTabState = vi.fn();

    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    await act(async () => {
      await result.current.acknowledgeSchemaDiffChange(SAMPLE_CHANGE);
      await result.current.unacknowledgeSchemaDiffChange(SAMPLE_CHANGE);
    });
    expect(addAckMock).not.toHaveBeenCalled();
    expect(deleteAckMock).not.toHaveBeenCalled();

    getTabState.mockReturnValue(makeTabState());
    addAckMock.mockRejectedValueOnce('save failed');
    await act(async () => {
      await result.current.acknowledgeSchemaDiffChange(SAMPLE_CHANGE);
    });
    invokePatchUpdaters(patchTabState);

    addAckMock.mockRejectedValueOnce(new Error('ack exploded'));
    await act(async () => {
      await result.current.acknowledgeSchemaDiffChange(SAMPLE_CHANGE);
    });
    invokePatchUpdaters(patchTabState);

    deleteAckMock.mockRejectedValueOnce('delete failed');
    await act(async () => {
      await result.current.unacknowledgeSchemaDiffChange(SAMPLE_CHANGE);
    });
    invokePatchUpdaters(patchTabState);

    deleteAckMock.mockRejectedValueOnce(new Error('unack exploded'));
    await act(async () => {
      await result.current.unacknowledgeSchemaDiffChange(SAMPLE_CHANGE);
    });
    invokePatchUpdaters(patchTabState);
    expect(patchTabState.mock.calls.length).toBeGreaterThan(1);
  });

  it('captureSchemaBaseline fails without descriptor and clears prior baseline acks', async () => {
    const priorBaseline = { ...FIXTURE_DESCRIPTOR, key: 'prior-key' };
    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: {
        severityFilter: 'all',
        hideAcknowledged: false,
        baselineDescriptor: priorBaseline,
      },
    }));
    const patchTabState = vi.fn();

    const { result: noDescriptor } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      {
        ...makeStudio(undefined),
        activeTabDescriptor: createEmptyTabDescriptorState(),
      },
      'tab-1',
      getTabState,
      patchTabState,
    ));

    act(() => {
      noDescriptor.current.captureSchemaBaseline();
    });
    invokePatchUpdaters(patchTabState);
    expect(patchTabState).toHaveBeenCalled();

    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    act(() => {
      result.current.captureSchemaBaseline();
    });
    await waitFor(() => {
      expect(deleteBaselineAcksMock).toHaveBeenCalledWith(FIXTURE_DESCRIPTOR_KEY);
      expect(deleteBaselineAcksMock).toHaveBeenCalledWith('prior-key');
    });
  });

  it('runSchemaDiff validates prerequisites and stores reports', async () => {
    const patchTabState = vi.fn();
    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: { severityFilter: 'all', hideAcknowledged: false },
    }));

    const { result: missingBaseline } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));
    await waitFor(() => {
      expect(missingBaseline.current.schemaDiffAckChangeIds.size).toBe(0);
    });
    act(() => {
      missingBaseline.current.runSchemaDiff();
    });

    getTabState.mockReturnValue(makeTabState());
    const { result: missingCandidate } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      {
        ...makeStudio(),
        activeTabDescriptor: {
          ...createEmptyTabDescriptorState(),
          loadState: 'loaded',
          descriptor: undefined,
        },
      },
      'tab-1',
      getTabState,
      patchTabState,
    ));
    await waitFor(() => {
      expect(missingCandidate.current.schemaDiffAckChangeIds.size).toBe(0);
    });
    act(() => {
      missingCandidate.current.runSchemaDiff();
    });

    getTabState.mockReturnValue(makeTabState());
    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));
    await waitFor(() => {
      expect(result.current.schemaDiffAckChangeIds.size).toBe(0);
    });
    act(() => {
      result.current.runSchemaDiff();
    });
    invokePatchUpdaters(patchTabState);
    expect(patchTabState.mock.calls.length).toBeGreaterThan(2);
  });

  it('ignores stale acknowledgement refresh results after a newer refresh starts', async () => {
    let resolveFirst: ((value: unknown[]) => void) | undefined;
    getAcksMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFirst = resolve;
    }));
    getAcksMock.mockResolvedValueOnce([{ changeId: 'fresh-change' } as never]);

    const getTabState = vi.fn(() => makeTabState());
    const patchTabState = vi.fn();
    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    await waitFor(() => {
      expect(getAcksMock).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.unacknowledgeSchemaDiffChange(SAMPLE_CHANGE);
    });

    resolveFirst?.([{ changeId: 'stale-change' } as never]);
    await waitFor(() => {
      expect(result.current.schemaDiffAckChangeIds.has('fresh-change')).toBe(true);
    });
    expect(result.current.schemaDiffAckChangeIds.has('stale-change')).toBe(false);
  });

  it('isSchemaDiffChangeAcknowledged reads acknowledgement ids from refresh', async () => {
    getAcksMock.mockResolvedValueOnce([{ changeId: 'change-1' } as never]);
    const getTabState = vi.fn(() => makeTabState());
    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.isSchemaDiffChangeAcknowledged(SAMPLE_CHANGE)).toBe(true);
    });
  });

  it('captureSchemaBaseline skips prior baseline cleanup when no prior baseline exists', async () => {
    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: { severityFilter: 'all', hideAcknowledged: false },
    }));
    const patchTabState = vi.fn();
    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    await waitFor(() => {
      expect(result.current.schemaDiffAckChangeIds.size).toBe(0);
    });

    await act(async () => {
      result.current.captureSchemaBaseline();
      await Promise.resolve();
    });
    invokePatchUpdaters(patchTabState);
    await waitFor(() => {
      expect(deleteBaselineAcksMock).toHaveBeenCalledWith(FIXTURE_DESCRIPTOR_KEY);
    });
    expect(deleteBaselineAcksMock).not.toHaveBeenCalledWith('prior-key');
  });

  it('clearSchemaBaseline resets state and deletes baseline acknowledgements', async () => {
    const getTabState = vi.fn(() => makeTabState());
    const patchTabState = vi.fn();

    const { result: withBaseline } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));
    await act(async () => {
      withBaseline.current.clearSchemaBaseline();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(deleteBaselineAcksMock).toHaveBeenCalledWith(FIXTURE_DESCRIPTOR_KEY);
    });

    getTabState.mockReturnValue(makeTabState({
      schemaDiff: { severityFilter: 'all', hideAcknowledged: false },
    }));
    const { result: withoutBaseline } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));
    await act(async () => {
      withoutBaseline.current.clearSchemaBaseline();
      await Promise.resolve();
    });
    expect(withoutBaseline.current.schemaDiffAckChangeIds.size).toBe(0);
  });

  it('hydrates schema diff baseline from localStorage when in-memory state is empty', async () => {
    const persistedBaseline = structuredClone(FIXTURE_DESCRIPTOR);
    const persistedReport = {
      changes: [SAMPLE_CHANGE],
      summary: {
        total: 1,
        breaking: 1,
        nonBreaking: 0,
        informational: 0,
      },
    } as const;

    window.localStorage.setItem(SCHEMA_DIFF_STORAGE_KEY, JSON.stringify({
      baselineDescriptor: persistedBaseline,
      baselineCapturedAt: '2026-07-02T12:00:00.000Z',
      lastReport: persistedReport,
      severityFilter: 'all',
      hideAcknowledged: true,
    }));

    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: {
        baselineDescriptor: undefined,
        baselineCapturedAt: undefined,
        lastReport: undefined,
        severityFilter: 'all',
        hideAcknowledged: false,
      },
    }));
    const patchTabState = vi.fn();

    renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    await waitFor(() => {
      expect(patchTabState).toHaveBeenCalled();
    });

    const hydrateCall = patchTabState.mock.calls.find((call) => typeof call[1] === 'function');
    expect(hydrateCall).toBeTruthy();
    const hydrated = hydrateCall?.[1](createInitialGrpcTabAdvancedFeaturesUiState());
    expect(hydrated.schemaDiff.baselineDescriptor?.key).toBe(persistedBaseline.key);
    expect(hydrated.schemaDiff.baselineCapturedAt).toBe('2026-07-02T12:00:00.000Z');
    expect(hydrated.schemaDiff.lastReport).toEqual(persistedReport);
    expect(hydrated.schemaDiff.hideAcknowledged).toBe(true);
  });

  it('does not clear persisted baseline during initial mount hydration', async () => {
    window.localStorage.setItem(SCHEMA_DIFF_STORAGE_KEY, JSON.stringify({
      baselineDescriptor: FIXTURE_DESCRIPTOR,
      baselineCapturedAt: '2026-07-03T00:00:00.000Z',
      lastReport: {
        changes: [SAMPLE_CHANGE],
        summary: {
          total: 1,
          breaking: 1,
          nonBreaking: 0,
          informational: 0,
        },
      },
    }));

    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: {
        baselineDescriptor: undefined,
        baselineCapturedAt: undefined,
        lastReport: undefined,
        severityFilter: 'all',
        hideAcknowledged: false,
      },
    }));

    renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(window.localStorage.getItem(SCHEMA_DIFF_STORAGE_KEY)).not.toBeNull();
    });
  });

  it('ignores persisted schema diff payloads that are not objects', async () => {
    window.localStorage.setItem(SCHEMA_DIFF_STORAGE_KEY, 'null');
    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: {
        baselineDescriptor: undefined,
        baselineCapturedAt: undefined,
        lastReport: undefined,
        severityFilter: 'all',
        hideAcknowledged: false,
      },
    }));
    const patchTabState = vi.fn();

    renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    await waitFor(() => {
      expect(patchTabState).not.toHaveBeenCalled();
    });
  });

  it('ignores invalid persisted schema diff payloads', async () => {
    window.localStorage.setItem(SCHEMA_DIFF_STORAGE_KEY, '{not-json');
    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: {
        baselineDescriptor: undefined,
        baselineCapturedAt: undefined,
        lastReport: undefined,
        severityFilter: 'all',
        hideAcknowledged: false,
      },
    }));
    const patchTabState = vi.fn();

    renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    await waitFor(() => {
      expect(patchTabState).not.toHaveBeenCalled();
    });
  });

  it('persists schema diff state after hydration completes', async () => {
    window.localStorage.setItem('grpc-schema-diff-state-v1:tab-write', JSON.stringify({
      baselineDescriptor: FIXTURE_DESCRIPTOR,
      baselineCapturedAt: '2026-07-04T00:00:00.000Z',
      lastReport: {
        changes: [SAMPLE_CHANGE],
        summary: { total: 1, breaking: 1, nonBreaking: 0, informational: 0 },
      },
    }));

    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: {
        baselineDescriptor: FIXTURE_DESCRIPTOR,
        baselineCapturedAt: '2026-07-04T00:00:00.000Z',
        lastReport: {
          changes: [SAMPLE_CHANGE],
          summary: { total: 1, breaking: 1, nonBreaking: 0, informational: 0 },
        },
        severityFilter: 'breaking',
        hideAcknowledged: true,
      },
    }));

    renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-write',
      getTabState,
      vi.fn(),
    ));

    await waitFor(() => {
      const persisted = window.localStorage.getItem('grpc-schema-diff-state-v1:tab-write');
      expect(persisted).toContain('"severityFilter":"breaking"');
      expect(persisted).toContain('"hideAcknowledged":true');
    });
  });

  it('hydrates persisted baseline without optional filter fields', async () => {
    window.localStorage.setItem(SCHEMA_DIFF_STORAGE_KEY, JSON.stringify({
      baselineDescriptor: FIXTURE_DESCRIPTOR,
      baselineCapturedAt: '2026-07-05T00:00:00.000Z',
      lastReport: {
        changes: [SAMPLE_CHANGE],
        summary: { total: 1, breaking: 1, nonBreaking: 0, informational: 0 },
      },
    }));

    const getTabState = vi.fn(() => makeTabState({
      schemaDiff: {
        baselineDescriptor: undefined,
        baselineCapturedAt: undefined,
        lastReport: undefined,
        severityFilter: 'all',
        hideAcknowledged: false,
      },
    }));
    const patchTabState = vi.fn();

    renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    await waitFor(() => {
      expect(patchTabState).toHaveBeenCalled();
    });

    const hydrateCall = patchTabState.mock.calls.find((call) => typeof call[1] === 'function');
    const hydrated = hydrateCall?.[1](createInitialGrpcTabAdvancedFeaturesUiState());
    expect(hydrated.schemaDiff.baselineDescriptor?.key).toBe(FIXTURE_DESCRIPTOR_KEY);
    expect(hydrated.schemaDiff.severityFilter).toBe('all');
    expect(hydrated.schemaDiff.hideAcknowledged).toBe(false);
  });

  it('applySchemaDiffComparison patches state and refreshes acknowledgements by baseline key', async () => {
    const getTabState = vi.fn(() => makeTabState());
    const patchTabState = vi.fn();
    getAcksMock.mockResolvedValueOnce([{ changeId: 'applied-change' } as never]);

    const { result } = renderHook(() => useGrpcAdvancedSchemaDiffSession(
      makeStudio(),
      'tab-1',
      getTabState,
      patchTabState,
    ));

    const candidate = structuredClone(FIXTURE_DESCRIPTOR);
    candidate.services[0]!.methods[0]!.name = 'EchoRenamedViaApply';
    const report = {
      changes: [SAMPLE_CHANGE],
      summary: {
        total: 1,
        breaking: 1,
        nonBreaking: 0,
        informational: 0,
      },
    } as const;

    act(() => {
      result.current.applySchemaDiffComparison({
        baselineDescriptor: candidate,
        report,
      });
    });

    invokePatchUpdaters(patchTabState);
    expect(patchTabState).toHaveBeenCalled();
    await waitFor(() => {
      expect(getAcksMock).toHaveBeenCalledWith(candidate.key);
    });
  });
});
