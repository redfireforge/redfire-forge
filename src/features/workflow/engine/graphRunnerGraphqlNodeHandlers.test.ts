/**
 * Tests for GraphQL workflow node handlers:
 *   graphqlQuery / graphqlMutation — handleGraphqlQueryNode
 *   graphqlSubscription            — handleGraphqlSubscriptionNode
 *   graphqlIntrospect              — handleGraphqlIntrospectNode
 *   graphqlAssert                  — handleGraphqlAssertNode
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleGraphqlQueryNode,
  handleGraphqlSubscriptionNode,
  handleGraphqlIntrospectNode,
  handleGraphqlAssertNode,
} from './graphRunnerGraphqlNodeHandlers';
import { runGraph } from './graphRunner';
import type {
  GraphqlQueryNodeData,
  GraphqlSubscriptionNodeData,
  GraphqlIntrospectNodeData,
  GraphqlAssertNodeData,
} from '../types/workflow';
import {
  makeNode,
  makeCallbacks,
  makeHandlerContext,
  makePassedFlag,
  startNode,
  endNode,
} from './graphRunnerNodeHandlers.test-utils';

// ── Mock external modules ──────────────────────────────────────────────────────

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
  computeAPQHash: vi.fn(async (_: string) => 'mock-schema-hash'),
}));

vi.mock('graphql', () => ({
  buildClientSchema: vi.fn(() => ({
    getTypeMap: () => ({
      Query: { name: 'Query', getFields: () => ({ user: {}, viewer: {} }) },
      User: { name: 'User', getFields: () => ({ id: {}, name: {} }) },
    }),
    getQueryType: () => ({ name: 'Query' }),
    getType: vi.fn((name: string) => name === 'User' ? { name: 'User', getFields: () => ({ id: {}, name: {} }) } : undefined),
  })),
  printSchema: vi.fn(() => 'type Query { user: User }'),
  isObjectType: vi.fn((t: unknown) => typeof (t as { getFields?: unknown })?.getFields === 'function'),
}));

import { createWsProxyTransport, createSseProxyTransport } from '../../graphql/utils/graphqlProxyTransports';
import { buildClientSchema, isObjectType } from 'graphql';

// ── Node factories ─────────────────────────────────────────────────────────────

function queryNode(id: string, data: Partial<GraphqlQueryNodeData> = {}) {
  return makeNode(id, 'graphqlQuery', {
    label: 'GQL Query',
    endpoint: 'http://api.example.com/graphql',
    query: '{ user { id name } }',
    variables: '{}',
    headers: [],
    outputBindings: [],
    extractionRules: [],
    ...data,
  });
}

function mutationNode(id: string, data: Partial<GraphqlQueryNodeData> = {}) {
  return makeNode(id, 'graphqlMutation', {
    label: 'GQL Mutation',
    endpoint: 'http://api.example.com/graphql',
    query: 'mutation { createUser(name: "Test") { id } }',
    variables: '{}',
    headers: [],
    outputBindings: [],
    extractionRules: [],
    ...data,
  });
}

function subscriptionNode(id: string, data: Partial<GraphqlSubscriptionNodeData> = {}) {
  return makeNode(id, 'graphqlSubscription', {
    label: 'GQL Sub',
    endpoint: 'http://api.example.com/graphql',
    subscriptionQuery: 'subscription { messages { text } }',
    variables: '{}',
    headers: [],
    outputBindings: [],
    stopAfterMessages: 2,
    ...data,
  });
}

function introspectNode(id: string, data: Partial<GraphqlIntrospectNodeData> = {}) {
  return makeNode(id, 'graphqlIntrospect', {
    label: 'GQL Introspect',
    endpoint: 'http://api.example.com/graphql',
    headers: [],
    outputBindings: [],
    requiredTypes: [],
    requiredFields: [],
    ...data,
  });
}

function assertNode(id: string, data: Partial<GraphqlAssertNodeData> = {}) {
  return makeNode(id, 'graphqlAssert', {
    label: 'GQL Assert',
    sourceVariable: 'myData',
    assertions: [],
    failBehavior: 'error',
    ...data,
  });
}

// ── Mock fetch helper ──────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

// ── handleGraphqlQueryNode ─────────────────────────────────────────────────────

describe('handleGraphqlQueryNode — graphqlQuery', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
    vi.restoreAllMocks();
  });

  it('posts query and advances the graph on success', async () => {
    mockFetch({ data: { user: { id: '1', name: 'Alice' } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q1');

    await handleGraphqlQueryNode('q1', node, hCtx, passed);

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/api/graphql/query');
    expect(JSON.parse(init.body as string)).toMatchObject({ endpoint: 'http://api.example.com/graphql', query: '{ user { id name } }' });
    expect(passed.value).toBe(true);
    expect(cbResult.states['q1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('q1', 'main');
  });

  it('persists responseDetail and extracted map on success for config panel Test button', async () => {
    mockFetch({ data: { user: { id: '42' } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q1b', {
      extractionRules: [{ variableName: 'userId', jsonPath: '$.user.id' }],
    });

    await handleGraphqlQueryNode('q1b', node, hCtx, passed);

    const status = cbResult.states['q1b'];
    expect(status?.responseDetail).toBeTruthy();
    const snap = JSON.parse(status!.responseDetail!) as { data?: { user?: { id: string } } };
    expect(snap.data?.user?.id).toBe('42');
    expect(status?.extracted?.userId).toBe('"42"');
  });

  it('fails when endpoint is blank', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q2', { endpoint: '' });

    await handleGraphqlQueryNode('q2', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['q2']?.state).toBe('fail');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('fails when query is blank', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q3', { query: '' });

    await handleGraphqlQueryNode('q3', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['q3']?.state).toBe('fail');
  });

  it('fails when variables JSON is invalid after interpolation', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q4', { variables: '{broken' });

    await handleGraphqlQueryNode('q4', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['q4']?.state).toBe('fail');
  });

  it('marks as failed when response has GraphQL errors', async () => {
    mockFetch({ data: null, errors: [{ message: 'Field not found' }] });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q5');

    await handleGraphqlQueryNode('q5', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['q5']?.state).toBe('fail');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('applies extraction rules into ctx variables', async () => {
    mockFetch({ data: { user: { id: '42', name: 'Bob' } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q6', {
      extractionRules: [{ id: 'r1', variableName: 'userId', jsonPath: '$.user.id' }],
    });

    await handleGraphqlQueryNode('q6', node, hCtx, passed);

    expect(hCtx.ctx.get('userId')).toBe('"42"');
    expect(passed.value).toBe(true);
  });

  it('passes headers in the request body (not as HTTP headers on the proxy call)', async () => {
    mockFetch({ data: {} });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q8', {
      headers: [{ id: 'h1', key: 'X-Custom', value: 'abc', enabled: true }],
    });

    await handleGraphqlQueryNode('q8', node, hCtx, passed);

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    // The HTTP-level Content-Type should NOT include user headers (those go in body.headers)
    expect((init.headers as Record<string, string>)['X-Custom']).toBeUndefined();
    // User headers must be in the body for the proxy to forward them (key casing preserved)
    const body = JSON.parse(init.body as string);
    expect(body.headers['X-Custom']).toBe('abc');
    expect(passed.value).toBe(true);
  });

  it('fails when the proxy returns a non-ok HTTP status', async () => {
    mockFetch({ ok: false, error: { message: 'Upstream unreachable' } }, 502);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q9');

    await handleGraphqlQueryNode('q9', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['q9']?.state).toBe('fail');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('uses proxy body.message when non-ok response lacks error.message', async () => {
    mockFetch({ message: 'Gateway unavailable' }, 503);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();

    await handleGraphqlQueryNode('q9b', queryNode('q9b'), hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['q9b']?.error).toBe('Gateway unavailable');
  });

  it('keeps default proxy HTTP error when error body cannot be parsed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 504,
      json: async () => {
        throw new Error('invalid json');
      },
    } as unknown as Response);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();

    await handleGraphqlQueryNode('q9c', queryNode('q9c'), hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['q9c']?.error).toContain('HTTP 504');
  });

  it('applies output bindings for string and non-string values while skipping disabled/blank bindings', async () => {
    mockFetch({ data: { user: { id: '7' } }, errors: ['warn'] });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q12', {
      outputBindings: [
        { field: 'operationName', variableName: 'opName', enabled: true },
        { field: 'data', variableName: 'payload', enabled: true },
        { field: 'errors', variableName: '', enabled: true },
        { field: 'httpStatus', variableName: 'skipDisabled', enabled: false },
      ],
    });

    await handleGraphqlQueryNode('q12', node, hCtx, passed);

    expect(hCtx.ctx.get('opName')).toBe('GQL Query');
    expect(hCtx.ctx.get('payload')).toContain('"user"');
    expect(hCtx.ctx.get('skipDisabled')).toBeUndefined();
  });

  it('enforces timeoutMs — fails when fetch rejects with a timeout DOMException', async () => {
    const timeoutErr = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(timeoutErr);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q10', { timeoutMs: 100 });

    await handleGraphqlQueryNode('q10', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['q10']?.state).toBe('fail');
    expect(cbResult.states['q10']?.error).toContain('timeout');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('does not include timeoutMs in the fetch body (proxy ignores it)', async () => {
    const spy = mockFetch({ data: { user: { id: 1 } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const node = queryNode('q11', { timeoutMs: 5000 });

    await handleGraphqlQueryNode('q11', node, hCtx, makePassedFlag());

    const bodyStr = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
    expect(bodyStr).not.toHaveProperty('timeoutMs');
  });

  it('composes AbortSignal.any when hCtx.abortSignal is provided (covers cond-expr#27[0])', async () => {
    const controller = new AbortController();
    mockFetch({ data: { user: { id: '1' } } });
    // Pass a non-aborted signal — handler should compose AbortSignal.any([timeout, signal])
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, abortSignal: controller.signal });
    const passed = makePassedFlag();
    const node = queryNode('q_abort', { timeoutMs: 30000 });

    await handleGraphqlQueryNode('q_abort', node, hCtx, passed);

    expect(passed.value).toBe(true);
    // The test just verifies no crash when abortSignal is provided
    expect(cbResult.states['q_abort']?.state).toBe('pass');
  });
});

describe('handleGraphqlQueryNode — graphqlMutation', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
    vi.restoreAllMocks();
  });

  it('sends mutation request and advances the graph', async () => {
    mockFetch({ data: { createUser: { id: '10' } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = mutationNode('m1');

    await handleGraphqlQueryNode('m1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['m1']?.state).toBe('pass');
    const result = hCtx.results[0];
    expect(result?.transportType).toBe('graphqlMutation');
    expect(result?.method).toBe('MUTATION');
  });

  it('fails when variables JSON is invalid after interpolation', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = mutationNode('m2', { variables: '{not-json' });

    await handleGraphqlQueryNode('m2', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['m2']?.state).toBe('fail');
    expect(hCtx.results[0]?.errorMessage).toContain('Invalid JSON in variables');
  });
});

  describe('handleGraphqlQueryNode — mutation failure branches (covers L189/L196 cond-expr[0])', () => {
    let cbResult: ReturnType<typeof makeCallbacks>;
    beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); });

    it('fails with graphqlMutation transport when MUTATION endpoint is blank', async () => {
      const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
      const passed = makePassedFlag();
      const node = mutationNode('mblank1', { endpoint: '' });

      await handleGraphqlQueryNode('mblank1', node, hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.results[0]?.transportType).toBe('graphqlMutation');
      expect(hCtx.results[0]?.errorMessage).toContain('Endpoint is required');
    });

    it('fails with graphqlMutation transport when MUTATION query is blank', async () => {
      const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
      const passed = makePassedFlag();
      const node = mutationNode('mblank2', { query: '' });

      await handleGraphqlQueryNode('mblank2', node, hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.results[0]?.transportType).toBe('graphqlMutation');
      expect(hCtx.results[0]?.errorMessage).toContain('Query is required');
    });

    it('uses empty string for operationName when data.label is undefined (covers L218 binary-expr)', async () => {
      mockFetch({ data: { user: { id: '1' } } });
      const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
      const passed = makePassedFlag();
      const node = makeNode('q_nolabel', 'graphqlQuery', {
        label: undefined,
        endpoint: 'http://api.example.com/graphql',
        query: '{ user { id } }',
        variables: '{}',
        headers: [],
        timeoutMs: 30000,
        extractionRules: [],
        outputBindings: [
          { field: 'operationName', variableName: 'opName', enabled: true },
        ],
      });

      await handleGraphqlQueryNode('q_nolabel', node, hCtx, passed);

      // operationName binding gets '' (empty string from data.label ?? '')
      expect(hCtx.ctx.get('opName')).toBe('');
      expect(passed.value).toBe(true);
    });

    it('builds runStateBase with extraction results when extract rules match (covers L258 extracted>0 branch)', async () => {
      mockFetch({ data: { user: { id: '42', name: 'Alice' } } });
      const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
      const passed = makePassedFlag();
      const node = queryNode('q_extract2', {
        extractionRules: [{ variableName: 'uid', jsonPath: '$.user.id' }],
      });

      await handleGraphqlQueryNode('q_extract2', node, hCtx, passed);

      const status = cbResult.states['q_extract2'];
      // extracted map has values (Object.keys(extracted).length > 0) → cond-expr[0]
      expect(status?.extracted).toBeDefined();
      expect(status?.extracted?.uid).toBe('"42"');
      expect(passed.value).toBe(true);
    });
  });

  describe('handleGraphqlIntrospectNode — with abortSignal (covers L429/L431)', () => {
    let cbResult: ReturnType<typeof makeCallbacks>;
    beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); });

    it('composes AbortSignal.any when hCtx.abortSignal is provided', async () => {
      const controller = new AbortController();
      mockFetch({ data: { __schema: { types: [] } } });
      const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, abortSignal: controller.signal });
      const passed = makePassedFlag();
      const node = introspectNode('i_abort');

      await handleGraphqlIntrospectNode('i_abort', node, hCtx, passed);

      expect(passed.value).toBe(true);
      expect(cbResult.states['i_abort']?.state).toBe('pass');
    });
  });

// ── handleGraphqlSubscriptionNode ─────────────────────────────────────────────

describe('handleGraphqlSubscriptionNode', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
    vi.restoreAllMocks();
    vi.mocked(createWsProxyTransport).mockClear();
    vi.mocked(createSseProxyTransport).mockClear();
  });

  it('subscribes and collects messages then advances graph', async () => {
    const messages = [{ text: 'hello' }, { text: 'world' }];
    let msgIndex = 0;
    const mockUnsubscribe = vi.fn();

    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        // Simulate delivering 2 messages async
        setTimeout(() => {
          callbacks.onMessage(messages[msgIndex++]);
          callbacks.onMessage(messages[msgIndex++]);
        }, 0);
        return mockUnsubscribe;
      }),
    });

    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s1', { stopAfterMessages: 2 });

    await handleGraphqlSubscriptionNode('s1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['s1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('s1', 'main');
  });

  it('fails when endpoint is blank', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s2', { endpoint: '' });

    await handleGraphqlSubscriptionNode('s2', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['s2']?.state).toBe('fail');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('fails when subscriptionQuery is blank', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s3', { subscriptionQuery: '' });

    await handleGraphqlSubscriptionNode('s3', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['s3']?.state).toBe('fail');
  });

  it('fails when variables JSON is invalid after interpolation', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s3b', { variables: '{bad-json' });

    await handleGraphqlSubscriptionNode('s3b', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['s3b']?.state).toBe('fail');
    expect(createWsProxyTransport).not.toHaveBeenCalled();
  });

  it('returns early when abortSignal is already aborted before transport starts', async () => {
    const controller = new AbortController();
    controller.abort();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      abortSignal: controller.signal,
    });
    const passed = makePassedFlag();
    const node = subscriptionNode('s3c');

    await handleGraphqlSubscriptionNode('s3c', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['s3c']?.state).toBe('fail');
    expect(cbResult.states['s3c']?.error).toBe('Aborted before subscription started');
    expect(createWsProxyTransport).not.toHaveBeenCalled();
    expect(hCtx.results[0]?.errorMessage).toBe('Aborted before subscription started');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('marks as failed when subscription errors', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => callbacks.onError('connection refused'), 0);
        return vi.fn();
      }),
    });

    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s4');

    await handleGraphqlSubscriptionNode('s4', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['s4']?.state).toBe('fail');
  });

  it('completes cleanly when onComplete fires before stop condition', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => {
          callbacks.onMessage({ value: 1 });
          callbacks.onComplete();
        }, 0);
        return vi.fn();
      }),
    });

    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s5', { stopAfterMessages: 10 });

    await handleGraphqlSubscriptionNode('s5', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['s5']?.state).toBe('pass');
  });

  it('applies extractionRules to each received message (jsonPath on inner data)', async () => {
    // Real GraphQL subscription messages are { data: { field: value } } — the proxy
    // always wraps the result in a `data` envelope. extractionRules.jsonPath is
    // applied to msg.data (consistent with query extraction rules and the JSDoc).
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => {
          callbacks.onMessage({ data: { item: { id: 'msg-1' } } });
          callbacks.onComplete();
        }, 0);
        return vi.fn();
      }),
    });

    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s6', {
      stopAfterMessages: 1,
      extractionRules: [{ variableName: 'lastItemId', jsonPath: '$.item.id' }],
    });

    await handleGraphqlSubscriptionNode('s6', node, hCtx, passed);

    expect(hCtx.ctx.get('lastItemId')).toBe('"msg-1"');
    expect(passed.value).toBe(true);
  });

  it('uses legacy graphql-ws protocol when selected', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => callbacks.onComplete(), 0);
        return vi.fn();
      }),
    });

    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s7', {
      subscriptionTransport: 'graphql-ws',
      stopAfterMessages: 0,
    });

    await handleGraphqlSubscriptionNode('s7', node, hCtx, passed);

    expect(createWsProxyTransport).toHaveBeenCalledWith('graphql-ws', undefined);
    expect(passed.value).toBe(true);
  });

  it('uses SSE transport when selected', async () => {
    vi.mocked(createSseProxyTransport).mockReturnValue({
      type: 'sse',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => callbacks.onComplete(), 0);
        return vi.fn();
      }),
    });

    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s8', { subscriptionTransport: 'sse' });

    await handleGraphqlSubscriptionNode('s8', node, hCtx, passed);

    expect(createSseProxyTransport).toHaveBeenCalledOnce();
    expect(createWsProxyTransport).not.toHaveBeenCalled();
    expect(passed.value).toBe(true);
  });

  it('stops on stopCondition and writes mapped subscription output fields', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => {
          callbacks.onMessage({ data: { done: true, item: { id: '44' } } });
        }, 0);
        return vi.fn();
      }),
    });

    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s9', {
      stopAfterMessages: 0,
      stopCondition: '$.done',
      outputBindings: [
        { field: 'messageCount', variableName: 'msgCount', enabled: true },
        { field: 'lastMessage', variableName: 'lastMsg', enabled: true },
        { field: 'latencyMs', variableName: 'lat', enabled: true },
      ],
    });

    await handleGraphqlSubscriptionNode('s9', node, hCtx, passed);

    expect(hCtx.ctx.get('msgCount')).toBe('1');
    expect(hCtx.ctx.get('lastMsg')).toContain('"done":true');
    expect(Number(hCtx.ctx.get('lat'))).toBeGreaterThanOrEqual(0);
    expect(passed.value).toBe(true);
  });

  it('completes via stopAfterMs timer and handles abort during active subscription', async () => {
    const controller = new AbortController();
    const unsub = vi.fn();
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn(() => unsub),
    });

    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, abortSignal: controller.signal });
    const passed = makePassedFlag();
    const node = subscriptionNode('s10', {
      stopAfterMessages: 0,
      stopAfterMs: 10,
    });

    setTimeout(() => controller.abort(), 1);
    await handleGraphqlSubscriptionNode('s10', node, hCtx, passed);

    expect(unsub).toHaveBeenCalled();
    expect(passed.value).toBe(true);
  });
});

// ── handleGraphqlIntrospectNode ────────────────────────────────────────────────

describe('handleGraphqlIntrospectNode', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
    vi.restoreAllMocks();
  });

  it('fetches schema and advances graph on success', async () => {
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i1');

    await handleGraphqlIntrospectNode('i1', node, hCtx, passed);

    // Must call /api/graphql/query (not /api/graphql/introspect — that route doesn't exist)
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/graphql/query');
    expect(passed.value).toBe(true);
    expect(cbResult.states['i1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('i1', 'main');
  });

  it('fails when introspection is disabled (GraphQL errors returned)', async () => {
    mockFetch({ data: null, errors: [{ message: 'Introspection not allowed' }] });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i7');

    await handleGraphqlIntrospectNode('i7', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['i7']?.state).toBe('fail');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('fails when endpoint is blank', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i2', { endpoint: '' });

    await handleGraphqlIntrospectNode('i2', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['i2']?.state).toBe('fail');
  });

  it('fails when introspection HTTP call fails (non-ok status)', async () => {
    mockFetch({ error: 'server error' }, 500);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i3');

    await handleGraphqlIntrospectNode('i3', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['i3']?.state).toBe('fail');
  });

  it('uses proxy response message for non-ok introspection responses', async () => {
    mockFetch({ message: 'Proxy upstream failed' }, 502);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();

    await handleGraphqlIntrospectNode('i3b', introspectNode('i3b'), hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['i3b']?.error).toBe('Proxy upstream failed');
  });

  it('falls back to default HTTP error when introspection error body cannot be parsed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('bad payload');
      },
    } as unknown as Response);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();

    await handleGraphqlIntrospectNode('i3c', introspectNode('i3c'), hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['i3c']?.error).toContain('HTTP 503');
  });

  it('applies sdl and typeCount output bindings', async () => {
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i4', {
      outputBindings: [
        { id: 'b1', field: 'sdl', variableName: 'mySdl', enabled: true },
        { id: 'b2', field: 'typeCount', variableName: 'myCount', enabled: true },
      ],
    });

    await handleGraphqlIntrospectNode('i4', node, hCtx, passed);

    expect(hCtx.ctx.get('mySdl')).toContain('Query');
    expect(hCtx.ctx.get('myCount')).toBeDefined();
    expect(passed.value).toBe(true);
  });

  it('fails validation when minTypeCount not met', async () => {
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i5', { minTypeCount: 100 });

    await handleGraphqlIntrospectNode('i5', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['i5']?.state).toBe('fail');
  });

  it('fails validation when requiredTypes are missing', async () => {
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i6', { requiredTypes: ['NonExistentType'] });

    await handleGraphqlIntrospectNode('i6', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['i6']?.state).toBe('fail');
  });

  it('fails validation when requiredFields entry is missing on type', async () => {
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i8', {
      requiredFields: [{ typeName: 'User', fieldName: 'email' }],
    });

    await handleGraphqlIntrospectNode('i8', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['i8']?.error).toContain('User.email');
  });
});

// ── handleGraphqlAssertNode ────────────────────────────────────────────────────

describe('handleGraphqlAssertNode', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
  });

  it('passes with no assertions', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { myData: '{"count": 5}' },
    });
    const passed = makePassedFlag();
    const node = assertNode('a1', { assertions: [] });

    await handleGraphqlAssertNode('a1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['a1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('a1', 'main');
  });

  it('passes when all assertions succeed', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { myData: '{"count": 5, "name": "test"}' },
    });
    const passed = makePassedFlag();
    const node = assertNode('a2', {
      assertions: [
        { id: 'x1', jsonPath: '$.name', operator: 'equals', expectedValue: 'test' },
      ],
    });

    await handleGraphqlAssertNode('a2', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['a2']?.state).toBe('pass');
  });

  it('fails when assertion fails and failBehavior is error', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { myData: '{"count": 3}' },
    });
    const passed = makePassedFlag();
    const node = assertNode('a3', {
      failBehavior: 'error',
      assertions: [
        { id: 'x2', jsonPath: '$.count', operator: 'equals', expectedValue: '5' },
      ],
    });

    await handleGraphqlAssertNode('a3', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['a3']?.state).toBe('fail');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('continues when assertion fails and failBehavior is warn', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { myData: '{"count": 3}' },
    });
    const passed = makePassedFlag();
    const node = assertNode('a4', {
      failBehavior: 'warn',
      assertions: [
        { id: 'x3', jsonPath: '$.count', operator: 'equals', expectedValue: '5' },
      ],
    });

    await handleGraphqlAssertNode('a4', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['a4']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('a4', 'main');
  });

  it('fails when sourceVariable is blank', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = assertNode('a5', { sourceVariable: '' });

    await handleGraphqlAssertNode('a5', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['a5']?.state).toBe('fail');
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('handles non-JSON source variable values gracefully', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { myData: 'just-a-string' },
    });
    const passed = makePassedFlag();
    const node = assertNode('a6', {
      assertions: [
        { id: 'x4', jsonPath: '$', operator: 'exists' },
      ],
    });

    await handleGraphqlAssertNode('a6', node, hCtx, passed);

    // 'exists' on a non-null value should pass
    expect(passed.value).toBe(true);
  });
});

// ── Output binding helper branch coverage ────────────────────────────────────

describe('applyQueryOutputBindings — branch coverage', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); });

  it('applies binding to null/undefined field (errors absent in success response)', async () => {
    // errors is undefined in the response → v ?? '' takes the '' path (binary-expr#4[1])
    mockFetch({ data: { user: { id: '1' } } /* no errors field */ });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('q20', 'graphqlQuery', {
      label: 'Q',
      endpoint: 'http://api.example.com/graphql',
      query: '{ user { id } }',
      variables: '{}',
      headers: [],
      timeoutMs: 30000,
      extractionRules: [],
      outputBindings: [
        { field: 'errors', variableName: 'errOut', enabled: true },
      ],
    });

    await handleGraphqlQueryNode('q20', node, hCtx, passed);

    // errors was undefined → JSON.stringify(undefined ?? '') = JSON.stringify('') = '""'
    expect(hCtx.ctx.get('errOut')).toBeDefined();
    expect(passed.value).toBe(true);
  });

  it('skips binding where variableName is empty but enabled=true (if#5[0] short-circuit right side)', async () => {
    // enabled=true + variableName='' → !b.variableName is TRUE → continue
    mockFetch({ data: { user: { id: '2' } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('q21', 'graphqlQuery', {
      label: 'Q',
      endpoint: 'http://api.example.com/graphql',
      query: '{ user { id } }',
      variables: '{}',
      headers: [],
      timeoutMs: 30000,
      extractionRules: [],
      outputBindings: [
        { field: 'data', variableName: '', enabled: true },          // empty name → skip
        { field: 'latencyMs', variableName: 'lat', enabled: true },  // valid → set
      ],
    });

    await handleGraphqlQueryNode('q21', node, hCtx, passed);

    expect(hCtx.ctx.get('lat')).toBeDefined();
    expect(passed.value).toBe(true);
  });
});

describe('applySubscriptionOutputBindings — branch coverage', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); vi.mocked(createWsProxyTransport).mockClear(); });

  it('skips disabled subscription output binding (if#5[0] hits continue)', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => { callbacks.onComplete(); }, 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('ss1', 'graphqlSubscription', {
      label: 'Sub',
      endpoint: 'http://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
      variables: '{}',
      headers: [],
      stopAfterMessages: 0,
      extractionRules: [],
      outputBindings: [
        { field: 'messageCount', variableName: 'cnt', enabled: false }, // disabled → continue
        { field: 'latencyMs', variableName: 'lat', enabled: true },     // valid
      ],
    });

    await handleGraphqlSubscriptionNode('ss1', node, hCtx, passed);

    expect(hCtx.ctx.get('cnt')).toBeUndefined(); // disabled → skipped
    expect(hCtx.ctx.get('lat')).toBeDefined();
    expect(passed.value).toBe(true);
  });

  it('handles string-valued firstMessage binding (cond-expr#7[0])', async () => {
    // Message whose .data field IS a string → typeof v === 'string' → first branch
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => {
          callbacks.onMessage({ data: 'string-payload' }); // data is a string
          callbacks.onComplete();
        }, 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('ss2', 'graphqlSubscription', {
      label: 'Sub',
      endpoint: 'http://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
      variables: '{}',
      headers: [],
      stopAfterMessages: 1,
      extractionRules: [],
      outputBindings: [
        { field: 'firstMessage', variableName: 'first', enabled: true },
      ],
    });

    await handleGraphqlSubscriptionNode('ss2', node, hCtx, passed);

    // firstMessage is 'string-payload' (a string) → stored directly (not JSON.stringify-wrapped)
    expect(hCtx.ctx.get('first')).toBe('string-payload');
    expect(passed.value).toBe(true);
  });

  it('handles null firstMessage/lastMessage when no messages (binary-expr#8[1] — v ?? empty)', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => { callbacks.onComplete(); }, 0); // completes immediately with 0 messages
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('ss3', 'graphqlSubscription', {
      label: 'Sub',
      endpoint: 'http://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
      variables: '{}',
      headers: [],
      stopAfterMessages: 0,
      extractionRules: [],
      outputBindings: [
        { field: 'firstMessage', variableName: 'first', enabled: true },  // null → JSON.stringify(null ?? '') 
        { field: 'messages', variableName: 'msgs', enabled: true },        // empty array
      ],
    });

    await handleGraphqlSubscriptionNode('ss3', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('first')).toBeDefined(); // null → serialized
  });
});

