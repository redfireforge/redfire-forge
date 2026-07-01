import { describe, expect, it } from 'vitest';
import {
  validateGrpcMetadataEntry,
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
});
