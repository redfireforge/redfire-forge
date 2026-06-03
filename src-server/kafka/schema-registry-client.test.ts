/**
 * Phase 10A — Unit tests for schema-registry-client.ts
 *
 * Uses mocked `fetch` (global) for admin operations (listSubjects, listVersions,
 * fetchSchema) and a mocked `@kafkajs/confluent-schema-registry` for encode/decode.
 * No live registry required for standard CI gate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listSubjects,
  listVersions,
  fetchSchema,
  encodeValue,
  decodeValue,
  resolveSubject,
  toSchemaType,
  clearSchemaCache,
  SchemaRegistryError,
  SCHEMA_ERROR_CODES,
} from './schema-registry-client';
import type { KafkaSchemaConfig } from './contracts';

// ── Mock @kafkajs/confluent-schema-registry (encode/decode paths) ──────────────
// vi.hoisted ensures these are available when vi.mock factories run (hoisting order)
const { mockGetLatestSchemaId, mockEncode, mockDecode } = vi.hoisted(() => ({
  mockGetLatestSchemaId: vi.fn(),
  mockEncode: vi.fn(),
  mockDecode: vi.fn(),
}));

vi.mock('@kafkajs/confluent-schema-registry', () => ({
  // Use a regular function (not arrow) so it can be called with `new`
  SchemaRegistry: vi.fn(function () {
    return {
      getLatestSchemaId: mockGetLatestSchemaId,
      encode: mockEncode,
      decode: mockDecode,
    };
  }),
  SchemaType: {
    AVRO: 'AVRO',
    PROTOBUF: 'PROTOBUF',
    JSON: 'JSON',
  },
}));

// ── Mock global fetch (admin HTTP operations) ──────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Build a successful JSON response mock */
function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

/** Build an error response mock */
function errResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({ error_code: status, message: `HTTP ${status}` }),
  } as unknown as Response;
}

// ── Test fixtures ──────────────────────────────────────────────────────────────

const baseConfig: KafkaSchemaConfig = {
  registryUrl: 'http://localhost:8081',
  format: 'avro',
};

const configWithAuth: KafkaSchemaConfig = {
  ...baseConfig,
  auth: { username: 'alice', password: 'secret' },
};

