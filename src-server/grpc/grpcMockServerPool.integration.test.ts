/**
 * @vitest-environment node
 *
 * Integration: dialable mock listener + grpc-js client unary hit.
 */
import * as grpc from '@grpc/grpc-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../src/shared/grpc/contractFixtures.js';
import { DescriptorLoader } from './descriptorLoader.js';
import { clearDynamicProtoCodecCache, decodeProtoMessage, encodeProtoMessage } from './dynamicProtoCodec.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from './descriptorStore.js';
import { grpcMockServerPool, GrpcMockServerPool, resetGrpcMockServerPoolForTests } from './grpcMockServerPool.js';
import { resetServerGrpcMockRuntimeRegistryForTests } from './grpcMockServerRuntimeBridge.js';
import { grpcJsClient } from './grpcClient.js';
import { GrpcJsStreamingClient } from './grpcStreamingClient.js';

describe('GrpcMockServerPool integration', () => {
  let pool: GrpcMockServerPool;

  beforeEach(async () => {
    process.env.NO_PROXY = '127.0.0.1,localhost';
    process.env.no_proxy = '127.0.0.1,localhost';
    await resetGrpcMockServerPoolForTests();
    resetServerGrpcMockRuntimeRegistryForTests();
    clearGrpcDescriptorStore();
    clearDynamicProtoCodecCache();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    pool = grpcMockServerPool;
  });

  it('serves unary Echo via external grpc-js client', async () => {
    const result = await pool.start({
      tabId: 'tab-int',
      connectionId: 'conn-int',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: {
        rules: [{
          id: 'echo',
          name: 'Echo rule',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, body: { message: 'from-mock-listener' } },
        }],
      },
    });

    const listenTarget = result.status.listenTarget!;
    const requestBuffer = encodeProtoMessage(
      FIXTURE_DESCRIPTOR,
      'echo.EchoRequest',
      { message: 'hello' },
    );

    const invoke = await grpcJsClient.invokeUnary({
      address: listenTarget,
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer,
      metadata: {},
      timeoutMs: 5000,
      signal: AbortSignal.timeout(5000),
      decodeResponse: (buffer) => decodeProtoMessage(
        FIXTURE_DESCRIPTOR,
        'echo.EchoResponse',
        buffer,
      ),
      tlsMode: 'disabled',
    });

    expect(invoke.status).toBe(grpc.status.OK);
    expect(invoke.body.message).toBe('from-mock-listener');
    await pool.stop('tab-int');
  }, 15000);

  it('serves updated rule body after pool commit', async () => {
    const result = await pool.start({
      tabId: 'tab-int',
      connectionId: 'conn-int',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: {
        rules: [{
          id: 'echo',
          name: 'Echo rule',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, body: { message: 'v1' } },
        }],
      },
    });

    pool.commit({
      tabId: 'tab-int',
      ruleSet: {
        rules: [{
          id: 'echo',
          name: 'Echo rule',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, body: { message: 'v2-after-commit' } },
        }],
      },
    });

    const listenTarget = result.status.listenTarget!;
    const requestBuffer = encodeProtoMessage(
      FIXTURE_DESCRIPTOR,
      'echo.EchoRequest',
      { message: 'hello' },
    );

    const invoke = await grpcJsClient.invokeUnary({
      address: listenTarget,
      service: 'echo.EchoService',
      method: 'Echo',
      requestBuffer,
      metadata: {},
      timeoutMs: 5000,
      signal: AbortSignal.timeout(5000),
      decodeResponse: (buffer) => decodeProtoMessage(
        FIXTURE_DESCRIPTOR,
        'echo.EchoResponse',
        buffer,
      ),
      tlsMode: 'disabled',
    });

    expect(invoke.status).toBe(grpc.status.OK);
    expect(invoke.body.message).toBe('v2-after-commit');
    await pool.stop('tab-int');
  }, 15000);

  it('reflects against a running mock listener without requiring server reflection support', async () => {
    const result = await pool.start({
      tabId: 'tab-reflect',
      connectionId: 'conn-reflect',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: {
        rules: [{
          id: 'echo',
          name: 'Echo rule',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, body: { message: 'from-mock-listener' } },
        }],
      },
    });

    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromReflection({
      requestId: 'req-mock-reflect',
      target: {
        address: result.status.listenTarget!,
        tlsMode: 'disabled',
      },
      timeoutMs: 5_000,
    });

    expect(descriptor.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(descriptor.services.map((service) => service.fullName)).toContain('echo.EchoService');
    await pool.stop('tab-reflect');
  }, 15000);

  it('finishes bidi streams against a running mock listener after client half-close', async () => {
    const result = await pool.start({
      tabId: 'tab-bidi',
      connectionId: 'conn-bidi',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: {
        rules: [{
          id: 'bidi',
          name: 'Bidi rule',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'BidiStream' },
          response: { statusCode: 0, body: { message: 'mock-bidi-ack' } },
        }],
      },
    });

    const listenTarget = result.status.listenTarget!;
    const streamingClient = new GrpcJsStreamingClient();
    const onInboundMessage = vi.fn();
    const onTerminal = vi.fn();
    const onError = vi.fn();
    const requestBuffer = encodeProtoMessage(
      FIXTURE_DESCRIPTOR,
      'echo.EchoRequest',
      { message: '' },
    );

    const handle = streamingClient.startStream({
      address: listenTarget,
      service: 'echo.EchoService',
      method: 'BidiStream',
      callType: 'bidi_streaming',
      requestBuffer,
      metadata: {},
      timeoutMs: 5_000,
      decodeResponse: (buffer) => decodeProtoMessage(
        FIXTURE_DESCRIPTOR,
        'echo.EchoResponse',
        buffer,
      ),
      tlsMode: 'disabled',
    }, {
      onInboundMessage,
      onTerminal,
      onError,
    });

    handle.write(encodeProtoMessage(FIXTURE_DESCRIPTOR, 'echo.EchoRequest', { message: 'hello' }));
    handle.endWrites();

    await vi.waitFor(() => {
      expect(onInboundMessage).toHaveBeenCalledWith(
        { message: 'mock-bidi-ack' },
        expect.objectContaining({ 'content-type': 'application/grpc+proto' }),
      );
      expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ status: 0 }));
    }, { timeout: 5_000 });
    expect(onError).not.toHaveBeenCalled();
    await pool.stop('tab-bidi');
  }, 15000);
});
