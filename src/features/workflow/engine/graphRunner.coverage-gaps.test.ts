import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionTraceOptions, WorkflowIterationTrace } from '../../../shared/types';
import type { WorkflowEdge, WorkflowNode } from '../types/workflow';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../graphql/utils/graphqlProxyTransports', () => ({
  getProxyBase: vi.fn(() => 'http://localhost:4000'),
  createWsProxyTransport: vi.fn(),
  createSseProxyTransport: vi.fn(),
}));

vi.mock('../../graphql/utils/graphqlClient', () => ({
  deriveWsEndpoint: vi.fn((url: string) => url.replace(/^http/, 'ws')),
}));

vi.mock('../../graphql/utils/authUtils', () => ({
  buildAuthHeaders: vi.fn(() => ({})),
}));

vi.mock('../../graphql/utils/apqClient', () => ({
  computeAPQHash: vi.fn(async () => 'mock-hash'),
}));

vi.mock('graphql', () => ({
  buildClientSchema: vi.fn(() => ({
    getTypeMap: () => ({
      Query: { name: 'Query', getFields: () => ({ user: {} }) },
    }),
    getQueryType: () => ({ name: 'Query' }),
    getType: vi.fn(() => undefined),
  })),
  printSchema: vi.fn(() => 'type Query { user: String }'),
  isObjectType: vi.fn(() => false),
}));

import { runGraph } from './graphRunner';
import { httpFetch } from '../../../shared/utils/httpClient';
import { httpNode, startNode, endNode } from './graphRunnerNodeHandlers.test-utils';
import { createSseProxyTransport } from '../../graphql/utils/graphqlProxyTransports';
import { makeNode } from './graphRunnerNodeHandlers.test-utils';

const mockFetch = vi.mocked(httpFetch);
const mockSseTransport = vi.mocked(createSseProxyTransport);

function makeCallbacks() {
  let capturedTrace: WorkflowIterationTrace | undefined;
  return {
    cbs: {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn((_r: unknown, _p: unknown, _d: unknown, trace?: WorkflowIterationTrace) => {
        capturedTrace = trace;
      }),
      onLog: vi.fn(),
    },
    getTrace: () => capturedTrace,
  };
}

