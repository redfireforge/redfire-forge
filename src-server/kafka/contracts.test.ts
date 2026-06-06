import { describe, expect, it } from 'vitest';
import {
  createKafkaErrorEnvelope,
  createKafkaSuccessEnvelope,
  type KafkaConnectRequest,
} from './contracts.js';

describe('kafka contracts (Phase 1A)', () => {
  it('creates stable success envelope shape', () => {
    const envelope = createKafkaSuccessEnvelope('status', { state: 'disconnected' }, { requestId: 'req-1' });

    expect(envelope.ok).toBe(true);
    expect(envelope.op).toBe('status');
    expect(envelope.data.state).toBe('disconnected');
    expect(envelope.meta.requestId).toBe('req-1');
    expect(typeof envelope.meta.timestamp).toBe('string');
  });

  it('creates stable error envelope shape', () => {
    const envelope = createKafkaErrorEnvelope('connect', {
      code: 'KAFKA_CONNECTION_FAILED',
      message: 'failed to connect',
      retryable: true,
    });

    expect(envelope.ok).toBe(false);
    expect(envelope.op).toBe('connect');
    expect(envelope.error.code).toBe('KAFKA_CONNECTION_FAILED');
    expect(envelope.error.retryable).toBe(true);
    expect(typeof envelope.meta.timestamp).toBe('string');
  });

  it('supports auth and tls fields in connection contracts', () => {
    const request: KafkaConnectRequest = {
      connection: {
        clusterId: 'local-plaintext',
        clientId: 'redfire-phase1a',
        brokers: ['127.0.0.1:9092'],
        auth: {
          mode: 'scram-sha-512',
          username: 'user',
          password: 'secret',
        },
        tls: {
          enabled: true,
          rejectUnauthorized: false,
          serverName: 'kafka.local',
          caPem: 'ca',
          certPem: 'cert',
          keyPem: 'key',
        },
      },
    };

    expect(request.connection.auth?.mode).toBe('scram-sha-512');
    expect(request.connection.tls?.enabled).toBe(true);
  });
});