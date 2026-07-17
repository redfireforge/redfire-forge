/**
 * Phase 9C — precedence merge unit tests.
 */
import { describe, expect, it } from 'vitest';
import {
  buildGrpcStudioInterpolationEnvLayers,
  computeGrpcInterpolationEnvFingerprint,
  computeGrpcInterpolationEnvLayerFingerprints,
  mergeGrpcInterpolationEnvLayers,
  mergeGrpcTabInterpolationEnv,
  normalizeGrpcInterpolationEnvMap,
} from './grpcInterpolationPrecedence';

describe('mergeGrpcInterpolationEnvLayers', () => {
  it('merges layers with tab overrides winning collisions', () => {
    const merged = mergeGrpcInterpolationEnvLayers({
      workspaceDefaults: { grpcHost: 'ws:50051', token: 'ws' },
      activeEnvironment: { grpcHost: 'env:50051', region: 'us-east' },
      profileVariables: { grpcHost: 'profile:50051', token: 'profile' },
      tabOverrides: { grpcHost: 'tab:50051' },
    });
    expect(merged).toEqual({
      grpcHost: 'tab:50051',
      token: 'profile',
      region: 'us-east',
    });
  });

  it('skips empty keys when copying layers', () => {
    const merged = mergeGrpcInterpolationEnvLayers({
      activeEnvironment: { '': 'ignored', grpcHost: 'host:1' },
    });
    expect(merged).toEqual({ grpcHost: 'host:1' });
  });

  it('normalizeGrpcInterpolationEnvMap trims keys and drops empty names', () => {
    expect(normalizeGrpcInterpolationEnvMap({
      ' grpcHost ': 'localhost:50051',
      '': 'ignored',
    })).toEqual({ grpcHost: 'localhost:50051' });
  });

  it('returns empty map when all layers are empty', () => {
    expect(mergeGrpcInterpolationEnvLayers({})).toEqual({});
  });
});

describe('computeGrpcInterpolationEnvFingerprint', () => {
  it('is stable regardless of key insertion order', () => {
    const a = computeGrpcInterpolationEnvFingerprint({ b: '2', a: '1' });
    const b = computeGrpcInterpolationEnvFingerprint({ a: '1', b: '2' });
    expect(a).toBe(b);
    expect(a).toBe('a=1\nb=2');
  });

  it('returns empty string for empty env', () => {
    expect(computeGrpcInterpolationEnvFingerprint({})).toBe('');
  });

  it('treats undefined env values as empty strings in fingerprint', () => {
    expect(computeGrpcInterpolationEnvFingerprint({
      token: undefined as unknown as string,
    })).toBe('token=');
  });
});

describe('computeGrpcInterpolationEnvLayerFingerprints', () => {
  it('fingerprints each layer independently', () => {
    const fps = computeGrpcInterpolationEnvLayerFingerprints({
      workspaceDefaults: { a: '1' },
      activeEnvironment: { b: '2' },
    });
    expect(fps.workspaceDefaults).toBe('a=1');
    expect(fps.activeEnvironment).toBe('b=2');
    expect(fps.profileVariables).toBe('');
    expect(fps.tabOverrides).toBe('');
  });

  it('treats omitted layers as empty fingerprints', () => {
    const fps = computeGrpcInterpolationEnvLayerFingerprints({});
    expect(fps.activeEnvironment).toBe('');
    expect(fps.profileVariables).toBe('');
  });
});

describe('mergeGrpcTabInterpolationEnv', () => {
  it('applies linked profile variables for the tab connectionId', () => {
    const merged = mergeGrpcTabInterpolationEnv({
      activeEnvironment: { grpcHost: 'env:50051' },
      profiles: [{
        id: 'p1',
        name: 'Profile',
        target: '{{grpcHost}}',
        tlsMode: 'disabled',
        variables: { grpcHost: 'profile:50051' },
      }],
      connectionId: 'p1',
    });
    expect(merged.grpcHost).toBe('profile:50051');
  });

  it('tab overrides beat profile variables', () => {
    const merged = mergeGrpcTabInterpolationEnv({
      activeEnvironment: { grpcHost: 'env:50051' },
      profiles: [{
        id: 'p1',
        name: 'Profile',
        target: 'x',
        tlsMode: 'disabled',
        variables: { grpcHost: 'profile:50051' },
      }],
      connectionId: 'p1',
      tabOverrides: { grpcHost: 'tab:50051' },
    });
    expect(merged.grpcHost).toBe('tab:50051');
  });
});

describe('buildGrpcStudioInterpolationEnvLayers', () => {
  it('defaults missing layers to empty objects', () => {
    const layers = buildGrpcStudioInterpolationEnvLayers({});
    expect(layers.workspaceDefaults).toEqual({});
    expect(layers.activeEnvironment).toEqual({});
    expect(layers.profileVariables).toEqual({});
    expect(layers.tabOverrides).toEqual({});
  });
});
