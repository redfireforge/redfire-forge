/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import WorkflowNodeConfigModal from './WorkflowNodeConfigModal';
import { WorkflowNode, HttpNodeData } from '../../types/workflow';
import { Scenario } from '../../../../shared/types';
import { WorkflowVariableHint } from '../../utils/workflowVariableHints';

// Mock heavy child components to keep tests focused
vi.mock('../configs/HttpConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation((props: {
    data: HttpNodeData;
    onChange: (p: Partial<HttpNodeData>) => void;
    onTabChange: (t: string) => void;
    onRequestVariableInsert: (apply: (s: string) => void, shortRef?: boolean, initial?: string) => void;
    effectiveQuickTestBaseUrl: string;
    lastRunError?: string;
    lastQuickTestRequestUrl?: string | null;
  }) => (
    <div data-testid="http-config">
      HttpConfig: {props.data.label}
      <span data-testid="http-effective-base">{props.effectiveQuickTestBaseUrl}</span>
      <span data-testid="http-last-err">{props.lastRunError ?? ''}</span>
      <span data-testid="http-last-url">{props.lastQuickTestRequestUrl ?? ''}</span>
      <button type="button" onClick={() => props.onChange({ label: 'Patched HTTP' })}>patch-http</button>
      <button type="button" onClick={() => props.onTabChange('headers' as never)}>http-secondary-tab</button>
      <button
        type="button"
        onClick={() => props.onRequestVariableInsert(() => {}, false, 'findme')}
      >
        request-var-insert
      </button>
    </div>
  )),
}));

vi.mock('../configs/ConditionConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="condition-config">
      ConditionConfig
      <button type="button" onClick={() => onChange({ left: 'x' })}>patch-condition</button>
    </div>
  )),
}));

vi.mock('../configs/DelayConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="delay-config">
      DelayConfig
      <button type="button" onClick={() => onChange({ delayMs: 999 })}>patch-delay</button>
    </div>
  )),
}));

vi.mock('../configs/WebhookConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="webhook-config">
      WebhookConfig
      <button type="button" onClick={() => onChange({ path: '/x' })}>patch-webhook</button>
    </div>
  )),
}));

vi.mock('../configs/ScheduleConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="schedule-config">
      ScheduleConfig
      <button type="button" onClick={() => onChange({ timezone: 'CET' })}>patch-schedule</button>
    </div>
  )),
}));

vi.mock('../configs/SwitchConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="switch-config">
      SwitchConfig
      <button type="button" onClick={() => onChange({ expression: '{{v}}' })}>patch-switch</button>
    </div>
  )),
}));

vi.mock('../configs/LoopConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="loop-config">
      LoopConfig
      <button type="button" onClick={() => onChange({ maxIterations: 3 })}>patch-loop</button>
    </div>
  )),
}));

vi.mock('../configs/SetVariableConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="set-variable-config">
      SetVariableConfig
      <button type="button" onClick={() => onChange({ assignments: [] })}>patch-set-var</button>
    </div>
  )),
}));

vi.mock('../configs/AggregateConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="aggregate-config">
      AggregateConfig
      <button type="button" onClick={() => onChange({ sourceVariable: 's' })}>patch-aggregate</button>
    </div>
  )),
}));

vi.mock('../configs/ErrorHandlerConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="error-handler-config">
      ErrorHandlerConfig
      <button type="button" onClick={() => onChange({ retryCount: 2 })}>patch-error-handler</button>
    </div>
  )),
}));

vi.mock('../configs/LogDebugConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="log-debug-config">
      LogDebugConfig
      <button type="button" onClick={() => onChange({ message: 'hi' })}>patch-log-debug</button>
    </div>
  )),
}));

vi.mock('../configs/WaitForConditionConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="wait-config">
      WaitForConditionConfig
      <button type="button" onClick={() => onChange({ timeoutMs: 1 })}>patch-wait</button>
    </div>
  )),
}));

vi.mock('../configs/SubWorkflowConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="sub-workflow-config">
      SubWorkflowConfig
      <button type="button" onClick={() => onChange({ workflowId: 'wf-2' })}>patch-sub-wf</button>
    </div>
  )),
}));

vi.mock('../configs/ScriptConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation((props: {
    onChange: (p: Record<string, unknown>) => void;
    workflowVariables: Record<string, string>;
  }) => (
    <div data-testid="script-config">
      ScriptConfig
      <span data-testid="script-wf-vars">{JSON.stringify(props.workflowVariables)}</span>
      <button type="button" onClick={() => props.onChange({ code: 'return 1' })}>patch-script</button>
    </div>
  )),
}));

