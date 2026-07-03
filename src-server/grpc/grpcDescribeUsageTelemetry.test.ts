/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  getGrpcDescribeUsageTelemetrySnapshot,
  recordGrpcDescribeUsage,
  resetGrpcDescribeUsageTelemetry,
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

  it('tracks proto_files roots ingest', () => {
    recordGrpcDescribeUsage({
      source: 'proto_files',
      protoRoots: [{ id: 'root-1', mountPath: 'api', files: [{ path: 'service.proto', content: 'syntax = "proto3";' }] }],
    });

    const snap = getGrpcDescribeUsageTelemetrySnapshot();
    expect(snap.protoRoots).toBe(1);
  });

  it('ignores unknown describe sources in the telemetry switch', () => {
    recordGrpcDescribeUsage({ source: 'reflection' } as never);
    expect(getGrpcDescribeUsageTelemetrySnapshot().total).toBe(1);
  });

  it('ignores proto_files requests that do not provide roots', () => {
    recordGrpcDescribeUsage({ source: 'proto_files' });
    const snap = getGrpcDescribeUsageTelemetrySnapshot();
    expect(snap.total).toBe(1);
    expect(snap.protoRoots).toBe(0);
  });
});