/** Build a Confluent wire-format Buffer: 0x00 + 4-byte BE schema ID + payload */
function makeWireBuffer(schemaId: number, payload: Buffer = Buffer.from([0x06, 0x62, 0x6f, 0x62])): Buffer {
  const buf = Buffer.allocUnsafe(5 + payload.length);
  buf.writeUInt8(0x00, 0);
  buf.writeInt32BE(schemaId, 1);
  payload.copy(buf, 5);
  return buf;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('schema-registry-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSchemaCache();
  });

  // ── resolveSubject ──────────────────────────────────────────────────────────

  describe('resolveSubject', () => {
    it('returns topic-value when config.subject is absent', () => {
      expect(resolveSubject(baseConfig, 'orders')).toBe('orders-value');
    });

    it('returns config.subject when present', () => {
      const cfg = { ...baseConfig, subject: 'custom-subject' };
      expect(resolveSubject(cfg, 'orders')).toBe('custom-subject');
    });
  });

  // ── toSchemaType ────────────────────────────────────────────────────────────

  describe('toSchemaType', () => {
    it('maps avro → AVRO', () => {
      expect(toSchemaType('avro')).toBe('AVRO');
    });

    it('maps protobuf → PROTOBUF', () => {
      expect(toSchemaType('protobuf')).toBe('PROTOBUF');
    });

    it('maps json-schema → JSON', () => {
      expect(toSchemaType('json-schema')).toBe('JSON');
    });
  });

  // ── listSubjects ───────────────────────────────────────────────────────────

  describe('listSubjects', () => {
    it('returns subjects from registry', async () => {
      mockFetch.mockResolvedValueOnce(okJson(['orders-value', 'payments-value']));
      const subjects = await listSubjects(baseConfig);
      expect(subjects).toEqual(['orders-value', 'payments-value']);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8081/subjects',
        expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
      );
    });

    it('returns empty array when registry returns non-array', async () => {
      mockFetch.mockResolvedValueOnce(okJson(null));
      const subjects = await listSubjects(baseConfig);
      expect(subjects).toEqual([]);
    });

    it('throws REGISTRY_UNREACHABLE on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(listSubjects(baseConfig)).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      });
    });

    it('throws REGISTRY_AUTH_FAILURE on 401 response', async () => {
      mockFetch.mockResolvedValueOnce(errResponse(401));
      await expect(listSubjects(baseConfig)).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.REGISTRY_AUTH_FAILURE,
      });
    });

    it('throws REGISTRY_AUTH_FAILURE on 403 response', async () => {
      mockFetch.mockResolvedValueOnce(errResponse(403));
      await expect(listSubjects(baseConfig)).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.REGISTRY_AUTH_FAILURE,
      });
    });

    it('sends Authorization header when auth is present', async () => {
      mockFetch.mockResolvedValueOnce(okJson(['t-value']));
      await listSubjects(configWithAuth);
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toMatch(/^Basic /);
    });
  });

  // ── listVersions ───────────────────────────────────────────────────────────

  describe('listVersions', () => {
    it('returns versions from registry', async () => {
      mockFetch.mockResolvedValueOnce(okJson([1, 2, 3]));
      const versions = await listVersions(baseConfig, 'orders-value');
      expect(versions).toEqual([1, 2, 3]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/subjects/orders-value/versions'),
        expect.anything(),
      );
    });

    it('URL-encodes the subject name', async () => {
      mockFetch.mockResolvedValueOnce(okJson([1]));
      await listVersions(baseConfig, 'my topic/v1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('my%20topic%2Fv1'),
        expect.anything(),
      );
    });

    it('returns empty array when registry returns non-array', async () => {
      mockFetch.mockResolvedValueOnce(okJson(undefined));
      const versions = await listVersions(baseConfig, 'orders-value');
      expect(versions).toEqual([]);
    });

    it('throws REGISTRY_UNREACHABLE on connection error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND registry'));
      await expect(listVersions(baseConfig, 'orders-value')).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      });
    });
  });

  // ── fetchSchema ────────────────────────────────────────────────────────────

  describe('fetchSchema', () => {
    const rawLatest = { id: 42, version: 3, schema: '{"type":"record","name":"Order"}', schemaType: 'AVRO' };

    it('fetches latest version when version is absent', async () => {
      mockFetch.mockResolvedValueOnce(okJson(rawLatest));
      const result = await fetchSchema(baseConfig, 'orders-value');
      expect(result).toEqual({
        subject: 'orders-value',
        version: 3,
        id: 42,
        schema: '{"type":"record","name":"Order"}',
        schemaType: 'AVRO',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/versions/latest'),
        expect.anything(),
      );
    });

    it('fetches specific version when version is provided', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ ...rawLatest, version: 2 }));
      const result = await fetchSchema(baseConfig, 'orders-value', 2);
      expect(result.version).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/versions/2'),
        expect.anything(),
      );
    });

    it('defaults schemaType to AVRO when absent in response', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ id: 1, version: 1, schema: '{}' }));
      const result = await fetchSchema(baseConfig, 'orders-value');
      expect(result.schemaType).toBe('AVRO');
    });

    it('uses cache on second call for same subject/version', async () => {
      mockFetch.mockResolvedValueOnce(okJson(rawLatest));
      await fetchSchema(baseConfig, 'orders-value', 3);
      await fetchSchema(baseConfig, 'orders-value', 3);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws REGISTRY_UNREACHABLE on connectivity error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network timeout'));
      await expect(fetchSchema(baseConfig, 'orders-value')).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      });
    });
  });

  // ── encodeValue ────────────────────────────────────────────────────────────

  describe('encodeValue', () => {
    it('encodes using topic-value subject by default', async () => {
      const encodedBuf = makeWireBuffer(10);
      mockGetLatestSchemaId.mockResolvedValueOnce(10);
      mockEncode.mockResolvedValueOnce(encodedBuf);

      const result = await encodeValue(baseConfig, 'orders', { id: 1 });
      expect(mockGetLatestSchemaId).toHaveBeenCalledWith('orders-value');
      expect(mockEncode).toHaveBeenCalledWith(10, { id: 1 });
      expect(result).toBe(encodedBuf);
    });

    it('uses explicit subject override from config', async () => {
      const cfg = { ...baseConfig, subject: 'my-custom-subject' };
      const encodedBuf = makeWireBuffer(20);
      mockGetLatestSchemaId.mockResolvedValueOnce(20);
      mockEncode.mockResolvedValueOnce(encodedBuf);

      await encodeValue(cfg, 'orders', { id: 2 });
      expect(mockGetLatestSchemaId).toHaveBeenCalledWith('my-custom-subject');
    });

    it('throws SCHEMA_MISMATCH on schema encode error', async () => {
      mockGetLatestSchemaId.mockResolvedValueOnce(10);
      mockEncode.mockRejectedValueOnce(new Error('schema mismatch: field missing'));
      await expect(encodeValue(baseConfig, 'orders', { id: 1 })).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.SCHEMA_MISMATCH,
      });
    });

    it('throws REGISTRY_AUTH_FAILURE on 403 error', async () => {
      mockGetLatestSchemaId.mockRejectedValueOnce(new Error('403 Forbidden'));
      await expect(encodeValue(baseConfig, 'orders', {})).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.REGISTRY_AUTH_FAILURE,
      });
    });

    it('throws REGISTRY_UNREACHABLE on connection refused', async () => {
      mockGetLatestSchemaId.mockRejectedValueOnce(new Error('connection refused'));
      await expect(encodeValue(baseConfig, 'orders', {})).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      });
    });
  });

  // ── decodeValue ────────────────────────────────────────────────────────────

  describe('decodeValue', () => {
    it('decodes valid Confluent wire-format bytes', async () => {
      const wireBytes = makeWireBuffer(42);
      mockDecode.mockResolvedValueOnce({ id: 'order-1', amount: 99.5 });

      const result = await decodeValue(baseConfig, wireBytes);
      expect(mockDecode).toHaveBeenCalledWith(wireBytes);
      expect(result).toEqual({ id: 'order-1', amount: 99.5 });
    });

    it('throws SCHEMA_MISMATCH when magic byte is missing (starts with non-zero)', async () => {
      const invalidBuf = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
      await expect(decodeValue(baseConfig, invalidBuf)).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.SCHEMA_MISMATCH,
        message: expect.stringContaining('magic byte'),
      });
    });

    it('throws SCHEMA_MISMATCH when buffer is too short', async () => {
      const tooShort = Buffer.from([0x00, 0x00, 0x01]);
      await expect(decodeValue(baseConfig, tooShort)).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.SCHEMA_MISMATCH,
      });
    });

    it('throws SCHEMA_MISMATCH on decode error', async () => {
      const wireBytes = makeWireBuffer(42);
      mockDecode.mockRejectedValueOnce(new Error('invalid payload: decode failed'));
      await expect(decodeValue(baseConfig, wireBytes)).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.SCHEMA_MISMATCH,
      });
    });

    it('throws REGISTRY_UNREACHABLE on connection refused during decode', async () => {
      const wireBytes = makeWireBuffer(42);
      mockDecode.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(decodeValue(baseConfig, wireBytes)).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      });
    });
  });

  // ── SchemaRegistryError ────────────────────────────────────────────────────

  describe('SchemaRegistryError', () => {
    it('has correct name and code', () => {
      const err = new SchemaRegistryError(SCHEMA_ERROR_CODES.SCHEMA_MISMATCH, 'test');
      expect(err.name).toBe('SchemaRegistryError');
      expect(err.code).toBe(SCHEMA_ERROR_CODES.SCHEMA_MISMATCH);
      expect(err.message).toBe('test');
      expect(err).toBeInstanceOf(Error);
    });

    it('code REGISTRY_UNREACHABLE', () => {
      const err = new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE, 'down');
      expect(err.code).toBe('REGISTRY_UNREACHABLE');
    });

    it('code REGISTRY_AUTH_FAILURE', () => {
      const err = new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_AUTH_FAILURE, 'denied');
      expect(err.code).toBe('REGISTRY_AUTH_FAILURE');
    });
  });

  // ── clearSchemaCache ───────────────────────────────────────────────────────

  describe('clearSchemaCache', () => {
    it('clears without throwing', () => {
      expect(() => clearSchemaCache()).not.toThrow();
    });
  });
});

