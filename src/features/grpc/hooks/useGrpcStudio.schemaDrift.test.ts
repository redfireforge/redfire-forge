/**
 * @vitest-environment jsdom
 */
import { act, renderHook} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
} from '../../../shared/grpc/contractFixtures';
import { setGrpcClientTransport } from '../../../shared/grpc/grpcApiClient';
const downloadProtosetFileMock = vi.hoisted(() => vi.fn());
vi.mock('../utils/downloadProtoset', () => ({
  downloadProtosetFile: (...args: unknown[]) => downloadProtosetFileMock(...args),
}));

import {useGrpcStudio } from './useGrpcStudio';
import { PAGE_DEFAULTS, setupUseGrpcStudioHookTest } from './useGrpcStudio.testHelpers';

describe('useGrpcStudio schema drift (Phase 3H)', () => {
  beforeEach(() => setupUseGrpcStudioHookTest({ restoreMocks: true }));

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
