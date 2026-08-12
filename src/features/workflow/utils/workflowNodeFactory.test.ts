import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  nodeTypes,
  makeEmptyScenario,
  enrichNodeData,
  defaultNodeData,
  defaultKafkaTriggerNodeData,
  defaultKafkaWaitNodeData,
  defaultKafkaProduceNodeData,
  defaultKafkaConsumeNodeData,
  defaultWsConnectNodeData,
  defaultWsSendNodeData,
  defaultWsReceiveNodeData,
  defaultWsTriggerNodeData,
  defaultGraphqlQueryNodeData,
  defaultGraphqlMutationNodeData,
  defaultGraphqlSubscriptionNodeData,
  defaultGraphqlIntrospectNodeData,
  defaultGraphqlAssertNodeData,
  defaultGrpcUnaryNodeData,
  defaultGrpcServerStreamNodeData,
  defaultGrpcAssertNodeData,
  defaultGrpcLoadTestNodeData,
  defaultGrpcSchemaDiffNodeData,
  defaultGrpcMockAssertNodeData,
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
  KafkaProduceNodeData,
  KafkaConsumeNodeData,
  KafkaTriggerNodeData,
  KafkaWaitNodeData,
  WsConnectNodeData,
  WsSendNodeData,
  WsReceiveNodeData,
  WsTriggerNodeData,
  GraphqlQueryNodeData,
  GraphqlSubscriptionNodeData,
  GraphqlIntrospectNodeData,
  GraphqlAssertNodeData,
  GrpcUnaryNodeData,
  GrpcServerStreamNodeData,
  GrpcAssertNodeData,
  WorkflowNodeType,
  WorkflowNodeData,
} from '../types/workflow';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

