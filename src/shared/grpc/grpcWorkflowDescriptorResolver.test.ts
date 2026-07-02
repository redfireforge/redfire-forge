import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from './contractFixtures';
import { resolveGrpcWorkflowDescriptorByKey } from './grpcWorkflowDescriptorResolver';

const postGrpcDescriptorLookupMock = vi.fn();

vi.mock('./grpcApiClient', () => ({
  postGrpcDescriptorLookup: (...args: unknown[]) => postGrpcDescriptorLookupMock(...args),
}));

describe('resolveGrpcWorkflowDescriptorByKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns descriptor from lookup API', async () => {
    postGrpcDescriptorLookupMock.mockResolvedValueOnce({
      ok: true,
      op: 'lookup_descriptor',
      data: FIXTURE_DESCRIPTOR,
    });
    const descriptor = await resolveGrpcWorkflowDescriptorByKey(FIXTURE_DESCRIPTOR.key);
    expect(descriptor).toEqual(FIXTURE_DESCRIPTOR);
    expect(postGrpcDescriptorLookupMock).toHaveBeenCalledWith({
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      requestId: expect.stringMatching(/^wf-desc-/),
    });
  });

  it('rejects empty descriptor keys', async () => {
    await expect(resolveGrpcWorkflowDescriptorByKey('   ')).rejects.toThrow(/required/i);
    expect(postGrpcDescriptorLookupMock).not.toHaveBeenCalled();
  });
});
