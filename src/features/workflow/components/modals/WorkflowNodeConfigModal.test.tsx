/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import WorkflowNodeConfigModal from './WorkflowNodeConfigModal';
import type { WorkflowNode, HttpNodeData, StartNodeData, ConditionNodeData, DelayNodeData, WebhookTriggerNodeData, ScheduleTriggerNodeData, EndNodeData } from '../../types/workflow';
import type { Scenario } from '../../../../shared/types';

// Mock heavy child components to keep tests focused
vi.mock('../configs/HttpConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ data }: { data: HttpNodeData }) => (
    <div data-testid="http-config">HttpConfig: {data.label}</div>
  )),
}));

vi.mock('../configs/ConditionConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="condition-config">ConditionConfig</div>),
}));

vi.mock('../configs/DelayConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="delay-config">DelayConfig</div>),
}));

vi.mock('../configs/WebhookConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="webhook-config">WebhookConfig</div>),
}));

vi.mock('../configs/ScheduleConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="schedule-config">ScheduleConfig</div>),
}));

vi.mock('../configs/SwitchConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="switch-config">SwitchConfig</div>),
}));

vi.mock('../configs/LoopConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="loop-config">LoopConfig</div>),
}));

vi.mock('../configs/SetVariableConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="set-variable-config">SetVariableConfig</div>),
}));

vi.mock('../configs/AggregateConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="aggregate-config">AggregateConfig</div>),
}));

vi.mock('../configs/ErrorHandlerConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="error-handler-config">ErrorHandlerConfig</div>),
}));

vi.mock('../configs/LogDebugConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="log-debug-config">LogDebugConfig</div>),
}));

vi.mock('../configs/WaitForConditionConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="wait-config">WaitForConditionConfig</div>),
}));

vi.mock('../configs/SubWorkflowConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="sub-workflow-config">SubWorkflowConfig</div>),
}));

vi.mock('./WorkflowVariableInsertModal', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => null),
}));

vi.mock('../configs/NodeConfigInputTab', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="input-tab">InputTab</div>),
}));

vi.mock('../configs/NodeConfigOutputTab', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="output-tab">OutputTab</div>),
}));

vi.mock('../configs/NodeConfigLogsTab', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="logs-tab">LogsTab</div>),
}));

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1', name: 'Test', url: '/api/test', method: 'GET',
    headers: [], body: '', auth: { type: 'none' }, validation: {},
    ...overrides,
  } as Scenario;
}

function makeHttpNode(overrides: Partial<HttpNodeData> = {}): WorkflowNode {
  return {
    id: 'node-1', type: 'http', position: { x: 0, y: 0 },
    data: { label: 'Get Users', scenario: makeScenario(), ...overrides },
  };
}

function makeNode(type: WorkflowNode['type'], data: Record<string, unknown>): WorkflowNode {
  return { id: 'node-1', type, position: { x: 0, y: 0 }, data: { label: 'Test Node', ...data } as WorkflowNode['data'] };
}

const defaultProps = {
  node: makeHttpNode(),
  workflowVariables: {},
  onUpdateNode: vi.fn(),
  onDeleteNode: vi.fn(),
  onClose: vi.fn(),
  effectiveQuickTestBaseUrl: 'http://localhost:3000',
};

