import { describe, expect, it } from 'vitest';
import {
  validateGrpcMetadataEntry,
  validateGrpcMetadataKey,
  validateGrpcMetadataValue,
  validateGrpcMetadataRecord,
} from './metadataValidation';

describe('metadataValidation (Phase 1F shared)', () => {
  it('accepts valid metadata record', () => {
    expect(validateGrpcMetadataRecord({ 'x-trace': 'abc' })).toBeNull();
  });

  it('rejects invalid metadata keys in record', () => {
    expect(validateGrpcMetadataRecord({ 'Bad Key': 'x' })).toMatch(/lowercase/);
  });

  it('rejects invalid -bin base64 in record', () => {
    expect(validateGrpcMetadataRecord({ 'payload-bin': 'not-base64!' })).toMatch(/base64/);
  });

  it('validateGrpcMetadataEntry matches record validation', () => {
    expect(validateGrpcMetadataEntry('payload-bin', 'not-base64!')).toMatch(/base64/);
  });

  it('rejects empty metadata keys', () => {
    expect(validateGrpcMetadataKey('   ')).toMatch(/required/);
  });

  it('requires non-empty values for binary metadata keys', () => {
    expect(validateGrpcMetadataValue('payload-bin', '  ')).toMatch(/non-empty base64/);
  });

  it('accepts non-binary metadata values without base64 validation', () => {
    expect(validateGrpcMetadataValue('x-trace', 'not-base64!')).toBeNull();
  });

  it('treats undefined metadata records as valid', () => {
    expect(validateGrpcMetadataRecord(undefined)).toBeNull();
  });
});
