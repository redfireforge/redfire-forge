/**
 * Coverage gaps — grpcWorkflowSnapshotBuilder.ts
 */
import { describe, expect, it, vi } from 'vitest';
import * as grpcAuthPolicy from '@shared/grpc/grpcAuthPolicy';
import * as grpcTlsPolicy from '@shared/grpc/grpcTlsPolicy';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';
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

  it('builds snapshots with activeEnvironment template resolver when variableContext is absent', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-env-only',
        requestId: 'req-env-only',
        data: validUnary({ body: { message: '{{msg}}' } }),
      },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        activeEnvironment: { msg: 'from-env' },
      },
    );
    expect(snapshot.execute.body).toEqual({ message: 'from-env' });
  });

  it('builds snapshots with activeEnvironment and variableContext interpolation', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-env',
        requestId: 'req-env',
        data: validUnary({ target: '{{grpcHost}}', body: { message: '{{msg}}' } }),
      },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        activeEnvironment: { grpcHost: 'localhost:50051', msg: 'hello' },
        variableContext: {
          resolve: (template: string) => template.replace('{{msg}}', 'hello'),
        } as never,
      },
    );
    expect(snapshot.execute.target.address).toBe('localhost:50051');
    expect(snapshot.execute.body).toEqual({ message: 'hello' });
  });

  it('rejects inherit auth when profiles and defaults are omitted', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-auth-missing',
        requestId: 'req-auth-missing',
        data: validUnary({ auth: { type: 'inherit' } }),
      },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/auth profile/i);
  });

  it('uses default TLS error message when validation issue message is missing', () => {
    vi.spyOn(grpcTlsPolicy, 'validateGrpcTlsConfigContract').mockReturnValue([{} as never]);
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      { nodeId: 'grpc-tls-fallback', requestId: 'req-tls-fallback', data: validUnary({ tlsMode: 'tls' }) },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        tlsConfig: { caCert: 'pem' },
      },
    )).toThrow('Invalid TLS configuration');
    vi.restoreAllMocks();
  });

  it('uses default auth error message when validation issue message is missing', () => {
    vi.spyOn(grpcAuthPolicy, 'validateGrpcAuthForExecute').mockReturnValue([{} as never]);
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      { nodeId: 'grpc-auth-fallback', requestId: 'req-auth-fallback', data: validUnary() },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow('Invalid gRPC auth configuration');
    vi.restoreAllMocks();
  });

  it('rejects inherit auth when profile resolution fails', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-auth',
        requestId: 'req-auth',
        data: validUnary({ auth: { type: 'inherit' } }),
      },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        globalAuthProfiles: [],
        defaultAuthProfileId: 'missing-profile',
      },
    )).toThrow();
  });

  it('resolves inherit auth from the default global profile', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-inherit',
        requestId: 'req-inherit',
        data: validUnary({ auth: { type: 'inherit' } }),
      },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        globalAuthProfiles: [{
          id: 'gp1',
          name: 'Corp',
          auth: { type: 'bearer', token: 'secret' },
        } as never],
        defaultAuthProfileId: 'gp1',
      },
    );
    expect(snapshot.execute.auth).toEqual(expect.objectContaining({
      type: 'bearer',
      bearerToken: 'secret',
    }));
  });

  it('rejects invalid tls configuration from context', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      { nodeId: 'grpc-tls', requestId: 'req-tls', data: validUnary({ tlsMode: 'mtls' }) },
      {
        resolveTemplate: (template) => template,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        tlsConfig: {},
      },
    )).toThrow();
  });
});
