import { describe, expect, it } from 'vitest';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';
import { GrpcInterpolationError } from './grpcInterpolationError';
import {
  assertGrpcInterpolationEnvAcyclic,
  buildGrpcInterpolationEnvDependencyGraph,
  detectGrpcInterpolationEnvCycle,
  validateGrpcInterpolationEnvCycles,
} from './grpcInterpolationCycleDetector';

describe('grpcInterpolationCycleDetector (Phase 9E)', () => {
  it('builds dependency edges only for tokens that exist as env keys', () => {
    const graph = buildGrpcInterpolationEnvDependencyGraph({
      apiUrl: '{{baseHost}}:8080',
      baseHost: 'localhost',
      grpcHost: '{{missingToken}}',
    });
    expect(graph.apiUrl).toEqual(['baseHost']);
    expect(graph.baseHost).toEqual([]);
    expect(graph.grpcHost).toEqual([]);
  });

  it('detects self-reference', () => {
    const cycle = detectGrpcInterpolationEnvCycle({ loop: '{{loop}}' });
    expect(cycle?.path).toEqual(['loop', 'loop']);
  });

  it('detects direct two-node cycle', () => {
    const cycle = detectGrpcInterpolationEnvCycle({
      a: '{{b}}',
      b: '{{a}}',
    });
    expect(cycle?.path).toEqual(['a', 'b', 'a']);
  });

  it('detects deep nested cycle', () => {
    const cycle = detectGrpcInterpolationEnvCycle({
      a: '{{b}}',
      b: '{{c}}',
      c: '{{d}}',
      d: '{{a}}',
    });
    expect(cycle?.path).toEqual(['a', 'b', 'c', 'd', 'a']);
  });

  it('returns undefined for acyclic env graph', () => {
    expect(detectGrpcInterpolationEnvCycle({
      grpcHost: 'localhost:50051',
      apiUrl: '{{grpcHost}}',
    })).toBeUndefined();
  });

  it('returns undefined for empty env map', () => {
    expect(detectGrpcInterpolationEnvCycle({})).toBeUndefined();
  });

  it('ignores invalid syntax in env values when building graph', () => {
    expect(detectGrpcInterpolationEnvCycle({
      bad: '{{unclosed',
      ok: '{{bad}}',
    })).toBeUndefined();
  });

  it('detects cycle after normalizing whitespace-padded env keys', () => {
    const cycle = detectGrpcInterpolationEnvCycle({
      ' grpcHost ': '{{apiHost}}',
      apiHost: '{{grpcHost}}',
    });
    expect(cycle?.path.some((name) => name === 'grpcHost')).toBe(true);
    expect(cycle?.path.some((name) => name === 'apiHost')).toBe(true);
  });

  it('validateGrpcInterpolationEnvCycles returns CYCLE issue with token path message', () => {
    const issue = validateGrpcInterpolationEnvCycles({
      x: '{{y}}',
      y: '{{x}}',
    });
    expect(issue?.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.CYCLE);
    expect(issue?.field).toBe('interpolationEnv');
    expect(issue?.message).toBe('Circular variable reference: x → y → x');
    expect(issue?.message).not.toContain('secret');
  });

  it('assertGrpcInterpolationEnvAcyclic throws GrpcInterpolationError with CYCLE code', () => {
    expect(() => assertGrpcInterpolationEnvAcyclic({
      token: '{{token}}',
    })).toThrow(GrpcInterpolationError);
    try {
      assertGrpcInterpolationEnvAcyclic({ token: '{{token}}' });
    } catch (error) {
      expect(error).toBeInstanceOf(GrpcInterpolationError);
      expect((error as GrpcInterpolationError).code)
        .toBe(GRPC_INTERPOLATION_ERROR_CODES.CYCLE);
      expect((error as Error).message).toMatch(/Circular variable reference: token → token/);
    }
  });

  it('assertGrpcInterpolationEnvAcyclic passes for valid env', () => {
    expect(() => assertGrpcInterpolationEnvAcyclic({
      grpcHost: 'localhost:50051',
    })).not.toThrow();
  });

  it('assertGrpcInterpolationEnvAcyclic cycle message omits unrelated env literal values', () => {
    expect(() => assertGrpcInterpolationEnvAcyclic({
      bearerToken: '{{grpcHost}}',
      grpcHost: '{{bearerToken}}',
      sideSecret: 'super-secret-value-should-not-appear',
    })).toThrow(GrpcInterpolationError);
    try {
      assertGrpcInterpolationEnvAcyclic({
        bearerToken: '{{grpcHost}}',
        grpcHost: '{{bearerToken}}',
        sideSecret: 'super-secret-value-should-not-appear',
      });
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/Circular variable reference/);
      expect(message).not.toContain('super-secret-value-should-not-appear');
    }
  });

  it('detects cycle when one env value references multiple keys in a loop', () => {
    const cycle = detectGrpcInterpolationEnvCycle({
      a: '{{b}} {{c}}',
      b: '{{c}}',
      c: '{{a}}',
    });
    expect(cycle?.path[0]).toBe(cycle?.path[cycle.path.length - 1]);
    expect(cycle?.path).toContain('a');
  });
});