describe('graphRunner — coverage gaps', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockSseTransport.mockReset();
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
    mockSseTransport.mockReturnValue({
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue({ data: { ok: true } }),
      close: vi.fn(),
    } as never);
  });

  it('uses node type as label when data.label is missing', async () => {
    const start = httpNode('h0', 'Start');
    const bare: ReturnType<typeof httpNode> = {
      ...httpNode('bare', ''),
      data: { config: { url: 'http://example.com/bare', method: 'GET' } },
    };
    delete (bare.data as { label?: string }).label;
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
      onLog: vi.fn(),
    };
    await runGraph([start, bare], [{ id: 'e1', source: 'h0', target: 'bare' }], {}, cb);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('completes immediately when workflow has no start nodes', async () => {
    const a = httpNode('a', 'A');
    const b = httpNode('b', 'B');
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };
    await runGraph(
      [a, b],
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
      {},
      cb,
    );
    expect(cb.onComplete).toHaveBeenCalledWith([], true, 0);
  });

  it('uses node id as label when data has no label or name', async () => {
    const start = httpNode('h0', 'Start');
    const bare = {
      id: 'bare-id',
      type: 'http',
      position: { x: 0, y: 0 },
      data: { config: { url: 'http://example.com/x', method: 'GET' } },
    } as ReturnType<typeof httpNode>;
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
      onLog: vi.fn(),
    };
    await runGraph([start, bare], [{ id: 'e1', source: 'h0', target: 'bare-id' }], {}, cb);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('handles non-Error fetch rejection with string message', async () => {
    mockFetch.mockRejectedValueOnce('network string error');
    const start = httpNode('h0', 'Start');
    const http = httpNode('h1', 'HTTP');
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
      onLog: vi.fn(),
    };
    await runGraph([start, http], [{ id: 'e1', source: 'h0', target: 'h1' }], {}, cb);
    expect(cb.onComplete).toHaveBeenCalled();
  });

  it('skips edges whose endpoints are missing from the node list', async () => {
    const start = httpNode('h0', 'Start');
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };
    await runGraph([start], [{ id: 'e1', source: 'h0', target: 'missing' }], {}, cb);
    expect(cb.onComplete).toHaveBeenCalled();
  });

  it('uses data.name as label when label is absent', async () => {
    const start = httpNode('h0', 'Start');
    const named = {
      id: 'named',
      type: 'http',
      position: { x: 0, y: 0 },
      data: { name: 'NamedNode', config: { url: 'http://example.com/n', method: 'GET' } },
    } as ReturnType<typeof httpNode>;
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
      onLog: vi.fn(),
    };
    await runGraph([start, named], [{ id: 'e1', source: 'h0', target: 'named' }], {}, cb);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('returns early when debugController stops while paused', async () => {
    const { DebugController } = await import('./debugController');
    const n1 = httpNode('n1', 'First');
    const nodes: WorkflowNode[] = [n1];
    const edges: WorkflowEdge[] = [];
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };
    const dc = new DebugController();
    const runPromise = runGraph(nodes, edges, {}, cb, undefined, undefined, undefined, undefined, dc);
    await new Promise((r) => setTimeout(r, 50));
    dc.stop();
    dc.stepNode('n1');
    await runPromise;
    expect(cb.onComplete).toHaveBeenCalled();
  });

  it('runGraph dispatches graphqlIntrospect node type', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        data: {
          __schema: {
            types: [{ name: 'Query', kind: 'OBJECT', fields: [] }],
          },
        },
      }),
    });

    const introspect = makeNode('intro', 'graphqlIntrospect', {
      label: 'Intro',
      endpoint: 'http://api.example.com/graphql',
      headers: [],
      outputBindings: [],
    });
    const nodes = [startNode('s1'), introspect, endNode('e1')];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'intro' },
      { id: 'e2', source: 'intro', target: 'e1' },
    ];
    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'standard' };

    await runGraph(nodes, edges, {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, opts);

    expect(getTrace()?.events.some((e) => e.nodeId === 'intro')).toBe(true);
  });

  it('runGraph dispatches graphqlMutation node type', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { createUser: { id: '1' } } }),
    });

    const mutation = makeNode('mut', 'graphqlMutation', {
      label: 'Mut',
      endpoint: 'http://api.example.com/graphql',
      query: 'mutation { createUser { id } }',
      variables: '{}',
      headers: [],
      outputBindings: [],
      extractionRules: [],
    });
    const nodes = [startNode('s1'), mutation, endNode('e1')];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'mut' },
      { id: 'e2', source: 'mut', target: 'e1' },
    ];
    const { cbs, getTrace } = makeCallbacks();

    await runGraph(nodes, edges, {}, cbs);

    expect(getTrace()?.events.some((e) => e.nodeId === 'mut')).toBe(true);
  });

  it('runGraph dispatches graphqlSubscription node type', async () => {
    vi.mocked(createSseProxyTransport).mockReturnValue({
      type: 'sse',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        callbacks.onComplete();
        return vi.fn();
      }),
    } as never);

    const subscription = makeNode('sub', 'graphqlSubscription', {
      label: 'Sub',
      endpoint: 'http://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
      variables: '{}',
      headers: [],
      transport: 'sse',
      outputBindings: [],
      stopAfterMessages: 1,
    });
    const nodes = [startNode('s1'), subscription, endNode('e1')];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'sub' },
      { id: 'e2', source: 'sub', target: 'e1' },
    ];
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
      onLog: vi.fn(),
    };

    await runGraph(nodes, edges, {}, cb);

    expect(cb.onNodeStateChange.mock.calls.some(([id]) => id === 'sub')).toBe(true);
  });

  it('minimal trace captures graphql transport errors', async () => {
    const gqlQuery = makeNode('gq', 'graphqlQuery', {
      label: 'GQL',
      endpoint: 'http://api.example.com/graphql',
      query: '{ user { id } }',
      variables: '{}',
      headers: [],
      outputBindings: [],
      extractionRules: [],
    });
    mockFetch.mockRejectedValueOnce(new Error('gql down'));
    const nodes = [startNode('s1'), gqlQuery, endNode('e1')];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'gq' },
      { id: 'e2', source: 'gq', target: 'e1' },
    ];
    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'minimal' };

    await runGraph(nodes, edges, {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, opts);

    const ev = getTrace()?.events.find((e) => e.nodeId === 'gq' && e.state === 'fail');
    expect(ev?.details?.error).toBeTruthy();
  });

  it('kafkaConsume trace branch records consume body and count', async () => {
    const consumeNode: WorkflowNode = {
      id: 'c1',
      type: 'kafkaConsume',
      position: { x: 0, y: 0 },
      data: {
        label: 'Consume',
        clusterId: 'cluster-1',
        topic: 'orders',
        groupId: '',
        startPosition: 'latest',
        timeoutMs: '1000',
        maxMessages: '1',
        keyEquals: '',
        headerMatch: '',
        jsonPath: '',
        jsonPathEquals: '',
      } as WorkflowNode['data'],
    };
    const kafkaOperations = {
      produce: vi.fn().mockResolvedValue(null),
      consume: vi.fn().mockResolvedValue([{
        topic: 'orders', partition: 0, offset: '5', timestamp: '0',
        key: 'k1', value: '{"id":99}', headers: {},
      }]),
    };
    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'standard' };

    await runGraph([consumeNode], [], {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, opts,
      undefined, kafkaOperations);

    const ev = getTrace()?.events.find((e) => e.nodeId === 'c1');
    expect(ev).toBeDefined();
  });
});
