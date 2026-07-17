/**
 * Phase 4E — secret leakage scanner tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import {
  assertNoGrpcSecretLeakage,
  scanForbiddenGrpcPersistTargets,
  scanGrpcObjectForSecretLeakage,
} from './grpcSecretLeakScan';
import { prepareGrpcCallHistoryRecord } from './grpcRedaction';

const VALID_PEM = `-----BEGIN CERTIFICATE-----
LEAKED-CA
-----END CERTIFICATE-----`;

describe('grpcSecretLeakScan (Phase 4E)', () => {
  it('detects raw secret field values at root', () => {
    const findings = scanGrpcObjectForSecretLeakage({
      auth: { bearerToken: 'super-secret-token-value' },
    });
    expect(findings.some((f) => f.path.includes('bearerToken'))).toBe(true);
  });

  it('detects nested snapshot secrets', () => {
    const findings = scanGrpcObjectForSecretLeakage({
      snapshot: { auth: { bearerToken: 'nested-leak-token-value' } },
    });
    expect(findings.some((f) => f.path.includes('bearerToken'))).toBe(true);
  });

  it('allows redacted placeholders', () => {
    expect(() => assertNoGrpcSecretLeakage({
      auth: { bearerToken: GRPC_REDACTED_PLACEHOLDER },
      target: { tlsConfig: { serverCaPem: '[REDACTED_PEM]' } },
    }, 'export')).not.toThrow();
  });

  it('detects PEM blocks in nested payloads', () => {
    const findings = scanGrpcObjectForSecretLeakage({
      target: { tlsConfig: { serverCaPem: VALID_PEM } },
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.reason).toContain('PEM');
  });

  it('passes prepareGrpcCallHistoryRecord through leak scan', () => {
    const record = prepareGrpcCallHistoryRecord({
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: new Date().toISOString(),
        callType: 'unary',
        target: {
          address: 'localhost:50051',
          tlsConfig: { serverCaPem: VALID_PEM },
        },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: { authorization: 'Bearer leaked-token-value' },
        timeoutMs: 30000,
        descriptorKey: 'desc-1',
        auth: { type: 'bearer', bearerToken: 'leaked-token-value' },
      },
      result: {
        status: 0,
        statusMessage: 'OK',
        durationMs: 12,
        headers: { authorization: 'Bearer leaked-token-value' },
        body: { message: 'hi' },
      },
    });

    expect(() => assertNoGrpcSecretLeakage(record, 'grpc_call_history_v1')).not.toThrow();
    expect(record.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('scanForbiddenGrpcPersistTargets flags raw secrets in collections payload', () => {
    const findings = scanForbiddenGrpcPersistTargets({
      grpc_collections_v1: {
        collections: [{
          id: 'col-1',
          name: 'Test',
          savedRequests: [{
            auth: { type: 'bearer', bearerToken: 'must-not-persist' },
          }],
        }],
      },
    });
    expect(findings.length).toBeGreaterThan(0);
  });

  it('scanForbiddenGrpcPersistTargets flags raw secrets in history payload', () => {
    const findings = scanForbiddenGrpcPersistTargets({
      grpc_call_history_v1: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        auth: { type: 'bearer', bearerToken: 'must-not-persist' },
      },
    });
    expect(findings.length).toBeGreaterThan(0);
  });
});
