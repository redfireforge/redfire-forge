import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowNode, WorkflowEdge, NodeRunStatus } from '../types/workflow';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlers';

// Mock dependencies before importing handlers
vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('./scriptSandbox', () => ({
  executeScript: vi.fn(),
}));

vi.mock('./scriptLibraries', () => ({
  loadScriptLibraries: vi.fn(() => []),
  buildLibraryPreamble: vi.fn(() => ''),
}));

import { httpFetch } from '../../../shared/utils/httpClient';
import { executeScript } from './scriptSandbox';
import { VariableContext } from './variableContext';
import { TokenManager } from '../../../engine/tokenManager';
import {
  handleHttpNode,
  handleConditionNode,
  handleDelayNode,
  handleStartNode,
  handleWebhookNode,
  handleScheduleNode,
  handleForkNode,
  handleJoinNode,
  handleSwitchNode,
  handleLoopNode,
  handleSetVariableNode,
  handleScriptNode,
  handleAggregateNode,
  handleErrorHandlerNode,
  handleLogDebugNode,
  handleWaitForConditionNode,
  handleSubWorkflowNode,
} from './graphRunnerNodeHandlers';

const mockFetch = vi.mocked(httpFetch);
const mockExecuteScript = vi.mocked(executeScript);

// ────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────

function makeCtx(vars: Record<string, string> = {}) {
  return new VariableContext(vars);
}

function makePassedFlag(value = true): PassedFlag {
  return { value };
}

interface MockCallbackResult {
  states: Record<string, NodeRunStatus>;
  variables: Record<string, string>[];
  logLines: Array<{ prefix: string; text: string }>;
  callbacks: NodeHandlerContext['callbacks'];
}

function makeCallbacks(): MockCallbackResult {
  const states: Record<string, NodeRunStatus> = {};
  const variables: Record<string, string>[] = [];
  const logLines: Array<{ prefix: string; text: string }> = [];
  return {
    states,
    variables,
    logLines,
    callbacks: {
      onNodeStateChange: vi.fn((id, status) => { states[id] = status; }),
      onVariablesChange: vi.fn((v) => variables.push({ ...v })),
      onComplete: vi.fn(),
      onLog: vi.fn((line) => logLines.push(line)),
    },
  };
}

function makeNode(id: string, type: string, data: Record<string, unknown> = {}): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: type, ...data } };
}

function makeEdge(id: string, source: string, target: string, sourceHandle?: string, label?: string): WorkflowEdge {
  return { id, source, target, sourceHandle, label } as WorkflowEdge;
}

