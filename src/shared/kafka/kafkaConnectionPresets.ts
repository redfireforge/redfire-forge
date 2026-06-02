import type { KafkaAuthConfig, KafkaClusterConfig, KafkaTlsConfig } from './kafkaConfig';

export interface KafkaConnectionPreset {
  id: string;
  name: string;
  description: string;
  category: 'plaintext' | 'sasl' | 'tls' | 'custom';
  config: Omit<KafkaClusterConfig, 'clusterId' | 'createdAt' | 'updatedAt'>;
}

const PLAINTEXT_AUTH: KafkaAuthConfig = { mode: 'none' };
const TLS_DISABLED: KafkaTlsConfig = { enabled: false, rejectUnauthorized: true };
const TLS_ENABLED_SKIP_VERIFY: KafkaTlsConfig = { enabled: true, rejectUnauthorized: false };
const TLS_ENABLED_STRICT: KafkaTlsConfig = { enabled: true, rejectUnauthorized: true };

export const CONNECTION_PRESETS: readonly KafkaConnectionPreset[] = [
  {
    id: 'local-plaintext',
    name: 'Local Plaintext',
    description: 'Redpanda/Kafka on localhost:19092 with no auth or TLS',
    category: 'plaintext',
    config: {
      name: 'Local Plaintext',
      clientId: 'redfireforge-local',
      brokers: ['127.0.0.1:19092'],
      connectionTimeoutMs: 5000,
      requestTimeoutMs: 5000,
      auth: PLAINTEXT_AUTH,
      tls: TLS_DISABLED,
    },
  },
  {
    id: 'local-sasl-plain',
    name: 'Local SASL/PLAIN',
    // NOTE: Redpanda rejects SASL/PLAIN without TLS ("mechanism not supported").
    // Use SCRAM-SHA-256 (no TLS) for the local Docker secure profile, or use the
    // "Local SASL + TLS" preset for PLAIN over TLS.  This preset targets brokers
    // (e.g. Confluent Platform dev) that permit PLAIN without TLS.
    description: 'SASL/PLAIN authentication — works with brokers that permit PLAIN without TLS (Redpanda requires TLS for PLAIN; use SCRAM-SHA-256 or the SASL+TLS preset instead)',
    category: 'sasl',
    config: {
      name: 'Local SASL/PLAIN',
      clientId: 'redfireforge-local-sasl',
      brokers: ['127.0.0.1:19093'],
      connectionTimeoutMs: 8000,
      requestTimeoutMs: 5000,
      auth: { mode: 'plain', username: '', password: '' },
      tls: TLS_DISABLED,
    },
  },
  {
    id: 'local-sasl-scram256',
    name: 'Local SCRAM-SHA-256',
    description: 'Redpanda on localhost:19093 with SCRAM-SHA-256 authentication',
    category: 'sasl',
    config: {
      name: 'Local SCRAM-SHA-256',
      clientId: 'redfireforge-local-scram',
      brokers: ['127.0.0.1:19093'],
      connectionTimeoutMs: 8000,
      requestTimeoutMs: 5000,
      auth: { mode: 'scram-sha-256', username: '', password: '' },
      tls: TLS_DISABLED,
    },
  },
  {
    id: 'local-sasl-scram512',
    name: 'Local SCRAM-SHA-512',
    description: 'Kafka on localhost:19093 with SCRAM-SHA-512 authentication',
    category: 'sasl',
    config: {
      name: 'Local SCRAM-SHA-512',
      clientId: 'redfireforge-local-scram512',
      brokers: ['127.0.0.1:19093'],
      connectionTimeoutMs: 8000,
      requestTimeoutMs: 5000,
      auth: { mode: 'scram-sha-512', username: '', password: '' },
      tls: TLS_DISABLED,
    },
  },
  {
    id: 'local-sasl-tls',
    name: 'Local SASL + TLS',
    description: 'SASL/PLAIN over TLS (skip verify for self-signed certs)',
    category: 'tls',
    config: {
      name: 'Local SASL + TLS',
      clientId: 'redfireforge-local-sasl-tls',
      brokers: ['127.0.0.1:19093'],
      connectionTimeoutMs: 8000,
      requestTimeoutMs: 5000,
      auth: { mode: 'plain', username: '', password: '' },
      tls: TLS_ENABLED_SKIP_VERIFY,
    },
  },
  {
    id: 'local-tls-strict',
    name: 'Local TLS (Strict)',
    description: 'TLS with certificate verification enabled — requires CA PEM',
    category: 'tls',
    config: {
      name: 'Local TLS (Strict)',
      clientId: 'redfireforge-local-tls',
      brokers: ['127.0.0.1:19093'],
      connectionTimeoutMs: 8000,
      requestTimeoutMs: 5000,
      auth: PLAINTEXT_AUTH,
      tls: TLS_ENABLED_STRICT,
    },
  },
];

export function getPresetById(id: string): KafkaConnectionPreset | undefined {
  return CONNECTION_PRESETS.find((p) => p.id === id);
}

export function getPresetsByCategory(category: KafkaConnectionPreset['category']): KafkaConnectionPreset[] {
  return CONNECTION_PRESETS.filter((p) => p.category === category);
}

export function applyPreset(preset: KafkaConnectionPreset, now = Date.now()): KafkaClusterConfig {
  return {
    clusterId: `${preset.id}-${now}`,
    ...preset.config,
    brokers: [...preset.config.brokers],
    auth: { ...preset.config.auth },
    tls: { ...preset.config.tls },
    createdAt: now,
    updatedAt: now,
  };
}

export function presetRequiresCredentials(preset: KafkaConnectionPreset): boolean {
  return preset.config.auth.mode !== 'none';
}

export function presetRequiresTlsCert(preset: KafkaConnectionPreset): boolean {
  return preset.config.tls.enabled && preset.config.tls.rejectUnauthorized === true;
}
