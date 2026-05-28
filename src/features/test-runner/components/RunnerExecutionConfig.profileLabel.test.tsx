/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('profileLabel', () => {
  it('returns correct labels', async () => {
    const { profileLabel } = await import('./RunnerExecutionConfig');
    expect(profileLabel('ramp-up')).toBe('Ramp-Up');
    expect(profileLabel('sustained')).toBe('Sustained');
    expect(profileLabel('spike')).toBe('Spike');
  });
});
