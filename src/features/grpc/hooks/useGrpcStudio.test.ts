/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_DESCRIBE_SUCCESS_ENVELOPE,
  FIXTURE_ECHO_PROTO,
  FIXTURE_DESCRIBE_PROTOSET_REQUEST,
  FIXTURE_HAPPY_CALL_ENVELOPE,
  FIXTURE_CALL_FAILED_ENVELOPE,
  FIXTURE_CANCELLED_ENVELOPE,
  FIXTURE_CANCEL_SUCCESS_ENVELOPE,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_SERVER_STREAM_START_REQUEST,
} from '../../../shared/grpc/contractFixtures';
import { createGrpcInterpolationEnvSnapshotFromMap } from '../../../shared/grpc/grpcInterpolationEnvSnapshot';
import { setGrpcClientTransport } from '../../../shared/grpc/grpcApiClient';
import * as grpcStreamClient from '../../../shared/grpc/grpcStreamClient';
import {
  openGrpcStreamEvents,
  setGrpcStreamTransport,
} from '../../../shared/grpc/grpcStreamClient';
import { createGrpcSuccessEnvelope } from '../../../shared/grpc/contracts';
import { resetGrpcTabCounterForTests } from '../grpcStudioTypes';
import { GRPC_STUDIO_MAX_TABS, useGrpcStudio } from './useGrpcStudio';
import * as grpcStudioSessionHelpers from './grpcStudioSessionHelpers';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };

