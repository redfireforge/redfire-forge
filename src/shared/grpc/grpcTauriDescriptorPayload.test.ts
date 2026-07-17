import { describe, expect, it } from 'vitest';
import { FIXTURE_TAURI_PROTOSET_CONTENT_SHA256 } from './contractFixtures';
import { buildGrpcTauriDescriptorPayload } from './grpcTauriDescriptorPayload';

describe('grpcTauriDescriptorPayload', () => {
  it('builds trimmed payload with required fields', () => {
    const payload = buildGrpcTauriDescriptorPayload({
      descriptorKey: ' reflection:localhost:50051 ',
      contentSha256: ` ${FIXTURE_TAURI_PROTOSET_CONTENT_SHA256.toUpperCase()} `,
      protosetBase64: ' Ym9keQ== ',
    });

    expect(payload.descriptorKey).toBe('reflection:localhost:50051');
    expect(payload.contentSha256).toBe(FIXTURE_TAURI_PROTOSET_CONTENT_SHA256);
    expect(payload.protosetBase64).toBe('Ym9keQ==');
  });

  it('throws when protosetBase64 is missing', () => {
    expect(() => buildGrpcTauriDescriptorPayload({
      descriptorKey: 'k',
      contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      protosetBase64: '   ',
    })).toThrow(/protosetBase64 is required/);
  });

  it('rejects tab short hash (non-64-char contentSha256)', () => {
    expect(() => buildGrpcTauriDescriptorPayload({
      descriptorKey: 'k',
      contentSha256: 'abc123',
      protosetBase64: 'Ym9keQ==',
    })).toThrow(/64-character SHA-256/);
  });
});
