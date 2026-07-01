import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES } from './contracts';
import { FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD } from './contractFixtures';
import { GRPC_TAURI_ERROR_CODES } from './grpcTauriContracts';
import {
  buildGrpcTauriDescriptorPayload,
  prepareGrpcTauriDescriptorPayload,
  prepareGrpcTauriDescriptorPayloadFromDescriptor,
  sha256HexFromBase64,
} from './grpcTauriDescriptorBridge';
import { mapTauriErrorCodeToExpress } from './grpcTauriErrorMapping';
import * as grpcApiClient from './grpcApiClient';

vi.mock('./grpcApiClient', async () => {
  const actual = await vi.importActual<typeof grpcApiClient>('./grpcApiClient');
  return {
    ...actual,
    postGrpcExportProtoset: vi.fn(),
  };
});

describe('grpcTauriDescriptorBridge (Phase 7G)', () => {
  beforeEach(() => {
    vi.mocked(grpcApiClient.postGrpcExportProtoset).mockReset();
  });

  it('sha256HexFromBase64 matches Rust fixture digest', async () => {
    const digest = await sha256HexFromBase64(FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.protosetBase64);
    expect(digest).toBe(FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.contentSha256);
  });

  it('sha256HexFromBase64 trims whitespace before digesting', async () => {
    const padded = ` ${FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.protosetBase64} `;
    const digest = await sha256HexFromBase64(padded);
    expect(digest).toBe(FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.contentSha256);
  });

  it('buildGrpcTauriDescriptorPayload rejects short contentSha256', () => {
    expect(() => buildGrpcTauriDescriptorPayload({
      descriptorKey: 'key',
      contentSha256: 'abc',
      protosetBase64: 'Ym9keQ==',
    })).toThrow(/64-character SHA-256/);
  });

  it('prepareGrpcTauriDescriptorPayload trims exported protoset before digest', async () => {
    vi.mocked(grpcApiClient.postGrpcExportProtoset).mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: {
        protosetBase64: ` ${FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.protosetBase64} `,
      },
      meta: { requestId: 'req-3', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    const payload = await prepareGrpcTauriDescriptorPayload({
      descriptorKey: 'test:codec-acceptance',
      requestId: 'req-3',
    });

    expect(payload.protosetBase64).toBe(FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.protosetBase64);
    expect(payload.contentSha256).toBe(FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.contentSha256);
  });

  it('prepareGrpcTauriDescriptorPayload exports protoset and computes digest', async () => {
    vi.mocked(grpcApiClient.postGrpcExportProtoset).mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: {
        protosetBase64: FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.protosetBase64,
      },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    const payload = await prepareGrpcTauriDescriptorPayload({
      descriptorKey: 'test:codec-acceptance',
      requestId: 'req-1',
    });

    expect(payload.descriptorKey).toBe('test:codec-acceptance');
    expect(payload.contentSha256).toBe(FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.contentSha256);
    expect(payload.protosetBase64).toBe(FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.protosetBase64);
  });

  it('prepareGrpcTauriDescriptorPayloadFromDescriptor ignores tab short hash', async () => {
    vi.mocked(grpcApiClient.postGrpcExportProtoset).mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: {
        protosetBase64: FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.protosetBase64,
      },
      meta: { requestId: 'req-2', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    const payload = await prepareGrpcTauriDescriptorPayloadFromDescriptor(
      { key: 'test:codec-acceptance' },
      'req-2',
    );

    expect(payload.contentSha256).toBe(FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD.contentSha256);
    expect(payload.contentSha256).toHaveLength(64);
  });

  it('prepareGrpcTauriDescriptorPayload rejects empty exported protoset', async () => {
    vi.mocked(grpcApiClient.postGrpcExportProtoset).mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: '   ' },
      meta: { requestId: 'req-empty', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await expect(prepareGrpcTauriDescriptorPayload({
      descriptorKey: 'test:codec-acceptance',
      requestId: 'req-empty',
    })).rejects.toThrow(/protosetBase64 is required/);
  });

  it('maps descriptor integrity failures to validation category', () => {
    expect(
      mapTauriErrorCodeToExpress(GRPC_TAURI_ERROR_CODES.DESCRIPTOR_INTEGRITY),
    ).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
  });
});
