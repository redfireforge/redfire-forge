/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  getGrpcDescribeUsageTelemetrySnapshot,
  isLegacyProtoFilesOnlyDescribeRequest,
  recordGrpcDescribeUsage,
  resetGrpcDescribeUsageTelemetry,
  shouldLogLegacyProtoFilesDeprecation,
} from './grpcDescribeUsageTelemetry.js';

describe('grpcDescribeUsageTelemetry', () => {
  beforeEach(() => {
    resetGrpcDescribeUsageTelemetry();
  });

  it('tracks protoset, bsr, and url_proto sources', () => {
    recordGrpcDescribeUsage({ source: 'protoset', protosetBase64: 'abc' });
    recordGrpcDescribeUsage({ source: 'bsr', bsrModule: 'mod', bsrVersion: '1' });
    recordGrpcDescribeUsage({ source: 'url_proto', protoUrl: 'http://example/proto' });

    const snap = getGrpcDescribeUsageTelemetrySnapshot();
    expect(snap.total).toBe(3);
    expect(snap.protoset).toBe(1);
    expect(snap.bsr).toBe(1);
    expect(snap.urlProto).toBe(1);
    expect(snap.lastUpdatedAt).toEqual(expect.any(Number));
  });

  it('tracks proto_files roots, legacy files, and combined ingest', () => {
    recordGrpcDescribeUsage({
      source: 'proto_files',
      protoFiles: [{ path: 'legacy.proto', content: 'syntax = "proto3";' }],
    });
    recordGrpcDescribeUsage({
      source: 'proto_files',
      protoRoots: [{ mountPath: 'api', files: [{ path: 'service.proto', content: 'syntax = "proto3";' }] }],
    });
    recordGrpcDescribeUsage({
      source: 'proto_files',
      protoFiles: [{ path: 'legacy.proto', content: 'syntax = "proto3";' }],
      protoRoots: [{ mountPath: 'api', files: [{ path: 'service.proto', content: 'syntax = "proto3";' }] }],
    });

    const snap = getGrpcDescribeUsageTelemetrySnapshot();
    expect(snap.protoFilesLegacy).toBe(2);
    expect(snap.protoRoots).toBe(2);
    expect(snap.protoRootsAndProtoFiles).toBe(1);
  });

  it('ignores unknown describe sources in the telemetry switch', () => {
    recordGrpcDescribeUsage({ source: 'reflection' } as never);
    expect(getGrpcDescribeUsageTelemetrySnapshot().total).toBe(1);
  });

  it('detects legacy-only proto_files describe requests', () => {
    expect(isLegacyProtoFilesOnlyDescribeRequest({
      source: 'proto_files',
      protoFiles: [{ path: 'a.proto', content: 'syntax = "proto3";' }],
    })).toBe(true);
    expect(isLegacyProtoFilesOnlyDescribeRequest({
      source: 'proto_files',
      protoRoots: [{ mountPath: 'api', files: [{ path: 'a.proto', content: 'syntax = "proto3";' }] }],
    })).toBe(false);
  });

  it('logs legacy deprecation only once until reset', () => {
    expect(shouldLogLegacyProtoFilesDeprecation()).toBe(true);
    expect(shouldLogLegacyProtoFilesDeprecation()).toBe(false);
    resetGrpcDescribeUsageTelemetry();
    expect(shouldLogLegacyProtoFilesDeprecation()).toBe(true);
  });
});
