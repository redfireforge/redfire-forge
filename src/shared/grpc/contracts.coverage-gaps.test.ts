import { describe, expect, it } from 'vitest';
import { grpcErrorCategoryForCode } from './contracts';

describe('grpc contracts coverage gaps', () => {
  it('classifies unknown and heuristic error codes', () => {
    expect(grpcErrorCategoryForCode('CUSTOM_UNKNOWN')).toBe('call_failed');
    expect(grpcErrorCategoryForCode('GRPC_INVALID_BODY')).toBe('validation');
    expect(grpcErrorCategoryForCode('FOO_REFLECTION_BAR')).toBe('reflection_failed');
    expect(grpcErrorCategoryForCode('FOO_DESCRIBE_BAR')).toBe('describe_failed');
    expect(grpcErrorCategoryForCode('FOO_UNREACHABLE_BAR')).toBe('unreachable');
    expect(grpcErrorCategoryForCode('FOO_NOT_FOUND_BAR')).toBe('not_found');
    expect(grpcErrorCategoryForCode('FOO_SOURCE_UNAVAILABLE_BAR')).toBe('source_unavailable');
    expect(grpcErrorCategoryForCode('FOO_IMPORT_RESOLUTION_BAR')).toBe('import_resolution_failed');
    expect(grpcErrorCategoryForCode('FOO_SCHEMA_DRIFT_BAR')).toBe('schema_drift');
    expect(grpcErrorCategoryForCode('FOO_CACHE_STALE_BAR')).toBe('cache_stale');
    expect(grpcErrorCategoryForCode('FOO_CANCEL_BAR')).toBe('cancelled');
  });
});
