import { v4 as uuidv4 } from 'uuid';
import type { Node, Edge } from '@xyflow/react';
import type { Scenario } from '../../../shared/types';
import type {
  WorkflowNode,
  WorkflowNodeType,
  WorkflowNodeData,
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
} from '../types/workflow';
import type {
  GrpcLoadTestNodeData,
  GrpcMockAssertNodeData,
  GrpcSchemaDiffNodeData,
} from '../types/workflow/node-grpc-advanced';
import { isHttpWorkflowNode } from './workflowVariableHints';
import HttpStepNode from '../components/nodes/HttpStepNode';
import ConditionNode from '../components/nodes/ConditionNode';
import DelayNode from '../components/nodes/DelayNode';
import StartNode from '../components/nodes/StartNode';
import ForkNode from '../components/nodes/ForkNode';
import JoinNode from '../components/nodes/JoinNode';
import EndNode from '../components/nodes/EndNode';
import WebhookTriggerNode from '../components/nodes/WebhookTriggerNode';
import ScheduleTriggerNode from '../components/nodes/ScheduleTriggerNode';
import SwitchNode from '../components/nodes/SwitchNode';
import LoopNode from '../components/nodes/LoopNode';
import SetVariableNode from '../components/nodes/SetVariableNode';
import AggregateNode from '../components/nodes/AggregateNode';
import ErrorHandlerNode from '../components/nodes/ErrorHandlerNode';
import LogDebugNode from '../components/nodes/LogDebugNode';
import WaitForConditionNode from '../components/nodes/WaitForConditionNode';
import SubWorkflowNode from '../components/nodes/SubWorkflowNode';
import ScriptNode from '../components/nodes/ScriptNode';
import CorrelationWaitNode from '../components/nodes/CorrelationWaitNode';
import KafkaProduceNode from '../components/nodes/KafkaProduceNode';
import KafkaConsumeNode from '../components/nodes/KafkaConsumeNode';
import KafkaTriggerNode from '../components/nodes/KafkaTriggerNode';
import KafkaWaitNode from '../components/nodes/KafkaWaitNode';
import WsConnectNode from '../components/nodes/WsConnectNode';
import WsSendNode from '../components/nodes/WsSendNode';
import WsReceiveNode from '../components/nodes/WsReceiveNode';
import WsTriggerNode from '../components/nodes/WsTriggerNode';
import GraphqlQueryNode from '../components/nodes/GraphqlQueryNode';
import GraphqlMutationNode from '../components/nodes/GraphqlMutationNode';
import GraphqlSubscriptionNode from '../components/nodes/GraphqlSubscriptionNode';
import GraphqlIntrospectNode from '../components/nodes/GraphqlIntrospectNode';
import GraphqlAssertNode from '../components/nodes/GraphqlAssertNode';
import GrpcUnaryNode from '../components/nodes/GrpcUnaryNode';
import GrpcServerStreamNode from '../components/nodes/GrpcServerStreamNode';
import GrpcAssertNode from '../components/nodes/GrpcAssertNode';
import ApiMockWorkflowNode from '../components/nodes/ApiMockWorkflowNode';
import {
  defaultApiMockApplyNodeData,
  defaultApiMockAssertCallsNodeData,
  defaultApiMockResetStateNodeData,
  defaultApiMockStartNodeData,
  defaultApiMockStopNodeData,
} from '../types/workflow/node-api-mock';

export type WorkflowRFNode = Node<WorkflowNodeData, WorkflowNodeType>;
export type WorkflowRFEdge = Edge;

