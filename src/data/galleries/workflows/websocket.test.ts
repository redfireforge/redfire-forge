import { describe, it, expect } from 'vitest';
import {
  createWsEchoPingWorkflow,
  createWsJsonExchangeWorkflow,
  createWsChatFlowWorkflow,
  createWsTriggerWorkflow,
  createWsHttpHybridWorkflow,
} from './websocket';

// ─── Shared structural checks ─────────────────────────────────────────────────

function assertValidWorkflow(wf: ReturnType<typeof createWsEchoPingWorkflow>) {
  expect(wf.id).toBeTruthy();
  expect(wf.name).toBeTruthy();
  expect(wf.description).toBeTruthy();
  expect(wf.nodes.length).toBeGreaterThanOrEqual(3);
  expect(wf.edges.length).toBeGreaterThanOrEqual(2);
  expect(wf.createdAt).toBeGreaterThan(0);
  expect(wf.updatedAt).toBeGreaterThan(0);
}

function nodeTypes(wf: ReturnType<typeof createWsEchoPingWorkflow>): string[] {
  return wf.nodes.map(n => n.type as string);
}

// ─── WF-WS-01: WebSocket Echo Ping ───────────────────────────────────────────

describe('createWsEchoPingWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createWsEchoPingWorkflow());
  });

  it('has id sample-ws-echo', () => {
    expect(createWsEchoPingWorkflow().id).toBe('sample-ws-echo');
  });

  it('has exactly 7 nodes', () => {
    expect(createWsEchoPingWorkflow().nodes).toHaveLength(7);
  });

  it('contains start, wsConnect, wsSend, wsReceive, condition, logDebug, end node types', () => {
    const types = nodeTypes(createWsEchoPingWorkflow());
    expect(types).toContain('start');
    expect(types).toContain('wsConnect');
    expect(types).toContain('wsSend');
    expect(types).toContain('wsReceive');
    expect(types).toContain('condition');
    expect(types).toContain('logDebug');
    expect(types).toContain('end');
  });

  it('wsConnect uses echo.websocket.org and connectionId ws-echo', () => {
    const wf = createWsEchoPingWorkflow();
    const connect = wf.nodes.find(n => n.type === 'wsConnect');
    expect(connect?.data.url).toBe('wss://echo.websocket.org');
    expect(connect?.data.connectionId).toBe('ws-echo');
    expect(connect?.data.timeoutMs).toBe(5000);
  });

  it('wsSend sends "ping" text message on ws-echo connection', () => {
    const wf = createWsEchoPingWorkflow();
    const send = wf.nodes.find(n => n.type === 'wsSend');
    expect(send?.data.connectionId).toBe('ws-echo');
    expect(send?.data.message).toBe('ping');
    expect(send?.data.messageType).toBe('text');
  });

  it('wsReceive binds messageBody to receivedMessage via outputBindings', () => {
    const wf = createWsEchoPingWorkflow();
    const receive = wf.nodes.find(n => n.type === 'wsReceive');
    expect(receive?.data.connectionId).toBe('ws-echo');
    expect(receive?.data.timeoutMs).toBe(5000);
    const bindings = receive?.data.outputBindings as Array<Record<string, unknown>>;
    expect(bindings.some(b => b.field === 'messageBody' && b.variableName === 'receivedMessage' && b.enabled === true)).toBe(true);
  });

  it('condition checks {{receivedMessage}} == "ping"', () => {
    const wf = createWsEchoPingWorkflow();
    const cond = wf.nodes.find(n => n.type === 'condition');
    expect(cond?.data.left).toBe('{{receivedMessage}}');
    expect(cond?.data.operator).toBe('==');
    expect(cond?.data.right).toBe('ping');
  });

  it('has 7 edges including true/false branches', () => {
    expect(createWsEchoPingWorkflow().edges).toHaveLength(7);
  });

  it('has a false-branch edge to logDebug (mismatch warn)', () => {
    const wf = createWsEchoPingWorkflow();
    const falseBranch = wf.edges.find(e => e.label === 'false');
    expect(falseBranch).toBeDefined();
    const mismatchNode = wf.nodes.find(n => n.id === falseBranch?.target);
    expect(mismatchNode?.type).toBe('logDebug');
    expect(String(mismatchNode?.data.logLevel)).toBe('warn');
  });
});

