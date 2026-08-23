/**
 * Load test metrics collection: latency tracking, histogram bucketing, and result aggregation.
 * Designed for high-throughput scenarios (up to 1000 msg/s).
 */
import type { WsLoadTestConfig, WsLoadTestResult } from '@shared/websocket/types';
import { computePercentiles, round2 } from '@shared/utils/percentiles';

const HISTOGRAM_BUCKETS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, Infinity];
const THROUGHPUT_SAMPLE_INTERVAL_MS = 1000;

export interface LatencyTracker {
  record(sentTs: number, receivedTs: number): void;
  getSorted(): number[];
  getCount(): number;
}

export function createLatencyTracker(): LatencyTracker {
  const samples: number[] = [];

  return {
    record(sentTs: number, receivedTs: number) {
      const latency = receivedTs - sentTs;
      if (latency >= 0) samples.push(latency);
    },
    getSorted() {
      return [...samples].sort((a, b) => a - b);
    },
    getCount() {
      return samples.length;
    },
  };
}

export interface ThroughputSampler {
  tick(sent: number, received: number): void;
  getHistory(): { ts: number; sent: number; received: number }[];
}

export function createThroughputSampler(): ThroughputSampler {
  const history: { ts: number; sent: number; received: number }[] = [];
  let lastSent = 0;
  let lastReceived = 0;
  let lastTs = 0;

  return {
    tick(sent: number, received: number) {
      const now = Date.now();
      if (lastTs === 0) {
        lastTs = now;
        lastSent = sent;
        lastReceived = received;
        return;
      }
      const elapsed = now - lastTs;
      if (elapsed < THROUGHPUT_SAMPLE_INTERVAL_MS * 0.8) return;

      history.push({
        ts: now,
        sent: sent - lastSent,
        received: received - lastReceived,
      });
      lastSent = sent;
      lastReceived = received;
      lastTs = now;
    },
    getHistory() {
      return [...history];
    },
  };
}

export function buildLatencyHistogram(sorted: number[]): { bucket: string; count: number }[] {
  const counts = new Array<number>(HISTOGRAM_BUCKETS.length).fill(0);

  for (const val of sorted) {
    for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
      if (val <= HISTOGRAM_BUCKETS[i]) {
        counts[i]++;
        break;
      }
    }
  }

  return HISTOGRAM_BUCKETS.map((limit, i) => {
    const prev = i === 0 ? 0 : HISTOGRAM_BUCKETS[i - 1];
    const bucket = limit === Infinity ? `>${prev}ms` : `${prev}-${limit}ms`;
    return { bucket, count: counts[i] };
  }).filter((b) => b.count > 0);
}

export function buildLoadTestResult(
  config: WsLoadTestConfig,
  startedAt: string,
  endedAt: string,
  durationMs: number,
  totalSent: number,
  totalReceived: number,
  errorCount: number,
  bytesSent: number,
  bytesReceived: number,
  latencyTracker: LatencyTracker,
  throughputSampler: ThroughputSampler,
): WsLoadTestResult {
  const sorted = latencyTracker.getSorted();
  const perc = computePercentiles(sorted);

  return {
    config,
    startedAt,
    endedAt,
    durationMs,
    totalSent,
    totalReceived,
    errorCount,
    bytesSent,
    bytesReceived,
    avgSendRate: durationMs > 0 ? round2((totalSent / durationMs) * 1000) : 0,
    avgReceiveRate: durationMs > 0 ? round2((totalReceived / durationMs) * 1000) : 0,
    latency: {
      min: round2(perc.min),
      max: round2(perc.max),
      mean: round2(perc.mean),
      p50: round2(perc.p50),
      p95: round2(perc.p95),
      p99: round2(perc.p99),
      samples: sorted.length,
    },
    throughputHistory: throughputSampler.getHistory(),
    latencyHistogram: buildLatencyHistogram(sorted),
  };
}

/**
 * Expand load test template variables.
 * Supported: {{counter}}, {{timestamp}}, {{random}}
 */
export function expandLoadTestTemplate(template: string, counter: number): string {
  return template
    .replace(/\{\{counter\}\}/g, String(counter))
    .replace(/\{\{timestamp\}\}/g, new Date().toISOString())
    .replace(/\{\{random\}\}/g, Math.random().toString(36).slice(2, 10));
}

/**
 * Compute the target send rate for a given elapsed time, based on the load profile.
 * Returns messages per second.
 */
export function computeTargetRate(
  config: WsLoadTestConfig,
  elapsedMs: number,
): number {
  switch (config.profile) {
    case 'constant':
      return config.rate;
    case 'ramp': {
      const totalMs = config.durationSec * 1000;
      if (totalMs <= 0) return config.rate;
      const progress = Math.min(1, elapsedMs / totalMs);
      return config.rate + (config.rateEnd - config.rate) * progress;
    }
    case 'burst':
      return Infinity;
    default:
      return config.rate;
  }
}

/**
 * Compute total expected messages for a load test config.
 */
export function computeExpectedTotal(config: WsLoadTestConfig): number {
  switch (config.profile) {
    case 'constant':
      return config.rate * config.durationSec;
    case 'ramp':
      return Math.round(((config.rate + config.rateEnd) / 2) * config.durationSec);
    case 'burst':
      return config.burstCount;
    default:
      return 0;
  }
}

/**
 * Default load test configuration.
 */
export function createDefaultLoadTestConfig(): WsLoadTestConfig {
  return {
    profile: 'constant',
    messageTemplate: '{"type":"ping","seq":{{counter}},"ts":"{{timestamp}}"}',
    rate: 10,
    rateEnd: 100,
    durationSec: 10,
    burstCount: 100,
  };
}