describe('useGrpcStudio (Phase 1D)', () => {
  beforeEach(() => {
    resetGrpcTabCounterForTests();
    setGrpcClientTransport(null);
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
        protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
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
        protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
      });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('loaded');
    expect(descriptorState.sourceSelection.activeSource).toBe('proto_files');
  });

  it('describeFromIngest falls back to reflection in auto mode when protoset describe fails', async () => {
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
      expect(loaded).toBe(true);
    });

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('loaded');
    expect(descriptorState.sourceSelection.activeSource).toBe('reflection');
  });

  it('exportProtoset calls export API for loaded descriptor', async () => {
    const transport = vi.fn(async (op) => {
      if (op === 'export_protoset') {
        return createGrpcSuccessEnvelope('export_protoset', {
          protosetBase64: 'YQ==',
          fileName: 'grpc-proto_files-test.pb',
        });
      }
      if (op === 'reflect') return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      throw new Error(`unexpected op ${op}`);
    });
    setGrpcClientTransport(transport);

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

    await act(async () => {
      await result.current.exportProtoset(tabId);
    });

    expect(transport).toHaveBeenCalledWith(
      'export_protoset',
      '/api/grpc/export-protoset',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('exportProtoset augments invalid descriptor errors with reload guidance', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'export_protoset') {
        return {
          ok: false,
          op: 'export_protoset',
          error: {
            code: 'GRPC_INVALID_DESCRIPTOR',
            category: 'validation',
            message: 'Descriptor root is not available for export',
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
    });
    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    await expect(act(async () => {
      await result.current.exportProtoset(tabId);
    })).rejects.toThrow(/Reload the schema/);
  });

  it('prepareExecuteSnapshot throws while descriptor reload is in flight', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        await new Promise(() => {});
      }
      throw new Error(`unexpected op ${op}`);
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    act(() => {
      void result.current.reflectTab(tabId);
    });

    await waitFor(() => {
      expect(result.current.getTabDescriptor(tabId).loadState).toBe('loading');
    });

    expect(() => result.current.prepareExecuteSnapshot(tabId, 'req-blocked')).toThrow(
      /Schema is still loading/,
    );
  });

  it('describeFromIngest stores descriptor with fingerprint and auto source selection', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe') return FIXTURE_DESCRIBE_SUCCESS_ENVELOPE;
      throw new Error(`unexpected op ${op}`);
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
      });
    });

    await act(async () => {
      const loaded = await result.current.describeFromIngest(tabId);
      expect(loaded).toBe(true);
    });

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('loaded');
    expect(descriptorState.descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(descriptorState.sourceFingerprint).toEqual(FIXTURE_DESCRIPTOR.sourceFingerprint);
    expect(descriptorState.lastKnownGoodDescriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(descriptorState.sourceSelection.mode).toBe('auto');
    expect(descriptorState.sourceSelection.activeSource).toBe('proto_files');
  });

  it('prepareExecuteSnapshot captures sourceFingerprint after describeFromIngest', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe') return FIXTURE_DESCRIBE_SUCCESS_ENVELOPE;
      throw new Error(`unexpected op ${op}`);
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
      });
    });

    await act(async () => {
      await result.current.describeFromIngest(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
    });

    const snapshot = result.current.prepareExecuteSnapshot(tabId, 'req-describe-bound');
    expect(snapshot.descriptorKey).toBe(FIXTURE_DESCRIPTOR.key);
    expect(snapshot.sourceFingerprint).toEqual(FIXTURE_DESCRIPTOR.sourceFingerprint);
  });

  it('describeFromIngest rejects empty proto file list without API call', async () => {
    const transport = vi.fn(async () => FIXTURE_DESCRIBE_SUCCESS_ENVELOPE);
    setGrpcClientTransport(transport);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    await act(async () => {
      const loaded = await result.current.describeFromIngest(tabId);
      expect(loaded).toBe(false);
    });

    expect(transport).not.toHaveBeenCalled();
    expect(result.current.getTabDescriptor(tabId).errorMessage).toMatch(/at least one/i);
  });

  it('patchTabProtoIngest clears descriptor error state when editing draft', async () => {
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    await act(async () => {
      await result.current.describeFromIngest(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('error');

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
      });
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');
    expect(result.current.getTabDescriptor(tabId).errorMessage).toBeUndefined();
  });

  it('patchTabProtoIngest during describe invalidates in-flight load and resets loading state', async () => {
    let resolveSlowDescribe: (() => void) | undefined;
    const slowDescribe = new Promise<void>((resolve) => {
      resolveSlowDescribe = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'describe') {
        await slowDescribe;
        return FIXTURE_DESCRIBE_SUCCESS_ENVELOPE;
      }
      throw new Error(`unexpected op ${op}`);
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
      });
    });

    let describePromise: Promise<boolean> | undefined;
    act(() => {
      describePromise = result.current.describeFromIngest(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loading');

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        protoFiles: [
          { path: 'echo.proto', content: FIXTURE_ECHO_PROTO },
          { path: 'extra.proto', content: 'syntax = "proto3"; message Extra {}' },
        ],
      });
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('idle');

    await act(async () => {
      resolveSlowDescribe?.();
      const loaded = await describePromise;
      expect(loaded).toBe(false);
    });

    expect(result.current.getTabDescriptor(tabId).descriptor).toBeUndefined();
  });

  it('describeFromIngest loads protoset source with manual selection', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe') return FIXTURE_DESCRIBE_SUCCESS_ENVELOPE;
      throw new Error(`unexpected op ${op}`);
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        source: 'protoset',
        protosetBase64: FIXTURE_DESCRIBE_PROTOSET_REQUEST.protosetBase64,
        protosetFileName: 'echo.pb',
      });
    });

    await act(async () => {
      const loaded = await result.current.describeFromIngest(tabId);
      expect(loaded).toBe(true);
    });

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('loaded');
    expect(descriptorState.sourceSelection.activeSource).toBe('protoset');
  });

  it('describeFromIngest loads url_proto source with manual selection', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe') return FIXTURE_DESCRIBE_SUCCESS_ENVELOPE;
      throw new Error(`unexpected op ${op}`);
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        source: 'url_proto',
        url: 'https://example.com/schemas/echo.proto',
      });
    });

    await act(async () => {
      const loaded = await result.current.describeFromIngest(tabId);
      expect(loaded).toBe(true);
    });

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('loaded');
    expect(descriptorState.sourceSelection.activeSource).toBe('url_proto');
    expect(descriptorState.sourceSelection.mode).toBe('auto');
  });

  it('describeFromIngest loads bsr source and clears token after success', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe') return FIXTURE_DESCRIBE_SUCCESS_ENVELOPE;
      throw new Error(`unexpected op ${op}`);
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        source: 'bsr',
        bsrModule: 'buf.build/acme/echo',
        bsrVersion: 'main',
        bsrToken: 'secret-token',
      });
    });

    await act(async () => {
      const loaded = await result.current.describeFromIngest(tabId);
      expect(loaded).toBe(true);
    });

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('loaded');
    expect(descriptorState.sourceSelection.activeSource).toBe('bsr');
    expect(descriptorState.protoIngest?.bsrToken).toBeUndefined();
  });

  it('describeFromIngest preserves last-known-good descriptor on failure', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe') {
        return {
          ok: false as const,
          op: 'describe' as const,
          error: {
            code: 'GRPC_IMPORT_RESOLUTION_FAILED',
            message: 'Unresolved import "missing/vendor.proto" (required by broken.proto)',
            retryable: false,
          },
        };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
      });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
    });

    await act(async () => {
      const loaded = await result.current.describeFromIngest(tabId);
      expect(loaded).toBe(false);
    });

    const descriptorState = result.current.getTabDescriptor(tabId);
    expect(descriptorState.loadState).toBe('error');
    expect(descriptorState.descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(descriptorState.lastKnownGoodDescriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(result.current.tabs[0]!.service).toBe('echo.EchoService');
    expect(result.current.tabs[0]!.method).toBe('Echo');
  });

  it('describeFromIngest ignores stale responses when superseded by reflect', async () => {
    let resolveSlowDescribe: (() => void) | undefined;
    const slowDescribe = new Promise<void>((resolve) => {
      resolveSlowDescribe = resolve;
    });
    const describeKey = 'proto_files:stale-describe-key';

    setGrpcClientTransport(async (op) => {
      if (op === 'describe') {
        await slowDescribe;
        return {
          ...FIXTURE_DESCRIBE_SUCCESS_ENVELOPE,
          data: { ...FIXTURE_DESCRIPTOR, key: describeKey, source: 'proto_files' as const },
        };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
      });
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    let describePromise: Promise<boolean> | undefined;
    act(() => {
      describePromise = result.current.describeFromIngest(tabId);
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    await act(async () => {
      resolveSlowDescribe?.();
      await describePromise;
    });

    expect(result.current.getTabDescriptor(tabId).descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(result.current.activeTab.descriptorKey).toBe(FIXTURE_DESCRIPTOR.key);
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
  });

  it('describeFromIngest rejects empty proto file content without API call', async () => {
    const transport = vi.fn();
    setGrpcClientTransport(transport);

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoFiles: [{ path: 'empty.proto', content: '   ' }],
      });
    });

    let loaded = false;
    await act(async () => {
      loaded = await result.current.describeFromIngest(tabId);
    });

    expect(loaded).toBe(false);
    expect(transport).not.toHaveBeenCalled();
    expect(result.current.getTabDescriptor(tabId).errorMessage).toMatch(/non-empty path and content/i);
  });

  it('reflectTab ignores stale responses when superseded by describeFromIngest', async () => {
    let resolveSlowReflect: (() => void) | undefined;
    const slowReflect = new Promise<void>((resolve) => {
      resolveSlowReflect = resolve;
    });
    const reflectKey = 'reflection:localhost:50051:stale-reflect';

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        await slowReflect;
        return {
          ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
          data: { ...FIXTURE_DESCRIPTOR, key: reflectKey },
        };
      }
      return FIXTURE_DESCRIBE_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
      });
    });

    let reflectPromise: Promise<void> | undefined;
    act(() => {
      reflectPromise = result.current.reflectTab(tabId);
    });

    await act(async () => {
      await result.current.describeFromIngest(tabId);
    });

    await act(async () => {
      resolveSlowReflect?.();
      await reflectPromise;
    });

    expect(result.current.getTabDescriptor(tabId).descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
  });

  it('target change preserves tab proto ingest draft', async () => {
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
    }));

    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        source: 'proto_files',
        protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
        importPaths: ['shared'],
      });
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50052' });
    });

    const ingest = result.current.getTabDescriptor(tabId).protoIngest;
    expect(ingest?.protoFiles[0]?.path).toBe('echo.proto');
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

