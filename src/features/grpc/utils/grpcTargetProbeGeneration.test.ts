import { describe, expect, it } from 'vitest';
import {
  bumpGrpcTargetProbeGeneration,
  isGrpcTargetProbeGenerationCurrent,
  resetGrpcTargetProbeGenerationForTests,
} from './grpcTargetProbeGeneration';

describe('grpcTargetProbeGeneration', () => {
  it('tracks probe generation per tab', () => {
    resetGrpcTargetProbeGenerationForTests();
    const first = bumpGrpcTargetProbeGeneration('tab-1');
    expect(isGrpcTargetProbeGenerationCurrent('tab-1', first)).toBe(true);
    bumpGrpcTargetProbeGeneration('tab-1');
    expect(isGrpcTargetProbeGenerationCurrent('tab-1', first)).toBe(false);
  });
});
