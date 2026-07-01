/**
 * Coverage gaps — grpcWorkflowSnapshotBuilder.ts
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import type { GrpcServerStreamNodeData, GrpcUnaryNodeData } from '../types/workflow/node-grpc';
import {
  buildGrpcWorkflowExecuteSnapshot,
  grpcWorkflowExecuteSnapshotTransportFingerprint,
  resolutionToWorkflowGrpcTarget,
} from './grpcWorkflowSnapshotBuilder';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };

function validUnary(overrides: Partial<GrpcUnaryNodeData> = {}): GrpcUnaryNodeData {
  return {
    label: 'Echo',
    target: FIXTURE_UNARY_CALL_REQUEST.target.address,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    callType: 'unary',
    body: { message: 'hello' },
    ...overrides,
  };
}

function validStream(overrides: Partial<GrpcServerStreamNodeData> = {}): GrpcServerStreamNodeData {
  return {
    label: 'Stream',
    target: FIXTURE_UNARY_CALL_REQUEST.target.address,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: 'ServerStreamEcho',
    callType: 'server_streaming',
    body: {},
    collect: { maxMessages: 10 },
    ...overrides,
  };
}

describe('grpcWorkflowSnapshotBuilder coverage gaps', () => {
  it('rejects invalid metadata at snapshot build time', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-meta',
        requestId: 'req-meta',
        data: validUnary({ metadata: { 'bad key': 'value' } }),
      },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/metadata/i);
  });

  it('rejects invalid resolved target address', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-target',
        requestId: 'req-target',
        data: validUnary({ target: 'not-valid-target' }),
      },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/target/i);
  });

  it('resolutionToWorkflowGrpcTarget returns grpc target for valid config', () => {
    const target = resolutionToWorkflowGrpcTarget(validUnary(), {
      resolveTemplate: (template) => template,
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
    });
    expect(target.address).toBe(FIXTURE_UNARY_CALL_REQUEST.target.address);
    expect(target.tlsMode).toBe('disabled');
  });

  it('resolutionToWorkflowGrpcTarget rejects invalid target', () => {
    expect(() => resolutionToWorkflowGrpcTarget(
      validUnary({ target: '!!!' }),
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/target/i);
  });

  it('transport fingerprint includes capturedAt when requested', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-fp',
        requestId: 'req-fp',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: validUnary(),
      },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );
    const without = grpcWorkflowExecuteSnapshotTransportFingerprint(snapshot);
    const withCaptured = grpcWorkflowExecuteSnapshotTransportFingerprint(snapshot, { includeCapturedAt: true });
    expect(withCaptured).not.toBe(without);
    expect(withCaptured).toContain('2026-06-29T00:00:00.000Z');
  });

  it('omits collect config for unary snapshots', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      { nodeId: 'grpc-unary', requestId: 'req-unary', data: validUnary() },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );
    expect(snapshot.collect).toBeUndefined();
  });

  it('includes collect config for server-stream snapshots', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      { nodeId: 'grpc-stream', requestId: 'req-stream', data: validStream() },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );
    expect(snapshot.collect).toEqual({ maxMessages: 10, untilExpression: undefined });
  });
});
