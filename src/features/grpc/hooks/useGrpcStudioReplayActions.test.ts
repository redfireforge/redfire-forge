/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../../shared/grpc/contractFixtures';
import { createGrpcSavedRequestFromSnapshot } from '../../../shared/grpc/grpcSavedRequest';
import { createGrpcStudioTab, createEmptyTabDescriptorState } from '../grpcStudioTypes';
import { useGrpcStudioReplayActions } from './useGrpcStudioReplayActions';

const TS = '2026-06-29T12:00:00.000Z';

function makeSaved() {
  const tab = createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY });
  return createGrpcSavedRequestFromSnapshot(
    {
      tabId: tab.id,
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
    selectMethod: vi.fn(),
    abortTabInFlightCalls: vi.fn(),
    patchTabDescriptor: vi.fn(),
  };
}

describe('useGrpcStudioReplayActions (Phase 5H)', () => {
  it('openSavedRequestInStudio patches tab and navigates to studio', () => {
    const studio = makeStudio();
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate,
    }));

    act(() => {
      result.current.openSavedRequestInStudio(makeSaved());
    });

    expect(studio.updateTab).toHaveBeenCalledWith(
      studio.activeTab.id,
      expect.objectContaining({
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        grpcurlExportContext: undefined,
      }),
    );
    expect(studio.selectMethod).not.toHaveBeenCalled();
    expect(studio.abortTabInFlightCalls).toHaveBeenCalledWith(studio.activeTab.id);
    expect(studio.patchTabDescriptor).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith('studio');
  });

  it('replayHistoryEntry patches tab from history snapshot and navigates to studio', () => {
    const studio = makeStudio();
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate,
    }));

    const saved = makeSaved();
    const entry = {
      id: 'hist-1',
      capturedAt: TS,
      service: saved.service,
      method: saved.method,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      callType: saved.callType,
      descriptorKey: saved.descriptorKey,
      grpcStatus: 0,
      record: {
        snapshot: {
          tabId: studio.activeTab.id,
          requestId: 'req-hist',
          capturedAt: TS,
          callType: saved.callType,
          target: FIXTURE_UNARY_CALL_REQUEST.target,
          service: saved.service,
          method: saved.method,
          body: saved.body,
          metadata: saved.metadata,
          timeoutMs: saved.timeoutMs,
          descriptorKey: saved.descriptorKey,
        },
      },
    };

    act(() => {
      result.current.replayHistoryEntry(entry as never);
    });

    expect(studio.updateTab).toHaveBeenCalledWith(
      studio.activeTab.id,
      expect.objectContaining({
        service: saved.service,
        method: saved.method,
        body: { message: 'hello' },
      }),
    );
    expect(studio.selectMethod).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith('studio');
  });

  it('applyGrpcurlImport patches tab from parsed command', () => {
    const studio = makeStudio();
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate,
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

    expect(studio.updateTab).toHaveBeenCalledWith(
      studio.activeTab.id,
      expect.objectContaining({
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'imported' },
      }),
    );
    expect(onNavigate).toHaveBeenCalledWith('studio');
    expect(studio.selectMethod).not.toHaveBeenCalled();
  });

  it('applyGrpcurlImport preserves tls/descriptor hints and proto ingest draft', () => {
    const studio = makeStudio();
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate,
    }));

    act(() => {
      result.current.applyGrpcurlImport({
        ok: true,
        targetAddress: 'localhost:50051',
        serviceFullName: 'echo.EchoService',
        methodName: 'Echo',
        tlsMode: 'tls',
        tlsFilePaths: { caCertPath: './ca.pem' },
        descriptorFlags: {
          importPaths: ['./proto'],
          protoPaths: ['echo/echo.proto'],
        },
        metadata: {},
        body: { message: 'imported' },
        warnings: [],
        unsupportedFlags: [],
      });
    });

    expect(studio.updateTab).toHaveBeenCalledWith(
      studio.activeTab.id,
      expect.objectContaining({
        grpcurlExportContext: {
          tlsFilePaths: { caCertPath: './ca.pem' },
          descriptorFlags: {
            importPaths: ['./proto'],
            protoPaths: ['echo/echo.proto'],
          },
        },
      }),
    );
    expect(studio.patchTabDescriptor).toHaveBeenCalledWith(
      studio.activeTab.id,
      expect.objectContaining({
        protoIngest: expect.objectContaining({
          source: 'proto_files',
          importPaths: ['./proto'],
        }),
      }),
    );
  });

  it('applyGrpcurlImport analyzes schema drift against loaded descriptor', () => {
    const studio = makeStudio();
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useGrpcStudioReplayActions({
      studio: studio as never,
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: '', tlsMode: 'disabled' },
      onNavigate,
    }));

    act(() => {
      result.current.applyGrpcurlImport({
        ok: true,
        targetAddress: 'localhost:50051',
        serviceFullName: 'echo.EchoService',
        methodName: 'Echo',
        tlsMode: 'plaintext',
        metadata: {},
        body: { message: 'hello', orphanField: 'stale' },
        warnings: [],
        unsupportedFlags: [],
      });
    });

    expect(studio.patchTabDescriptor).toHaveBeenCalledWith(
      studio.activeTab.id,
      expect.objectContaining({
        driftState: 'warning',
      }),
    );
  });

  it('openSavedRequestInStudio surfaces resolver errors instead of throwing', () => {
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

    expect(studio.updateTab).not.toHaveBeenCalled();
    expect(result.current.lastActionError).toMatch(/missingEnvVar|target|resolve/i);
  });
});
