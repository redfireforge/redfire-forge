/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { runGraph } from './graphRunner';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';
import { makeNode, startNode, endNode } from './graphRunnerNodeHandlers.test-utils';

describe('graphRunner dispatch switch coverage gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches kafkaTrigger through runGraph', async () => {
    const trigger = makeNode('kt', 'kafkaTrigger', { clusterId: 'cluster-1', topic: 'orders' });
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };
    const message = JSON.stringify({
      topic: 'orders',
      partition: 0,
      offset: '1',
      value: '{"id":1}',
      timestamp: '0',
    });

    await runGraph(
      [trigger, endNode('e1')],
      [{ id: 'e1', source: 'kt', target: 'e1' }],
      { __kafkaTriggerMessage: message },
      cb,
    );

    expect(cb.onComplete).toHaveBeenCalled();
  });

  it('dispatches graphqlAssert through runGraph', async () => {
    const gqlAssert = makeNode('ga', 'graphqlAssert', {
      label: 'GQL Assert',
      sourceVariable: 'payload',
      failBehavior: 'error',
      assertions: [{ id: '1', jsonPath: '$.ok', operator: 'exists' }],
    });
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph(
      [startNode('s1'), gqlAssert, endNode('e1')],
      [
        { id: 'e1', source: 's1', target: 'ga' },
        { id: 'e2', source: 'ga', target: 'e1' },
      ],
      { payload: '{"ok":true}' },
      cb,
    );

    expect(cb.onComplete).toHaveBeenCalled();
    expect(cb.onNodeStateChange.mock.calls.some(([id, st]) => id === 'ga' && st.state === 'pass')).toBe(true);
  });

  it('dispatches wsSend and grpcUnary through runGraph', async () => {
    const wsConnect = makeNode('wsc', 'wsConnect', {
      label: 'WS Connect',
      url: 'ws://localhost:8080/ws',
      headers: [],
      queryParams: [],
      subprotocols: [],
      connectionId: 'conn-1',
      timeoutMs: 5000,
      outputBindings: [],
    });
    const wsSend = makeNode('wss', 'wsSend', {
      label: 'WS Send',
      connectionId: 'conn-1',
      message: '{"ping":true}',
      messageType: 'text',
      waitForResponse: false,
      responseTimeoutMs: 1000,
      outputBindings: [],
    });
    const grpcUnary = makeNode('gu', 'grpcUnary', {
      label: 'Echo Unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target.address,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      callType: 'unary',
      body: { message: 'hello' },
    });
    const wsOperations = {
      connect: vi.fn().mockResolvedValue({
        connectionId: 'conn-1',
        protocol: 'graphql-ws',
        extensions: '',
        latencyMs: 5,
      }),
      send: vi.fn().mockResolvedValue({ latencyMs: 3 }),
      snapshotCursor: vi.fn().mockResolvedValue('cur-0'),
      waitForMessage: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
      disconnectAll: vi.fn().mockResolvedValue(undefined),
    };
    const grpcOperations = {
      invokeUnary: vi.fn().mockResolvedValue({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'ok' },
        durationMs: 1,
      }),
      collectServerStream: vi.fn(),
    };
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph(
      [startNode('s1'), wsConnect, wsSend, grpcUnary, endNode('end1')],
      [
        { id: 'e1', source: 's1', target: 'wsc' },
        { id: 'e2', source: 'wsc', target: 'wss' },
        { id: 'e3', source: 'wss', target: 'gu' },
        { id: 'e4', source: 'gu', target: 'end1' },
      ],
      {},
      cb,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, wsOperations, grpcOperations,
    );

    expect(wsOperations.connect).toHaveBeenCalled();
    expect(wsOperations.send).toHaveBeenCalled();
    expect(grpcOperations.invokeUnary).toHaveBeenCalled();
  });

  it('dispatches kafkaProduce through runGraph', async () => {
    const produce = makeNode('kp', 'kafkaProduce', {
      label: 'Produce',
      clusterId: 'cluster-1',
      topic: 'orders',
      key: 'k1',
      value: '{"id":1}',
      headers: [],
    });
    const kafkaOperations = {
      produce: vi.fn().mockResolvedValue(null),
      consume: vi.fn().mockResolvedValue([]),
    };
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph(
      [startNode('s1'), produce, endNode('e1')],
      [
        { id: 'e1', source: 's1', target: 'kp' },
        { id: 'e2', source: 'kp', target: 'e1' },
      ],
      {},
      cb,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, kafkaOperations,
    );

    expect(kafkaOperations.produce).toHaveBeenCalled();
  });

  it('dispatches grpcLoadTest, grpcSchemaDiff, and grpcMockAssert through runGraph', async () => {
    const { FIXTURE_DESCRIPTOR, FIXTURE_DESCRIPTOR_KEY } = await import('../../../shared/grpc/contractFixtures');
    const loadTest = makeNode('lt', 'grpcLoadTest', {
      label: 'Load Test',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
      body: {},
      profileId: '   ',
    });
    const schemaDiff = makeNode('sd', 'grpcSchemaDiff', {
      label: 'Schema Diff',
      leftDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
      rightDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
    });
    const mockAssert = makeNode('ma', 'grpcMockAssert', {
      label: 'Mock Assert',
      listenTarget: '127.0.0.1:50061',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      expectedStatus: 0,
    });
    const grpcOperations = {
      invokeUnary: vi.fn().mockResolvedValue({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { payload: { value: 'ok' } },
        durationMs: 1,
      }),
      collectServerStream: vi.fn(),
      resolveDescriptor: vi.fn().mockResolvedValue(FIXTURE_DESCRIPTOR),
    };
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph(
      [startNode('s1'), loadTest, endNode('e1')],
      [{ id: 'e1', source: 's1', target: 'lt' }, { id: 'e2', source: 'lt', target: 'e1' }],
      {},
      cb,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, grpcOperations,
    );
    await runGraph(
      [startNode('s2'), schemaDiff, endNode('e2')],
      [{ id: 'e3', source: 's2', target: 'sd' }, { id: 'e4', source: 'sd', target: 'e2' }],
      {},
      cb,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, grpcOperations,
    );
    await runGraph(
      [startNode('s3'), mockAssert, endNode('e3')],
      [{ id: 'e5', source: 's3', target: 'ma' }, { id: 'e6', source: 'ma', target: 'e3' }],
      {},
      cb,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, grpcOperations,
    );

    expect(cb.onComplete).toHaveBeenCalled();
    expect(grpcOperations.resolveDescriptor).toHaveBeenCalled();
  });
});