describe('useGrpcStudio executeUnaryCall (Phase 1G)', () => {
  beforeEach(() => {
    resetGrpcTabCounterForTests();
    setGrpcClientTransport(null);
  });

  function seedUnaryReadyTab(
    result: { current: ReturnType<typeof useGrpcStudio> },
  ): string {
    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
        metadata: { 'x-request-id': '1' },
      });
    });
    return tabId;
  }

  it('executeUnaryCall sets calling lifecycle before HTTP await', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      void result.current.executeUnaryCall(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.lifecycle).toBe('calling');

    resolveCall!();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('executeUnaryCall stores success result on happy path', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'call') return FIXTURE_HAPPY_CALL_ENVELOPE;
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('success');
    expect(tab.lastResult?.body).toEqual({ message: 'hello grpc' });
    expect(tab.activeRequestId).toBeUndefined();
  });

  it('executeUnaryCall sets error lifecycle on failure envelope', async () => {
    setGrpcClientTransport(async () => FIXTURE_CALL_FAILED_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('error');
    expect(tab.lastError?.message).toContain('NOT_FOUND');
  });

  it('cancelUnaryCall marks tab cancelled and ignores late success', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    let executePromise: Promise<void>;
    act(() => {
      executePromise = result.current.executeUnaryCall(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.lifecycle).toBe('calling');

    await act(async () => {
      await result.current.cancelUnaryCall(tabId);
    });

    resolveCall!();
    await act(async () => {
      await executePromise!;
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('cancelled');
    expect(tab.lastResult).toBeUndefined();
  });

  it('executeUnaryCall applies response after connection change while call is in flight (Phase 9C)', async () => {
    let resolveSlow: (() => void) | undefined;
    const slowGate = new Promise<void>((resolve) => {
      resolveSlow = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await slowGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    let firstCall: Promise<void>;
    act(() => {
      firstCall = result.current.executeUnaryCall(tabId);
    });

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50052' });
    });

    resolveSlow!();
    await act(async () => {
      await firstCall!;
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('success');
    expect(tab.lastResult).toBeDefined();
    expect(tab.target).toBe('localhost:50052');
  });

  it('executeUnaryCall sets validation error when snapshot cannot be captured', async () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
      });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('error');
    expect(tab.lastError?.message).toMatch(/descriptorKey|target/i);
  });

  it('cancelUnaryCall invokes onCancelInFlight callback', async () => {
    const onCancelInFlight = vi.fn();
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      void result.current.executeUnaryCall(tabId);
    });

    await act(async () => {
      await result.current.cancelUnaryCall(tabId);
    });

    expect(onCancelInFlight).toHaveBeenCalledWith(tabId, expect.any(String));
    resolveCall!();
  });

  it('executeUnaryCall applies body overrides without waiting for tab state flush', async () => {
    let capturedBody: Record<string, unknown> | undefined;
    setGrpcClientTransport(async (op, _path, init) => {
      if (op === 'call') {
        const payload = JSON.parse(String(init.body)) as { body: Record<string, unknown> };
        capturedBody = payload.body;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      result.current.updateTab(tabId, { body: { message: 'stale-tab-body' } });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabId, { body: { message: 'override-body' } });
    });

    expect(capturedBody).toEqual({ message: 'override-body' });
    expect(result.current.tabs.find((entry) => entry.id === tabId)!.lifecycle).toBe('success');
  });

  it('executeUnaryCall posts oauth2 auth without client-side metadata merge (Phase 4D)', async () => {
    let capturedPayload: { auth?: { type?: string }; metadata?: Record<string, string> } | undefined;
    setGrpcClientTransport(async (op, _path, init) => {
      if (op === 'call') {
        capturedPayload = JSON.parse(String(init.body)) as {
          auth?: { type?: string };
          metadata?: Record<string, string>;
        };
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
        metadata: { 'x-trace': 'abc' },
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'client',
            clientSecret: 'secret',
          },
        },
      });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    expect(capturedPayload?.auth?.type).toBe('oauth2');
    expect(capturedPayload?.metadata).toEqual({ 'x-trace': 'abc' });
    expect(capturedPayload?.metadata?.authorization).toBeUndefined();
    expect(result.current.tabs.find((entry) => entry.id === tabId)!.lifecycle).toBe('success');
  });

  it('cancelUnaryCall does not overwrite a tab that already completed successfully', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'call') return FIXTURE_HAPPY_CALL_ENVELOPE;
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.lifecycle).toBe('success');

    await act(async () => {
      await result.current.cancelUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('success');
    expect(tab.lastResult?.body).toEqual({ message: 'hello grpc' });
  });

  it('reflectTab aborts in-flight unary and ignores late response', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    let executePromise: Promise<void>;
    act(() => {
      executePromise = result.current.executeUnaryCall(tabId);
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    resolveCall!();
    await act(async () => {
      await executePromise!;
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('idle');
    expect(tab.lastResult).toBeUndefined();
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
  });

  it('executeUnaryCall success does not leak to sibling tabs', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'call') return FIXTURE_HAPPY_CALL_ENVELOPE;
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));

    act(() => {
      result.current.addTab();
    });

    const tabA = result.current.tabs[0]!.id;
    const tabB = result.current.tabs[1]!.id;

    act(() => {
      result.current.updateTab(tabA, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'tab-a' },
      });
      result.current.updateTab(tabB, {
        target: 'localhost:50052',
        body: { message: 'tab-b' },
      });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabA);
    });

    const updatedA = result.current.tabs.find((entry) => entry.id === tabA)!;
    const updatedB = result.current.tabs.find((entry) => entry.id === tabB)!;
    expect(updatedA.lifecycle).toBe('success');
    expect(updatedB.lifecycle).toBe('idle');
    expect(updatedB.lastResult).toBeUndefined();
  });

  it('maps GRPC_CANCELLED client error to cancelled lifecycle', async () => {
    setGrpcClientTransport(async () => FIXTURE_CANCELLED_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('cancelled');
  });

  it('executeUnaryCall rejects invalid metadata at snapshot time', async () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      result.current.updateTab(tabId, {
        metadata: { 'payload-bin': '%%%' },
      });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('error');
    expect(tab.lastError?.message).toMatch(/base64/i);
  });

  it('executeUnaryCall ignores duplicate invoke while claim is active', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });
    let callCount = 0;

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        callCount += 1;
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      void result.current.executeUnaryCall(tabId);
      void result.current.executeUnaryCall(tabId);
    });

    resolveCall!();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(callCount).toBe(1);
  });

  it('closeTab aborts in-flight call via inFlightCallRef before activeRequestId commits', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });
    const cancelPaths: string[] = [];

    setGrpcClientTransport(async (op, path) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      if (op === 'cancel') {
        cancelPaths.push(path);
        return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const onCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));

    act(() => {
      result.current.addTab();
    });
    const tabId = result.current.tabs[1]!.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
      });
    });

    act(() => {
      void result.current.executeUnaryCall(tabId);
      result.current.closeTab(tabId);
    });

    expect(onCancelInFlight).toHaveBeenCalledWith(tabId, expect.any(String));
    expect(cancelPaths.length).toBe(1);
    expect(result.current.tabs).toHaveLength(1);

    resolveCall!();
  });

  it('reflectTab invokes onCancelInFlight when aborting an in-flight call', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      if (op === 'reflect') {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const onCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      void result.current.executeUnaryCall(tabId);
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(onCancelInFlight).toHaveBeenCalledWith(tabId, expect.any(String));

    resolveCall!();
  });

  it('duplicateTab during reflect gives copy idle descriptor state', async () => {
    let resolveReflect: (() => void) | undefined;
    const reflectGate = new Promise<void>((resolve) => {
      resolveReflect = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        await reflectGate;
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      return FIXTURE_HAPPY_CALL_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const sourceId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(sourceId, { target: 'localhost:50051' });
    });

    act(() => {
      void result.current.reflectTab(sourceId);
    });

    expect(result.current.getTabDescriptor(sourceId).loadState).toBe('loading');

    act(() => {
      result.current.duplicateTab(sourceId);
    });

    const copy = result.current.tabs.find((tab) => tab.id !== sourceId)!;
    expect(result.current.getTabDescriptor(copy.id).loadState).toBe('idle');

    resolveReflect!();
    await waitFor(() => {
      expect(result.current.getTabDescriptor(sourceId).loadState).toBe('loaded');
    });
  });
});

