/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_ECHO_PROTO,
} from '../../../shared/grpc/contractFixtures';
import { setGrpcClientTransport } from '../../../shared/grpc/grpcApiClient';
const downloadProtosetFileMock = vi.hoisted(() => vi.fn());
vi.mock('../utils/downloadProtoset', () => ({
  downloadProtosetFile: (...args: unknown[]) => downloadProtosetFileMock(...args),
}));

import {useGrpcStudio } from './useGrpcStudio';
import { PAGE_DEFAULTS, setupUseGrpcStudioHookTest } from './useGrpcStudio.testHelpers';

describe('useGrpcStudio Phase 1D — descriptor cache', () => {
  beforeEach(() => {
    setupUseGrpcStudioHookTest({ restoreMocks: true });
    downloadProtosetFileMock.mockReset();
  });

  it('target change preserves tab proto ingest draft', async () => {
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
        importPaths: ['shared'],
      });
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50052' });
    });

    const ingest = result.current.getTabDescriptor(tabId).protoIngest;
    expect(ingest?.protoRoots[0]?.files[0]?.path).toBe('echo.proto');
    expect(ingest?.importPaths).toEqual(['shared']);
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
  });

  it('reflectTab derives sourceFingerprint when API descriptor omits sourceFingerprint field', async () => {
    const { sourceFingerprint: _ignored, ...descriptorWithoutFingerprint } = FIXTURE_DESCRIPTOR;
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: descriptorWithoutFingerprint,
    }));

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
    expect(descriptorState.sourceFingerprint?.contentSha256)
      .toBe(FIXTURE_DESCRIPTOR.contentSha256);
    expect(descriptorState.lastKnownGoodDescriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
  });

  it('reflectTab clears tab context on first reflect failure with no prior descriptor', async () => {
    setGrpcClientTransport(async () => {
      throw new Error('reflection failed');
    });

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

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('error');
    expect(descriptorState.descriptor).toBeUndefined();
    expect(descriptorState.lastKnownGoodDescriptor).toBeUndefined();
    expect(tab.descriptorKey).toBeUndefined();
    expect(tab.service).toBeUndefined();
  });

  it('updateTab target change clears descriptor cache and method binding', async () => {
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

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50052',
        lifecycle: 'success',
        lastResult: { callType: 'unary', status: 0, statusMessage: 'OK', headers: {}, trailers: {}, durationMs: 1 },
      });
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    expect(result.current.getTabDescriptor(tabId).descriptor).toBeUndefined();
    expect(tab.descriptorKey).toBeUndefined();
    expect(tab.service).toBeUndefined();
    expect(tab.method).toBeUndefined();
    expect(tab.body).toEqual({});
    expect(tab.lifecycle).toBe('idle');
    expect(tab.lastResult).toBeUndefined();
    expect(tab.streamLifecycle).toBe('idle');
    expect(tab.streamMessages).toEqual([]);
    expect(tab.activeStreamId).toBeUndefined();
  });

  it('updateTab clearing target to environment default preserves descriptor when resolved address is unchanged', async () => {
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

    act(() => {
      result.current.updateTab(tabId, { target: '' });
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
    expect(result.current.getTabDescriptor(tabId).descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(tab.descriptorKey).toBe(FIXTURE_DESCRIPTOR.key);
    expect(tab.service).toBe('echo.EchoService');
    expect(tab.method).toBe('Echo');
    expect(tab.body).toEqual({ message: '' });
  });

  it('updateTab env placeholder target preserves descriptor when resolved address is unchanged', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      envVarMap: { grpcHost: 'localhost:50051' },
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
      result.current.updateTab(tabId, { target: '{{grpcHost}}' });
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(result.current.getTabDescriptor(tabId).descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(tab.service).toBe('echo.EchoService');
    expect(tab.method).toBe('Echo');
  });

  it('clears descriptor cache when page default target changes for inherited tabs', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result, rerender } = renderHook(
      ({ pageDefaults }) => useGrpcStudio({ pageDefaults }),
      { initialProps: { pageDefaults: PAGE_DEFAULTS } },
    );

    const tabId = result.current.activeTab.id;

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');

    rerender({ pageDefaults: { target: 'localhost:9090', tlsMode: 'disabled' } });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.descriptorKey).toBeUndefined();
    expect(tab.service).toBeUndefined();
    expect(tab.method).toBeUndefined();
  });

  it('clears descriptor cache when resolved env var map changes for placeholder target', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result, rerender } = renderHook(
      ({ envVarMap }) => useGrpcStudio({
        pageDefaults: PAGE_DEFAULTS,
        envVarMap,
      }),
      { initialProps: { envVarMap: { grpcHost: 'localhost:50051' } } },
    );

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: '{{grpcHost}}' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
    });

    expect(result.current.getTabDescriptor(tabId).descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);

    rerender({ envVarMap: { grpcHost: 'localhost:9090' } });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    });

    expect(result.current.tabs[0]!.descriptorKey).toBeUndefined();
  });

  it('preserves descriptor when page default changes but tab uses explicit target', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result, rerender } = renderHook(
      ({ pageDefaults }) => useGrpcStudio({ pageDefaults }),
      { initialProps: { pageDefaults: PAGE_DEFAULTS } },
    );

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

    rerender({ pageDefaults: { target: 'localhost:9090', tlsMode: 'disabled' } });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
    });
    expect(result.current.tabs[0]!.service).toBe('echo.EchoService');
    expect(result.current.tabs[0]!.method).toBe('Echo');
  });

  it('updateTab connection profile change clears descriptor cache', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      profiles: [{
        id: 'profile-staging',
        name: 'Staging',
        target: 'staging.example.com:50051',
        tlsMode: 'disabled',
      }],
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { connectionId: 'profile-staging' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.updateTab(tabId, { connectionId: undefined, target: 'localhost:50051' });
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    expect(result.current.getTabDescriptor(tabId).descriptor).toBeUndefined();
    expect(result.current.tabs.find((entry) => entry.id === tabId)?.descriptorKey).toBeUndefined();
  });

  it('re-reflect preserves collapsed service expansion state for the same descriptor key', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
    }));

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

    expect(result.current.getTabDescriptor(tabId).expandedServiceIds).toEqual([
      'echo.EchoService',
      'health.v1.Health',
    ]);

    act(() => {
      result.current.toggleServiceExpanded(tabId, 'health.v1.Health');
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).expandedServiceIds).toEqual(['echo.EchoService']);
  });

  it('re-reflect with changed descriptor key preserves method binding when method still exists', async () => {
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
      result.current.updateTab(tabId, { body: { message: 'draft' } });
    });

    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: {
        ...FIXTURE_MULTI_SERVICE_DESCRIPTOR,
        key: 'reflection:localhost:50051:rotated-key',
      },
    }));

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    const descriptor = result.current.getTabDescriptor(tabId);
    expect(tab.descriptorKey).toBe('reflection:localhost:50051:rotated-key');
    expect(tab.service).toBe('echo.EchoService');
    expect(tab.method).toBe('Echo');
    expect(tab.body).toEqual({ message: 'draft' });
    expect(descriptor.driftState).toBe('none');
  });

  it('re-reflect with removed method preserves draft and sets blocking drift', async () => {
    const trimmedDescriptor = {
      ...FIXTURE_MULTI_SERVICE_DESCRIPTOR,
      services: [FIXTURE_MULTI_SERVICE_DESCRIPTOR.services[0]!],
    };

    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
    }));

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
      result.current.selectMethod(tabId, 'health.v1.Health', 'Check');
      result.current.updateTab(tabId, { body: { service: 'draft-health' } });
    });

    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: trimmedDescriptor,
    }));

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    const descriptor = result.current.getTabDescriptor(tabId);
    expect(tab.descriptorKey).toBe(FIXTURE_MULTI_SERVICE_DESCRIPTOR.key);
    expect(tab.service).toBe('health.v1.Health');
    expect(tab.method).toBe('Check');
    expect(tab.body).toEqual({ service: 'draft-health' });
    expect(descriptor.driftState).toBe('blocking');
    expect(tab.lifecycle).toBe('idle');
  });

  it('reflectTab ignores stale responses when superseded', async () => {
    let resolveSlow: (() => void) | undefined;
    const slowPromise = new Promise<void>((resolve) => {
      resolveSlow = resolve;
    });

    setGrpcClientTransport(async () => {
      await slowPromise;
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    let firstReflect: Promise<void>;
    act(() => {
      firstReflect = result.current.reflectTab(tabId);
    });

    setGrpcClientTransport(async () => {
      throw new Error('second reflect failed');
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    resolveSlow!();
    await act(async () => {
      await firstReflect!;
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('error');
    expect(result.current.getTabDescriptor(tabId).errorMessage).toBe('second reflect failed');
  });

  it('updateTab target change ignores in-flight reflect for previous target', async () => {
    let resolveSlow: (() => void) | undefined;
    const slowPromise = new Promise<void>((resolve) => {
      resolveSlow = resolve;
    });

    setGrpcClientTransport(async () => {
      await slowPromise;
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    let firstReflect: Promise<void>;
    act(() => {
      firstReflect = result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50052' });
    });

    resolveSlow!();
    await act(async () => {
      await firstReflect!;
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    expect(result.current.getTabDescriptor(tabId).descriptor).toBeUndefined();
  });

  it('closeTab removes descriptor cache entry', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    act(() => {
      result.current.addTab();
    });

    const secondId = result.current.tabs[1]!.id;

    act(() => {
      result.current.updateTab(secondId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(secondId);
    });

    act(() => {
      result.current.closeTab(secondId);
    });

    expect(result.current.getTabDescriptor(secondId).loadState).toBe('idle');
    expect(result.current.tabs).toHaveLength(1);
  });
});