export const nodeTypes = {
  http: HttpStepNode,
  condition: ConditionNode,
  delay: DelayNode,
  start: StartNode,
  fork: ForkNode,
  join: JoinNode,
  end: EndNode,
  webhook: WebhookTriggerNode,
  schedule: ScheduleTriggerNode,
  switch: SwitchNode,
  loop: LoopNode,
  setVariable: SetVariableNode,
  aggregate: AggregateNode,
  errorHandler: ErrorHandlerNode,
  logDebug: LogDebugNode,
  waitForCondition: WaitForConditionNode,
  subWorkflow: SubWorkflowNode,
  script: ScriptNode,
  correlationWait: CorrelationWaitNode,
  kafkaProduce: KafkaProduceNode,
  kafkaConsume: KafkaConsumeNode,
  kafkaTrigger: KafkaTriggerNode,
  kafkaWait: KafkaWaitNode,
  wsConnect: WsConnectNode,
  wsSend: WsSendNode,
  wsReceive: WsReceiveNode,
  wsTrigger: WsTriggerNode,
  graphqlQuery: GraphqlQueryNode,
  graphqlMutation: GraphqlMutationNode,
  graphqlSubscription: GraphqlSubscriptionNode,
  graphqlIntrospect: GraphqlIntrospectNode,
  graphqlAssert: GraphqlAssertNode,
  grpcUnary: GrpcUnaryNode,
  grpcServerStream: GrpcServerStreamNode,
  grpcAssert: GrpcAssertNode,
  apiMockStart: ApiMockWorkflowNode,
  apiMockApply: ApiMockWorkflowNode,
  apiMockResetState: ApiMockWorkflowNode,
  apiMockStop: ApiMockWorkflowNode,
  apiMockAssertCalls: ApiMockWorkflowNode,
};

export function makeEmptyScenario(): Scenario {
  return {
    id: uuidv4(), name: 'New Request', url: '', method: 'GET',
    headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
  };
}

/** Enrich a React Flow node with state-managed initialVariables. */
export function enrichNodeData(
  n: WorkflowRFNode,
  nodeInitialVars: Record<string, Record<string, string>>,
): WorkflowNode {
  let data = n.data;
  if (isHttpWorkflowNode(n)) {
    const iv = nodeInitialVars[n.id];
    data = { ...data, initialVariables: iv ?? {} };
  }
  return { id: n.id, type: n.type, position: n.position, data } as WorkflowNode;
}

export function defaultNodeData(type: WorkflowNodeType): WorkflowNodeData {
  switch (type) {
    case 'http': return { label: 'HTTP Request', scenario: makeEmptyScenario(), initialVariables: {} } as HttpNodeData;
    case 'condition': return { label: 'If/Else', left: '{{status}}', operator: '==', right: '200' } as ConditionNodeData;
    case 'delay': return { label: 'Delay', delayMs: 1000, mode: 'fixed' } as DelayNodeData;
    case 'start': return { label: 'Start', inputVariables: {} } as StartNodeData;
    case 'fork': return { label: 'Parallel Fork' } as ForkNodeData;
    case 'join': return { label: 'Join' } as JoinNodeData;
    case 'end': return { label: 'End' } as EndNodeData;
    case 'webhook': return {
      label: 'Webhook Trigger',
      method: 'POST',
      path: '/api/webhook',
      samplePayload: '{\n  "event": "example",\n  "data": {}\n}',
      extractVariables: []
    } as WebhookTriggerNodeData;
    case 'schedule': return {
      label: 'Schedule Trigger',
      cronExpression: '0 9 * * MON-FRI',
      timezone: 'America/New_York',
      scheduleDescription: 'Every weekday at 9:00 AM EST',
      inputVariables: {}
    } as ScheduleTriggerNodeData;
    case 'switch': return {
      label: 'Switch',
      expression: '{{status}}',
      cases: [],
    } as SwitchNodeData;
    case 'loop': return {
      label: 'Loop',
      mode: 'count',
      count: 3,
      indexVariable: 'i',
      maxIterations: 100,
    } as LoopNodeData;
    case 'setVariable': return {
      label: 'Set Variable',
      assignments: [],
    } as SetVariableNodeData;
    case 'aggregate': return {
      label: 'Aggregate',
      mappings: [],
    } as AggregateNodeData;
    case 'errorHandler': return {
      label: 'Error Handler',
      errorFilter: 'all',
      retryCount: 2,
      retryDelayMs: 1000,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: true,
    } as ErrorHandlerNodeData;
    case 'logDebug': return {
      label: 'Log',
      message: '',
      logLevel: 'info',
      snapshotVariables: false,
    } as LogDebugNodeData;
    case 'waitForCondition': return {
      label: 'Wait for Condition',
      conditionExpression: '',
      pollIntervalMs: 2000,
      timeoutMs: 30000,
      maxAttempts: 0,
    } as WaitForConditionNodeData;
    case 'subWorkflow': return {
      label: 'Sub-Workflow',
      workflowId: '',
      inputMappings: [],
      outputMappings: [],
    } as SubWorkflowNodeData;
    case 'script': return {
      label: 'Script',
      code: '// Access input variables via input.varName\n// Set output variables via output.varName\n\noutput.result = input.value;\n',
      mode: 'transform',
      inputVariables: [],
      outputVariables: [],
      timeoutMs: 5000,
      captureConsole: true,
    } as ScriptNodeData;
    case 'correlationWait': return {
      label: 'Correlation Wait',
      correlationIdExpression: '',
      webhookPath: '/webhooks/callback',
      correlationSource: 'body',
      correlationJsonPath: '$.correlationId',
      extractVariables: [],
      timeoutMs: 60000,
    } as CorrelationWaitNodeData;
    case 'kafkaProduce': return defaultKafkaProduceNodeData();
    case 'kafkaConsume': return defaultKafkaConsumeNodeData();
    case 'kafkaTrigger': return defaultKafkaTriggerNodeData();
    case 'kafkaWait':    return defaultKafkaWaitNodeData();
    case 'wsConnect':    return defaultWsConnectNodeData();
    case 'wsSend':       return defaultWsSendNodeData();
    case 'wsReceive':    return defaultWsReceiveNodeData();
    case 'wsTrigger':    return defaultWsTriggerNodeData();
    case 'graphqlQuery':        return defaultGraphqlQueryNodeData();
    case 'graphqlMutation':     return defaultGraphqlMutationNodeData();
    case 'graphqlSubscription': return defaultGraphqlSubscriptionNodeData();
    case 'graphqlIntrospect':   return defaultGraphqlIntrospectNodeData();
    case 'graphqlAssert':       return defaultGraphqlAssertNodeData();
    case 'grpcUnary':           return defaultGrpcUnaryNodeData();
    case 'grpcServerStream':    return defaultGrpcServerStreamNodeData();
    case 'grpcAssert':          return defaultGrpcAssertNodeData();
    case 'grpcLoadTest':        return defaultGrpcLoadTestNodeData();
    case 'grpcSchemaDiff':      return defaultGrpcSchemaDiffNodeData();
    case 'grpcMockAssert':      return defaultGrpcMockAssertNodeData();
    case 'apiMockStart':        return defaultApiMockStartNodeData();
    case 'apiMockApply':        return defaultApiMockApplyNodeData();
    case 'apiMockResetState':   return defaultApiMockResetStateNodeData();
    case 'apiMockStop':         return defaultApiMockStopNodeData();
    case 'apiMockAssertCalls':  return defaultApiMockAssertCallsNodeData();
    default:                    return { label: type } as WorkflowNodeData;
  }
}

