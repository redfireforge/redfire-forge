import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEdge, WorkflowNode } from '../types/workflow';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { runGraph } from './graphRunner';
import { httpFetch } from '../../../shared/utils/httpClient';
import { endNode, startNode } from './graphRunnerNodeHandlers.test-utils';

const mockFetch = vi.mocked(httpFetch);

function _conditionNode(id: string, left: string, operator: string, right: string): WorkflowNode {
  return {
    id,
    type: 'condition',
    position: { x: 0, y: 0 },
    data: { label: 'Condition', left, operator, right },
  };
}

function _forkNode(id: string): WorkflowNode {
  return {
    id,
    type: 'fork',
    position: { x: 0, y: 0 },
    data: { label: 'Fork' },
  };
}

function _joinNode(id: string): WorkflowNode {
  return {
    id,
    type: 'join',
    position: { x: 0, y: 0 },
    data: { label: 'Join' },
  };
}

describe('graphRunner - Additional Coverage', () => {

  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
  });

  describe('Scenario Template Replacement', () => {
    it('handles scenarios with bodyForm containing template variables', async () => {
      const nodes = [
        {
          id: 'h1',
          type: 'http' as const,
          position: { x: 0, y: 0 },
          data: {
            label: 'Form Post',
            scenario: {
              id: 'h1',
              name: 'Form Post',
              url: 'https://example.com/form',
              method: 'POST',
              headers: [],
              body: '',
              bodyForm: [
                { key: 'field1', value: '{{var1}}' },
                { key: '{{fieldName}}', value: 'value2' }
              ],
              auth: { type: 'none' as const },
              validation: { mode: 'none' as const },
            },
          },
        },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, [], { var1: 'formValue1', fieldName: 'dynamicField' }, cb);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles scenarios with auth fields containing template variables', async () => {
      const nodes = [
        {
          id: 'h1',
          type: 'http' as const,
          position: { x: 0, y: 0 },
          data: {
            label: 'Auth Request',
            scenario: {
              id: 'h1',
              name: 'Auth Request',
              url: 'https://example.com/api',
              method: 'GET',
              headers: [],
              body: '',
              auth: { 
                type: 'bearer' as const,
                token: '{{authToken}}'
              },
              validation: { mode: 'none' as const },
            },
          },
        },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, [], { authToken: 'secret-token-123' }, cb);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles scenarios with apikey auth containing template variables', async () => {
      const nodes = [
        {
          id: 'h1',
          type: 'http' as const,
          position: { x: 0, y: 0 },
          data: {
            label: 'API Key Request',
            scenario: {
              id: 'h1',
              name: 'API Key Request',
              url: 'https://example.com/api',
              method: 'GET',
              headers: [],
              body: '',
              auth: { 
                type: 'apikey' as const,
                apiKeyValue: '{{apiKey}}'
              },
              validation: { mode: 'none' as const },
            },
          },
        },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, [], { apiKey: 'my-api-key-456' }, cb);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles scenarios with basic auth containing template variables', async () => {
      const nodes = [
        {
          id: 'h1',
          type: 'http' as const,
          position: { x: 0, y: 0 },
          data: {
            label: 'Basic Auth',
            scenario: {
              id: 'h1',
              name: 'Basic Auth',
              url: 'https://example.com/api',
              method: 'GET',
              headers: [],
              body: '',
              auth: { 
                type: 'basic' as const,
                username: '{{user}}',
                password: '{{pass}}'
              },
              validation: { mode: 'none' as const },
            },
          },
        },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, [], { user: 'admin', pass: 'secret' }, cb);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('script node integration', () => {
    it('executes script node in workflow', async () => {
      const nodes: WorkflowNode[] = [
        startNode('s1'),
        {
          id: 'script1',
          type: 'script',
          position: { x: 0, y: 0 },
          data: {
            label: 'Transform Data',
            mode: 'ctx',
            // Script API: input.varName for reads, output.varName = value for writes
            code: 'output.result = parseInt(input.x || "0", 10) * 2;',
            inputVariables: ['x'], // Must be an array
            outputVariables: ['result'],
            captureConsole: false,
          },
        },
        endNode('e1'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'script1' },
        { id: 'e2', source: 'script1', target: 'e1' },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, { x: '5' }, cb);

      // Verify script node was executed - check that it transitioned to 'pass' at some point
      const scriptCalls = cb.onNodeStateChange.mock.calls.filter(
        ([id]: [string, unknown]) => id === 'script1'
      );
      const passedState = scriptCalls.find(
        ([, status]: [string, { state: string }]) => status.state === 'pass'
      );
      expect(passedState).toBeDefined();
      // onComplete receives (results, passed, durationMs, trace?)
      expect(cb.onComplete).toHaveBeenCalled();
      const onCompleteCall = cb.onComplete.mock.calls[0];
      expect(onCompleteCall[1]).toBe(true); // passed (second argument)
    });

    it('marks script node as fail when script throws', async () => {
      const nodes: WorkflowNode[] = [
        startNode('s1'),
        {
          id: 'script1',
          type: 'script',
          position: { x: 0, y: 0 },
          data: {
            label: 'Bad Script',
            mode: 'ctx',
            code: 'throw new Error("Script error!");', // This should fail
            inputVariables: [],
            outputVariables: [],
            captureConsole: false,
          },
        },
        endNode('e1'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'script1' },
        { id: 'e2', source: 'script1', target: 'e1' },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      expect(cb.onNodeStateChange).toHaveBeenCalledWith('script1', expect.objectContaining({ state: 'fail' }));
      // onComplete receives (results, passed, durationMs, trace?)
      expect(cb.onComplete).toHaveBeenCalled();
      const onCompleteCall = cb.onComplete.mock.calls[0];
      expect(onCompleteCall[1]).toBe(false); // passed=false (second argument)
    });
  });

  describe('correlationWait node integration', () => {
    it('executes correlationWait node with auto-resume config', async () => {
      const nodes: WorkflowNode[] = [
        startNode('s1'),
        {
          id: 'cw1',
          type: 'correlationWait',
          position: { x: 0, y: 0 },
          data: {
            label: 'Wait for Callback',
            correlationIdExpression: '{{orderId}}',
            webhookPath: '/callback',
            correlationSource: 'body',
            correlationJsonPath: '$.id',
            extractVariables: [],
            timeoutMs: 1000,
          },
        },
        endNode('e1'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'cw1' },
        { id: 'e2', source: 'cw1', target: 'e1' },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      // Mock correlation store that resolves immediately
      const mockCorrelationStore = {
        pause: vi.fn(() => Promise.resolve({ status: 'success' })),
        resume: vi.fn(() => true),
        isPaused: vi.fn(() => false),
        cancel: vi.fn(() => false),
        get: vi.fn(() => undefined),
        cleanup: vi.fn(() => 0),
        listPaused: vi.fn(() => []),
        size: 0,
      };

      // Run with auto-resume mode (skips actual waiting)
      // runGraph signature: nodes, edges, initialVariables, callbacks, abortSignal?,
      // environmentLayer?, resolveHttpBaseUrl?, resolveHttpAuth?, debugController?,
      // errorConfig?, resolveSubWorkflow?, correlationStore?, loadTestMode?, correlationWaitConfig?
      await runGraph(
        nodes,
        edges,
        { orderId: 'order-123' },
        cb,
        undefined, // abortSignal
        undefined, // environmentLayer
        undefined, // resolveHttpBaseUrl
        undefined, // resolveHttpAuth
        undefined, // debugController
        undefined, // errorConfig
        undefined, // resolveSubWorkflow
        mockCorrelationStore,
        false, // loadTestMode
        { mode: 'auto-resume' }, // correlationWaitConfig
      );

      // With auto-resume, the node should pass without waiting
      expect(cb.onNodeStateChange).toHaveBeenCalledWith('cw1', expect.objectContaining({ state: 'pass' }));
      // onComplete receives (results, passed, durationMs, trace?) - check that it was called with passed=true
      expect(cb.onComplete).toHaveBeenCalled();
      const onCompleteCall = cb.onComplete.mock.calls[0];
      expect(onCompleteCall[1]).toBe(true); // passed (second argument)
    });

    it('handles correlationWait with synthetic-inject config', async () => {
      const nodes: WorkflowNode[] = [
        startNode('s1'),
        {
          id: 'cw1',
          type: 'correlationWait',
          position: { x: 0, y: 0 },
          data: {
            label: 'Wait for Callback',
            correlationIdExpression: '{{id}}',
            webhookPath: '/callback',
            correlationSource: 'body',
            correlationJsonPath: '$.id',
            extractVariables: [
              { variableName: 'status', jsonPath: '$.status' },
            ],
            timeoutMs: 5000,
          },
        },
        endNode('e1'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'cw1' },
        { id: 'e2', source: 'cw1', target: 'e1' },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      const mockCorrelationStore = {
        pause: vi.fn(() => Promise.resolve({ id: 'test-123', status: 'completed' })),
        resume: vi.fn(() => true),
        isPaused: vi.fn(() => false),
        cancel: vi.fn(() => false),
        get: vi.fn(() => undefined),
        cleanup: vi.fn(() => 0),
        listPaused: vi.fn(() => []),
        size: 0,
      };

      await runGraph(
        nodes,
        edges,
        { id: 'test-123' },
        cb,
        undefined, // abortSignal
        undefined, // environmentLayer
        undefined, // resolveHttpBaseUrl
        undefined, // resolveHttpAuth
        undefined, // debugController
        undefined, // errorConfig
        undefined, // resolveSubWorkflow
        mockCorrelationStore,
        false, // loadTestMode
        {
          mode: 'synthetic-inject',
          syntheticPayload: JSON.stringify({ id: 'test-123', status: 'completed' }),
        },
      );

      expect(cb.onNodeStateChange).toHaveBeenCalledWith('cw1', expect.objectContaining({ state: 'pass' }));
    });
  });
});