// ─── WF-WS-02: WebSocket JSON Message Exchange ───────────────────────────────

describe('createWsJsonExchangeWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createWsJsonExchangeWorkflow());
  });

  it('has id sample-ws-json-exchange', () => {
    expect(createWsJsonExchangeWorkflow().id).toBe('sample-ws-json-exchange');
  });

  it('has exactly 7 nodes', () => {
    expect(createWsJsonExchangeWorkflow().nodes).toHaveLength(7);
  });

  it('contains start, wsConnect, wsSend, wsReceive, condition, logDebug, end', () => {
    const types = nodeTypes(createWsJsonExchangeWorkflow());
    expect(types).toContain('start');
    expect(types).toContain('wsConnect');
    expect(types).toContain('wsSend');
    expect(types).toContain('wsReceive');
    expect(types).toContain('condition');
    expect(types).toContain('logDebug');
    expect(types).toContain('end');
  });

  it('wsConnect uses Binance stream URL and connectionId ws-prices', () => {
    const wf = createWsJsonExchangeWorkflow();
    const connect = wf.nodes.find(n => n.type === 'wsConnect');
    expect(connect?.data.url).toBe('wss://stream.binance.com:9443/stream');
    expect(connect?.data.connectionId).toBe('ws-prices');
  });

  it('wsSend sends Binance SUBSCRIBE JSON message', () => {
    const wf = createWsJsonExchangeWorkflow();
    const send = wf.nodes.find(n => n.type === 'wsSend');
    expect(send?.data.connectionId).toBe('ws-prices');
    expect(String(send?.data.message)).toContain('SUBSCRIBE');
    expect(String(send?.data.message)).toContain('btcusdt@trade');
  });

  it('wsReceive has matchCriteria for trade event and extracts latestPrice from $.data.p', () => {
    const wf = createWsJsonExchangeWorkflow();
    const receive = wf.nodes.find(n => n.type === 'wsReceive');
    const criteria = receive?.data.matchCriteria as Record<string, unknown>;
    expect(criteria.jsonPathMatch).toBe('$.data.e');
    expect(criteria.jsonPathValue).toBe('trade');
    const rules = receive?.data.extractionRules as Array<Record<string, unknown>>;
    expect(rules.some(r => r.variableName === 'latestPrice' && r.jsonPath === '$.data.p')).toBe(true);
  });

  it('condition checks {{latestPrice}} > "0"', () => {
    const wf = createWsJsonExchangeWorkflow();
    const cond = wf.nodes.find(n => n.type === 'condition');
    expect(cond?.data.left).toBe('{{latestPrice}}');
    expect(cond?.data.operator).toBe('>');
    expect(cond?.data.right).toBe('0');
  });

  it('has 7 edges', () => {
    expect(createWsJsonExchangeWorkflow().edges).toHaveLength(7);
  });
});

// ─── WF-WS-03: WebSocket Chat Flow ───────────────────────────────────────────

