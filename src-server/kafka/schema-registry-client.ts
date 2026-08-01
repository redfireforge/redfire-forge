/**
 * Phase 10 — Schema Registry client wrapper.
 *
 * Wraps `@kafkajs/confluent-schema-registry` to provide:
 *   - Subject listing (`listSubjects`) via direct HTTP GET
 *   - Version listing (`listVersions`) via direct HTTP GET
 *   - Schema fetching (`fetchSchema`) via direct HTTP GET + in-process cache
 *   - Avro encode helpers using the library's encode/decode APIs
 *   - Schema cache keyed by schema ID (avoids per-produce/consume HTTP calls)
 *
 * Admin operations (subjects/versions/fetch) use Node.js's built-in `fetch` with
 * Basic-auth header constructed from `schemaConfig.auth` — never from query params
 * (OWASP A02 — credentials must travel in the request body or headers only).
 *
 * Encode/decode operations use the `@kafkajs/confluent-schema-registry` library.
 *
 * Out-of-scope for Phase 10:
 *   - Protobuf / JSON Schema encode/decode (Avro only in initial phase).
 *   - Subscribe-path schema decode (consume-once only).
 *   - Key encoding (value only).
 */

import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import type { KafkaSchemaConfig, KafkaSchemaFetchResult } from './contracts.js';

// ── Error codes ────────────────────────────────────────────────────────────────

export const SCHEMA_ERROR_CODES = {
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  REGISTRY_UNREACHABLE: 'REGISTRY_UNREACHABLE',
  REGISTRY_AUTH_FAILURE: 'REGISTRY_AUTH_FAILURE',
} as const;

export type SchemaErrorCode = (typeof SCHEMA_ERROR_CODES)[keyof typeof SCHEMA_ERROR_CODES];

export class SchemaRegistryError extends Error {
  readonly code: SchemaErrorCode;
  constructor(code: SchemaErrorCode, message: string) {
    super(message);
    this.name = 'SchemaRegistryError';
    this.code = code;
  }
}

// ── Schema cache ───────────────────────────────────────────────────────────────

// Keyed by "<subject>/<version>" for fetchSchema lookups
const subjectVersionCache = new Map<string, KafkaSchemaFetchResult>();

/**
 * Cache of `SchemaRegistry` instances keyed by registry URL + credentials.
 * Reusing instances lets the library's internal schema-ID cache carry over
 * across multiple encode/decode calls, avoiding repeated HTTP round-trips to
 * the registry for the same schema ID.
 *
 * The password is part of the key so that correcting previously-wrong
 * credentials produces a fresh instance instead of reusing the failed one.
 */
const registryInstanceCache = new Map<string, SchemaRegistry>();

function registryInstanceKey(config: KafkaSchemaConfig): string {
  return `${config.registryUrl}|${config.auth?.username ?? ''}|${config.auth?.password ?? ''}`;
}

function subjectVersionKey(subject: string, version: number): string {
  return `${subject}/${version}`;
}

// ── HTTP helpers for admin operations ─────────────────────────────────────────

function buildAuthHeader(config: KafkaSchemaConfig): Record<string, string> {
  if (!config.auth) {
    return {};
  }
  const encoded = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
  return { Authorization: `Basic ${encoded}` };
}

