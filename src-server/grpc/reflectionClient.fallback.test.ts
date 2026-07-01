/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_ECHO_PROTO } from '../../src/shared/grpc/contractFixtures.js';
import { parseProtoFiles } from './protoDescriptorParser.js';

const listServices = vi.fn();
const getDescriptorBySymbol = vi.fn();

vi.mock('grpc-js-reflection-client', () => ({
  GrpcReflection: class {
    version: string;
    constructor(_host: string, _creds: unknown, _opts: unknown, version = 'v1alpha') {
      this.version = version;
    }
    listServices = listServices;
    getDescriptorBySymbol = getDescriptorBySymbol;
  },
}));

describe('reflectionClient fallback', () => {
  beforeEach(() => {
    listServices.mockReset();
    getDescriptorBySymbol.mockReset();
  });

  it('falls back from v1 to v1alpha when v1 reflection is unavailable', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    listServices
      .mockRejectedValueOnce(new Error('UNIMPLEMENTED: reflection v1'))
      .mockResolvedValueOnce(['echo.EchoService']);
    getDescriptorBySymbol.mockResolvedValue({
      getProtobufJsRoot: () => root,
    });

    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    const result = await client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 1000,
    });

    expect(result.reflectionVersion).toBe('v1alpha');
    expect(result.serviceNames).toEqual(['echo.EchoService']);
    expect(listServices).toHaveBeenCalledTimes(2);
  });

  it('does not fall back to v1alpha when requested services are missing on v1', async () => {
    listServices.mockResolvedValueOnce(['echo.EchoService']);

    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 1000,
      serviceNames: ['missing.Service'],
    })).rejects.toThrow(/No matching services found via reflection/);

    expect(listServices).toHaveBeenCalledTimes(1);
  });

  it('filters grpc.reflection infrastructure services from discovery', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    listServices.mockResolvedValueOnce([
      'grpc.reflection.v1.ServerReflection',
      'echo.EchoService',
    ]);
    getDescriptorBySymbol.mockResolvedValue({
      getProtobufJsRoot: () => root,
    });

    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    const result = await client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 1000,
    });

    expect(result.serviceNames).toEqual(['echo.EchoService']);
    expect(getDescriptorBySymbol).toHaveBeenCalledWith('echo.EchoService', expect.any(Object));
  });

  it('fails when only infrastructure services are discovered', async () => {
    listServices.mockResolvedValueOnce(['grpc.reflection.v1.ServerReflection', 'grpc.health.v1.Health']);

    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 1000,
    })).rejects.toThrow(/No user-facing gRPC services found via reflection/);
  });

  it('shares one overall deadline across v1 and v1alpha attempts', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const capturedDeadlines: number[] = [];
    listServices.mockImplementation(async (_filter, options?: { deadline?: number }) => {
      capturedDeadlines.push(options?.deadline ?? 0);
      if (capturedDeadlines.length === 1) {
        throw new Error('UNIMPLEMENTED: reflection v1');
      }
      return ['echo.EchoService'];
    });
    getDescriptorBySymbol.mockResolvedValue({
      getProtobufJsRoot: () => root,
    });

    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    await client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 1000,
    });

    expect(capturedDeadlines).toHaveLength(2);
    expect(capturedDeadlines[1]).toBe(capturedDeadlines[0]);
  });

  it('does not retry v1alpha after the overall reflection deadline expires', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    vi.setSystemTime(start);

    listServices.mockImplementationOnce(async () => {
      vi.setSystemTime(start + 1001);
      throw new Error('UNIMPLEMENTED: reflection v1');
    });

    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 1000,
    })).rejects.toThrow(/DEADLINE_EXCEEDED|reflection timed out/i);

    expect(listServices).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('throws ReflectionFetchError when v1 and v1alpha both fail with unavailable errors', async () => {
    listServices
      .mockRejectedValueOnce(new Error('UNIMPLEMENTED: reflection v1'))
      .mockRejectedValueOnce(new Error('Method not found on v1alpha'));

    const { GrpcReflectionClient, ReflectionFetchError } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 1000,
    })).rejects.toBeInstanceOf(ReflectionFetchError);
  });

  it('merges multiple reflected services that share imported proto files', async () => {
    const commonProto = `syntax = "proto3";
package common;
message Shared { string id = 1; }`;
    const svc1Proto = `syntax = "proto3";
package a;
import "common.proto";
message Req1 { common.Shared s = 1; }
message Res1 { string ok = 1; }
service Svc1 { rpc Call(Req1) returns (Res1); }`;
    const svc2Proto = `syntax = "proto3";
package b;
import "common.proto";
message Req2 { common.Shared s = 1; }
message Res2 { string ok = 1; }
service Svc2 { rpc Call(Req2) returns (Res2); }`;

    const root1 = parseProtoFiles([
      { path: 'common.proto', content: commonProto },
      { path: 'a.proto', content: svc1Proto },
    ]);
    const root2 = parseProtoFiles([
      { path: 'common.proto', content: commonProto },
      { path: 'b.proto', content: svc2Proto },
    ]);

    listServices.mockResolvedValueOnce(['a.Svc1', 'b.Svc2']);
    getDescriptorBySymbol
      .mockResolvedValueOnce({ getProtobufJsRoot: () => root1 })
      .mockResolvedValueOnce({ getProtobufJsRoot: () => root2 });

    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    const result = await client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 1000,
    });

    expect(result.serviceNames).toEqual(['a.Svc1', 'b.Svc2']);
    expect(result.root.lookupService('a.Svc1')?.name).toBe('Svc1');
    expect(result.root.lookupService('b.Svc2')?.name).toBe('Svc2');
    expect(getDescriptorBySymbol).toHaveBeenCalledTimes(2);
  });
});
