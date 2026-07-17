/**
 * Phase 8B — gRPC harness snapshot builder tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { validateResolvedGrpcTargetAddress } from './targetValidation';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '../../test-utils/factories';
import { captureGrpcTabExecuteSnapshotFromResolution } from '../../features/grpc/grpcStudioTypes';
import { resolveGrpcTabConnection } from '../../features/grpc/utils/resolveGrpcTabConnection';
import {
  buildGrpcHarnessExecuteSnapshot,
  cloneGrpcHarnessExecuteSnapshot,
  DEFAULT_GRPC_HARNESS_TIMEOUT_MS,
  grpcHarnessExecuteSnapshotTransportFingerprint,
  grpcHarnessTabId,
} from './grpcHarnessSnapshotBuilder';
import { buildGrpcHarnessRuntimeCallBoundary } from './grpcHarnessTransportAdapter';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };
const PROFILES = [{
  id: 'profile-a',
  name: 'Local',
  target: '{{grpcHost}}',
  tlsMode: 'disabled' as const,
}];

function makeGrpcScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'grpc-1',
    name: 'Echo unary',
    url: '',
    method: 'GRPC',
    actionType: 'grpcCall',
    grpcCallAction: {
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target.address,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
    },
    ...overrides,
  }) as Scenario;
}

function envResolver(env: Record<string, string>) {
  return createGrpcInterpolationTemplateResolver(env);
}

describe('grpcHarnessSnapshotBuilder (Phase 8B)', () => {
  it('builds a unary harness execute snapshot with resolved target and body', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: '{{greeting}}' },
            metadata: { 'x-env': '{{envName}}' },
            auth: { type: 'bearer', bearerToken: '{{token}}' },
          },
        }),
        requestId: 'req-1',
        capturedAt: '2026-06-29T00:00:00.000Z',
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

    expect(snapshot.scenarioId).toBe('grpc-1');
    expect(snapshot.execute.tabId).toBe(grpcHarnessTabId('grpc-1'));
    expect(snapshot.execute.callType).toBe('unary');
    expect(snapshot.execute.target.address).toBe('localhost:50051');
    expect(snapshot.execute.body).toEqual({ message: 'hello' });
    expect(snapshot.execute.metadata).toEqual({ 'x-env': 'dev' });
    expect(snapshot.execute.auth?.bearerToken).toBe('abc123');
  });

  it('produces deterministic transport fingerprints for identical inputs', () => {
    const input = {
      scenario: makeGrpcScenario(),
      requestId: 'req-det',
      capturedAt: '2026-06-29T00:00:00.000Z',
    };
    const context = {
      resolveTemplate: envResolver({}),
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
    };
    const a = buildGrpcHarnessExecuteSnapshot(input, context);
    const b = buildGrpcHarnessExecuteSnapshot(input, context);
    expect(grpcHarnessExecuteSnapshotTransportFingerprint(a)).toBe(
      grpcHarnessExecuteSnapshotTransportFingerprint(b),
    );
  });

  it('isolates snapshot from later env and scenario mutation', () => {
    const env = { greeting: 'hello' };
    const scenario = makeGrpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: '{{greeting}}' },
      },
    });
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario,
        requestId: 'req-iso',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: envResolver(env),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    env.greeting = 'mutated';
    scenario.grpcCallAction!.target = 'evil:9999';

    expect(snapshot.execute.body).toEqual({ message: 'hello' });
    expect(snapshot.execute.target.address).toBe('localhost:50051');

    const clone = cloneGrpcHarnessExecuteSnapshot(snapshot);
    clone.execute.body.message = 'changed';
    expect(snapshot.execute.body).toEqual({ message: 'hello' });
  });

  it('builds server streaming snapshot with collect config', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'server_streaming',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: 'ServerStream',
            body: { message: 'stream' },
            collect: { maxMessages: 5, maxDurationMs: 2000 },
          },
        }),
        requestId: 'req-stream',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.execute.callType).toBe('server_streaming');
    expect(snapshot.collect).toEqual({ maxMessages: 5, maxDurationMs: 2000 });
    const boundary = buildGrpcHarnessRuntimeCallBoundary(snapshot);
    expect(boundary.streamStartRequest?.callType).toBe('server_streaming');
  });

  it('builds client streaming snapshot with sendMessages', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'client_streaming',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: 'ClientStream',
            sendMessages: [{ message: '{{part}}' }],
          },
        }),
        requestId: 'req-client',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: envResolver({ part: 'one' }),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.execute.callType).toBe('client_streaming');
    expect(snapshot.sendMessages).toEqual([{ message: 'one' }]);
    const boundary = buildGrpcHarnessRuntimeCallBoundary(snapshot);
    expect(boundary.streamStartRequest?.callType).toBe('client_streaming');
  });

  it('builds bidi streaming snapshot with collect and sendMessages', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'bidi_streaming',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: 'BidiStream',
            sendMessages: [{ message: 'a' }],
            collect: { maxMessages: 3 },
          },
        }),
        requestId: 'req-bidi',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.execute.callType).toBe('bidi_streaming');
    expect(snapshot.sendMessages).toEqual([{ message: 'a' }]);
    expect(snapshot.collect).toEqual({ maxMessages: 3 });
  });

  it('rejects unresolved template tokens after interpolation', () => {
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: '{{grpcHost}}',
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
          },
        }),
        requestId: 'req-unresolved',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow('unresolved template variables');
  });

  it('rejects invalid harness scenarios at snapshot build time', () => {
    const scenario = makeGrpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: '',
        descriptorKey: '',
        service: '',
        method: '',
        body: {},
      },
    });
    expect(() => buildGrpcHarnessExecuteSnapshot(
      { scenario, requestId: 'req-bad' },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow('Invalid gRPC harness scenario');
  });

  it('resolves connection profile target templates via env map', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: '',
            connectionId: 'profile-a',
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hello' },
          },
        }),
        requestId: 'req-profile',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: envResolver({ grpcHost: 'localhost:50051' }),
        profiles: PROFILES,
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.execute.target.address).toBe('localhost:50051');
  });

  it('preserves data row identity fields on snapshot', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          dataRowId: 'row-7',
          dataRowLabel: 'Row 7',
        }),
        requestId: 'req-row',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.dataRowId).toBe('row-7');
    expect(snapshot.dataRowLabel).toBe('Row 7');
  });

  it('remains deterministic when building snapshots concurrently from shared env', () => {
    const env = { greeting: 'stable' };
    const context = {
      resolveTemplate: envResolver(env),
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
    };
    const scenarios = ['grpc-a', 'grpc-b', 'grpc-c'].map((id) => makeGrpcScenario({
      id,
      name: `Scenario ${id}`,
      grpcCallAction: {
        callType: 'unary' as const,
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: '{{greeting}}' },
      },
    }));

    const snapshots = scenarios.map((scenario) =>
      buildGrpcHarnessExecuteSnapshot(
        { scenario, requestId: `req-${scenario.id}`, capturedAt: '2026-06-29T00:00:00.000Z' },
        context,
      ),
    );
    const fingerprints = snapshots.map((snapshot) =>
      grpcHarnessExecuteSnapshotTransportFingerprint(snapshot),
    );

    env.greeting = 'mutated';
    snapshots.forEach((snapshot) => {
      expect(snapshot.execute.body).toEqual({ message: 'stable' });
    });
    expect(new Set(fingerprints).size).toBe(3);
  });

  it('interpolates templated metadata keys at build time', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
            metadata: { 'x-{{envName}}': '{{envName}}-value' },
          },
        }),
        requestId: 'req-meta-key',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: envResolver({ envName: 'dev' }),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.execute.metadata).toEqual({ 'x-dev': 'dev-value' });
  });

  it('rejects metadata keys that collide after gRPC normalization', () => {
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
            metadata: { 'X-{{env}}': 'one', 'x-{{env}}': 'two' },
          },
        }),
        requestId: 'req-meta-norm',
      },
      {
        resolveTemplate: envResolver({ env: 'dev' }),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/metadata key collision after normalization/i);
  });

  it('rejects unresolved body, metadata key, and auth templates', () => {
    const context = {
      resolveTemplate: envResolver({}),
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
    };

    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: '{{missingBody}}' },
          },
        }),
        requestId: 'req-body',
      },
      context,
    )).toThrow(/gRPC body\.message/);

    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
            metadata: { '{{missingKey}}': 'value' },
          },
        }),
        requestId: 'req-meta-key',
      },
      context,
    )).toThrow(/gRPC metadata key/);

    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
            auth: { type: 'bearer', bearerToken: '{{missingToken}}' },
          },
        }),
        requestId: 'req-auth',
      },
      context,
    )).toThrow(/Bearer token/);
  });

  it('rejects invalid auth configuration at snapshot build time', () => {
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
            auth: { type: 'bearer', bearerToken: '' },
          },
        }),
        requestId: 'req-auth-invalid',
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/auth|token|Bearer/i);
  });

  it('applies connection profile tlsMode when scenario omits tlsMode', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: '',
            connectionId: 'tls-profile',
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
          },
        }),
        requestId: 'req-tls',
        capturedAt: '2026-06-29T00:00:00.000Z',
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

  it('freezes retry policy and assertions on the harness snapshot', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
            retry: { maxAttempts: 2, backoffMs: 100, retryOnStatuses: [14] },
            assertions: [{ grpcStatus: 0 }, { grpcField: 'message', equals: 'hi' }],
          },
        }),
        requestId: 'req-freeze',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.retry).toEqual({ maxAttempts: 2, backoffMs: 100, retryOnStatuses: [14] });
    expect(snapshot.assertions).toHaveLength(2);
  });

  it('resolves env templates in assertion expected values on the harness snapshot', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
            assertions: [
              { grpcField: '$.message', equals: '{{expectedMessage}}' },
              { grpcTrailer: 'x-trace', equals: '{{traceId}}' },
            ],
          },
        }),
        requestId: 'req-assert-env',
      },
      {
        resolveTemplate: envResolver({ expectedMessage: 'hello', traceId: 'trace-9' }),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.assertions).toEqual([
      { grpcField: '$.message', equals: 'hello' },
      { grpcTrailer: 'x-trace', equals: 'trace-9' },
    ]);
  });

  it('resolves page default target templates when connection profile is missing', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          id: 'grpc-page-default',
          grpcCallAction: {
            callType: 'unary',
            target: '',
            connectionId: 'missing-profile',
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
          },
        }),
        requestId: 'req-page-default',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: envResolver({ grpcHost: 'page-default:50051' }),
        profiles: [],
        pageDefaults: { target: '{{grpcHost}}', tlsMode: 'disabled' },
      },
    );

    expect(snapshot.execute.target.address).toBe('page-default:50051');
  });

  it('builds snapshots for in-process targets', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: 'in-process:echo',
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
          },
        }),
        requestId: 'req-in-process',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );

    expect(snapshot.execute.target.address).toBe('in-process:echo');
  });

  it('rejects invalid TLS configuration at snapshot build time', () => {
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            tlsMode: 'mtls',
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
          },
        }),
        requestId: 'req-tls-invalid',
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        tlsConfig: undefined,
      },
    )).toThrow(/clientCertPem|TLS|mtls/i);
  });

  it('rejects unresolved sendMessages templates at snapshot build time', () => {
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'client_streaming',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: 'ClientStream',
            sendMessages: [{ message: '{{missingPart}}' }],
          },
        }),
        requestId: 'req-send',
      },
      {
        resolveTemplate: envResolver({}),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/gRPC sendMessages\[0\]/);
  });

  it('preserves escaped literals in harness metadata during snapshot build (Phase 9B)', () => {
    const escaped = String.raw`\{{grpcHost}}`;
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeGrpcScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hello' },
            metadata: { 'x-note': escaped },
          },
        }),
        requestId: 'req-escaped-meta',
      },
      {
        resolveTemplate: envResolver({ grpcHost: 'localhost:50051' }),
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );
    expect(snapshot.execute.metadata['x-note']).toBe(escaped);
  });

  it('matches Studio unary execute snapshot for resolved harness config', () => {
    const requestId = 'req-parity';
    const capturedAt = '2026-06-29T00:00:00.000Z';
    const resolveTemplate = envResolver({ greeting: 'parity-msg' });
    const scenario = makeGrpcScenario({
      id: 'grpc-parity',
      name: 'Echo parity',
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: '{{greeting}}' },
        metadata: { 'x-trace': '{{greeting}}' },
        auth: { type: 'bearer', bearerToken: 'static-token' },
      },
    });

    const harnessSnapshot = buildGrpcHarnessExecuteSnapshot(
      { scenario, requestId, capturedAt },
      { resolveTemplate, profiles: [], pageDefaults: PAGE_DEFAULTS },
    );

    const config = scenario.grpcCallAction!;
    const baseResolution = resolveGrpcTabConnection(
      { target: config.target, connectionId: config.connectionId, tlsMode: config.tlsMode },
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
        id: grpcHarnessTabId('grpc-parity'),
        title: scenario.name,
        target: config.target,
        connectionId: config.connectionId,
        tlsMode: interpolatedResolution.tlsMode,
        tlsConfig: undefined,
        descriptorKey: config.descriptorKey,
        service: config.service,
        method: config.method,
        body: harnessSnapshot.execute.body,
        metadata: harnessSnapshot.execute.metadata,
        auth: harnessSnapshot.execute.auth,
        timeoutMs: config.timeoutMs ?? DEFAULT_GRPC_HARNESS_TIMEOUT_MS,
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

    expect(harnessSnapshot.execute).toEqual(studioSnapshot);
  });
});
