/**
 * @vitest-environment jsdom
 */
import { act, renderHook} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_DESCRIBE_SUCCESS_ENVELOPE,
  FIXTURE_ECHO_PROTO,
} from '@shared/grpc/contractFixtures';
import { setGrpcClientTransport } from '@shared/grpc/grpcApiClient';
const downloadProtosetFileMock = vi.hoisted(() => vi.fn());
vi.mock('../utils/downloadProtoset', () => ({
  downloadProtosetFile: (...args: unknown[]) => downloadProtosetFileMock(...args),
}));

import { GRPC_STUDIO_MAX_TABS, useGrpcStudio } from './useGrpcStudio';
import * as grpcStudioSessionHelpers from './grpcStudioSessionHelpers';
import { PAGE_DEFAULTS, setupUseGrpcStudioHookTest } from './useGrpcStudio.testHelpers';

describe('useGrpcStudio Phase 1D — tabs and snapshots', () => {
  beforeEach(() => {
    setupUseGrpcStudioHookTest({ restoreMocks: true });
    downloadProtosetFileMock.mockReset();
  });

  it('starts with one idle tab', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTab.lifecycle).toBe('idle');
  });

  it('isolates tab field updates', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));

    act(() => {
      result.current.addTab();
    });

    const [tabA, tabB] = result.current.tabs;
    act(() => {
      result.current.updateTab(tabA!.id, {
        target: 'localhost:50051',
        service: 'echo.EchoService',
        body: { message: 'a' },
      });
      result.current.updateTab(tabB!.id, {
        target: 'localhost:9090',
        service: 'other.Service',
        body: { message: 'b' },
      });
    });

    const updatedA = result.current.tabs.find((tab) => tab.id === tabA!.id)!;
    const updatedB = result.current.tabs.find((tab) => tab.id === tabB!.id)!;
    expect(updatedA.target).toBe('localhost:50051');
    expect(updatedA.body).toEqual({ message: 'a' });
    expect(updatedB.target).toBe('localhost:9090');
    expect(updatedB.body).toEqual({ message: 'b' });
  });

  it('duplicates tab config by value with new id and idle lifecycle', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const sourceId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(sourceId, {
        target: 'localhost:50051',
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'copy-me' },
        metadata: { trace: '1' },
        lifecycle: 'success',
        activeRequestId: 'req-old',
      });
      result.current.duplicateTab(sourceId);
    });

    expect(result.current.tabs).toHaveLength(2);
    const copy = result.current.tabs.find((tab) => tab.id !== sourceId)!;
    expect(copy.target).toBe('localhost:50051');
    expect(copy.service).toBe('echo.EchoService');
    expect(copy.method).toBe('Echo');
    expect(copy.body).toEqual({ message: 'copy-me' });
    expect(copy.metadata).toEqual({ trace: '1' });
    expect(copy.requestMode).toBe('form');
    expect(copy.timeoutMs).toBe(result.current.tabs[0]!.timeoutMs);
    expect(copy.lifecycle).toBe('idle');
    expect(copy.activeRequestId).toBeUndefined();
    expect(copy.id).not.toBe(sourceId);
    expect(result.current.activeTabId).toBe(copy.id);
  });

  it('closes tab and selects fallback active tab', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));

    act(() => {
      result.current.addTab();
    });
    const firstId = result.current.tabs[0]!.id;
    const secondId = result.current.tabs[1]!.id;

    act(() => {
      result.current.selectTab(secondId);
      result.current.closeTab(secondId);
    });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe(firstId);
  });

  it('does not close the last remaining tab', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const onlyId = result.current.activeTab.id;

    act(() => {
      result.current.closeTab(onlyId);
    });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe(onlyId);
  });

  it('invokes onCancelInFlight when closing an inactive in-flight tab', () => {
    const onCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));

    act(() => {
      result.current.addTab();
    });
    const firstId = result.current.tabs[0]!.id;
    const secondId = result.current.tabs[1]!.id;

    act(() => {
      result.current.updateTab(secondId, {
        lifecycle: 'calling',
        activeRequestId: 'req-bg',
      });
      result.current.selectTab(firstId);
      result.current.closeTab(secondId);
    });

    expect(onCancelInFlight).toHaveBeenCalledWith(secondId, 'req-bg');
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe(firstId);
  });

  it('invokes onCancelInFlight when closing an in-flight tab', () => {
    const onCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));

    act(() => {
      result.current.addTab();
    });
    const secondId = result.current.tabs[1]!.id;

    act(() => {
      result.current.updateTab(secondId, {
        lifecycle: 'calling',
        activeRequestId: 'req-in-flight',
      });
      result.current.closeTab(secondId);
    });

    expect(onCancelInFlight).toHaveBeenCalledWith(secondId, 'req-in-flight');
    expect(result.current.tabs).toHaveLength(1);
  });

  it('cancelInFlightForTab is a no-op for idle tabs', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;
    const sessionBefore = result.current.tabs;

    act(() => {
      result.current.cancelInFlightForTab(tabId);
    });

    expect(result.current.tabs).toBe(sessionBefore);
    expect(result.current.activeTab.lifecycle).toBe('idle');
  });

  it('cancelInFlightForTab sets cancelled when connecting without activeRequestId', () => {
    const onCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { lifecycle: 'connecting' });
      result.current.cancelInFlightForTab(tabId);
    });

    expect(onCancelInFlight).not.toHaveBeenCalled();
    expect(result.current.tabs.find((tab) => tab.id === tabId)?.lifecycle).toBe('cancelled');
  });

  it('cancelInFlightForTab persists cancelled lifecycle without removing tab', () => {
    const onCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        lifecycle: 'calling',
        activeRequestId: 'req-cancel-me',
      });
      result.current.cancelInFlightForTab(tabId);
    });

    expect(onCancelInFlight).toHaveBeenCalledWith(tabId, 'req-cancel-me');
    const tab = result.current.tabs.find((entry) => entry.id === tabId);
    expect(tab?.lifecycle).toBe('cancelled');
    expect(tab?.activeRequestId).toBeUndefined();
  });

  it('prepareExecuteSnapshot uses page default when tab target is empty', () => {
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    act(() => {
      result.current.updateTab(result.current.activeTab.id, {
        descriptorKey: 'desc-1',
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'default-target' },
      });
    });

    const snapshot = result.current.prepareExecuteSnapshot(result.current.activeTab.id, 'req-default');
    expect(snapshot.target.address).toBe('localhost:50051');
  });

  it('prepareExecuteSnapshot reads latest tab state after updateTab in same act', () => {
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    act(() => {
      result.current.updateTab(result.current.activeTab.id, {
        target: 'localhost:9090',
        descriptorKey: 'desc-1',
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'fresh' },
      });
      const snapshot = result.current.prepareExecuteSnapshot(
        result.current.activeTab.id,
        'req-fresh',
      );
      expect(snapshot.target.address).toBe('localhost:9090');
      expect(snapshot.body).toEqual({ message: 'fresh' });
    });
  });

  it('prepareExecuteSnapshot captures immutable snapshot from resolved target', () => {
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      envVarMap: { grpcHost: 'localhost:50051' },
    }));

    act(() => {
      result.current.updateTab(result.current.activeTab.id, {
        target: '{{grpcHost}}',
        descriptorKey: 'desc-1',
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'snap' },
      });
    });

    const tabId = result.current.activeTab.id;
    const snapshot = result.current.prepareExecuteSnapshot(tabId, 'req-1');
    expect(snapshot.target.address).toBe('localhost:50051');
    expect(snapshot.body).toEqual({ message: 'snap' });

    act(() => {
      result.current.updateTab(tabId, { body: { message: 'mutated' } });
    });

    expect(snapshot.body).toEqual({ message: 'snap' });
  });

  it('respects max tab limit', () => {
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      maxTabs: 2,
    }));

    act(() => {
      result.current.addTab();
      result.current.addTab();
    });

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.canAddTab).toBe(false);
  });

  it('updateTab cannot mutate tab id', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { id: 'hijacked-id', target: 'localhost:50051' });
    });

    expect(result.current.activeTab.id).toBe(tabId);
    expect(result.current.activeTab.target).toBe('localhost:50051');
  });

  it('updateTab clones body so shared references cannot cross-contaminate tabs', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const sharedBody = { message: 'shared' };

    act(() => {
      result.current.addTab();
    });

    const [tabA, tabB] = result.current.tabs;
    act(() => {
      result.current.updateTab(tabA!.id, { body: sharedBody });
      result.current.updateTab(tabB!.id, { body: sharedBody });
    });

    sharedBody.message = 'mutated';

    const updatedA = result.current.tabs.find((tab) => tab.id === tabA!.id)!;
    const updatedB = result.current.tabs.find((tab) => tab.id === tabB!.id)!;
    expect(updatedA.body).toEqual({ message: 'shared' });
    expect(updatedB.body).toEqual({ message: 'shared' });
    expect(updatedA.body).not.toBe(updatedB.body);
    expect(updatedA.body).not.toBe(sharedBody);
  });

  it('resolveTabConnection uses linked profile target when tab target is empty', () => {
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      profiles: [{
        id: 'profile-1',
        name: 'Staging',
        target: 'staging.example.com:50051',
        tlsMode: 'disabled',
      }],
    }));

    act(() => {
      result.current.updateTab(result.current.activeTab.id, {
        connectionId: 'profile-1',
      });
    });

    const resolution = result.current.resolveTabConnection(result.current.activeTab.id);
    expect(resolution.target).toBe('staging.example.com:50051');
    expect(resolution.connectionProfileId).toBe('profile-1');
  });

  it('resolveTabConnection throws for unknown tab id', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    expect(() => result.current.resolveTabConnection('missing-tab')).toThrow(/Tab not found/);
  });

  it('updateTab ignores unknown tab id without changing session', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;
    const tabsBefore = result.current.tabs;

    act(() => {
      result.current.updateTab('missing-tab', { target: 'localhost:9090' });
    });

    expect(result.current.tabs).toBe(tabsBefore);
    expect(result.current.activeTab.id).toBe(tabId);
    expect(result.current.activeTab.target).toBe('');
  });

  it('updateTab clones lastError so shared references cannot cross-contaminate tabs', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const sharedError = {
      code: 'UNAVAILABLE' as const,
      message: 'down',
      category: 'network' as const,
    };

    act(() => {
      result.current.addTab();
    });

    const [tabA, tabB] = result.current.tabs;
    act(() => {
      result.current.updateTab(tabA!.id, { lastError: sharedError });
      result.current.updateTab(tabB!.id, { lastError: sharedError });
    });

    sharedError.message = 'mutated';

    const updatedA = result.current.tabs.find((tab) => tab.id === tabA!.id)!;
    const updatedB = result.current.tabs.find((tab) => tab.id === tabB!.id)!;
    expect(updatedA.lastError?.message).toBe('down');
    expect(updatedB.lastError?.message).toBe('down');
    expect(updatedA.lastError).not.toBe(updatedB.lastError);
    expect(updatedA.lastError).not.toBe(sharedError);
  });

  it('prepareExecuteSnapshot throws for unknown tab id', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    expect(() => result.current.prepareExecuteSnapshot('missing-tab', 'req-x')).toThrow(/Tab not found/);
  });

  it('prepareExecuteSnapshot uses profile target when tab target is empty', () => {
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      profiles: [{
        id: 'profile-1',
        name: 'Staging',
        target: 'staging.example.com:50051',
        tlsMode: 'disabled',
      }],
    }));

    act(() => {
      result.current.updateTab(result.current.activeTab.id, {
        connectionId: 'profile-1',
        descriptorKey: 'desc-1',
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'via-profile' },
      });
    });

    const snapshot = result.current.prepareExecuteSnapshot(result.current.activeTab.id, 'req-profile');
    expect(snapshot.target.address).toBe('staging.example.com:50051');
  });

  it('prepareExecuteSnapshot throws when TLS contract is invalid (Phase 4B)', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));

    act(() => {
      result.current.updateTab(result.current.activeTab.id, {
        descriptorKey: 'desc-1',
        service: 'echo.EchoService',
        method: 'Echo',
        tlsMode: 'mtls',
        tlsConfig: {},
      });
    });

    expect(() => result.current.prepareExecuteSnapshot(
      result.current.activeTab.id,
      'req-bad-tls',
    )).toThrow(/clientCertPem/i);
  });

  it('prepareExecuteSnapshot allows oauth2 auth when shape is valid (Phase 4D)', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));

    act(() => {
      result.current.updateTab(result.current.activeTab.id, {
        descriptorKey: 'desc-1',
        service: 'echo.EchoService',
        method: 'Echo',
        auth: { type: 'oauth2', oauth2: { tokenUrl: 'https://t', clientId: 'id', clientSecret: 'sec' } },
      });
    });

    expect(() => result.current.prepareExecuteSnapshot(
      result.current.activeTab.id,
      'req-oauth-auth',
    )).not.toThrow();
  });

  it('updateTab clones metadata so shared references cannot cross-contaminate tabs', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const sharedMetadata = { trace: '1' };

    act(() => {
      result.current.addTab();
    });

    const [tabA, tabB] = result.current.tabs;
    act(() => {
      result.current.updateTab(tabA!.id, { metadata: sharedMetadata });
      result.current.updateTab(tabB!.id, { metadata: sharedMetadata });
    });

    sharedMetadata.trace = 'mutated';

    const updatedA = result.current.tabs.find((tab) => tab.id === tabA!.id)!;
    const updatedB = result.current.tabs.find((tab) => tab.id === tabB!.id)!;
    expect(updatedA.metadata.trace).toBe('1');
    expect(updatedB.metadata.trace).toBe('1');
    expect(updatedA.metadata).not.toBe(updatedB.metadata);
    expect(updatedA.metadata).not.toBe(sharedMetadata);
  });

  it('exports max tabs constant aligned with websocket studio', () => {
    expect(GRPC_STUDIO_MAX_TABS).toBe(8);
  });

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

});
