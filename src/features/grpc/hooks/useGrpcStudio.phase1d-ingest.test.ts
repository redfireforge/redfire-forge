/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_DESCRIBE_SUCCESS_ENVELOPE,
  FIXTURE_ECHO_PROTO,
  FIXTURE_DESCRIBE_PROTOSET_REQUEST,
} from '../../../shared/grpc/contractFixtures';
import { setGrpcClientTransport } from '../../../shared/grpc/grpcApiClient';
import { createGrpcSuccessEnvelope } from '../../../shared/grpc/contracts';

const downloadProtosetFileMock = vi.hoisted(() => vi.fn());
vi.mock('../utils/downloadProtoset', () => ({
  downloadProtosetFile: (...args: unknown[]) => downloadProtosetFileMock(...args),
}));

import {useGrpcStudio } from './useGrpcStudio';
import { PAGE_DEFAULTS, setupUseGrpcStudioHookTest } from './useGrpcStudio.testHelpers';

describe('useGrpcStudio Phase 1D — proto ingest', () => {
  beforeEach(() => {
    setupUseGrpcStudioHookTest({ restoreMocks: true });
    downloadProtosetFileMock.mockReset();
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
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
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
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
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
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
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
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
      });
    });

    let describePromise: Promise<boolean> | undefined;
    act(() => {
      describePromise = result.current.describeFromIngest(tabId);
    });

    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loading');

    act(() => {
      result.current.patchTabProtoIngest(tabId, {
        protoRoots: [{
          id: 'root-default',
          mountPath: 'root',
          files: [
            { path: 'echo.proto', content: FIXTURE_ECHO_PROTO },
            { path: 'extra.proto', content: 'syntax = "proto3"; message Extra {}' },
          ],
        }],
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
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
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
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
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
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'empty.proto', content: '   ' }] }],
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
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
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

});
