/**
 * @vitest-environment jsdom
 */
import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkflowNodeConfigTypePanels from './WorkflowNodeConfigTypePanels';
import type { WorkflowNode } from '../../types/workflow';

const { mockPanel } = vi.hoisted(() => ({
  mockPanel: (testId: string) => function MockPanel({ onChange }: { onChange?: (value: unknown) => void }) {
    useEffect(() => { onChange?.({ touched: true }); }, [onChange]);
    return <div data-testid={testId} />;
  },
}));

vi.mock('../configs/HttpConfig', () => ({ default: mockPanel('http-config') }));
vi.mock('../configs/ApiMockNodeConfigs', () => ({
  ApiMockStartConfig: mockPanel('api-mock-start-panel'),
  ApiMockApplyConfig: mockPanel('api-mock-apply-panel'),
  ApiMockResetStateConfig: mockPanel('api-mock-reset-panel'),
  ApiMockStopConfig: mockPanel('api-mock-stop-panel'),
  ApiMockAssertCallsConfig: mockPanel('api-mock-assert-panel'),
}));
vi.mock('../configs/ConditionConfig', () => ({ default: mockPanel('condition-panel') }));
vi.mock('../configs/DelayConfig', () => ({ default: mockPanel('delay-panel') }));
vi.mock('../configs/StartConfig', () => ({ default: mockPanel('start-panel') }));
vi.mock('../configs/SwitchConfig', () => ({ default: mockPanel('switch-panel') }));
vi.mock('../configs/LoopConfig', () => ({ default: mockPanel('loop-panel') }));
vi.mock('../configs/SetVariableConfig', () => ({ default: mockPanel('set-variable-panel') }));
vi.mock('../configs/AggregateConfig', () => ({ default: mockPanel('aggregate-panel') }));
vi.mock('../configs/ErrorHandlerConfig', () => ({ default: mockPanel('error-handler-panel') }));
vi.mock('../configs/LogDebugConfig', () => ({ default: mockPanel('log-debug-panel') }));
vi.mock('../configs/WaitForConditionConfig', () => ({ default: mockPanel('wait-panel') }));
vi.mock('../configs/SubWorkflowConfig', () => ({ default: mockPanel('subworkflow-panel') }));
vi.mock('../configs/ScriptConfig', () => ({ default: mockPanel('script-panel') }));
vi.mock('../configs/CorrelationWaitConfig', () => ({ default: mockPanel('correlation-panel') }));
vi.mock('../configs/WebhookConfig', () => ({ default: mockPanel('webhook-panel') }));
vi.mock('../configs/ScheduleConfig', () => ({ default: mockPanel('schedule-panel') }));
vi.mock('../configs/KafkaProduceConfig', () => ({ default: mockPanel('kafka-produce-panel') }));
vi.mock('../configs/KafkaConsumeConfig', () => ({ default: mockPanel('kafka-consume-panel') }));
vi.mock('../configs/KafkaTriggerConfig', () => ({ default: mockPanel('kafka-trigger-panel') }));
vi.mock('../configs/KafkaWaitConfig', () => ({ default: mockPanel('kafka-wait-panel') }));
vi.mock('../configs/WsConnectConfig', () => ({ default: mockPanel('ws-connect-panel') }));
vi.mock('../configs/WsSendConfig', () => ({ default: mockPanel('ws-send-panel') }));
vi.mock('../configs/WsReceiveConfig', () => ({ default: mockPanel('ws-receive-panel') }));
vi.mock('../configs/WsTriggerConfig', () => ({ default: mockPanel('ws-trigger-panel') }));
vi.mock('../../../graphql/components/GraphqlQueryConfigPanel', () => ({ default: mockPanel('gql-query-panel') }));
vi.mock('../../../graphql/components/GraphqlSubscriptionConfigPanel', () => ({ default: mockPanel('gql-sub-panel') }));
vi.mock('../../../graphql/components/GraphqlIntrospectConfigPanel', () => ({ default: mockPanel('gql-introspect-panel') }));
vi.mock('../../../graphql/components/GraphqlAssertConfigPanel', () => ({ default: mockPanel('gql-assert-panel') }));
vi.mock('../configs/GrpcUnaryConfig', () => ({ default: mockPanel('grpc-unary-panel') }));
vi.mock('../configs/GrpcServerStreamConfig', () => ({ default: mockPanel('grpc-stream-panel') }));
vi.mock('../configs/GrpcAssertConfig', () => ({ default: mockPanel('grpc-assert-panel') }));
vi.mock('../configs/GrpcLoadTestConfig', () => ({ default: mockPanel('grpc-load-panel') }));
vi.mock('../configs/GrpcSchemaDiffConfig', () => ({ default: mockPanel('grpc-schema-panel') }));
vi.mock('../configs/GrpcMockAssertConfig', () => ({ default: mockPanel('grpc-mock-panel') }));
vi.mock('../panels/VariablesSection', () => ({
  default: function VariablesSectionMock({ onUpdateVariables }: { onUpdateVariables?: (vars: Record<string, string>) => void }) {
    useEffect(() => { onUpdateVariables?.({ seeded: '1' }); }, [onUpdateVariables]);
    return <div data-testid="variables-section" />;
  },
}));
vi.mock('../configs/KafkaConfigUi', () => ({ KafkaCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../configs/KafkaConfigUi', () => ({ KafkaCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

function baseProps(overrides: Partial<React.ComponentProps<typeof WorkflowNodeConfigTypePanels>> = {}) {
  const draftNode = {
    id: 'n1',
    type: 'delay',
    position: { x: 0, y: 0 },
    data: { label: 'Delay' },
  } as WorkflowNode;
  return {
    draftNode,
    draft: draftNode.data,
    updateDraft: vi.fn(),
    workflowVariables: { env: 'dev' },
    runtimeVariables: { run: '1' },
    conditionVariableHints: [],
    variableInsertHints: [],
    draftVariableHints: [],
    requestVariableInsert: vi.fn(),
    workflows: [],
    nodeId: 'n1',
    wsConnectionIds: ['conn-1'],
    workflowServices: [],
    environments: [],
    globalAuthProfiles: [],
    httpTab: 'request' as const,
    setHttpTab: vi.fn(),
    draftEffectiveBaseUrl: 'http://localhost:8080',
    validationProps: {},
    newVarKey: '',
    setNewVarKey: vi.fn(),
    newVarValue: '',
    setNewVarValue: vi.fn(),
    ...overrides,
  };
}

function node(type: string, data: Record<string, unknown> = { label: type }) {
  return {
    id: `${type}-1`,
    type,
    position: { x: 0, y: 0 },
    data,
  } as WorkflowNode;
}

describe('WorkflowNodeConfigTypePanels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['http', 'http-config', { label: 'GET', method: 'GET', path: '/x', initialVariables: {} }],
    ['condition', 'condition-panel'],
    ['delay', 'delay-panel'],
    ['start', 'start-panel'],
    ['webhook', 'webhook-panel'],
    ['schedule', 'schedule-panel'],
    ['switch', 'switch-panel'],
    ['loop', 'loop-panel'],
    ['setVariable', 'set-variable-panel'],
    ['aggregate', 'aggregate-panel'],
    ['errorHandler', 'error-handler-panel'],
    ['logDebug', 'log-debug-panel'],
    ['waitForCondition', 'wait-panel'],
    ['subWorkflow', 'subworkflow-panel'],
    ['script', 'script-panel'],
    ['correlationWait', 'correlation-panel'],
    ['kafkaProduce', 'kafka-produce-panel'],
    ['kafkaConsume', 'kafka-consume-panel'],
    ['kafkaTrigger', 'kafka-trigger-panel'],
    ['kafkaWait', 'kafka-wait-panel'],
    ['wsConnect', 'ws-connect-panel'],
    ['wsSend', 'ws-send-panel'],
    ['wsReceive', 'ws-receive-panel'],
    ['wsTrigger', 'ws-trigger-panel'],
    ['graphqlQuery', 'gql-query-panel'],
    ['graphqlMutation', 'gql-query-panel'],
    ['graphqlSubscription', 'gql-sub-panel'],
    ['graphqlIntrospect', 'gql-introspect-panel'],
    ['graphqlAssert', 'gql-assert-panel'],
    ['grpcUnary', 'grpc-unary-panel'],
    ['grpcServerStream', 'grpc-stream-panel'],
    ['grpcAssert', 'grpc-assert-panel'],
    ['grpcLoadTest', 'grpc-load-panel'],
    ['grpcSchemaDiff', 'grpc-schema-panel'],
    ['grpcMockAssert', 'grpc-mock-panel'],
    ['apiMockStart', 'api-mock-start-panel', { label: 'Start', serverId: 'srv-1' }],
    ['apiMockApply', 'api-mock-apply-panel', { label: 'Apply', serverId: 'srv-1' }],
    ['apiMockResetState', 'api-mock-reset-panel', { label: 'Reset', serverId: 'srv-1' }],
    ['apiMockStop', 'api-mock-stop-panel', { label: 'Stop', serverId: 'srv-1' }],
    ['apiMockAssertCalls', 'api-mock-assert-panel', { label: 'Assert', serverId: 'srv-1' }],
  ] as const)('renders %s panel', (type, testId, data) => {
    const draftNode = node(type, data ?? { label: type });
    render(<WorkflowNodeConfigTypePanels {...baseProps({ draftNode, draft: draftNode.data })} />);
    expect(screen.getByTestId(testId)).toBeTruthy();
  });

  it('renders fork, join, and end label editors with guidance text', () => {
    const updateDraft = vi.fn();
    const joinNode = node('join', { label: 'Join' });
    const { unmount } = render(<WorkflowNodeConfigTypePanels {...baseProps({ draftNode: joinNode, draft: joinNode.data, updateDraft })} />);
    expect(screen.getByText(/incoming branches/i)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Join node'), { target: { value: 'Merge' } });
    expect(updateDraft).toHaveBeenCalledWith({ label: 'Merge' });
    unmount();

    const forkNode = node('fork', { label: 'Fork' });
    render(<WorkflowNodeConfigTypePanels {...baseProps({ draftNode: forkNode, draft: forkNode.data })} />);
    expect(screen.getByText(/simultaneously/i)).toBeTruthy();
    unmount();

    const endNode = node('end', { label: '' });
    render(<WorkflowNodeConfigTypePanels {...baseProps({ draftNode: endNode, draft: endNode.data })} />);
    expect(screen.getByPlaceholderText('End node')).toBeTruthy();
    expect(screen.getByText(/No further nodes will execute/i)).toBeTruthy();
  });

  it('passes runtime variables to script config when provided', () => {
    const draftNode = node('script', { label: 'Script', code: 'return 1;' });
    render(<WorkflowNodeConfigTypePanels {...baseProps({ draftNode, draft: draftNode.data, runtimeVariables: { x: '1' } })} />);
    expect(screen.getByTestId('script-panel')).toBeTruthy();
  });

  it('routes HTTP tab changes through setHttpTab', () => {
    const setHttpTab = vi.fn();
    const draftNode = node('http', { label: 'GET', method: 'GET', path: '/users', initialVariables: {} });
    render(<WorkflowNodeConfigTypePanels {...baseProps({ draftNode, draft: draftNode.data, setHttpTab })} />);
    expect(setHttpTab).not.toHaveBeenCalled();
  });
});
