import type { ComponentProps } from 'react';
import HttpConfig from '../configs/HttpConfig';
import type { HttpTab } from '../configs/HttpConfig';
import ConditionConfig from '../configs/ConditionConfig';
import DelayConfig from '../configs/DelayConfig';
import SwitchConfig from '../configs/SwitchConfig';
import LoopConfig from '../configs/LoopConfig';
import SetVariableConfig from '../configs/SetVariableConfig';
import AggregateConfig from '../configs/AggregateConfig';
import ErrorHandlerConfig from '../configs/ErrorHandlerConfig';
import LogDebugConfig from '../configs/LogDebugConfig';
import WaitForConditionConfig from '../configs/WaitForConditionConfig';
import SubWorkflowConfig from '../configs/SubWorkflowConfig';
import type { WorkflowPickerItem } from '../configs/SubWorkflowConfig';
import ScriptConfig from '../configs/ScriptConfig';
import CorrelationWaitConfig from '../configs/CorrelationWaitConfig';
import WebhookConfig from '../configs/WebhookConfig';
import ScheduleConfig from '../configs/ScheduleConfig';
import KafkaProduceConfig from '../configs/KafkaProduceConfig';
import KafkaConsumeConfig from '../configs/KafkaConsumeConfig';
import KafkaTriggerConfig from '../configs/KafkaTriggerConfig';
import KafkaWaitConfig from '../configs/KafkaWaitConfig';
import WsConnectConfig from '../configs/WsConnectConfig';
import WsSendConfig from '../configs/WsSendConfig';
import WsReceiveConfig from '../configs/WsReceiveConfig';
import WsTriggerConfig from '../configs/WsTriggerConfig';
import GraphqlQueryConfigPanel from '../../../graphql/components/GraphqlQueryConfigPanel';
import GraphqlSubscriptionConfigPanel from '../../../graphql/components/GraphqlSubscriptionConfigPanel';
import GraphqlIntrospectConfigPanel from '../../../graphql/components/GraphqlIntrospectConfigPanel';
import GraphqlAssertConfigPanel from '../../../graphql/components/GraphqlAssertConfigPanel';
import GrpcLoadTestConfig from '../configs/GrpcLoadTestConfig';
import GrpcSchemaDiffConfig from '../configs/GrpcSchemaDiffConfig';
import GrpcMockAssertConfig from '../configs/GrpcMockAssertConfig';
import GrpcUnaryConfig from '../configs/GrpcUnaryConfig';
import GrpcServerStreamConfig from '../configs/GrpcServerStreamConfig';
import GrpcAssertConfig from '../configs/GrpcAssertConfig';
import VariablesSection from '../panels/VariablesSection';
import type { ExtractionFetchSampleProps } from '../../../requests/components/ExtractionEditor';
import type { Environment, GlobalAuthProfile } from '../../../../shared/types';
import type {
  WorkflowNode,
  HttpNodeData,
  ConditionNodeData,
  DelayNodeData,
  StartNodeData,
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
  WorkflowNodeData,
  WorkflowService,
} from '../../types/workflow';
import type {
  GrpcAssertNodeData,
  GrpcServerStreamNodeData,
  GrpcUnaryNodeData,
} from '../../types/workflow/node-grpc';
import type {
  GrpcLoadTestNodeData,
  GrpcMockAssertNodeData,
  GrpcSchemaDiffNodeData,
} from '../../types/workflow/node-grpc-advanced';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { isHttpWorkflowNode } from '../../utils/workflowVariableHints';

