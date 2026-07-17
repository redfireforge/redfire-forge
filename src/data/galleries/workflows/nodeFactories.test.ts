import { describe, it, expect } from 'vitest';
import {
  makeGetNode,
  makePostNode,
  makePutNode,
  makeDeleteNode,
  makeStartNode,
  makeEndNode,
  makeConditionNode,
  makeLogDebugNode,
  makeSetVariableNode,
  makeDelayNode,
  makeForkNode,
  makeJoinNode,
  makeEdge,
  jsonBody,
  bodyExtraction,
  headerExtraction,
} from './nodeFactories';

describe('nodeFactories', () => {
  // ── makeGetNode ──────────────────────────────────────────────────────────
  describe('makeGetNode', () => {
    it('creates a GET node with correct type and defaults', () => {
      const node = makeGetNode('n1', 'Fetch Data', 'https://api.example.com/data');
      expect(node.id).toBe('n1');
      expect(node.type).toBe('http');
      expect(node.data.label).toBe('Fetch Data');
      expect(node.data.scenario.method).toBe('GET');
      expect(node.data.scenario.url).toBe('https://api.example.com/data');
    });

    it('uses Accept:application/json header by default', () => {
      const node = makeGetNode('n1', 'Fetch', 'https://api.example.com');
      expect(node.data.scenario.headers).toContainEqual({
        key: 'Accept',
        value: 'application/json',
      });
    });

    it('sets no-auth and no-validation', () => {
      const node = makeGetNode('n1', 'Fetch', 'https://api.example.com');
      expect(node.data.scenario.auth).toEqual({ type: 'none' });
      expect(node.data.scenario.validation).toEqual({ mode: 'none' });
    });

    it('has an empty body string', () => {
      const node = makeGetNode('n1', 'Fetch', 'https://api.example.com');
      expect(node.data.scenario.body).toBe('');
    });

    it('derives scenario id from node id', () => {
      const node = makeGetNode('my-node', 'Label', 'https://api.example.com');
      expect(node.data.scenario.id).toBe('my-node-sc');
    });

    it('applies default position x=300 y=140', () => {
      const node = makeGetNode('n1', 'Fetch', 'https://api.example.com');
      expect(node.position).toEqual({ x: 300, y: 140 });
    });

    it('uses custom position when provided', () => {
      const node = makeGetNode('n1', 'Fetch', 'https://api.example.com', { x: 100, y: 200 });
      expect(node.position).toEqual({ x: 100, y: 200 });
    });

    it('merges extra headers after Accept header', () => {
      const node = makeGetNode('n1', 'Fetch', 'https://api.example.com', {
        extraHeaders: [{ key: 'X-Token', value: 'abc' }],
      });
      expect(node.data.scenario.headers).toEqual([
        { key: 'Accept', value: 'application/json' },
        { key: 'X-Token', value: 'abc' },
      ]);
    });

    it('includes extractions when provided', () => {
      const extractions = [bodyExtraction('userId', '$.id')];
      const node = makeGetNode('n1', 'Fetch', 'https://api.example.com', { extractions });
      expect(node.data.scenario.extractions).toEqual(extractions);
    });

    it('omits extractions key when empty', () => {
      const node = makeGetNode('n1', 'Fetch', 'https://api.example.com');
      expect(node.data.scenario).not.toHaveProperty('extractions');
    });
  });

  // ── makePostNode ─────────────────────────────────────────────────────────
  describe('makePostNode', () => {
    it('creates a POST node with JSON content-type', () => {
      const node = makePostNode('n2', 'Create Post', 'https://api.example.com/posts', '{"title":"test"}');
      expect(node.data.scenario.method).toBe('POST');
      expect(node.data.scenario.headers).toContainEqual({
        key: 'Content-Type',
        value: 'application/json',
      });
    });

    it('sets bodyType to json', () => {
      const node = makePostNode('n2', 'Create', 'https://api.example.com', '{}');
      expect(node.data.scenario.bodyType).toBe('json');
    });

    it('preserves the body string as-is', () => {
      const body = jsonBody({ foo: 'bar' });
      const node = makePostNode('n2', 'Create', 'https://api.example.com', body);
      expect(node.data.scenario.body).toBe(body);
    });

    it('sets no-auth and no-validation', () => {
      const node = makePostNode('n2', 'Create', 'https://api.example.com', '{}');
      expect(node.data.scenario.auth).toEqual({ type: 'none' });
      expect(node.data.scenario.validation).toEqual({ mode: 'none' });
    });

    it('merges extra headers after Content-Type', () => {
      const node = makePostNode('n2', 'Create', 'https://api.example.com', '{}', {
        extraHeaders: [{ key: 'X-Idempotency-Key', value: 'abc' }],
      });
      expect(node.data.scenario.headers[0]).toEqual({
        key: 'Content-Type',
        value: 'application/json',
      });
      expect(node.data.scenario.headers[1]).toEqual({ key: 'X-Idempotency-Key', value: 'abc' });
    });

    it('includes extractions when provided', () => {
      const extractions = [bodyExtraction('id', '$.id')];
      const node = makePostNode('n2', 'Create', 'https://api.example.com', '{}', { extractions });
      expect(node.data.scenario.extractions).toEqual(extractions);
    });
  });

  // ── makePutNode ──────────────────────────────────────────────────────────
  describe('makePutNode', () => {
    it('creates a PUT node with JSON content-type', () => {
      const node = makePutNode('n3', 'Update', 'https://api.example.com/items/1', '{}');
      expect(node.data.scenario.method).toBe('PUT');
      expect(node.data.scenario.bodyType).toBe('json');
    });

    it('sets no-auth and no-validation', () => {
      const node = makePutNode('n3', 'Update', 'https://api.example.com/items/1', '{}');
      expect(node.data.scenario.auth).toEqual({ type: 'none' });
      expect(node.data.scenario.validation).toEqual({ mode: 'none' });
    });
  });

  // ── makeDeleteNode ───────────────────────────────────────────────────────
  describe('makeDeleteNode', () => {
    it('creates a DELETE node', () => {
      const node = makeDeleteNode('n4', 'Delete Item', 'https://api.example.com/items/1');
      expect(node.data.scenario.method).toBe('DELETE');
      expect(node.data.scenario.body).toBe('');
    });

    it('sets no-auth and no-validation', () => {
      const node = makeDeleteNode('n4', 'Delete', 'https://api.example.com/items/1');
      expect(node.data.scenario.auth).toEqual({ type: 'none' });
      expect(node.data.scenario.validation).toEqual({ mode: 'none' });
    });
  });

  // ── makeStartNode ────────────────────────────────────────────────────────
  describe('makeStartNode', () => {
    it('creates a start node with label Start', () => {
      const node = makeStartNode('s1');
      expect(node.type).toBe('start');
      expect(node.data.label).toBe('Start');
    });

    it('uses default position x=300 y=0', () => {
      const node = makeStartNode('s1');
      expect(node.position).toEqual({ x: 300, y: 0 });
    });

    it('passes inputVariables to data', () => {
      const node = makeStartNode('s1', { orderId: 'ORD-001', amount: '99.99' });
      expect(node.data.inputVariables).toEqual({ orderId: 'ORD-001', amount: '99.99' });
    });

    it('defaults inputVariables to empty object', () => {
      const node = makeStartNode('s1');
      expect(node.data.inputVariables).toEqual({});
    });

    it('uses custom position', () => {
      const node = makeStartNode('s1', {}, { x: 500, y: 10 });
      expect(node.position).toEqual({ x: 500, y: 10 });
    });
  });

  // ── makeEndNode ──────────────────────────────────────────────────────────
  describe('makeEndNode', () => {
    it('creates an end node with default label Done', () => {
      const node = makeEndNode('e1');
      expect(node.type).toBe('end');
      expect(node.data.label).toBe('Done');
    });

    it('uses a custom label', () => {
      const node = makeEndNode('e1', 'Order Complete');
      expect(node.data.label).toBe('Order Complete');
    });

    it('uses custom position', () => {
      const node = makeEndNode('e1', 'Done', { x: 200, y: 800 });
      expect(node.position).toEqual({ x: 200, y: 800 });
    });
  });

  // ── makeConditionNode ────────────────────────────────────────────────────
  describe('makeConditionNode', () => {
    it('creates a condition node with default == operator', () => {
      const node = makeConditionNode('c1', 'Is OK?', '{{status}}', '200');
      expect(node.type).toBe('condition');
      expect(node.data.label).toBe('Is OK?');
      expect(node.data.left).toBe('{{status}}');
      expect(node.data.operator).toBe('==');
      expect(node.data.right).toBe('200');
    });

    it('allows a custom operator', () => {
      const node = makeConditionNode('c1', 'Greater?', '{{count}}', '10', { operator: '>' });
      expect(node.data.operator).toBe('>');
    });

    it('uses custom position', () => {
      const node = makeConditionNode('c1', 'Check', '{{x}}', '1', { x: 50, y: 500 });
      expect(node.position).toEqual({ x: 50, y: 500 });
    });
  });

  // ── makeLogDebugNode ─────────────────────────────────────────────────────
  describe('makeLogDebugNode', () => {
    it('creates a logDebug node with default info level', () => {
      const node = makeLogDebugNode('l1', 'Log: Created', 'Job created: {{jobId}}');
      expect(node.type).toBe('logDebug');
      expect(node.data.logLevel).toBe('info');
      expect(node.data.message).toBe('Job created: {{jobId}}');
      expect(node.data.snapshotVariables).toBe(false);
    });

    it('uses custom log level', () => {
      const node = makeLogDebugNode('l1', 'Log Error', 'msg', 'error');
      expect(node.data.logLevel).toBe('error');
    });

    it('supports snapshotVariables option', () => {
      const node = makeLogDebugNode('l1', 'Log', 'msg', 'warn', { snapshotVariables: true });
      expect(node.data.snapshotVariables).toBe(true);
    });
  });

  // ── makeSetVariableNode ──────────────────────────────────────────────────
  describe('makeSetVariableNode', () => {
    it('creates a setVariable node with assignments', () => {
      const assignments = [{ id: 'a1', name: 'orderId', expression: '{{id}}' }];
      const node = makeSetVariableNode('sv1', 'Set Order ID', assignments);
      expect(node.type).toBe('setVariable');
      expect(node.data.assignments).toEqual(assignments);
    });
  });

  // ── makeDelayNode ────────────────────────────────────────────────────────
  describe('makeDelayNode', () => {
    it('creates a delay node with fixed mode', () => {
      const node = makeDelayNode('d1', 'Wait 2s', 2000);
      expect(node.type).toBe('delay');
      expect(node.data.delayMs).toBe(2000);
      expect(node.data.mode).toBe('fixed');
    });
  });

  // ── makeForkNode ─────────────────────────────────────────────────────────
  describe('makeForkNode', () => {
    it('creates a fork node', () => {
      const node = makeForkNode('f1', 'Fork Payments');
      expect(node.type).toBe('fork');
      expect(node.data.label).toBe('Fork Payments');
    });
  });

  // ── makeJoinNode ─────────────────────────────────────────────────────────
  describe('makeJoinNode', () => {
    it('creates a join node', () => {
      const node = makeJoinNode('j1', 'Join Results');
      expect(node.type).toBe('join');
      expect(node.data.label).toBe('Join Results');
    });
  });

  // ── makeEdge ─────────────────────────────────────────────────────────────
  describe('makeEdge', () => {
    it('creates an edge without label', () => {
      const edge = makeEdge('e1', 'start', 'step1');
      expect(edge).toEqual({ id: 'e1', source: 'start', target: 'step1' });
      expect(edge).not.toHaveProperty('label');
    });

    it('creates an edge with label', () => {
      const edge = makeEdge('e1', 'cond', 'step-yes', 'true');
      expect(edge).toEqual({ id: 'e1', source: 'cond', target: 'step-yes', label: 'true' });
    });
  });

  // ── jsonBody ─────────────────────────────────────────────────────────────
  describe('jsonBody', () => {
    it('serializes an object to pretty-printed JSON', () => {
      const result = jsonBody({ foo: 'bar', num: 42 });
      expect(result).toBe(JSON.stringify({ foo: 'bar', num: 42 }, null, 2));
    });

    it('handles nested objects', () => {
      const result = jsonBody({ a: { b: [1, 2, 3] } });
      const parsed = JSON.parse(result);
      expect(parsed.a.b).toEqual([1, 2, 3]);
    });
  });

  // ── bodyExtraction ────────────────────────────────────────────────────────
  describe('bodyExtraction', () => {
    it('creates a body extraction rule', () => {
      const ext = bodyExtraction('userId', '$.id');
      expect(ext).toEqual({ name: 'userId', source: 'body', expression: '$.id' });
    });
  });

  // ── headerExtraction ──────────────────────────────────────────────────────
  describe('headerExtraction', () => {
    it('creates a header extraction rule', () => {
      const ext = headerExtraction('correlationId', 'X-Correlation-ID');
      expect(ext).toEqual({ name: 'correlationId', source: 'header', expression: 'X-Correlation-ID' });
    });
  });
});
