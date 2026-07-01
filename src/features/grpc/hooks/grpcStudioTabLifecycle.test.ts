/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelGrpcStream } from '../../../shared/grpc/grpcStreamClient';
import * as grpcTransportFacade from '../../../shared/grpc/grpcTransportFacade';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import {
  cancelGrpcUnaryForTab,
  cleanupGrpcStudioTabNativeResources,
  cleanupGrpcStudioTabStreamResources,
  registerGrpcStudioAppLifecycle,
  registerGrpcStudioWindowLifecycle,
} from './grpcStudioTabLifecycle';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock('../../../shared/grpc/grpcStreamClient', () => ({
  cancelGrpcStream: vi.fn(() => Promise.resolve({ ok: true, op: 'stream_cancel', data: {} })),
}));

vi.mock('../../../shared/grpc/grpcTransportFacade', async () => {
  const actual = await vi.importActual<typeof grpcTransportFacade>('../../../shared/grpc/grpcTransportFacade');
  return {
    ...actual,
    cancelGrpcUnary: vi.fn(() => Promise.resolve({ ok: true, op: 'cancel', data: { cancelled: true } })),
    cleanupGrpcTabNative: vi.fn(() => Promise.resolve()),
  };
});

function makeGrpcTab(id: string, overrides: Partial<GrpcStudioTabState> = {}): GrpcStudioTabState {
  return {
    id,
    title: id,
    target: 'localhost:50051',
    tlsMode: 'plaintext',
    lifecycle: 'idle',
    streamLifecycle: 'idle',
    streamMessages: [],
    lastSequence: 0,
    body: {},
    metadata: {},
    requestMode: 'form',
    ...overrides,
  };
}

describe('grpcStudioTabLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancelGrpcUnaryForTab delegates to cancelGrpcUnary', async () => {
    await cancelGrpcUnaryForTab('tab-a', 'req-1');
    expect(grpcTransportFacade.cancelGrpcUnary).toHaveBeenCalledWith('req-1', 'tab-a', undefined);
  });

  it('cancelGrpcUnaryForTab swallows cancel failures', async () => {
    vi.mocked(grpcTransportFacade.cancelGrpcUnary).mockRejectedValueOnce(new Error('network'));
    await expect(cancelGrpcUnaryForTab('tab-a', 'req-1')).resolves.toBeUndefined();
  });

  it('cleanupGrpcStudioTabStreamResources detaches listener and cancels active stream', () => {
    const streamGenerationRef = { current: {} as Record<string, number> };
    const streamDisposeRef = { current: {} as Record<string, () => void> };
    const dispose = vi.fn();
    streamDisposeRef.current['tab-a'] = dispose;

    const tab: GrpcStudioTabState = makeGrpcTab('tab-a', {
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      streamRequestId: 'req-stream',
    });

    cleanupGrpcStudioTabStreamResources('tab-a', tab, streamGenerationRef, streamDisposeRef);

    expect(dispose).toHaveBeenCalled();
    expect(streamDisposeRef.current['tab-a']).toBeUndefined();
    expect(cancelGrpcStream).toHaveBeenCalledWith('stream-1', 'tab-a');
  });

  it('cleanupGrpcStudioTabNativeResources delegates to cleanupGrpcTabNative', async () => {
    await cleanupGrpcStudioTabNativeResources('tab-a');
    expect(grpcTransportFacade.cleanupGrpcTabNative).toHaveBeenCalledWith('tab-a', undefined);

    await cleanupGrpcStudioTabNativeResources('tab-b', 'express');
    expect(grpcTransportFacade.cleanupGrpcTabNative).toHaveBeenCalledWith('tab-b', { transportMode: 'express' });
  });

  it('registerGrpcStudioWindowLifecycle cleans all tabs on beforeunload', () => {
    const cleanup = registerGrpcStudioWindowLifecycle(() => ['tab-a', 'tab-b']);
    window.dispatchEvent(new Event('beforeunload'));
    expect(grpcTransportFacade.cleanupGrpcTabNative).toHaveBeenCalledWith('tab-a');
    expect(grpcTransportFacade.cleanupGrpcTabNative).toHaveBeenCalledWith('tab-b');
    cleanup();
  });

  it('registerGrpcStudioAppLifecycle cleans tabs on dispose (studio unmount)', () => {
    const detach = vi.fn();
    const cleanup = registerGrpcStudioAppLifecycle({
      getTabIds: () => ['tab-a'],
      detachStreamEvents: detach,
    });
    cleanup();
    expect(detach).toHaveBeenCalledWith('tab-a');
    expect(grpcTransportFacade.cleanupGrpcTabNative).toHaveBeenCalledWith('tab-a');
  });
});
