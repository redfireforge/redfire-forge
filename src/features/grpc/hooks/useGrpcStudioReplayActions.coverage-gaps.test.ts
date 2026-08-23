/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_TARGET,
  FIXTURE_UNARY_CALL_REQUEST,
} from '@shared/grpc/contractFixtures';
import { createGrpcSavedRequestFromSnapshot } from '@shared/grpc/grpcSavedRequest';
import { createEmptyTabDescriptorState, createGrpcStudioTab } from '../grpcStudioTypes';
import { useGrpcStudioReplayActions } from './useGrpcStudioReplayActions';

const TS = '2026-06-29T12:00:00.000Z';

function makeSaved() {
  return createGrpcSavedRequestFromSnapshot(
    {
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: TS,
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    },
    { id: 'sr-1', revisionId: 'rev-1', updatedAt: TS },
  );
}

function makeStudio() {
  const tab = createGrpcStudioTab({
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    target: FIXTURE_UNARY_CALL_REQUEST.target,
  });
  const descriptor = createEmptyTabDescriptorState();
  descriptor.descriptor = FIXTURE_DESCRIPTOR;

  return {
    activeTab: tab,
    activeTabDescriptor: descriptor,
    updateTab: vi.fn(),
    abortTabInFlightCalls: vi.fn(),
    patchTabDescriptor: vi.fn(),
  };
}

describe('useGrpcStudioReplayActions coverage gaps', () => {
  it('clearLastActionError resets surfaced replay errors', () => {
    const studio = makeStudio();
    const saved = makeSaved();
    saved.target = '{{missingEnvVar}}:50051';

    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate: vi.fn(),
    }));

    act(() => {
      result.current.openSavedRequestInStudio(saved);
    });
    expect(result.current.lastActionError).toBeTruthy();

    act(() => {
      result.current.clearLastActionError();
    });
    expect(result.current.lastActionError).toBeUndefined();
  });

  it('replayHistoryEntry surfaces non-Error throws without rethrowing', () => {
    const studio = makeStudio();
    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate: vi.fn(),
    }));

    act(() => {
      result.current.replayHistoryEntry({
        id: 'hist-bad',
        capturedAt: TS,
        service: 'echo.EchoService',
        method: 'Echo',
        target: '{{missing}}',
        callType: 'unary',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        record: {
          snapshot: {
            tabId: studio.activeTab.id,
            requestId: 'req-bad',
            capturedAt: TS,
            callType: 'unary',
            target: '{{missing}}',
            service: 'echo.EchoService',
            method: 'Echo',
            body: {},
            metadata: {},
            timeoutMs: 30_000,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          },
        },
      } as never);
    });

    expect(studio.updateTab).not.toHaveBeenCalled();
    expect(result.current.lastActionError).toMatch(/missing|target|resolve/i);
  });

  it('applyGrpcurlImport surfaces resolver failures', () => {
    const studio = makeStudio();
    studio.patchTabDescriptor.mockImplementation(() => {
      throw 'grpcurl import failed';
    });

    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate: vi.fn(),
    }));

    act(() => {
      result.current.applyGrpcurlImport({
        ok: true,
        targetAddress: 'localhost:50051',
        serviceFullName: 'echo.EchoService',
        methodName: 'Echo',
        tlsMode: 'plaintext',
        metadata: {},
        body: { message: 'imported' },
        warnings: [],
        unsupportedFlags: [],
      });
    });

    expect(result.current.lastActionError).toBe('Replay failed');
  });

  it('applyBindingToActiveTab returns binding and supports body override', () => {
    const studio = makeStudio();
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate,
    }));

    let binding: ReturnType<typeof result.current.applyBindingToActiveTab> | undefined;
    act(() => {
      binding = result.current.applyBindingToActiveTab(makeSaved(), { message: 'override' });
    });

    expect(binding).toBeTruthy();
    expect(studio.updateTab).toHaveBeenCalledWith(
      studio.activeTab.id,
      expect.objectContaining({ body: { message: 'override' } }),
    );
    expect(onNavigate).toHaveBeenCalledWith('studio');
  });

  it('uses timestamp fallback ids when crypto.randomUUID is unavailable', () => {
    const studio = makeStudio();
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', undefined);

    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate: vi.fn(),
    }));

    act(() => {
      result.current.openSavedRequestInStudio(makeSaved());
    });

    expect(studio.updateTab).toHaveBeenCalled();
    vi.stubGlobal('crypto', originalCrypto);
  });

  it('replayHistoryEntry uses timestamp fallback when crypto.randomUUID is unavailable', () => {
    const studio = makeStudio();
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', undefined);

    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate: vi.fn(),
    }));

    const saved = makeSaved();
    act(() => {
      result.current.replayHistoryEntry({
        id: 'hist-1',
        capturedAt: TS,
        service: saved.service,
        method: saved.method,
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        callType: saved.callType,
        descriptorKey: saved.descriptorKey,
        record: {
          snapshot: {
            tabId: studio.activeTab.id,
            requestId: 'req-hist',
            capturedAt: TS,
            callType: saved.callType,
            target: { address: FIXTURE_TARGET.address, tlsMode: 'disabled' },
            service: saved.service,
            method: saved.method,
            body: saved.body,
            metadata: saved.metadata,
            timeoutMs: saved.timeoutMs,
            descriptorKey: saved.descriptorKey,
          },
        },
      } as never);
    });

    expect(studio.updateTab).toHaveBeenCalled();
    vi.stubGlobal('crypto', originalCrypto);
  });
});