describe('createWsChatFlowWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createWsChatFlowWorkflow());
  });

  it('has id sample-ws-chat-flow', () => {
    expect(createWsChatFlowWorkflow().id).toBe('sample-ws-chat-flow');
  });

  it('has exactly 9 nodes', () => {
    expect(createWsChatFlowWorkflow().nodes).toHaveLength(9);
  });

  it('contains start, wsConnect, 2× wsSend, 2× wsReceive, condition, logDebug, end', () => {
    const types = nodeTypes(createWsChatFlowWorkflow());
    expect(types).toContain('start');
    expect(types).toContain('wsConnect');
    expect(types.filter(t => t === 'wsSend')).toHaveLength(2);
    expect(types.filter(t => t === 'wsReceive')).toHaveLength(2);
    expect(types).toContain('condition');
    expect(types).toContain('logDebug');
    expect(types).toContain('end');
  });

  it('wsConnect uses template URL with {{wsHost}} and connectionId ws-chat', () => {
    const wf = createWsChatFlowWorkflow();
    const connect = wf.nodes.find(n => n.type === 'wsConnect');
    expect(String(connect?.data.url)).toContain('{{wsHost}}');
    expect(connect?.data.connectionId).toBe('ws-chat');
  });

  it('first wsReceive waits for auth_ok via matchCriteria jsonPath', () => {
    const wf = createWsChatFlowWorkflow();
    const receives = wf.nodes.filter(n => n.type === 'wsReceive');
    const authReceive = receives[0];
    const criteria = authReceive.data.matchCriteria as Record<string, unknown>;
    expect(criteria.jsonPathMatch).toBe('$.type');
    expect(criteria.jsonPathValue).toBe('auth_ok');
  });

  it('second wsReceive extracts receivedText from $.text', () => {
    const wf = createWsChatFlowWorkflow();
    const receives = wf.nodes.filter(n => n.type === 'wsReceive');
    const echoReceive = receives[1];
    const rules = echoReceive.data.extractionRules as Array<Record<string, unknown>>;
    expect(rules.some(r => r.variableName === 'receivedText' && r.jsonPath === '$.text')).toBe(true);
  });

  it('condition checks {{receivedText}} == "Hello from workflow"', () => {
    const wf = createWsChatFlowWorkflow();
    const cond = wf.nodes.find(n => n.type === 'condition');
    expect(cond?.data.left).toBe('{{receivedText}}');
    expect(cond?.data.right).toBe('Hello from workflow');
    expect(cond?.data.operator).toBe('==');
  });

  it('has 9 edges', () => {
    expect(createWsChatFlowWorkflow().edges).toHaveLength(9);
  });

  it('condition false branch leads to logDebug warn', () => {
    const wf = createWsChatFlowWorkflow();
    const falseBranch = wf.edges.find(e => e.label === 'false');
    expect(falseBranch).toBeDefined();
    const mismatchNode = wf.nodes.find(n => n.id === falseBranch?.target);
    expect(mismatchNode?.type).toBe('logDebug');
    expect(String(mismatchNode?.data.logLevel)).toBe('warn');
  });
});

// ─── WF-WS-04: WebSocket Inbound Trigger ─────────────────────────────────────

describe('createWsTriggerWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createWsTriggerWorkflow());
  });

  it('has id sample-ws-trigger', () => {
    expect(createWsTriggerWorkflow().id).toBe('sample-ws-trigger');
  });

  it('has exactly 6 nodes', () => {
    expect(createWsTriggerWorkflow().nodes).toHaveLength(6);
  });

  it('starts with wsTrigger as entry node (no start node)', () => {
    const types = nodeTypes(createWsTriggerWorkflow());
    expect(types).toContain('wsTrigger');
    expect(types).not.toContain('start');
  });

  it('contains wsTrigger, http, condition, 2× logDebug, end', () => {
    const types = nodeTypes(createWsTriggerWorkflow());
    expect(types).toContain('wsTrigger');
    expect(types).toContain('http');
    expect(types).toContain('condition');
    expect(types.filter(t => t === 'logDebug')).toHaveLength(2);
    expect(types).toContain('end');
  });

  it('wsTrigger matches order.created event and extracts orderId + customerId', () => {
    const wf = createWsTriggerWorkflow();
    const trigger = wf.nodes.find(n => n.type === 'wsTrigger');
    const criteria = trigger?.data.matchCriteria as Record<string, unknown>;
    expect(criteria.jsonPathMatch).toBe('$.event');
    expect(criteria.jsonPathValue).toBe('order.created');
    const rules = trigger?.data.extractionRules as Array<Record<string, unknown>>;
    expect(rules.some(r => r.variableName === 'orderId' && r.jsonPath === '$.data.orderId')).toBe(true);
    expect(rules.some(r => r.variableName === 'customerId' && r.jsonPath === '$.data.customerId')).toBe(true);
  });

  it('wsTrigger has a samplePayload containing order.created', () => {
    const wf = createWsTriggerWorkflow();
    const trigger = wf.nodes.find(n => n.type === 'wsTrigger');
    expect(String(trigger?.data.samplePayload)).toContain('order.created');
  });

  it('http GET uses jsonplaceholder.typicode.com', () => {
    const wf = createWsTriggerWorkflow();
    const http = wf.nodes.find(n => n.type === 'http');
    const scenario = http?.data.scenario as Record<string, unknown>;
    expect(String(scenario.url)).toContain('jsonplaceholder.typicode.com');
    expect(scenario.method).toBe('GET');
  });

  it('condition checks {{status}} == "confirmed"', () => {
    const wf = createWsTriggerWorkflow();
    const cond = wf.nodes.find(n => n.type === 'condition');
    expect(cond?.data.left).toBe('{{status}}');
    expect(cond?.data.right).toBe('confirmed');
    expect(cond?.data.operator).toBe('==');
  });

  it('has 6 edges', () => {
    expect(createWsTriggerWorkflow().edges).toHaveLength(6);
  });

  it('has true and false branches from condition', () => {
    const wf = createWsTriggerWorkflow();
    const trueBranch = wf.edges.find(e => e.label === 'true');
    const falseBranch = wf.edges.find(e => e.label === 'false');
    expect(trueBranch).toBeDefined();
    expect(falseBranch).toBeDefined();
  });
});

