import { describe, it, expect } from 'vitest';
import { getTargetConcurrency } from './loadProfileRunner';
import type { LoadProfileConfig } from '../types';

describe('getTargetConcurrency', () => {
  describe('sustained profile', () => {
    const profile: LoadProfileConfig = {
      type: 'sustained',
      durationSec: 60,
      maxConcurrency: 10,
    };

    it('returns maxConcurrency throughout duration', () => {
      expect(getTargetConcurrency(profile, 0)).toBe(10);
      expect(getTargetConcurrency(profile, 30_000)).toBe(10);
      expect(getTargetConcurrency(profile, 59_999)).toBe(10);
    });

    it('returns 0 after duration expires', () => {
      expect(getTargetConcurrency(profile, 60_000)).toBe(0);
      expect(getTargetConcurrency(profile, 90_000)).toBe(0);
    });
  });

  describe('ramp-up profile', () => {
    const profile: LoadProfileConfig = {
      type: 'ramp-up',
      durationSec: 60,
      maxConcurrency: 10,
      rampUpSec: 30,
    };

    it('starts at 1 concurrency', () => {
      expect(getTargetConcurrency(profile, 0)).toBe(1);
    });

    it('ramps linearly toward maxConcurrency', () => {
      const midRamp = getTargetConcurrency(profile, 15_000);
      expect(midRamp).toBeGreaterThan(1);
      expect(midRamp).toBeLessThanOrEqual(10);
    });

    it('reaches maxConcurrency at rampUpSec', () => {
      expect(getTargetConcurrency(profile, 30_000)).toBe(10);
    });

    it('maintains maxConcurrency after ramp completes', () => {
      expect(getTargetConcurrency(profile, 45_000)).toBe(10);
    });

    it('returns 0 after duration expires', () => {
      expect(getTargetConcurrency(profile, 60_000)).toBe(0);
    });

    it('uses durationSec as ramp time when rampUpSec not specified', () => {
      const noRampSec: LoadProfileConfig = {
        type: 'ramp-up',
        durationSec: 60,
        maxConcurrency: 20,
      };
      const mid = getTargetConcurrency(noRampSec, 30_000);
      expect(mid).toBeGreaterThan(1);
      expect(mid).toBeLessThanOrEqual(20);
    });
  });

  describe('spike profile', () => {
    const profile: LoadProfileConfig = {
      type: 'spike',
      durationSec: 100,
      maxConcurrency: 10,
      spikeStartSec: 30,
      spikeDurationSec: 20,
      spikeConcurrency: 50,
    };

    it('returns maxConcurrency before spike', () => {
      expect(getTargetConcurrency(profile, 0)).toBe(10);
      expect(getTargetConcurrency(profile, 29_999)).toBe(10);
    });

    it('returns spikeConcurrency during spike window', () => {
      expect(getTargetConcurrency(profile, 30_000)).toBe(50);
      expect(getTargetConcurrency(profile, 40_000)).toBe(50);
      expect(getTargetConcurrency(profile, 49_999)).toBe(50);
    });

    it('returns to maxConcurrency after spike ends', () => {
      expect(getTargetConcurrency(profile, 50_000)).toBe(10);
      expect(getTargetConcurrency(profile, 80_000)).toBe(10);
    });

    it('returns 0 after duration expires', () => {
      expect(getTargetConcurrency(profile, 100_000)).toBe(0);
    });

    it('uses defaults when spike params are not set', () => {
      const defaults: LoadProfileConfig = {
        type: 'spike',
        durationSec: 100,
        maxConcurrency: 10,
      };
      const spikeStart = 30;
      const spikeDur = 20;
      expect(getTargetConcurrency(defaults, spikeStart * 1000)).toBe(30);
      expect(getTargetConcurrency(defaults, (spikeStart + spikeDur) * 1000)).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('always returns at least 1 during ramp-up', () => {
      const profile: LoadProfileConfig = {
        type: 'ramp-up',
        durationSec: 60,
        maxConcurrency: 100,
        rampUpSec: 60,
      };
      expect(getTargetConcurrency(profile, 1)).toBeGreaterThanOrEqual(1);
    });

    it('handles unknown profile type as sustained', () => {
      const profile = {
        type: 'unknown' as LoadProfileConfig['type'],
        durationSec: 60,
        maxConcurrency: 5,
      };
      expect(getTargetConcurrency(profile, 10_000)).toBe(5);
    });
  });
});
