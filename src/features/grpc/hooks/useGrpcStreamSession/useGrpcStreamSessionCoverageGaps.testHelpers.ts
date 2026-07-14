import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_SERVER_STREAM_START_REQUEST } from '../../../../shared/grpc/contractFixtures';
import { createGrpcSuccessEnvelope } from '../../../../shared/grpc/contracts';
import { createGrpcInterpolationEnvSnapshotFromMap } from '../../../../shared/grpc/grpcInterpolationEnvSnapshot';
import * as callHistoryCapture from '../../utils/grpcStudioCallHistoryCapture';
import * as grpcStreamClient from '../../../../shared/grpc/grpcStreamClient';
import { createInitialSessionState } from '../grpcStudioSessionHelpers';
import { useGrpcStreamSession } from '../useGrpcStreamSession';

export function minimalStreamExecuteSnapshot(
  tabId: string,
  env: Record<string, string> = {},
) {
  return {
    tabId,
    requestId: 'req-stream',
    capturedAt: new Date().toISOString(),
    target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
    service: FIXTURE_SERVER_STREAM_START_REQUEST.service,
    method: FIXTURE_SERVER_STREAM_START_REQUEST.method,
    body: {},
    metadata: {},
    timeoutMs: 10_000,
    descriptorKey: FIXTURE_DESCRIPTOR.key,
    callType: 'server_streaming' as const,
    interpolationEnv: createGrpcInterpolationEnvSnapshotFromMap(env),
  };
}

export function setupUseGrpcStreamSessionCoverageGapsTest(): void {
  vi.mocked(grpcStreamClient.startGrpcStream).mockReset();
  vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockReset();
  vi.mocked(grpcStreamClient.cancelGrpcStream).mockReset();
  vi.mocked(grpcStreamClient.sendGrpcStreamMessage).mockReset();
  vi.mocked(grpcStreamClient.endGrpcStream).mockReset();
  vi.mocked(grpcStreamClient.openGrpcStreamEvents).mockReturnValue(vi.fn());
  vi.mocked(grpcStreamClient.cancelGrpcStream).mockResolvedValue(createGrpcSuccessEnvelope('stream_cancel', {
    streamId: 'stream-test',
    requestId: 'req-test',
    tabId: 'grpc-tab-1',
    cancelled: true,
  }));
  vi.mocked(grpcStreamClient.endGrpcStream).mockResolvedValue(createGrpcSuccessEnvelope('stream_end', {
    streamId: 'stream-test',
    requestId: 'req-test',
    tabId: 'grpc-tab-1',
    ended: true,
  }));
  vi.mocked(callHistoryCapture.captureGrpcCallHistoryFromOutcome).mockReset();
  vi.mocked(callHistoryCapture.captureGrpcCallHistoryFromStreamTerminal).mockReset();
}

export function makeHarness() {
  const session = createInitialSessionState();
  const sessionRef = { current: session };
  const streamGenerationRef = { current: {} as Record<string, number> };
  const streamDisposeRef = { current: {} as Record<string, () => void> };
  const callGenerationRef = { current: {} as Record<string, number> };
  const inFlightCallRef = { current: {} as Record<string, string> };
  const tabId = session.activeTabId;

  const commitSession = vi.fn((next: typeof session) => {
    sessionRef.current = next;
    return next;
  });
  const setSession = vi.fn((updater: typeof session | ((prev: typeof session) => typeof session)) => {
    sessionRef.current = typeof updater === 'function'
      ? updater(sessionRef.current)
      : updater;
  });
  const updateTab = vi.fn((id: string, patch: Record<string, unknown>) => {
    sessionRef.current = {
      ...sessionRef.current,
      tabs: sessionRef.current.tabs.map((tab) => (
        tab.id === id ? { ...tab, ...patch } : tab
      )),
    };
  });
  const prepareExecuteSnapshot = vi.fn(() => {
    throw new Error('missing method binding');
  });

  const hook = renderHook(() => useGrpcStreamSession({
    sessionRef,
    streamGenerationRef,
    streamDisposeRef,
    callGenerationRef,
    inFlightCallRef,
    commitSession,
    setSession,
    updateTab,
    prepareExecuteSnapshot,
  }));

  return {
    hook,
    tabId,
    sessionRef,
    streamGenerationRef,
    streamDisposeRef,
    updateTab,
    prepareExecuteSnapshot,
    setSession,
  };
}
