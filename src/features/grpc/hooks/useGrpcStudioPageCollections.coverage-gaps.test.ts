/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../../shared/grpc/contractFixtures';
import { createGrpcSavedRequestFromSnapshot } from '../../../shared/grpc/grpcSavedRequest';
import {
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
  resetGrpcTabCounterForTests,
} from '../grpcStudioTypes';
import * as replayBinding from '../utils/grpcReplayBinding';
import type { UseGrpcCollectionsResult } from './useGrpcCollections';
import type { UseGrpcStudioReturn } from './useGrpcStudio';
import {
  useGrpcSavedRequestRunTracking,
  useGrpcSelectedSavedRequest,
  useGrpcStudioSaveSnapshot,
} from './useGrpcStudioPageCollections';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };

function makeExecuteSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    tabId: 'tab-1',
    requestId: 'req-run-1',
    capturedAt: '2026-07-01T00:00:00.000Z',
    callType: 'unary' as const,
    target: FIXTURE_UNARY_CALL_REQUEST.target,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    body: { message: 'hello' },
    metadata: {},
    timeoutMs: 30_000,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    transportMode: 'express' as const,
    ...overrides,
  };
}

function makeSavedRequest(overrides: Record<string, unknown> = {}) {
  return createGrpcSavedRequestFromSnapshot(
    makeExecuteSnapshot(overrides),
    {
      id: 'saved-1',
      revisionId: 'rev-1',
      updatedAt: '2026-07-01T00:00:00.000Z',
      name: 'Echo',
    },
    { connectionId: 'conn-1', rawTarget: 'localhost:50051' },
  );
}

function makeStudio(overrides: Partial<UseGrpcStudioReturn> = {}): UseGrpcStudioReturn {
  resetGrpcTabCounterForTests();
  const tab = createGrpcStudioTab({
    id: 'tab-1',
    target: 'localhost:50051',
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    lifecycle: 'success',
    lastResult: { status: 0, body: { message: 'ok' }, durationMs: 42 },
    lastExecuteSnapshot: makeExecuteSnapshot(),
    ...(overrides.activeTab as object | undefined),
  });
  return {
    activeTab: tab,
    activeTabId: tab.id,
    activeTabDescriptor: {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded',
      descriptor: FIXTURE_DESCRIPTOR,
      driftState: 'none',
    },
    tabs: [tab],
    profiles: [{ id: 'conn-1', name: 'Local', target: 'localhost:50051', tlsMode: 'disabled' }],
    prepareExecuteSnapshot: vi.fn(() => makeExecuteSnapshot({ requestId: 'save-req' })),
    ...overrides,
  } as UseGrpcStudioReturn;
}

function makeCollections(saved = makeSavedRequest()): UseGrpcCollectionsResult {
  return {
    collections: [{
      id: 'col-1',
      name: 'Default',
      savedRequests: [saved],
    }],
    recordSavedRequestRun: vi.fn().mockResolvedValue(undefined),
  } as unknown as UseGrpcCollectionsResult;
}

