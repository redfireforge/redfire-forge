/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import protobuf from 'protobufjs';

const mockValidateResolvedGrpcTargetAddress = vi.fn();
const mockBuildGrpcChannelCredentials = vi.fn(() => ({}));
const mockMergeProtobufRoots = vi.fn((roots: protobuf.Root[]) => roots[0] ?? new protobuf.Root());

class MockReflection {
  static instances: MockReflection[] = [];

  readonly version: string;
  listServicesMock = vi.fn();
  getDescriptorBySymbolMock = vi.fn();

  constructor(_address: string, _credentials: unknown, _options: unknown, version: string) {
    this.version = version;
    MockReflection.instances.push(this);
  }

  listServices(...args: unknown[]) {
    return this.listServicesMock(...args);
  }

  getDescriptorBySymbol(...args: unknown[]) {
    return this.getDescriptorBySymbolMock(...args);
  }
}

vi.mock('./grpcJsLoader.js', () => ({
  grpc: {
    CallOptions: undefined,
  },
}));

vi.mock('grpc-js-reflection-client', () => ({
  GrpcReflection: MockReflection,
}));

vi.mock('../../src/shared/grpc/targetValidation.js', () => ({
  validateResolvedGrpcTargetAddress: (...args: unknown[]) => mockValidateResolvedGrpcTargetAddress(...args),
  preferIpv4LoopbackDialAddress: (address: string) => address,
}));

vi.mock('./grpcChannelCredentials.js', () => ({
  buildGrpcChannelCredentials: (...args: unknown[]) => mockBuildGrpcChannelCredentials(...args),
}));

vi.mock('./descriptorNormalizer.js', () => ({
  mergeProtobufRoots: (...args: unknown[]) => mockMergeProtobufRoots(...args),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  mockValidateResolvedGrpcTargetAddress.mockReset();
  mockBuildGrpcChannelCredentials.mockReset();
  mockMergeProtobufRoots.mockReset();
  MockReflection.instances = [];
  mockBuildGrpcChannelCredentials.mockReturnValue({});
  mockMergeProtobufRoots.mockImplementation((roots: protobuf.Root[]) => roots[0] ?? new protobuf.Root());
  mockValidateResolvedGrpcTargetAddress.mockReturnValue({
    valid: true,
    kind: 'remote',
    normalized: 'dns:///example.com:443',
  });
});

const importClient = async () => import('./reflectionClient.js');

describe('reflectionClient', () => {
  it('rejects in-process targets before dialing', async () => {
    const { GrpcReflectionClient } = await importClient();
    mockValidateResolvedGrpcTargetAddress.mockReturnValueOnce({
      valid: true,
      kind: 'in_process',
      normalized: 'in-process:demo',
    });
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'in-process:demo',
      timeoutMs: 1000,
    })).rejects.toThrow(/not dialable/);
  });

  it('rejects invalid target addresses', async () => {
    const { GrpcReflectionClient } = await importClient();
    mockValidateResolvedGrpcTargetAddress.mockReturnValueOnce({
      valid: false,
      reason: 'host:port required',
    });
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'not-a-target',
      timeoutMs: 1000,
    })).rejects.toThrow(/host:port/);
  });

  it('filters infra services and returns the merged root for multiple discovered services', async () => {
    const { GrpcReflectionClient } = await importClient();
    const client = new GrpcReflectionClient();
    const mergedRoot = new protobuf.Root();
    mockMergeProtobufRoots.mockReturnValueOnce(mergedRoot);

    const firstRoot = new protobuf.Root();
    const secondRoot = new protobuf.Root();
    const listServicesSpy = vi.spyOn(MockReflection.prototype, 'listServices').mockResolvedValueOnce([
      'grpc.reflection.v1.ServerReflection',
      'grpc.health.v1.Health',
      'acme.orders.v1.OrderService',
      'acme.payments.v1.PaymentService',
    ]);
    const getDescriptorSpy = vi.spyOn(MockReflection.prototype, 'getDescriptorBySymbol')
      .mockResolvedValueOnce({ getProtobufJsRoot: () => firstRoot })
      .mockResolvedValueOnce({ getProtobufJsRoot: () => secondRoot });

    const result = await client.fetchReflectionRoot({
      address: 'https://example.com:443',
      timeoutMs: 1000,
    });

    expect(result.root).toBe(mergedRoot);
    expect(result.reflectionVersion).toBe('v1');
    expect(result.serviceNames).toEqual([
      'acme.orders.v1.OrderService',
      'acme.payments.v1.PaymentService',
    ]);
    expect(mockMergeProtobufRoots).toHaveBeenCalledWith([firstRoot, secondRoot]);
    expect(listServicesSpy).toHaveBeenCalled();
    expect(getDescriptorSpy).toHaveBeenCalledTimes(2);
    expect(MockReflection.instances.map(instance => instance.version)).toEqual(['v1', 'v1']);
  });

  it('falls back to v1alpha and raises a reflection failure when the second attempt fails', async () => {
    const { GrpcReflectionClient, ReflectionFetchError } = await importClient();
    const client = new GrpcReflectionClient();
    const listServicesSpy = vi.spyOn(MockReflection.prototype, 'listServices')
      .mockRejectedValueOnce(new Error('internal parser failed'))
      .mockResolvedValueOnce(['acme.orders.v1.OrderService']);
    const getDescriptorSpy = vi.spyOn(MockReflection.prototype, 'getDescriptorBySymbol')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(client.fetchReflectionRoot({
      address: 'https://example.com:443',
      timeoutMs: 1000,
    })).rejects.toBeInstanceOf(ReflectionFetchError);

    expect(MockReflection.instances.map(instance => instance.version)).toEqual(['v1', 'v1alpha', 'v1alpha']);
    expect(listServicesSpy).toHaveBeenCalledTimes(2);
    expect(getDescriptorSpy).toHaveBeenCalledTimes(1);
  });
});
