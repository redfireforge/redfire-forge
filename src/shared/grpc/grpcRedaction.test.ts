/**
 * Phase 4A — redaction vectors shared across consumers.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import {
  GRPC_REDACTED_PLACEHOLDER,
  createSanitizedGrpcErrorEnvelope,
  redactAuthorizationHeader,
  redactGrpcAuthConfig,
  redactGrpcCallRequestForExport,
  redactGrpcCallResultForDisplay,
  redactGrpcCallResultForExport,
  redactGrpcErrorBody,
  redactGrpcExecuteSnapshotForExport,
  redactGrpcProtoIngestState,
  redactGrpcStudioPayloadForConsumer,
  redactGrpcTlsConfig,
  prepareGrpcCallHistoryRecord,
  sanitizeGrpcErrorMessage,
} from './grpcRedaction';
import { GRPC_ERROR_CODES } from './contracts';
import { GRPC_SECRET_FIELD_PATHS, isGrpcSecretFieldPath } from './grpcSecretPolicy';

const VALID_PEM = `-----BEGIN CERTIFICATE-----
SECRETDATA
-----END CERTIFICATE-----`;

describe('grpcRedaction (Phase 4A)', () => {
  it('classifies secret field paths', () => {
    expect(isGrpcSecretFieldPath('auth.bearerToken')).toBe(true);
    expect(isGrpcSecretFieldPath('service')).toBe(false);
    expect(GRPC_SECRET_FIELD_PATHS.length).toBeGreaterThanOrEqual(8);
  });

  it('redacts auth and tls configs for export', () => {
    expect(redactGrpcAuthConfig({
      type: 'bearer',
      bearerToken: 'top-secret',
    })).toEqual({
      type: 'bearer',
      bearerToken: GRPC_REDACTED_PLACEHOLDER,
    });

    expect(redactGrpcTlsConfig({
      serverCaPem: VALID_PEM,
      clientKeyPem: VALID_PEM,
    })).toEqual({
      serverCaPem: '[REDACTED_PEM]',
      clientCertPem: undefined,
      clientKeyPem: '[REDACTED_PEM]',
      serverNameOverride: undefined,
    });
  });

  it('masks authorization headers for display', () => {
    expect(redactAuthorizationHeader('Bearer abcdefghijklmnop')).toBe('Bearer abcd…mnop');
    expect(redactAuthorizationHeader('Basic abcdef==')).toBe('Basic ••••');
  });

  it('sanitizes error messages that accidentally embed secrets', () => {
    const sanitized = sanitizeGrpcErrorMessage(
      `Handshake failed with Bearer abcdefghijklmnop and ${VALID_PEM}`,
    );
    expect(sanitized).not.toContain('SECRETDATA');
    expect(sanitized).not.toContain('abcdefghijklmnop');
    expect(sanitized).toContain('[REDACTED_PEM]');
  });

  it('redacts unary call requests for export bundles', () => {
    const redacted = redactGrpcCallRequestForExport({
      ...FIXTURE_UNARY_CALL_REQUEST,
      auth: { type: 'bearer', bearerToken: 'export-secret' },
      metadata: { authorization: 'Bearer export-secret' },
      target: {
        ...FIXTURE_UNARY_CALL_REQUEST.target,
        tlsConfig: { serverCaPem: VALID_PEM },
      },
    });
    expect(redacted.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(redacted.target.tlsConfig?.serverCaPem).toBe('[REDACTED_PEM]');
    expect(redacted.metadata?.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('fully redacts custom api key header names that do not match secret heuristics', () => {
    const redacted = redactGrpcCallRequestForExport({
      ...FIXTURE_UNARY_CALL_REQUEST,
      auth: { type: 'api_key', apiKeyName: 'x-tenant-id', apiKeyValue: 'secret-value' },
      metadata: { 'x-tenant-id': 'secret-value' },
    });
    expect(redacted.metadata?.['x-tenant-id']).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(redacted.auth?.apiKeyValue).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('redacts auth-panel api key headers when metadata uses mixed casing', () => {
    const redacted = redactGrpcCallRequestForExport({
      ...FIXTURE_UNARY_CALL_REQUEST,
      auth: { type: 'api_key', apiKeyName: 'X-Tenant-Id', apiKeyValue: 'secret-value' },
      metadata: { 'X-Tenant-Id': 'secret-value' },
    });
    expect(redacted.metadata?.['x-tenant-id']).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('fully redacts api key metadata headers on export', () => {
    const redacted = redactGrpcCallRequestForExport({
      ...FIXTURE_UNARY_CALL_REQUEST,
      metadata: { 'x-api-key': 'super-secret-key-value' },
    });
    expect(redacted.metadata?.['x-api-key']).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('redacts secret keys in error details including hyphenated api-key names', () => {
    const redacted = redactGrpcErrorBody({
      code: GRPC_ERROR_CODES.CALL_FAILED,
      category: 'call_failed',
      message: `Handshake failed with Bearer abcdefghijklmnop and ${VALID_PEM}`,
      details: {
        'x-api-key': 'secret-value',
        traceId: 'abc-123',
      },
    });
    expect(redacted.details).toEqual({
      'x-api-key': GRPC_REDACTED_PLACEHOLDER,
      traceId: 'abc-123',
    });
    expect(redacted.message).not.toContain('SECRETDATA');
  });

  it('createSanitizedGrpcErrorEnvelope applies redaction at envelope boundary', () => {
    const envelope = createSanitizedGrpcErrorEnvelope('call', {
      code: GRPC_ERROR_CODES.CALL_FAILED,
      message: `Bearer abcdefghijklmnop leaked in ${VALID_PEM}`,
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.message).not.toContain('SECRETDATA');
      expect(envelope.error.message).toContain('[REDACTED_PEM]');
    }
  });

  it('redacts execute snapshots for export', () => {
    const redacted = redactGrpcExecuteSnapshotForExport({
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: '2026-01-01T00:00:00.000Z',
      callType: 'unary',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      metadata: { authorization: 'Bearer export-secret' },
      timeoutMs: 5000,
      descriptorKey: 'desc-1',
      auth: { type: 'bearer', bearerToken: 'export-secret' },
    });
    expect(redacted.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(redacted.metadata.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('redacts oauth2-derived authorization metadata for export (Phase 4D)', () => {
    const redacted = redactGrpcCallRequestForExport({
      ...FIXTURE_UNARY_CALL_REQUEST,
      metadata: { authorization: 'Bearer leaked' },
      auth: {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client',
          clientSecret: 'top-secret',
        },
      },
    });
    expect(redacted.auth?.oauth2?.clientSecret).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(redacted.metadata.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('redacts BSR tokens from proto ingest export state', () => {
    expect(redactGrpcProtoIngestState({ bsrToken: 'secret-bsr' })).toEqual({
      bsrToken: GRPC_REDACTED_PLACEHOLDER,
    });
  });

  it('redacts call results for display and export consumers', () => {
    const result = {
      status: 0,
      statusMessage: 'OK',
      durationMs: 10,
      headers: { authorization: 'Bearer abcdefghijklmnop' },
      body: { ok: true },
    };
    const display = redactGrpcCallResultForDisplay(result);
    expect(display.headers?.authorization).toContain('…');
    const exported = redactGrpcCallResultForExport(result, {
      type: 'bearer',
      bearerToken: 'abcdefghijklmnop',
    });
    expect(exported.headers?.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('redacts studio payload per consumer and prepares history records', () => {
    const payload = {
      auth: { type: 'bearer' as const, bearerToken: 'history-secret-token' },
      lastExecuteSnapshot: {
        tabId: 't1',
        requestId: 'r1',
        capturedAt: '2026-01-01T00:00:00.000Z',
        callType: 'unary' as const,
        target: { address: 'localhost:50051' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 30000,
        descriptorKey: 'd1',
        auth: { type: 'bearer' as const, bearerToken: 'history-secret-token' },
      },
    };
    const redacted = redactGrpcStudioPayloadForConsumer(payload, 'call_history');
    expect(redacted.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    const history = prepareGrpcCallHistoryRecord({
      snapshot: payload.lastExecuteSnapshot!,
    });
    expect(history.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });
});
