/**
 * Unit tests for kafka-produce.ts
 *
 * Covers: basic produce, validation, schema encoding, auth errors,
 * producer lifecycle, and error paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeProduce } from './kafka-produce.js';
import { createMockRuntimeAdapter, makeConnection, expectSuccess, expectError } from './kafka-service.test-utils.js';
import type { KafkaProduceRequest, KafkaSchemaConfig } from './contracts.js';

// ── Mock schema-registry-client ───────────────────────────────────────────────

const { mockEncodeValue } = vi.hoisted(() => ({
  mockEncodeValue: vi.fn(),
}));

vi.mock('./schema-registry-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./schema-registry-client.js')>();
  return {
    ...actual,
    encodeValue: mockEncodeValue,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const schemaConfig: KafkaSchemaConfig = {
  registryUrl: 'http://localhost:8081',
  format: 'avro',
};

function baseRequest(overrides?: Partial<KafkaProduceRequest>): KafkaProduceRequest {
  return {
    clusterId: 'local-dev',
    topic: 'orders.created',
    messages: [{ key: 'k1', value: '{"event":"test"}' }],
    ...overrides,
  };
}

function makeWireBuffer(schemaId = 42): Buffer {
  const buf = Buffer.allocUnsafe(9);
  buf.writeUInt8(0, 0);
  buf.writeUInt32BE(schemaId, 1);
  buf.write('test', 5);
  return buf;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('executeProduce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('produces messages and returns success envelope', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();
    const result = await executeProduce(runtimeAdapter, makeConnection(), baseRequest());

    const data = expectSuccess(result);
    expect(data.topic).toBe('orders.created');
    expect(data.sentCount).toBe(1);
    expect(data.records).toEqual([{ partition: 0, offset: '1' }]);
  });

  it('returns validation error for missing topic', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();
    const result = await executeProduce(runtimeAdapter, makeConnection(), baseRequest({ topic: '' }));

    expectError(result, 'KAFKA_INVALID_PRODUCE');
  });

  it('returns validation error for empty messages array', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();
    const result = await executeProduce(runtimeAdapter, makeConnection(), baseRequest({ messages: [] }));

    expectError(result, 'KAFKA_INVALID_PRODUCE');
  });

  it('disconnects producer after success', async () => {
    const { runtimeAdapter, producer } = createMockRuntimeAdapter();
    await executeProduce(runtimeAdapter, makeConnection(), baseRequest());

    expect(producer.disconnect).toHaveBeenCalled();
  });

  it('disconnects producer after failure', async () => {
    const { runtimeAdapter, producer } = createMockRuntimeAdapter({ failProduce: true });
    await executeProduce(runtimeAdapter, makeConnection(), baseRequest());

    expect(producer.disconnect).toHaveBeenCalled();
  });

  it('returns auth error when produce encounters auth failure', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter({ failProduceAuth: true });
    const result = await executeProduce(runtimeAdapter, makeConnection(), baseRequest());

    const err = expectError(result, 'KAFKA_AUTH_FAILED');
    expect(err.retryable).toBe(false);
  });

  it('returns produce failed error for generic failures', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter({ failProduce: true });
    const result = await executeProduce(runtimeAdapter, makeConnection(), baseRequest());

    const err = expectError(result, 'KAFKA_PRODUCE_FAILED');
    expect(err.retryable).toBe(true);
  });

  // ── Schema encoding ──────────────────────────────────────────────────────

  describe('schema encoding', () => {
    it('encodes values with schemaConfig and sets valueEncoding', async () => {
      const wireBuf = makeWireBuffer();
      mockEncodeValue.mockResolvedValue(wireBuf);
      const { runtimeAdapter, producer } = createMockRuntimeAdapter();

      const result = await executeProduce(
        runtimeAdapter,
        makeConnection(),
        baseRequest({ schemaConfig }),
      );

      const data = expectSuccess(result);
      expect(data.valueEncoding).toBe('avro');
      expect(mockEncodeValue).toHaveBeenCalledWith(schemaConfig, 'orders.created', { event: 'test' });

      // Verify the producer.send received the encoded buffer
      const sendCall = vi.mocked(producer.send).mock.calls[0][0];
      expect(Buffer.isBuffer(sendCall.messages[0].value)).toBe(true);
    });

    it('sets valueEncoding to protobuf for protobuf format', async () => {
      mockEncodeValue.mockResolvedValue(makeWireBuffer());
      const { runtimeAdapter } = createMockRuntimeAdapter();

      const result = await executeProduce(
        runtimeAdapter,
        makeConnection(),
        baseRequest({ schemaConfig: { ...schemaConfig, format: 'protobuf' } }),
      );

      const data = expectSuccess(result);
      expect(data.valueEncoding).toBe('protobuf');
    });

    it('sets valueEncoding to json-schema for json-schema format', async () => {
      mockEncodeValue.mockResolvedValue(makeWireBuffer());
      const { runtimeAdapter } = createMockRuntimeAdapter();

      const result = await executeProduce(
        runtimeAdapter,
        makeConnection(),
        baseRequest({ schemaConfig: { ...schemaConfig, format: 'json-schema' } }),
      );

      const data = expectSuccess(result);
      expect(data.valueEncoding).toBe('json-schema');
    });

    it('passes raw string when value is not valid JSON', async () => {
      mockEncodeValue.mockResolvedValue(makeWireBuffer());
      const { runtimeAdapter } = createMockRuntimeAdapter();

      await executeProduce(
        runtimeAdapter,
        makeConnection(),
        baseRequest({
          schemaConfig,
          messages: [{ key: 'k1', value: 'not-json' }],
        }),
      );

      expect(mockEncodeValue).toHaveBeenCalledWith(schemaConfig, 'orders.created', 'not-json');
    });

    it('does not encode when schemaConfig is absent', async () => {
      const { runtimeAdapter } = createMockRuntimeAdapter();

      const result = await executeProduce(runtimeAdapter, makeConnection(), baseRequest());

      const data = expectSuccess(result);
      expect(data.valueEncoding).toBeUndefined();
      expect(mockEncodeValue).not.toHaveBeenCalled();
    });

    it('surfaces SchemaRegistryError with dedicated code', async () => {
      const { SchemaRegistryError, SCHEMA_ERROR_CODES } = await import('./schema-registry-client.js');
      mockEncodeValue.mockRejectedValue(
        new SchemaRegistryError(SCHEMA_ERROR_CODES.SCHEMA_NOT_FOUND, 'Schema not found'),
      );
      const { runtimeAdapter } = createMockRuntimeAdapter();

      const result = await executeProduce(
        runtimeAdapter,
        makeConnection(),
        baseRequest({ schemaConfig }),
      );

      expectError(result, SCHEMA_ERROR_CODES.SCHEMA_NOT_FOUND);
    });

    it('marks REGISTRY_UNREACHABLE as retryable', async () => {
      const { SchemaRegistryError, SCHEMA_ERROR_CODES } = await import('./schema-registry-client.js');
      mockEncodeValue.mockRejectedValue(
        new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE, 'Connection refused'),
      );
      const { runtimeAdapter } = createMockRuntimeAdapter();

      const result = await executeProduce(
        runtimeAdapter,
        makeConnection(),
        baseRequest({ schemaConfig }),
      );

      const err = expectError(result);
      expect(err.retryable).toBe(true);
    });
  });

  // ── multiple messages ─────────────────────────────────────────────────────

  it('handles multiple messages correctly', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();
    const messages = [
      { key: 'k1', value: '{"a":1}' },
      { key: 'k2', value: '{"b":2}' },
      { key: 'k3', value: '{"c":3}' },
    ];

    const result = await executeProduce(runtimeAdapter, makeConnection(), baseRequest({ messages }));

    const data = expectSuccess(result);
    expect(data.sentCount).toBe(3);
  });

  it('includes clusterId from connection in result', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();
    const conn = makeConnection({ clusterId: 'my-cluster' });

    const result = await executeProduce(runtimeAdapter, conn, baseRequest({ clusterId: 'my-cluster' }));

    const data = expectSuccess(result);
    expect(data.clusterId).toBe('my-cluster');
  });
});
