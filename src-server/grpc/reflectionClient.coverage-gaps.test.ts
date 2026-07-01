/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listServices = vi.fn();
const getDescriptorBySymbol = vi.fn();

vi.mock('grpc-js-reflection-client', () => ({
  GrpcReflection: class {
    constructor(_host: string, _creds: unknown, _opts: unknown, _version = 'v1alpha') {}
    listServices = listServices;
    getDescriptorBySymbol = getDescriptorBySymbol;
  },
}));

describe('reflectionClient coverage gaps', () => {
  beforeEach(() => {
    listServices.mockReset();
    getDescriptorBySymbol.mockReset();
  });

  it('rethrows v1alpha unreachable errors without wrapping', async () => {
    listServices
      .mockRejectedValueOnce(new Error('UNIMPLEMENTED: reflection v1'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED: connection refused'));

    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 1000,
    })).rejects.toThrow(/ECONNREFUSED/);
  });

  it('exports helper predicates for reflection error classification', async () => {
    const {
      isNoMatchingServicesError,
      isReflectionUnavailableError,
      isUnreachableError,
    } = await import('./reflectionClient.js');

    expect(isNoMatchingServicesError(new Error('No user-facing gRPC services found via reflection'))).toBe(true);
    expect(isReflectionUnavailableError(new Error('UNIMPLEMENTED on reflection'))).toBe(true);
    expect(isUnreachableError(new Error('ECONNREFUSED'))).toBe(true);
  });

  it('throws when reflection deadline is already expired at fetch start', async () => {
    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 0,
    })).rejects.toThrow(/DEADLINE_EXCEEDED|reflection timed out/i);
  });

  it('wraps non-unreachable reflection failures in ReflectionFetchError', async () => {
    listServices
      .mockRejectedValueOnce(new Error('generic v1 failure'))
      .mockRejectedValueOnce(new Error('generic v1alpha failure'));

    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 5_000,
    })).rejects.toMatchObject({ name: 'ReflectionFetchError' });
  });

  it('classifies non-Error values in reflection helper predicates', async () => {
    const {
      isNoMatchingServicesError,
      isReflectionUnavailableError,
      isUnreachableError,
    } = await import('./reflectionClient.js');

    expect(isNoMatchingServicesError('No user-facing gRPC services found via reflection')).toBe(true);
    expect(isReflectionUnavailableError('UNIMPLEMENTED')).toBe(true);
    expect(isUnreachableError('ECONNREFUSED')).toBe(true);
  });
});