describe('useGrpcStudio stream (Phase 2G)', () => {
  beforeEach(() => {
    resetGrpcTabCounterForTests();
    setGrpcClientTransport(null);
    setGrpcStreamTransport(null);
    vi.restoreAllMocks();
  });

  it('starts server streaming and transitions to streaming lifecycle', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      return FIXTURE_HAPPY_CALL_ENVELOPE;
    });
    setGrpcStreamTransport(async (path, _init) => {
      if (path.includes('/stream/start')) {
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: 'stream-test-1',
          requestId: 'req-stream-test',
          tabId: 'grpc-tab-1',
        });
      }
      return createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'stream-test-1',
        requestId: 'req-stream-test',
        tabId: 'grpc-tab-1',
        cancelled: true,
      });
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const serverStream = FIXTURE_DESCRIPTOR.services[0]!.methods.find(
      (entry) => entry.name === 'ServerStream',
    )!;

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', serverStream.name);
    });

    await act(async () => {
      await result.current.startStreamCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('streaming');
    expect(tab.activeStreamId).toBe('stream-test-1');
  });

  it('duplicate tab copies stream message cache but resets lifecycle', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'ended',
        streamMessages: [{
          sequence: 1,
          timestamp: '2026-06-29T00:00:00.000Z',
          direction: 'inbound',
          data: { message: 'cached' },
        }],
        activeStreamId: 'stream-old',
      });
      result.current.duplicateTab(tabId);
    });

    const copy = result.current.tabs.find((tab) => tab.id !== tabId)!;
    expect(copy.streamLifecycle).toBe('idle');
    expect(copy.activeStreamId).toBeUndefined();
    expect(copy.streamMessages).toEqual([{
      sequence: 1,
      timestamp: '2026-06-29T00:00:00.000Z',
      direction: 'inbound',
      data: { message: 'cached' },
    }]);
  });

  it('closeTab cancels active stream via DELETE', async () => {
    const paths: string[] = [];
    setGrpcStreamTransport(async (path) => {
      paths.push(path);
      if (path.includes('/stream/start')) {
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: 'stream-close-1',
          requestId: 'req-close',
          tabId: 'grpc-tab-1',
        });
      }
      return createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'stream-close-1',
        requestId: 'req-close',
        tabId: 'grpc-tab-1',
        cancelled: true,
      });
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.addTab();
    });
    const secondId = result.current.tabs.find((tab) => tab.id !== tabId)!.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'ServerStream',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-close-1',
        streamRequestId: 'req-close',
      });
    });

    act(() => {
      result.current.closeTab(tabId);
    });

    await waitFor(() => {
      expect(paths.some((path) => path.includes('stream-close-1') && path.includes('tabId='))).toBe(true);
    });
    expect(result.current.tabs.some((tab) => tab.id === tabId)).toBe(false);
    expect(result.current.activeTabId).toBe(secondId);
  });

  it('addTab detaches SSE subscription from previous active tab', async () => {
    const dispose = vi.fn();
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockReturnValue(dispose);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'ServerStream',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-detach-1',
        streamRequestId: 'req-detach',
      });
    });

    await waitFor(() => {
      expect(openGrpcStreamEvents).toHaveBeenCalled();
    });
    dispose.mockClear();

    act(() => {
      result.current.addTab();
    });

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('maps grpc-end with non-OK status to stream error lifecycle', async () => {
    let capturedOnEvent: ((event: import('../../../shared/grpc/contracts').GrpcStreamEvent) => void) | undefined;
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockImplementation((_streamId, _tabId, options) => {
      capturedOnEvent = options.onEvent;
      return vi.fn();
    });

    setGrpcStreamTransport(async (path) => {
      if (path.includes('/stream/start')) {
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: 'stream-err-1',
          requestId: 'req-err',
          tabId: 'grpc-tab-1',
        });
      }
      return createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'stream-err-1',
        requestId: 'req-err',
        tabId: 'grpc-tab-1',
        cancelled: true,
      });
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      return FIXTURE_HAPPY_CALL_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
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
      await result.current.startStreamCall(tabId);
    });

    await waitFor(() => {
      expect(capturedOnEvent).toBeDefined();
    });

    await act(async () => {
      capturedOnEvent?.({
        type: 'grpc-end',
        streamId: 'stream-err-1',
        requestId: 'req-err',
        tabId,
        sequence: 2,
        timestamp: '2026-06-29T00:00:00.000Z',
        status: 13,
        statusMessage: 'Internal error',
      });
    });

    await waitFor(() => {
      const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
      expect(tab.streamLifecycle).toBe('error');
      expect(tab.streamError?.message).toBe('Internal error');
      expect(tab.activeStreamId).toBeUndefined();
    });
  });

  it('cancelStreamCall during starting aborts in-flight start', async () => {
    let resolveStart: (() => void) | undefined;
    setGrpcStreamTransport((path) => new Promise((resolve) => {
      if (path.includes('/stream/start')) {
        resolveStart = () => {
          resolve(createGrpcSuccessEnvelope('stream_start', {
            streamId: 'stream-start-race',
            requestId: 'req-race',
            tabId: 'grpc-tab-1',
          }));
        };
        return;
      }
      resolve(createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'stream-start-race',
        requestId: 'req-race',
        tabId: 'grpc-tab-1',
        cancelled: true,
      }));
    }));

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      return FIXTURE_HAPPY_CALL_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
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

    act(() => {
      void result.current.startStreamCall(tabId);
    });

    await waitFor(() => {
      expect(result.current.tabs.find((entry) => entry.id === tabId)!.streamLifecycle).toBe('starting');
    });

    await act(async () => {
      await result.current.cancelStreamCall(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.streamLifecycle).toBe('cancelled');

    await act(async () => {
      resolveStart?.();
      await Promise.resolve();
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.streamLifecycle).toBe('cancelled');
  });

  it('selectTab revisit re-attaches SSE for streaming tab', async () => {
    const dispose = vi.fn();
    const openSpy = vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockReturnValue(dispose);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'ServerStream',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-revisit-1',
        streamRequestId: 'req-revisit',
      });
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    dispose.mockClear();

    act(() => {
      result.current.addTab();
    });

    const secondId = result.current.tabs.find((tab) => tab.id !== tabId)!.id;
    expect(dispose).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.selectTab(tabId);
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(2);
    });
    expect(result.current.activeTabId).toBe(tabId);
    expect(result.current.tabs.some((tab) => tab.id === secondId)).toBe(true);
  });

  it('selectTab away and back preserves in-flight stream snapshot fields', () => {
    const dispose = vi.fn();
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockReturnValue(dispose);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;
    const snapshot = {
      tabId,
      requestId: 'req-snapshot',
      capturedAt: '2026-01-01T00:00:00.000Z',
      target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hold', repeat_count: 3 },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      callType: 'server_streaming' as const,
    };

    act(() => {
      result.current.updateTab(tabId, {
        target: snapshot.target.address,
        descriptorKey: snapshot.descriptorKey,
        service: snapshot.service,
        method: snapshot.method,
        body: snapshot.body,
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-snapshot-1',
        streamRequestId: snapshot.requestId,
        lastExecuteSnapshot: snapshot,
      });
    });

    act(() => {
      result.current.addTab();
    });
    const secondId = result.current.tabs.find((tab) => tab.id !== tabId)!.id;

    act(() => {
      result.current.selectTab(secondId);
      result.current.selectTab(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('streaming');
    expect(tab.activeStreamId).toBe('stream-snapshot-1');
    expect(tab.service).toBe('echo.EchoService');
    expect(tab.method).toBe('ServerStream');
    expect(tab.body).toEqual({ message: 'hold', repeat_count: 3 });
    expect(tab.lastExecuteSnapshot).toEqual(snapshot);
  });

  it('clearStreamLog clears messages but preserves lastSequence for SSE dedupe', () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamMessages: [
          {
            sequence: 3,
            timestamp: '2026-01-01T00:00:00.000Z',
            direction: 'inbound',
            data: { message: 'one' },
          },
        ],
        lastSequence: 3,
      });
    });

    act(() => {
      result.current.clearStreamLog(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamMessages).toEqual([]);
    expect(tab.lastSequence).toBe(3);
  });

  it('SSE reconnect exhaustion during ending transitions to error lifecycle', async () => {
    let capturedOnError: ((message: string) => void) | undefined;
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockImplementation((_streamId, _tabId, options) => {
      capturedOnError = options.onError;
      return vi.fn();
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'ClientStream',
        streamLifecycle: 'ending',
        activeStreamId: 'stream-ending-1',
        streamRequestId: 'req-ending',
      });
    });

    await waitFor(() => {
      expect(capturedOnError).toBeDefined();
    });

    act(() => {
      capturedOnError?.('SSE reconnect failed');
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('error');
    expect(tab.activeStreamId).toBeUndefined();
    expect(tab.streamError?.message).toContain('SSE reconnect failed');
  });

  it('SSE 404 during ending transitions to ended (stream already finalized)', async () => {
    let capturedOnError: ((message: string) => void) | undefined;
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockImplementation((_streamId, _tabId, options) => {
      capturedOnError = options.onError;
      return vi.fn();
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'ending',
        activeStreamId: 'stream-gone-1',
        streamRequestId: 'req-gone',
        streamError: {
          code: 'GRPC_CALL_FAILED',
          category: 'call_failed',
          message: 'prior error',
        },
      });
    });

    await waitFor(() => {
      expect(capturedOnError).toBeDefined();
    });

    await act(async () => {
      capturedOnError?.('No active stream registered for streamId stream-gone-1');
    });

    await waitFor(() => {
      const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
      expect(tab.streamLifecycle).toBe('ended');
      expect(tab.activeStreamId).toBeUndefined();
      expect(tab.streamError).toBeUndefined();
    });
  });

  it('grpc-end clears prior streamError on successful completion', async () => {
    let capturedOnEvent: ((event: import('../../../shared/grpc/contracts').GrpcStreamEvent) => void) | undefined;
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockImplementation((_streamId, _tabId, options) => {
      capturedOnEvent = options.onEvent;
      return vi.fn();
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-ok-1',
        streamRequestId: 'req-ok',
        streamError: {
          code: 'GRPC_CALL_FAILED',
          category: 'call_failed',
          message: 'stale error',
        },
      });
    });

    await waitFor(() => {
      expect(capturedOnEvent).toBeDefined();
    });

    await act(async () => {
      capturedOnEvent?.({
        type: 'grpc-end',
        streamId: 'stream-ok-1',
        requestId: 'req-ok',
        tabId,
        sequence: 3,
        timestamp: '2026-06-29T00:00:02.000Z',
        status: 0,
        statusMessage: 'OK',
      });
    });

    await waitFor(() => {
      const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
      expect(tab.streamLifecycle).toBe('ended');
      expect(tab.streamError).toBeUndefined();
    });
  });

  it('ignores grpc-end after tab already cancelled', async () => {
    let capturedOnEvent: ((event: import('../../../shared/grpc/contracts').GrpcStreamEvent) => void) | undefined;
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockImplementation((_streamId, _tabId, options) => {
      capturedOnEvent = options.onEvent;
      return vi.fn();
    });

    setGrpcStreamTransport(async (path) => {
      if (path.includes('/stream/start')) {
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: 'stream-late',
          requestId: 'req-late',
          tabId: 'grpc-tab-1',
        });
      }
      return createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'stream-late',
        requestId: 'req-late',
        tabId: 'grpc-tab-1',
        cancelled: true,
      });
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      return FIXTURE_HAPPY_CALL_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
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
      await result.current.startStreamCall(tabId);
    });

    await waitFor(() => {
      expect(capturedOnEvent).toBeDefined();
    });

    await act(async () => {
      await result.current.cancelStreamCall(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.streamLifecycle).toBe('cancelled');

    act(() => {
      capturedOnEvent?.({
        type: 'grpc-end',
        streamId: 'stream-late',
        requestId: 'req-late',
        tabId,
        sequence: 9,
        timestamp: '2026-06-29T00:00:01.000Z',
        status: 0,
        statusMessage: 'OK',
      });
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('cancelled');
    expect(tab.activeStreamId).toBeUndefined();
  });

  it('repeated cancelStreamCall is idempotent', async () => {
    setGrpcStreamTransport(async () => createGrpcSuccessEnvelope('stream_cancel', {
      streamId: 'stream-idem',
      requestId: 'req-idem',
      tabId: 'grpc-tab-1',
      cancelled: true,
    }));

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'cancelled',
        streamEndedAt: '2026-06-29T00:00:00.000Z',
        activeStreamId: undefined,
      });
    });

    await act(async () => {
      await result.current.cancelStreamCall(tabId);
      await result.current.cancelStreamCall(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.streamLifecycle).toBe('cancelled');
  });

  it('sendStreamMessageCall failure cancels server stream', async () => {
    const cancelPaths: string[] = [];
    setGrpcStreamTransport(async (path, init) => {
      if (init.method === 'POST' && path.includes('/send')) {
        return FIXTURE_CALL_FAILED_ENVELOPE;
      }
      if (path.includes('/stream/') && init.method === 'DELETE') {
        cancelPaths.push(path);
        return createGrpcSuccessEnvelope('stream_cancel', {
          streamId: 'stream-send-fail',
          requestId: 'req-send-fail',
          tabId: 'grpc-tab-1',
          cancelled: true,
        });
      }
      return createGrpcSuccessEnvelope('stream_start', {
        streamId: 'stream-send-fail',
        requestId: 'req-send-fail',
        tabId: 'grpc-tab-1',
      });
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-send-fail',
        streamRequestId: 'req-send-fail',
        body: { message: 'fail-send' },
        lastExecuteSnapshot: {
          tabId,
          requestId: 'req-send-fail',
          capturedAt: new Date().toISOString(),
          target: { address: 'localhost:50051', tlsMode: 'disabled' },
          service: FIXTURE_SERVER_STREAM_START_REQUEST.service,
          method: FIXTURE_SERVER_STREAM_START_REQUEST.method,
          body: {},
          metadata: {},
          timeoutMs: 10_000,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          callType: 'server_streaming',
          interpolationEnv: createGrpcInterpolationEnvSnapshotFromMap({}),
        },
      });
    });

    await act(async () => {
      await result.current.sendStreamMessageCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('error');
    expect(tab.activeStreamId).toBeUndefined();
    expect(cancelPaths.some((entry) => entry.includes('stream-send-fail'))).toBe(true);
  });

  it('connection change during stream defers invalidation while stream is active (Phase 9C)', async () => {
    const cancelPaths: string[] = [];
    setGrpcStreamTransport(async (path, init) => {
      if (path.includes('/stream/') && init.method === 'DELETE') {
        cancelPaths.push(path);
        return createGrpcSuccessEnvelope('stream_cancel', {
          streamId: 'stream-conn-abort',
          requestId: 'req-conn-abort',
          tabId: 'grpc-tab-1',
          cancelled: true,
        });
      }
      return createGrpcSuccessEnvelope('stream_start', {
        streamId: 'stream-conn-abort',
        requestId: 'req-conn-abort',
        tabId: 'grpc-tab-1',
      });
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-conn-abort',
        streamRequestId: 'req-conn-abort',
      });
    });

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50052' });
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('streaming');
    expect(tab.activeStreamId).toBe('stream-conn-abort');
    expect(tab.descriptorKey).toBe(FIXTURE_DESCRIPTOR.key);
    expect(cancelPaths).toHaveLength(0);
  });

  it('reflectTab aborts active stream before re-reflect', async () => {
    const cancelPaths: string[] = [];
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);
    setGrpcStreamTransport(async (path, init) => {
      if (path.includes('/stream/') && init.method === 'DELETE') {
        cancelPaths.push(path);
        return createGrpcSuccessEnvelope('stream_cancel', {
          streamId: 'stream-reflect-abort',
          requestId: 'req-reflect-abort',
          tabId: 'grpc-tab-1',
          cancelled: true,
        });
      }
      return createGrpcSuccessEnvelope('stream_start', {
        streamId: 'stream-reflect-abort',
        requestId: 'req-reflect-abort',
        tabId: 'grpc-tab-1',
      });
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-reflect-abort',
        streamRequestId: 'req-reflect-abort',
      });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('idle');
    expect(tab.activeStreamId).toBeUndefined();
    expect(cancelPaths.some((entry) => entry.includes('stream-reflect-abort'))).toBe(true);
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
  });

  it('endStreamCall failure cancels server stream and marks error', async () => {
    const cancelPaths: string[] = [];
    setGrpcStreamTransport(async (path, init) => {
      if (path.includes('/end') && init.method === 'POST') {
        return FIXTURE_CALL_FAILED_ENVELOPE;
      }
      if (path.includes('/stream/') && init.method === 'DELETE') {
        cancelPaths.push(path);
        return createGrpcSuccessEnvelope('stream_cancel', {
          streamId: 'stream-end-fail',
          requestId: 'req-end-fail',
          tabId: 'grpc-tab-1',
          cancelled: true,
        });
      }
      return createGrpcSuccessEnvelope('stream_start', {
        streamId: 'stream-end-fail',
        requestId: 'req-end-fail',
        tabId: 'grpc-tab-1',
      });
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-end-fail',
        streamRequestId: 'req-end-fail',
      });
    });

    await act(async () => {
      await result.current.endStreamCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('error');
    expect(tab.activeStreamId).toBeUndefined();
    expect(cancelPaths.some((entry) => entry.includes('stream-end-fail'))).toBe(true);
  });

  it('executeUnaryCall aborts active stream before sending unary', async () => {
    const cancelPaths: string[] = [];
    setGrpcClientTransport(async () => FIXTURE_HAPPY_CALL_ENVELOPE);
    setGrpcStreamTransport(async (path, init) => {
      if (path.includes('/stream/') && init.method === 'DELETE') {
        cancelPaths.push(path);
        return createGrpcSuccessEnvelope('stream_cancel', {
          streamId: 'stream-unary-preempt',
          requestId: 'req-unary-preempt',
          tabId: 'grpc-tab-1',
          cancelled: true,
        });
      }
      return createGrpcSuccessEnvelope('stream_start', {
        streamId: 'stream-unary-preempt',
        requestId: 'req-unary-preempt',
        tabId: 'grpc-tab-1',
      });
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'Echo',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-unary-preempt',
        streamRequestId: 'req-unary-preempt',
      });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.streamLifecycle).toBe('idle');
    expect(tab.activeStreamId).toBeUndefined();
    expect(tab.lifecycle).toBe('success');
    expect(cancelPaths.some((entry) => entry.includes('stream-unary-preempt'))).toBe(true);
  });
});