describe('handleGraphqlSubscriptionNode — abortSignal present (covers L429 if#62[0])', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); vi.mocked(createWsProxyTransport).mockClear(); });

  it('registers abort listener when hCtx.abortSignal is provided and subscription completes normally', async () => {
    const controller = new AbortController();
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => {
          callbacks.onMessage({ data: { ping: true } });
          callbacks.onComplete();
        }, 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, abortSignal: controller.signal });
    const passed = makePassedFlag();
    const node = subscriptionNode('s_with_signal', { stopAfterMessages: 1 });

    await handleGraphqlSubscriptionNode('s_with_signal', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['s_with_signal']?.state).toBe('pass');
  });
});

describe('applyIntrospectOutputBindings — branch coverage', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); });

  it('skips disabled introspect output binding (if#9[0] continues)', async () => {
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('ii1', {
      outputBindings: [
        { field: 'sdl', variableName: '', enabled: true },
        { field: 'typeCount', variableName: 'tc', enabled: true },
        { field: 'fieldCount', variableName: 'fc', enabled: false },
        { field: 'queryTypeName', variableName: 'qt', enabled: true },
      ],
    });

    await handleGraphqlIntrospectNode('ii1', node, hCtx, passed);

    expect(hCtx.ctx.get('tc')).toBeDefined();
    expect(hCtx.ctx.get('fc')).toBeUndefined();
    expect(hCtx.ctx.get('qt')).toBeDefined();
    expect(passed.value).toBe(true);
  });
});

