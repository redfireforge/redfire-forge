/**
 * Build `GrpcTauriDescriptorPayload` for native unary invoke — Phase 7C/7G.
 *
 * Express remains the source of protoset bytes (`postGrpcExportProtoset`);
 * native Rust validates SHA-256 before dynamic dispatch.
 * For export orchestration see `grpcTauriDescriptorBridge.ts`.
 */
import type { GrpcDescriptor } from './contracts';
import type { GrpcTauriDescriptorPayload } from './grpcTauriContracts';

export interface BuildGrpcTauriDescriptorPayloadInput {
  descriptorKey: string;
  contentSha256: string;
  protosetBase64: string;
}

const FULL_SHA256_HEX_LENGTH = 64;
const FULL_SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export function buildGrpcTauriDescriptorPayload(
  input: BuildGrpcTauriDescriptorPayloadInput,
): GrpcTauriDescriptorPayload {
  const descriptorKey = input.descriptorKey.trim();
  const contentSha256 = input.contentSha256.trim().toLowerCase();
  const protosetBase64 = input.protosetBase64.trim();

  if (!descriptorKey) {
    throw new Error('descriptorKey is required for native gRPC descriptor payload');
  }
  if (!contentSha256) {
    throw new Error('contentSha256 is required for native gRPC descriptor payload');
  }
  if (contentSha256.length !== FULL_SHA256_HEX_LENGTH || !FULL_SHA256_HEX_PATTERN.test(contentSha256)) {
    throw new Error(
      'contentSha256 must be a full 64-character SHA-256 hex digest — tab short hashes are not valid for native transport',
    );
  }
  if (!protosetBase64) {
    throw new Error('protosetBase64 is required for native gRPC descriptor payload');
  }

  return {
    descriptorKey,
    contentSha256,
    protosetBase64,
  };
}

export function buildGrpcTauriDescriptorPayloadFromDescriptor(
  descriptor: Pick<GrpcDescriptor, 'key' | 'contentSha256'>,
  protosetBase64: string,
): GrpcTauriDescriptorPayload {
  // Never pass `GrpcDescriptor.contentSha256` directly — it is a tab short hash.
  // Callers must supply the full 64-char digest of `protosetBase64` bytes.
  const contentSha256 = descriptor.contentSha256?.trim();
  if (!contentSha256) {
    throw new Error(
      'contentSha256 is required — compute full SHA-256 from protoset bytes, not tab short hash',
    );
  }

  return buildGrpcTauriDescriptorPayload({
    descriptorKey: descriptor.key.trim(),
    contentSha256,
    protosetBase64,
  });
}