describe('useGrpcStudio schema drift (Phase 3H)', () => {
  beforeEach(() => {
    resetGrpcTabCounterForTests();
    setGrpcClientTransport(null);
  });

  it('reflectTab preserves body and sets blocking drift when active method disappears', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      const descriptorWithoutEcho = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-without-echo',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((entry) => entry.name !== 'Echo'),
        }],
      };
      return {
        ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
        data: descriptorWithoutEcho,
      };
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
      result.current.updateTab(tabId, { body: { message: 'draft-body' } });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    const descriptor = result.current.getTabDescriptor(tabId);
    expect(tab.service).toBe('echo.EchoService');
    expect(tab.method).toBe('Echo');
    expect(tab.body).toEqual({ message: 'draft-body' });
    expect(descriptor.driftState).toBe('blocking');
    expect(descriptor.suggestedRebinds?.length).toBeGreaterThan(0);
  });

  it('executeUnaryCall succeeds while warning drift is active (Phase 5H)', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      const descriptorWithRemovedField = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-empty-echo-request',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
            entry.name === 'Echo'
              ? {
                ...entry,
                requestSchema: {
                  ...entry.requestSchema,
                  fields: [],
                },
              }
              : entry
          )),
        }],
      };
      return {
        ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
        data: descriptorWithRemovedField,
      };
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
      result.current.updateTab(tabId, { body: { message: 'hello' } });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('warning');

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('success');
    expect(result.current.getTabDescriptor(tabId).driftState).toBe('warning');
  });

  it('dismissSchemaDrift clears warning state', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      const descriptorWithRemovedField = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-empty-echo-request',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
            entry.name === 'Echo'
              ? {
                ...entry,
                requestSchema: {
                  ...entry.requestSchema,
                  fields: [],
                },
              }
              : entry
          )),
        }],
      };
      return {
        ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
        data: descriptorWithRemovedField,
      };
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
      result.current.updateTab(tabId, { body: { message: 'hello' } });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.dismissSchemaDrift(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('none');
  });

  it('dismissSchemaDrift is a no-op on blocking drift', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      const descriptorWithoutEcho = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-without-echo',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((entry) => entry.name !== 'Echo'),
        }],
      };
      return {
        ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
        data: descriptorWithoutEcho,
      };
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
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

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('blocking');

    act(() => {
      result.current.dismissSchemaDrift(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('blocking');
  });

  it('rebindSchemaDriftMethod switches method and clears drift', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      const descriptorWithoutEcho = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-without-echo',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((entry) => entry.name !== 'Echo'),
        }],
      };
      return {
        ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
        data: descriptorWithoutEcho,
      };
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
      result.current.updateTab(tabId, { body: { message: 'keep-me' } });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('blocking');

    act(() => {
      result.current.rebindSchemaDriftMethod(tabId, 'echo.EchoService', 'BidiStream');
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.method).toBe('BidiStream');
    expect(tab.body).toEqual({ message: 'keep-me' });
    expect(result.current.getTabDescriptor(tabId).driftState).toBe('none');
  });

  it('selectMethod during blocking drift preserves draft via schema rebind', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      const descriptorWithoutEcho = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-without-echo',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((entry) => entry.name !== 'Echo'),
        }],
      };
      return {
        ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
        data: descriptorWithoutEcho,
      };
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
      result.current.updateTab(tabId, { body: { message: 'draft-preserve' } });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'BidiStream');
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.method).toBe('BidiStream');
    expect(tab.body).toEqual({ message: 'draft-preserve' });
    expect(result.current.getTabDescriptor(tabId).driftState).toBe('none');
  });

  it('pruneSchemaDriftBody clears warning drift and aligns body', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      const descriptorWithRemovedField = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-empty-echo-request',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
            entry.name === 'Echo'
              ? {
                ...entry,
                requestSchema: {
                  ...entry.requestSchema,
                  fields: [],
                },
              }
              : entry
          )),
        }],
      };
      return {
        ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
        data: descriptorWithRemovedField,
      };
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
      result.current.updateTab(tabId, { body: { message: 'hello', stale: 'extra' } });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('warning');

    act(() => {
      result.current.pruneSchemaDriftBody(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(result.current.getTabDescriptor(tabId).driftState).toBe('none');
    expect(tab.body).toEqual({});
  });

  it('clears warning drift when body edits remove stale fields', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      const descriptorWithRemovedField = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-empty-echo-request',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
            entry.name === 'Echo'
              ? {
                ...entry,
                requestSchema: {
                  ...entry.requestSchema,
                  fields: [],
                },
              }
              : entry
          )),
        }],
      };
      return {
        ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
        data: descriptorWithRemovedField,
      };
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
      result.current.updateTab(tabId, { body: { message: 'hello', stale: 'extra' } });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('warning');

    act(() => {
      result.current.updateTab(tabId, { body: {} });
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('none');
    expect(result.current.getTabDescriptor(tabId).driftBaselineRequestSchema).toBeUndefined();
  });

  it('selectMethod during warning drift clears drift before rebinding body', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      const descriptorWithRemovedField = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-empty-echo-request',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
            entry.name === 'Echo'
              ? {
                ...entry,
                requestSchema: {
                  ...entry.requestSchema,
                  fields: [],
                },
              }
              : entry
          )),
        }],
      };
      return {
        ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
        data: descriptorWithRemovedField,
      };
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50051' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'Echo');
      result.current.updateTab(tabId, { body: { message: 'hello', stale: 'extra' } });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('warning');

    act(() => {
      result.current.selectMethod(tabId, 'echo.EchoService', 'BidiStream');
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    const descriptor = result.current.getTabDescriptor(tabId);
    expect(tab.method).toBe('BidiStream');
    expect(tab.body).toEqual({ message: 'hello' });
    expect(descriptor.driftState).toBe('none');
    expect(descriptor.driftBaselineRequestSchema).toBeUndefined();
    expect(descriptor.driftIssues).toBeUndefined();
  });

  it('reflectTab clears drift when target validation fails', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      const descriptorWithoutEcho = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-without-echo',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((entry) => entry.name !== 'Echo'),
        }],
      };
      return {
        ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
        data: descriptorWithoutEcho,
      };
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
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

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('blocking');

    act(() => {
      result.current.updateTab(tabId, { target: 'not a valid target %%' });
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).driftState).toBe('none');
    expect(result.current.getTabDescriptor(tabId).driftStaleMethod).toBeUndefined();
    expect(result.current.getTabDescriptor(tabId).lastKnownGoodDescriptor).toBeUndefined();
    expect(result.current.tabs.find((entry) => entry.id === tabId)?.service).toBeUndefined();
  });
});