async function registryGet<T>(
  config: KafkaSchemaConfig,
  path: string,
  timeoutMs = 10_000,
): Promise<T> {
  const url = `${config.registryUrl.replace(/\/$/, '')}${path}`;
  const headers = { Accept: 'application/json', ...buildAuthHeader(config) };

  let response: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);
  } catch (networkError) {
    const message = networkError instanceof Error ? networkError.message : String(networkError);
    throw new SchemaRegistryError(
      SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      `Schema registry unreachable: ${message}`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new SchemaRegistryError(
      SCHEMA_ERROR_CODES.REGISTRY_AUTH_FAILURE,
      `Schema registry auth failure: HTTP ${response.status}`,
    );
  }

  if (!response.ok) {
    throw new SchemaRegistryError(
      SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      `Schema registry returned HTTP ${response.status} for ${path}`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new SchemaRegistryError(
      SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      `Schema registry returned non-JSON response for ${path}`,
    );
  }
}

async function registryPost<T>(
  config: KafkaSchemaConfig,
  path: string,
  payload: unknown,
): Promise<T> {
  const url = `${config.registryUrl.replace(/\/$/, '')}${path}`;
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/vnd.schemaregistry.v1+json',
    ...buildAuthHeader(config),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    const message = networkError instanceof Error ? networkError.message : String(networkError);
    throw new SchemaRegistryError(
      SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      `Schema registry unreachable: ${message}`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new SchemaRegistryError(
      SCHEMA_ERROR_CODES.REGISTRY_AUTH_FAILURE,
      `Schema registry auth failure: HTTP ${response.status}`,
    );
  }

  if (!response.ok) {
    throw new SchemaRegistryError(
      SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      `Schema registry returned HTTP ${response.status} for ${path}`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new SchemaRegistryError(
      SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
      `Schema registry returned non-JSON response for ${path}`,
    );
  }
}

// ── Build encode/decode registry client ───────────────────────────────────────

function buildRegistryClient(config: KafkaSchemaConfig): SchemaRegistry {
  const key = registryInstanceKey(config);
  const cached = registryInstanceCache.get(key);
  if (cached) {
    return cached;
  }
  const clientOptions: Record<string, unknown> = {};
  if (config.auth) {
    clientOptions['auth'] = { username: config.auth.username, password: config.auth.password };
  }
  const instance = new SchemaRegistry({ host: config.registryUrl }, clientOptions);
  registryInstanceCache.set(key, instance);
  return instance;
}

// ── Classify raw errors for encode/decode paths ────────────────────────────────

function classifyRegistryError(error: unknown): SchemaRegistryError {
  if (error instanceof SchemaRegistryError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  const normalised = message.toLowerCase();

  if (
    normalised.includes('401') ||
    normalised.includes('403') ||
    normalised.includes('unauthorized') ||
    normalised.includes('forbidden') ||
    normalised.includes('authentication')
  ) {
    return new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_AUTH_FAILURE, `Schema registry auth failure: ${message}`);
  }

  if (
    normalised.includes('econnrefused') ||
    normalised.includes('enotfound') ||
    normalised.includes('failed to fetch') ||
    normalised.includes('network') ||
    normalised.includes('timeout') ||
    normalised.includes('getaddrinfo')
  ) {
    return new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE, `Schema registry unreachable: ${message}`);
  }

  if (
    normalised.includes('connection refused') ||
    normalised.includes('connection reset') ||
    normalised.includes('socket hang up')
  ) {
    return new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE, `Schema registry unreachable: ${message}`);
  }

  if (
    normalised.includes('schema mismatch') ||
    normalised.includes('incompatible') ||
    normalised.includes('invalid payload') ||
    normalised.includes('avro decode') ||
    normalised.includes('avro encode') ||
    normalised.includes('serializ') ||
    normalised.includes('deserializ') ||
    /invalid "[a-z]+"/.test(normalised)
  ) {
    return new SchemaRegistryError(SCHEMA_ERROR_CODES.SCHEMA_MISMATCH, `Schema mismatch: ${message}`);
  }

  // Default to unreachable for unknown errors (most likely connectivity issues)
  return new SchemaRegistryError(SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE, `Schema registry error: ${message}`);
}

// ── Exported API ───────────────────────────────────────────────────────────────

/**
 * List all subjects registered in the schema registry.
 * Throws `SchemaRegistryError` on connectivity or auth failures.
 */
export async function listSubjects(config: KafkaSchemaConfig): Promise<string[]> {
  const result = await registryGet<string[]>(config, '/subjects');
  return Array.isArray(result) ? result : [];
}

export interface SubjectWithFormat {
  name: string;
  schemaType?: string;
}

/**
 * List all subjects with their schema format (fetched from latest version).
 * Best-effort: if fetching a subject's latest schema fails, format is omitted.
 * Uses a short per-subject timeout (5s) so a slow registry doesn't block indefinitely.
 */
export async function listSubjectsWithFormat(config: KafkaSchemaConfig): Promise<SubjectWithFormat[]> {
  const names = await listSubjects(config);
  const results = await Promise.allSettled(
    names.map(async (name): Promise<SubjectWithFormat> => {
      const encoded = encodeURIComponent(name);
      interface LatestResponse { schemaType?: string }
      const raw = await registryGet<LatestResponse>(config, `/subjects/${encoded}/versions/latest`, 5_000);
      return { name, schemaType: raw.schemaType ?? 'AVRO' };
    }),
  );
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { name: names[i] },
  );
}

/**
 * List all schema versions for a subject.
 * Throws `SchemaRegistryError` on connectivity or auth failures.
 */
export async function listVersions(config: KafkaSchemaConfig, subject: string): Promise<number[]> {
  const encoded = encodeURIComponent(subject);
  const result = await registryGet<number[]>(config, `/subjects/${encoded}/versions`);
  return Array.isArray(result) ? result : [];
}

/**
 * Fetch the schema definition for a subject and version.
 * Caches the result by subject/version to avoid repeated HTTP calls.
 * When `version` is absent, the latest version is fetched via `/versions/latest`.
 *
 * Throws `SchemaRegistryError` on connectivity, auth, or not-found failures.
 */
