/**
 * Phase 6B — gRPC workflow snapshot builder tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import { VariableContext } from '../engine/variableContext';
import { validateResolvedGrpcTargetAddress } from '../../../shared/grpc/targetValidation';
import {
  captureGrpcTabExecuteSnapshotFromResolution,
  snapshotToUnaryCallRequest,
} from '../../grpc/grpcStudioTypes';
import { resolveGrpcTabConnection } from '../../grpc/utils/resolveGrpcTabConnection';
import type { GrpcServerStreamNodeData, GrpcUnaryNodeData } from '../types/workflow/node-grpc';
import {
  buildGrpcWorkflowExecuteSnapshot,
  cloneGrpcWorkflowExecuteSnapshot,
  grpcWorkflowExecuteSnapshotTransportFingerprint,
} from './grpcWorkflowSnapshotBuilder';
import { defaultGrpcWorkflowTimeoutMs } from './grpcWorkflowNodeValidation';
import { grpcWorkflowSnapshotToUnaryRequest } from './grpcWorkflowTransportAdapter';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };
const PROFILES = [{
  id: 'profile-a',
  name: 'Local',
  target: '{{grpcHost}}',
  tlsMode: 'disabled' as const,
}];

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

function envResolver(env: Record<string, string>) {
  const ctx = new VariableContext(undefined, env);
  return (template: string) => ctx.resolve(template);
}

describe('grpcWorkflowSnapshotBuilder (Phase 6B)', () => {
  it('builds a unary workflow execute snapshot with resolved target and body', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-1',
        requestId: 'req-1',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: validUnary({
          body: { message: '{{greeting}}' },
          metadata: { 'x-env': '{{envName}}' },
          auth: { type: 'bearer', bearerToken: '{{token}}' },
        }),
      },
      {
        resolveTemplate: envResolver({
          greeting: 'hello',
          envName: 'dev',
          token: 'abc123',
        }),
        profiles: PROFILES,
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.nodeId).toBe('grpc-1');
    expect(snapshot.execute.tabId).toBe('workflow:grpc-1');
    expect(snapshot.execute.callType).toBe('unary');
    expect(snapshot.execute.target.address).toBe('localhost:50051');
    expect(snapshot.execute.body).toEqual({ message: 'hello' });
    expect(snapshot.execute.metadata).toEqual({ 'x-env': 'dev' });
    expect(snapshot.execute.auth?.bearerToken).toBe('abc123');
    expect(snapshot.onError).toBe('fail');
  });

  it('resolves connection profile target templates via env map', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-2',
        requestId: 'req-2',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: validUnary({
          target: '',
          connectionId: 'profile-a',
        }),
      },
      {
        resolveTemplate: envResolver({ grpcHost: 'staging.example.com:50051' }),
        profiles: PROFILES,
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.execute.target.address).toBe('staging.example.com:50051');
  });

  it('freezes server-stream collect untilExpression at build time', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'stream-1',
        requestId: 'req-stream',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: validStream({
          collect: { untilExpression: '$.flag == {{flag}}' },
        }),
      },
      {
        resolveTemplate: envResolver({ flag: 'ready' }),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.collect?.untilExpression).toBe('$.flag == ready');
    expect(snapshot.execute.callType).toBe('server_streaming');
  });

  it('produces deterministic transport fingerprints for identical inputs', () => {
    const input = {
      nodeId: 'grpc-3',
      requestId: 'req-3',
      capturedAt: '2026-06-29T00:00:00.000Z',
      data: validUnary({ saveAs: 'echoCall', retry: { maxAttempts: 2, backoffMs: 100 } }),
    };
    const context = {
      resolveTemplate: envResolver({}),
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
    };
    const a = buildGrpcWorkflowExecuteSnapshot(input, context);
    const b = buildGrpcWorkflowExecuteSnapshot(input, context);
    expect(grpcWorkflowExecuteSnapshotTransportFingerprint(a)).toBe(
      grpcWorkflowExecuteSnapshotTransportFingerprint(b),
    );
  });

  it('isolates snapshot from later variable and node config mutation', () => {
    const env = { greeting: 'hello' };
    const data = validUnary({ body: { message: '{{greeting}}' } });
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-4',
        requestId: 'req-4',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data,
      },
      {
        resolveTemplate: envResolver(env),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    env.greeting = 'mutated';
    data.body.message = '{{greeting}}';
    data.target = 'evil:9999';

    expect(snapshot.execute.body).toEqual({ message: 'hello' });
    expect(snapshot.execute.target.address).toBe('localhost:50051');

    const clone = cloneGrpcWorkflowExecuteSnapshot(snapshot);
    clone.execute.body.message = 'changed';
    expect(snapshot.execute.body).toEqual({ message: 'hello' });
  });

  it('supports node-scoped template resolution via VariableContext', () => {
    const ctx = new VariableContext();
    ctx.setForNode('http-1', 'orderId', 'ORD-99');
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-5',
        requestId: 'req-5',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: validUnary({ body: { orderId: '{{node:http-1.orderId}}' } }),
      },
      {
        resolveTemplate: (template) => ctx.resolve(template),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );
    expect(snapshot.execute.body).toEqual({ orderId: 'ORD-99' });
  });

  it('applies connection profile tlsMode when node omits tlsMode', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-tls',
        requestId: 'req-tls',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: validUnary({
          target: '',
          connectionId: 'tls-profile',
        }),
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [{
          id: 'tls-profile',
          name: 'TLS profile',
          target: 'localhost:50051',
          tlsMode: 'tls',
        }],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.execute.target.tlsMode).toBe('tls');
  });

  it('node tlsMode overrides connection profile tlsMode', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-tls-override',
        requestId: 'req-tls-override',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: validUnary({
          target: '',
          connectionId: 'tls-profile',
          tlsMode: 'disabled',
        }),
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [{
          id: 'tls-profile',
          name: 'TLS profile',
          target: 'localhost:50051',
          tlsMode: 'tls',
        }],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.execute.target.tlsMode).toBe('disabled');
  });

  it('rejects unresolved target templates', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-7',
        requestId: 'req-7',
        data: validUnary({ target: '{{missingHost}}' }),
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/unresolved/i);
  });

  it('rejects unresolved body templates', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-8',
        requestId: 'req-8',
        data: validUnary({ body: { message: '{{missingBody}}' } }),
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/gRPC body\.message/);
  });

  it('rejects unresolved metadata value templates', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-9',
        requestId: 'req-9',
        data: validUnary({ metadata: { 'x-trace': '{{missingMeta}}' } }),
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/gRPC metadata value/);
  });

  it('interpolates templated metadata keys at build time', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-meta-key',
        requestId: 'req-meta-key',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: validUnary({
          metadata: { 'x-{{envName}}': '{{envName}}-value' },
        }),
      },
      {
        resolveTemplate: envResolver({ envName: 'dev' }),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.execute.metadata).toEqual({ 'x-dev': 'dev-value' });
  });

  it('matches Studio unary execute snapshot for resolved workflow config', () => {
    const requestId = 'req-parity';
    const capturedAt = '2026-06-29T00:00:00.000Z';
    const resolveTemplate = envResolver({ greeting: 'parity-msg' });
    const nodeData = validUnary({
      body: { message: '{{greeting}}' },
      metadata: { 'x-trace': '{{greeting}}' },
      auth: { type: 'bearer', bearerToken: 'static-token' },
    });

    const workflowSnapshot = buildGrpcWorkflowExecuteSnapshot(
      { nodeId: 'grpc-parity', requestId, capturedAt, data: nodeData },
      { resolveTemplate, profiles: [], pageDefaults: PAGE_DEFAULTS },
    );

    const baseResolution = resolveGrpcTabConnection(
      { target: nodeData.target, connectionId: nodeData.connectionId, tlsMode: nodeData.tlsMode },
      [],
      PAGE_DEFAULTS,
    );
    const resolvedTarget = resolveTemplate(baseResolution.target);
    const interpolatedResolution = {
      ...baseResolution,
      target: resolvedTarget,
      targetValidation: validateResolvedGrpcTargetAddress(resolvedTarget),
    };

    const studioSnapshot = captureGrpcTabExecuteSnapshotFromResolution(
      {
        id: 'workflow:grpc-parity',
        title: nodeData.label,
        target: nodeData.target,
        connectionId: nodeData.connectionId,
        tlsMode: interpolatedResolution.tlsMode,
        tlsConfig: undefined,
        descriptorKey: nodeData.descriptorKey,
        service: nodeData.service,
        method: nodeData.method,
        body: workflowSnapshot.execute.body,
        metadata: workflowSnapshot.execute.metadata,
        auth: workflowSnapshot.execute.auth,
        timeoutMs: nodeData.timeoutMs ?? defaultGrpcWorkflowTimeoutMs(),
        requestMode: 'form',
        lifecycle: 'idle',
        streamLifecycle: 'idle',
        streamMessages: [],
        lastSequence: 0,
        streamPendingBodies: [],
      },
      requestId,
      interpolatedResolution,
      'unary',
    );
    studioSnapshot.capturedAt = capturedAt;

    expect(workflowSnapshot.execute).toEqual(studioSnapshot);
    expect(grpcWorkflowSnapshotToUnaryRequest(workflowSnapshot)).toEqual(
      snapshotToUnaryCallRequest(studioSnapshot),
    );
  });

  it('rejects unresolved server-stream untilExpression templates', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'stream-2',
        requestId: 'req-stream-2',
        data: validStream({
          collect: { untilExpression: '$.flag == {{missingFlag}}' },
        }),
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/untilExpression/i);
  });

  it('rejects unresolved metadata key templates', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-10',
        requestId: 'req-10',
        data: validUnary({ metadata: { '{{missingKey}}': 'value' } }),
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/gRPC metadata key/);
  });

  it('rejects invalid auth configuration at snapshot build time', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-auth',
        requestId: 'req-auth',
        data: validUnary({ auth: { type: 'bearer', bearerToken: '' } }),
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/auth|token|Bearer/i);
  });

  it('rejects metadata keys that collide after gRPC normalization', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-meta-norm',
        requestId: 'req-meta-norm',
        data: validUnary({
          metadata: { 'X-{{env}}': 'one', 'x-{{env}}': 'two' },
        }),
      },
      {
        resolveTemplate: envResolver({ env: 'dev' }),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/normalization/i);
  });

  it('resolves page default target templates when profile id is unknown', () => {
    const snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-page-default',
        requestId: 'req-page-default',
        capturedAt: '2026-06-29T00:00:00.000Z',
        data: validUnary({
          target: '',
          connectionId: 'missing-profile',
        }),
      },
      {
        resolveTemplate: envResolver({ grpcHost: 'page-default:50051' }),
        profiles: [],
        pageDefaults: { target: '{{grpcHost}}', tlsMode: 'disabled' },
      },
    );

    expect(snapshot.execute.target.address).toBe('page-default:50051');
  });

  it('matches Studio server-stream execute snapshot for resolved workflow config', () => {
    const requestId = 'req-stream-parity';
    const capturedAt = '2026-06-29T00:00:00.000Z';
    const resolveTemplate = envResolver({ flag: 'ready' });
    const nodeData = validStream({
      body: { message: '{{flag}}' },
      collect: { maxMessages: 5, untilExpression: '$.flag == {{flag}}' },
    });

    const workflowSnapshot = buildGrpcWorkflowExecuteSnapshot(
      { nodeId: 'stream-parity', requestId, capturedAt, data: nodeData },
      { resolveTemplate, profiles: [], pageDefaults: PAGE_DEFAULTS },
    );

    const baseResolution = resolveGrpcTabConnection(
      { target: nodeData.target, connectionId: nodeData.connectionId, tlsMode: nodeData.tlsMode },
      [],
      PAGE_DEFAULTS,
    );
    const resolvedTarget = resolveTemplate(baseResolution.target);
    const interpolatedResolution = {
      ...baseResolution,
      target: resolvedTarget,
      targetValidation: validateResolvedGrpcTargetAddress(resolvedTarget),
    };

    const studioSnapshot = captureGrpcTabExecuteSnapshotFromResolution(
      {
        id: 'workflow:stream-parity',
        title: nodeData.label,
        target: nodeData.target,
        connectionId: nodeData.connectionId,
        tlsMode: interpolatedResolution.tlsMode,
        tlsConfig: undefined,
        descriptorKey: nodeData.descriptorKey,
        service: nodeData.service,
        method: nodeData.method,
        body: workflowSnapshot.execute.body,
        metadata: workflowSnapshot.execute.metadata,
        auth: workflowSnapshot.execute.auth,
        timeoutMs: nodeData.timeoutMs ?? defaultGrpcWorkflowTimeoutMs(),
        requestMode: 'form',
        lifecycle: 'idle',
        streamLifecycle: 'idle',
        streamMessages: [],
        lastSequence: 0,
        streamPendingBodies: [],
      },
      requestId,
      interpolatedResolution,
      'server_streaming',
    );
    studioSnapshot.capturedAt = capturedAt;

    expect(workflowSnapshot.execute).toEqual(studioSnapshot);
    expect(workflowSnapshot.collect?.untilExpression).toBe('$.flag == ready');
  });

  it('rejects invalid TLS configuration at snapshot build time', () => {
    expect(() => buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId: 'grpc-6',
        requestId: 'req-6',
        data: validUnary({ tlsMode: 'mtls' }),
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        tlsConfig: undefined,
      },
    )).toThrow(/clientCertPem/i);
  });
});
