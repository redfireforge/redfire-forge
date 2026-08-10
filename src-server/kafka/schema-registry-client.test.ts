/**
 * Phase 10A — Unit tests for schema-registry-client.ts
 *
 * Uses mocked `fetch` (global) for admin operations (listSubjects, listVersions,
 * fetchSchema) and a mocked `@kafkajs/confluent-schema-registry` for encode/decode.
 * No live registry required for standard CI gate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaRegistry as SchemaRegistryMock } from '@kafkajs/confluent-schema-registry';
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
  registerSchemaVersion,
  listSubjectsWithFormat,
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
    resetAllMocks();
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

    it('does not cache the "latest" alias — re-fetches so a new version is visible', async () => {
      // First "latest" lookup resolves to version 3.
      mockFetch.mockResolvedValueOnce(okJson(rawLatest));
      const first = await fetchSchema(baseConfig, 'orders-value');
      expect(first.version).toBe(3);

      // A newer version 4 is registered; the next "latest" lookup must hit the
      // registry again (not return the stale cached version 3).
      mockFetch.mockResolvedValueOnce(okJson({ ...rawLatest, id: 43, version: 4 }));
      const second = await fetchSchema(baseConfig, 'orders-value');
      expect(second.version).toBe(4);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('still serves a concrete version from cache after a "latest" fetch', async () => {
      // "latest" resolves to version 3 and caches it under the concrete key.
      mockFetch.mockResolvedValueOnce(okJson(rawLatest));
      await fetchSchema(baseConfig, 'orders-value');
      // Requesting concrete version 3 reuses the cached entry — no new HTTP call.
      const concrete = await fetchSchema(baseConfig, 'orders-value', 3);
      expect(concrete.version).toBe(3);
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

    it('uses specific version schema ID when config.version is set', async () => {
      // When version is specified, encodeValue must look up that version's schema ID
      // via fetchSchema (HTTP), NOT call getLatestSchemaId.
      const cfg = { ...baseConfig, version: 2 };
      const encodedBuf = makeWireBuffer(7);
      mockFetch.mockResolvedValueOnce(
        okJson({ id: 7, version: 2, schema: '{"type":"record","name":"Order"}', schemaType: 'AVRO' }),
      );
      mockEncode.mockResolvedValueOnce(encodedBuf);

      const result = await encodeValue(cfg, 'orders', { id: 1 });

      // getLatestSchemaId must NOT be called — specific version was requested
      expect(mockGetLatestSchemaId).not.toHaveBeenCalled();
      // encode must be called with the schema ID returned for version 2 (id=7)
      expect(mockEncode).toHaveBeenCalledWith(7, { id: 1 });
      expect(result).toBe(encodedBuf);
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

    it('clears schema fetch cache so next fetchSchema makes a new HTTP call', async () => {
      const raw = { id: 1, version: 1, schema: '{"type":"string"}', schemaType: 'AVRO' };
      mockFetch.mockResolvedValue(okJson(raw));

      await fetchSchema(baseConfig, 'orders-value', 1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      clearSchemaCache();

      await fetchSchema(baseConfig, 'orders-value', 1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ── Coverage gap: non-JSON response body (line 111) ──────────────────────────

  describe('non-JSON response body', () => {
    it('throws REGISTRY_UNREACHABLE when registry returns non-JSON body', async () => {
      // Simulate a response where response.ok=true but body is not valid JSON
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
      } as unknown as Response);

      await expect(listSubjects(baseConfig)).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
        message: expect.stringContaining('non-JSON response'),
      });
    });
  });

  // ── Coverage gap: buildRegistryClient with auth (line 128) ───────────────────

  describe('buildRegistryClient with auth config', () => {
    it('passes auth credentials to SchemaRegistry constructor', async () => {
      const encodedBuf = makeWireBuffer(10);
      mockGetLatestSchemaId.mockResolvedValueOnce(10);
      mockEncode.mockResolvedValueOnce(encodedBuf);

      clearSchemaCache();
      await encodeValue(configWithAuth, 'orders', { id: 1 });

      // The SchemaRegistry constructor must have been called with clientOptions containing auth
      const ctorCalls = vi.mocked(SchemaRegistryMock).mock.calls;
      const lastCall = ctorCalls[ctorCalls.length - 1];
      // lastCall[0] is { host: ... }, lastCall[1] is clientOptions
      expect(lastCall[1]).toMatchObject({
        auth: { username: 'alice', password: 'secret' },
      });
    });
  });

  // ── Coverage gap: classifyRegistryError passthrough (line 139) and default (line 186) ──

  describe('classifyRegistryError coverage', () => {
    it('returns existing SchemaRegistryError unchanged when encode throws one (line 139)', async () => {
      const originalError = new SchemaRegistryError(SCHEMA_ERROR_CODES.SCHEMA_MISMATCH, 'already classified');
      mockGetLatestSchemaId.mockResolvedValueOnce(10);
      mockEncode.mockRejectedValueOnce(originalError);

      // The error should pass through classifyRegistryError unchanged
      const caught = await encodeValue(baseConfig, 'orders', {}).catch((e: unknown) => e);
      expect(caught).toBeInstanceOf(SchemaRegistryError);
      expect((caught as SchemaRegistryError).code).toBe(SCHEMA_ERROR_CODES.SCHEMA_MISMATCH);
      expect((caught as SchemaRegistryError).message).toBe('already classified');
    });

    it('defaults to REGISTRY_UNREACHABLE for unknown error messages (line 186)', async () => {
      mockGetLatestSchemaId.mockResolvedValueOnce(10);
      // Message does not match any keyword branch — falls through to default
      mockEncode.mockRejectedValueOnce(new Error('some completely unknown internal error xyz'));

      await expect(encodeValue(baseConfig, 'orders', {})).rejects.toMatchObject({
        code: SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
        message: expect.stringContaining('some completely unknown internal error xyz'),
      });
    });
  });

  // ── clearSchemaCache (original tests continue) ────────────────────────────

  describe('clearSchemaCache (instance cache)', () => {
    it('clears registry instance cache so next encode creates a fresh instance', async () => {
      const encodedBuf = makeWireBuffer(5);
      mockGetLatestSchemaId.mockResolvedValue(5);
      mockEncode.mockResolvedValue(encodedBuf);

      // First call — creates and caches an instance
      await encodeValue(baseConfig, 'orders', { id: 1 });
      const callsAfterFirst = (vi.mocked(SchemaRegistryMock)).mock.calls.length;

      // Second call — should reuse the cached instance (constructor not called again)
      await encodeValue(baseConfig, 'orders', { id: 2 });
      expect((vi.mocked(SchemaRegistryMock)).mock.calls.length).toBe(callsAfterFirst);

      clearSchemaCache();

      // After cache clear — fresh instance should be created
      await encodeValue(baseConfig, 'orders', { id: 3 });
      expect((vi.mocked(SchemaRegistryMock)).mock.calls.length).toBe(callsAfterFirst + 1);
    });

    it('creates a fresh instance when the password changes (not reused)', async () => {
      const encodedBuf = makeWireBuffer(5);
      mockGetLatestSchemaId.mockResolvedValue(5);
      mockEncode.mockResolvedValue(encodedBuf);

      const configA = { ...baseConfig, auth: { username: 'user', password: 'old-pw' } };
      const configB = { ...baseConfig, auth: { username: 'user', password: 'new-pw' } };

      await encodeValue(configA, 'orders', { id: 1 });
      const callsAfterFirst = (vi.mocked(SchemaRegistryMock)).mock.calls.length;

      // Same URL + username but a corrected password must NOT reuse the
      // previously-cached (wrong-credential) instance.
      await encodeValue(configB, 'orders', { id: 2 });
      expect((vi.mocked(SchemaRegistryMock)).mock.calls.length).toBe(callsAfterFirst + 1);
    });
  });

  // ── registryGet network error ──────────────────────────────────────────────
  describe('registryGet network error path (covered via listSubjects)', () => {
    it('throws SchemaRegistryError with REGISTRY_UNREACHABLE when fetch throws a non-Error', async () => {
      mockFetch.mockRejectedValueOnce('string-error');
      await expect(listSubjects(baseConfig)).rejects.toMatchObject({
        code: 'REGISTRY_UNREACHABLE',
      });
    });
  });

  // ── registryPost ──────────────────────────────────────────────────────────
  describe('registerSchemaVersion (exercises registryPost)', () => {
    it('returns id and version on success', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ id: 7, version: 3 }));
      const result = await registerSchemaVersion(baseConfig, 'orders-value', '{"type":"record","name":"X","fields":[]}');
      expect(result).toEqual({ id: 7, version: 3 });
    });

    it('throws on 401 auth failure', async () => {
      mockFetch.mockResolvedValueOnce(errResponse(401));
      await expect(
        registerSchemaVersion(baseConfig, 'orders-value', '{}'),
      ).rejects.toMatchObject({ code: 'REGISTRY_AUTH_FAILURE' });
    });

    it('throws on non-ok response (not auth)', async () => {
      mockFetch.mockResolvedValueOnce(errResponse(500));
      await expect(
        registerSchemaVersion(baseConfig, 'orders-value', '{}'),
      ).rejects.toMatchObject({ code: 'REGISTRY_UNREACHABLE' });
    });

    it('throws on network error (fetch throws)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(
        registerSchemaVersion(baseConfig, 'orders-value', '{}'),
      ).rejects.toMatchObject({ code: 'REGISTRY_UNREACHABLE' });
    });

    it('throws on non-JSON response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('bad json'); },
      } as unknown as Response);
      await expect(
        registerSchemaVersion(baseConfig, 'orders-value', '{}'),
      ).rejects.toMatchObject({ code: 'REGISTRY_UNREACHABLE' });
    });
  });

  // ── listSubjectsWithFormat ────────────────────────────────────────────────
  describe('listSubjectsWithFormat', () => {
    it('returns subjects with schemaType resolved from latest version', async () => {
      // First call: listSubjects
      mockFetch.mockResolvedValueOnce(okJson(['orders-value', 'payments-value']));
      // Second call: latest for orders-value → AVRO
      mockFetch.mockResolvedValueOnce(okJson({ schemaType: 'AVRO' }));
      // Third call: latest for payments-value → PROTOBUF
      mockFetch.mockResolvedValueOnce(okJson({ schemaType: 'PROTOBUF' }));

      const result = await listSubjectsWithFormat(baseConfig);
      expect(result).toEqual([
        { name: 'orders-value', schemaType: 'AVRO' },
        { name: 'payments-value', schemaType: 'PROTOBUF' },
      ]);
    });

    it('omits schemaType when fetching latest for a subject fails (rejection path)', async () => {
      // First call: listSubjects
      mockFetch.mockResolvedValueOnce(okJson(['orders-value', 'bad-subject']));
      // Second call: success for orders-value
      mockFetch.mockResolvedValueOnce(okJson({ schemaType: 'AVRO' }));
      // Third call: network error for bad-subject
      mockFetch.mockRejectedValueOnce(new Error('timeout'));

      const result = await listSubjectsWithFormat(baseConfig);
      expect(result[0]).toEqual({ name: 'orders-value', schemaType: 'AVRO' });
      // rejected subject: no schemaType
      expect(result[1]).toEqual({ name: 'bad-subject' });
    });

    it('falls back to AVRO when schemaType is absent in the latest response', async () => {
      mockFetch.mockResolvedValueOnce(okJson(['some-topic']));
      mockFetch.mockResolvedValueOnce(okJson({})); // no schemaType field
      const result = await listSubjectsWithFormat(baseConfig);
      expect(result[0]).toEqual({ name: 'some-topic', schemaType: 'AVRO' });
    });
  });
});

