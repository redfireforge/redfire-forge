import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch for runWebhookLoadTest
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock crypto.randomUUID
vi.spyOn(crypto, 'randomUUID').mockImplementation(() => 'test-uuid-1234' as `${string}-${string}-${string}-${string}-${string}`);

import { calculateTotalRequests, WebhookRateConfig } from './webhookLoadDriver';

describe('webhookLoadDriver', () => {
  beforeEach(() => {
    resetAllMocks();
    mockFetch.mockReset();
  });

  describe('calculateTotalRequests', () => {
    it('calculates fixed rate total correctly', () => {
      const rate: WebhookRateConfig = {
        mode: 'fixed',
        rps: 10,
        durationSec: 60,
      };
      expect(calculateTotalRequests(rate)).toBe(600);
    });

    it('calculates fixed rate with defaults', () => {
      const rate: WebhookRateConfig = { mode: 'fixed' };
      expect(calculateTotalRequests(rate)).toBe(1); // 1 rps * 1 sec
    });

    it('calculates ramp rate total using average', () => {
      const rate: WebhookRateConfig = {
        mode: 'ramp',
        rps: 10,        // start
        endRps: 50,     // end
        durationSec: 60,
      };
      // Average = (10 + 50) / 2 = 30 rps
      // Total = 30 * 60 = 1800
      expect(calculateTotalRequests(rate)).toBe(1800);
    });

    it('calculates ramp with same start/end (flat rate)', () => {
      const rate: WebhookRateConfig = {
        mode: 'ramp',
        rps: 20,
        endRps: 20,
        durationSec: 30,
      };
      expect(calculateTotalRequests(rate)).toBe(600);
    });

    it('calculates burst total directly', () => {
      const rate: WebhookRateConfig = {
        mode: 'burst',
        burstCount: 500,
      };
      expect(calculateTotalRequests(rate)).toBe(500);
    });

    it('handles burst with default count', () => {
      const rate: WebhookRateConfig = { mode: 'burst' };
      expect(calculateTotalRequests(rate)).toBe(1);
    });

    it('handles unknown mode gracefully', () => {
      const rate = { mode: 'unknown' } as unknown as WebhookRateConfig;
      expect(calculateTotalRequests(rate)).toBe(1);
    });

    it('treats explicit zero ramp rate fields using || fallbacks inside calculateTotalRequests', () => {
      expect(
        calculateTotalRequests({
          mode: 'ramp',
          rps: 0,
          endRps: 0,
          durationSec: 0,
        }),
      ).toBe(1);
    });

    it('fills omitted ramp knobs with sane defaults before averaging', () => {
      expect(
        calculateTotalRequests({
          mode: 'ramp',
          durationSec: 2,
        }),
      ).toBe(2); // avg 1 rps * 2s

      expect(calculateTotalRequests({ mode: 'ramp', rps: 4, durationSec: 1 })).toBe(4);
    });

    it('rounds up fractional totals', () => {
      const rate: WebhookRateConfig = {
        mode: 'fixed',
        rps: 3,
        durationSec: 10,
      };
      // 3 * 10 = 30, no rounding needed
      expect(calculateTotalRequests(rate)).toBe(30);
      
      const rate2: WebhookRateConfig = {
        mode: 'ramp',
        rps: 1,
        endRps: 2,
        durationSec: 3,
      };
      // Average = 1.5, total = 4.5, rounds to 5
      expect(calculateTotalRequests(rate2)).toBe(5);
    });
  });

  describe('WebhookRateConfig validation', () => {
    it('fixed mode requires rps and durationSec', () => {
      const validFixed: WebhookRateConfig = {
        mode: 'fixed',
        rps: 50,
        durationSec: 120,
      };
      expect(calculateTotalRequests(validFixed)).toBe(6000);
    });

    it('ramp mode requires rps, endRps, and durationSec', () => {
      const validRamp: WebhookRateConfig = {
        mode: 'ramp',
        rps: 5,
        endRps: 100,
        durationSec: 300,
      };
      // Average = 52.5 rps, total = 15750
      expect(calculateTotalRequests(validRamp)).toBe(15750);
    });

    it('burst mode requires burstCount', () => {
      const validBurst: WebhookRateConfig = {
        mode: 'burst',
        burstCount: 1000,
      };
      expect(calculateTotalRequests(validBurst)).toBe(1000);
    });
  });
});

describe('webhookLoadDriver integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates expected total for common load test scenarios', () => {
    // Scenario 1: Warm-up load test
    const warmup: WebhookRateConfig = {
      mode: 'ramp',
      rps: 1,
      endRps: 10,
      durationSec: 30,
    };
    expect(calculateTotalRequests(warmup)).toBe(165); // avg 5.5 * 30

    // Scenario 2: Sustained load
    const sustained: WebhookRateConfig = {
      mode: 'fixed',
      rps: 100,
      durationSec: 300,
    };
    expect(calculateTotalRequests(sustained)).toBe(30000);

    // Scenario 3: Spike test
    const spike: WebhookRateConfig = {
      mode: 'burst',
      burstCount: 500,
    };
    expect(calculateTotalRequests(spike)).toBe(500);
  });
});
