/**
 * Phase 5E — coverage gaps for persist redaction middleware.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import {
  prepareGrpcSavedRequestForPersistSafe,
  scanGrpcPersistPayloadsForLeakage,
} from './grpcPersistRedactionMiddleware';
import { createGrpcSavedRequestFromSnapshot } from './grpcSavedRequest';

describe('grpcPersistRedactionMiddleware coverage gaps', () => {
  it('scanGrpcPersistPayloadsForLeakage returns empty for omitted targets', () => {
    expect(scanGrpcPersistPayloadsForLeakage({})).toHaveLength(0);
  });

  it('scanGrpcPersistPayloadsForLeakage flags only provided forbidden targets', () => {
    const findings = scanGrpcPersistPayloadsForLeakage({
      grpc_export_bundle: { savedRequest: { auth: { bearerToken: 'leak-export' } } },
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.path.startsWith('grpc_export_bundle'))).toBe(true);
  });

  it('prepareGrpcSavedRequestForPersistSafe redacts secrets and preserves templates', () => {
    const saved = createGrpcSavedRequestFromSnapshot(
      {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: '2026-01-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
        auth: { type: 'bearer', bearerToken: 'raw-secret-token' },
      },
      { id: 'sr-1', revisionId: 'rev-1', updatedAt: '2026-01-01T00:00:00.000Z' },
      { rawTarget: '{{grpcHost}}', rawBody: { message: '{{greeting}}' } },
    );
    const prepared = prepareGrpcSavedRequestForPersistSafe(saved, {
      target: '{{grpcHost}}',
      body: { message: '{{greeting}}' },
    });
    expect(prepared.target).toBe('{{grpcHost}}');
    expect(prepared.body).toEqual({ message: '{{greeting}}' });
    expect(prepared.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(scanGrpcPersistPayloadsForLeakage({ grpc_collections_v1: {
      schemaVersion: 1,
      updatedAt: prepared.updatedAt,
      collections: [{
        id: 'col-1',
        name: 'Probe',
        createdAt: prepared.createdAt,
        updatedAt: prepared.updatedAt,
        savedRequests: [prepared],
      }],
    } })).toHaveLength(0);
  });
});
