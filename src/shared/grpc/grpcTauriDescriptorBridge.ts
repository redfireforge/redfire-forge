/**
 * Bridge Phase 3 descriptor exports → native Tauri invoke payloads — Phase 7G.
 *
 * Express remains the source of protoset bytes (`postGrpcExportProtoset`);
 * native Rust validates SHA-256 before dynamic prost-reflect dispatch.
 */
import { postGrpcExportProtoset } from './grpcApiClient';
import type { GrpcDescriptor } from './contracts';
import type { GrpcTauriDescriptorPayload } from './grpcTauriContracts';
import {
  buildGrpcTauriDescriptorPayload,
  buildGrpcTauriDescriptorPayloadFromDescriptor,
  type BuildGrpcTauriDescriptorPayloadInput,
} from './grpcTauriDescriptorPayload';

export {
  buildGrpcTauriDescriptorPayload,
  buildGrpcTauriDescriptorPayloadFromDescriptor,
  type BuildGrpcTauriDescriptorPayloadInput,
};

export async function sha256HexFromBase64(base64: string): Promise<string> {
  const normalized = base64.trim();
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function prepareGrpcTauriDescriptorPayload(input: {
  descriptorKey: string;
  requestId: string;
}): Promise<GrpcTauriDescriptorPayload> {
  const descriptorKey = input.descriptorKey.trim();
  const envelope = await postGrpcExportProtoset({
    requestId: input.requestId,
    descriptorKey,
  });
  const protosetBase64 = envelope.data.protosetBase64.trim();
  if (!protosetBase64) {
    throw new Error('protosetBase64 is required for native gRPC descriptor payload');
  }
  const contentSha256 = await sha256HexFromBase64(protosetBase64);
  return buildGrpcTauriDescriptorPayload({
    descriptorKey,
    contentSha256,
    protosetBase64,
  });
}

export async function prepareGrpcTauriDescriptorPayloadFromDescriptor(
  descriptor: Pick<GrpcDescriptor, 'key'>,
  requestId: string,
): Promise<GrpcTauriDescriptorPayload> {
  return prepareGrpcTauriDescriptorPayload({
    descriptorKey: descriptor.key.trim(),
    requestId,
  });
}
