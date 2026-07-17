import { createHash } from 'node:crypto';
import type { GrpcDescriptor, GrpcDescriptorSource } from '../../src/shared/grpc/contracts.js';

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Stable short hash for descriptor cache keys (first 16 hex chars). */
export function shortContentHash(content: string | Buffer): string {
  return sha256Hex(content).slice(0, 16);
}

export function computeDescriptorContentHash(
  descriptor: Pick<GrpcDescriptor, 'source' | 'sourceRef' | 'services'>,
): string {
  const canonical = JSON.stringify({
    source: descriptor.source,
    sourceRef: descriptor.sourceRef ?? null,
    services: descriptor.services,
  });
  return shortContentHash(canonical);
}

export function buildDescriptorKey(
  source: GrpcDescriptorSource,
  contentHash: string,
  sourceRef?: string,
): string {
  switch (source) {
    case 'reflection':
      return `${source}:${sourceRef ?? 'unknown'}:${contentHash}`;
    case 'proto_files':
      return `${source}:${contentHash}`;
    case 'protoset':
      return `${source}:${contentHash}`;
    case 'bsr':
      return `${source}:${sourceRef ?? 'unknown'}:${contentHash}`;
    case 'url_proto':
      return `${source}:${sourceRef ?? 'unknown'}:${contentHash}`;
    default:
      return `${source}:${contentHash}`;
  }
}

export function buildReflectionDescriptorKey(
  normalizedAddress: string,
  contentHash: string,
): string {
  return buildDescriptorKey('reflection', contentHash, normalizedAddress);
}
