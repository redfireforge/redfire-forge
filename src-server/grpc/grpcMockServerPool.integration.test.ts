/**
 * @vitest-environment node
 *
 * Integration: dialable mock listener + grpc-js client unary hit.
 */
import * as grpc from '@grpc/grpc-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../src/shared/grpc/contractFixtures.js';
import { clearDynamicProtoCodecCache, decodeProtoMessage, encodeProtoMessage } from './dynamicProtoCodec.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from './descriptorStore.js';
import { GrpcMockServerPool, resetGrpcMockServerPoolForTests } from './grpcMockServerPool.js';
import { resetServerGrpcMockRuntimeRegistryForTests } from './grpcMockServerRuntimeBridge.js';
import { grpcJsClient } from './grpcClient.js';

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
    pool = new GrpcMockServerPool();
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
});
