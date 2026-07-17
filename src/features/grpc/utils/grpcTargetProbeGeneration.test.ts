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

  it('reset clears generations for all tabs', () => {
    resetGrpcTargetProbeGenerationForTests();
    const t1 = bumpGrpcTargetProbeGeneration('tab-1');
    const t2 = bumpGrpcTargetProbeGeneration('tab-2');
    expect(isGrpcTargetProbeGenerationCurrent('tab-1', t1)).toBe(true);
    expect(isGrpcTargetProbeGenerationCurrent('tab-2', t2)).toBe(true);

    resetGrpcTargetProbeGenerationForTests();

    expect(isGrpcTargetProbeGenerationCurrent('tab-1', t1)).toBe(false);
    expect(isGrpcTargetProbeGenerationCurrent('tab-2', t2)).toBe(false);
  });
});
