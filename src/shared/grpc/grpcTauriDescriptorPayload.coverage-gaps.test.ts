/**
 * Coverage gaps — grpcTauriDescriptorPayload.ts
 */
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
} from './contractFixtures';
import {
  buildGrpcTauriDescriptorPayload,
  buildGrpcTauriDescriptorPayloadFromDescriptor,
} from './grpcTauriDescriptorPayload';

describe('grpcTauriDescriptorPayload coverage gaps', () => {
  it('throws when descriptorKey is blank', () => {
    expect(() => buildGrpcTauriDescriptorPayload({
      descriptorKey: '   ',
      contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      protosetBase64: 'Ym9keQ==',
    })).toThrow(/descriptorKey is required/);
  });

  it('throws when contentSha256 is blank', () => {
    expect(() => buildGrpcTauriDescriptorPayload({
      descriptorKey: 'k',
      contentSha256: '   ',
      protosetBase64: 'Ym9keQ==',
    })).toThrow(/contentSha256 is required/);
  });

  it('rejects invalid hex digest pattern', () => {
    const invalidHex = `${'a'.repeat(63)}g`;
    expect(() => buildGrpcTauriDescriptorPayload({
      descriptorKey: 'k',
      contentSha256: invalidHex,
      protosetBase64: 'Ym9keQ==',
    })).toThrow(/64-character SHA-256/);
  });

  it('buildGrpcTauriDescriptorPayloadFromDescriptor maps descriptor fields', () => {
    const payload = buildGrpcTauriDescriptorPayloadFromDescriptor(
      {
        key: FIXTURE_DESCRIPTOR.key,
        contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      },
      'Ym9keQ==',
    );
    expect(payload.descriptorKey).toBe(FIXTURE_DESCRIPTOR.key);
    expect(payload.contentSha256).toBe(FIXTURE_TAURI_PROTOSET_CONTENT_SHA256);
    expect(payload.protosetBase64).toBe('Ym9keQ==');
  });

  it('buildGrpcTauriDescriptorPayloadFromDescriptor rejects missing contentSha256', () => {
    expect(() => buildGrpcTauriDescriptorPayloadFromDescriptor(
      { key: 'k', contentSha256: '  ' },
      'Ym9keQ==',
    )).toThrow(/contentSha256 is required/);
  });
});
