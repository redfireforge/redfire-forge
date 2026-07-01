/**
 * Phase 8C — harness runtime context tests.
 */
import { describe, expect, it } from 'vitest';
import type { Microservice } from '../types';
import {
  buildGrpcHarnessEnvFromRunnerContext,
  createGrpcHarnessSnapshotBuildContext,
  resolveGrpcHarnessEnv,
  resolveGrpcHarnessPageDefaultTarget,
} from './grpcHarnessRuntimeContext';
import { buildGrpcHarnessSnapshotForScenario } from './grpcHarnessExecutor';
import { FIXTURE_DESCRIPTOR_KEY } from './contractFixtures';
import { makeScenario as _makeScenario } from '../../test-utils/factories';

const svc: Microservice = {
  id: 'orders',
  name: 'Orders',
  baseUrls: { 'env-local': 'https://api.example.com' },
  protocolEndpoints: {
    grpc: {
      'env-local': { baseUrl: 'grpc.example.com:443' },
    },
  },
};

describe('grpcHarnessRuntimeContext (Phase 8C)', () => {
  it('resolveGrpcHarnessPageDefaultTarget keeps {{grpcHost}} template when env provides grpcHost', () => {
    expect(resolveGrpcHarnessPageDefaultTarget({ grpcHost: 'orders.example.com:50051' }))
      .toBe('{{grpcHost}}');
  });

  it('resolveGrpcHarnessPageDefaultTarget falls back when grpcHost is absent', () => {
    expect(resolveGrpcHarnessPageDefaultTarget({})).toBe('localhost:50051');
  });

  it('buildGrpcHarnessEnvFromRunnerContext returns grpcHost from microservice protocol endpoint', () => {
    const env = buildGrpcHarnessEnvFromRunnerContext([svc], 'orders', 'env-local', 'local');
    expect(env.grpcHost).toBe('grpc.example.com:443');
  });

  it('buildGrpcHarnessEnvFromRunnerContext returns empty map when context is incomplete', () => {
    expect(buildGrpcHarnessEnvFromRunnerContext(undefined, 'orders', 'env-local')).toEqual({});
    expect(buildGrpcHarnessEnvFromRunnerContext([svc], undefined, 'env-local')).toEqual({});
  });

  it('resolveGrpcHarnessEnv prefers explicit runner map over derived context', () => {
    const explicit = { grpcHost: 'override:50051' };
    const resolved = resolveGrpcHarnessEnv({
      grpcHarnessEnv: explicit,
      microservices: [svc],
      svcId: 'orders',
      envId: 'env-local',
      envName: 'local',
    });
    expect(resolved).toEqual(explicit);
  });

  it('resolveGrpcHarnessEnv derives grpcHost when explicit map is empty', () => {
    const resolved = resolveGrpcHarnessEnv({
      microservices: [svc],
      svcId: 'orders',
      envId: 'env-local',
      envName: 'local',
    });
    expect(resolved.grpcHost).toBe('grpc.example.com:443');
  });

  it('createGrpcHarnessSnapshotBuildContext resolves {{grpcHost}} in scenario target', () => {
    const scenario = _makeScenario({
      id: 'grpc-1',
      method: 'GRPC',
      actionType: 'grpcCall',
      grpcCallAction: {
        callType: 'unary',
        target: '{{grpcHost}}',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
      },
    });
    const context = createGrpcHarnessSnapshotBuildContext(
      buildGrpcHarnessEnvFromRunnerContext([svc], 'orders', 'env-local', 'local'),
    );
    const snapshot = buildGrpcHarnessSnapshotForScenario(scenario, context);
    expect(snapshot.execute.target.address).toBe('grpc.example.com:443');
    expect(snapshot.execute.interpolationEnv?.env.grpcHost).toBe('grpc.example.com:443');
  });

  it('createGrpcHarnessSnapshotBuildContext resolves {{grpcHost}} with profile env precedence', () => {
    const scenario = _makeScenario({
      id: 'grpc-profile',
      method: 'GRPC',
      actionType: 'grpcCall',
      grpcCallAction: {
        callType: 'unary',
        target: '{{grpcHost}}',
        connectionId: 'p1',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
      },
    });
    const context = createGrpcHarnessSnapshotBuildContext(
      { grpcHost: 'env.example.com:50051' },
      {
        profiles: [{
          id: 'p1',
          name: 'Profile',
          target: '{{grpcHost}}',
          tlsMode: 'disabled',
          variables: { grpcHost: 'profile.example.com:50051' },
        }],
      },
    );
    const snapshot = buildGrpcHarnessSnapshotForScenario(scenario, context);
    expect(snapshot.execute.target.address).toBe('profile.example.com:50051');
    expect(snapshot.execute.interpolationEnv?.env.grpcHost).toBe('profile.example.com:50051');
  });

  it('buildGrpcHarnessSnapshotForScenario rejects invalid grpcHost via profile target (Phase 9D)', () => {
    const scenario = _makeScenario({
      id: 'grpc-bad-host',
      method: 'GRPC',
      actionType: 'grpcCall',
      grpcCallAction: {
        callType: 'unary',
        connectionId: 'p1',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
      },
    });
    const context = createGrpcHarnessSnapshotBuildContext(
      { grpcHost: 'http://bad:50051' },
      {
        profiles: [{
          id: 'p1',
          name: 'Profile',
          target: '{{grpcHost}}',
          tlsMode: 'disabled',
        }],
      },
    );
    expect(() => buildGrpcHarnessSnapshotForScenario(scenario, context))
      .toThrow(/Environment Manager/);
  });

  it('createGrpcHarnessSnapshotBuildContext rejects cyclic env variables (Phase 9E)', () => {
    expect(() => createGrpcHarnessSnapshotBuildContext({
      grpcHost: '{{apiHost}}',
      apiHost: '{{grpcHost}}',
    })).toThrow(/Circular variable reference/);
  });

  it('createGrpcHarnessSnapshotBuildContext rejects profile-layer env cycles (Phase 9E)', () => {
    expect(() => createGrpcHarnessSnapshotBuildContext(
      { grpcHost: '{{apiHost}}' },
      {
        profileVariables: { apiHost: '{{grpcHost}}' },
      },
    )).toThrow(/Circular variable reference/);
  });
});
