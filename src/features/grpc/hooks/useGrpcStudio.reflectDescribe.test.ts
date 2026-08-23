/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_DESCRIBE_SUCCESS_ENVELOPE,
  FIXTURE_ECHO_PROTO,
  FIXTURE_DESCRIBE_PROTOSET_REQUEST,
} from '@shared/grpc/contractFixtures';
import { setGrpcClientTransport } from '@shared/grpc/grpcApiClient';
import * as grpcStudioSessionHelpers from './grpcStudioSessionHelpers';
import { useGrpcStudio } from './useGrpcStudio';
import { PAGE_DEFAULTS, setupUseGrpcStudioHookTest } from './useGrpcStudio.testHelpers';

beforeEach(() => setupUseGrpcStudioHookTest());

describe('useGrpcStudio reflect/describe (Phase 1D/3)', () => {
  it('reflectTab rejects invalid target without calling reflect API', async () => {
    const transport = vi.fn(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);
    setGrpcClientTransport(transport);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'not-a-target' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(transport).not.toHaveBeenCalled();
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('error');
    expect(result.current.getTabDescriptor(tabId).descriptor).toBeUndefined();
    expect(result.current.tabs[0]!.descriptorKey).toBeUndefined();
    expect(result.current.tabs[0]!.service).toBeUndefined();
  });

  it('reflectTab loads proto_files when target is invalid and ingest has proto files', async () => {
    const transport = vi.fn(async (op) => {
      if (op === 'describe') return FIXTURE_DESCRIBE_SUCCESS_ENVELOPE;
      throw new Error(`unexpected op ${op}`);
    });
    setGrpcClientTransport(transport);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'not-a-target' });
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
      });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(transport).toHaveBeenCalledWith(
      'describe',
      '/api/grpc/describe',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
  });

  it('reflectTab with invalid resolved target preserves lastKnownGoodDescriptor', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const resolveSpy = vi.spyOn(grpcStudioSessionHelpers, 'resolveTabConnectionWithEnv').mockReturnValue({
      target: 'not-a-target',
      tlsMode: 'disabled',
      targetValidation: {
        valid: false,
        reason: 'Target must be host:port or in-process:<name>',
      },
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    resolveSpy.mockRestore();

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('error');
    expect(descriptorState.lastKnownGoodDescriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(descriptorState.descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(result.current.tabs[0]!.descriptorKey).toBe(FIXTURE_DESCRIPTOR.key);
  });

  it('reflectTab stores descriptor on the requesting tab only', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    act(() => {
      result.current.updateTab(result.current.activeTab.id, {
        target: 'localhost:50051',
      });
    });

    const tabId = result.current.activeTab.id;

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
    expect(result.current.getTabDescriptor(tabId).descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(result.current.activeTab.descriptorKey).toBe(FIXTURE_DESCRIPTOR.key);
  });

  it('selectMethod binds service, method, descriptorKey, and default body to one tab', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
    }));

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    act(() => {
      result.current.addTab();
    });

    const [tabA, tabB] = result.current.tabs;

    act(() => {
      result.current.updateTab(tabA!.id, { target: 'localhost:50051' });
      result.current.updateTab(tabB!.id, { target: 'localhost:9090' });
    });

    await act(async () => {
      await result.current.reflectTab(tabA!.id);
    });

    act(() => {
      result.current.selectMethod(tabA!.id, 'health.v1.Health', 'Check');
    });

    const updatedA = result.current.tabs.find((tab) => tab.id === tabA!.id)!;
    const updatedB = result.current.tabs.find((tab) => tab.id === tabB!.id)!;

    expect(updatedA.service).toBe('health.v1.Health');
    expect(updatedA.method).toBe('Check');
    expect(updatedA.descriptorKey).toBe(FIXTURE_MULTI_SERVICE_DESCRIPTOR.key);
    expect(updatedA.body).toEqual({ service: '' });
    expect(updatedA.requestMode).toBe('form');
    expect(updatedB.service).toBeUndefined();
    expect(updatedB.method).toBeUndefined();
  });

  it('selectMethod resets requestMode to form when rebinding a method', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
    }));

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051', requestMode: 'json' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
    });

    expect(result.current.tabs.find((tab) => tab.id === tabId)!.requestMode).toBe('form');
  });

  it('duplicateTab copies descriptor cache by value', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const sourceId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(sourceId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(sourceId);
    });

    act(() => {
      result.current.selectMethod(sourceId, 'echo.EchoService', 'Echo');
      result.current.duplicateTab(sourceId);
    });

    const copy = result.current.tabs.find((tab) => tab.id !== sourceId)!;
    expect(result.current.getTabDescriptor(copy.id).descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(result.current.getTabDescriptor(copy.id).sourceFingerprint)
      .toEqual(FIXTURE_DESCRIPTOR.sourceFingerprint);
    expect(result.current.getTabDescriptor(copy.id).lastKnownGoodDescriptor?.key)
      .toBe(FIXTURE_DESCRIPTOR.key);
    expect(copy.service).toBe('echo.EchoService');
    expect(copy.method).toBe('Echo');
    expect(copy.body).toEqual({ message: '' });
  });

  it('duplicateTab descriptor cache is isolated from source descriptor mutations', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const sourceId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(sourceId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(sourceId);
    });

    act(() => {
      result.current.duplicateTab(sourceId);
    });

    const copyId = result.current.tabs.find((tab) => tab.id !== sourceId)!.id;
    const sourceDescriptor = result.current.getTabDescriptor(sourceId).descriptor!;
    sourceDescriptor.services[0]!.fullName = 'mutated.Service';

    expect(result.current.getTabDescriptor(copyId).descriptor?.services[0]!.fullName).toBe('echo.EchoService');
  });

  it('selectMethod clears prior execute artifacts when binding a new method', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
    }));

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        lifecycle: 'success',
        activeRequestId: 'req-old',
        lastResult: { callType: 'unary', status: 0, statusMessage: 'OK', headers: {}, trailers: {}, durationMs: 1 },
        lastError: { message: 'stale', code: 'INTERNAL' },
        lastExecuteSnapshot: { tabId, requestId: 'req-old', capturedAt: '', target: { address: 'localhost:50051', tlsMode: 'disabled' }, service: 'x', method: 'y', body: {}, metadata: {}, timeoutMs: 1000, descriptorKey: 'k' },
      });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'health.v1.Health', 'Check');
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('idle');
    expect(tab.activeRequestId).toBeUndefined();
    expect(tab.lastResult).toBeUndefined();
    expect(tab.lastError).toBeUndefined();
    expect(tab.lastExecuteSnapshot).toBeUndefined();
    expect(tab.service).toBe('health.v1.Health');
  });

  it('prepareExecuteSnapshot succeeds after selectMethod binds schema context', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
    });

    const snapshot = result.current.prepareExecuteSnapshot(tabId, 'req-bound');
    expect(snapshot.service).toBe('echo.EchoService');
    expect(snapshot.method).toBe('Echo');
    expect(snapshot.callType).toBe('unary');
    expect(snapshot.descriptorKey).toBe(FIXTURE_DESCRIPTOR.key);
    expect(snapshot.sourceFingerprint).toEqual(FIXTURE_DESCRIPTOR.sourceFingerprint);
    expect(snapshot.body).toEqual({ message: '' });
  });

  it('prepareExecuteSnapshot captures streaming callType from selected method', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'ServerStream');
    });

    const snapshot = result.current.prepareExecuteSnapshot(tabId, 'req-stream');
    expect(snapshot.method).toBe('ServerStream');
    expect(snapshot.callType).toBe('server_streaming');
  });

  it('selectMethod clears prior stream session state when switching methods', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-old',
        streamRequestId: 'req-stream-old',
        streamMessages: [{
          sequence: 1,
          timestamp: '2026-06-29T00:00:00.000Z',
          direction: 'inbound',
          data: { message: 'stale' },
        }],
        lastSequence: 5,
        streamPendingBodies: [{ message: 'queued' }],
      });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('idle');
    expect(tab.activeStreamId).toBeUndefined();
    expect(tab.streamMessages).toEqual([]);
    expect(tab.streamPendingBodies).toEqual([]);
    expect(tab.lastSequence).toBe(0);
  });

  it('executeUnaryCall rejects streaming methods with validation error (not call_failed)', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'ServerStream');
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('error');
    expect(tab.lastError?.code).toBe('GRPC_INVALID_REQUEST');
    expect(tab.lastError?.category).toBe('validation');
    expect(tab.lastError?.message).toMatch(/server_streaming/);
  });

  it('reflectTab preserves last-known-good descriptor on reflect failure', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
      result.current.updateTab(tabId, {
        lifecycle: 'success',
        lastResult: { callType: 'unary', status: 0, statusMessage: 'OK', headers: {}, trailers: {}, durationMs: 1 },
      });
    });

    expect(result.current.tabs.find((tab) => tab.id === tabId)?.service).toBe('echo.EchoService');

    setGrpcClientTransport(async () => {
      throw new Error('reflection failed');
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('error');
    expect(descriptorState.errorMessage).toMatch(/reflection failed/i);
    expect(descriptorState.descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(descriptorState.lastKnownGoodDescriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(descriptorState.sourceFingerprint?.contentSha256).toBe(FIXTURE_DESCRIPTOR.contentSha256);
    expect(tab.descriptorKey).toBe(FIXTURE_DESCRIPTOR.key);
    expect(tab.service).toBe('echo.EchoService');
    expect(tab.method).toBe('Echo');
    expect(tab.body).toEqual({ message: '' });
    expect(tab.lifecycle).toBe('success');
    expect(tab.lastResult).toBeDefined();
  });

  it('reflectTab stores sourceFingerprint and lastKnownGoodDescriptor on success', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.sourceFingerprint).toEqual(FIXTURE_DESCRIPTOR.sourceFingerprint);
    expect(descriptorState.lastKnownGoodDescriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(descriptorState.sourceSelection.mode).toBe('auto');
    expect(descriptorState.sourceSelection.activeSource).toBe('reflection');
  });

  it('reflectTab falls back to proto_files in auto mode when reflection fails', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return {
          ok: false,
          op: 'reflect',
          error: {
            code: 'GRPC_REFLECTION_FAILED',
            category: 'reflection_failed',
            message: 'reflection unavailable',
          },
        };
      }
      if (op === 'describe') return FIXTURE_DESCRIBE_SUCCESS_ENVELOPE;
      throw new Error(`unexpected op ${op}`);
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
      });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('loaded');
    expect(descriptorState.sourceSelection.activeSource).toBe('proto_files');
  });

  it('describeFromIngest does not fall back to reflection when protoset describe fails', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe') {
        return {
          ok: false,
          op: 'describe',
          error: {
            code: 'GRPC_DESCRIBE_FAILED',
            category: 'describe_failed',
            message: 'invalid protoset',
          },
        };
      }
      if (op === 'reflect') return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      throw new Error(`unexpected op ${op}`);
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
      result.current.patchTabProtoIngest(tabId, {
        source: 'protoset',
        protosetBase64: FIXTURE_DESCRIBE_PROTOSET_REQUEST.protosetBase64,
        protosetFileName: 'echo.pb',
      });
    });

    await act(async () => {
      const loaded = await result.current.describeFromIngest(tabId);
      expect(loaded).toBe(false);
    });

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('error');
    expect(descriptorState.sourceSelection.activeSource).not.toBe('reflection');
  });

});

