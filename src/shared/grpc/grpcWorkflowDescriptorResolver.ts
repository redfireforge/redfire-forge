/**
 * Phase 11N — resolve pinned descriptor keys for workflow schema-diff nodes.
 */
import type { GrpcDescriptor } from './contracts';
import { postGrpcDescriptorLookup } from './grpcApiClient';

export async function resolveGrpcWorkflowDescriptorByKey(
  descriptorKey: string,
): Promise<GrpcDescriptor> {
  const trimmed = descriptorKey.trim();
  if (!trimmed) {
    throw new Error('descriptorKey is required');
  }
  const envelope = await postGrpcDescriptorLookup({
    descriptorKey: trimmed,
    requestId: `wf-desc-${Date.now()}`,
  });
  return envelope.data;
}
