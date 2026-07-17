import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import type { GrpcCallHistoryEntryV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import { GRPC_REDACTED_PLACEHOLDER } from '../../../shared/grpc/grpcRedaction';
import {
  mergeHistoryMetadataForGrpcurl,
  resolveSiblingRuntimeHistoryMetadata,
  sanitizeHistoryAuthForGrpcurl,
} from './grpcStudioPageHistoryMetadata';

const TS = '2026-07-01T00:00:00.000Z';

function makeEntry(overrides: Partial<GrpcCallHistoryEntryV1> = {}): GrpcCallHistoryEntryV1 {
  return {
    id: 'hist-1',
    callType: 'unary',
    target: FIXTURE_UNARY_CALL_REQUEST.target.address,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    descriptorKey: 'desc',
    capturedAt: TS,
    bodyTruncated: false,
    record: {
      capturedAt: TS,
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: structuredClone(FIXTURE_UNARY_CALL_REQUEST.target),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc',
      },
    },
    ...overrides,
  };
}

describe('grpcStudioPageHistoryMetadata coverage gaps', () => {
  it('mergeHistoryMetadataForGrpcurl returns replay-only metadata when other sources are absent', () => {
    expect(mergeHistoryMetadataForGrpcurl({ authorization: 'replay' }, undefined, undefined, undefined, {}))
      .toEqual({ authorization: 'replay' });
    expect(mergeHistoryMetadataForGrpcurl(undefined, undefined, undefined, undefined, {})).toEqual({});
  });

  it('mergeHistoryMetadataForGrpcurl returns merged metadata without redaction loop when history is absent', () => {
    expect(mergeHistoryMetadataForGrpcurl(
      { authorization: 'replay' },
      undefined,
      { 'x-trace': 'runtime' },
      { 'x-custom': 'active' },
      {},
    )).toEqual({
      authorization: 'replay',
      'x-trace': 'runtime',
      'x-custom': 'active',
    });
  });

  it('mergeHistoryMetadataForGrpcurl resolves redacted keys from replay, runtime, active, and env', () => {
    expect(mergeHistoryMetadataForGrpcurl(
      { authorization: 'replay-auth', 'x-trace': GRPC_REDACTED_PLACEHOLDER },
      { authorization: GRPC_REDACTED_PLACEHOLDER, 'x-trace': GRPC_REDACTED_PLACEHOLDER, 'X-Custom-Header': GRPC_REDACTED_PLACEHOLDER },
      { 'x-trace': 'runtime-trace' },
      { 'X-Custom-Header': 'active-custom' },
      { X_CUSTOM_HEADER: 'env-custom' },
    )).toEqual({
      authorization: 'replay-auth',
      'x-trace': 'runtime-trace',
      'X-Custom-Header': 'active-custom',
    });

    expect(mergeHistoryMetadataForGrpcurl(
      { authorization: GRPC_REDACTED_PLACEHOLDER },
      { authorization: GRPC_REDACTED_PLACEHOLDER },
      undefined,
      undefined,
      { authorization: 'env-auth' },
    )).toEqual({ authorization: 'env-auth' });
  });

  it('mergeHistoryMetadataForGrpcurl skips non-redacted history values in the redaction loop', () => {
    expect(mergeHistoryMetadataForGrpcurl(
      undefined,
      { authorization: 'plain-token', 'x-trace': GRPC_REDACTED_PLACEHOLDER },
      undefined,
      { 'x-trace': 'active-trace' },
      {},
    )).toEqual({
      authorization: 'plain-token',
      'x-trace': 'active-trace',
    });
  });

  it('resolveSiblingRuntimeHistoryMetadata returns undefined when no redacted keys exist', () => {
    const entry = makeEntry({
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeEntry().record.snapshot,
          metadata: { authorization: 'plain' },
        },
      },
    });
    expect(resolveSiblingRuntimeHistoryMetadata(entry, [entry], () => ({ authorization: 'sibling' })))
      .toBeUndefined();
  });

  it('resolveSiblingRuntimeHistoryMetadata resolves closest siblings and stops when pending is empty', () => {
    const entry = makeEntry({
      id: 'hist-target',
      capturedAt: '2026-07-01T00:00:00.000Z',
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeEntry().record.snapshot,
          metadata: { authorization: GRPC_REDACTED_PLACEHOLDER, 'x-trace': GRPC_REDACTED_PLACEHOLDER },
        },
      },
    });
    const near = makeEntry({ id: 'near', capturedAt: '2026-07-01T00:00:01.000Z' });
    const far = makeEntry({ id: 'far', capturedAt: '2026-07-01T00:00:20.000Z' });
    const resolved = resolveSiblingRuntimeHistoryMetadata(
      entry,
      [entry, far, near],
      (id) => {
        if (id === 'near') return { authorization: 'near-auth' };
        if (id === 'far') return { 'x-trace': 'far-trace' };
        return undefined;
      },
    );
    expect(resolved).toEqual({ authorization: 'near-auth', 'x-trace': 'far-trace' });
  });

  it('sanitizeHistoryAuthForGrpcurl keeps visible secrets and drops redacted ones', () => {
    expect(sanitizeHistoryAuthForGrpcurl({ type: 'none' })).toEqual({ type: 'none' });
    expect(sanitizeHistoryAuthForGrpcurl({ type: 'inherit' })).toEqual({ type: 'inherit' });
    expect(sanitizeHistoryAuthForGrpcurl({ type: 'bearer', bearerToken: 'visible' }))
      .toEqual({ type: 'bearer', bearerToken: 'visible' });
    expect(sanitizeHistoryAuthForGrpcurl({ type: 'bearer', bearerToken: GRPC_REDACTED_PLACEHOLDER })).toBeUndefined();
    expect(sanitizeHistoryAuthForGrpcurl({ type: 'basic', username: 'u', basicPassword: GRPC_REDACTED_PLACEHOLDER })).toBeUndefined();
    expect(sanitizeHistoryAuthForGrpcurl({ type: 'api_key', apiKeyName: 'x', apiKeyValue: GRPC_REDACTED_PLACEHOLDER, apiKeyLocation: 'header' }))
      .toBeUndefined();
    expect(sanitizeHistoryAuthForGrpcurl({
      type: 'oauth2',
      oauth2: { tokenUrl: 'https://auth', clientId: 'id', clientSecret: GRPC_REDACTED_PLACEHOLDER },
    })).toBeUndefined();
    expect(sanitizeHistoryAuthForGrpcurl({ type: 'digest', username: 'digest-user' }))
      .toEqual({ type: 'digest', username: 'digest-user' });
  });
});
