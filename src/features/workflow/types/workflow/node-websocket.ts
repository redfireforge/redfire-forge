// ── WebSocket Workflow Nodes ──────────────────────────────────────────

import type {
  AggregateNodeData,
  ConditionNodeData,
  CorrelationWaitNodeData,
  DelayNodeData,
  EndNodeData,
  ErrorHandlerNodeData,
  ForkNodeData,
  HttpNodeData,
  JoinNodeData,
  LogDebugNodeData,
  LoopNodeData,
  ScheduleTriggerNodeData,
  ScriptNodeData,
  SetVariableNodeData,
  StartNodeData,
  SubWorkflowNodeData,
  SwitchNodeData,
  WaitForConditionNodeData,
  WebhookTriggerNodeData,
} from './node-core';
import type {
  KafkaConsumeNodeData,
  KafkaProduceNodeData,
  KafkaTriggerNodeData,
  KafkaWaitNodeData,
} from './node-kafka';
import type {
  GraphqlAssertNodeData,
  GraphqlIntrospectNodeData,
  GraphqlQueryNodeData,
  GraphqlSubscriptionNodeData,
} from './node-graphql';
import type {
  GrpcAssertNodeData,
  GrpcServerStreamNodeData,
  GrpcUnaryNodeData,
} from './node-grpc';
import type {
  GrpcLoadTestNodeData,
  GrpcMockAssertNodeData,
  GrpcSchemaDiffNodeData,
} from './node-grpc-advanced';

export interface WsConnectOutputBinding {
  field: 'protocol' | 'extensions' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface WsConnectNodeData {
  [key: string]: unknown;
  label: string;
  url: string;
  headers: WsNodeHeaderRow[];
  queryParams: WsNodeHeaderRow[];
  subprotocols: string[];
  connectionId: string;
  timeoutMs: number;
  outputBindings: WsConnectOutputBinding[];
}

export interface WsNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface WsSendOutputBinding {
  field: 'responseBody' | 'responseType' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface WsSendNodeData {
  [key: string]: unknown;
  label: string;
  connectionId: string;
  message: string;
  messageType: 'text' | 'binary';
  waitForResponse: boolean;
  responseTimeoutMs: number;
  outputBindings: WsSendOutputBinding[];
}

export interface WsMatchCriteria {
  contentContains?: string;
  contentRegex?: string;
  jsonPathMatch?: string;
  jsonPathValue?: string;
  messageType?: 'text' | 'binary' | 'any';
}

export interface WsExtractionRule {
  variableName: string;
  jsonPath: string;
}

export interface WsReceiveOutputBinding {
  field: 'messageBody' | 'messageType' | 'matchedAt' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface WsReceiveNodeData {
  [key: string]: unknown;
  label: string;
  connectionId: string;
  timeoutMs: number;
  matchCriteria: WsMatchCriteria;
  extractionRules: WsExtractionRule[];
  outputBindings: WsReceiveOutputBinding[];
}

export interface WsTriggerNodeData {
  [key: string]: unknown;
  label: string;
  url: string;
  connectionId: string;
  matchCriteria: WsMatchCriteria;
  extractionRules: WsExtractionRule[];
  samplePayload?: string;
}

export type WorkflowNodeType = 'http' | 'condition' | 'delay' | 'start' | 'fork' | 'join' | 'end' | 'webhook' | 'schedule' | 'switch' | 'loop' | 'setVariable' | 'aggregate' | 'errorHandler' | 'logDebug' | 'waitForCondition' | 'subWorkflow' | 'script' | 'correlationWait' | 'kafkaProduce' | 'kafkaConsume' | 'kafkaTrigger' | 'kafkaWait' | 'wsConnect' | 'wsSend' | 'wsReceive' | 'wsTrigger' | 'graphqlQuery' | 'graphqlMutation' | 'graphqlSubscription' | 'graphqlIntrospect' | 'graphqlAssert' | 'grpcUnary' | 'grpcServerStream' | 'grpcAssert' | 'grpcLoadTest' | 'grpcSchemaDiff' | 'grpcMockAssert';

export type WorkflowNodeData = HttpNodeData | ConditionNodeData | DelayNodeData | StartNodeData | ForkNodeData | JoinNodeData | EndNodeData | WebhookTriggerNodeData | ScheduleTriggerNodeData | SwitchNodeData | LoopNodeData | SetVariableNodeData | AggregateNodeData | ErrorHandlerNodeData | LogDebugNodeData | WaitForConditionNodeData | SubWorkflowNodeData | ScriptNodeData | CorrelationWaitNodeData | KafkaProduceNodeData | KafkaConsumeNodeData | KafkaTriggerNodeData | KafkaWaitNodeData | WsConnectNodeData | WsSendNodeData | WsReceiveNodeData | WsTriggerNodeData | GraphqlQueryNodeData | GraphqlSubscriptionNodeData | GraphqlIntrospectNodeData | GraphqlAssertNodeData | GrpcUnaryNodeData | GrpcServerStreamNodeData | GrpcAssertNodeData | GrpcLoadTestNodeData | GrpcSchemaDiffNodeData | GrpcMockAssertNodeData;