// ─── WF-WS-05: WebSocket + HTTP Hybrid ───────────────────────────────────────

describe('createWsHttpHybridWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createWsHttpHybridWorkflow());
  });

  it('has id sample-ws-http-hybrid', () => {
    expect(createWsHttpHybridWorkflow().id).toBe('sample-ws-http-hybrid');
  });

  it('has exactly 8 nodes', () => {
    expect(createWsHttpHybridWorkflow().nodes).toHaveLength(8);
  });

  it('contains start, wsConnect, 2× wsSend, wsReceive, http, setVariable, end', () => {
    const types = nodeTypes(createWsHttpHybridWorkflow());
    expect(types).toContain('start');
    expect(types).toContain('wsConnect');
    expect(types.filter(t => t === 'wsSend')).toHaveLength(2);
    expect(types).toContain('wsReceive');
    expect(types).toContain('http');
    expect(types).toContain('setVariable');
    expect(types).toContain('end');
  });

  it('wsConnect uses {{priceWsUrl}} template and connectionId ws-prices', () => {
    const wf = createWsHttpHybridWorkflow();
    const connect = wf.nodes.find(n => n.type === 'wsConnect');
    expect(String(connect?.data.url)).toContain('{{priceWsUrl}}');
    expect(connect?.data.connectionId).toBe('ws-prices');
    expect(connect?.data.timeoutMs).toBe(8000);
  });

  it('wsReceive matches price_drop event and extracts productId and newPrice', () => {
    const wf = createWsHttpHybridWorkflow();
    const receive = wf.nodes.find(n => n.type === 'wsReceive');
    const criteria = receive?.data.matchCriteria as Record<string, unknown>;
    expect(criteria.jsonPathMatch).toBe('$.type');
    expect(criteria.jsonPathValue).toBe('price_drop');
    const rules = receive?.data.extractionRules as Array<Record<string, unknown>>;
    expect(rules.some(r => r.variableName === 'productId' && r.jsonPath === '$.data.productId')).toBe(true);
    expect(rules.some(r => r.variableName === 'newPrice' && r.jsonPath === '$.data.price')).toBe(true);
  });

  it('http GET calls fakestoreapi.com with {{productId}}', () => {
    const wf = createWsHttpHybridWorkflow();
    const http = wf.nodes.find(n => n.type === 'http');
    const scenario = http?.data.scenario as Record<string, unknown>;
    expect(String(scenario.url)).toContain('fakestoreapi.com');
    expect(String(scenario.url)).toContain('{{productId}}');
    expect(scenario.method).toBe('GET');
  });

  it('setVariable builds alertMessage from productId and newPrice', () => {
    const wf = createWsHttpHybridWorkflow();
    const setVar = wf.nodes.find(n => n.type === 'setVariable');
    const assignments = setVar?.data.assignments as Array<Record<string, unknown>>;
    expect(assignments.some(a => a.name === 'alertMessage' && String(a.expression).includes('{{productId}}') && String(a.expression).includes('{{newPrice}}'))).toBe(true);
  });

  it('second wsSend (ack) uses same ws-prices connection', () => {
    const wf = createWsHttpHybridWorkflow();
    const sends = wf.nodes.filter(n => n.type === 'wsSend');
    expect(sends).toHaveLength(2);
    // The ack send is the second one
    expect(sends[1].data.connectionId).toBe('ws-prices');
    expect(String(sends[1].data.message)).toContain('ack');
  });

  it('has a linear chain of 7 edges', () => {
    expect(createWsHttpHybridWorkflow().edges).toHaveLength(7);
  });
});
