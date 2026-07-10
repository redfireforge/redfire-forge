import { describe, expect, it } from 'vitest';
import { isParameterizedScenario, type TestScenario } from './index';

describe('shared/types index runtime exports', () => {
  it('isParameterizedScenario returns true only for parameterized scenarios', () => {
    expect(isParameterizedScenario({ kind: 'parameterized' } as TestScenario)).toBe(true);
    expect(isParameterizedScenario({ kind: 'standard' } as TestScenario)).toBe(false);
  });
});
