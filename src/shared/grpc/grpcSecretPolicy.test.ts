import { describe, expect, it } from 'vitest';
import {
  GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS,
  GRPC_REDACTION_CONSUMERS,
  GRPC_SECRET_FIELD_PATHS,
  defaultGrpcSecretStorageClass,
  isForbiddenGrpcSecretPersistTarget,
  isGrpcSecretFieldPath,
  isGrpcSecretMetadataKey,
} from './grpcSecretPolicy';

describe('grpcSecretPolicy (Phase 4A)', () => {
  it('lists canonical secret paths and redaction consumers', () => {
    expect(GRPC_SECRET_FIELD_PATHS).toContain('auth.bearerToken');
    expect(GRPC_REDACTION_CONSUMERS).toContain('error_envelopes');
    expect(isGrpcSecretFieldPath('auth.oauth2.clientSecret')).toBe(true);
  });

  it('defaults storage class by platform and surface', () => {
    expect(defaultGrpcSecretStorageClass('auth_token', 'web')).toBe('session_memory');
    expect(defaultGrpcSecretStorageClass('tls_pem', 'web')).toBe('encrypted_local');
    expect(defaultGrpcSecretStorageClass('tls_pem', 'desktop')).toBe('encrypted_local');
  });

  it('flags forbidden persist targets including harness result exports', () => {
    expect(isForbiddenGrpcSecretPersistTarget(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS[0]!)).toBe(true);
    expect(isForbiddenGrpcSecretPersistTarget('grpc_tls_certs_v1')).toBe(false);
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('harness_result_export');
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('runner_artifacts');
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('grpc_load_test_export');
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('grpc_schema_diff_export');
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('grpc_mock_rule_export');
  });

  it('detects secret-bearing metadata header names', () => {
    expect(isGrpcSecretMetadataKey('x-api-key')).toBe(true);
    expect(isGrpcSecretMetadataKey('x-trace-id')).toBe(false);
  });
});
