/**
 * Coverage gaps — grpcHarnessSnapshotBuilder.ts (Phase 8B / workflow 6B parity).
 */
import { describe, expect, it, vi } from 'vitest';
import * as grpcTlsPolicy from './grpcTlsPolicy';
import * as grpcAuthPolicy from './grpcAuthPolicy';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '../../test-utils/factories';
import {
  buildGrpcHarnessExecuteSnapshot,
  grpcHarnessExecuteSnapshotTransportFingerprint,
  resolutionToHarnessGrpcTarget,
} from './grpcHarnessSnapshotBuilder';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };

function makeUnaryScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'grpc-gap',
    name: 'Gap test',
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

describe('grpcHarnessSnapshotBuilder coverage gaps', () => {
  it('rejects invalid metadata at snapshot build time after template resolution', () => {
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
            metadata: { 'bad key': 'value' },
          },
        }),
        requestId: 'req-meta',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/metadata/i);
  });

  it('rejects invalid resolved target address at snapshot build time', () => {
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario({
          grpcCallAction: {
            callType: 'unary',
            target: 'not-valid-target',
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
          },
        }),
        requestId: 'req-target',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/target|Invalid gRPC harness scenario/i);
  });

  it('resolutionToHarnessGrpcTarget returns grpc target for valid scenario', () => {
    const target = resolutionToHarnessGrpcTarget(makeUnaryScenario(), {
      resolveTemplate: (value) => value,
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
    });
    expect(target.address).toBe(FIXTURE_UNARY_CALL_REQUEST.target.address);
    expect(target.tlsMode).toBe('disabled');
  });

  it('resolutionToHarnessGrpcTarget rejects missing grpcCallAction', () => {
    expect(() => resolutionToHarnessGrpcTarget(
      makeUnaryScenario({ grpcCallAction: undefined }),
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow('grpcCallAction is required');
  });

  it('resolutionToHarnessGrpcTarget rejects invalid target', () => {
    expect(() => resolutionToHarnessGrpcTarget(
      makeUnaryScenario({
        grpcCallAction: {
          callType: 'unary',
          target: '!!!',
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          body: { message: 'hi' },
        },
      }),
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/target|Invalid gRPC harness scenario/i);
  });

  it('transport fingerprint includes capturedAt when requested', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario(),
        requestId: 'req-fp',
        capturedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );
    const without = grpcHarnessExecuteSnapshotTransportFingerprint(snapshot);
    const withCaptured = grpcHarnessExecuteSnapshotTransportFingerprint(snapshot, { includeCapturedAt: true });
    expect(without).not.toContain('2026-06-29T00:00:00.000Z');
    expect(withCaptured).toContain('2026-06-29T00:00:00.000Z');
  });

  it('rejects invalid TLS configuration at snapshot build time', () => {
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
            tlsMode: 'mtls',
          },
        }),
        requestId: 'req-tls',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        tlsConfig: {},
      },
    )).toThrow(/TLS|tls|certificate/i);
  });

  it('rejects invalid auth configuration at snapshot build time', () => {
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario({
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
        requestId: 'req-auth',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/auth|bearer|token/i);
  });

  it('defaults client and bidi streaming bodies to empty objects when body is omitted', () => {
    const clientSnapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario({
          grpcCallAction: {
            callType: 'client_streaming',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: 'ClientStream',
            sendMessages: [{ message: 'one' }],
          },
        }),
        requestId: 'req-client-body',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );
    expect(clientSnapshot.execute.body).toEqual({});

    const bidiSnapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario({
          grpcCallAction: {
            callType: 'bidi_streaming',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: 'BidiStream',
            sendMessages: [{ message: 'one' }],
            collect: { maxMessages: 2 },
          },
        }),
        requestId: 'req-bidi-body',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    );
    expect(bidiSnapshot.execute.body).toEqual({});
  });

  it('uses generic TLS error text when contract issue omits message', () => {
    vi.spyOn(grpcTlsPolicy, 'validateGrpcTlsConfigContract').mockReturnValueOnce([{
      code: 'tls_missing_ca',
    } as never]);
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario(),
        requestId: 'req-tls-generic',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
        tlsConfig: {},
      },
    )).toThrow('Invalid TLS configuration');
  });

  it('captures interpolation env snapshot when capturedAt is provided with connectionId', () => {
    const snapshot = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario({
          grpcCallAction: {
            callType: 'unary',
            target: '{{grpcHost}}',
            connectionId: 'profile-1',
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
          },
        }),
        requestId: 'req-captured',
        capturedAt: '2026-06-29T12:00:00.000Z',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [{
          id: 'profile-1',
          name: 'Demo',
          target: 'localhost:50051',
          tlsMode: 'disabled',
          variables: { grpcHost: 'profile.example.com:50051' },
        }],
        pageDefaults: PAGE_DEFAULTS,
        activeEnvironment: { grpcHost: 'env.example.com:50051' },
      },
    );
    expect(snapshot.execute.target).toEqual(expect.objectContaining({
      address: 'profile.example.com:50051',
    }));
    expect(snapshot.execute.interpolationEnv?.capturedAt).toBe('2026-06-29T12:00:00.000Z');
    expect(snapshot.execute.interpolationEnv?.env.grpcHost).toBe('profile.example.com:50051');
  });

  it('rejects resolved invalid target after template interpolation', () => {
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario({
          grpcCallAction: {
            callType: 'unary',
            target: '{{badHost}}',
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
          },
        }),
        requestId: 'req-bad-resolved-target',
      },
      {
        resolveTemplate: () => 'not a valid grpc target',
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow(/target|Invalid gRPC harness scenario/i);
  });

  it('uses generic auth error text when resolved auth fails after scenario validation', () => {
    let authCalls = 0;
    vi.spyOn(grpcAuthPolicy, 'validateGrpcAuthForExecute').mockImplementation((auth) => {
      if (!auth || auth.type !== 'bearer') return [];
      authCalls += 1;
      if (authCalls === 1) return [];
      return [{ code: 'missing_bearer' } as never];
    });
    expect(() => buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeUnaryScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hi' },
            auth: { type: 'bearer', bearerToken: 'token' },
          },
        }),
        requestId: 'req-auth-generic',
      },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: PAGE_DEFAULTS,
      },
    )).toThrow('Invalid gRPC auth configuration');
  });
});