export async function fetchSchema(
  config: KafkaSchemaConfig,
  subject: string,
  version?: number,
): Promise<KafkaSchemaFetchResult> {
  const encoded = encodeURIComponent(subject);
  const versionPath = version != null ? String(version) : 'latest';

  // Only concrete versions are cacheable — registered schema versions are
  // immutable. The "latest" alias must never be cached because the latest
  // pointer moves when a new version is registered; caching it would pin a
  // stale schema until the process restarts.
  if (version != null) {
    const cached = subjectVersionCache.get(subjectVersionKey(subject, version));
    if (cached) {
      return cached;
    }
  }

  interface RegistryVersionResponse {
    id: number;
    version: number;
    schema: string;
    schemaType?: string;
  }

  const raw = await registryGet<RegistryVersionResponse>(
    config,
    `/subjects/${encoded}/versions/${versionPath}`,
  );

  const result: KafkaSchemaFetchResult = {
    subject,
    version: raw.version,
    id: raw.id,
    schema: raw.schema,
    schemaType: raw.schemaType ?? 'AVRO',
  };

  // Cache by the concrete version resolved from the response (immutable).
  subjectVersionCache.set(subjectVersionKey(subject, raw.version), result);
  return result;
}

/**
 * Register a schema under a subject.
 * Returns the registered schema ID and (when provided by the registry) version.
 */
export async function registerSchemaVersion(
  config: KafkaSchemaConfig,
  subject: string,
  schema: string,
  schemaType: 'AVRO' | 'PROTOBUF' | 'JSON' = 'AVRO',
): Promise<{ id: number; version?: number }> {
  const encoded = encodeURIComponent(subject);
  const payload = { schema, schemaType };
  const result = await registryPost<{ id: number; version?: number }>(
    config,
    `/subjects/${encoded}/versions`,
    payload,
  );
  return result;
}

/**
 * Encode a plain-JS value to Avro binary bytes using the schema registry.
 * The result is a `Buffer` containing the Confluent wire-format bytes
 * (magic byte 0x00 + 4-byte schema ID + Avro payload).
 *
 * The effective subject is resolved as:
 *   `config.subject ?? `${topic}-value`` (TopicNameStrategy default)
 *
 * Throws `SchemaRegistryError` on schema mismatch, auth failure, or
 * registry connectivity issues.
 */
export async function encodeValue(
  config: KafkaSchemaConfig,
  topic: string,
  value: unknown,
): Promise<Buffer> {
  const subject = resolveSubject(config, topic);
  try {
    const registry = buildRegistryClient(config);
    // When a specific version is requested, look up that version's schema ID
    // via the registry HTTP API (result is cached by fetchSchema's in-process cache).
    // When absent, use the latest schema ID (most common case).
    let schemaId: number;
    if (config.version != null) {
      const fetched = await fetchSchema(config, subject, config.version);
      schemaId = fetched.id;
    } else {
      schemaId = await registry.getLatestSchemaId(subject);
    }
    const encoded = await registry.encode(schemaId, value);
    return encoded;
  } catch (error) {
    throw classifyRegistryError(error);
  }
}

/**
 * Decode Avro binary bytes (Confluent wire-format) to a plain-JS value.
 * The schema ID is extracted from the wire bytes and used for decoding.
 * Caches the decoded schema object by ID.
 *
 * Throws `SchemaRegistryError` on schema mismatch, auth failure, or
 * registry connectivity issues.
 */
export async function decodeValue(
  config: KafkaSchemaConfig,
  rawBytes: Buffer,
): Promise<unknown> {
  // Validate magic byte — Confluent wire format starts with 0x00
  if (rawBytes.length < 5 || rawBytes[0] !== 0x00) {
    throw new SchemaRegistryError(
      SCHEMA_ERROR_CODES.SCHEMA_MISMATCH,
      'Invalid Confluent wire-format: missing magic byte 0x00 or payload too short',
    );
  }

  try {
    const registry = buildRegistryClient(config);
    const decoded = await registry.decode(rawBytes);
    return decoded;
  } catch (error) {
    throw classifyRegistryError(error);
  }
}

/**
 * Derive the effective subject name from the topic using TopicNameStrategy.
 * `config.subject` always takes priority over the derived subject.
 */
export function resolveSubject(config: KafkaSchemaConfig, topic: string): string {
  return config.subject ?? `${topic}-value`;
}

/**
 * Map `config.format` to the `SchemaType` enum used by the registry library.
 */
export function toSchemaType(format: KafkaSchemaConfig['format']): SchemaType {
  switch (format) {
    case 'protobuf':    return SchemaType.PROTOBUF;
    case 'json-schema': return SchemaType.JSON;
    default:            return SchemaType.AVRO;
  }
}

/**
 * Clear all in-process caches (subject/version cache and registry instance cache).
 * Exposed for use in tests only.
 */
export function clearSchemaCache(): void {
  subjectVersionCache.clear();
  registryInstanceCache.clear();
}

