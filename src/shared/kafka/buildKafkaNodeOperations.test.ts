import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildKafkaNodeOperations } from './buildKafkaNodeOperations';
import * as kafkaClient from './kafkaClient';

vi.mock('./kafkaClient', () => ({
  dispatchKafkaOperation: vi.fn(),
}));

const mockDispatch = vi.mocked(kafkaClient.dispatchKafkaOperation);

describe('buildKafkaNodeOperations - produce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches produce with correct server request shape', async () => {
    mockDispatch.mockResolvedValue({
      ok: true,
      op: 'produce',
      data: { topic: 'orders', sentCount: 1, records: [{ partition: 2, offset: '42', timestamp: '1717000000000' }] },
    });

    const ops = buildKafkaNodeOperations();
    const result = await ops.produce({
      clusterId: 'cluster-1',
      topic: 'orders',
      key: 'order-1',
      value: '{"id":1}',
      headers: { 'x-trace': 'abc' },
      ackMode: 'all',
      timeoutMs: 5000,
    });

    expect(mockDispatch).toHaveBeenCalledWith('produce', {
      clusterId: 'cluster-1',
      topic: 'orders',
      messages: [{ key: 'order-1', value: '{"id":1}', headers: { 'x-trace': 'abc' }, partition: undefined }],
      acks: -1,
      timeoutMs: 5000,
    });

    expect(result).toEqual({
      topic: 'orders',
      partition: 2,
      offset: '42',
      timestamp: '1717000000000',
      key: 'order-1',
    });
  });

  it('maps ackMode leader → acks 1', async () => {
    mockDispatch.mockResolvedValue({
      ok: true, op: 'produce',
      data: { topic: 't', sentCount: 1, records: [{ partition: 0, offset: '1' }] },
    });
    const ops = buildKafkaNodeOperations();
    await ops.produce({ clusterId: 'c', topic: 't', value: 'v', ackMode: 'leader' });
    expect(mockDispatch).toHaveBeenCalledWith('produce', expect.objectContaining({ acks: 1 }));
  });

  it('maps ackMode none → acks 0', async () => {
    mockDispatch.mockResolvedValue({
      ok: true, op: 'produce',
      data: { topic: 't', sentCount: 1, records: [{ partition: 0, offset: '0' }] },
    });
    const ops = buildKafkaNodeOperations();
    await ops.produce({ clusterId: 'c', topic: 't', value: 'v', ackMode: 'none' });
    expect(mockDispatch).toHaveBeenCalledWith('produce', expect.objectContaining({ acks: 0 }));
  });

  it('leaves acks undefined when ackMode is not provided', async () => {
    mockDispatch.mockResolvedValue({
      ok: true, op: 'produce',
      data: { topic: 't', sentCount: 1, records: [{ partition: 0, offset: '5' }] },
    });
    const ops = buildKafkaNodeOperations();
    await ops.produce({ clusterId: 'c', topic: 't', value: 'v' });
    expect(mockDispatch).toHaveBeenCalledWith('produce', expect.objectContaining({ acks: undefined }));
  });

  it('defaults partition/offset/timestamp when records is empty', async () => {
    mockDispatch.mockResolvedValue({
      ok: true, op: 'produce',
      data: { topic: 't', sentCount: 0, records: [] },
    });
    const ops = buildKafkaNodeOperations();
    const result = await ops.produce({ clusterId: 'c', topic: 't', value: '' });
    expect(result.partition).toBe(0);
    expect(result.offset).toBe('');
    expect(result.timestamp).toBe('');
  });

  it('propagates errors thrown by dispatchKafkaOperation', async () => {
    mockDispatch.mockRejectedValue(new Error('SASL auth failed'));
    const ops = buildKafkaNodeOperations();
    await expect(ops.produce({ clusterId: 'c', topic: 't', value: 'v' })).rejects.toThrow('SASL auth failed');
  });
});

