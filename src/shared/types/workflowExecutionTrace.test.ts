import { describe, it, expect } from 'vitest';
import type {
  WorkflowExecutionTrace,
  WorkflowIterationTrace,
  ExecutionEvent,
  ExecutionEventDetails,
} from './index';

describe('WorkflowExecutionTrace Types', () => {
  describe('ExecutionEvent', () => {
    it('creates valid HTTP node event', () => {
      const event: ExecutionEvent = {
        nodeId: 'n1',
        nodeType: 'http',
        nodeLabel: 'Create Order',
        timestamp: Date.now(),
        state: 'pass',
        durationMs: 245,
        details: {
          statusCode: 201,
          responseTimeMs: 245,
          requestResultId: 'req-123',
          method: 'POST',
          url: 'https://api.example.com/orders',
          inputVariables: { baseUrl: 'https://api.example.com' },
          extractedVariables: { orderId: 'ORD-789' },
        },
      };

      expect(event.nodeId).toBe('n1');
      expect(event.nodeType).toBe('http');
      expect(event.state).toBe('pass');
      expect(event.details?.statusCode).toBe(201);
      expect(event.details?.extractedVariables?.orderId).toBe('ORD-789');
    });

    it('creates valid condition node event', () => {
      const event: ExecutionEvent = {
        nodeId: 'n2',
        nodeType: 'condition',
        nodeLabel: 'Check Status',
        timestamp: Date.now(),
        state: 'pass',
        durationMs: 5,
        details: {
          conditionResult: true,
          conditionExpression: '{{status}} === "completed"',
          inputVariables: { status: 'completed' },
        },
      };

      expect(event.nodeType).toBe('condition');
      expect(event.details?.conditionResult).toBe(true);
    });

    it('creates valid failed node event with error', () => {
      const event: ExecutionEvent = {
        nodeId: 'n3',
        nodeType: 'http',
        nodeLabel: 'Update Order',
        timestamp: Date.now(),
        state: 'fail',
        durationMs: 120,
        details: {
          statusCode: 500,
          responseTimeMs: 120,
          error: 'Internal Server Error',
          errorStack: 'at validateResponse...',
        },
      };

      expect(event.state).toBe('fail');
      expect(event.details?.error).toBe('Internal Server Error');
      expect(event.details?.errorStack).toBeDefined();
    });

    it('creates valid skipped node event', () => {
      const event: ExecutionEvent = {
        nodeId: 'n4',
        nodeType: 'http',
        nodeLabel: 'Error Handler',
        timestamp: Date.now(),
        state: 'skipped',
      };

      expect(event.state).toBe('skipped');
      expect(event.durationMs).toBeUndefined();
      expect(event.details).toBeUndefined();
    });
  });

  describe('WorkflowIterationTrace', () => {
    it('creates valid iteration trace', () => {
      const trace: WorkflowIterationTrace = {
        index: 0,
        passed: true,
        durationMs: 649,
        events: [
          {
            nodeId: 'n1',
            nodeType: 'http',
            nodeLabel: 'Create Order',
            timestamp: Date.now(),
            state: 'pass',
            durationMs: 245,
          },
          {
            nodeId: 'n2',
            nodeType: 'http',
            nodeLabel: 'Get Order',
            timestamp: Date.now() + 250,
            state: 'pass',
            durationMs: 120,
          },
        ],
        finalVariables: {
          baseUrl: 'https://api.example.com',
          orderId: 'ORD-789',
          status: 'completed',
        },
        traversedEdges: ['e1', 'e2'],
      };

      expect(trace.index).toBe(0);
      expect(trace.passed).toBe(true);
      expect(trace.events).toHaveLength(2);
      expect(trace.traversedEdges).toEqual(['e1', 'e2']);
      expect(trace.finalVariables.orderId).toBe('ORD-789');
    });

    it('creates failed iteration trace', () => {
      const trace: WorkflowIterationTrace = {
        index: 2,
        passed: false,
        durationMs: 1203,
        events: [
          {
            nodeId: 'n1',
            nodeType: 'http',
            nodeLabel: 'Create Order',
            timestamp: Date.now(),
            state: 'pass',
            durationMs: 245,
          },
          {
            nodeId: 'n2',
            nodeType: 'http',
            nodeLabel: 'Update Order',
            timestamp: Date.now() + 250,
            state: 'fail',
            durationMs: 120,
            details: { error: 'Validation failed' },
          },
        ],
        finalVariables: {},
        traversedEdges: ['e1'],
      };

      expect(trace.passed).toBe(false);
      expect(trace.events[1].state).toBe('fail');
    });
  });

  describe('WorkflowExecutionTrace', () => {
    it('creates valid complete trace', () => {
      const trace: WorkflowExecutionTrace = {
        workflowId: 'wf-123',
        workflowName: 'Order Processing',
        totalIterations: 10,
        totalDurationMs: 6490,
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 649,
            events: [
              {
                nodeId: 'n1',
                nodeType: 'http',
                nodeLabel: 'Create Order',
                timestamp: Date.now(),
                state: 'pass',
                durationMs: 245,
              },
            ],
            finalVariables: { orderId: 'ORD-1' },
            traversedEdges: ['e1'],
          },
          {
            index: 1,
            passed: true,
            durationMs: 712,
            events: [
              {
                nodeId: 'n1',
                nodeType: 'http',
                nodeLabel: 'Create Order',
                timestamp: Date.now() + 700,
                state: 'pass',
                durationMs: 256,
              },
            ],
            finalVariables: { orderId: 'ORD-2' },
            traversedEdges: ['e1'],
          },
        ],
        traversedEdges: ['e1'],
        workflowSnapshot: {
          nodes: [
            { id: 'n1', type: 'http', data: { label: 'Create Order' } },
          ],
          edges: [
            { id: 'e1', source: 'n1', target: 'n2' },
          ],
        },
      };

      expect(trace.workflowId).toBe('wf-123');
      expect(trace.totalIterations).toBe(10);
      expect(trace.iterations).toHaveLength(2);
      expect(trace.traversedEdges).toEqual(['e1']);
      expect(trace.workflowSnapshot.nodes).toHaveLength(1);
    });

    it('serializes and deserializes correctly', () => {
      const original: WorkflowExecutionTrace = {
        workflowId: 'wf-456',
        workflowName: 'Test Flow',
        totalIterations: 5,
        totalDurationMs: 2500,
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 500,
            events: [
              {
                nodeId: 'n1',
                nodeType: 'http',
                nodeLabel: 'Step 1',
                timestamp: 1000,
                state: 'pass',
                durationMs: 100,
                details: {
                  statusCode: 200,
                  inputVariables: { foo: 'bar' },
                  extractedVariables: { baz: 'qux' },
                },
              },
            ],
            finalVariables: { foo: 'bar', baz: 'qux' },
            traversedEdges: ['e1'],
          },
        ],
        traversedEdges: ['e1'],
        workflowSnapshot: {
          nodes: [],
          edges: [],
        },
      };

      // Serialize
      const json = JSON.stringify(original);
      
      // Deserialize
      const parsed: WorkflowExecutionTrace = JSON.parse(json);
      
      // Verify
      expect(parsed.workflowId).toBe(original.workflowId);
      expect(parsed.iterations[0].events[0].nodeId).toBe('n1');
      expect(parsed.iterations[0].events[0].details?.inputVariables?.foo).toBe('bar');
      expect(parsed.iterations[0].finalVariables).toEqual({ foo: 'bar', baz: 'qux' });
    });

    it('handles empty iterations array', () => {
      const trace: WorkflowExecutionTrace = {
        workflowId: 'wf-789',
        workflowName: 'Empty Flow',
        totalIterations: 0,
        totalDurationMs: 0,
        iterations: [],
        traversedEdges: [],
        workflowSnapshot: {
          nodes: [],
          edges: [],
        },
      };

      expect(trace.iterations).toHaveLength(0);
      expect(trace.totalIterations).toBe(0);
    });

    it('handles large number of iterations', () => {
      const iterations: WorkflowIterationTrace[] = Array.from({ length: 100 }, (_, i) => ({
        index: i,
        passed: i % 10 !== 3,  // Fail every 10th iteration
        durationMs: 500 + Math.random() * 200,
        events: [
          {
            nodeId: 'n1',
            nodeType: 'http',
            nodeLabel: 'Step 1',
            timestamp: Date.now() + i * 1000,
            state: i % 10 !== 3 ? 'pass' : 'fail',
            durationMs: 100,
          },
        ],
        finalVariables: {},
        traversedEdges: ['e1'],
      }));

      const trace: WorkflowExecutionTrace = {
        workflowId: 'wf-large',
        workflowName: 'Large Run',
        totalIterations: 100,
        totalDurationMs: 50000,
        iterations,
        traversedEdges: ['e1'],
        workflowSnapshot: {
          nodes: [],
          edges: [],
        },
      };

      expect(trace.iterations).toHaveLength(100);
      expect(trace.iterations.filter(i => !i.passed)).toHaveLength(10);
    });
  });

  describe('ExecutionEventDetails', () => {
    it('creates HTTP node details', () => {
      const details: ExecutionEventDetails = {
        statusCode: 201,
        responseTimeMs: 245,
        requestResultId: 'req-abc',
        method: 'POST',
        url: 'https://api.example.com/orders',
        inputVariables: { baseUrl: 'https://api.example.com', userId: 'user-123' },
        extractedVariables: { orderId: 'ORD-789', status: 'pending' },
      };

      expect(details.statusCode).toBe(201);
      expect(details.method).toBe('POST');
      expect(Object.keys(details.inputVariables!)).toHaveLength(2);
      expect(Object.keys(details.extractedVariables!)).toHaveLength(2);
    });

    it('creates condition node details', () => {
      const details: ExecutionEventDetails = {
        conditionResult: false,
        conditionExpression: '{{count}} > 10',
        inputVariables: { count: '5' },
      };

      expect(details.conditionResult).toBe(false);
      expect(details.conditionExpression).toBe('{{count}} > 10');
    });

    it('creates loop node details', () => {
      const details: ExecutionEventDetails = {
        loopIterationCount: 5,
        currentLoopIndex: 2,
      };

      expect(details.loopIterationCount).toBe(5);
      expect(details.currentLoopIndex).toBe(2);
    });

    it('creates script node details', () => {
      const details: ExecutionEventDetails = {
        scriptOutput: { total: 150, tax: 15, grandTotal: 165 },
      };

      expect(details.scriptOutput).toEqual({ total: 150, tax: 15, grandTotal: 165 });
    });

    it('creates sub-workflow node details', () => {
      const details: ExecutionEventDetails = {
        subWorkflowId: 'sub-wf-456',
        subWorkflowPassed: true,
      };

      expect(details.subWorkflowId).toBe('sub-wf-456');
      expect(details.subWorkflowPassed).toBe(true);
    });

    it('creates error details', () => {
      const details: ExecutionEventDetails = {
        error: 'Request timeout after 5000ms',
        errorStack: 'at fetch (httpClient.ts:123)\nat executeRequest (executor.ts:456)',
        statusCode: 0,
      };

      expect(details.error).toBe('Request timeout after 5000ms');
      expect(details.errorStack).toContain('httpClient.ts:123');
    });
  });
});