describe('useGrpcStudioPageCollections coverage gaps', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('useGrpcSelectedSavedRequest resolves saved context and open/load-test statuses', () => {
    const saved = makeSavedRequest();
    const collections = makeCollections(saved);
    const studio = makeStudio();

    const { result: noneSelected } = renderHook(() => useGrpcSelectedSavedRequest(
      collections,
      null,
      studio,
      {},
      PAGE_DEFAULTS,
    ));
    expect(noneSelected.current.selectedSavedRequest).toBeNull();
    expect(noneSelected.current.openInStudioStatusForSelected.executable).toBe(true);
    expect(noneSelected.current.runLoadTestStatusForSelected.title).toMatch(/select a saved request/i);

    const { result } = renderHook(() => useGrpcSelectedSavedRequest(
      collections,
      saved.id,
      studio,
      {},
      PAGE_DEFAULTS,
    ));
    expect(result.current.selectedSavedContext?.collectionId).toBe('col-1');
    expect(result.current.openInStudioStatusForSelected.executable).toBe(true);
    expect(result.current.runLoadTestStatusForSelected.executable).toBe(true);
  });

  it('useGrpcSelectedSavedRequest blocks replay for drift and resolver failures', () => {
    const saved = makeSavedRequest();
    const collections = makeCollections(saved);
    const studio = makeStudio();

    vi.spyOn(replayBinding, 'resolveGrpcReplayBinding').mockReturnValue({
      drift: { state: 'blocking', message: 'Method removed from schema', issues: [] },
      snapshot: makeExecuteSnapshot(),
      body: {},
      safeFallbackApplied: false,
    } as never);
    vi.spyOn(replayBinding, 'isGrpcReplayExecutable').mockReturnValue(false);

    const { result: driftBlocked } = renderHook(() => useGrpcSelectedSavedRequest(
      collections,
      saved.id,
      studio,
      {},
      PAGE_DEFAULTS,
    ));
    expect(driftBlocked.current.openInStudioStatusForSelected.executable).toBe(false);
    expect(driftBlocked.current.openInStudioStatusForSelected.title).toMatch(/removed/i);

    vi.spyOn(replayBinding, 'resolveGrpcReplayBinding').mockImplementation(() => {
      throw new Error('resolver exploded');
    });

    const { result: resolverError } = renderHook(() => useGrpcSelectedSavedRequest(
      collections,
      saved.id,
      studio,
      {},
      PAGE_DEFAULTS,
    ));
    expect(resolverError.current.openInStudioStatusForSelected.executable).toBe(false);
    expect(resolverError.current.openInStudioStatusForSelected.title).toBe('resolver exploded');

    vi.spyOn(replayBinding, 'resolveGrpcReplayBinding').mockReturnValue({
      drift: { state: 'blocking', message: '', issues: [] },
      snapshot: makeExecuteSnapshot(),
      body: {},
      safeFallbackApplied: false,
    } as never);
    vi.spyOn(replayBinding, 'isGrpcReplayExecutable').mockReturnValue(false);

    const { result: emptyDriftMessage } = renderHook(() => useGrpcSelectedSavedRequest(
      collections,
      saved.id,
      studio,
      {},
      PAGE_DEFAULTS,
    ));
    expect(emptyDriftMessage.current.openInStudioStatusForSelected.title).toBe('Open in Studio blocked');

    vi.spyOn(replayBinding, 'resolveGrpcReplayBinding').mockImplementation(() => {
      throw 'boom';
    });
    const { result: nonErrorResolver } = renderHook(() => useGrpcSelectedSavedRequest(
      collections,
      saved.id,
      studio,
      {},
      PAGE_DEFAULTS,
    ));
    expect(nonErrorResolver.current.openInStudioStatusForSelected.title).toBe('Open in Studio blocked');
  });

  it('useGrpcSelectedSavedRequest rejects load tests for streaming saved requests', () => {
    const streamingSaved = makeSavedRequest();
    streamingSaved.callType = 'server_streaming';
    const collections = makeCollections(streamingSaved);
    const studio = makeStudio();

    const { result } = renderHook(() => useGrpcSelectedSavedRequest(
      collections,
      streamingSaved.id,
      studio,
      {},
      PAGE_DEFAULTS,
    ));
    expect(result.current.runLoadTestStatusForSelected.executable).toBe(false);
    expect(result.current.runLoadTestStatusForSelected.title).toMatch(/unary/i);
  });

  it('useGrpcSelectedSavedRequest returns null when saved id is unknown', () => {
    const collections = makeCollections();
    const studio = makeStudio();
    const { result } = renderHook(() => useGrpcSelectedSavedRequest(
      collections,
      'missing-saved',
      studio,
      {},
      PAGE_DEFAULTS,
    ));
    expect(result.current.selectedSavedContext).toBeNull();
    expect(result.current.lastUnaryResultForSelected).toBeUndefined();
  });

  it('useGrpcSavedRequestRunTracking skips when replay source or saved request is missing', async () => {
    const collections = makeCollections();
    const studio = makeStudio();
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio,
      collections,
      savedReplaySourceByTabId: {},
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).not.toHaveBeenCalled();
    });

    renderHook(() => useGrpcSavedRequestRunTracking({
      studio,
      collections,
      savedReplaySourceByTabId: { 'tab-1': { collectionId: 'missing', savedId: 'saved-1' } },
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).not.toHaveBeenCalled();
    });
  });

  it('useGrpcSavedRequestRunTracking skips non-terminal unary runs and duplicate request ids', async () => {
    const saved = makeSavedRequest();
    const collections = makeCollections(saved);
    const replaySource = { 'tab-1': { collectionId: 'col-1', savedId: saved.id } };

    const inFlightStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        lifecycle: 'calling',
        lastExecuteSnapshot: makeExecuteSnapshot({ requestId: 'req-inflight' }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: inFlightStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).not.toHaveBeenCalled();
    });

    const noSnapshotStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        lifecycle: 'success',
        lastExecuteSnapshot: undefined,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: noSnapshotStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).not.toHaveBeenCalled();
    });

    const duplicateStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        lifecycle: 'success',
        lastResult: { status: 0, body: {}, durationMs: 1 },
        lastExecuteSnapshot: makeExecuteSnapshot({ requestId: 'req-dup' }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    const { rerender } = renderHook(() => useGrpcSavedRequestRunTracking({
      studio: duplicateStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalledTimes(1);
    });
    rerender();
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalledTimes(1);
    });
  });

  it('useGrpcSavedRequestRunTracking records unary error default status and descriptor mismatches', async () => {
    const saved = makeSavedRequest();
    const collections = makeCollections(saved);
    const replaySource = { 'tab-1': { collectionId: 'col-1', savedId: saved.id } };

    const defaultErrorStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        lifecycle: 'error',
        lastError: { message: 'fail' },
        lastExecuteSnapshot: makeExecuteSnapshot({ requestId: 'req-default-error' }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: defaultErrorStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalledWith('col-1', saved.id, {
        grpcStatus: 2,
        durationMs: undefined,
      });
    });

    vi.mocked(collections.recordSavedRequestRun).mockClear();
    const descriptorMismatchSaved = makeSavedRequest();
    descriptorMismatchSaved.descriptorKey = 'other-key';
    const mismatchCollections = makeCollections(descriptorMismatchSaved);
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: defaultErrorStudio,
      collections: mismatchCollections,
      savedReplaySourceByTabId: { 'tab-1': { collectionId: 'col-1', savedId: descriptorMismatchSaved.id } },
    }));
    await waitFor(() => {
      expect(mismatchCollections.recordSavedRequestRun).not.toHaveBeenCalled();
    });
  });

  it('useGrpcSavedRequestRunTracking records unary success, error, and cancelled runs', async () => {
    const saved = makeSavedRequest();
    const collections = makeCollections(saved);
    const replaySource = { 'tab-1': { collectionId: 'col-1', savedId: saved.id } };

    const successStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        lifecycle: 'success',
        lastResult: { status: 0, body: {}, durationMs: 55 },
        lastExecuteSnapshot: makeExecuteSnapshot({ requestId: 'req-success' }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: successStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalledWith('col-1', saved.id, {
        grpcStatus: 0,
        durationMs: 55,
      });
    });

    vi.mocked(collections.recordSavedRequestRun).mockClear();
    const cancelledStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        lifecycle: 'cancelled',
        lastExecuteSnapshot: makeExecuteSnapshot({ requestId: 'req-cancel' }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: cancelledStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalledWith('col-1', saved.id, {
        grpcStatus: 1,
        durationMs: undefined,
      });
    });

    vi.mocked(collections.recordSavedRequestRun).mockClear();
    const errorStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        lifecycle: 'error',
        lastError: { message: 'fail', details: { grpcStatus: 13 } },
        lastExecuteSnapshot: makeExecuteSnapshot({ requestId: 'req-error' }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: errorStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalledWith('col-1', saved.id, {
        grpcStatus: 13,
        durationMs: undefined,
      });
    });
  });

  it('useGrpcSavedRequestRunTracking records stream terminal states and skips mismatches', async () => {
    const saved = makeSavedRequest();
    const collections = makeCollections(saved);
    const replaySource = { 'tab-1': { collectionId: 'col-1', savedId: saved.id } };

    const streamStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        streamLifecycle: 'ended',
        streamStartedAt: '2026-07-01T00:00:00.000Z',
        streamEndedAt: '2026-07-01T00:00:01.500Z',
        lastExecuteSnapshot: makeExecuteSnapshot({
          requestId: 'req-stream',
          callType: 'server_streaming',
        }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: streamStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalledWith('col-1', saved.id, {
        grpcStatus: 0,
        durationMs: 1500,
      });
    });

    vi.mocked(collections.recordSavedRequestRun).mockClear();
    const cancelledStreamStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        streamLifecycle: 'cancelled',
        lastExecuteSnapshot: makeExecuteSnapshot({
          requestId: 'req-stream-cancel',
          callType: 'server_streaming',
        }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: cancelledStreamStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalledWith('col-1', saved.id, {
        grpcStatus: 1,
        durationMs: undefined,
      });
    });

    vi.mocked(collections.recordSavedRequestRun).mockClear();
    const streamErrorStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        streamLifecycle: 'error',
        streamError: { message: 'stream fail', details: { grpcStatus: 14 } },
        streamStartedAt: 'invalid',
        streamEndedAt: 'also-invalid',
        lastExecuteSnapshot: makeExecuteSnapshot({
          requestId: 'req-stream-error',
          callType: 'server_streaming',
        }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: streamErrorStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalledWith('col-1', saved.id, {
        grpcStatus: 14,
        durationMs: undefined,
      });
    });

    vi.mocked(collections.recordSavedRequestRun).mockClear();
    const inFlightStreamStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        streamLifecycle: 'streaming',
        lastExecuteSnapshot: makeExecuteSnapshot({
          requestId: 'req-stream-open',
          callType: 'server_streaming',
        }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: inFlightStreamStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).not.toHaveBeenCalled();
    });

    vi.mocked(collections.recordSavedRequestRun).mockClear();
    const mismatchStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        lifecycle: 'success',
        lastResult: { status: 0, body: {}, durationMs: 1 },
        lastExecuteSnapshot: makeExecuteSnapshot({
          requestId: 'req-mismatch',
          method: 'OtherMethod',
        }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: mismatchStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).not.toHaveBeenCalled();
    });

    vi.mocked(collections.recordSavedRequestRun).mockRejectedValueOnce(new Error('persist failed'));
    const retryStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        lifecycle: 'success',
        lastResult: { status: 0, body: {}, durationMs: 9 },
        lastExecuteSnapshot: makeExecuteSnapshot({ requestId: 'req-retry' }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: retryStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalled();
    });

    vi.mocked(collections.recordSavedRequestRun).mockRejectedValueOnce(new Error('stream persist failed'));
    const streamRetryStudio = makeStudio({
      activeTab: createGrpcStudioTab({
        id: 'tab-1',
        streamLifecycle: 'ended',
        lastExecuteSnapshot: makeExecuteSnapshot({
          requestId: 'req-stream-retry',
          callType: 'server_streaming',
        }),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
    });
    renderHook(() => useGrpcSavedRequestRunTracking({
      studio: streamRetryStudio,
      collections,
      savedReplaySourceByTabId: replaySource,
    }));
    await waitFor(() => {
      expect(collections.recordSavedRequestRun).toHaveBeenCalled();
    });
  });

  it('useGrpcStudioSaveSnapshot prepares snapshots and surfaces validation errors', () => {
    const studio = makeStudio();
    const { result: ready } = renderHook(() => useGrpcStudioSaveSnapshot(studio, { grpcHost: 'localhost' }));
    const prepared = ready.current();
    expect(prepared.snapshot?.requestId).toBe('save-req');
    expect(prepared.tabContext?.interpolationEnv).toEqual({ grpcHost: 'localhost' });

    const incompleteStudio = makeStudio({
      activeTab: createGrpcStudioTab({ service: undefined, method: undefined }),
    });
    const { result: incomplete } = renderHook(() => useGrpcStudioSaveSnapshot(incompleteStudio, {}));
    expect(incomplete.current().snapshot).toBeNull();

    const throwingStudio = makeStudio({
      prepareExecuteSnapshot: vi.fn(() => {
        throw new Error('snapshot blocked');
      }),
    });
    const { result: failing } = renderHook(() => useGrpcStudioSaveSnapshot(throwingStudio, {}));
    expect(failing.current().errorMessage).toBe('snapshot blocked');

    const { result: unknownFailure } = renderHook(() => useGrpcStudioSaveSnapshot({
      ...makeStudio(),
      prepareExecuteSnapshot: vi.fn(() => {
        throw 'bad';
      }),
    } as UseGrpcStudioReturn, {}));
    expect(unknownFailure.current().errorMessage).toBe('Cannot prepare request snapshot');
  });
});
