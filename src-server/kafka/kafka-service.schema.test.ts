/**
 * KafkaService — Phase 10B Schema Registry Tests
 *
 * Tests the produce encode path and consume-once decode path added in Phase 10B.
 * `encodeValue` and `decodeValue` are mocked so no live registry is needed.
 *
 * Covered paths:
 *   - Produce with schemaConfig → encodeValue called, binary Buffer sent to Kafka, valueEncoding in result
 *   - Produce without schemaConfig → no encoding, no valueEncoding in result
 *   - Produce encode error → SchemaRegistryError code surfaced (not KAFKA_PRODUCE_FAILED)
 *   - Consume with schemaConfig + rawValue → decodeValue called, decoded JSON in record.value
 *   - Consume without schemaConfig → plain value returned, decodeValue not called
 *   - Consume with schemaConfig but rawValue absent → skip decode, plain value returned
 *   - Consume decode error → SchemaRegistryError code in error envelope
 *   - Consume REGISTRY_UNREACHABLE → retryable: true
 *   - REGISTRY_AUTH_FAILURE → retryable: false
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { KafkaService } from './kafka-service.js';
import { createMockRuntimeAdapter, makeConnection } from './kafka-service.test-utils.js';
import type { KafkaSchemaConfig } from './contracts.js';

// ── Mock schema-registry-client ───────────────────────────────────────────────
// vi.hoisted so these are available when vi.mock factory runs

const { mockEncodeValue, mockDecodeValue } = vi.hoisted(() => ({
  mockEncodeValue: vi.fn(),
  mockDecodeValue: vi.fn(),
}));

vi.mock('./schema-registry-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./schema-registry-client.js')>();
  return {
    ...actual,
    encodeValue: mockEncodeValue,
    decodeValue: mockDecodeValue,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const schemaConfig: KafkaSchemaConfig = {
  registryUrl: 'http://localhost:8081',
  format: 'avro',
};

/** Build a minimal Confluent wire-format buffer: 0x00 + 4-byte BE schema ID + payload */
function makeWireBuffer(schemaId = 42): Buffer {
  const buf = Buffer.allocUnsafe(9);
  buf.writeUInt8(0x00, 0);
  buf.writeInt32BE(schemaId, 1);
  buf.writeUInt32BE(0xcafebabe, 5); // payload bytes
  return buf;
}

