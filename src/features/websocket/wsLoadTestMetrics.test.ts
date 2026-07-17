import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLatencyTracker,
  createThroughputSampler,
  buildLatencyHistogram,
  buildLoadTestResult,
  expandLoadTestTemplate,
  computeTargetRate,
  computeExpectedTotal,
  createDefaultLoadTestConfig,
} from './wsLoadTestMetrics';
import { embedNonce, extractNonce } from './useWebSocketLoadTest';
import type { WsLoadTestConfig } from '../../shared/websocket/types';

describe('createLatencyTracker', () => {
  it('records and returns sorted latencies', () => {
    const tracker = createLatencyTracker();
    tracker.record(100, 150);
    tracker.record(200, 210);
    tracker.record(300, 380);
    expect(tracker.getCount()).toBe(3);
    expect(tracker.getSorted()).toEqual([10, 50, 80]);
  });

  it('ignores negative latencies', () => {
    const tracker = createLatencyTracker();
    tracker.record(200, 100);
    expect(tracker.getCount()).toBe(0);
  });

  it('handles zero latency', () => {
    const tracker = createLatencyTracker();
    tracker.record(100, 100);
    expect(tracker.getSorted()).toEqual([0]);
  });

  it('returns empty for no samples', () => {
    const tracker = createLatencyTracker();
    expect(tracker.getSorted()).toEqual([]);
    expect(tracker.getCount()).toBe(0);
  });
});

describe('createThroughputSampler', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts with empty history', () => {
    const sampler = createThroughputSampler();
    expect(sampler.getHistory()).toEqual([]);
  });

  it('records delta between ticks', () => {
    const sampler = createThroughputSampler();
    vi.setSystemTime(1000);
    sampler.tick(0, 0);
    vi.setSystemTime(2000);
    sampler.tick(10, 5);
    const history = sampler.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].sent).toBe(10);
    expect(history[0].received).toBe(5);
  });

  it('skips samples that are too close together', () => {
    const sampler = createThroughputSampler();
    vi.setSystemTime(1000);
    sampler.tick(0, 0);
    vi.setSystemTime(1200);
    sampler.tick(5, 3);
    expect(sampler.getHistory()).toHaveLength(0);
  });
});

describe('buildLatencyHistogram', () => {
  it('buckets latencies correctly', () => {
    const sorted = [0.5, 1, 3, 10, 50, 100, 500, 6000];
    const histogram = buildLatencyHistogram(sorted);
    expect(histogram.length).toBeGreaterThan(0);
    const totalCount = histogram.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(sorted.length);
  });

  it('returns empty for no data', () => {
    expect(buildLatencyHistogram([])).toEqual([]);
  });

  it('puts values in correct buckets', () => {
    const sorted = [0.5, 0.8];
    const histogram = buildLatencyHistogram(sorted);
    expect(histogram).toHaveLength(1);
    expect(histogram[0].bucket).toBe('0-1ms');
    expect(histogram[0].count).toBe(2);
  });

  it('handles large values in overflow bucket', () => {
    const sorted = [10000];
    const histogram = buildLatencyHistogram(sorted);
    const overflow = histogram.find((b) => b.bucket.startsWith('>'));
    expect(overflow).toBeTruthy();
    expect(overflow!.count).toBe(1);
  });
});

describe('buildLoadTestResult', () => {
  it('produces a complete result object', () => {
    const tracker = createLatencyTracker();
    tracker.record(100, 150);
    tracker.record(200, 260);
    const sampler = createThroughputSampler();

    const config: WsLoadTestConfig = {
      profile: 'constant',
      messageTemplate: 'test',
      rate: 10,
      rateEnd: 10,
      durationSec: 5,
      burstCount: 0,
    };

    const result = buildLoadTestResult(
      config, '2026-01-01T00:00:00Z', '2026-01-01T00:00:05Z',
      5000, 50, 48, 2, 5000, 4800, tracker, sampler,
    );

    expect(result.totalSent).toBe(50);
    expect(result.totalReceived).toBe(48);
    expect(result.errorCount).toBe(2);
    expect(result.avgSendRate).toBe(10);
    expect(result.latency.samples).toBe(2);
    expect(result.latency.min).toBe(50);
    expect(result.latency.max).toBe(60);
  });

  it('returns zero average rates when duration is zero', () => {
    const config = createDefaultLoadTestConfig();
    const tracker = createLatencyTracker();
    const sampler = createThroughputSampler();
    const result = buildLoadTestResult(
      config,
      '2025-01-01T00:00:00Z',
      '2025-01-01T00:00:00Z',
      0,
      10,
      5,
      0,
      100,
      50,
      tracker,
      sampler,
    );
    expect(result.avgSendRate).toBe(0);
    expect(result.avgReceiveRate).toBe(0);
  });
});

describe('expandLoadTestTemplate', () => {
  it('replaces {{counter}}', () => {
    expect(expandLoadTestTemplate('msg-{{counter}}', 42)).toBe('msg-42');
  });

  it('replaces {{timestamp}} with ISO string', () => {
    const result = expandLoadTestTemplate('ts:{{timestamp}}', 1);
    expect(result).toMatch(/^ts:\d{4}-\d{2}-\d{2}T/);
  });

  it('replaces {{random}} with alphanumeric string', () => {
    const result = expandLoadTestTemplate('r:{{random}}', 1);
    expect(result).toMatch(/^r:[a-z0-9]+$/);
  });

  it('replaces multiple variables', () => {
    const result = expandLoadTestTemplate('{"seq":{{counter}},"ts":"{{timestamp}}"}', 5);
    expect(result).toContain('"seq":5');
    expect(result).toContain('"ts":"');
  });

  it('leaves unrecognized placeholders unchanged', () => {
    expect(expandLoadTestTemplate('{{unknown}}', 1)).toBe('{{unknown}}');
  });
});