// ── Additional branch coverage ─────────────────────────────────────────────────

describe('handleGraphqlQueryNode — proxy error body fallback branches', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); });

  it('keeps default HTTP error msg when errBody has neither error.message nor message (L206 cond-expr[1])', async () => {
    // errBody = {} — neither error.message nor message defined → both conditions false → keep default
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({}),
    } as unknown as Response);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    await handleGraphqlQueryNode('qerr1', queryNode('qerr1'), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(cbResult.states['qerr1']?.error).toContain('HTTP 502');
  });

  it('stores empty string when getByPath returns undefined for extraction rule (L286 binary-expr[1] right side)', async () => {
    // Query extraction rule: path not found → extractedVal=undefined → stores ''
    mockFetch({ data: { user: { id: '1' } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('qext1', {
      extractionRules: [
        { variableName: 'missingField', jsonPath: '$.user.nonExistent' },
      ],
    });
    await handleGraphqlQueryNode('qext1', node, hCtx, passed);
    expect(hCtx.ctx.get('missingField')).toBe('');
    expect(passed.value).toBe(true);
  });

  it('applies extraction rule when path IS found (L286 binary-expr[1] — JSON.stringify path)', async () => {
    // extractedVal IS defined (not undefined) → JSON.stringify(extractedVal)
    mockFetch({ data: { user: { id: '42' } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('qext2', {
      extractionRules: [{ variableName: 'uid', jsonPath: '$.user.id' }],
    });
    await handleGraphqlQueryNode('qext2', node, hCtx, passed);
    expect(hCtx.ctx.get('uid')).toBe('"42"');
    expect(passed.value).toBe(true);
  });

  it('handles empty-string variables (L206 cond-expr[1] — rawVariables falsy → {} fallback)', async () => {
    // data.variables = '' → rawVariables = '' (falsy) → parsedVariables = {}
    mockFetch({ data: { ok: true } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('q_emptyvar', { variables: '' });
    await handleGraphqlQueryNode('q_emptyvar', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles undefined data.variables (L202 binary-expr[1] — variables ?? {} fallback)', async () => {
    // data.variables is undefined → data.variables ?? '{}' takes right side → rawVariables = '{}'
    mockFetch({ data: { ok: true } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('q_undefvar', 'graphqlQuery', {
      label: 'Q',
      endpoint: 'http://api.example.com/graphql',
      query: '{ user { id } }',
      // variables intentionally omitted → data.variables = undefined → uses '{}' fallback
      headers: [],
      extractionRules: [],
      outputBindings: [],
    });
    await handleGraphqlQueryNode('q_undefvar', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles undefined data.headers (L218 binary-expr[1] — headers ?? [] fallback)', async () => {
    // data.headers is undefined → buildGraphqlHeaders(data.headers ?? [], ...) uses [] fallback
    mockFetch({ data: { ok: true } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('q_nohdr', 'graphqlQuery', {
      label: 'Q',
      endpoint: 'http://api.example.com/graphql',
      query: '{ user { id } }',
      variables: '{}',
      // headers intentionally omitted → undefined → data.headers ?? [] uses right side
      extractionRules: [],
      outputBindings: [],
    });
    await handleGraphqlQueryNode('q_nohdr', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles undefined extractionRules (L264+L279 binary-expr[1] — extractionRules ?? [] fallback)', async () => {
    // data.extractionRules is undefined → both buildExtractedVariableMap and for-loop use [] fallback
    mockFetch({ data: { user: { id: '1' } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('q_noex', 'graphqlQuery', {
      label: 'Q',
      endpoint: 'http://api.example.com/graphql',
      query: '{ user { id } }',
      variables: '{}',
      headers: [],
      // extractionRules intentionally omitted → undefined → uses [] fallback
      outputBindings: [],
    });
    await handleGraphqlQueryNode('q_noex', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles undefined outputBindings (L286 binary-expr[1] — outputBindings ?? [] fallback)', async () => {
    // data.outputBindings is undefined → applyQueryOutputBindings(data.outputBindings ?? [], ...) uses []
    mockFetch({ data: { user: { id: '1' } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('q_noob', 'graphqlQuery', {
      label: 'Q',
      endpoint: 'http://api.example.com/graphql',
      query: '{ user { id } }',
      variables: '{}',
      headers: [],
      extractionRules: [],
      // outputBindings intentionally omitted → undefined → uses [] fallback
    });
    await handleGraphqlQueryNode('q_noob', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('skips extraction rule when jsonPath is blank (L280 if[0] — continue path)', async () => {
    mockFetch({ data: { user: { id: '5' } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = queryNode('qblank_path', {
      extractionRules: [
        { variableName: 'v1', jsonPath: '' },         // blank jsonPath → skip
        { variableName: 'v2', jsonPath: '$.user.id' }, // valid
      ],
    });
    await handleGraphqlQueryNode('qblank_path', node, hCtx, passed);
    expect(hCtx.ctx.get('v1')).toBeUndefined();
    expect(hCtx.ctx.get('v2')).toBe('"5"');
    expect(passed.value).toBe(true);
  });
});

describe('handleGraphqlQueryNode — mutation catch branches (L318/L320)', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); });

  it('logs mutation catch correctly with mutation transport type (L318/L320 cond-expr[0] — mutation=true)', async () => {
    // Mutation throws → catch block with isMutation=true → 'graphqlMutation' transport
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fetch failed'));
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = mutationNode('m_catch');
    await handleGraphqlQueryNode('m_catch', node, hCtx, passed);
    expect(passed.value).toBe(false);
    expect(hCtx.results[0]?.transportType).toBe('graphqlMutation');
  });
});

describe('handleGraphqlQueryNode — mutation proxy error body fallback (L218 binary-expr)', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); });

  it('keeps default HTTP error when mutation errBody has neither field (L218 cond-expr[1])', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    await handleGraphqlQueryNode('merr1', mutationNode('merr1'), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(cbResult.states['merr1']?.error).toContain('HTTP 503');
  });
});

describe('handleGraphqlSubscriptionNode — additional branches', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); vi.mocked(createWsProxyTransport).mockClear(); });

  it('uses stopAfterMs timeout to end subscription (L440 — stopAfterMs set)', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, _callbacks) => vi.fn()), // never calls onComplete
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s_timeout', {
      stopAfterMs: 10, // triggers setTimeout path
      stopAfterMessages: undefined,
    });
    await handleGraphqlSubscriptionNode('s_timeout', node, hCtx, passed);
    expect(passed.value).toBe(true);
    expect(cbResult.states['s_timeout']?.state).toBe('pass');
  });

  it('applies subscription extraction rule when extracted value is defined (JSON.stringify path)', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => {
          callbacks.onMessage({ data: { value: 42 } });
          callbacks.onComplete();
        }, 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s_extr', {
      stopAfterMessages: 1,
      extractionRules: [{ variableName: 'val', jsonPath: '$.value' }],
    });
    await handleGraphqlSubscriptionNode('s_extr', node, hCtx, passed);
    // extracted IS defined → stored as JSON.stringify(42)='42'
    expect(hCtx.ctx.get('val')).toBe('42');
    expect(passed.value).toBe(true);
  });

  it('stores empty string when subscription extraction rule finds nothing', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => {
          callbacks.onMessage({ data: { other: 1 } });
          callbacks.onComplete();
        }, 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s_miss', {
      stopAfterMessages: 1,
      extractionRules: [{ variableName: 'missing', jsonPath: '$.notHere' }],
    });
    await handleGraphqlSubscriptionNode('s_miss', node, hCtx, passed);
    expect(hCtx.ctx.get('missing')).toBe('');
    expect(passed.value).toBe(true);
  });

  it('skips subscription extraction rule when variableName is blank', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => {
          callbacks.onMessage({ data: { value: 1 } });
          callbacks.onComplete();
        }, 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s_noval', {
      stopAfterMessages: 1,
      extractionRules: [
        { variableName: '', jsonPath: '$.value' },       // blank name → skip
        { variableName: 'good', jsonPath: '$.value' },   // valid
      ],
    });
    await handleGraphqlSubscriptionNode('s_noval', node, hCtx, passed);
    expect(hCtx.ctx.get('good')).toBe('1');
    expect(passed.value).toBe(true);
  });

  it('skips subscription extraction rule when jsonPath is blank', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => {
          callbacks.onMessage({ data: { val: 7 } });
          callbacks.onComplete();
        }, 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s_nopath', {
      stopAfterMessages: 1,
      extractionRules: [
        { variableName: 'skipped', jsonPath: '' },   // blank jsonPath → skip
        { variableName: 'good', jsonPath: '$.val' }, // valid
      ],
    });
    await handleGraphqlSubscriptionNode('s_nopath', node, hCtx, passed);
    expect(hCtx.ctx.get('skipped')).toBeUndefined();
    expect(hCtx.ctx.get('good')).toBe('7');
    expect(passed.value).toBe(true);
  });

  it('handles subscription with undefined variables (L369 binary-expr[1] — variables ?? {})', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => callbacks.onComplete(), 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('s_novar', 'graphqlSubscription', {
      label: 'Sub',
      endpoint: 'http://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
      // variables intentionally omitted → undefined → data.variables ?? '{}' uses right side
      headers: [],
      outputBindings: [],
      stopAfterMessages: 0,
      extractionRules: [],
    });
    await handleGraphqlSubscriptionNode('s_novar', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles subscription with empty-string variables (L373 cond-expr[1] — rawVariables falsy → {} fallback)', async () => {
    // data.variables = '' → rawVariables = '' (falsy) → parsedVariables = {}
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => callbacks.onComplete(), 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s_emptyvar', { variables: '' });
    await handleGraphqlSubscriptionNode('s_emptyvar', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles subscription with undefined headers (L383 binary-expr[1] — headers ?? [])', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => callbacks.onComplete(), 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('s_nohdr', 'graphqlSubscription', {
      label: 'Sub',
      endpoint: 'http://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
      variables: '{}',
      // headers intentionally omitted → undefined → data.headers ?? [] uses right side
      outputBindings: [],
      stopAfterMessages: 0,
      extractionRules: [],
    });
    await handleGraphqlSubscriptionNode('s_nohdr', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('continues subscription when stopCondition is NOT met (L440 if[1] — condMet=false)', async () => {
    // stopCondition: path that returns falsy → condMet=false → subscription does NOT stop
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => {
          callbacks.onMessage({ data: { done: false } }); // condMet=false → continues
          callbacks.onMessage({ data: { done: true } });  // condMet=true → stops
          callbacks.onComplete();
        }, 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = subscriptionNode('s_cond', {
      stopAfterMessages: undefined,
      stopCondition: '$.done', // truthy when done=true
      extractionRules: [],
    });
    await handleGraphqlSubscriptionNode('s_cond', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles subscription with undefined outputBindings (L455 binary-expr[1] — outputBindings ?? [])', async () => {
    vi.mocked(createWsProxyTransport).mockReturnValue({
      type: 'ws',
      execute: vi.fn(),
      subscribe: vi.fn((_q, _v, _op, _params, callbacks) => {
        setTimeout(() => callbacks.onComplete(), 0);
        return vi.fn();
      }),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('s_noobbind', 'graphqlSubscription', {
      label: 'Sub',
      endpoint: 'http://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
      variables: '{}',
      headers: [],
      stopAfterMessages: 0,
      extractionRules: [],
      // outputBindings intentionally omitted → undefined → uses [] fallback
    });
    await handleGraphqlSubscriptionNode('s_noobbind', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });
});

describe('handleGraphqlIntrospectNode — additional branches', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  beforeEach(() => { cbResult = makeCallbacks(); vi.restoreAllMocks(); });

  it('passes validation when minTypeCount is set and schema has enough types', async () => {
    // minTypeCount = 1, schema has 2 types (Query, User) → passes validation
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i_mintypes_pass', { minTypeCount: 1 });
    await handleGraphqlIntrospectNode('i_mintypes_pass', node, hCtx, passed);
    expect(passed.value).toBe(true);
    expect(cbResult.states['i_mintypes_pass']?.state).toBe('pass');
  });

  it('passes when requiredTypes list is present and type exists', async () => {
    // requiredTypes = ['User'] → schema.getType('User') returns truthy → passes
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i_reqtype_pass', { requiredTypes: ['User'] });
    await handleGraphqlIntrospectNode('i_reqtype_pass', node, hCtx, passed);
    expect(passed.value).toBe(true);
    expect(cbResult.states['i_reqtype_pass']?.state).toBe('pass');
  });

  it('passes when requiredFields exist on type', async () => {
    // User.id exists → passes
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i_reqfield_pass', {
      requiredFields: [{ typeName: 'User', fieldName: 'id' }],
    });
    await handleGraphqlIntrospectNode('i_reqfield_pass', node, hCtx, passed);
    expect(passed.value).toBe(true);
    expect(cbResult.states['i_reqfield_pass']?.state).toBe('pass');
  });

  it('uses error body message for introspect HTTP error (L264 — errBody.message branch)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ message: 'Service down' }),
    } as unknown as Response);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    await handleGraphqlIntrospectNode('i_msg', introspectNode('i_msg'), hCtx, passed);
    expect(cbResult.states['i_msg']?.error).toBe('Service down');
  });

  it('uses error.message from error body for introspect HTTP error (L561 if[0] truthy path)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: { message: 'Upstream error' } }),
    } as unknown as Response);
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    await handleGraphqlIntrospectNode('i_errobj', introspectNode('i_errobj'), hCtx, passed);
    expect(cbResult.states['i_errobj']?.error).toBe('Upstream error');
  });

  it('uses JSON.stringify(errors) when introspect returns errors array (L575 truthy path)', async () => {
    // errors IS truthy → uses JSON.stringify(errors) path
    mockFetch({ errors: [{ message: 'Forbidden' }] /* no data */ });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    await handleGraphqlIntrospectNode('i_gqlerr', introspectNode('i_gqlerr'), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(cbResult.states['i_gqlerr']?.error).toContain('Forbidden');
  });

  it('uses "No schema data returned" message when introspect returns no data and no errors (L575[1] falsy path)', async () => {
    // data is undefined AND errors is falsy → takes [1] branch: 'No schema data returned'
    mockFetch({}); // no data, no errors
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    await handleGraphqlIntrospectNode('i_nodata', introspectNode('i_nodata'), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(cbResult.states['i_nodata']?.error).toContain('No schema data');
  });

  it('handles schema with non-object types (L590[1] — isObjectType=false, returns 0 in reduce)', async () => {
    // Override buildClientSchema mock to return schema with scalar (non-object) types
    vi.mocked(buildClientSchema).mockImplementationOnce(() => ({
      getTypeMap: () => ({
        // 'String' is a ScalarType, not ObjectType → isObjectType returns false → reduces to 0
        String: { name: 'String' }, // no getFields → isObjectType(String)=false
      }),
      getQueryType: () => null, // null → ?? 'Query' triggers L594[1]
      getType: vi.fn(() => undefined),
    } as unknown as ReturnType<typeof buildClientSchema>));
    vi.mocked(isObjectType).mockImplementation((t: unknown) => !!(t as { getFields?: unknown })?.getFields);
    mockFetch({ data: { __schema: { types: [{ name: 'String', kind: 'SCALAR' }] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = introspectNode('i_scalar');
    await handleGraphqlIntrospectNode('i_scalar', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles introspect with undefined headers (L525 binary-expr[1] — data.headers ?? [])', async () => {
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('i_nohdr', 'graphqlIntrospect', {
      label: 'Introspect',
      endpoint: 'http://api.example.com/graphql',
      // headers intentionally omitted → undefined → buildGraphqlHeaders(data.headers ?? [], ...)
      outputBindings: [],
      requiredTypes: [],
      requiredFields: [],
    });
    await handleGraphqlIntrospectNode('i_nohdr', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles introspect with undefined outputBindings (L628 binary-expr[1])', async () => {
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('i_noob', 'graphqlIntrospect', {
      label: 'Introspect',
      endpoint: 'http://api.example.com/graphql',
      headers: [],
      // outputBindings intentionally omitted → undefined
      requiredTypes: [],
      requiredFields: [],
    });
    await handleGraphqlIntrospectNode('i_noob', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles introspect with undefined requiredTypes (L605 binary-expr[1])', async () => {
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('i_nort', 'graphqlIntrospect', {
      label: 'Introspect',
      endpoint: 'http://api.example.com/graphql',
      headers: [],
      outputBindings: [],
      // requiredTypes intentionally omitted → undefined → uses [] fallback
      requiredFields: [],
    });
    await handleGraphqlIntrospectNode('i_nort', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('handles introspect with undefined requiredFields (L615 binary-expr[1])', async () => {
    mockFetch({ data: { __schema: { types: [] } } });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = makeNode('i_norf', 'graphqlIntrospect', {
      label: 'Introspect',
      endpoint: 'http://api.example.com/graphql',
      headers: [],
      outputBindings: [],
      requiredTypes: [],
      // requiredFields intentionally omitted → undefined → uses [] fallback
    });
    await handleGraphqlIntrospectNode('i_norf', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });
});

describe('handleGraphqlAssertNode — additional branches', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;
  beforeEach(() => { cbResult = makeCallbacks(); });

  it('uses sourceVariable raw value when it resolves to empty string (L685 cond-expr[1])', async () => {
    // rawSourceValue is '' (variable IS set to empty string) → falsy → sourceValue = '' (falsy path of ternary)
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { emptyVar: '' }, // variable exists but is empty string
    });
    const passed = makePassedFlag();
    const node = assertNode('a_empty', {
      sourceVariable: 'emptyVar', // resolves to '' → rawSourceValue = '' → falsy → [1]
      assertions: [],
    });
    await handleGraphqlAssertNode('a_empty', node, hCtx, passed);
    // No assertions → passes regardless of source value
    expect(passed.value).toBe(true);
  });

  it('uses undefined resolvedExpected when assertion.expectedValue is null (L577 cond-expr[1])', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { myData: '{"count":5}' },
    });
    const passed = makePassedFlag();
    // expectedValue = undefined → resolvedExpected = undefined → `resolvedExpected ?? ''`
    const node = assertNode('a_noexp', {
      assertions: [{ id: 'x', jsonPath: '$.count', operator: 'exists' }],
    });
    await handleGraphqlAssertNode('a_noexp', node, hCtx, passed);
    expect(passed.value).toBe(true);
  });

  it('uses assertion.description when provided instead of auto-generated msg (L590/L703 cond-expr[0])', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { myData: '{"count":3}' },
    });
    const passed = makePassedFlag();
    const node = assertNode('a_desc', {
      failBehavior: 'error',
      assertions: [
        { id: 'x', jsonPath: '$.count', operator: 'equals', expectedValue: '99', description: 'Custom failure msg' },
      ],
    });
    await handleGraphqlAssertNode('a_desc', node, hCtx, passed);
    expect(passed.value).toBe(false);
    expect(cbResult.states['a_desc']?.error).toContain('Custom failure msg');
  });

  it('uses description in warn path and still passes (L703 cond-expr[0])', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { myData: '{"count":3}' },
    });
    const passed = makePassedFlag();
    const node = assertNode('a_wdesc', {
      failBehavior: 'warn',
      assertions: [
        { id: 'x', jsonPath: '$.count', operator: 'equals', expectedValue: '99', description: 'Warn: count mismatch' },
      ],
    });
    await handleGraphqlAssertNode('a_wdesc', node, hCtx, passed);
    expect(passed.value).toBe(true);
    expect(cbResult.states['a_wdesc']?.state).toBe('pass');
  });

  it('uses assertions?.length ?? 0 when assertions is undefined (L594/L692 binary-expr[1])', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { myData: '{"x":1}' },
    });
    const passed = makePassedFlag();
    // assertions field omitted → undefined → `data.assertions?.length ?? 0`
    const node = makeNode('a_noassert', 'graphqlAssert', {
      label: 'Assert',
      sourceVariable: 'myData',
      failBehavior: 'error',
      // assertions intentionally omitted
    });
    await handleGraphqlAssertNode('a_noassert', node, hCtx, passed);
    // no assertions → passes
    expect(passed.value).toBe(true);
  });

  it('resolvedExpected ?? "" fallback when expectedValue absent (L726 binary-expr[1])', async () => {
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { myData: '{"v":1}' },
    });
    const passed = makePassedFlag();
    const node = assertNode('a_noexpv', {
      failBehavior: 'error',
      assertions: [
        { id: 'x', jsonPath: '$.v', operator: 'equals', expectedValue: undefined },
      ],
    });
    await handleGraphqlAssertNode('a_noexpv', node, hCtx, passed);
    // 1 !== '' → fails
    expect(passed.value).toBe(false);
  });
});

describe('runGraph — graphqlAssert dispatcher branch', () => {
  it('executes graphqlAssert node through runGraph node-type dispatch', async () => {
    const assertNodeInstance = assertNode('gql-a', {
      sourceVariable: 'payload',
      failBehavior: 'error',
      assertions: [{ id: '1', jsonPath: '$.ok', operator: 'exists' }],
    });
    const nodes = [startNode('s1'), assertNodeInstance, endNode('e1')];
    const edges = [
      { id: 'e1', source: 's1', target: 'gql-a' },
      { id: 'e2', source: 'gql-a', target: 'e1' },
    ];
    const { callbacks, states } = makeCallbacks();

    await runGraph(nodes, edges, { payload: '{"ok":true}' }, callbacks);

    expect(states['gql-a']?.state).toBe('pass');
  });
});