export function defaultKafkaProduceNodeData(): KafkaProduceNodeData {
  return {
    label: 'Kafka Produce',
    clusterId: '',
    topic: '',
    keyTemplate: '',
    partition: undefined,
    headers: [],
    bodyTemplate: '',
    ackMode: 'all',
    timeoutMs: 10000,
    outputBindings: [],
  };
}

export function defaultKafkaConsumeNodeData(): KafkaConsumeNodeData {
  return {
    label: 'Kafka Consume',
    clusterId: '',
    topic: '',
    keyRegex: '',
    headerFilters: [],
    jsonPathFilters: [],
    timeoutMs: 30000,
    maxMessages: 1,
    startPosition: 'latest',
    loadTestBehavior: { mode: 'wait-for-real' },
    outputBindings: [],
  };
}

export function defaultKafkaTriggerNodeData(): KafkaTriggerNodeData {
  return {
    label: 'Kafka Trigger',
    clusterId: '',
    topic: '',
    startPosition: 'latest',
    headerFilters: [],
    jsonPathFilters: [],
    maxConcurrentRuns: 10,
    extractVariables: [],
  };
}

export function defaultKafkaWaitNodeData(): KafkaWaitNodeData {
  return {
    label: 'Kafka Wait',
    clusterId: '',
    topic: '',
    correlationIdExpression: '',
    correlationSource: 'body',
    correlationJsonPath: '$.correlationId',
    extractVariables: [],
    timeoutMs: 60000,
    headerFilters: [],
    loadTestBehavior: { mode: 'wait-for-real' },
  };
}

// ── WebSocket Node Defaults ──────────────────────────────────────────

export function defaultWsConnectNodeData(): WsConnectNodeData {
  return {
    label: 'WS Connect',
    url: '',
    headers: [],
    queryParams: [],
    subprotocols: [],
    connectionId: 'ws1',
    timeoutMs: 10000,
    outputBindings: [],
  };
}

