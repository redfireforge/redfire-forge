/**
 * Phase 9E — cycle validation parity across Studio UI paths.
 */
import { describe, expect, it } from 'vitest';
import { validateGrpcInterpolationEnvCycles } from './grpcInterpolationCycleDetector';
import { mergeGrpcTabInterpolationEnv } from './grpcInterpolationPrecedence';
import { resolveTabConnectionWithEnv } from '../../features/grpc/hooks/grpcStudioSessionHelpers';
import { createGrpcStudioTab } from '../../features/grpc/grpcStudioTypes';

describe('grpcInterpolationCycleParity (Phase 9E)', () => {
  const cyclicEnv = {
    grpcHost: '{{apiHost}}',
    apiHost: '{{grpcHost}}',
  };

  it('resolveTabConnectionWithEnv and validateGrpcInterpolationEnvCycles agree on cyclic env', () => {
    const merged = mergeGrpcTabInterpolationEnv({
      activeEnvironment: cyclicEnv,
      profiles: [],
    });
    const issue = validateGrpcInterpolationEnvCycles(merged);
    expect(issue?.message).toMatch(/Circular variable reference/);

    const tab = createGrpcStudioTab({ target: '{{grpcHost}}' });
    const resolution = resolveTabConnectionWithEnv(
      tab,
      cyclicEnv,
      [],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );
    expect(resolution.targetValidation.valid).toBe(false);
    if (!resolution.targetValidation.valid) {
      expect(resolution.targetValidation.reason).toBe(issue?.message);
      expect(resolution.targetValidation.code).toBe(issue?.code);
    }
  });

  it('detects cycles introduced by linked profile variables after merge', () => {
    const merged = mergeGrpcTabInterpolationEnv({
      activeEnvironment: { grpcHost: '{{apiHost}}' },
      profiles: [{
        id: 'profile-a',
        name: 'A',
        target: '{{grpcHost}}',
        tlsMode: 'disabled',
        variables: { apiHost: '{{grpcHost}}' },
      }],
      connectionId: 'profile-a',
    });
    const issue = validateGrpcInterpolationEnvCycles(merged);
    expect(issue?.code).toBe('grpc.interpolation.cycle');

    const tab = createGrpcStudioTab({
      target: '{{grpcHost}}',
      connectionId: 'profile-a',
    });
    const resolution = resolveTabConnectionWithEnv(
      tab,
      { grpcHost: '{{apiHost}}' },
      [{
        id: 'profile-a',
        name: 'A',
        target: '{{grpcHost}}',
        tlsMode: 'disabled',
        variables: { apiHost: '{{grpcHost}}' },
      }],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );
    expect(resolution.targetValidation.valid).toBe(false);
    if (!resolution.targetValidation.valid) {
      expect(resolution.targetValidation.reason).toBe(issue?.message);
    }
  });
});
