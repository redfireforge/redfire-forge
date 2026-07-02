import { describe, expect, it } from 'vitest';
import {
  defaultGrpcSecretStorageClass,
  isGrpcSecretMetadataKey,
} from './grpcSecretPolicy';

describe('grpcSecretPolicy coverage gaps', () => {
  it('maps bsr_token and desktop auth_token storage classes', () => {
    expect(defaultGrpcSecretStorageClass('bsr_token', 'web')).toBe('session_memory');
    expect(defaultGrpcSecretStorageClass('bsr_token', 'desktop')).toBe('encrypted_local');
    expect(defaultGrpcSecretStorageClass('auth_token', 'desktop')).toBe('encrypted_local');
  });

  it('detects secret-bearing metadata key heuristics', () => {
    expect(isGrpcSecretMetadataKey('authorization')).toBe(true);
    expect(isGrpcSecretMetadataKey('x-access-token')).toBe(true);
    expect(isGrpcSecretMetadataKey('client-secret')).toBe(true);
    expect(isGrpcSecretMetadataKey('user-password')).toBe(true);
    expect(isGrpcSecretMetadataKey('x-api-key')).toBe(true);
    expect(isGrpcSecretMetadataKey('x-apikey')).toBe(true);
    expect(isGrpcSecretMetadataKey('x-service-key')).toBe(true);
    expect(isGrpcSecretMetadataKey('   ')).toBe(false);
    expect(isGrpcSecretMetadataKey('x-trace-id')).toBe(false);
  });
});
