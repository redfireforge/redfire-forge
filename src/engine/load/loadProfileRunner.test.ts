import { describe, it, expect } from 'vitest';
import { getTargetConcurrency } from './loadProfileRunner';
import type { LoadProfileConfig } from '@shared/types';

function makeProfile(overrides: Partial<LoadProfileConfig> = {}): LoadProfileConfig {
  return {
    type: 'sustained',
    durationSec: 60,
    maxConcurrency: 10,
    ...overrides,
  };
}

describe('getTargetConcurrency', () => {
  describe('sustained', () => {
    it('returns maxConcurrency during the duration', () => {
      expect(getTargetConcurrency(makeProfile(), 0)).toBe(10);
      expect(getTargetConcurrency(makeProfile(), 30_000)).toBe(10);
    });

    it('returns 0 after duration', () => {
      expect(getTargetConcurrency(makeProfile(), 60_000)).toBe(0);
      expect(getTargetConcurrency(makeProfile(), 100_000)).toBe(0);
    });
  });

  describe('ramp-up', () => {
    it('starts at 1 and ramps to maxConcurrency', () => {
      const profile = makeProfile({ type: 'ramp-up', rampUpSec: 10 });
      expect(getTargetConcurrency(profile, 0)).toBe(1);
      expect(getTargetConcurrency(profile, 5_000)).toBeGreaterThan(1);
      expect(getTargetConcurrency(profile, 5_000)).toBeLessThanOrEqual(10);
    });

    it('reaches maxConcurrency at rampUpSec', () => {
      const profile = makeProfile({ type: 'ramp-up', rampUpSec: 10 });
      expect(getTargetConcurrency(profile, 10_000)).toBe(10);
    });

    it('stays at maxConcurrency after ramp', () => {
      const profile = makeProfile({ type: 'ramp-up', rampUpSec: 10 });
      expect(getTargetConcurrency(profile, 30_000)).toBe(10);
    });

    it('defaults rampUpSec to durationSec', () => {
      const profile = makeProfile({ type: 'ramp-up' });
      const half = 30_000;
      const target = getTargetConcurrency(profile, half);
      expect(target).toBeGreaterThan(1);
      expect(target).toBeLessThanOrEqual(10);
    });

    it('returns 0 after duration', () => {
      const profile = makeProfile({ type: 'ramp-up', rampUpSec: 10 });
      expect(getTargetConcurrency(profile, 60_000)).toBe(0);
    });
  });

  describe('spike', () => {
    it('returns maxConcurrency before spike', () => {
      const profile = makeProfile({ type: 'spike', spikeStartSec: 20, spikeDurationSec: 10, spikeConcurrency: 50 });
      expect(getTargetConcurrency(profile, 10_000)).toBe(10);
    });

    it('returns spikeConcurrency during spike window', () => {
      const profile = makeProfile({ type: 'spike', spikeStartSec: 20, spikeDurationSec: 10, spikeConcurrency: 50 });
      expect(getTargetConcurrency(profile, 25_000)).toBe(50);
    });

    it('returns maxConcurrency after spike window', () => {
      const profile = makeProfile({ type: 'spike', spikeStartSec: 20, spikeDurationSec: 10, spikeConcurrency: 50 });
      expect(getTargetConcurrency(profile, 35_000)).toBe(10);
    });

    it('returns 0 after duration', () => {
      const profile = makeProfile({ type: 'spike' });
      expect(getTargetConcurrency(profile, 60_000)).toBe(0);
    });

    it('defaults spike params from duration and maxConcurrency', () => {
      const profile = makeProfile({ type: 'spike', durationSec: 100, maxConcurrency: 5 });
      // spikeStart defaults to 30, spikeDur to 20, spikeConcurrency to 15
      expect(getTargetConcurrency(profile, 35_000)).toBe(15);
      expect(getTargetConcurrency(profile, 10_000)).toBe(5);
    });
  });

  describe('unknown type', () => {
    it('falls back to maxConcurrency', () => {
      const profile = makeProfile({ type: 'unknown' as LoadProfileConfig['type'] });
      expect(getTargetConcurrency(profile, 10_000)).toBe(10);
    });
  });
});
