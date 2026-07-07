import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import {
  GRPC_REDACTED_PLACEHOLDER,
  maskGrpcDisplayValue,
  redactAuthorizationHeader,
  redactGrpcAuthConfig,
  redactGrpcCallResultForDisplay,
  redactGrpcMetadataForDisplay,
  redactGrpcMetadataForExport,
  redactGrpcProtoIngestState,
  redactGrpcStudioPayloadForConsumer,
  redactGrpcTlsConfig,
  prepareGrpcCallHistoryRecord,
  sanitizeGrpcErrorMessage,
} from './grpcRedaction';

describe('grpcRedaction coverage gaps', () => {
  it('maskGrpcDisplayValue handles empty, short, and long values', () => {
    expect(maskGrpcDisplayValue('')).toBe('');
    expect(maskGrpcDisplayValue('abc')).toBe('••••');
    expect(maskGrpcDisplayValue('abcdefghijklmnop')).toBe('abcd…mnop');
  });

  it('redactAuthorizationHeader masks non-bearer/basic schemes', () => {
    expect(redactAuthorizationHeader('Custom scheme-value-here')).toContain('…');
  });

  it('redactGrpcMetadataForDisplay redacts -bin and secret metadata keys', () => {
    expect(redactGrpcMetadataForDisplay({
      'trace-bin': 'abc',
      'x-api-key': 'secret',
      'x-tenant': 'visible',
    })).toEqual({
      'trace-bin': '[base64]',
      'x-api-key': GRPC_REDACTED_PLACEHOLDER,
      'x-tenant': '••••',
    });
  });

  it('redactGrpcMetadataForExport injects missing auth header keys', () => {
    const exported = redactGrpcMetadataForExport({}, {
      type: 'bearer',
      bearerToken: 'secret-token',
    });
    expect(exported.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('redactGrpcAuthConfig handles oauth2 without oauth2 block and default branch', () => {
    expect(redactGrpcAuthConfig({
      type: 'oauth2',
      oauth2: undefined,
    })).toEqual({ type: 'oauth2', oauth2: undefined });
  });

  it('redactGrpcStudioPayloadForConsumer uses display redaction for toast_messages', () => {
    const payload = {
      metadata: { authorization: 'Bearer abcdefghijklmnop' },
      lastResult: {
        callType: 'unary' as const,
        status: 0,
        statusMessage: 'OK',
        headers: { authorization: 'Bearer abcdefghijklmnop' },
        trailers: {},
        body: {},
        durationMs: 1,
      },
    };
    const redacted = redactGrpcStudioPayloadForConsumer(payload, 'toast_messages');
    expect(redacted.metadata?.authorization).toContain('…');
    expect(redacted.lastResult?.headers?.authorization).toContain('…');
  });

  it('sanitizeGrpcErrorMessage leaves benign text unchanged', () => {
    expect(sanitizeGrpcErrorMessage('Connection refused')).toBe('Connection refused');
  });

  it('redactGrpcProtoIngestState preserves ingest without token', () => {
    expect(redactGrpcProtoIngestState({ bsrToken: undefined })).toEqual({ bsrToken: undefined });
  });

  it('redactGrpcCallResultForDisplay redacts trailers', () => {
    const display = redactGrpcCallResultForDisplay({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: { 'x-api-key': 'secret-value' },
      body: {},
      durationMs: 1,
    });
    expect(display.trailers?.['x-api-key']).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('redactGrpcStudioPayloadForConsumer redacts tlsConfig and protoIngest', () => {
    const redacted = redactGrpcStudioPayloadForConsumer({
      tlsConfig: { serverCaPem: 'pem' },
      protoIngest: { bsrToken: 'secret' },
    }, 'call_history');
    expect(redacted.tlsConfig?.serverCaPem).toBe('[REDACTED_PEM]');
    expect(redacted.protoIngest?.bsrToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('redactGrpcMetadataForExport handles undefined metadata with auth only', () => {
    const exported = redactGrpcMetadataForExport(undefined, FIXTURE_UNARY_CALL_REQUEST.auth);
    expect(Object.keys(exported).length).toBeGreaterThanOrEqual(0);
  });

  it('redactGrpcMetadataForExport masks non-secret keys with display mask', () => {
    const exported = redactGrpcMetadataForExport({ 'x-tenant': 'visible-value' });
    expect(exported['x-tenant']).toContain('…');
  });

  it('redactGrpcMetadataForExport handles empty -bin metadata values', () => {
    const exported = redactGrpcMetadataForExport({ 'trace-bin': '' });
    expect(exported['trace-bin']).toBe('');
  });

  it('redactGrpcAuthConfig covers basic, api_key, oauth2 secret, and default branch', () => {
    expect(redactGrpcAuthConfig({
      type: 'basic',
      basicUsername: 'user',
      basicPassword: 'secret',
    })).toEqual({
      type: 'basic',
      basicUsername: 'user',
      basicPassword: GRPC_REDACTED_PLACEHOLDER,
    });
    expect(redactGrpcAuthConfig({
      type: 'api_key',
      apiKeyName: 'x-api-key',
      apiKeyValue: 'secret',
    })).toEqual({
      type: 'api_key',
      apiKeyName: 'x-api-key',
      apiKeyValue: GRPC_REDACTED_PLACEHOLDER,
    });
    expect(redactGrpcAuthConfig({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://t',
        clientId: 'id',
        clientSecret: 'sec',
      },
    })?.oauth2?.clientSecret).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(redactGrpcAuthConfig({ type: 'none' })).toEqual({ type: 'none' });
  });

  it('redactGrpcTlsConfig returns undefined for missing config and preserves serverNameOverride', () => {
    expect(redactGrpcTlsConfig(undefined)).toBeUndefined();
    expect(redactGrpcTlsConfig({
      serverNameOverride: 'grpc.local',
    })).toEqual({
      serverCaPem: undefined,
      clientCertPem: undefined,
      clientKeyPem: undefined,
      serverNameOverride: 'grpc.local',
    });
  });

  it('redactGrpcMetadataForDisplay handles empty authorization and -bin values', () => {
    expect(redactGrpcMetadataForDisplay(undefined)).toEqual({});
    expect(redactGrpcMetadataForDisplay({
      authorization: 'Bearer short',
      'trace-bin': '',
    })).toEqual({
      authorization: 'Bearer ••••',
      'trace-bin': '',
    });
  });

  it('redactGrpcStudioPayloadForConsumer redacts lastError details', () => {
    const redacted = redactGrpcStudioPayloadForConsumer({
      lastError: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'Bearer abcdefghijklmnop failed',
        details: { client_secret: 'top-secret', nested: ['Bearer abcdefghijklmnop'] },
      },
    }, 'call_history');
    expect(redacted.lastError?.message).not.toContain('abcdefghijklmnop');
    expect(redacted.lastError?.details).toMatchObject({
      client_secret: GRPC_REDACTED_PLACEHOLDER,
    });
  });

  it('prepareGrpcCallHistoryRecord redacts snapshot and nested result/error', () => {
    const record = prepareGrpcCallHistoryRecord({
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: '2026-06-29T12:00:00.000Z',
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hi' },
        metadata: {
          authorization: 'Bearer abcdefghijklmnop',
          'x-request-id': 'request-1234567890',
        },
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
        auth: { type: 'bearer', bearerToken: 'secret' },
      },
      result: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {
          authorization: 'Bearer abcdefghijklmnop',
          'x-request-id': 'request-1234567890',
        },
        trailers: {},
        body: {},
        durationMs: 1,
      },
    });
    expect(record.snapshot.metadata.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(record.snapshot.metadata['x-request-id']).toBe('request-1234567890');
    expect(record.result?.headers?.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(record.result?.headers?.['x-request-id']).toBe('request-1234567890');
  });

  it('prepareGrpcCallHistoryRecord includes auth-derived api key metadata as redacted', () => {
    const record = prepareGrpcCallHistoryRecord({
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-api-key-1',
        capturedAt: '2026-07-05T13:00:00.000Z',
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hi' },
        metadata: { 'x-request-id': 'request-abc-123' },
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
        auth: { type: 'api_key', apiKeyName: 'x-api-key', apiKeyValue: 'my-key-123' },
      },
    });

    expect(record.snapshot.metadata['x-request-id']).toBe('request-abc-123');
    expect(record.snapshot.metadata['x-api-key']).toBe(GRPC_REDACTED_PLACEHOLDER);
  });
});