async function connectService(): Promise<{ service: KafkaService; mock: ReturnType<typeof createMockRuntimeAdapter> }> {
  const mock = createMockRuntimeAdapter();
  const service = new KafkaService(mock.runtimeAdapter);
  await service.connect({ connection: makeConnection() });
  return { service, mock };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KafkaService — Phase 10B Schema Registry: Produce Encode', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('calls encodeValue and sends binary wire-format Buffer with valueEncoding avro', async () => {
    const { service, mock } = await connectService();
    const wireBytes = makeWireBuffer(10);
    mockEncodeValue.mockResolvedValueOnce(wireBytes);

    const result = await service.produce({
      topic: 'orders',
      messages: [{ value: '{"id":1}' }],
      schemaConfig,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.valueEncoding).toBe('avro');

    // encodeValue called with parsed JSON value, not raw string
    expect(mockEncodeValue).toHaveBeenCalledWith(schemaConfig, 'orders', { id: 1 });

    // producer.send called with raw wire-format Buffer (not base64 string)
    expect(mock.producer.send).toHaveBeenCalledWith(expect.objectContaining({
      messages: [expect.objectContaining({ value: wireBytes })],
    }));
  });

  it('sets valueEncoding protobuf for protobuf format', async () => {
    const { service } = await connectService();
    mockEncodeValue.mockResolvedValueOnce(makeWireBuffer(5));

    const result = await service.produce({
      topic: 'events',
      messages: [{ value: '{}' }],
      schemaConfig: { ...schemaConfig, format: 'protobuf' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.valueEncoding).toBe('protobuf');
  });

  it('sets valueEncoding json-schema for json-schema format', async () => {
    const { service } = await connectService();
    mockEncodeValue.mockResolvedValueOnce(makeWireBuffer(5));

    const result = await service.produce({
      topic: 'events',
      messages: [{ value: '{}' }],
      schemaConfig: { ...schemaConfig, format: 'json-schema' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.valueEncoding).toBe('json-schema');
  });

  it('passes non-JSON message value as-is to encodeValue', async () => {
    const { service } = await connectService();
    mockEncodeValue.mockResolvedValueOnce(makeWireBuffer(1));

    await service.produce({
      topic: 'raw',
      messages: [{ value: 'not-json-data' }],
      schemaConfig,
    });

    // JSON.parse fails → value passed as raw string
    expect(mockEncodeValue).toHaveBeenCalledWith(schemaConfig, 'raw', 'not-json-data');
  });

  it('encodes each message in a batch independently', async () => {
    const { service } = await connectService();
    mockEncodeValue.mockResolvedValue(makeWireBuffer(1));

    const result = await service.produce({
      topic: 'batch',
      messages: [{ value: '{"n":1}' }, { value: '{"n":2}' }, { value: '{"n":3}' }],
      schemaConfig,
    });

    expect(result.ok).toBe(true);
    expect(mockEncodeValue).toHaveBeenCalledTimes(3);
  });

  it('does NOT call encodeValue and omits valueEncoding when schemaConfig is absent', async () => {
    const { service, mock } = await connectService();

    const result = await service.produce({
      topic: 'orders',
      messages: [{ value: '{"id":1}' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.valueEncoding).toBeUndefined();
    expect(mockEncodeValue).not.toHaveBeenCalled();
    // raw string value sent through unchanged
    expect(mock.producer.send).toHaveBeenCalledWith(expect.objectContaining({
      messages: [expect.objectContaining({ value: '{"id":1}' })],
    }));
  });

  it('returns SCHEMA_MISMATCH error when encodeValue throws SchemaRegistryError', async () => {
    const { service } = await connectService();
    const { SchemaRegistryError, SCHEMA_ERROR_CODES } = await import('./schema-registry-client.js');
    mockEncodeValue.mockRejectedValueOnce(
      new SchemaRegistryError(SCHEMA_ERROR_CODES.SCHEMA_MISMATCH, 'schema mismatch: field x missing'),
    );

    const result = await service.produce({
      topic: 'orders',
      messages: [{ value: '{"bad":"data"}' }],
      schemaConfig,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('SCHEMA_MISMATCH');
    expect(result.error.retryable).toBe(false);
  });

  it('returns REGISTRY_UNREACHABLE with retryable:true when registry is down', async () => {
    const { service } = await connectService();
    const { SchemaRegistryError, SCHEMA_ERROR_CODES } = await import('./schema-registry-client.js');
    mockEncodeValue.mockRejectedValueOnce(
      new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE, 'connection refused'),
    );

    const result = await service.produce({
      topic: 'orders',
      messages: [{ value: '{}' }],
      schemaConfig,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('REGISTRY_UNREACHABLE');
    expect(result.error.retryable).toBe(true);
  });

  it('returns REGISTRY_AUTH_FAILURE with retryable:false when auth fails', async () => {
    const { service } = await connectService();
    const { SchemaRegistryError, SCHEMA_ERROR_CODES } = await import('./schema-registry-client.js');
    mockEncodeValue.mockRejectedValueOnce(
      new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_AUTH_FAILURE, '401 Unauthorized'),
    );

    const result = await service.produce({
      topic: 'orders',
      messages: [{ value: '{}' }],
      schemaConfig,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('REGISTRY_AUTH_FAILURE');
    expect(result.error.retryable).toBe(false);
  });
});

describe('KafkaService — Phase 10B Schema Registry: ConsumeOnce Decode', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('calls decodeValue using rawValue and puts decoded JSON in record.value', async () => {
    const rawBytes = makeWireBuffer(42);
    const mock = createMockRuntimeAdapter({
      consumeRecords: [{
        topic: 'orders',
        partition: 0,
        offset: '1',
        timestamp: '0',
        value: rawBytes.toString('utf8'), // UTF-8 version (may be garbage for Avro)
        rawValue: rawBytes,
      }],
    });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    mockDecodeValue.mockResolvedValueOnce({ orderId: 'o-1', amount: 42.5 });

    const result = await service.consumeOnce({ topic: 'orders', schemaConfig, timeoutMs: 500 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.messages).toHaveLength(1);
    // value is the JSON-stringified decoded result
    expect(result.data.messages[0].value).toBe(JSON.stringify({ orderId: 'o-1', amount: 42.5 }));
    // decodeValue was called with the raw Buffer, not the UTF-8 string
    expect(mockDecodeValue).toHaveBeenCalledWith(schemaConfig, rawBytes);
    // rawValue is NOT present in client-facing record (server-side only)
    expect('rawValue' in result.data.messages[0]).toBe(false);
  });

  it('does NOT call decodeValue when schemaConfig is absent', async () => {
    const mock = createMockRuntimeAdapter({
      consumeRecords: [{
        topic: 'orders',
        partition: 0,
        offset: '1',
        timestamp: '0',
        value: '{"plain":"json"}',
        rawValue: Buffer.from('{"plain":"json"}'),
      }],
    });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.consumeOnce({ topic: 'orders', timeoutMs: 500 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.messages[0].value).toBe('{"plain":"json"}');
    expect(mockDecodeValue).not.toHaveBeenCalled();
    // rawValue must NEVER leak into the client-facing record — it is a Buffer and
    // JSON.stringify would serialize it as {"type":"Buffer","data":[...]}.
    expect('rawValue' in result.data.messages[0]).toBe(false);
  });

  it('skips decodeValue and returns plain value when rawValue is absent', async () => {
    // rawValue is undefined when message.value was null at the adapter layer
    const mock = createMockRuntimeAdapter({
      consumeRecords: [{
        topic: 'orders',
        partition: 0,
        offset: '1',
        timestamp: '0',
        value: '',
        // no rawValue
      }],
    });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.consumeOnce({ topic: 'orders', schemaConfig, timeoutMs: 500 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.messages[0].value).toBe('');
    expect(mockDecodeValue).not.toHaveBeenCalled();
  });

  it('returns SCHEMA_MISMATCH error envelope when decodeValue throws', async () => {
    const rawBytes = makeWireBuffer(42);
    const mock = createMockRuntimeAdapter({
      consumeRecords: [{
        topic: 'orders',
        partition: 0,
        offset: '1',
        timestamp: '0',
        value: 'garbage',
        rawValue: rawBytes,
      }],
    });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const { SchemaRegistryError, SCHEMA_ERROR_CODES } = await import('./schema-registry-client.js');
    mockDecodeValue.mockRejectedValueOnce(
      new SchemaRegistryError(SCHEMA_ERROR_CODES.SCHEMA_MISMATCH, 'bad magic byte'),
    );

    const result = await service.consumeOnce({ topic: 'orders', schemaConfig, timeoutMs: 500 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('SCHEMA_MISMATCH');
    expect(result.error.retryable).toBe(false);
  });

  it('returns REGISTRY_UNREACHABLE with retryable:true when decode fails due to connectivity', async () => {
    const rawBytes = makeWireBuffer(42);
    const mock = createMockRuntimeAdapter({
      consumeRecords: [{
        topic: 'orders',
        partition: 0,
        offset: '1',
        timestamp: '0',
        value: 'wire',
        rawValue: rawBytes,
      }],
    });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const { SchemaRegistryError, SCHEMA_ERROR_CODES } = await import('./schema-registry-client.js');
    mockDecodeValue.mockRejectedValueOnce(
      new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE, 'econnrefused'),
    );

    const result = await service.consumeOnce({ topic: 'orders', schemaConfig, timeoutMs: 500 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('REGISTRY_UNREACHABLE');
    expect(result.error.retryable).toBe(true);
  });

  it('returns REGISTRY_AUTH_FAILURE with retryable:false on auth error during decode', async () => {
    const rawBytes = makeWireBuffer(42);
    const mock = createMockRuntimeAdapter({
      consumeRecords: [{
        topic: 'orders',
        partition: 0,
        offset: '1',
        timestamp: '0',
        value: 'wire',
        rawValue: rawBytes,
      }],
    });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const { SchemaRegistryError, SCHEMA_ERROR_CODES } = await import('./schema-registry-client.js');
    mockDecodeValue.mockRejectedValueOnce(
      new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_AUTH_FAILURE, '403 Forbidden'),
    );

    const result = await service.consumeOnce({ topic: 'orders', schemaConfig, timeoutMs: 500 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('REGISTRY_AUTH_FAILURE');
    expect(result.error.retryable).toBe(false);
  });

  it('preserves all other record fields (topic, partition, offset, key, headers) after decode', async () => {
    const rawBytes = makeWireBuffer(42);
    const mock = createMockRuntimeAdapter({
      consumeRecords: [{
        topic: 'orders',
        partition: 2,
        offset: '99',
        timestamp: '1712345678000',
        key: 'order-key',
        value: 'wire',
        headers: { traceId: 'trace-abc' },
        rawValue: rawBytes,
      }],
    });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    mockDecodeValue.mockResolvedValueOnce({ decoded: true });

    const result = await service.consumeOnce({ topic: 'orders', schemaConfig, timeoutMs: 500 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    const rec = result.data.messages[0];
    expect(rec.topic).toBe('orders');
    expect(rec.partition).toBe(2);
    expect(rec.offset).toBe('99');
    expect(rec.timestamp).toBe('1712345678000');
    expect(rec.key).toBe('order-key');
    expect(rec.headers).toEqual({ traceId: 'trace-abc' });
    expect(rec.value).toBe(JSON.stringify({ decoded: true }));
  });
});
