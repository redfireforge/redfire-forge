import { describe, expect, it } from 'vitest';
import {
  FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD,
  FIXTURE_DESCRIPTOR,
  FIXTURE_ECHO_DESCRIPTOR_PAYLOAD,
  FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
} from './contractFixtures';
import { GRPC_ERROR_CODES } from './contracts';
import { GRPC_TAURI_ERROR_CODES } from './grpcTauriContracts';
import {
  buildGrpcTauriDescriptorPayload,
  buildGrpcTauriDescriptorPayloadFromDescriptor,
  sha256HexFromBase64,
} from './grpcTauriDescriptorBridge';
import { mapTauriErrorCodeToExpress } from './grpcTauriErrorMapping';

describe('grpcPhase7gAcceptance', () => {
  it('accepts representative nested/repeated/oneof protoset payload', () => {
    const payload = buildGrpcTauriDescriptorPayload(FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD);
    expect(payload.descriptorKey).toBe('test:codec-acceptance');
    expect(payload.contentSha256).toHaveLength(64);
    expect(payload.protosetBase64.length).toBeGreaterThan(0);
  });

  it('echo protoset digest matches Rust fixture', async () => {
    const digest = await sha256HexFromBase64(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.protosetBase64);
    expect(digest).toBe(FIXTURE_TAURI_PROTOSET_CONTENT_SHA256);
    expect(digest).toBe(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.contentSha256);
  });

  it('requires full SHA-256 when building from descriptor metadata', () => {
    expect(() => buildGrpcTauriDescriptorPayloadFromDescriptor(
      { key: FIXTURE_DESCRIPTOR.key, contentSha256: 'short' },
      'Ym9keQ==',
    )).toThrow(/contentSha256 is required|64-character SHA-256/);
  });

  it('maps native sha mismatch message to GRPC_INVALID_DESCRIPTOR', () => {
    expect(
      mapTauriErrorCodeToExpress(
        GRPC_TAURI_ERROR_CODES.INVALID_REQUEST,
        'GRPC_TAURI_DESCRIPTOR_INTEGRITY: protoset SHA-256 mismatch (expected abc, got def)',
      ),
    ).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
  });

  it('maps descriptor integrity failures to INVALID_DESCRIPTOR', () => {
    expect(
      mapTauriErrorCodeToExpress(GRPC_TAURI_ERROR_CODES.DESCRIPTOR_INTEGRITY),
    ).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
  });
});