describe('computeTargetRate', () => {
  it('returns constant rate for constant profile', () => {
    const config: WsLoadTestConfig = {
      profile: 'constant', messageTemplate: '', rate: 50,
      rateEnd: 50, durationSec: 10, burstCount: 0,
    };
    expect(computeTargetRate(config, 0)).toBe(50);
    expect(computeTargetRate(config, 5000)).toBe(50);
  });

  it('interpolates rate for ramp profile', () => {
    const config: WsLoadTestConfig = {
      profile: 'ramp', messageTemplate: '', rate: 10,
      rateEnd: 100, durationSec: 10, burstCount: 0,
    };
    expect(computeTargetRate(config, 0)).toBe(10);
    expect(computeTargetRate(config, 5000)).toBe(55);
    expect(computeTargetRate(config, 10000)).toBe(100);
  });

  it('clamps ramp progress to 1', () => {
    const config: WsLoadTestConfig = {
      profile: 'ramp', messageTemplate: '', rate: 10,
      rateEnd: 100, durationSec: 10, burstCount: 0,
    };
    expect(computeTargetRate(config, 20000)).toBe(100);
  });

  it('returns Infinity for burst profile', () => {
    const config: WsLoadTestConfig = {
      profile: 'burst', messageTemplate: '', rate: 0,
      rateEnd: 0, durationSec: 0, burstCount: 100,
    };
    expect(computeTargetRate(config, 0)).toBe(Infinity);
  });

  it('returns base rate when ramp duration is zero', () => {
    const config: WsLoadTestConfig = {
      profile: 'ramp', messageTemplate: '', rate: 15,
      rateEnd: 30, durationSec: 0, burstCount: 0,
    };
    expect(computeTargetRate(config, 1000)).toBe(15);
  });

  it('falls back to config rate for unknown profile', () => {
    const config = {
      profile: 'unknown',
      messageTemplate: '',
      rate: 22,
      rateEnd: 0,
      durationSec: 1,
      burstCount: 0,
    } as WsLoadTestConfig;
    expect(computeTargetRate(config, 0)).toBe(22);
  });
});

describe('computeExpectedTotal', () => {
  it('computes constant total', () => {
    const config: WsLoadTestConfig = {
      profile: 'constant', messageTemplate: '', rate: 10,
      rateEnd: 10, durationSec: 5, burstCount: 0,
    };
    expect(computeExpectedTotal(config)).toBe(50);
  });

  it('computes ramp total (average rate * duration)', () => {
    const config: WsLoadTestConfig = {
      profile: 'ramp', messageTemplate: '', rate: 10,
      rateEnd: 100, durationSec: 10, burstCount: 0,
    };
    expect(computeExpectedTotal(config)).toBe(550);
  });

  it('returns burstCount for burst', () => {
    const config: WsLoadTestConfig = {
      profile: 'burst', messageTemplate: '', rate: 0,
      rateEnd: 0, durationSec: 0, burstCount: 200,
    };
    expect(computeExpectedTotal(config)).toBe(200);
  });

  it('returns zero for unknown profile', () => {
    const config = {
      profile: 'unknown',
      messageTemplate: '',
      rate: 1,
      rateEnd: 1,
      durationSec: 1,
      burstCount: 0,
    } as WsLoadTestConfig;
    expect(computeExpectedTotal(config)).toBe(0);
  });
});

describe('createDefaultLoadTestConfig', () => {
  it('returns valid defaults', () => {
    const config = createDefaultLoadTestConfig();
    expect(config.profile).toBe('constant');
    expect(config.rate).toBeGreaterThan(0);
    expect(config.durationSec).toBeGreaterThan(0);
    expect(config.messageTemplate).toBeTruthy();
  });
});

describe('embedNonce', () => {
  it('injects nonce into JSON object', () => {
    const result = embedNonce('{"type":"ping"}', 1);
    expect(result).toContain('"__lt_nonce"');
    expect(result.startsWith('{')).toBe(true);
    expect(result.endsWith('}')).toBe(true);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('produces valid JSON for empty object {}', () => {
    const result = embedNonce('{}', 1);
    expect(result).toContain('"__lt_nonce"');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('produces valid JSON for whitespace-only object { }', () => {
    const result = embedNonce('{  }', 1);
    expect(result).toContain('"__lt_nonce"');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('returns non-JSON messages unchanged', () => {
    expect(embedNonce('hello', 1)).toBe('hello');
    expect(embedNonce('[1,2,3]', 1)).toBe('[1,2,3]');
  });
});

describe('extractNonce', () => {
  it('extracts nonce from JSON string', () => {
    const msg = embedNonce('{"type":"ping"}', 42);
    const nonce = extractNonce(msg);
    expect(nonce).toBeTruthy();
    expect(nonce!.startsWith('__lt_')).toBe(true);
  });

  it('returns null for non-load-test messages', () => {
    expect(extractNonce('{"type":"pong"}')).toBeNull();
    expect(extractNonce('plain text')).toBeNull();
  });

  it('round-trips: embed then extract', () => {
    const msg = embedNonce('{"data":1}', 7);
    const nonce = extractNonce(msg);
    expect(nonce).toBeTruthy();
    expect(nonce).toMatch(/^__lt_7_\d+$/);
  });
});