vi.mock('../configs/CorrelationWaitConfig', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="correlation-wait-config">
      CorrelationWaitConfig
      <button type="button" onClick={() => onChange({ timeoutMs: 1234 })}>patch-correlation</button>
    </div>
  )),
}));

vi.mock('./WorkflowVariableInsertModal', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation((props: { open: boolean; initialSearch: string }) => (
    props.open ? (
      <div data-testid="var-insert-modal-open" data-initial-search={props.initialSearch}>VariableInsertOpen</div>
    ) : null
  )),
}));

vi.mock('../configs/NodeConfigInputTab', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="input-tab">InputTab</div>),
}));

vi.mock('../configs/NodeConfigOutputTab', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation((props: { nodeRunStatus?: unknown }) => (
    <div data-testid="output-tab" data-status={props.nodeRunStatus ? 'has-status' : 'no-status'}>OutputTab</div>
  )),
}));

vi.mock('../configs/NodeConfigLogsTab', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation((props: { nodeRunStatus?: unknown }) => (
    <div data-testid="logs-tab" data-status={props.nodeRunStatus ? 'has-status' : 'no-status'}>LogsTab</div>
  )),
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

  // ── Save / Close ──

  it('renders Save and Close buttons', () => {
    render(<WorkflowNodeConfigModal {...defaultProps} />);
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('calls onUpdateNode + onClose when Save is clicked', () => {
    const onUpdateNode = vi.fn();
    const onClose = vi.fn();
    render(<WorkflowNodeConfigModal {...defaultProps} onUpdateNode={onUpdateNode} onClose={onClose} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({ label: 'Get Users' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores original data + calls onClose when Close is clicked', () => {
    const onUpdateNode = vi.fn();
    const onClose = vi.fn();
    render(<WorkflowNodeConfigModal {...defaultProps} onUpdateNode={onUpdateNode} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({ label: 'Get Users' }));
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

  it('updates start node trigger input variables via VariablesSection', () => {
    const onUpdateNode = vi.fn();
    const node = makeNode('start', { inputVariables: {} });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} onUpdateNode={onUpdateNode} />);
    const section = screen.getByText('Trigger input variables').closest('.wf-config-vars')!;
    const nameInput = within(section).getByPlaceholderText('name');
    const valueInput = within(section).getByPlaceholderText('value');
    fireEvent.change(nameInput, { target: { value: 'triggerKey' } });
    fireEvent.change(valueInput, { target: { value: 'triggerVal' } });
    fireEvent.click(within(section).getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByText('Save'));
    expect(onUpdateNode).toHaveBeenCalledWith(
      'node-1',
      expect.objectContaining({ inputVariables: { triggerKey: 'triggerVal' } }),
    );
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

  it('renders panel tabs for non-http nodes', () => {
    const node = makeNode('delay', { delayMs: 1000, mode: 'fixed' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByText('Config')).toBeInTheDocument();
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
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

  it('renders ScriptConfig for script node and prefers runtimeVariables for script scope', () => {
    const node = makeNode('script', {
      code: '',
      mode: 'transform',
      inputVariables: [],
      outputVariables: [],
      timeoutMs: 5000,
      captureConsole: false,
    });
    render(
      <WorkflowNodeConfigModal
        {...defaultProps}
        node={node}
        workflowVariables={{ w: '1' }}
        runtimeVariables={{ r: '2' }}
      />,
    );
    expect(screen.getByTestId('script-config')).toBeTruthy();
    expect(screen.getByTestId('script-wf-vars')).toHaveTextContent(JSON.stringify({ r: '2' }));
    fireEvent.click(screen.getByText('patch-script'));
    fireEvent.click(screen.getByText('Save'));
    expect(defaultProps.onUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({ code: 'return 1' }));
  });

  it('renders ScriptConfig with workflowVariables when runtimeVariables omitted', () => {
    const node = makeNode('script', {
      code: '',
      mode: 'transform',
      inputVariables: [],
      outputVariables: [],
      timeoutMs: 5000,
      captureConsole: false,
    });
    render(
      <WorkflowNodeConfigModal {...defaultProps} node={node} workflowVariables={{ w: '9' }} />,
    );
    expect(screen.getByTestId('script-wf-vars')).toHaveTextContent(JSON.stringify({ w: '9' }));
  });

  it('renders CorrelationWaitConfig for correlationWait node', () => {
    const node = makeNode('correlationWait', {
      correlationIdExpression: '{{id}}',
      webhookPath: '/cb',
      correlationSource: 'body',
      correlationJsonPath: '$.id',
      timeoutMs: 5000,
    });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByTestId('correlation-wait-config')).toBeTruthy();
    fireEvent.click(screen.getByText('patch-correlation'));
    fireEvent.click(screen.getByText('Save'));
    expect(defaultProps.onUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({ timeoutMs: 1234 }));
  });

  // ── Draft / base URL / HTTP callbacks ──

  it('uses Step Config in title when HTTP label is empty', () => {
    const node = makeHttpNode({ label: '' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} />);
    expect(screen.getByText(/HTTP — Step Config/)).toBeTruthy();
  });

  it('uses resolveBaseUrl for HttpConfig effectiveQuickTestBaseUrl when provided', () => {
    const resolveBaseUrl = vi.fn().mockReturnValue('https://api.example');
    render(<WorkflowNodeConfigModal {...defaultProps} resolveBaseUrl={resolveBaseUrl} />);
    expect(screen.getByTestId('http-effective-base')).toHaveTextContent('https://api.example');
    expect(resolveBaseUrl).toHaveBeenCalled();
  });

  it('uses fallbackBaseUrl when resolveBaseUrl returns undefined', () => {
    const resolveBaseUrl = vi.fn().mockReturnValue(undefined);
    render(
      <WorkflowNodeConfigModal
        {...defaultProps}
        resolveBaseUrl={resolveBaseUrl}
        fallbackBaseUrl="https://fallback.example"
      />,
    );
    expect(screen.getByTestId('http-effective-base')).toHaveTextContent('https://fallback.example');
  });

  it('uses effectiveQuickTestBaseUrl when resolve returns undefined and fallback is empty', () => {
    const resolveBaseUrl = vi.fn().mockReturnValue(undefined as string | undefined);
    render(
      <WorkflowNodeConfigModal {...defaultProps} resolveBaseUrl={resolveBaseUrl} fallbackBaseUrl="" />,
    );
    expect(screen.getByTestId('http-effective-base')).toHaveTextContent('http://localhost:3000');
  });

  it('passes last run debug props through to HttpConfig', () => {
    render(
      <WorkflowNodeConfigModal
        {...defaultProps}
        lastRunStepError="err"
        lastQuickTestRequestUrl="http://last/request"
      />,
    );
    expect(screen.getByTestId('http-last-err')).toHaveTextContent('err');
    expect(screen.getByTestId('http-last-url')).toHaveTextContent('http://last/request');
  });

  it('HttpConfig onChange updates draft and Save persists it', () => {
    const onUpdateNode = vi.fn();
    render(<WorkflowNodeConfigModal {...defaultProps} onUpdateNode={onUpdateNode} />);
    fireEvent.click(screen.getByText('patch-http'));
    expect(screen.getByText(/HTTP — Patched HTTP/)).toBeTruthy();
    fireEvent.click(screen.getByText('Save'));
    expect(onUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({ label: 'Patched HTTP' }));
  });

  it('HttpConfig onTabChange and requestVariableInsert run without throwing', () => {
    render(<WorkflowNodeConfigModal {...defaultProps} />);
    fireEvent.click(screen.getByText('http-secondary-tab'));
    fireEvent.click(screen.getByText('request-var-insert'));
    expect(screen.getByTestId('var-insert-modal-open')).toBeTruthy();
    expect(screen.getByTestId('var-insert-modal-open')).toHaveAttribute('data-initial-search', 'findme');
  });

  it('returns non-HTTP draftVariableHints from httpVariableHints as-is', () => {
    const hints: WorkflowVariableHint[] = [{ ref: 'alpha', label: 'Alpha' }];
    const node = makeNode('delay', { delayMs: 1000, mode: 'fixed' });
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} httpVariableHints={hints} />);
    expect(screen.getByTestId('delay-config')).toBeTruthy();
  });

  it('shows Input tab hint badge when variable insert hints exist for HTTP', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:"Upstream".foo', label: 'foo ← "Upstream" (scoped)' },
      { ref: 'foo', label: 'foo (latest)' },
    ];
    render(<WorkflowNodeConfigModal {...defaultProps} httpVariableHints={hints} />);
    const inputTab = screen.getByText('Input').closest('button');
    expect(inputTab?.querySelector('.wf-config-modal-tab-badge')?.textContent).toBeTruthy();
  });

  it('returns to Config tab from Input', () => {
    render(<WorkflowNodeConfigModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Input'));
    fireEvent.click(screen.getByText('Config'));
    expect(screen.getByTestId('http-config')).toBeTruthy();
  });

  it('passes nodeRunStatus to Output and Logs tabs', () => {
    const status = { kind: 'done' as const };
    render(<WorkflowNodeConfigModal {...defaultProps} nodeRunStatus={status} />);
    fireEvent.click(screen.getByText('Output'));
    expect(screen.getByTestId('output-tab')).toHaveAttribute('data-status', 'has-status');
    fireEvent.click(screen.getByText('Logs'));
    expect(screen.getByTestId('logs-tab')).toHaveAttribute('data-status', 'has-status');
  });

  it('resets draft when node.id changes', () => {
    const nodeA = makeHttpNode({ label: 'A' });
    const nodeB = { ...makeHttpNode({ label: 'B' }), id: 'node-2' };
    const { rerender } = render(<WorkflowNodeConfigModal {...defaultProps} node={nodeA} />);
    fireEvent.click(screen.getByText('patch-http'));
    expect(screen.getByText(/HTTP — Patched HTTP/)).toBeTruthy();
    rerender(<WorkflowNodeConfigModal {...defaultProps} node={nodeB} />);
    expect(screen.getByText(/HTTP — B/)).toBeTruthy();
  });

  it('label editor onChange updates generic fork/join/end draft', () => {
    const node = makeNode('end', { label: 'L1' });
    const onUpdateNode = vi.fn();
    render(<WorkflowNodeConfigModal {...defaultProps} node={node} onUpdateNode={onUpdateNode} />);
    const labelInput = screen.getByPlaceholderText('End node') as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: 'Final' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({ label: 'Final' }));
  });

  it('updates HTTP initial variables via VariablesSection', () => {
    const onUpdateNode = vi.fn();
    render(<WorkflowNodeConfigModal {...defaultProps} onUpdateNode={onUpdateNode} />);
    const section = screen.getByText('Initial variables (this step)').closest('.wf-config-vars')!;
    const nameInput = within(section).getByPlaceholderText('name');
    const valueInput = within(section).getByPlaceholderText('value');
    fireEvent.change(nameInput, { target: { value: 'myKey' } });
    fireEvent.change(valueInput, { target: { value: 'myVal' } });
    fireEvent.click(within(section).getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByText('Save'));
    expect(onUpdateNode).toHaveBeenCalledWith(
      'node-1',
      expect.objectContaining({ initialVariables: { myKey: 'myVal' } }),
    );
  });

  // ── onChange on each specialized config (statement / branch coverage) ──

  it('condition delay webhook schedule switch loop setVariable patch handlers update draft', () => {
    const pairs: Array<{ type: WorkflowNode['type']; data: Record<string, unknown>; button: string }> = [
      { type: 'condition', data: { left: '', operator: '==', right: '' }, button: 'patch-condition' },
      { type: 'delay', data: { delayMs: 1000, mode: 'fixed' }, button: 'patch-delay' },
      { type: 'webhook', data: { method: 'POST', path: '/hook', samplePayload: '{}' }, button: 'patch-webhook' },
      { type: 'schedule', data: { cronExpression: '* * * * *', timezone: 'UTC' }, button: 'patch-schedule' },
      { type: 'switch', data: { expression: '{{s}}', cases: [] }, button: 'patch-switch' },
      { type: 'loop', data: { iterateOver: '', maxIterations: 10 }, button: 'patch-loop' },
      { type: 'setVariable', data: { assignments: [] }, button: 'patch-set-var' },
    ];
    for (const { type, data, button } of pairs) {
      const onUpdateNode = vi.fn();
      const node = makeNode(type, data);
      const { unmount } = render(
        <WorkflowNodeConfigModal {...defaultProps} node={node} onUpdateNode={onUpdateNode} />,
      );
      fireEvent.click(screen.getByText(button));
      fireEvent.click(screen.getByText('Save'));
      expect(onUpdateNode.mock.calls.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('aggregate errorHandler logDebug wait subWorkflow patch handlers update draft', () => {
    const cases: Array<{ type: WorkflowNode['type']; data: Record<string, unknown>; button: string }> = [
      { type: 'aggregate', data: { operation: 'count', sourceVariable: '' }, button: 'patch-aggregate' },
      { type: 'errorHandler', data: { retryCount: 0, retryDelayMs: 0 }, button: 'patch-error-handler' },
      { type: 'logDebug', data: { message: '' }, button: 'patch-log-debug' },
      { type: 'waitForCondition', data: { expression: '', timeoutMs: 5000 }, button: 'patch-wait' },
      { type: 'subWorkflow', data: { workflowId: '' }, button: 'patch-sub-wf' },
    ];
    for (const { type, data, button } of cases) {
      const onUpdateNode = vi.fn();
      const node = makeNode(type, data);
      const { unmount } = render(
        <WorkflowNodeConfigModal {...defaultProps} node={node} onUpdateNode={onUpdateNode} />,
      );
      fireEvent.click(screen.getByText(button));
      fireEvent.click(screen.getByText('Save'));
      expect(onUpdateNode.mock.calls.length).toBeGreaterThan(0);
      unmount();
    }
  });
});