interface Props {
  draftNode: WorkflowNode;
  draft: WorkflowNodeData;
  updateDraft: (patch: Partial<WorkflowNodeData>) => void;
  workflowVariables: Record<string, string>;
  runtimeVariables?: Record<string, string>;
  conditionVariableHints: WorkflowVariableHint[];
  variableInsertHints: WorkflowVariableHint[];
  draftVariableHints: WorkflowVariableHint[];
  requestVariableInsert: (
    apply: (snippet: string) => void,
    shortRef?: boolean,
    initialSearch?: string,
  ) => void;
  workflows: WorkflowPickerItem[];
  workflowId?: string;
  nodeId: string;
  nodeRunStatus?: import('../../types/workflow').NodeRunStatus | null;
  wsConnectionIds: string[];
  workflowServices: WorkflowService[];
  environments: Environment[];
  selectedEnvId?: string;
  globalAuthProfiles: GlobalAuthProfile[];
  httpTab: HttpTab;
  setHttpTab: (tab: HttpTab) => void;
  lastRunStepError?: string | null;
  lastQuickTestRequestUrl?: string | null;
  draftEffectiveBaseUrl: string;
  extractionSampleResponseBody?: string;
  extractionFetchSample?: Pick<ExtractionFetchSampleProps, 'onFetch' | 'fetching' | 'error'>;
  validationProps: NonNullable<ComponentProps<typeof HttpConfig>['validationProps']>;
  newVarKey: string;
  setNewVarKey: (next: string) => void;
  newVarValue: string;
  setNewVarValue: (next: string) => void;
}