export function defaultWsSendNodeData(): WsSendNodeData {
  return {
    label: 'WS Send',
    connectionId: 'ws1',
    message: '',
    messageType: 'text',
    waitForResponse: false,
    responseTimeoutMs: 5000,
    outputBindings: [],
  };
}

export function defaultWsReceiveNodeData(): WsReceiveNodeData {
  return {
    label: 'WS Receive',
    connectionId: 'ws1',
    timeoutMs: 30000,
    matchCriteria: { messageType: 'any' },
    extractionRules: [],
    outputBindings: [],
  };
}

export function defaultWsTriggerNodeData(): WsTriggerNodeData {
  return {
    label: 'WS Trigger',
    url: '',
    connectionId: 'ws1',
    matchCriteria: { messageType: 'any' },
    extractionRules: [],
  };
}

// ── GraphQL Node Defaults ────────────────────────────────────────────────────

export function defaultGraphqlQueryNodeData(): GraphqlQueryNodeData {
  return {
    label: 'GraphQL Query',
    endpoint: '',
    query: 'query {\n  \n}',
    variables: '{}',
    headers: [],
    timeoutMs: 30000,
    extractionRules: [],
    outputBindings: [],
  };
}

export function defaultGraphqlMutationNodeData(): GraphqlQueryNodeData {
  return {
    label: 'GraphQL Mutation',
    endpoint: '',
    query: 'mutation {\n  \n}',
    variables: '{}',
    headers: [],
    timeoutMs: 30000,
    extractionRules: [],
    outputBindings: [],
  };
}

export function defaultGraphqlSubscriptionNodeData(): GraphqlSubscriptionNodeData {
  return {
    label: 'GraphQL Subscription',
    endpoint: '',
    subscriptionQuery: 'subscription {\n  \n}',
    variables: '{}',
    headers: [],
    subscriptionTransport: 'auto',
    stopAfterMessages: 10,
    extractionRules: [],
    outputBindings: [],
  };
}

export function defaultGraphqlIntrospectNodeData(): GraphqlIntrospectNodeData {
  return {
    label: 'GraphQL Introspect',
    endpoint: '',
    headers: [],
    timeoutMs: 30000,
    outputBindings: [],
  };
}

export function defaultGraphqlAssertNodeData(): GraphqlAssertNodeData {
  return {
    label: 'GraphQL Assert',
    sourceVariable: '',
    assertions: [],
    failBehavior: 'error',
  };
}

export function defaultGrpcUnaryNodeData(): GrpcUnaryNodeData {
  return {
    label: 'gRPC Unary',
    target: '',
    descriptorKey: '',
    service: '',
    method: '',
    callType: 'unary',
    body: {},
    timeoutMs: 30_000,
    onError: 'fail',
  };
}

export function defaultGrpcServerStreamNodeData(): GrpcServerStreamNodeData {
  return {
    label: 'gRPC Server Stream',
    target: '',
    descriptorKey: '',
    service: '',
    method: '',
    callType: 'server_streaming',
    body: {},
    collect: { maxMessages: 10 },
    timeoutMs: 30_000,
    onError: 'fail',
  };
}

export function defaultGrpcAssertNodeData(): GrpcAssertNodeData {
  return {
    label: 'gRPC Assert',
    source: '',
    assertions: [],
    onError: 'fail',
  };
}

export function defaultGrpcLoadTestNodeData(): GrpcLoadTestNodeData {
  return {
    ...defaultGrpcUnaryNodeData(),
    label: 'gRPC Load Test',
    loadTest: { concurrency: 1, totalCalls: 10, warmupCalls: 0 },
  };
}

export function defaultGrpcSchemaDiffNodeData(): GrpcSchemaDiffNodeData {
  return {
    label: 'gRPC Schema Diff',
    leftDescriptorKey: '',
    rightDescriptorKey: '',
    failOnBreaking: true,
    onError: 'fail',
  };
}

export function defaultGrpcMockAssertNodeData(): GrpcMockAssertNodeData {
  return {
    label: 'gRPC Mock Assert',
    listenTarget: '127.0.0.1:50061',
    descriptorKey: '',
    service: '',
    method: '',
    body: {},
    expectedStatus: 0,
    onError: 'fail',
  };
}
