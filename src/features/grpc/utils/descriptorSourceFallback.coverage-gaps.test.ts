import { describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES } from '../../../shared/grpc/contracts';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { GrpcApiClientError } from '../../../shared/grpc/grpcApiClient';
import { createDefaultProtoIngestState } from '../grpcStudioTypes';
import {
  buildActiveSourceSelectionPatch,
  buildDescribeRequestForSource,
  buildDescriptorSourceAvailability,
  loadDescriptorWithAutoFallback,
  mapGrpcClientErrorToFailureKind,
  orderedDescriptorSourcesForLoad,
} from './descriptorSourceFallback';

describe('descriptorSourceFallback coverage gaps', () => {
  const resolution = {
    target: 'localhost:50051',
    targetValidation: { valid: true, normalized: 'localhost:50051' },
  } as const;

  it('buildDescribeRequestForSource validates protoset source', () => {
    const ingest = createDefaultProtoIngestState();
    expect(buildDescribeRequestForSource('protoset', ingest, 'req-ps')).toEqual({
      error: 'Select a protoset file (.pb or .protoset) before loading',
    });
    expect(buildDescribeRequestForSource('protoset', {
      ...ingest,
      protosetBase64: 'YmFzZTY0',
    }, 'req-ps-ok')).toMatchObject({
      source: 'protoset',
      protosetBase64: 'YmFzZTY0',
    });
  });

  it('orderedDescriptorSourcesForLoad deduplicates and respects auto precedence', () => {
    const availability = {
      reflection: true,
      proto_files: true,
      protoset: false,
      bsr: false,
      url_proto: true,
    };
    const ordered = orderedDescriptorSourcesForLoad(
      { mode: 'auto' },
      availability,
      'reflection',
    );
    expect(ordered[0]).toBe('reflection');
    expect(ordered).toContain('proto_files');
    expect(ordered).not.toContain('protoset');
  });

  it('mapGrpcClientErrorToFailureKind maps reflection and describe defaults', () => {
    expect(mapGrpcClientErrorToFailureKind(new GrpcApiClientError('x', 'y', {
      code: GRPC_ERROR_CODES.REFLECTION_FAILED,
    }), 'reflect')).toBe('reflection_failed');
    expect(mapGrpcClientErrorToFailureKind(new GrpcApiClientError('x', 'y', {
      code: GRPC_ERROR_CODES.DESCRIBE_FAILED,
    }), 'describe')).toBe('describe_failed');
    expect(mapGrpcClientErrorToFailureKind(new GrpcApiClientError('x', 'y', {
      code: GRPC_ERROR_CODES.SOURCE_UNAVAILABLE,
    }), 'reflect')).toBe('source_unavailable');
  });

  it('loadDescriptorWithAutoFallback returns reflection result on first success', async () => {
    const reflect = vi.fn(async () => FIXTURE_DESCRIPTOR);
    const describe = vi.fn();
    const result = await loadDescriptorWithAutoFallback({
      selection: { mode: 'auto' },
      availability: {
        reflection: true,
        proto_files: false,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      initialSource: 'reflection',
      reflect,
      describe,
    });
    expect(result.source).toBe('reflection');
    expect(reflect).toHaveBeenCalledTimes(1);
  });

  it('loadDescriptorWithAutoFallback falls back to describe source in auto mode', async () => {
    const reflect = vi.fn(async () => {
      throw new GrpcApiClientError('reflect', 'down', { code: GRPC_ERROR_CODES.UNREACHABLE });
    });
    const describe = vi.fn(async () => FIXTURE_DESCRIPTOR);
    const result = await loadDescriptorWithAutoFallback({
      selection: { mode: 'auto' },
      availability: {
        reflection: true,
        proto_files: true,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      initialSource: 'reflection',
      reflect,
      describe,
    });
    expect(result.source).toBe('proto_files');
    expect(describe).toHaveBeenCalledWith('proto_files');
  });

  it('loadDescriptorWithAutoFallback throws when no sources are available', async () => {
    await expect(loadDescriptorWithAutoFallback({
      selection: { mode: 'manual', activeSource: 'protoset' },
      availability: {
        reflection: false,
        proto_files: false,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      initialSource: 'protoset',
      reflect: vi.fn(),
      describe: vi.fn(),
    })).rejects.toThrow(/No descriptor sources are available/);
  });

  it('loadDescriptorWithAutoFallback stops when fallback policy rejects retry', async () => {
    const reflect = vi.fn(async () => {
      throw new GrpcApiClientError('reflect', 'policy stop', {
        code: GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED,
      });
    });
    await expect(loadDescriptorWithAutoFallback({
      selection: { mode: 'auto' },
      availability: {
        reflection: true,
        proto_files: true,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      initialSource: 'reflection',
      reflect,
      describe: vi.fn(),
    })).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('loadDescriptorWithAutoFallback throws generic error when last failure is non-Error', async () => {
    const reflect = vi.fn(async () => {
      throw 'broken';
    });
    await expect(loadDescriptorWithAutoFallback({
      selection: { mode: 'manual', activeSource: 'reflection' },
      availability: {
        reflection: true,
        proto_files: false,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      initialSource: 'reflection',
      reflect,
      describe: vi.fn(),
    })).rejects.toThrow(/Failed to load descriptor/);
  });

  it('buildDescribeRequestForSource returns proto_files request with import paths', () => {
    const ingest = {
      ...createDefaultProtoIngestState(),
      protoFiles: [{ path: 'echo.proto', content: 'syntax = "proto3";', sizeBytes: 12 }],
      importPaths: ['vendor/protos'],
    };
    expect(buildDescribeRequestForSource('proto_files', ingest, 'req-pf')).toMatchObject({
      source: 'proto_files',
      importPaths: ['vendor/protos'],
    });
  });

  it('buildDescribeRequestForSource emits protoRoots when root model is present', () => {
    const ingest = {
      ...createDefaultProtoIngestState(),
      protoRoots: [
        {
          id: 'shared-root',
          mountPath: 'shared',
          files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
        },
      ],
    };
    expect(buildDescribeRequestForSource('proto_files', ingest, 'req-pf-roots')).toMatchObject({
      requestId: 'req-pf-roots',
      source: 'proto_files',
      protoRoots: [
        expect.objectContaining({ mountPath: 'shared' }),
      ],
    });
  });

  it('buildDescribeRequestForSource prefers protoRoots over protoFiles when both exist', () => {
    const ingest = {
      ...createDefaultProtoIngestState(),
      protoRoots: [
        {
          id: 'shared-root',
          mountPath: 'shared',
          files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
        },
      ],
      // Intentionally invalid to prove protoFiles are ignored when protoRoots are present.
      protoFiles: [{ path: '', content: '   ', sizeBytes: 1 }],
    };
    expect(buildDescribeRequestForSource('proto_files', ingest, 'req-pf-roots-priority')).toEqual({
      requestId: 'req-pf-roots-priority',
      source: 'proto_files',
      protoRoots: ingest.protoRoots,
      importPaths: undefined,
    });
  });

  it('buildDescriptorSourceAvailability marks url and bsr when configured', () => {
    const ingest = {
      ...createDefaultProtoIngestState(),
      url: 'https://example.com/echo.proto',
      bsrModule: 'acme/echo',
    };
    expect(buildDescriptorSourceAvailability(resolution, ingest)).toMatchObject({
      url_proto: true,
      bsr: true,
    });
  });

  it('buildActiveSourceSelectionPatch records active source', () => {
    expect(buildActiveSourceSelectionPatch('proto_files')).toEqual({ activeSource: 'proto_files' });
  });

  it('buildDescribeRequestForSource omits optional bsr fields when blank', () => {
    const ingest = {
      ...createDefaultProtoIngestState(),
      bsrModule: 'acme/echo',
      bsrVersion: '   ',
      bsrDigest: '',
      bsrToken: '',
    };
    expect(buildDescribeRequestForSource('bsr', ingest, 'req-bsr-min')).toEqual({
      requestId: 'req-bsr-min',
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: undefined,
      bsrDigest: undefined,
      bsrToken: undefined,
    });
  });

  it('buildDescribeRequestForSource validates proto file with empty content', () => {
    const ingest = {
      ...createDefaultProtoIngestState(),
      protoFiles: [{ path: 'echo.proto', content: '   ', sizeBytes: 1 }],
    };
    expect(buildDescribeRequestForSource('proto_files', ingest, 'req-invalid')).toEqual({
      error: 'Each proto file requires a non-empty path and content',
    });
  });

  it('buildDescribeRequestForSource returns proto_files without importPaths when unset', () => {
    const ingest = {
      ...createDefaultProtoIngestState(),
      protoFiles: [{ path: 'echo.proto', content: 'syntax = "proto3";', sizeBytes: 12 }],
    };
    expect(buildDescribeRequestForSource('proto_files', ingest, 'req-pf-min')).toEqual({
      requestId: 'req-pf-min',
      source: 'proto_files',
      protoFiles: [{ path: 'echo.proto', content: 'syntax = "proto3";' }],
    });
  });

  it('buildDescribeRequestForSource returns trimmed url_proto request', () => {
    const ingest = {
      ...createDefaultProtoIngestState(),
      url: '  https://example.com/echo.proto  ',
    };
    expect(buildDescribeRequestForSource('url_proto', ingest, 'req-url')).toEqual({
      requestId: 'req-url',
      source: 'url_proto',
      url: 'https://example.com/echo.proto',
    });
  });

  it('loadDescriptorWithAutoFallback rethrows last Error instance', async () => {
    const reflect = vi.fn(async () => {
      throw new Error('last reflect error');
    });
    await expect(loadDescriptorWithAutoFallback({
      selection: { mode: 'manual', activeSource: 'reflection' },
      availability: {
        reflection: true,
        proto_files: false,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      initialSource: 'reflection',
      reflect,
      describe: vi.fn(),
    })).rejects.toThrow('last reflect error');
  });

  it('loadDescriptorWithAutoFallback treats non-Error throw as describe failure in auto mode', async () => {
    const reflect = vi.fn(async () => {
      throw new Error('reflect failed');
    });
    const describe = vi.fn(async () => FIXTURE_DESCRIPTOR);
    const result = await loadDescriptorWithAutoFallback({
      selection: { mode: 'auto' },
      availability: {
        reflection: true,
        proto_files: true,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      initialSource: 'reflection',
      reflect,
      describe,
    });
    expect(result.source).toBe('proto_files');
  });

  it('buildDescriptorSourceAvailability disables reflection for invalid targets', () => {
    expect(buildDescriptorSourceAvailability({
      target: '{{host}}',
      targetValidation: { valid: false },
    }, createDefaultProtoIngestState()).reflection).toBe(false);
  });

  it('maps grpc client error codes including reflect default', () => {
    expect(mapGrpcClientErrorToFailureKind(new GrpcApiClientError('x', 'y', {
      code: GRPC_ERROR_CODES.CALL_FAILED,
    }), 'reflect')).toBe('reflection_failed');
    expect(mapGrpcClientErrorToFailureKind(new GrpcApiClientError('x', 'y', {
      code: GRPC_ERROR_CODES.CALL_FAILED,
    }), 'describe')).toBe('describe_failed');
  });

  it('loadDescriptorWithAutoFallback returns reflection descriptor on first success', async () => {
    const reflect = vi.fn(async () => FIXTURE_DESCRIPTOR);
    const result = await loadDescriptorWithAutoFallback({
      selection: { mode: 'auto' },
      availability: {
        reflection: true,
        proto_files: false,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      initialSource: 'reflection',
      reflect,
      describe: vi.fn(),
    });
    expect(result).toEqual({ descriptor: FIXTURE_DESCRIPTOR, source: 'reflection' });
  });

  it('loadDescriptorWithAutoFallback stops auto retries when fallback policy rejects', async () => {
    const reflect = vi.fn(async () => {
      throw new GrpcApiClientError('reflect', 'imports failed', {
        code: GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED,
      });
    });
    await expect(loadDescriptorWithAutoFallback({
      selection: { mode: 'auto' },
      availability: {
        reflection: true,
        proto_files: true,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      initialSource: 'reflection',
      reflect,
      describe: vi.fn(),
    })).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('orderedDescriptorSourcesForLoad skips duplicate sources in precedence list', () => {
    const ordered = orderedDescriptorSourcesForLoad(
      { mode: 'auto', autoPrecedence: ['reflection', 'reflection', 'proto_files'] },
      {
        reflection: true,
        proto_files: true,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      'reflection',
    );
    expect(ordered.filter((source) => source === 'reflection')).toHaveLength(1);
  });

  it('buildDescriptorSourceAvailability requires non-empty proto path and content', () => {
    expect(buildDescriptorSourceAvailability(resolution, {
      ...createDefaultProtoIngestState(),
      protoFiles: [{ path: 'echo.proto', content: 'syntax = "proto3";', sizeBytes: 12 }],
    }).proto_files).toBe(true);
    expect(buildDescriptorSourceAvailability(resolution, {
      ...createDefaultProtoIngestState(),
      protoFiles: [{ path: ' ', content: 'syntax = "proto3";', sizeBytes: 12 }],
    }).proto_files).toBe(false);
  });
});
