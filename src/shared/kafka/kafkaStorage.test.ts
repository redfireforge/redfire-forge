/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  KAFKA_AUTO_CONNECT_ON_STARTUP_KEY,
  KAFKA_CLUSTERS_KEY,
  KAFKA_SELECTED_CLUSTER_KEY,
  loadKafkaAutoConnectOnStartup,
  loadKafkaClusters,
  loadSelectedKafkaClusterId,
  saveKafkaAutoConnectOnStartup,
  saveKafkaClusters,
  saveSelectedKafkaClusterId,
} from './kafkaStorage';
import type { KafkaClusterConfig } from './kafkaConfig';

const LEGACY_CLUSTER_KEY = 'perf-test-kafka-clusters';
const LEGACY_SELECTED_KEY = 'perf-test-kafka-selected-cluster';

const sampleCluster: KafkaClusterConfig = {
  clusterId: 'local-dev',
  name: 'Local Dev',
  clientId: 'redfireforge-local-dev',
  brokers: ['127.0.0.1:19092'],
  auth: { mode: 'none' },
  tls: { enabled: false, rejectUnauthorized: true },
  createdAt: 1,
  updatedAt: 2,
};

beforeEach(() => {
  localStorage.clear();
});

describe('kafkaStorage', () => {
  it('saves and loads clusters via canonical key', async () => {
    await saveKafkaClusters([sampleCluster]);

    const loaded = await loadKafkaClusters();
    expect(loaded).toEqual([sampleCluster]);
  });

  it('migrates legacy cluster payload and normalizes shape', async () => {
    localStorage.setItem(LEGACY_CLUSTER_KEY, JSON.stringify([
      {
        id: 'legacy-cluster',
        brokers: '127.0.0.1:19092, 127.0.0.1:19092',
        authMode: 'plain',
        username: 'legacy-user',
        password: 'legacy-pass',
      },
      {
        id: 'legacy-cluster',
        brokers: ['127.0.0.1:19093'],
        auth: { mode: 'none' },
      },
      {
        id: 'invalid-entry',
        brokers: [],
      },
    ]));

    const loaded = await loadKafkaClusters();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].clusterId).toBe('legacy-cluster');
    expect(loaded[0].brokers).toEqual(['127.0.0.1:19093']);
    expect(loaded[0].name).toBe('legacy-cluster');
    expect(localStorage.getItem(LEGACY_CLUSTER_KEY)).toBeNull();
    expect(localStorage.getItem(KAFKA_CLUSTERS_KEY)).not.toBeNull();
  });

  it('returns empty clusters on malformed persisted payload', async () => {
    localStorage.setItem(KAFKA_CLUSTERS_KEY, '{broken-json');

    const loaded = await loadKafkaClusters();
    expect(loaded).toEqual([]);
  });

  it('saves and loads selected cluster id', async () => {
    await saveSelectedKafkaClusterId('local-dev');
    expect(await loadSelectedKafkaClusterId()).toBe('local-dev');

    await saveSelectedKafkaClusterId(null);
    expect(await loadSelectedKafkaClusterId()).toBeNull();
  });

  it('migrates legacy selected-cluster key to canonical key', async () => {
    localStorage.setItem(LEGACY_SELECTED_KEY, 'legacy-selected');

    const selected = await loadSelectedKafkaClusterId();
    expect(selected).toBe('legacy-selected');
    expect(localStorage.getItem(LEGACY_SELECTED_KEY)).toBeNull();
    expect(localStorage.getItem(KAFKA_SELECTED_CLUSTER_KEY)).toBe('legacy-selected');
  });

  it('removes blank canonical selected-cluster value', async () => {
    localStorage.setItem(KAFKA_SELECTED_CLUSTER_KEY, '   ');

    const selected = await loadSelectedKafkaClusterId();
    expect(selected).toBeNull();
    expect(localStorage.getItem(KAFKA_SELECTED_CLUSTER_KEY)).toBeNull();
  });

  it('saves and loads startup auto-connect preference', async () => {
    await saveKafkaAutoConnectOnStartup(true);
    expect(await loadKafkaAutoConnectOnStartup()).toBe(true);

    await saveKafkaAutoConnectOnStartup(false);
    expect(await loadKafkaAutoConnectOnStartup()).toBe(false);
  });

  it('normalizes malformed startup auto-connect value to false', async () => {
    localStorage.setItem(KAFKA_AUTO_CONNECT_ON_STARTUP_KEY, 'sometimes');

    expect(await loadKafkaAutoConnectOnStartup()).toBe(false);
    expect(localStorage.getItem(KAFKA_AUTO_CONNECT_ON_STARTUP_KEY)).toBeNull();
  });
});

// ── additional branch coverage ──────────────────────────────────────────────

describe('kafkaStorage – parseClusters non-array JSON (line 53)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns empty array when stored JSON is a valid object (not array)', async () => {
    // JSON.parse succeeds but !Array.isArray → hits the line 53 return []
    localStorage.setItem(KAFKA_CLUSTERS_KEY, JSON.stringify({ clusterId: 'x' }));
    const clusters = await loadKafkaClusters();
    expect(clusters).toEqual([]);
  });
});

describe('kafkaStorage – no data at all (line 87)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns empty array when both canonical and legacy keys are absent', async () => {
    // Nothing in storage → firstKeyHit returns null → hits line 87 return []
    const clusters = await loadKafkaClusters();
    expect(clusters).toEqual([]);
  });
});

describe('kafkaStorage – re-normalisation on mismatch (line 80)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('re-saves clusters when normalisation changes the canonical form', async () => {
    const rawCluster = {
      clusterId: 'c-resave',
      name: 'Resave Test',
      clientId: 'ci',
      brokers: ['127.0.0.1:9092'],
      auth: { mode: 'none' },
      tls: { enabled: false },
      createdAt: 1000,
      updatedAt: 1000,
      __extra: 'stripped',
    };
    localStorage.setItem(KAFKA_CLUSTERS_KEY, JSON.stringify([rawCluster]));

    const clusters = await loadKafkaClusters();
    expect(clusters.length).toBe(1);
    expect(clusters[0].clusterId).toBe('c-resave');
    const storedAfter = localStorage.getItem(KAFKA_CLUSTERS_KEY);
    expect(storedAfter).not.toContain('__extra');
  });
});

describe('kafkaStorage – loadKafkaAutoConnectOnStartup with null key (line 136)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns false when auto-connect key is absent (null stored)', async () => {
    // No key set → readKey returns null → hits line 136 return false
    const result = await loadKafkaAutoConnectOnStartup();
    expect(result).toBe(false);
  });
});

describe('kafkaStorage – legacy selected-cluster migration (lines 120-121, 136)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('migrates a valid legacy selected-cluster ID to the new key', async () => {
    const LEGACY_SEL = 'perf-test-kafka-selected-cluster';
    localStorage.setItem(LEGACY_SEL, '  legacy-cluster-id  ');

    const selected = await loadSelectedKafkaClusterId();
    expect(selected).toBe('legacy-cluster-id');
    expect(localStorage.getItem(KAFKA_SELECTED_CLUSTER_KEY)).toBe('legacy-cluster-id');
    expect(localStorage.getItem(LEGACY_SEL)).toBeNull();
  });

  it('removes legacy selected-cluster key when the stored value is blank', async () => {
    const LEGACY_SEL = 'perf-test-kafka-selected-cluster';
    localStorage.setItem(LEGACY_SEL, '   ');

    const selected = await loadSelectedKafkaClusterId();
    expect(selected).toBeNull();
    expect(localStorage.getItem(LEGACY_SEL)).toBeNull();
  });
});
