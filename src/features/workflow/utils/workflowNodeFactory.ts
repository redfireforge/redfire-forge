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
} from '../types/workflow';
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
  }
}
