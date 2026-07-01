import { describe, expect, it } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../../shared/grpc/contractFixtures';
import { createGrpcSavedRequestFromSnapshot } from '../../../shared/grpc/grpcSavedRequest';
import {
  createDefaultProtoIngestState,
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
} from '../grpcStudioTypes';
import {
  analyzeGrpcurlImportSchemaDrift,
  buildDriftDescriptorPatchFromAnalysis,
  grpcurlImportDescriptorStatePatch,
  grpcurlImportToTabStatePatch,
  mergeGrpcurlDescriptorIntoProtoIngest,
  resolveDescriptorStateAfterTabPatch,
  savedRequestToTabPatch,
} from './grpcReplayTabApply';

const TS = '2026-06-29T12:00:00.000Z';

describe('grpcReplayTabApply coverage gaps', () => {
  it('mergeGrpcurlDescriptorIntoProtoIngest returns undefined when flags are absent or empty', () => {
    expect(mergeGrpcurlDescriptorIntoProtoIngest(undefined, undefined)).toBeUndefined();
    expect(mergeGrpcurlDescriptorIntoProtoIngest(undefined, {
      protoPaths: [],
      importPaths: [],
    })).toBeUndefined();
  });

  it('mergeGrpcurlDescriptorIntoProtoIngest maps protoset without import paths', () => {
    const merged = mergeGrpcurlDescriptorIntoProtoIngest(
      { ...createDefaultProtoIngestState(), importPaths: ['shared'] },
      { protoPaths: [], protosetPath: '/tmp/echo.pb', importPaths: [] },
    );
    expect(merged).toEqual({
      source: 'protoset',
      protosetFileName: 'echo.pb',
      importPaths: ['shared'],
      protoFiles: [],
    });
  });

  it('mergeGrpcurlDescriptorIntoProtoIngest preserves existing proto file content', () => {
    const merged = mergeGrpcurlDescriptorIntoProtoIngest(
      {
        ...createDefaultProtoIngestState(),
        protoFiles: [{ path: 'echo/echo.proto', content: 'syntax = "proto3";', sizeBytes: 10 }],
      },
      { protoPaths: ['echo/echo.proto', 'echo/other.proto'], importPaths: ['./proto'] },
    );
    expect(merged?.protoFiles).toEqual([
      { path: 'echo/echo.proto', content: 'syntax = "proto3";', sizeBytes: 10 },
      { path: 'echo/other.proto', content: '' },
    ]);
  });

  it('grpcurlImportDescriptorStatePatch returns undefined when import has no descriptor flags', () => {
    const descriptorState = createEmptyTabDescriptorState();
    expect(grpcurlImportDescriptorStatePatch(descriptorState, {
      ok: true,
      targetAddress: 'localhost:50051',
      serviceFullName: 'echo.EchoService',
      methodName: 'Echo',
      tlsMode: 'plaintext',
      metadata: {},
      body: {},
      warnings: [],
      unsupportedFlags: [],
    })).toBeUndefined();
  });

  it('resolveDescriptorStateAfterTabPatch keeps descriptor state when patch is non-connection', () => {
    const tab = createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY });
    const descriptorState = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    };

    expect(resolveDescriptorStateAfterTabPatch(tab, descriptorState, { title: 'Renamed tab' }))
      .toBe(descriptorState);
  });

  it('resolveDescriptorStateAfterTabPatch resets descriptor state after connection changes', () => {
    const tab = createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY });
    const descriptorState = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      loadState: 'loaded' as const,
    };

    const next = resolveDescriptorStateAfterTabPatch(tab, descriptorState, {
      target: 'localhost:9090',
      descriptorKey: 'new-desc-key',
    });
    expect(next.descriptor).toBeUndefined();
    expect(next.descriptorKey).toBeUndefined();
    expect(next.loadState).toBe('idle');
  });

  it('buildDriftDescriptorPatchFromAnalysis captures warning baseline and rebind suggestions', () => {
    const patch = buildDriftDescriptorPatchFromAnalysis(
      {
        state: 'warning',
        message: 'Orphan field detected',
        issues: [{ kind: 'orphan_field', message: 'staleField is not in schema' }],
        suggestedRebinds: [{ service: 'echo.EchoService', method: 'Echo', reason: 'Closest match' }],
      },
      FIXTURE_DESCRIPTOR,
      FIXTURE_UNARY_CALL_REQUEST.service,
      FIXTURE_UNARY_CALL_REQUEST.method,
    );

    expect(patch.driftState).toBe('warning');
    expect(patch.driftIssues).toHaveLength(1);
    expect(patch.suggestedRebinds).toHaveLength(1);
    expect(patch.driftBaselineRequestSchema?.typeName).toBe('echo.EchoRequest');
    expect(patch.driftStaleMethod).toBeUndefined();
  });

  it('buildDriftDescriptorPatchFromAnalysis omits optional arrays when drift lists are empty', () => {
    const patch = buildDriftDescriptorPatchFromAnalysis(
      {
        state: 'blocking',
        message: 'Method removed',
        issues: [],
        suggestedRebinds: [],
      },
      FIXTURE_DESCRIPTOR,
      FIXTURE_UNARY_CALL_REQUEST.service,
      FIXTURE_UNARY_CALL_REQUEST.method,
    );

    expect(patch.driftIssues).toBeUndefined();
    expect(patch.suggestedRebinds).toBeUndefined();
    expect(patch.driftStaleMethod?.name).toBe('Echo');
  });

  it('grpcurlImportToTabStatePatch exports tls-only grpcurl context', () => {
    const tab = createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY });
    const patch = grpcurlImportToTabStatePatch(tab, {
      ok: true,
      targetAddress: 'localhost:50051',
      serviceFullName: 'echo.EchoService',
      methodName: 'Echo',
      tlsMode: 'tls',
      tlsFilePaths: { caCertPath: './ca.pem' },
      metadata: {},
      body: {},
      warnings: [],
      unsupportedFlags: [],
    });

    expect(patch.grpcurlExportContext).toEqual({
      tlsFilePaths: { caCertPath: './ca.pem' },
      descriptorFlags: undefined,
    });
  });

  it('analyzeGrpcurlImportSchemaDrift uses connection-aware descriptor state after import', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: 'localhost:50051',
    });
    const descriptorState = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      lastKnownGoodDescriptor: FIXTURE_DESCRIPTOR,
    };

    const drift = analyzeGrpcurlImportSchemaDrift(tab, descriptorState, {
      ok: true,
      targetAddress: 'localhost:9090',
      serviceFullName: 'echo.EchoService',
      methodName: 'Echo',
      tlsMode: 'plaintext',
      metadata: {},
      body: { message: 'hello' },
      warnings: [],
      unsupportedFlags: [],
    });

    expect(drift.state).toBe('none');
  });

  it('savedRequestToTabPatch clears stream session fields', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      streamMessages: [{ direction: 'recv', payload: {}, capturedAt: TS }],
    });
    const saved = createGrpcSavedRequestFromSnapshot(
      {
        tabId: tab.id,
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'saved' },
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      { id: 'sr-1', revisionId: 'rev-1', updatedAt: TS },
    );

    const patch = savedRequestToTabPatch(tab, saved);
    expect(patch.streamLifecycle).toBe('idle');
    expect(patch.activeStreamId).toBeUndefined();
    expect(patch.streamMessages).toEqual([]);
  });
});
