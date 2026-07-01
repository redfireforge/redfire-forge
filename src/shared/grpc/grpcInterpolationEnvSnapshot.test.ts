/**
 * Phase 9C — env snapshot binding unit tests.
 */
import { describe, expect, it } from 'vitest';
import {
  createGrpcInterpolationEnvSnapshot,
  createGrpcInterpolationEnvSnapshotFromMap,
} from './grpcInterpolationEnvSnapshot';
import { mergeGrpcInterpolationEnvLayers } from './grpcInterpolationPrecedence';

describe('createGrpcInterpolationEnvSnapshot', () => {
  it('freezes merged env and records layer fingerprints', () => {
    const snapshot = createGrpcInterpolationEnvSnapshot({
      workspaceDefaults: { region: 'us' },
      activeEnvironment: { grpcHost: 'localhost:50051' },
    }, { capturedAt: '2026-06-29T00:00:00.000Z' });

    expect(snapshot.capturedAt).toBe('2026-06-29T00:00:00.000Z');
    expect(snapshot.env).toEqual({
      region: 'us',
      grpcHost: 'localhost:50051',
    });
    expect(Object.isFrozen(snapshot.env)).toBe(true);
    expect(snapshot.fingerprint).toBe('grpcHost=localhost:50051\nregion=us');
    expect(snapshot.layerFingerprints.activeEnvironment).toBe('grpcHost=localhost:50051');
  });

  it('isolates subsequent layer mutations from captured snapshot', () => {
    const layers = {
      activeEnvironment: { grpcHost: 'first:50051' },
    };
    const snapshot = createGrpcInterpolationEnvSnapshot(layers);
    layers.activeEnvironment.grpcHost = 'mutated:50051';
    expect(snapshot.env.grpcHost).toBe('first:50051');
  });

  it('rejects cyclic env layers at snapshot bind time (Phase 9E)', () => {
    expect(() => createGrpcInterpolationEnvSnapshot({
      activeEnvironment: { a: '{{b}}', b: '{{a}}' },
    })).toThrow(/Circular variable reference: a → b → a/);
  });
});

describe('createGrpcInterpolationEnvSnapshotFromMap', () => {
  it('captures a pre-merged flat env map', () => {
    const env = mergeGrpcInterpolationEnvLayers({
      activeEnvironment: { grpcHost: 'harness:50051' },
    });
    const snapshot = createGrpcInterpolationEnvSnapshotFromMap(env);
    expect(snapshot.env.grpcHost).toBe('harness:50051');
    expect(snapshot.layerFingerprints.merged).toContain('grpcHost=harness:50051');
  });

  it('rejects cyclic pre-merged env map (Phase 9E)', () => {
    expect(() => createGrpcInterpolationEnvSnapshotFromMap({
      token: '{{token}}',
    })).toThrow(/Circular variable reference/);
  });

  it('normalizes whitespace-padded keys before cycle check (Phase 9E)', () => {
    expect(() => createGrpcInterpolationEnvSnapshotFromMap({
      ' grpcHost ': '{{apiHost}}',
      apiHost: '{{grpcHost}}',
    })).toThrow(/Circular variable reference/);
    const snapshot = createGrpcInterpolationEnvSnapshotFromMap({
      ' grpcHost ': 'localhost:50051',
    });
    expect(snapshot.env.grpcHost).toBe('localhost:50051');
  });
});

describe('env switch isolation contract', () => {
  it('two snapshots from different layers produce different fingerprints', () => {
    const before = createGrpcInterpolationEnvSnapshot({
      activeEnvironment: { grpcHost: 'old:50051' },
    });
    const after = createGrpcInterpolationEnvSnapshot({
      activeEnvironment: { grpcHost: 'new:50051' },
    });
    expect(before.fingerprint).not.toBe(after.fingerprint);
    expect(before.env.grpcHost).toBe('old:50051');
    expect(after.env.grpcHost).toBe('new:50051');
  });
});