describe('WorkflowNodeConfigModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Title ──

  it('shows title with node type and label', () => {
    render(<WorkflowNodeConfigModal {...defaultProps} />);
    expect(screen.getByText(/HTTP — Get Users/)).toBeTruthy();
  });

  // ── Save / Cancel ──

  it('renders Save and Cancel buttons', () => {
    render(<WorkflowNodeConfigModal {...defaultProps} />);
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onUpdateNode + onClose when Save is clicked', () => {
    const onUpdateNode = vi.fn();
    const onClose = vi.fn();
    render(<WorkflowNodeConfigModal {...defaultProps} onUpdateNode={onUpdateNode} onClose={onClose} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({ label: 'Get Users' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores original data + calls onClose when Cancel is clicked', () => {
    const onUpdateNode = vi.fn();
    const onClose = vi.fn();
    render(<WorkflowNodeConfigModal {...defaultProps} onUpdateNode={onUpdateNode} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({ label: 'Get Users' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Delete ──

  it('renders Delete button and calls onDeleteNode + onClose', () => {
    const onDeleteNode = vi.fn();
    const onClose = vi.fn();
    render(<WorkflowNodeConfigModal {...defaultProps} onDeleteNode={onDeleteNode} onClose={onClose} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onDeleteNode).toHaveBeenCalledWith('node-1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Node type routing ──

  it('renders HttpConfig for http node', () => {
    render(<WorkflowNodeConfigModal {...defaultProps} />);
    expect(screen.getByTestId('http-config')).toBeTruthy();
  });

  it('renders ConditionConfig for condition node', () => {
    const node = makeNode('condition', { left: '', operator: '==', right: '' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('condition-config')).toBeTruthy();
  });

  it('renders DelayConfig for delay node', () => {
    const node = makeNode('delay', { delayMs: 1000, mode: 'fixed' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('delay-config')).toBeTruthy();
  });

  it('renders WebhookConfig for webhook node', () => {
    const node = makeNode('webhook', { method: 'POST', path: '/hook', samplePayload: '{}' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('webhook-config')).toBeTruthy();
  });

  it('renders ScheduleConfig for schedule node', () => {
    const node = makeNode('schedule', { cronExpression: '* * * * *', timezone: 'UTC' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('schedule-config')).toBeTruthy();
  });

  it('renders VariablesSection for start node', () => {
    const node = makeNode('start', { inputVariables: {} });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByText('Trigger input variables')).toBeTruthy();
  });

  it('renders label editor for end node', () => {
    const node = makeNode('end', {});
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByPlaceholderText('End node')).toBeTruthy();
  });

  it('renders label editor for fork node', () => {
    const node = makeNode('fork', {});
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByPlaceholderText('Fork node')).toBeTruthy();
  });

  it('renders label editor for join node', () => {
    const node = makeNode('join', {});
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByPlaceholderText('Join node')).toBeTruthy();
  });

  // ── Panel tabs (HTTP only) ──

  it('renders panel tabs for http node', () => {
    render(<WorkflowNodeConfigModal {...defaultProps} />);
    expect(screen.getByText('Config')).toBeTruthy();
    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Output')).toBeTruthy();
    expect(screen.getByText('Logs')).toBeTruthy();
  });

  it('does not render panel tabs for non-http node', () => {
    const node = makeNode('delay', { delayMs: 1000, mode: 'fixed' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.queryByText('Config')).toBeNull();
    expect(screen.queryByText('Input')).toBeNull();
  });

  it('switches to Input tab when clicked', () => {
    render(<WorkflowNodeConfigModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Input'));
    expect(screen.getByTestId('input-tab')).toBeTruthy();
  });

  it('switches to Output tab when clicked', () => {
    render(<WorkflowNodeConfigModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Output'));
    expect(screen.getByTestId('output-tab')).toBeTruthy();
  });

  it('switches to Logs tab when clicked', () => {
    render(<WorkflowNodeConfigModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Logs'));
    expect(screen.getByTestId('logs-tab')).toBeTruthy();
  });

  // ── Other node types ──

  it('renders SwitchConfig for switch node', () => {
    const node = makeNode('switch', { expression: '{{status}}', cases: [] });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('switch-config')).toBeTruthy();
  });

  it('renders LoopConfig for loop node', () => {
    const node = makeNode('loop', { iterateOver: '', maxIterations: 10 });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('loop-config')).toBeTruthy();
  });

  it('renders SetVariableConfig for setVariable node', () => {
    const node = makeNode('setVariable', { assignments: [] });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('set-variable-config')).toBeTruthy();
  });

  it('renders AggregateConfig for aggregate node', () => {
    const node = makeNode('aggregate', { operation: 'count', sourceVariable: '' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('aggregate-config')).toBeTruthy();
  });

  it('renders ErrorHandlerConfig for errorHandler node', () => {
    const node = makeNode('errorHandler', { retryCount: 0, retryDelayMs: 0 });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('error-handler-config')).toBeTruthy();
  });

  it('renders LogDebugConfig for logDebug node', () => {
    const node = makeNode('logDebug', { message: '' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('log-debug-config')).toBeTruthy();
  });

  it('renders WaitForConditionConfig for waitForCondition node', () => {
    const node = makeNode('waitForCondition', { expression: '', timeoutMs: 5000 });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('wait-config')).toBeTruthy();
  });

  it('renders SubWorkflowConfig for subWorkflow node', () => {
    const node = makeNode('subWorkflow', { workflowId: '' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('sub-workflow-config')).toBeTruthy();
  });
});