describe('buildKafkaNodeOperations - consume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches consume-once with correct server request shape', async () => {
    mockDispatch.mockResolvedValue({
      ok: true, op: 'consume-once',
      data: {
        messageCount: 1,
        messages: [{ topic: 'events', partition: 1, offset: '10', timestamp: '111', key: 'k1', value: '{"x":1}', headers: { 'h': 'v' } }],
      },
    });

    const ops = buildKafkaNodeOperations();
    const result = await ops.consume({
      clusterId: 'c',
      topic: 'events',
      maxMessages: 5,
      timeoutMs: 3000,
      startPosition: 'earliest',
      keyRegex: 'my-key',
      headerFilters: [{ key: 'env', value: 'prod' }],
      jsonPathFilters: [{ jsonPath: '$.status', expectedValue: 'ok' }],
    });

    expect(mockDispatch).toHaveBeenCalledWith('consume-once', {
      clusterId: 'c',
      topic: 'events',
      maxMessages: 5,
      timeoutMs: 3000,
      fromBeginning: true,
      filter: {
        keyEquals: 'my-key',
        headersMatch: { env: 'prod' },
        jsonPath: '$.status',
        jsonEquals: 'ok',
      },
    });

    expect(result).toEqual([
      { topic: 'events', partition: 1, offset: '10', timestamp: '111', key: 'k1', value: '{"x":1}', headers: { 'h': 'v' } },
    ]);
  });

  it('maps startPosition latest → fromBeginning false', async () => {
    mockDispatch.mockResolvedValue({ ok: true, op: 'consume-once', data: { messageCount: 0, messages: [] } });
    const ops = buildKafkaNodeOperations();
    await ops.consume({ clusterId: 'c', topic: 't', maxMessages: 1, timeoutMs: 1000, startPosition: 'latest' });
    expect(mockDispatch).toHaveBeenCalledWith('consume-once', expect.objectContaining({ fromBeginning: false }));
  });

  it('maps startPosition committed → fromBeginning false', async () => {
    mockDispatch.mockResolvedValue({ ok: true, op: 'consume-once', data: { messageCount: 0, messages: [] } });
    const ops = buildKafkaNodeOperations();
    await ops.consume({ clusterId: 'c', topic: 't', maxMessages: 1, timeoutMs: 1000, startPosition: 'committed' });
    expect(mockDispatch).toHaveBeenCalledWith('consume-once', expect.objectContaining({ fromBeginning: false }));
  });

  it('omits filter when no key/header/jsonpath filters provided', async () => {
    mockDispatch.mockResolvedValue({ ok: true, op: 'consume-once', data: { messageCount: 0, messages: [] } });
    const ops = buildKafkaNodeOperations();
    await ops.consume({ clusterId: 'c', topic: 't', maxMessages: 1, timeoutMs: 1000 });
    const call = mockDispatch.mock.calls[0][1] as Record<string, unknown>;
    expect(call.filter).toBeUndefined();
  });

  it('defaults missing timestamp to empty string', async () => {
    mockDispatch.mockResolvedValue({
      ok: true, op: 'consume-once',
      data: { messageCount: 1, messages: [{ topic: 't', partition: 0, offset: '0', value: 'v' }] },
    });
    const ops = buildKafkaNodeOperations();
    const [msg] = await ops.consume({ clusterId: 'c', topic: 't', maxMessages: 1, timeoutMs: 1000 });
    expect(msg.timestamp).toBe('');
  });

  it('returns empty array when no messages consumed (timeout)', async () => {
    mockDispatch.mockResolvedValue({ ok: true, op: 'consume-once', data: { messageCount: 0, messages: [] } });
    const ops = buildKafkaNodeOperations();
    const result = await ops.consume({ clusterId: 'c', topic: 't', maxMessages: 1, timeoutMs: 1000 });
    expect(result).toEqual([]);
  });

  it('merges multiple header filters into headersMatch record', async () => {
    mockDispatch.mockResolvedValue({ ok: true, op: 'consume-once', data: { messageCount: 0, messages: [] } });
    const ops = buildKafkaNodeOperations();
    await ops.consume({
      clusterId: 'c', topic: 't', maxMessages: 1, timeoutMs: 1000,
      headerFilters: [{ key: 'env', value: 'prod' }, { key: 'region', value: 'us-east' }],
    });
    expect(mockDispatch).toHaveBeenCalledWith('consume-once', expect.objectContaining({
      filter: expect.objectContaining({ headersMatch: { env: 'prod', region: 'us-east' } }),
    }));
  });

  it('uses only first jsonPath filter (server supports one)', async () => {
    mockDispatch.mockResolvedValue({ ok: true, op: 'consume-once', data: { messageCount: 0, messages: [] } });
    const ops = buildKafkaNodeOperations();
    await ops.consume({
      clusterId: 'c', topic: 't', maxMessages: 1, timeoutMs: 1000,
      jsonPathFilters: [
        { jsonPath: '$.status', expectedValue: 'ok' },
        { jsonPath: '$.type', expectedValue: 'order' },
      ],
    });
    expect(mockDispatch).toHaveBeenCalledWith('consume-once', expect.objectContaining({
      filter: expect.objectContaining({ jsonPath: '$.status', jsonEquals: 'ok' }),
    }));
  });

  it('propagates errors thrown by dispatchKafkaOperation', async () => {
    mockDispatch.mockRejectedValue(new Error('TLS handshake failed'));
    const ops = buildKafkaNodeOperations();
    await expect(ops.consume({ clusterId: 'c', topic: 't', maxMessages: 1, timeoutMs: 1000 })).rejects.toThrow('TLS handshake failed');
  });
});