export default function WorkflowNodeConfigTypePanels({
  draftNode,
  draft,
  updateDraft,
  workflowVariables,
  runtimeVariables,
  conditionVariableHints,
  variableInsertHints,
  draftVariableHints,
  requestVariableInsert,
  workflows,
  workflowId,
  nodeId,
  nodeRunStatus,
  wsConnectionIds,
  workflowServices,
  environments,
  selectedEnvId,
  globalAuthProfiles,
  httpTab,
  setHttpTab,
  lastRunStepError,
  lastQuickTestRequestUrl,
  draftEffectiveBaseUrl,
  extractionSampleResponseBody,
  extractionFetchSample,
  validationProps,
  newVarKey,
  setNewVarKey,
  newVarValue,
  setNewVarValue,
}: Props) {
  return (
    <>
      {isHttpWorkflowNode(draftNode) && (
        <HttpConfig
          data={draftNode.data as HttpNodeData}
          onChange={(patch) => updateDraft(patch)}
          activeTab={httpTab}
          onTabChange={setHttpTab}
          lastRunError={lastRunStepError ?? undefined}
          lastQuickTestRequestUrl={lastQuickTestRequestUrl}
          effectiveQuickTestBaseUrl={draftEffectiveBaseUrl}
          extractionSampleResponseBody={extractionSampleResponseBody}
          extractionFetchSample={extractionFetchSample}
          variableHints={draftVariableHints}
          onRequestVariableInsert={requestVariableInsert}
          workflowServices={workflowServices}
          environments={environments}
          selectedEnvId={selectedEnvId}
          validationProps={validationProps}
        />
      )}

      {draftNode.type === 'condition' && (
        <ConditionConfig
          key={draftNode.id}
          data={draftNode.data as ConditionNodeData}
          onChange={(data) => updateDraft(data)}
          variableHints={conditionVariableHints}
          onRequestVariableInsert={requestVariableInsert}
        />
      )}

      {draftNode.type === 'delay' && (
        <DelayConfig
          data={draftNode.data as DelayNodeData}
          onChange={(data) => updateDraft(data)}
        />
      )}

      {draftNode.type === 'start' && (
        <VariablesSection
          title="Trigger input variables"
          hint="Variables seeded when the workflow starts. Available as {{name}} in all downstream steps."
          variables={(draftNode.data as StartNodeData).inputVariables ?? {}}
          onUpdateVariables={(vars) => updateDraft({ inputVariables: vars })}
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
          workflowVariables={workflowVariables}
        />
      )}

      {draftNode.type === 'webhook' && (
        <WebhookConfig
          data={draftNode.data as WebhookTriggerNodeData}
          onChange={updateDraft}
          workflowId={workflowId}
          nodeId={nodeId}
        />
      )}

      {draftNode.type === 'schedule' && (
        <ScheduleConfig
          data={draftNode.data as ScheduleTriggerNodeData}
          onChange={updateDraft}
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
          workflowVariables={workflowVariables}
        />
      )}

      {draftNode.type === 'switch' && (
        <SwitchConfig
          data={draftNode.data as SwitchNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={conditionVariableHints}
        />
      )}

      {draftNode.type === 'loop' && (
        <LoopConfig
          data={draftNode.data as LoopNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={conditionVariableHints}
        />
      )}

      {draftNode.type === 'setVariable' && (
        <SetVariableConfig
          data={draftNode.data as SetVariableNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={conditionVariableHints}
        />
      )}

      {draftNode.type === 'aggregate' && (
        <AggregateConfig
          data={draftNode.data as AggregateNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={conditionVariableHints}
        />
      )}

      {draftNode.type === 'errorHandler' && (
        <ErrorHandlerConfig
          data={draftNode.data as ErrorHandlerNodeData}
          onChange={(data) => updateDraft(data)}
        />
      )}

      {draftNode.type === 'logDebug' && (
        <LogDebugConfig
          data={draftNode.data as LogDebugNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={conditionVariableHints}
        />
      )}

      {draftNode.type === 'waitForCondition' && (
        <WaitForConditionConfig
          data={draftNode.data as WaitForConditionNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={conditionVariableHints}
        />
      )}

      {draftNode.type === 'subWorkflow' && (
        <SubWorkflowConfig
          data={draftNode.data as SubWorkflowNodeData}
          onChange={(data) => updateDraft(data)}
          workflows={workflows}
          currentWorkflowId={workflowId}
        />
      )}

      {draftNode.type === 'script' && (
        <ScriptConfig
          data={draftNode.data as ScriptNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
          workflowVariables={runtimeVariables ?? workflowVariables}
        />
      )}

      {draftNode.type === 'correlationWait' && (
        <CorrelationWaitConfig
          data={draftNode.data as CorrelationWaitNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
        />
      )}

      {draftNode.type === 'kafkaProduce' && (
        <KafkaProduceConfig
          data={draftNode.data as KafkaProduceNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
        />
      )}

      {draftNode.type === 'kafkaConsume' && (
        <KafkaConsumeConfig
          data={draftNode.data as KafkaConsumeNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
        />
      )}

      {draftNode.type === 'kafkaTrigger' && (
        <KafkaTriggerConfig
          data={draftNode.data as KafkaTriggerNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
        />
      )}

      {draftNode.type === 'kafkaWait' && (
        <KafkaWaitConfig
          data={draftNode.data as KafkaWaitNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
        />
      )}

      {draftNode.type === 'wsConnect' && (
        <WsConnectConfig
          data={draftNode.data as WsConnectNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
        />
      )}

      {draftNode.type === 'wsSend' && (
        <WsSendConfig
          key={draftNode.id}
          data={draftNode.data as WsSendNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
          availableConnectionIds={wsConnectionIds}
        />
      )}

      {draftNode.type === 'wsReceive' && (
        <WsReceiveConfig
          key={draftNode.id}
          data={draftNode.data as WsReceiveNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          availableConnectionIds={wsConnectionIds}
          variableHints={variableInsertHints}
        />
      )}

      {draftNode.type === 'wsTrigger' && (
        <WsTriggerConfig
          data={draftNode.data as WsTriggerNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
        />
      )}

      {(draftNode.type === 'graphqlQuery' || draftNode.type === 'graphqlMutation') && (
        <GraphqlQueryConfigPanel
          data={draftNode.data as GraphqlQueryNodeData}
          nodeType={draftNode.type as 'graphqlQuery' | 'graphqlMutation'}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
          nodeRunStatus={nodeRunStatus}
        />
      )}

      {draftNode.type === 'graphqlSubscription' && (
        <GraphqlSubscriptionConfigPanel
          data={draftNode.data as GraphqlSubscriptionNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
          nodeRunStatus={nodeRunStatus}
        />
      )}

      {draftNode.type === 'graphqlIntrospect' && (
        <GraphqlIntrospectConfigPanel
          data={draftNode.data as GraphqlIntrospectNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
        />
      )}

      {draftNode.type === 'graphqlAssert' && (
        <GraphqlAssertConfigPanel
          data={draftNode.data as GraphqlAssertNodeData}
          onChange={(data) => updateDraft(data)}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={variableInsertHints}
          runtimeVariables={runtimeVariables}
        />
      )}

      {draftNode.type === 'grpcUnary' && (
        <GrpcUnaryConfig
          data={draftNode.data as GrpcUnaryNodeData}
          onChange={(data) => updateDraft(data)}
          globalAuthProfiles={globalAuthProfiles}
          workflowVariables={workflowVariables}
        />
      )}

      {draftNode.type === 'grpcServerStream' && (
        <GrpcServerStreamConfig
          data={draftNode.data as GrpcServerStreamNodeData}
          onChange={(data) => updateDraft(data)}
          globalAuthProfiles={globalAuthProfiles}
          workflowVariables={workflowVariables}
        />
      )}

      {draftNode.type === 'grpcAssert' && (
        <GrpcAssertConfig
          data={draftNode.data as GrpcAssertNodeData}
          onChange={(data) => updateDraft(data)}
        />
      )}

      {draftNode.type === 'grpcLoadTest' && (
        <GrpcLoadTestConfig
          data={draftNode.data as GrpcLoadTestNodeData}
          onChange={(data) => updateDraft(data)}
          globalAuthProfiles={globalAuthProfiles}
          workflowVariables={workflowVariables}
        />
      )}

      {draftNode.type === 'grpcSchemaDiff' && (
        <GrpcSchemaDiffConfig
          data={draftNode.data as GrpcSchemaDiffNodeData}
          onChange={(data) => updateDraft(data)}
        />
      )}

      {draftNode.type === 'grpcMockAssert' && (
        <GrpcMockAssertConfig
          data={draftNode.data as GrpcMockAssertNodeData}
          onChange={(data) => updateDraft(data)}
        />
      )}

      {(draftNode.type === 'fork' || draftNode.type === 'join' || draftNode.type === 'end') && (
        <div className="wf-config-section wf-forkjoin-config">
          <div className="wf-config-field--row">
            <label>Label</label>
            <input
              type="text"
              className="wf-config-input"
              value={draft.label || ''}
              onChange={(e) => updateDraft({ label: e.target.value })}
              placeholder={`${draftNode.type.charAt(0).toUpperCase() + draftNode.type.slice(1)} node`}
            />
          </div>
          <div className="wf-config-section-info">
            <ul>
              {draftNode.type === 'fork' && (
                <>
                  <li>All branches connected to this Fork run <strong>simultaneously</strong> (parallel execution).</li>
                  <li>Pair with a <strong>Join</strong> node downstream to wait for all branches to complete.</li>
                </>
              )}
              {draftNode.type === 'join' && (
                <>
                  <li>Waits for <strong>all incoming branches</strong> to complete before continuing.</li>
                  <li>Typically placed after parallel branches from a Fork node.</li>
                </>
              )}
              {draftNode.type === 'end' && (
                <li>Marks the workflow as <strong>complete</strong>. No further nodes will execute after this point.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {isHttpWorkflowNode(draftNode) && (
        <VariablesSection
          title="Initial Variables (this step)"
          hint="Per-step values override upstream for the same name."
          variables={(draftNode.data as HttpNodeData).initialVariables ?? {}}
          onUpdateVariables={(vars) => updateDraft({ initialVariables: vars })}
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
          onRequestVariableInsert={requestVariableInsert}
          variableHints={draftVariableHints}
          workflowVariables={workflowVariables}
        />
      )}
    </>
  );
}
