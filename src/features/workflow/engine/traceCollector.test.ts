import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TraceCollector } from './traceCollector';
import type { WorkflowNode } from '../types/workflow';

describe('TraceCollector', () => {
  let collector: TraceCollector;
  let mockNodes: WorkflowNode[];

  beforeEach(() => {
    mockNodes = [
      { id: 'n1', type: 'http', data: { label: 'Create Order' }, position: { x: 0, y: 0 } },
      { id: 'n2', type: 'condition', data: { label: 'Check Status' }, position: { x: 0, y: 0 } },
      { id: 'n3', type: 'http', data: { label: 'Update Order' }, position: { x: 0, y: 0 } },
    ];
    collector = new TraceCollector(mockNodes);
  });

  describe('node execution tracking', () => {
    it('captures start and completion with duration', async () => {
      const startTime = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(startTime);

      collector.onNodeStart('n1');
      
      vi.advanceTimersByTime(245);
      collector.onNodeComplete('n1', 'pass', { statusCode: 201, responseTimeMs: 245 });

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].nodeId).toBe('n1');
      expect(events[0].state).toBe('pass');
      expect(events[0].durationMs).toBe(245);
      expect(events[0].details?.statusCode).toBe(201);

      vi.useRealTimers();
    });

    it('captures multiple node executions in order', () => {
      vi.useFakeTimers();
      const start = Date.now();
      vi.setSystemTime(start);

      // n1 is HTTP - should have timing (uses responseTimeMs when provided)
      collector.onNodeStart('n1');
      vi.advanceTimersByTime(100);
      collector.onNodeComplete('n1', 'pass', { responseTimeMs: 100 });

      vi.advanceTimersByTime(50);
      // n2 is condition - no meaningful timing (control-flow node)
      collector.onNodeStart('n2');
      vi.advanceTimersByTime(30);
      collector.onNodeComplete('n2', 'pass');

      // n3 is HTTP - should have timing
      vi.advanceTimersByTime(20);
      collector.onNodeStart('n3');
      vi.advanceTimersByTime(75);
      collector.onNodeComplete('n3', 'pass', { responseTimeMs: 75 });

      const events = collector.getEvents();
      expect(events).toHaveLength(3);
      expect(events[0].nodeId).toBe('n1');
      expect(events[0].durationMs).toBe(100);
      expect(events[1].nodeId).toBe('n2');
      expect(events[1].durationMs).toBeUndefined(); // control-flow node has no timing
      expect(events[2].nodeId).toBe('n3');
      expect(events[2].durationMs).toBe(75);
      expect(events[1].timestamp).toBeGreaterThan(events[0].timestamp);

      vi.useRealTimers();
    });

    it('handles failed nodes', () => {
      collector.onNodeStart('n3');
      collector.onNodeComplete('n3', 'fail', {
        statusCode: 500,
        error: 'Internal Server Error',
      });

      const events = collector.getEvents();
      expect(events[0].state).toBe('fail');
      expect(events[0].details?.error).toBe('Internal Server Error');
    });

    it('handles skipped nodes', () => {
      // n2 is condition node - control-flow nodes don't track timing
      collector.onNodeStart('n2');
      collector.onNodeComplete('n2', 'skipped');

      const events = collector.getEvents();
      expect(events[0].state).toBe('skipped');
      expect(events[0].durationMs).toBeUndefined(); // control-flow node
    });

    it('does NOT track duration for delay nodes (synthetic wait time is not meaningful)', () => {
      // Delay nodes show configured wait time, not actual processing time
      // For performance analysis, this is not meaningful data
      const nodesWithDelay: WorkflowNode[] = [
        { id: 'd1', type: 'delay', data: { label: 'Wait 5s' }, position: { x: 0, y: 0 } },
      ];
      const delayCollector = new TraceCollector(nodesWithDelay);

      vi.useFakeTimers();
      vi.setSystemTime(Date.now());

      delayCollector.onNodeStart('d1');
      vi.advanceTimersByTime(5000);
      delayCollector.onNodeComplete('d1', 'pass');

      const events = delayCollector.getEvents();
      expect(events[0].state).toBe('pass');
      expect(events[0].durationMs).toBeUndefined(); // delay node does NOT track timing

      vi.useRealTimers();
    });

    it('tracks wall-clock duration for correlationWait nodes', () => {
      const nodesWithWait: WorkflowNode[] = [
        { id: 'cw1', type: 'correlationWait', data: { label: 'Wait for callback' }, position: { x: 0, y: 0 } },
      ];
      const waitCollector = new TraceCollector(nodesWithWait);

      waitCollector.onNodeStart('cw1');
      waitCollector.onNodeComplete('cw1', 'pass');

      const events = waitCollector.getEvents();
      expect(events[0].state).toBe('pass');
      expect(events[0].durationMs).toBeDefined();
    });

    it('uses subWorkflowTrace.totalDurationMs for sub-workflow nodes', () => {
      const nodesWithSub: WorkflowNode[] = [
        { id: 'sw1', type: 'subWorkflow', data: { label: 'Run Child' }, position: { x: 0, y: 0 } },
      ];
      const subCollector = new TraceCollector(nodesWithSub);

      subCollector.onNodeStart('sw1');
      subCollector.onNodeComplete('sw1', 'pass', {
        subWorkflowId: 'child-wf',
        subWorkflowPassed: true,
        subWorkflowTrace: {
          iterations: [],
          traversedEdges: [],
          workflowSnapshot: { nodes: [], edges: [] },
          workflowId: 'child-wf',
          workflowName: 'Child',
          totalIterations: 1,
          totalDurationMs: 350,
        },
      });

      const events = subCollector.getEvents();
      expect(events[0].durationMs).toBe(350);
    });

    it('falls back to wall-clock duration for sub-workflow without trace', () => {
      const nodesWithSub: WorkflowNode[] = [
        { id: 'sw1', type: 'subWorkflow', data: { label: 'Run Child' }, position: { x: 0, y: 0 } },
      ];
      const subCollector = new TraceCollector(nodesWithSub);

      vi.useFakeTimers();
      vi.setSystemTime(Date.now());

      subCollector.onNodeStart('sw1');
      vi.advanceTimersByTime(200);
      subCollector.onNodeComplete('sw1', 'pass', {
        subWorkflowId: 'child-wf',
        subWorkflowPassed: true,
      });

      const events = subCollector.getEvents();
      expect(events[0].durationMs).toBe(200);

      vi.useRealTimers();
    });

    it('uses waitDurationMs from details for correlationWait nodes', () => {
      const nodesWithWait: WorkflowNode[] = [
        { id: 'cw1', type: 'correlationWait', data: { label: 'Wait for callback' }, position: { x: 0, y: 0 } },
      ];
      const waitCollector = new TraceCollector(nodesWithWait);

      waitCollector.onNodeStart('cw1');
      waitCollector.onNodeComplete('cw1', 'pass', { waitDurationMs: 5000 });

      const events = waitCollector.getEvents();
      expect(events[0].durationMs).toBe(5000);
    });

    it('extracts node label from data', () => {
      collector.onNodeStart('n1');
      collector.onNodeComplete('n1', 'pass');

      const events = collector.getEvents();
      expect(events[0].nodeLabel).toBe('Create Order');
    });

    it('handles unknown node gracefully', () => {
      collector.onNodeStart('unknown-node');
      collector.onNodeComplete('unknown-node', 'pass');

      const events = collector.getEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe('edge traversal tracking', () => {
    it('records traversed edges', () => {
      collector.onEdgeTraversed('e1');
      collector.onEdgeTraversed('e2');

      const traversed = collector.getTraversedEdges();
      expect(traversed).toEqual(['e1', 'e2']);
    });

    it('deduplicates edge IDs', () => {
      collector.onEdgeTraversed('e1');
      collector.onEdgeTraversed('e1');
      collector.onEdgeTraversed('e2');

      const traversed = collector.getTraversedEdges();
      expect(traversed).toHaveLength(2);
      expect(traversed).toContain('e1');
      expect(traversed).toContain('e2');
    });

    it('returns empty array when no edges traversed', () => {
      const traversed = collector.getTraversedEdges();
      expect(traversed).toEqual([]);
    });
  });

  describe('reset', () => {
    it('clears all events and edges', () => {
      collector.onNodeStart('n1');
      collector.onNodeComplete('n1', 'pass');
      collector.onEdgeTraversed('e1');

      expect(collector.getEvents()).toHaveLength(1);
      expect(collector.getTraversedEdges()).toHaveLength(1);

      collector.reset();

      expect(collector.getEvents()).toHaveLength(0);
      expect(collector.getTraversedEdges()).toHaveLength(0);
    });

    it('allows reuse after reset', () => {
      collector.onNodeStart('n1');
      collector.onNodeComplete('n1', 'pass');
      collector.reset();

      collector.onNodeStart('n2');
      collector.onNodeComplete('n2', 'pass');

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].nodeId).toBe('n2');
    });
  });

  describe('execution details', () => {
    it('captures HTTP node details', () => {
      collector.onNodeStart('n1');
      collector.onNodeComplete('n1', 'pass', {
        statusCode: 201,
        responseTimeMs: 245,
        method: 'POST',
        url: 'https://api.example.com/orders',
        inputVariables: { baseUrl: 'https://api.example.com' },
        extractedVariables: { orderId: 'ORD-123' },
      });

      const events = collector.getEvents();
      expect(events[0].details?.statusCode).toBe(201);
      expect(events[0].details?.method).toBe('POST');
      expect(events[0].details?.inputVariables?.baseUrl).toBe('https://api.example.com');
      expect(events[0].details?.extractedVariables?.orderId).toBe('ORD-123');
    });

    it('captures condition node details', () => {
      collector.onNodeStart('n2');
      collector.onNodeComplete('n2', 'pass', {
        conditionResult: true,
        conditionExpression: '{{status}} === "completed"',
      });

      const events = collector.getEvents();
      expect(events[0].details?.conditionResult).toBe(true);
      expect(events[0].details?.conditionExpression).toBe('{{status}} === "completed"');
    });

    it('captures error details', () => {
      collector.onNodeStart('n1');
      collector.onNodeComplete('n1', 'fail', {
        error: 'Connection timeout',
        errorStack: 'at fetch...',
        statusCode: 0,
      });

      const events = collector.getEvents();
      expect(events[0].details?.error).toBe('Connection timeout');
      expect(events[0].details?.errorStack).toBe('at fetch...');
    });
  });

  describe('chronological ordering', () => {
    it('returns events in timestamp order', () => {
      vi.useFakeTimers();
      const start = Date.now();
      vi.setSystemTime(start);

      collector.onNodeStart('n1');
      vi.advanceTimersByTime(100);
      collector.onNodeComplete('n1', 'pass');

      collector.onNodeStart('n3');
      vi.advanceTimersByTime(50);
      collector.onNodeComplete('n3', 'pass');

      collector.onNodeStart('n2');
      vi.advanceTimersByTime(30);
      collector.onNodeComplete('n2', 'pass');

      const events = collector.getEvents();
      expect(events[0].nodeId).toBe('n1');
      expect(events[1].nodeId).toBe('n3');
      expect(events[2].nodeId).toBe('n2');

      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
      }

      vi.useRealTimers();
    });
  });
});
