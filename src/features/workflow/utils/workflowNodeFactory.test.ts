import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  nodeTypes,
  makeEmptyScenario,
  enrichNodeData,
  defaultNodeData,
  type WorkflowRFNode,
} from './workflowNodeFactory';
import type {
  HttpNodeData,
  ConditionNodeData,
  DelayNodeData,
  StartNodeData,
  ForkNodeData,
  JoinNodeData,
  EndNodeData,
  WebhookTriggerNodeData,
  ScheduleTriggerNodeData,
  SwitchNodeData,
  LoopNodeData,
  SetVariableNodeData,
  AggregateNodeData,
  ErrorHandlerNodeData,
  LogDebugNodeData,
  WaitForConditionNodeData,
  SubWorkflowNodeData,
  ScriptNodeData,
  CorrelationWaitNodeData,
} from '../types/workflow';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

describe('workflowNodeFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('nodeTypes', () => {
    it('exports all expected node type components', () => {
      expect(nodeTypes.http).toBeDefined();
      expect(nodeTypes.condition).toBeDefined();
      expect(nodeTypes.delay).toBeDefined();
      expect(nodeTypes.start).toBeDefined();
      expect(nodeTypes.fork).toBeDefined();
      expect(nodeTypes.join).toBeDefined();
      expect(nodeTypes.end).toBeDefined();
      expect(nodeTypes.webhook).toBeDefined();
      expect(nodeTypes.schedule).toBeDefined();
      expect(nodeTypes.switch).toBeDefined();
      expect(nodeTypes.loop).toBeDefined();
      expect(nodeTypes.setVariable).toBeDefined();
      expect(nodeTypes.aggregate).toBeDefined();
      expect(nodeTypes.errorHandler).toBeDefined();
      expect(nodeTypes.logDebug).toBeDefined();
      expect(nodeTypes.waitForCondition).toBeDefined();
      expect(nodeTypes.subWorkflow).toBeDefined();
      expect(nodeTypes.script).toBeDefined();
      expect(nodeTypes.correlationWait).toBeDefined();
    });
  });

  describe('makeEmptyScenario', () => {
    it('creates an empty scenario with default values', () => {
      const scenario = makeEmptyScenario();

      expect(scenario.id).toBe('test-uuid');
      expect(scenario.name).toBe('New Request');
      expect(scenario.url).toBe('');
      expect(scenario.method).toBe('GET');
      expect(scenario.headers).toEqual([]);
      expect(scenario.body).toBe('');
      expect(scenario.auth).toEqual({ type: 'none' });
      expect(scenario.validation).toEqual({ mode: 'none' });
    });
  });

  describe('enrichNodeData', () => {
    it('adds initialVariables to HTTP node data', () => {
      const node: WorkflowRFNode = {
        id: 'http-1',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'HTTP Request',
          scenario: makeEmptyScenario(),
          initialVariables: {},
        } as HttpNodeData,
      };
      const nodeInitialVars = {
        'http-1': { baseUrl: 'https://api.example.com', token: 'abc123' },
      };

      const enriched = enrichNodeData(node, nodeInitialVars);

      expect((enriched.data as HttpNodeData).initialVariables).toEqual({
        baseUrl: 'https://api.example.com',
        token: 'abc123',
      });
    });

    it('uses empty object when no initial variables for HTTP node', () => {
      const node: WorkflowRFNode = {
        id: 'http-2',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'HTTP Request',
          scenario: makeEmptyScenario(),
          initialVariables: { existing: 'value' },
        } as HttpNodeData,
      };

      const enriched = enrichNodeData(node, {});

      expect((enriched.data as HttpNodeData).initialVariables).toEqual({});
    });

    it('preserves non-HTTP node data unchanged', () => {
      const node: WorkflowRFNode = {
        id: 'delay-1',
        type: 'delay',
        position: { x: 100, y: 200 },
        data: {
          label: 'Delay',
          delayMs: 5000,
          mode: 'fixed',
        } as DelayNodeData,
      };

      const enriched = enrichNodeData(node, { 'delay-1': { foo: 'bar' } });

      expect(enriched.data).toEqual({
        label: 'Delay',
        delayMs: 5000,
        mode: 'fixed',
      });
    });

    it('preserves node id, type, and position', () => {
      const node: WorkflowRFNode = {
        id: 'start-1',
        type: 'start',
        position: { x: 50, y: 100 },
        data: { label: 'Start', inputVariables: {} } as StartNodeData,
      };

      const enriched = enrichNodeData(node, {});

      expect(enriched.id).toBe('start-1');
      expect(enriched.type).toBe('start');
      expect(enriched.position).toEqual({ x: 50, y: 100 });
    });
  });

  describe('defaultNodeData', () => {
    it('returns default HTTP node data', () => {
      const data = defaultNodeData('http') as HttpNodeData;

      expect(data.label).toBe('HTTP Request');
      expect(data.scenario).toBeDefined();
      expect(data.scenario.method).toBe('GET');
      expect(data.initialVariables).toEqual({});
    });

    it('returns default condition node data', () => {
      const data = defaultNodeData('condition') as ConditionNodeData;

      expect(data.label).toBe('If/Else');
      expect(data.left).toBe('{{status}}');
      expect(data.operator).toBe('==');
      expect(data.right).toBe('200');
    });

    it('returns default delay node data', () => {
      const data = defaultNodeData('delay') as DelayNodeData;

      expect(data.label).toBe('Delay');
      expect(data.delayMs).toBe(1000);
      expect(data.mode).toBe('fixed');
    });

    it('returns default start node data', () => {
      const data = defaultNodeData('start') as StartNodeData;

      expect(data.label).toBe('Start');
      expect(data.inputVariables).toEqual({});
    });

    it('returns default fork node data', () => {
      const data = defaultNodeData('fork') as ForkNodeData;

      expect(data.label).toBe('Parallel Fork');
    });

    it('returns default join node data', () => {
      const data = defaultNodeData('join') as JoinNodeData;

      expect(data.label).toBe('Join');
    });

    it('returns default end node data', () => {
      const data = defaultNodeData('end') as EndNodeData;

      expect(data.label).toBe('End');
    });

    it('returns default webhook node data', () => {
      const data = defaultNodeData('webhook') as WebhookTriggerNodeData;

      expect(data.label).toBe('Webhook Trigger');
      expect(data.method).toBe('POST');
      expect(data.path).toBe('/api/webhook');
      expect(data.samplePayload).toContain('event');
      expect(data.extractVariables).toEqual([]);
    });

    it('returns default schedule node data', () => {
      const data = defaultNodeData('schedule') as ScheduleTriggerNodeData;

      expect(data.label).toBe('Schedule Trigger');
      expect(data.cronExpression).toBe('0 9 * * MON-FRI');
      expect(data.timezone).toBe('America/New_York');
      expect(data.scheduleDescription).toContain('9:00 AM');
      expect(data.inputVariables).toEqual({});
    });

    it('returns default switch node data', () => {
      const data = defaultNodeData('switch') as SwitchNodeData;

      expect(data.label).toBe('Switch');
      expect(data.expression).toBe('{{status}}');
      expect(data.cases).toEqual([]);
    });

    it('returns default loop node data', () => {
      const data = defaultNodeData('loop') as LoopNodeData;

      expect(data.label).toBe('Loop');
      expect(data.mode).toBe('count');
      expect(data.count).toBe(3);
      expect(data.indexVariable).toBe('i');
      expect(data.maxIterations).toBe(100);
    });

    it('returns default setVariable node data', () => {
      const data = defaultNodeData('setVariable') as SetVariableNodeData;

      expect(data.label).toBe('Set Variable');
      expect(data.assignments).toEqual([]);
    });

    it('returns default aggregate node data', () => {
      const data = defaultNodeData('aggregate') as AggregateNodeData;

      expect(data.label).toBe('Aggregate');
      expect(data.mappings).toEqual([]);
    });

    it('returns default errorHandler node data', () => {
      const data = defaultNodeData('errorHandler') as ErrorHandlerNodeData;

      expect(data.label).toBe('Error Handler');
      expect(data.errorFilter).toBe('all');
      expect(data.retryCount).toBe(2);
      expect(data.retryDelayMs).toBe(1000);
      expect(data.retryBackoff).toBe('fixed');
      expect(data.retryTimeoutMs).toBe(0);
      expect(data.continueOnError).toBe(true);
    });

    it('returns default logDebug node data', () => {
      const data = defaultNodeData('logDebug') as LogDebugNodeData;

      expect(data.label).toBe('Log');
      expect(data.message).toBe('');
      expect(data.logLevel).toBe('info');
      expect(data.snapshotVariables).toBe(false);
    });

    it('returns default waitForCondition node data', () => {
      const data = defaultNodeData('waitForCondition') as WaitForConditionNodeData;

      expect(data.label).toBe('Wait for Condition');
      expect(data.conditionExpression).toBe('');
      expect(data.pollIntervalMs).toBe(2000);
      expect(data.timeoutMs).toBe(30000);
      expect(data.maxAttempts).toBe(0);
    });

    it('returns default subWorkflow node data', () => {
      const data = defaultNodeData('subWorkflow') as SubWorkflowNodeData;

      expect(data.label).toBe('Sub-Workflow');
      expect(data.workflowId).toBe('');
      expect(data.inputMappings).toEqual([]);
      expect(data.outputMappings).toEqual([]);
    });

    it('returns default script node data', () => {
      const data = defaultNodeData('script') as ScriptNodeData;

      expect(data.label).toBe('Script');
      expect(data.code).toContain('output.result');
      expect(data.mode).toBe('transform');
      expect(data.inputVariables).toEqual([]);
      expect(data.outputVariables).toEqual([]);
      expect(data.timeoutMs).toBe(5000);
      expect(data.captureConsole).toBe(true);
    });

    it('returns default correlationWait node data', () => {
      const data = defaultNodeData('correlationWait') as CorrelationWaitNodeData;

      expect(data.label).toBe('Correlation Wait');
      expect(data.correlationIdExpression).toBe('');
      expect(data.webhookPath).toBe('/webhooks/callback');
      expect(data.correlationSource).toBe('body');
      expect(data.correlationJsonPath).toBe('$.correlationId');
      expect(data.extractVariables).toEqual([]);
      expect(data.timeoutMs).toBe(60000);
    });
  });
});
