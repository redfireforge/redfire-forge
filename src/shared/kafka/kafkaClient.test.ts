import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpFetchMock = vi.fn();

vi.mock('../utils/httpClient', () => ({
  httpFetch: (...args: unknown[]) => httpFetchMock(...args),
}));

import { KafkaClientError, dispatchKafkaOperation, setKafkaClientTransport, toKafkaUiSafeError } from './kafkaClient';

describe('kafkaClient dispatcher', () => {
  beforeEach(() => {
    httpFetchMock.mockReset();
    setKafkaClientTransport(null);
  });

  it('routes GET operations with query parameters', async () => {
    httpFetchMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ ok: true, op: 'topics', data: { topics: [] } }),
    });

    const envelope = await dispatchKafkaOperation('topics', {
      clusterId: 'dev-cluster',
      includeInternal: true,
    });

    expect(httpFetchMock).toHaveBeenCalledWith(
      '/api/kafka/topics?clusterId=dev-cluster&includeInternal=true',
      'GET',
      { Accept: 'application/json' },
      undefined,
    );
    expect(envelope.ok).toBe(true);
    expect(envelope.op).toBe('topics');
  });

  it('routes POST operations with JSON body', async () => {
    httpFetchMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ ok: true, op: 'produce', data: { ack: true } }),
    });

    await dispatchKafkaOperation('produce', {
      clusterId: 'dev-cluster',
      topic: 'rf.topic.orders',
      value: '{"orderId":"ORD-1"}',
    });

    expect(httpFetchMock).toHaveBeenCalledWith(
      '/api/kafka/produce',
      'POST',
      { Accept: 'application/json', 'Content-Type': 'application/json' },
      JSON.stringify({
        clusterId: 'dev-cluster',
        topic: 'rf.topic.orders',
        value: '{"orderId":"ORD-1"}',
      }),
    );
  });

  it('uses override transport when configured', async () => {
    const overrideTransport = vi.fn().mockResolvedValue({
      ok: true,
      op: 'status',
      data: { connected: true },
    });
    setKafkaClientTransport(overrideTransport);

    const envelope = await dispatchKafkaOperation('status', { clusterId: 'local-dev' });

    expect(httpFetchMock).not.toHaveBeenCalled();
    expect(overrideTransport).toHaveBeenCalledWith({
      op: 'status',
      method: 'GET',
      path: '/api/kafka/status',
      query: { clusterId: 'local-dev' },
      body: undefined,
    });
    expect(envelope.ok).toBe(true);
  });

  it('normalizes query values and supports consume-once dispatch', async () => {
    httpFetchMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ ok: true, op: 'subscriptions', data: { subscriptions: [] } }),
    });

    await dispatchKafkaOperation('subscriptions', {
      clusterId: '  dev-cluster  ' as unknown as string,
    });

    expect(httpFetchMock).toHaveBeenCalledWith(
      '/api/kafka/subscriptions?clusterId=dev-cluster',
      'GET',
      { Accept: 'application/json' },
      undefined,
    );

    httpFetchMock.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ ok: true, op: 'consume-once', data: { messages: [] } }),
    });

    await dispatchKafkaOperation('consume-once', {
      topic: 'orders.created',
      limit: 1,
    });

    expect(httpFetchMock).toHaveBeenLastCalledWith(
      '/api/kafka/consume-once',
      'POST',
      { Accept: 'application/json', 'Content-Type': 'application/json' },
      JSON.stringify({ topic: 'orders.created', limit: 1 }),
    );
  });

  it('drops unsupported query values from override transport requests', async () => {
    const overrideTransport = vi.fn().mockResolvedValue({
      ok: true,
      op: 'status',
      data: { connected: false },
    });
    setKafkaClientTransport(overrideTransport);

    await dispatchKafkaOperation('status', { clusterId: null as unknown as string });
    await dispatchKafkaOperation('status', { clusterId: Number.POSITIVE_INFINITY as unknown as string });
    await dispatchKafkaOperation('status', { clusterId: { bad: true } as unknown as string });

    expect(overrideTransport).toHaveBeenNthCalledWith(1, expect.objectContaining({ query: {} }));
    expect(overrideTransport).toHaveBeenNthCalledWith(2, expect.objectContaining({ query: {} }));
    expect(overrideTransport).toHaveBeenNthCalledWith(3, expect.objectContaining({ query: {} }));
  });

  it('throws helpful error on invalid envelope', async () => {
    httpFetchMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ status: 'ok' }),
    });

    await expect(dispatchKafkaOperation('connect', { clusterId: 'dev' })).rejects.toThrow(
      'Kafka connect returned invalid envelope',
    );
  });

  it('throws server message when envelope indicates failure', async () => {
    httpFetchMock.mockResolvedValue({
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      body: JSON.stringify({ ok: false, op: 'subscribe', error: { code: 'INVALID', message: 'Missing topic' } }),
    });

    await expect(dispatchKafkaOperation('subscribe', { clusterId: 'dev' })).rejects.toThrow('Missing topic');
  });

  it('throws helpful error on non-JSON responses', async () => {
    httpFetchMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '<html>not-json</html>',
    });

    await expect(dispatchKafkaOperation('status', { clusterId: 'dev' })).rejects.toThrow(
      'Kafka status returned non-JSON response',
    );
  });

  it('throws fallback error when failed envelope has no message', async () => {
    httpFetchMock.mockResolvedValue({
      status: 503,
      statusText: 'Service Unavailable',
      headers: {},
      body: JSON.stringify({ ok: false, op: 'status', error: { code: 'BROKER_DOWN' } }),
    });

    await expect(dispatchKafkaOperation('status', { clusterId: 'dev' })).rejects.toThrow(
      'Kafka status failed (BROKER_DOWN)',
    );
  });

  it('throws when server responds with a mismatched operation envelope', async () => {
    httpFetchMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ ok: true, op: 'topics', data: {} }),
    });

    await expect(dispatchKafkaOperation('status', { clusterId: 'dev' })).rejects.toThrow(
      'Kafka status returned mismatched operation envelope (topics)',
    );
  });

  it('maps network transport errors to UI-safe network classification', async () => {
    httpFetchMock.mockResolvedValue({
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: 'Failed to fetch',
    });

    try {
      await dispatchKafkaOperation('status', { clusterId: 'dev' });
      throw new Error('Expected dispatchKafkaOperation to fail');
    } catch (error) {
      const mapped = toKafkaUiSafeError(error, 'status');
      expect(mapped.kind).toBe('network');
      expect(mapped.code).toBe('KAFKA_NETWORK_ERROR');
      expect(mapped.retryable).toBe(true);
    }
  });

  it('classifies auth, tls, timeout, cluster, server, and unknown UI-safe errors', () => {
    expect(toKafkaUiSafeError(new Error('credential rejected'), 'connect').kind).toBe('auth');
    expect(toKafkaUiSafeError(new Error('certificate verify failed'), 'connect').kind).toBe('tls');
    expect(toKafkaUiSafeError(new Error('request timed out'), 'status').kind).toBe('timeout');
    expect(toKafkaUiSafeError(new Error('connect ECONNREFUSED broker:9092'), 'connect').kind).toBe('network');
    expect(toKafkaUiSafeError(new KafkaClientError('status', 'cluster mismatch', { code: 'KAFKA_CLUSTER_MISMATCH' }), 'status').kind).toBe('cluster');
    expect(toKafkaUiSafeError(new KafkaClientError('status', 'broker exploded', { code: 'KAFKA_SERVER_ERROR' }), 'status').kind).toBe('server');
    expect(toKafkaUiSafeError(new KafkaClientError('status', 'mystery problem', { code: 'CUSTOM_FAILURE' }), 'status').kind).toBe('unknown');
    expect(toKafkaUiSafeError('   ', 'status').message).toBe('Kafka status failed');
  });
});
