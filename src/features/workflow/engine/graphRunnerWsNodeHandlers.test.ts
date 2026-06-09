/**
 * Tests for WebSocket node handlers (connect, send, receive, trigger).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleWsConnectNode,
  handleWsSendNode,
  handleWsReceiveNode,
  handleWsTriggerNode,
  classifyWsFailure,
} from './graphRunnerWsNodeHandlers';
import type {
  WsConnectNodeData,
  WsSendNodeData,
  WsReceiveNodeData,
  WsTriggerNodeData,
} from '../types/workflow';
import type {
  WsNodeOperations,
  WsConnectResult,
  WsReceivedMessage,
} from './graphRunnerNodeHandlerContext';
import {
  makeNode,
  makeCallbacks,
  makeHandlerContext,
  makePassedFlag,
} from './graphRunnerNodeHandlers.test-utils';

function mockWsOps(overrides: Partial<WsNodeOperations> = {}): WsNodeOperations {
  return {
    connect: vi.fn<WsNodeOperations['connect']>().mockResolvedValue({
      connectionId: 'ws-c1',
      protocol: 'graphql-ws',
      extensions: '',
      latencyMs: 12,
    }),
    send: vi.fn<WsNodeOperations['send']>().mockResolvedValue({ latencyMs: 5 }),
    snapshotCursor: vi.fn<WsNodeOperations['snapshotCursor']>().mockResolvedValue('cur-0'),
    waitForMessage: vi.fn<WsNodeOperations['waitForMessage']>().mockResolvedValue({
      data: '{"status":"ok"}',
      type: 'text',
      timestamp: Date.now(),
    }),
    disconnect: vi.fn<WsNodeOperations['disconnect']>().mockResolvedValue(undefined),
    disconnectAll: vi.fn<WsNodeOperations['disconnectAll']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function connectNode(id: string, data: Partial<WsConnectNodeData> = {}) {
  return makeNode(id, 'wsConnect', {
    label: 'WS Connect',
    url: 'ws://localhost:8080/ws',
    headers: [],
    queryParams: [],
    subprotocols: [],
    connectionId: 'conn-1',
    timeoutMs: 5000,
    outputBindings: [],
    ...data,
  });
}

function sendNode(id: string, data: Partial<WsSendNodeData> = {}) {
  return makeNode(id, 'wsSend', {
    label: 'WS Send',
    connectionId: 'conn-1',
    message: '{"action":"ping"}',
    messageType: 'text',
    waitForResponse: false,
    responseTimeoutMs: 10000,
    outputBindings: [],
    ...data,
  });
}

function receiveNode(id: string, data: Partial<WsReceiveNodeData> = {}) {
  return makeNode(id, 'wsReceive', {
    label: 'WS Receive',
    connectionId: 'conn-1',
    timeoutMs: 30000,
    matchCriteria: {},
    extractionRules: [],
    outputBindings: [],
    ...data,
  });
}

function triggerNode(id: string, data: Partial<WsTriggerNodeData> = {}) {
  return makeNode(id, 'wsTrigger', {
    label: 'WS Trigger',
    url: 'ws://localhost:8080/ws',
    connectionId: 'trigger-conn',
    matchCriteria: {},
    extractionRules: [],
    ...data,
  });
}

// ── classifyWsFailure ──

describe('classifyWsFailure', () => {
  it('classifies timeout errors', () => {
    expect(classifyWsFailure('WebSocket waitForMessage timed out')).toBe('timeout');
  });

  it('classifies protocol errors', () => {
    expect(classifyWsFailure('subprotocol negotiation failed')).toBe('protocol');
  });

  it('classifies network errors', () => {
    expect(classifyWsFailure('ECONNREFUSED 127.0.0.1:8080')).toBe('network');
  });

  it('classifies connection errors', () => {
    expect(classifyWsFailure('WebSocket is not open')).toBe('connection');
  });

  it('classifies validation errors', () => {
    expect(classifyWsFailure('URL is required')).toBe('validation');
  });

  it('defaults to network for unknown errors', () => {
    expect(classifyWsFailure('something went wrong')).toBe('network');
  });
});

// ── handleWsConnectNode ──

describe('handleWsConnectNode', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
  });

  it('connects and advances the graph', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = connectNode('c1');

    await handleWsConnectNode('c1', node, hCtx, passed);

    expect(ops.connect).toHaveBeenCalledOnce();
    expect(ops.connect).toHaveBeenCalledWith(expect.objectContaining({
      url: 'ws://localhost:8080/ws',
      timeoutMs: 5000,
    }));
    expect(passed.value).toBe(true);
    expect(cbResult.states['c1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('c1', 'main');
  });

  it('resolves template variables in URL and headers', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      wsOperations: ops,
      initialVariables: { host: 'api.example.com', token: 'secret123' },
    });
    const passed = makePassedFlag();
    const node = connectNode('c1', {
      url: 'ws://{{host}}/ws',
      headers: [
        { id: 'h1', key: 'Authorization', value: 'Bearer {{token}}', enabled: true },
        { id: 'h2', key: 'X-Disabled', value: 'nope', enabled: false },
      ],
    });

    await handleWsConnectNode('c1', node, hCtx, passed);

    expect(ops.connect).toHaveBeenCalledWith(expect.objectContaining({
      url: 'ws://api.example.com/ws',
      headers: { 'Authorization': 'Bearer secret123' },
    }));
    expect(passed.value).toBe(true);
  });

  it('sets output bindings', async () => {
    const ops = mockWsOps({
      connect: vi.fn().mockResolvedValue({
        connectionId: 'c1',
        protocol: 'graphql-ws',
        extensions: 'permessage-deflate',
        latencyMs: 42,
      } as WsConnectResult),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = connectNode('c1', {
      outputBindings: [
        { field: 'protocol', variableName: 'ws_proto', enabled: true },
        { field: 'extensions', variableName: 'ws_ext', enabled: true },
        { field: 'latencyMs', variableName: 'ws_lat', enabled: true },
      ],
    });

    await handleWsConnectNode('c1', node, hCtx, passed);

    expect(hCtx.ctx.get('ws_proto')).toBe('graphql-ws');
    expect(hCtx.ctx.get('ws_ext')).toBe('permessage-deflate');
    expect(hCtx.ctx.get('ws_lat')).toBe('42');
  });

  it('fails when URL is blank', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = connectNode('c1', { url: '' });

    await handleWsConnectNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['c1']?.state).toBe('fail');
    expect(ops.connect).not.toHaveBeenCalled();
  });

  it('fails when wsOperations is not configured', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = connectNode('c1');

    await handleWsConnectNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['c1']?.state).toBe('fail');
    expect(cbResult.states['c1']?.error).toContain('WebSocket operations not configured');
  });

  it('handles connection errors', async () => {
    const ops = mockWsOps({
      connect: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = connectNode('c1');

    await handleWsConnectNode('c1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['c1']?.state).toBe('fail');
    expect(hCtx.results).toHaveLength(1);
    expect(hCtx.results[0].passed).toBe(false);
  });

  it('passes connectionId to ops.connect for registry', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = connectNode('c1', { connectionId: 'my-conn' });

    await handleWsConnectNode('c1', node, hCtx, passed);

    expect(ops.connect).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'my-conn',
    }));
  });

  it('resolves query params', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      wsOperations: ops,
      initialVariables: { ver: '2' },
    });
    const passed = makePassedFlag();
    const node = connectNode('c1', {
      queryParams: [
        { id: 'q1', key: 'version', value: '{{ver}}', enabled: true },
      ],
    });

    await handleWsConnectNode('c1', node, hCtx, passed);

    expect(ops.connect).toHaveBeenCalledWith(expect.objectContaining({
      queryParams: { version: '2' },
    }));
  });
});

// ── handleWsSendNode ──

describe('handleWsSendNode', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
  });

  it('sends a message and advances the graph', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = sendNode('s1');

    await handleWsSendNode('s1', node, hCtx, passed);

    expect(ops.send).toHaveBeenCalledOnce();
    expect(ops.send).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'conn-1',
      data: '{"action":"ping"}',
      type: 'text',
    }));
    expect(passed.value).toBe(true);
    expect(cbResult.states['s1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('s1', 'main');
  });

  it('resolves template variables in message body', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      wsOperations: ops,
      initialVariables: { userId: '42' },
    });
    const passed = makePassedFlag();
    const node = sendNode('s1', { message: '{"userId":"{{userId}}"}' });

    await handleWsSendNode('s1', node, hCtx, passed);

    expect(ops.send).toHaveBeenCalledWith(expect.objectContaining({
      data: '{"userId":"42"}',
    }));
  });

  it('waits for response when waitForResponse is true', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = sendNode('s1', {
      waitForResponse: true,
      responseTimeoutMs: 5000,
      outputBindings: [
        { field: 'responseBody', variableName: 'resp', enabled: true },
        { field: 'responseType', variableName: 'resp_type', enabled: true },
      ],
    });

    await handleWsSendNode('s1', node, hCtx, passed);

    expect(ops.snapshotCursor).toHaveBeenCalledOnce();
    expect(ops.snapshotCursor).toHaveBeenCalledWith({ connectionId: 'conn-1' });
    expect(ops.waitForMessage).toHaveBeenCalledOnce();
    expect(ops.waitForMessage).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'conn-1',
      timeoutMs: 5000,
      sinceCursor: 'cur-0',
    }));
    expect(hCtx.ctx.get('resp')).toBe('{"status":"ok"}');
    expect(hCtx.ctx.get('resp_type')).toBe('text');
  });

  it('does not wait when waitForResponse is false', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = sendNode('s1', { waitForResponse: false });

    await handleWsSendNode('s1', node, hCtx, passed);

    expect(ops.waitForMessage).not.toHaveBeenCalled();
  });

  it('fails when connectionId is blank', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = sendNode('s1', { connectionId: '' });

    await handleWsSendNode('s1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['s1']?.state).toBe('fail');
    expect(ops.send).not.toHaveBeenCalled();
  });

  it('handles send errors', async () => {
    const ops = mockWsOps({
      send: vi.fn().mockRejectedValue(new Error('WebSocket is not open')),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = sendNode('s1');

    await handleWsSendNode('s1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(hCtx.results[0].passed).toBe(false);
  });

  it('fails when connectionId resolves to empty via variable', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    // connectionId is non-empty raw but resolves to empty
    const node = sendNode('s1', { connectionId: '{{emptyVar}}' });
    hCtx.ctx.set('emptyVar', '   ');

    await handleWsSendNode('s1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['s1']?.state).toBe('fail');
    expect(ops.send).not.toHaveBeenCalled();
  });

  it('fails when wsOperations is not configured (send)', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = sendNode('s1');

    await handleWsSendNode('s1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['s1']?.state).toBe('fail');
  });
});

// ── handleWsReceiveNode ──

describe('handleWsReceiveNode', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
  });

  it('receives a message and advances the graph', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = receiveNode('r1');

    await handleWsReceiveNode('r1', node, hCtx, passed);

    expect(ops.waitForMessage).toHaveBeenCalledOnce();
    expect(passed.value).toBe(true);
    expect(cbResult.states['r1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('r1', 'main');
  });

  it('applies extraction rules from JSON message', async () => {
    const ops = mockWsOps({
      waitForMessage: vi.fn().mockResolvedValue({
        data: '{"user":{"id":"42","name":"Alice"}}',
        type: 'text',
        timestamp: Date.now(),
      } as WsReceivedMessage),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = receiveNode('r1', {
      extractionRules: [
        { variableName: 'userId', jsonPath: '$.user.id' },
        { variableName: 'userName', jsonPath: '$.user.name' },
      ],
    });

    await handleWsReceiveNode('r1', node, hCtx, passed);

    expect(hCtx.ctx.get('userId')).toBe('42');
    expect(hCtx.ctx.get('userName')).toBe('Alice');
  });

  it('sets output bindings', async () => {
    const receivedTs = Date.now();
    const ops = mockWsOps({
      waitForMessage: vi.fn().mockResolvedValue({
        data: '{"result":"ok"}',
        type: 'text',
        timestamp: receivedTs,
      } as WsReceivedMessage),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = receiveNode('r1', {
      outputBindings: [
        { field: 'messageBody', variableName: 'body', enabled: true },
        { field: 'messageType', variableName: 'type', enabled: true },
        { field: 'matchedAt', variableName: 'ts', enabled: true },
      ],
    });

    await handleWsReceiveNode('r1', node, hCtx, passed);

    expect(hCtx.ctx.get('body')).toBe('{"result":"ok"}');
    expect(hCtx.ctx.get('type')).toBe('text');
    expect(hCtx.ctx.get('ts')).toBe(String(receivedTs));
  });

  it('passes match criteria to waitForMessage', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = receiveNode('r1', {
      matchCriteria: {
        contentContains: 'response',
        contentRegex: '^event:',
        jsonPathMatch: '$.type',
        jsonPathValue: 'notification',
        messageType: 'text',
      },
    });

    await handleWsReceiveNode('r1', node, hCtx, passed);

    expect(ops.waitForMessage).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({
        contentContains: 'response',
        contentRegex: '^event:',
        jsonPathMatch: '$.type',
        jsonPathValue: 'notification',
        messageType: 'text',
      }),
    }));
  });

  it('fails when connectionId is blank', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = receiveNode('r1', { connectionId: '' });

    await handleWsReceiveNode('r1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['r1']?.state).toBe('fail');
    expect(ops.waitForMessage).not.toHaveBeenCalled();
  });

  it('handles timeout errors', async () => {
    const ops = mockWsOps({
      waitForMessage: vi.fn().mockRejectedValue(new Error('WebSocket waitForMessage timed out')),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = receiveNode('r1');

    await handleWsReceiveNode('r1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(hCtx.results[0].passed).toBe(false);
  });

  it('skips extraction when message is not JSON', async () => {
    const ops = mockWsOps({
      waitForMessage: vi.fn().mockResolvedValue({
        data: 'plain text message',
        type: 'text',
        timestamp: Date.now(),
      } as WsReceivedMessage),
    });
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = receiveNode('r1', {
      extractionRules: [
        { variableName: 'val', jsonPath: '$.foo' },
      ],
    });

    await handleWsReceiveNode('r1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('val')).toBeUndefined();
  });

  it('fails when connectionId resolves to empty via variable', async () => {
    const ops = mockWsOps();
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks, wsOperations: ops });
    const passed = makePassedFlag();
    const node = receiveNode('r1', { connectionId: '{{emptyVar}}' });
    hCtx.ctx.set('emptyVar', '   ');

    await handleWsReceiveNode('r1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['r1']?.state).toBe('fail');
    expect(ops.waitForMessage).not.toHaveBeenCalled();
  });

  it('fails when wsOperations is not configured (receive)', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = receiveNode('r1');

    await handleWsReceiveNode('r1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['r1']?.state).toBe('fail');
  });
});

// ── handleWsTriggerNode ──

describe('handleWsTriggerNode', () => {
  let cbResult: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    cbResult = makeCallbacks();
  });

  it('seeds trigger variables from runtime message', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: '{"event":"user.created","userId":"99"}',
      type: 'text',
      url: 'ws://live.example.com/ws',
      connectionId: 'live-conn',
    }));
    const node = triggerNode('t1');

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('ws.trigger.url')).toBe('ws://live.example.com/ws');
    expect(hCtx.ctx.get('ws.trigger.connectionId')).toBe('live-conn');
    expect(hCtx.ctx.get('ws.trigger.message')).toBe('{"event":"user.created","userId":"99"}');
    expect(hCtx.ctx.get('ws.trigger.messageType')).toBe('text');
    expect(hCtx.ctx.get('__wsTriggerMessage')).toBeUndefined();
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('t1', 'main');
  });

  it('uses sample payload in Quick Test mode', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = triggerNode('t1', {
      samplePayload: '{"test":"payload"}',
      url: 'ws://test-url/ws',
      connectionId: 'test-conn',
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('ws.trigger.url')).toBe('ws://test-url/ws');
    expect(hCtx.ctx.get('ws.trigger.connectionId')).toBe('test-conn');
    expect(hCtx.ctx.get('ws.trigger.message')).toBe('{"test":"payload"}');
    expect(cbResult.states['t1']?.state).toBe('pass');
  });

  it('applies extraction rules from message body', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: '{"user":{"id":"77","role":"admin"}}',
      type: 'text',
    }));
    const node = triggerNode('t1', {
      extractionRules: [
        { variableName: 'uid', jsonPath: '$.user.id' },
        { variableName: 'role', jsonPath: '$.user.role' },
      ],
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('uid')).toBe('77');
    expect(hCtx.ctx.get('role')).toBe('admin');
  });

  it('handles dry-run with no payload', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    const node = triggerNode('t1');

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('ws.trigger.url')).toBe('ws://localhost:8080/ws');
    expect(hCtx.ctx.get('ws.trigger.message')).toBe('');
    expect(cbResult.states['t1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('t1', 'main');
  });

  it('clears __wsTriggerMessage after use', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({ data: 'msg', type: 'text' }));
    const node = triggerNode('t1');

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(hCtx.ctx.get('__wsTriggerMessage')).toBeUndefined();
  });

  it('handles unparseable runtime message gracefully', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', 'not-json{{{{');
    const node = triggerNode('t1');

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(hCtx.ctx.get('ws.trigger.message')).toBe('');
    expect(cbResult.states['t1']?.state).toBe('pass');
  });

  it('fails when match criteria contentContains does not match', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: '{"event":"order.shipped"}',
      type: 'text',
    }));
    const node = triggerNode('t1', {
      matchCriteria: { contentContains: 'user.created' },
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['t1']?.state).toBe('fail');
    expect(hCtx.results).toHaveLength(1);
    expect(hCtx.results[0].passed).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('fails when match criteria messageType does not match', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: 'binary data',
      type: 'binary',
    }));
    const node = triggerNode('t1', {
      matchCriteria: { messageType: 'text' },
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['t1']?.state).toBe('fail');
  });

  it('fails when match criteria contentRegex does not match', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: '{"event":"order.shipped"}',
      type: 'text',
    }));
    const node = triggerNode('t1', {
      matchCriteria: { contentRegex: '^user\\.' },
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['t1']?.state).toBe('fail');
  });

  it('fails when match criteria contentRegex is invalid', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: 'hello',
      type: 'text',
    }));
    const node = triggerNode('t1', {
      matchCriteria: { contentRegex: '[invalid' },
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['t1']?.state).toBe('fail');
  });

  it('fails when jsonPathMatch does not find value', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: '{"event":"test"}',
      type: 'text',
    }));
    const node = triggerNode('t1', {
      matchCriteria: { jsonPathMatch: 'nonexistent' },
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['t1']?.state).toBe('fail');
  });

  it('fails when jsonPathValue does not match', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: '{"status":"pending"}',
      type: 'text',
    }));
    const node = triggerNode('t1', {
      matchCriteria: { jsonPathMatch: 'status', jsonPathValue: 'ready' },
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['t1']?.state).toBe('fail');
  });

  it('fails when jsonPathMatch body is not JSON', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: 'not-json',
      type: 'text',
    }));
    const node = triggerNode('t1', {
      matchCriteria: { jsonPathMatch: 'key' },
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(false);
    expect(cbResult.states['t1']?.state).toBe('fail');
  });

  it('passes when contentRegex matches', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: '{"event":"order.shipped"}',
      type: 'text',
    }));
    const node = triggerNode('t1', {
      matchCriteria: { contentRegex: 'order\\.shipped' },
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['t1']?.state).toBe('pass');
  });

  it('passes when jsonPathMatch + jsonPathValue matches', async () => {
    const hCtx = makeHandlerContext({ callbacks: cbResult.callbacks });
    const passed = makePassedFlag();
    hCtx.ctx.set('__wsTriggerMessage', JSON.stringify({
      data: '{"status":"ready"}',
      type: 'text',
    }));
    const node = triggerNode('t1', {
      matchCriteria: { jsonPathMatch: 'status', jsonPathValue: 'ready' },
    });

    await handleWsTriggerNode('t1', node, hCtx, passed);

    expect(passed.value).toBe(true);
    expect(cbResult.states['t1']?.state).toBe('pass');
  });
});