function makeHandlerContext(overrides: Partial<NodeHandlerContext> = {}): NodeHandlerContext {
  const ctx = overrides.ctx ?? makeCtx();
  const { callbacks, logLines } = makeCallbacks();
  return {
    nodeMap: new Map(),
    outgoing: new Map(),
    ctx,
    tokenManager: new TokenManager(),
    results: [],
    allPassed: true,
    visited: new Set(),
    joinArrived: new Map(),
    incomingCount: new Map(),
    callbacks: overrides.callbacks ?? callbacks,
    log: overrides.log ?? ((line) => logLines.push(line)),
    nodeLabel: overrides.nodeLabel ?? ((id) => id),
    visit: overrides.visit ?? vi.fn(),
    visitOutgoing: overrides.visitOutgoing ?? vi.fn(),
    threadId: 'main',
    initialVariables: {},
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────

describe('graphRunnerNodeHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok": true}',
    });
  });

  // ── handleHttpNode ──
  describe('handleHttpNode', () => {
    function httpNode(id: string, label = 'HTTP', url = 'https://api.example.com/test'): WorkflowNode {
      return makeNode(id, 'http', {
        label,
        scenario: {
          id, name: label, url, method: 'GET',
          headers: [], body: '', auth: { type: 'none' },
          validation: { mode: 'none', assertions: [] },
        },
      });
    }

    it('executes HTTP request and records pass result', async () => {
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks });
      const node = httpNode('h1');
      const passed = makePassedFlag();

      await handleHttpNode('h1', node, hCtx, passed);

      expect(states['h1']?.state).toBe('pass');
      expect(hCtx.results).toHaveLength(1);
      expect(hCtx.results[0].passed).toBe(true);
      expect(passed.value).toBe(true);
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('h1', 'main');
    });

    it('marks node as fail when HTTP request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        statusText: 'Error',
        headers: {},
        body: 'error',
      });
      const node = httpNode('h1');
      // Add a validation assertion to make the result fail
      (node.data as Record<string, unknown>).scenario = {
        ...(node.data as Record<string, unknown>).scenario as object,
        validation: { mode: 'status', assertions: [{ type: 'status', expected: '200' }] },
      };

      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks });
      const passed = makePassedFlag();

      await handleHttpNode('h1', node, hCtx, passed);

      expect(states['h1']?.state).toBe('fail');
      expect(passed.value).toBe(false);
    });

    it('logs request and response details', async () => {
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });
      const node = httpNode('h1', 'MyAPI');

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const texts = logLines.map(l => l.text);
      expect(texts.some(t => t.includes('request...'))).toBe(true);
      expect(texts.some(t => t.includes('200'))).toBe(true);
    });

    it('logs request body when present', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200, statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"ok":true}',
      });
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const node = makeNode('h1', 'http', {
        label: 'HTTP',
        scenario: {
          id: 'h1', name: 'HTTP', url: 'https://api.example.com/test', method: 'POST',
          headers: [], body: '{"payload":"data"}', auth: { type: 'none' },
          validation: { mode: 'none', assertions: [] },
        },
      });
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const bodyLog = logLines.find(l => l.text.includes('Body:'));
      expect(bodyLog).toBeDefined();
    });

    it('truncates long request body', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200, statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"ok":true}',
      });
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const longBody = 'x'.repeat(300);
      const node = makeNode('h1', 'http', {
        label: 'HTTP',
        scenario: {
          id: 'h1', name: 'HTTP', url: 'https://api.example.com/test', method: 'POST',
          headers: [], body: longBody, auth: { type: 'none' },
          validation: { mode: 'none', assertions: [] },
        },
      });
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const bodyLog = logLines.find(l => l.text.includes('Body:') && l.text.includes('…'));
      expect(bodyLog).toBeDefined();
    });

    it('truncates long response body', async () => {
      const longResponse = 'x'.repeat(400);
      mockFetch.mockResolvedValueOnce({
        status: 200, statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        body: longResponse,
      });
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const node = httpNode('h1');
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const respBodyLog = logLines.find(l => l.prefix === '<' && l.text.includes('Body:') && l.text.includes('…'));
      expect(respBodyLog).toBeDefined();
    });

    it('logs error message when failed without failureDetails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const node = httpNode('h1');
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const errorLog = logLines.find(l => l.prefix === '!');
      expect(errorLog).toBeDefined();
    });

    it('masks sensitive headers', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200, statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const node = httpNode('h1');
      // Add auth header to scenario
      (node.data as Record<string, unknown>).scenario = {
        ...(node.data as Record<string, unknown>).scenario as object,
        headers: [{ key: 'Authorization', value: 'Bearer supersecrettoken123' }],
      };
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const authLog = logLines.find(l => l.text.includes('authorization') || l.text.includes('Authorization'));
      if (authLog) {
        expect(authLog.text).toContain('••••');
        expect(authLog.text).not.toContain('supersecrettoken123');
      }
    });
  });

  // ── handleConditionNode ──
  describe('handleConditionNode', () => {
    it('takes Yes branch when condition is true', async () => {
      const ctx = makeCtx({ status: '200' });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('c1', [
        makeEdge('e1', 'c1', 'yes1', 'true', 'Yes'),
        makeEdge('e2', 'c1', 'no1', 'false', 'No'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('yes1', makeNode('yes1', 'http'));
      nodeMap.set('no1', makeNode('no1', 'http'));
      const { callbacks, states } = makeCallbacks();

      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('c1', 'condition', {
        left: '{{status}}', operator: '==', right: '200',
      });

      await handleConditionNode('c1', node, hCtx);

      expect(states['c1']?.state).toBe('pass');
      expect(visit).toHaveBeenCalledWith('yes1', 'main');
    });

    it('takes No branch when condition is false', async () => {
      const ctx = makeCtx({ status: '404' });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('c1', [
        makeEdge('e1', 'c1', 'yes1', 'true', 'Yes'),
        makeEdge('e2', 'c1', 'no1', 'false', 'No'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('yes1', makeNode('yes1', 'http'));
      nodeMap.set('no1', makeNode('no1', 'http'));
      const { callbacks } = makeCallbacks();

      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('c1', 'condition', {
        left: '{{status}}', operator: '==', right: '200',
      });

      await handleConditionNode('c1', node, hCtx);
      expect(visit).toHaveBeenCalledWith('no1', 'main');
    });

    it('runs multiple matched edges in parallel', async () => {
      const ctx = makeCtx({ status: '200' });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('c1', [
        makeEdge('e1', 'c1', 'yes1', 'true', 'Yes'),
        makeEdge('e2', 'c1', 'yes2', 'true', 'Yes'),
      ]);
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing });
      const node = makeNode('c1', 'condition', {
        left: '{{status}}', operator: '==', right: '200',
      });

      await handleConditionNode('c1', node, hCtx);
      expect(visit).toHaveBeenCalledTimes(2);
    });
  });

  // ── handleDelayNode ──
  describe('handleDelayNode', () => {
    it('delays for specified duration', async () => {
      vi.useFakeTimers();
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks });
      const node = makeNode('d1', 'delay', { delayMs: 100, mode: 'fixed' });

      const promise = handleDelayNode('d1', node, hCtx);
      vi.advanceTimersByTime(100);
      await promise;

      expect(states['d1']?.state).toBe('pass');
      expect(hCtx.visitOutgoing).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('resolves immediately when abort signal fires', async () => {
      const controller = new AbortController();
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, abortSignal: controller.signal });
      const node = makeNode('d1', 'delay', { delayMs: 999999, mode: 'fixed' });

      const promise = handleDelayNode('d1', node, hCtx);
      controller.abort();
      await promise;
      // Should resolve without waiting the full delay
    });

    it('uses random delay in random mode', async () => {
      vi.useFakeTimers();
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks });
      const node = makeNode('d1', 'delay', { delayMs: 200, mode: 'random', minMs: 50, maxMs: 150 });

      const promise = handleDelayNode('d1', node, hCtx);
      vi.advanceTimersByTime(200);
      await promise;
      vi.useRealTimers();
    });
  });

  // ── handleStartNode ──
  describe('handleStartNode', () => {
    it('seeds input variables into context', async () => {
      const ctx = makeCtx();
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('s1', 'start', {
        inputVariables: { baseUrl: 'https://api.test.com', token: 'abc123' },
      });

      await handleStartNode('s1', node, hCtx);

      expect(states['s1']?.state).toBe('pass');
      expect(ctx.resolve('{{baseUrl}}')).toBe('https://api.test.com');
      expect(ctx.resolve('{{token}}')).toBe('abc123');
      expect(callbacks.onVariablesChange).toHaveBeenCalled();
      expect(hCtx.visitOutgoing).toHaveBeenCalled();
    });

    it('handles start node without input variables', async () => {
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks });
      const node = makeNode('s1', 'start', {});

      await handleStartNode('s1', node, hCtx);
      expect(states['s1']?.state).toBe('pass');
    });
  });

  // ── handleWebhookNode ──
  describe('handleWebhookNode', () => {
    it('extracts variables from sample payload', async () => {
      const ctx = makeCtx();
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('w1', 'webhook', {
        samplePayload: '{"event":"push","data":{"id":42}}',
        extractVariables: [
          { name: 'eventType', jsonPath: '$.event' },
          { name: 'dataId', jsonPath: '$.data.id' },
        ],
      });

      await handleWebhookNode('w1', node, hCtx);

      expect(ctx.resolve('{{eventType}}')).toBe('push');
      expect(ctx.resolve('{{dataId}}')).toBe('42');
      expect(states['w1']?.state).toBe('pass');
    });

    it('handles invalid JSON payload gracefully', async () => {
      const ctx = makeCtx();
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('w1', 'webhook', {
        samplePayload: 'not-json',
        extractVariables: [{ name: 'x', jsonPath: '$.x' }],
      });

      await handleWebhookNode('w1', node, hCtx);
      expect(states['w1']?.state).toBe('pass');
    });

    it('handles missing extractVariables', async () => {
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks });
      const node = makeNode('w1', 'webhook', {});

      await handleWebhookNode('w1', node, hCtx);
      expect(states['w1']?.state).toBe('pass');
    });
  });

  // ── handleScheduleNode ──
  describe('handleScheduleNode', () => {
    it('sets trigger time variables', async () => {
      const ctx = makeCtx();
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('sc1', 'schedule', {});

      await handleScheduleNode('sc1', node, hCtx);

      expect(states['sc1']?.state).toBe('pass');
      expect(ctx.resolve('{{triggerTime}}')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(ctx.resolve('{{triggerTimestamp}}')).toMatch(/^\d+$/);
      expect(ctx.resolve('{{triggerDate}}')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('seeds configured input variables', async () => {
      const ctx = makeCtx();
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('sc1', 'schedule', {
        inputVariables: { env: 'staging' },
      });

      await handleScheduleNode('sc1', node, hCtx);
      expect(ctx.resolve('{{env}}')).toBe('staging');
    });
  });

  // ── handleForkNode ──
  describe('handleForkNode', () => {
    it('visits all outgoing branches in parallel', async () => {
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('f1', [
        makeEdge('e1', 'f1', 'b1'),
        makeEdge('e2', 'f1', 'b2'),
        makeEdge('e3', 'f1', 'b3'),
      ]);
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, visit, outgoing });
      const node = makeNode('f1', 'fork');

      await handleForkNode('f1', node, hCtx);

      expect(states['f1']?.state).toBe('pass');
      expect(visit).toHaveBeenCalledTimes(3);
      expect(visit).toHaveBeenCalledWith('b1', 'main-branch-0');
      expect(visit).toHaveBeenCalledWith('b2', 'main-branch-1');
    });
  });

  // ── handleJoinNode ──
  describe('handleJoinNode', () => {
    it('marks pass and visits outgoing', async () => {
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks });
      const node = makeNode('j1', 'join');

      await handleJoinNode('j1', node, hCtx);

      expect(states['j1']?.state).toBe('pass');
      expect(hCtx.visitOutgoing).toHaveBeenCalled();
    });
  });

  // ── handleSwitchNode ──
  describe('handleSwitchNode', () => {
    function switchSetup(exprValue: string) {
      const ctx = makeCtx({ env: exprValue });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('sw1', [
        makeEdge('e1', 'sw1', 'dev-path', 'case-c1'),
        makeEdge('e2', 'sw1', 'prod-path', 'case-c2'),
        makeEdge('e3', 'sw1', 'default-path', 'default'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('dev-path', makeNode('dev-path', 'http'));
      nodeMap.set('prod-path', makeNode('prod-path', 'http'));
      nodeMap.set('default-path', makeNode('default-path', 'http'));
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('sw1', 'switch', {
        expression: '{{env}}',
        cases: [
          { id: 'c1', value: 'dev', label: 'Development' },
          { id: 'c2', value: 'prod', label: 'Production' },
        ],
      });
      return { hCtx, node, visit, states };
    }

    it('takes matched case branch', async () => {
      const { hCtx, node, visit, states } = switchSetup('dev');
      await handleSwitchNode('sw1', node, hCtx);
      expect(states['sw1']?.state).toBe('pass');
      expect(visit).toHaveBeenCalledWith('dev-path', 'main');
    });

    it('takes default branch when no case matches', async () => {
      const { hCtx, node, visit } = switchSetup('staging');
      await handleSwitchNode('sw1', node, hCtx);
      expect(visit).toHaveBeenCalledWith('default-path', 'main');
    });
  });

  // ── handleLoopNode ──
  describe('handleLoopNode', () => {
    it('executes count-based loop', async () => {
      const ctx = makeCtx();
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('l1', [
        makeEdge('e1', 'l1', 'body1', 'body'),
        makeEdge('e2', 'l1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('l1', 'loop', {
        mode: 'count', count: 3, maxIterations: 100,
      });

      await handleLoopNode('l1', node, hCtx);

      expect(states['l1']?.state).toBe('pass');
      // body visited 3 times + done visited once
      expect(visit).toHaveBeenCalledTimes(4);
      expect(ctx.resolve('{{i}}')).toBe('3');
    });

    it('executes forEach loop', async () => {
      const ctx = makeCtx({ items: '["a","b","c"]' });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('l1', [
        makeEdge('e1', 'l1', 'body1', 'body'),
        makeEdge('e2', 'l1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('l1', 'loop', {
        mode: 'forEach', sourceExpression: '{{items}}',
        itemVariable: 'item', maxIterations: 100,
      });

      await handleLoopNode('l1', node, hCtx);
      // 3 body iterations + 1 done
      expect(visit).toHaveBeenCalledTimes(4);
    });

    it('stops on maxIterations', async () => {
      const ctx = makeCtx();
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('l1', [
        makeEdge('e1', 'l1', 'body1', 'body'),
        makeEdge('e2', 'l1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('l1', 'loop', {
        mode: 'count', count: 999, maxIterations: 2,
      });

      await handleLoopNode('l1', node, hCtx);
      // 2 body iterations + 1 done
      expect(visit).toHaveBeenCalledTimes(3);
    });

    it('respects abort signal', async () => {
      const controller = new AbortController();
      controller.abort();
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('l1', [makeEdge('e1', 'l1', 'body1', 'body')]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx: makeCtx(), callbacks, visit, outgoing, nodeMap, abortSignal: controller.signal });
      const node = makeNode('l1', 'loop', { mode: 'count', count: 10, maxIterations: 100 });

      await handleLoopNode('l1', node, hCtx);
      expect(visit).not.toHaveBeenCalled();
    });

    it('handles while mode', async () => {
      const ctx = makeCtx({ counter: '0' });
      let callCount = 0;
      const visit = vi.fn(async () => {
        callCount++;
        if (callCount >= 3) {
          ctx.set('counter', '10');
        }
      });
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('l1', [
        makeEdge('e1', 'l1', 'body1', 'body'),
        makeEdge('e2', 'l1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('l1', 'loop', {
        mode: 'while',
        whileLeft: '{{counter}}', whileOperator: '<', whileRight: '5',
        maxIterations: 100,
      });

      await handleLoopNode('l1', node, hCtx);
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('handles forEach with non-array source', async () => {
      const ctx = makeCtx({ items: 'not-json' });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('l1', [
        makeEdge('e1', 'l1', 'body1', 'body'),
        makeEdge('e2', 'l1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('l1', 'loop', {
        mode: 'forEach', sourceExpression: '{{items}}',
        maxIterations: 100,
      });

      await handleLoopNode('l1', node, hCtx);
      // Empty items → 0 body iterations + 1 done
      expect(visit).toHaveBeenCalledTimes(1);
    });

    it('handles forEach with object items', async () => {
      const ctx = makeCtx({ items: '[{"name":"a"},{"name":"b"}]' });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('l1', [
        makeEdge('e1', 'l1', 'body1', 'body'),
        makeEdge('e2', 'l1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('l1', 'loop', {
        mode: 'forEach', sourceExpression: '{{items}}',
        itemVariable: 'item', maxIterations: 100,
      });

      await handleLoopNode('l1', node, hCtx);
      expect(visit).toHaveBeenCalledTimes(3); // 2 body + 1 done
    });

    it('uses countExpression for dynamic count', async () => {
      const ctx = makeCtx({ total: '2' });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('l1', [
        makeEdge('e1', 'l1', 'body1', 'body'),
        makeEdge('e2', 'l1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('l1', 'loop', {
        mode: 'count', countExpression: '{{total}}', maxIterations: 100,
      });

      await handleLoopNode('l1', node, hCtx);
      expect(visit).toHaveBeenCalledTimes(3); // 2 body + 1 done
    });

    it('does not loop for unknown loop type', async () => {
      const ctx = makeCtx();
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('l1', [
        makeEdge('e1', 'l1', 'body1', 'body'),
        makeEdge('e2', 'l1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('l1', 'loop', {
        mode: 'unknownType', count: 3, maxIterations: 100,
      });
      const passed = makePassedFlag();

      await handleLoopNode('l1', node, hCtx, passed);

      // Unknown type => shouldContinue returns false => no body visits, only done branch
      const bodyVisits = visit.mock.calls.filter((c: string[]) => c[0] === 'body1');
      expect(bodyVisits).toHaveLength(0);
      // done branch is visited
      const doneVisits = visit.mock.calls.filter((c: string[]) => c[0] === 'done1');
      expect(doneVisits).toHaveLength(1);
    });
  });

  // ── handleSetVariableNode ──
  describe('handleSetVariableNode', () => {
    it('sets variables from assignments', async () => {
      const ctx = makeCtx({ name: 'world' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('sv1', 'setVariable', {
        assignments: [
          { name: 'greeting', expression: 'hello {{name}}' },
          { name: 'static', expression: 'constant' },
        ],
      });

      await handleSetVariableNode('sv1', node, hCtx);

      expect(states['sv1']?.state).toBe('pass');
      expect(ctx.resolve('{{greeting}}')).toBe('hello world');
      expect(ctx.resolve('{{static}}')).toBe('constant');
    });

    it('skips assignments without names', async () => {
      const ctx = makeCtx();
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('sv1', 'setVariable', {
        assignments: [{ name: '', expression: 'ignored' }],
      });

      await handleSetVariableNode('sv1', node, hCtx);
    });
  });

  // ── handleScriptNode ──
  describe('handleScriptNode', () => {
    it('executes script and captures outputs', async () => {
      mockExecuteScript.mockReturnValue({
        success: true,
        outputs: { result: '42' },
        consoleLogs: [],
        error: undefined,
      });

      const ctx = makeCtx({ input: 'test' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('sc1', 'script', {
        mode: 'expression',
        inputVariables: ['input'],
        outputVariables: ['result'],
        code: 'return 42',
      });

      await handleScriptNode('sc1', node, hCtx, makePassedFlag());

      expect(states['sc1']?.state).toBe('pass');
      expect(ctx.resolve('{{result}}')).toBe('42');
    });

    it('marks fail on script error', async () => {
      mockExecuteScript.mockReturnValue({
        success: false,
        outputs: {},
        consoleLogs: [],
        error: 'SyntaxError: unexpected token',
      });

      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks });
      const node = makeNode('sc1', 'script', {
        mode: 'expression',
        inputVariables: [],
        outputVariables: [],
        code: 'invalid{{',
      });
      const passed = makePassedFlag();

      await handleScriptNode('sc1', node, hCtx, passed);

      expect(states['sc1']?.state).toBe('fail');
      expect(passed.value).toBe(false);
    });

    it('captures console logs when enabled', async () => {
      mockExecuteScript.mockReturnValue({
        success: true,
        outputs: {},
        consoleLogs: ['hello from script', 'debug info'],
        error: undefined,
      });

      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('sc1', 'script', {
        mode: 'expression',
        inputVariables: [],
        outputVariables: [],
        code: '',
        captureConsole: true,
      });

      await handleScriptNode('sc1', node, hCtx, makePassedFlag());

      expect(logLines.some(l => l.text.includes('hello from script'))).toBe(true);
      expect(logLines.some(l => l.text.includes('debug info'))).toBe(true);
    });
  });

  // ── handleAggregateNode ──
  describe('handleAggregateNode', () => {
    it('handles concat strategy', async () => {
      const ctx = makeCtx({ source: '"item1"' });
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('a1', 'aggregate', {
        mappings: [
          { targetVariable: 'collected', sourceExpression: '{{source}}', strategy: 'concat' },
        ],
      });

      await handleAggregateNode('a1', node, hCtx);
      expect(states['a1']?.state).toBe('pass');
      expect(ctx.resolve('{{collected}}')).toBe('["item1"]');
    });

    it('handles sum strategy', async () => {
      const ctx = makeCtx({ amount: '10' });
      ctx.set('total', '5');
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('a1', 'aggregate', {
        mappings: [
          { targetVariable: 'total', sourceExpression: '{{amount}}', strategy: 'sum' },
        ],
      });

      await handleAggregateNode('a1', node, hCtx);
      expect(ctx.resolve('{{total}}')).toBe('15');
    });

    it('handles count strategy', async () => {
      const ctx = makeCtx();
      ctx.set('counter', '3');
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('a1', 'aggregate', {
        mappings: [
          { targetVariable: 'counter', sourceExpression: '', strategy: 'count' },
        ],
      });

      await handleAggregateNode('a1', node, hCtx);
      expect(ctx.resolve('{{counter}}')).toBe('4');
    });

    it('handles first strategy', async () => {
      const ctx = makeCtx({ val: 'first-value' });
      ctx.set('target', 'already-set');
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('a1', 'aggregate', {
        mappings: [
          { targetVariable: 'target', sourceExpression: '{{val}}', strategy: 'first' },
        ],
      });

      await handleAggregateNode('a1', node, hCtx);
      expect(ctx.resolve('{{target}}')).toBe('already-set');
    });

    it('handles last strategy', async () => {
      const ctx = makeCtx({ val: 'latest' });
      ctx.set('target', 'old');
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('a1', 'aggregate', {
        mappings: [
          { targetVariable: 'target', sourceExpression: '{{val}}', strategy: 'last' },
        ],
      });

      await handleAggregateNode('a1', node, hCtx);
      expect(ctx.resolve('{{target}}')).toBe('latest');
    });

    it('handles custom strategy', async () => {
      const ctx = makeCtx({ val: 'hello' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('a1', 'aggregate', {
        mappings: [
          { targetVariable: 'result', sourceExpression: '{{val}}', strategy: 'custom', customExpression: '{{val}}-custom' },
        ],
      });

      await handleAggregateNode('a1', node, hCtx);
      expect(ctx.resolve('{{result}}')).toBe('hello-custom');
    });

    it('handles default strategy', async () => {
      const ctx = makeCtx({ val: 'hello' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('a1', 'aggregate', {
        mappings: [
          { targetVariable: 'result', sourceExpression: '{{val}}', strategy: 'unknown' },
        ],
      });

      await handleAggregateNode('a1', node, hCtx);
      expect(ctx.resolve('{{result}}')).toBe('hello');
    });

    it('skips mappings without targetVariable', async () => {
      const ctx = makeCtx();
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('a1', 'aggregate', {
        mappings: [
          { targetVariable: '', sourceExpression: 'val', strategy: 'last' },
        ],
      });

      await handleAggregateNode('a1', node, hCtx);
    });
  });

  // ── handleLogDebugNode ──
  describe('handleLogDebugNode', () => {
    it('logs resolved message with level prefix', async () => {
      const ctx = makeCtx({ user: 'Alice' });
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('ld1', 'logDebug', {
        message: 'Hello {{user}}!',
        logLevel: 'info',
      });

      await handleLogDebugNode('ld1', node, hCtx);

      expect(states['ld1']?.state).toBe('pass');
      expect(logLines.some(l => l.text.includes('Hello Alice!'))).toBe(true);
      expect(logLines.some(l => l.text.includes('[INFO]'))).toBe(true);
    });

    it('warns about unresolved variables', async () => {
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('ld1', 'logDebug', {
        message: 'Value is {{undefined_var}}',
        logLevel: 'info',
      });

      await handleLogDebugNode('ld1', node, hCtx);

      expect(logLines.some(l => l.text.includes('Unresolved variable'))).toBe(true);
    });

    it('snapshots variables when enabled', async () => {
      const ctx = makeCtx({ x: '1', y: '2' });
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('ld1', 'logDebug', {
        message: 'snapshot',
        logLevel: 'debug',
        snapshotVariables: true,
      });

      await handleLogDebugNode('ld1', node, hCtx);

      expect(logLines.some(l => l.text.includes('Variable snapshot'))).toBe(true);
    });

    it('handles error log level', async () => {
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('ld1', 'logDebug', {
        message: 'error msg', logLevel: 'error',
      });

      await handleLogDebugNode('ld1', node, hCtx);
      expect(logLines[0]?.prefix).toBe('!');
    });

    it('handles warn log level', async () => {
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('ld1', 'logDebug', {
        message: 'warn msg', logLevel: 'warn',
      });

      await handleLogDebugNode('ld1', node, hCtx);
      expect(logLines[0]?.prefix).toBe('⚠');
    });
  });

  // ── handleErrorHandlerNode ──
  describe('handleErrorHandlerNode', () => {
    it('warns about multiple unresolved variables', async () => {
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('ld1', 'logDebug', {
        message: '{{var1}} and {{var2}} missing',
        logLevel: 'info',
      });

      await handleLogDebugNode('ld1', node, hCtx);

      const warnLog = logLines.find(l => l.text.includes('Unresolved variables'));
      expect(warnLog).toBeDefined();
    });

    it('truncates long variable values in snapshot', async () => {
      const ctx = makeCtx({ longVal: 'x'.repeat(100) });
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('ld1', 'logDebug', {
        message: 'snapshot',
        logLevel: 'info',
        snapshotVariables: true,
      });

      await handleLogDebugNode('ld1', node, hCtx);

      const truncatedLog = logLines.find(l => l.text.includes('…'));
      expect(truncatedLog).toBeDefined();
    });

    it('skips snapshot when no non-internal variables exist', async () => {
      const ctx = makeCtx();
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('ld1', 'logDebug', {
        message: 'snapshot',
        logLevel: 'info',
        snapshotVariables: true,
      });

      await handleLogDebugNode('ld1', node, hCtx);

      const snapshotLog = logLines.find(l => l.text.includes('Variable snapshot'));
      expect(snapshotLog).toBeUndefined();
    });

    it('passes when body succeeds without retry', async () => {
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('eh1', [
        makeEdge('e1', 'eh1', 'body1', 'body'),
        makeEdge('e2', 'eh1', 'catch1', 'catch'),
        makeEdge('e3', 'eh1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('catch1', makeNode('catch1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, visit, outgoing, nodeMap, results: [] });
      const node = makeNode('eh1', 'errorHandler', {
        retryCount: 0,
        errorFilter: 'all',
        retryDelayMs: 0,
        retryBackoff: 'fixed',
        retryTimeoutMs: 0,
        continueOnError: false,
      });
      const passed = makePassedFlag();

      await handleErrorHandlerNode('eh1', node, hCtx, passed);

      expect(states['eh1']?.state).toBe('pass');
      expect(passed.value).toBe(true);
      // Done edges should be visited
      expect(visit).toHaveBeenCalledWith('done1', 'main');
    });

    it('executes catch path when body fails', async () => {
      const visit = vi.fn();
      const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
      // Simulate body failure: add a failed result when body is visited
      visit.mockImplementation(async (nodeId: string) => {
        if (nodeId === 'body1') {
          results.push({
            passed: false,
            httpStatus: 500,
            errorMessage: 'Server Error',
            scenarioId: 'body1',
            scenarioName: 'BodyStep',
          });
        }
      });

      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('eh1', [
        makeEdge('e1', 'eh1', 'body1', 'body'),
        makeEdge('e2', 'eh1', 'catch1', 'catch'),
        makeEdge('e3', 'eh1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('catch1', makeNode('catch1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));

      const ctx = makeCtx();
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks, visit, outgoing, nodeMap, ctx,
        results: results as unknown as import('../../../shared/types').RequestResult[],
      });
      const node = makeNode('eh1', 'errorHandler', {
        retryCount: 0,
        errorFilter: 'all',
        retryDelayMs: 0,
        retryBackoff: 'fixed',
        retryTimeoutMs: 0,
        continueOnError: false,
      });
      const passed = makePassedFlag();

      await handleErrorHandlerNode('eh1', node, hCtx, passed);

      expect(states['eh1']?.state).toBe('fail');
      expect(passed.value).toBe(false);
      // Catch path should be visited
      expect(visit).toHaveBeenCalledWith('catch1', 'main-catch');
      // Error variables should be set
      expect(ctx.resolve('{{error.message}}')).toBe('Server Error');
    });

    it('continues on error when continueOnError is true', async () => {
      const visit = vi.fn();
      const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string }> = [];
      visit.mockImplementation(async (nodeId: string) => {
        if (nodeId === 'body1') {
          results.push({ passed: false, httpStatus: 500, errorMessage: 'fail' });
        }
      });

      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('eh1', [
        makeEdge('e1', 'eh1', 'body1', 'body'),
        makeEdge('e2', 'eh1', 'catch1', 'catch'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('catch1', makeNode('catch1', 'http'));

      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks, visit, outgoing, nodeMap,
        results: results as unknown as import('../../../shared/types').RequestResult[],
      });
      const node = makeNode('eh1', 'errorHandler', {
        retryCount: 0,
        errorFilter: 'all',
        retryDelayMs: 0,
        retryBackoff: 'fixed',
        retryTimeoutMs: 0,
        continueOnError: true,
      });
      const passed = makePassedFlag();

      await handleErrorHandlerNode('eh1', node, hCtx, passed);

      expect(states['eh1']?.state).toBe('pass');
      expect(passed.value).toBe(true); // continueOnError keeps passed true
    });

    it('retries body on failure with exponential backoff', async () => {
      let callCount = 0;
      const visit = vi.fn();
      const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
      visit.mockImplementation(async (nodeId: string) => {
        if (nodeId === 'body1') {
          callCount++;
          if (callCount <= 2) {
            results.push({ passed: false, httpStatus: 500, errorMessage: 'Server Error', scenarioId: 'body1', scenarioName: 'Body' });
          }
          // Third call succeeds (no failed result pushed)
        }
      });

      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('eh1', [
        makeEdge('e1', 'eh1', 'body1', 'body'),
        makeEdge('e2', 'eh1', 'catch1', 'catch'),
        makeEdge('e3', 'eh1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('catch1', makeNode('catch1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));

      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks, visit, outgoing, nodeMap,
        results: results as unknown as import('../../../shared/types').RequestResult[],
      });
      const node = makeNode('eh1', 'errorHandler', {
        retryCount: 3,
        errorFilter: 'all',
        retryDelayMs: 1,
        retryBackoff: 'exponential',
        retryTimeoutMs: 0,
        continueOnError: false,
      });
      const passed = makePassedFlag();

      await handleErrorHandlerNode('eh1', node, hCtx, passed);

      expect(states['eh1']?.state).toBe('pass');
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('does not retry when error filter does not match', async () => {
      const visit = vi.fn();
      const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
      visit.mockImplementation(async (nodeId: string) => {
        if (nodeId === 'body1') {
          results.push({ passed: false, httpStatus: 500, errorMessage: 'Server Error', scenarioId: 'body1', scenarioName: 'Body' });
        }
      });

      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('eh1', [
        makeEdge('e1', 'eh1', 'body1', 'body'),
        makeEdge('e2', 'eh1', 'catch1', 'catch'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('catch1', makeNode('catch1', 'http'));

      const { callbacks, states } = makeCallbacks();
      const ctx = makeCtx();
      const hCtx = makeHandlerContext({
        callbacks, visit, outgoing, nodeMap, ctx,
        results: results as unknown as import('../../../shared/types').RequestResult[],
      });
      const node = makeNode('eh1', 'errorHandler', {
        retryCount: 3,
        errorFilter: 'network-error',
        retryDelayMs: 0,
        retryBackoff: 'fixed',
        retryTimeoutMs: 0,
        continueOnError: false,
      });
      const passed = makePassedFlag();

      await handleErrorHandlerNode('eh1', node, hCtx, passed);

      // Should not retry — body called only once
      expect(visit).toHaveBeenCalledTimes(2); // body + catch
      expect(states['eh1']?.state).toBe('fail');
    });

    it('stops retrying when retry timeout is exceeded', async () => {
      const visit = vi.fn();
      const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
      visit.mockImplementation(async (nodeId: string) => {
        if (nodeId === 'body1') {
          // Always fail + add a small delay to exceed timeout
          await new Promise(r => setTimeout(r, 5));
          results.push({ passed: false, httpStatus: 500, errorMessage: 'Server Error', scenarioId: 'body1', scenarioName: 'Body' });
        }
      });

      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('eh1', [
        makeEdge('e1', 'eh1', 'body1', 'body'),
        makeEdge('e2', 'eh1', 'catch1', 'catch'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('catch1', makeNode('catch1', 'http'));
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks, visit, outgoing, nodeMap,
        results: results as unknown as import('../../../shared/types').RequestResult[],
        log: (line) => logLines.push(line),
      });
      const node = makeNode('eh1', 'errorHandler', {
        retryCount: 100,
        errorFilter: 'all',
        retryDelayMs: 1,
        retryBackoff: 'fixed',
        retryTimeoutMs: 1, // very short timeout
        continueOnError: false,
      });
      const passed = makePassedFlag();

      await handleErrorHandlerNode('eh1', node, hCtx, passed);

      const timeoutLog = logLines.find(l => l.text.includes('Retry timeout'));
      expect(timeoutLog).toBeDefined();
    });
  });

  // ── handleWaitForConditionNode ──
  describe('handleWaitForConditionNode', () => {
    it('completes when condition is met immediately', async () => {
      const ctx = makeCtx({ ready: 'true' });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('wc1', [
        makeEdge('e1', 'wc1', 'body1', 'body'),
        makeEdge('e2', 'wc1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('wc1', 'waitForCondition', {
        conditionExpression: '{{ready}} == true',
        pollIntervalMs: 10,
        timeoutMs: 1000,
        maxAttempts: 10,
      });
      const passed = makePassedFlag();

      await handleWaitForConditionNode('wc1', node, hCtx, passed);

      expect(states['wc1']?.state).toBe('pass');
      expect(visit).toHaveBeenCalledWith('done1', 'main');
    });

    it('fails when max attempts reached', async () => {
      const ctx = makeCtx({ ready: 'false' });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('wc1', [
        makeEdge('e1', 'wc1', 'body1', 'body'),
        makeEdge('e2', 'wc1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
      const node = makeNode('wc1', 'waitForCondition', {
        conditionExpression: '{{ready}} == true',
        pollIntervalMs: 1,
        timeoutMs: 0,
        maxAttempts: 2,
      });
      const passed = makePassedFlag();

      await handleWaitForConditionNode('wc1', node, hCtx, passed);

      expect(states['wc1']?.state).toBe('fail');
      expect(passed.value).toBe(false);
    });

    it('fails when timeout is exceeded', async () => {
      const ctx = makeCtx({ ready: 'false' });
      const visit = vi.fn();
      const outgoing = new Map<string, WorkflowEdge[]>();
      outgoing.set('wc1', [
        makeEdge('e1', 'wc1', 'body1', 'body'),
        makeEdge('e2', 'wc1', 'done1', 'done'),
      ]);
      const nodeMap = new Map<string, WorkflowNode>();
      nodeMap.set('body1', makeNode('body1', 'http'));
      nodeMap.set('done1', makeNode('done1', 'http'));
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks, states } = makeCallbacks();
      const hCtx = makeHandlerContext({
        ctx, callbacks, visit, outgoing, nodeMap,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('wc1', 'waitForCondition', {
        conditionExpression: '{{ready}} == true',
        pollIntervalMs: 1,
        timeoutMs: 1, // very short timeout
        maxAttempts: 0, // no max attempts limit
      });
      const passed = makePassedFlag();

      await handleWaitForConditionNode('wc1', node, hCtx, passed);

      expect(states['wc1']?.state).toBe('fail');
      const timeoutLog = logLines.find(l => l.text.includes('Timeout'));
      expect(timeoutLog).toBeDefined();
    });
  });

  // ── handleSubWorkflowNode ──
  describe('handleSubWorkflowNode', () => {
    it('throws when child workflow not found', async () => {
      const ctx = makeCtx();
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => undefined,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'missing-wf',
        workflowName: 'Missing',
        inputMappings: [],
        outputMappings: [],
      });
      const mockRunGraph = vi.fn();
      const passed = makePassedFlag();

      await expect(
        handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never)
      ).rejects.toThrow('Sub-workflow "Missing" not found');
    });

    it('throws on depth limit exceeded', async () => {
      const ctx = makeCtx({ __subWorkflowDepth: '10' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ ctx, callbacks });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        maxDepth: 10,
        inputMappings: [],
        outputMappings: [],
      });
      const mockRunGraph = vi.fn();
      const passed = makePassedFlag();

      await expect(
        handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never)
      ).rejects.toThrow('depth limit');
    });

    it('executes child workflow and maps outputs', async () => {
      const ctx = makeCtx({ input: 'hello' });
      const { callbacks, states } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start'), makeNode('ce1', 'end')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [{ sourceExpression: '{{input}}', targetVariable: 'childInput' }],
        outputMappings: [{ sourceVariable: 'childOutput', targetVariable: 'parentResult' }],
        onChildFailure: 'fail',
      });

      const mockRunGraph = vi.fn().mockResolvedValue([]);
      // Simulate child completing with output
      mockRunGraph.mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
        cb.onVariablesChange({ childOutput: 'result-value' });
        cb.onComplete([], true);
        return [];
      });
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(states['sub1']?.state).toBe('pass');
      expect(ctx.resolve('{{parentResult}}')).toBe('result-value');
    });

    it('handles empty multi-instance collection', async () => {
      const ctx = makeCtx({ items: '[]' });
      const { callbacks, states } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        multiInstance: {
          collection: '{{items}}',
          elementVariable: 'item',
          mode: 'sequential',
        },
      });
      const mockRunGraph = vi.fn();
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(states['sub1']?.state).toBe('pass');
      expect(mockRunGraph).not.toHaveBeenCalled();
    });

    it('throws on invalid multi-instance collection', async () => {
      const ctx = makeCtx({ items: 'not-json' });
      const { callbacks } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        inputMappings: [],
        outputMappings: [],
        multiInstance: {
          collection: '{{items}}',
          elementVariable: 'item',
          mode: 'sequential',
        },
      });
      const mockRunGraph = vi.fn();
      const passed = makePassedFlag();

      await expect(
        handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never)
      ).rejects.toThrow('did not resolve to a JSON array');
    });

    it('handles multi-instance sequential execution', async () => {
      const ctx = makeCtx({ items: '["a","b"]' });
      const { callbacks, states } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        multiInstance: {
          collection: '{{items}}',
          elementVariable: 'item',
          mode: 'sequential',
        },
        onChildFailure: 'fail',
      });
      const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
        cb.onVariablesChange({});
        cb.onComplete([], true);
        return [];
      });
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(states['sub1']?.state).toBe('pass');
      expect(mockRunGraph).toHaveBeenCalledTimes(2);
    });

    it('handles multi-instance parallel execution', async () => {
      const ctx = makeCtx({ items: '["x","y","z"]' });
      const { callbacks, states } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        multiInstance: {
          collection: '{{items}}',
          elementVariable: 'item',
          mode: 'parallel',
        },
        onChildFailure: 'fail',
      });
      const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
        cb.onVariablesChange({});
        cb.onComplete([], true);
        return [];
      });
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(states['sub1']?.state).toBe('pass');
      expect(mockRunGraph).toHaveBeenCalledTimes(3);
    });

    it('continues on child failure when onChildFailure is continue', async () => {
      const ctx = makeCtx({ input: 'hello' });
      const { callbacks, states } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        onChildFailure: 'continue',
      });
      const failResult = { passed: false, httpStatus: 500 };
      const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
        cb.onVariablesChange({});
        cb.onComplete([failResult], false);
        return [failResult];
      });
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(states['sub1']?.state).toBe('pass');
      expect(ctx.resolve('{{__subWorkflowFailed}}')).toBe('true');
    });

    it('propagates all outputs when propagateAllOutputs is true', async () => {
      const ctx = makeCtx();
      const { callbacks } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        propagateAllOutputs: true,
        onChildFailure: 'fail',
      });
      const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
        cb.onVariablesChange({ result: '42', __internal: 'skip' });
        cb.onComplete([], true);
        return [];
      });
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(ctx.resolve('{{result}}')).toBe('42');
      // __internal should not be propagated
      expect(ctx.resolve('{{__internal}}')).toBe('{{__internal}}');
    });

    it('fires onSubWorkflowComplete callback for single execution', async () => {
      const ctx = makeCtx();
      const { callbacks } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'http', { label: 'Step1' })],
        edges: [],
      };
      const onSubWorkflowComplete = vi.fn();
      callbacks.onSubWorkflowComplete = onSubWorkflowComplete;
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        onChildFailure: 'fail',
      });
      const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
        cb.onVariablesChange({});
        cb.onComplete([], true);
        return [];
      });
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(onSubWorkflowComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          parentNodeId: 'sub1',
          childWorkflowName: 'Child WF',
          passed: true,
        })
      );
    });

    it('resolves dynamic workflowId from variables', async () => {
      const ctx = makeCtx({ wfId: 'dynamic-wf-123' });
      const { callbacks } = makeCallbacks();
      const childWorkflow = {
        name: 'Dynamic WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const resolveSubWorkflow = vi.fn(() => childWorkflow);
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: '{{wfId}}',
        workflowName: 'Dynamic WF',
        inputMappings: [],
        outputMappings: [],
        onChildFailure: 'fail',
      });
      const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
        cb.onVariablesChange({});
        cb.onComplete([], true);
        return [];
      });
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(resolveSubWorkflow).toHaveBeenCalledWith('dynamic-wf-123');
    });

    it('handles non-array multi-instance collection', async () => {
      const ctx = makeCtx({ items: '"not-an-array"' });
      const { callbacks } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        inputMappings: [],
        outputMappings: [],
        multiInstance: {
          collection: '{{items}}',
          elementVariable: 'item',
          mode: 'sequential',
        },
      });
      const mockRunGraph = vi.fn();
      const passed = makePassedFlag();

      await expect(
        handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never)
      ).rejects.toThrow('did not resolve to a JSON array');
    });

    it('sets up timeout with parent abort signal propagation', async () => {
      const ctx = makeCtx();
      const controller = new AbortController();
      const { callbacks } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
        abortSignal: controller.signal,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        timeoutMs: 5000,
        onChildFailure: 'fail',
      });
      const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
        cb.onVariablesChange({});
        cb.onComplete([], true);
        return [];
      });
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(mockRunGraph).toHaveBeenCalled();
      // Verify the abort signal was passed to child
      const callArgs = mockRunGraph.mock.calls[0];
      expect(callArgs[4]).toBeDefined(); // abortSignal parameter
    });

    it('retries child workflow on failure', async () => {
      const ctx = makeCtx();
      let callCount = 0;
      const { callbacks, states } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        retryCount: 2,
        retryDelayMs: 1,
        onChildFailure: 'fail',
      });
      const failResult = { passed: false, httpStatus: 500 };
      const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
        callCount++;
        if (callCount <= 2) {
          cb.onVariablesChange({});
          cb.onComplete([failResult], false);
          return [failResult];
        }
        cb.onVariablesChange({});
        cb.onComplete([], true);
        return [];
      });
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(mockRunGraph).toHaveBeenCalledTimes(3);
      expect(states['sub1']?.state).toBe('pass');
    });

    it('fires onSubWorkflowComplete for multi-instance items', async () => {
      const ctx = makeCtx({ items: '["a","b"]' });
      const { callbacks } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'http', { label: 'Step1' })],
        edges: [],
      };
      const onSubWorkflowComplete = vi.fn();
      callbacks.onSubWorkflowComplete = onSubWorkflowComplete;
      const hCtx = makeHandlerContext({
        ctx, callbacks,
        resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        multiInstance: {
          collection: '{{items}}',
          elementVariable: 'item',
          mode: 'sequential',
        },
        onChildFailure: 'fail',
      });
      const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
        cb.onVariablesChange({});
        cb.onComplete([], true);
        return [];
      });
      const passed = makePassedFlag();

      await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

      expect(onSubWorkflowComplete).toHaveBeenCalledTimes(2);
    });
  });
});