describe('workflowNodeFactory', () => {
  beforeEach(() => {
    resetAllMocks();
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
      expect(nodeTypes.kafkaTrigger).toBeDefined();
      expect(nodeTypes.kafkaWait).toBeDefined();
      expect(nodeTypes.graphqlQuery).toBeDefined();
      expect(nodeTypes.graphqlMutation).toBeDefined();
      expect(nodeTypes.graphqlSubscription).toBeDefined();
      expect(nodeTypes.graphqlIntrospect).toBeDefined();
      expect(nodeTypes.graphqlAssert).toBeDefined();
    });
  });

  describe('Kafka node contracts', () => {
    it('includes kafkaProduce and kafkaConsume in the WorkflowNodeType union', () => {
      const produceType: WorkflowNodeType = 'kafkaProduce';
      const consumeType: WorkflowNodeType = 'kafkaConsume';

      expect(produceType).toBe('kafkaProduce');
      expect(consumeType).toBe('kafkaConsume');
    });

    it('includes Kafka node data variants in the WorkflowNodeData union', () => {
      const produceData: WorkflowNodeData = defaultNodeData('kafkaProduce');
      const consumeData: WorkflowNodeData = defaultNodeData('kafkaConsume');

      expect((produceData as KafkaProduceNodeData).label).toBe('Kafka Produce');
      expect((consumeData as KafkaConsumeNodeData).label).toBe('Kafka Consume');
    });
  });

  describe('GraphQL node contracts', () => {
    it('includes all 5 graphql types in the WorkflowNodeType union', () => {
      const q: WorkflowNodeType = 'graphqlQuery';
      const m: WorkflowNodeType = 'graphqlMutation';
      const s: WorkflowNodeType = 'graphqlSubscription';
      const i: WorkflowNodeType = 'graphqlIntrospect';
      const a: WorkflowNodeType = 'graphqlAssert';
      expect(q).toBe('graphqlQuery');
      expect(m).toBe('graphqlMutation');
      expect(s).toBe('graphqlSubscription');
      expect(i).toBe('graphqlIntrospect');
      expect(a).toBe('graphqlAssert');
    });

    it('defaultNodeData returns correct labels for all 5 graphql types', () => {
      expect((defaultNodeData('graphqlQuery') as GraphqlQueryNodeData).label).toBe('GraphQL Query');
      expect((defaultNodeData('graphqlMutation') as GraphqlQueryNodeData).label).toBe('GraphQL Mutation');
      expect((defaultNodeData('graphqlSubscription') as GraphqlSubscriptionNodeData).label).toBe('GraphQL Subscription');
      expect((defaultNodeData('graphqlIntrospect') as GraphqlIntrospectNodeData).label).toBe('GraphQL Introspect');
      expect((defaultNodeData('graphqlAssert') as GraphqlAssertNodeData).label).toBe('GraphQL Assert');
    });

    it('defaultGraphqlQueryNodeData has correct shape', () => {
      const d = defaultGraphqlQueryNodeData();
      expect(d.label).toBe('GraphQL Query');
      expect(d.query).toContain('query');
      expect(d.variables).toBe('{}');
      expect(d.timeoutMs).toBe(30000);
      expect(d.extractionRules).toEqual([]);
      expect(d.outputBindings).toEqual([]);
    });

    it('defaultGraphqlMutationNodeData has correct shape', () => {
      const d = defaultGraphqlMutationNodeData();
      expect(d.label).toBe('GraphQL Mutation');
      expect(d.query).toContain('mutation');
    });

    it('defaultGraphqlSubscriptionNodeData has correct shape', () => {
      const d = defaultGraphqlSubscriptionNodeData();
      expect(d.label).toBe('GraphQL Subscription');
      expect(d.subscriptionQuery).toContain('subscription');
      expect(d.subscriptionTransport).toBe('auto');
      expect(d.stopAfterMessages).toBe(10);
    });

    it('defaultGraphqlIntrospectNodeData has correct shape', () => {
      const d = defaultGraphqlIntrospectNodeData();
      expect(d.label).toBe('GraphQL Introspect');
      expect(d.timeoutMs).toBe(30000);
      expect(d.outputBindings).toEqual([]);
    });

    it('defaultGraphqlAssertNodeData has correct shape', () => {
      const d = defaultGraphqlAssertNodeData();
      expect(d.label).toBe('GraphQL Assert');
      expect(d.sourceVariable).toBe('');
      expect(d.assertions).toEqual([]);
      expect(d.failBehavior).toBe('error');
    });
  });

  describe('gRPC advanced defaults', () => {
    it('defaultGrpcUnaryNodeData has unary defaults', () => {
      const d = defaultGrpcUnaryNodeData();
      expect(d.label).toBe('gRPC Unary');
      expect(d.callType).toBe('unary');
      expect(d.target).toBe('');
      expect(d.timeoutMs).toBe(30000);
      expect(d.onError).toBe('fail');
    });

    it('defaultGrpcServerStreamNodeData has stream defaults', () => {
      const d = defaultGrpcServerStreamNodeData();
      expect(d.label).toBe('gRPC Server Stream');
      expect(d.callType).toBe('server_streaming');
      expect(d.collect).toEqual({ maxMessages: 10 });
      expect(d.timeoutMs).toBe(30000);
      expect(d.onError).toBe('fail');
    });

    it('defaultGrpcAssertNodeData has assert defaults', () => {
      const d = defaultGrpcAssertNodeData();
      expect(d.label).toBe('gRPC Assert');
      expect(d.source).toBe('');
      expect(d.assertions).toEqual([]);
      expect(d.onError).toBe('fail');
    });

    it('defaultGrpcLoadTestNodeData has load test defaults', () => {
      const d = defaultGrpcLoadTestNodeData();
      expect(d.label).toBe('gRPC Load Test');
      expect(d.callType).toBe('unary');
      expect(d.loadTest).toEqual({ concurrency: 1, totalCalls: 10, warmupCalls: 0 });
    });

    it('defaultGrpcSchemaDiffNodeData has schema diff defaults', () => {
      const d = defaultGrpcSchemaDiffNodeData();
      expect(d.label).toBe('gRPC Schema Diff');
      expect(d.failOnBreaking).toBe(true);
      expect(d.onError).toBe('fail');
    });

    it('defaultGrpcMockAssertNodeData has mock assert defaults', () => {
      const d = defaultGrpcMockAssertNodeData();
      expect(d.label).toBe('gRPC Mock Assert');
      expect(d.listenTarget).toBe('127.0.0.1:50061');
      expect(d.expectedStatus).toBe(0);
      expect(d.onError).toBe('fail');
    });

    it('defaultNodeData supports grpc advanced node types', () => {
      expect((defaultNodeData('grpcLoadTest') as { label: string }).label).toBe('gRPC Load Test');
      expect((defaultNodeData('grpcSchemaDiff') as { label: string }).label).toBe('gRPC Schema Diff');
      expect((defaultNodeData('grpcMockAssert') as { label: string }).label).toBe('gRPC Mock Assert');
    });

    it('defaultNodeData supports grpc base node types', () => {
      expect((defaultNodeData('grpcUnary') as GrpcUnaryNodeData).label).toBe('gRPC Unary');
      expect((defaultNodeData('grpcServerStream') as GrpcServerStreamNodeData).label).toBe('gRPC Server Stream');
      expect((defaultNodeData('grpcAssert') as GrpcAssertNodeData).label).toBe('gRPC Assert');
    });

    it('defaultNodeData supports api mock workflow node types', () => {
      expect((defaultNodeData('apiMockStart') as { label: string }).label).toBe('Start Mock Server');
      expect((defaultNodeData('apiMockApply') as { label: string }).label).toBe('Apply Definition');
      expect((defaultNodeData('apiMockResetState') as { label: string }).label).toBe('Reset Mock State');
      expect((defaultNodeData('apiMockStop') as { label: string }).label).toBe('Stop Mock Server');
      expect((defaultNodeData('apiMockAssertCalls') as { label: string }).label).toBe('Assert Mock Calls');
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

    it('returns default kafkaProduce node data', () => {
      const data = defaultNodeData('kafkaProduce') as KafkaProduceNodeData;

      expect(data.label).toBe('Kafka Produce');
      expect(data.clusterId).toBe('');
      expect(data.topic).toBe('');
      expect(data.keyTemplate).toBe('');
      expect(data.headers).toEqual([]);
      expect(data.bodyTemplate).toBe('');
      expect(data.ackMode).toBe('all');
      expect(data.timeoutMs).toBe(10000);
      expect(data.outputBindings).toEqual([]);
    });

    it('returns default kafkaConsume node data', () => {
      const data = defaultNodeData('kafkaConsume') as KafkaConsumeNodeData;

      expect(data.label).toBe('Kafka Consume');
      expect(data.clusterId).toBe('');
      expect(data.topic).toBe('');
      expect(data.keyRegex).toBe('');
      expect(data.headerFilters).toEqual([]);
      expect(data.jsonPathFilters).toEqual([]);
      expect(data.timeoutMs).toBe(30000);
      expect(data.maxMessages).toBe(1);
      expect(data.startPosition).toBe('latest');
      expect(data.loadTestBehavior).toEqual({ mode: 'wait-for-real' });
      expect(data.outputBindings).toEqual([]);
    });
  });

  describe('Phase 5A — Kafka Trigger and Wait contracts', () => {
    it('includes kafkaTrigger and kafkaWait in the WorkflowNodeType union', () => {
      const triggerType: WorkflowNodeType = 'kafkaTrigger';
      const waitType: WorkflowNodeType = 'kafkaWait';
      expect(triggerType).toBe('kafkaTrigger');
      expect(waitType).toBe('kafkaWait');
    });

    it('includes KafkaTriggerNodeData and KafkaWaitNodeData in the WorkflowNodeData union', () => {
      const triggerData: WorkflowNodeData = defaultNodeData('kafkaTrigger');
      const waitData: WorkflowNodeData = defaultNodeData('kafkaWait');
      expect((triggerData as KafkaTriggerNodeData).label).toBe('Kafka Trigger');
      expect((waitData as KafkaWaitNodeData).label).toBe('Kafka Wait');
    });

    it('defaultKafkaTriggerNodeData returns correct defaults', () => {
      const data = defaultKafkaTriggerNodeData();
      expect(data.label).toBe('Kafka Trigger');
      expect(data.clusterId).toBe('');
      expect(data.topic).toBe('');
      expect(data.startPosition).toBe('latest');
      expect(data.maxConcurrentRuns).toBe(10);
      expect(Array.isArray(data.headerFilters)).toBe(true);
      expect(Array.isArray(data.jsonPathFilters)).toBe(true);
      expect(Array.isArray(data.extractVariables)).toBe(true);
    });

    it('defaultKafkaWaitNodeData returns correct defaults', () => {
      const data = defaultKafkaWaitNodeData();
      expect(data.label).toBe('Kafka Wait');
      expect(data.clusterId).toBe('');
      expect(data.topic).toBe('');
      expect(data.correlationSource).toBe('body');
      expect(data.correlationJsonPath).toBe('$.correlationId');
      expect(data.correlationIdExpression).toBe('');
      expect(data.timeoutMs).toBe(60000);
      expect(data.loadTestBehavior).toEqual({ mode: 'wait-for-real' });
      expect(Array.isArray(data.headerFilters)).toBe(true);
      expect(Array.isArray(data.extractVariables)).toBe(true);
    });

    it('kafkaTrigger and kafkaWait have registered canvas node components', () => {
      expect(nodeTypes.kafkaTrigger).toBeDefined();
      expect(nodeTypes.kafkaWait).toBeDefined();
    });
  });

  describe('WebSocket node types', () => {
    it('registers all WS node components in nodeTypes', () => {
      expect(nodeTypes.wsConnect).toBeDefined();
      expect(nodeTypes.wsSend).toBeDefined();
      expect(nodeTypes.wsReceive).toBeDefined();
      expect(nodeTypes.wsTrigger).toBeDefined();
    });

    it('registers all Kafka node components in nodeTypes', () => {
      expect(nodeTypes.kafkaProduce).toBeDefined();
      expect(nodeTypes.kafkaConsume).toBeDefined();
    });
  });

  describe('defaultNodeData — WS nodes', () => {
    it('returns default wsConnect node data', () => {
      const data = defaultNodeData('wsConnect') as WsConnectNodeData;
      expect(data.label).toBe('WS Connect');
      expect(data.url).toBe('');
      expect(data.connectionId).toBe('ws1');
      expect(data.timeoutMs).toBe(10000);
      expect(Array.isArray(data.headers)).toBe(true);
      expect(Array.isArray(data.queryParams)).toBe(true);
      expect(Array.isArray(data.subprotocols)).toBe(true);
      expect(Array.isArray(data.outputBindings)).toBe(true);
    });

    it('returns default wsSend node data', () => {
      const data = defaultNodeData('wsSend') as WsSendNodeData;
      expect(data.label).toBe('WS Send');
      expect(data.connectionId).toBe('ws1');
      expect(data.message).toBe('');
      expect(data.messageType).toBe('text');
      expect(data.waitForResponse).toBe(false);
      expect(data.responseTimeoutMs).toBe(5000);
      expect(Array.isArray(data.outputBindings)).toBe(true);
    });

    it('returns default wsReceive node data', () => {
      const data = defaultNodeData('wsReceive') as WsReceiveNodeData;
      expect(data.label).toBe('WS Receive');
      expect(data.connectionId).toBe('ws1');
      expect(data.timeoutMs).toBe(30000);
      expect(data.matchCriteria).toEqual({ messageType: 'any' });
      expect(Array.isArray(data.extractionRules)).toBe(true);
      expect(Array.isArray(data.outputBindings)).toBe(true);
    });

    it('returns default wsTrigger node data', () => {
      const data = defaultNodeData('wsTrigger') as WsTriggerNodeData;
      expect(data.label).toBe('WS Trigger');
      expect(data.url).toBe('');
      expect(data.connectionId).toBe('ws1');
      expect(data.matchCriteria).toEqual({ messageType: 'any' });
      expect(Array.isArray(data.extractionRules)).toBe(true);
    });
  });

  describe('standalone default factory functions', () => {
    it('defaultWsConnectNodeData returns correct defaults', () => {
      const data = defaultWsConnectNodeData();
      expect(data.label).toBe('WS Connect');
      expect(data.url).toBe('');
      expect(data.connectionId).toBe('ws1');
    });

    it('defaultWsSendNodeData returns correct defaults', () => {
      const data = defaultWsSendNodeData();
      expect(data.label).toBe('WS Send');
      expect(data.messageType).toBe('text');
      expect(data.waitForResponse).toBe(false);
    });

    it('defaultWsReceiveNodeData returns correct defaults', () => {
      const data = defaultWsReceiveNodeData();
      expect(data.label).toBe('WS Receive');
      expect(data.timeoutMs).toBe(30000);
    });

    it('defaultWsTriggerNodeData returns correct defaults', () => {
      const data = defaultWsTriggerNodeData();
      expect(data.label).toBe('WS Trigger');
      expect(data.url).toBe('');
    });

    it('defaultKafkaProduceNodeData returns correct defaults', () => {
      const data = defaultKafkaProduceNodeData();
      expect(data.label).toBe('Kafka Produce');
      expect(data.clusterId).toBe('');
      expect(data.topic).toBe('');
      expect(data.ackMode).toBe('all');
      expect(data.timeoutMs).toBe(10000);
    });

    it('defaultKafkaConsumeNodeData returns correct defaults', () => {
      const data = defaultKafkaConsumeNodeData();
      expect(data.label).toBe('Kafka Consume');
      expect(data.clusterId).toBe('');
      expect(data.topic).toBe('');
      expect(data.timeoutMs).toBe(30000);
      expect(data.maxMessages).toBe(1);
      expect(data.startPosition).toBe('latest');
      expect(data.loadTestBehavior).toEqual({ mode: 'wait-for-real' });
    });
  });
});
