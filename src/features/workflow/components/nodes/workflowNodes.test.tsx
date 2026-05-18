/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Scenario } from '../../../../shared/types';
import type { HttpNodeData } from '../../types/workflow';
import { ReactFlowProvider } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

const { mockOpenStepDetail } = vi.hoisted(() => ({
  mockOpenStepDetail: vi.fn(),
}));

// Mock the useNodeBase hook - stores latest mock values for test manipulation
const mockNodeBaseState = {
  rs: null as { state?: string; error?: string; responseDetail?: string; statusCode?: number; responseTimeMs?: number } | null,
  stateClass: '',
  debugStep: null as string | null,
};

vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    ...mockNodeBaseState,
    handleConfigure: vi.fn(),
    handleDelete: vi.fn(),
    openStepDetail: mockOpenStepDetail,
  }),
}));

function setNodeState(rs: typeof mockNodeBaseState.rs, stateClass = '') {
  mockNodeBaseState.rs = rs;
  mockNodeBaseState.stateClass = stateClass;
}

// Mock NodeIcon
vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <span data-testid={`icon-${type}`}>Icon</span>,
  getNodeCategory: (type: string) => `Category for ${type}`,
}));

// Mock NodePausedOverlay
vi.mock('./NodePausedOverlay', () => ({
  NodePausedOverlay: () => null,
}));

// Mock NodeConfigureButton
vi.mock('./NodeConfigureButton', () => ({
  NodeConfigureButton: ({ onClick }: { onClick: () => void; title: string }) => (
    <button data-testid="configure-btn" onClick={onClick}>Configure</button>
  ),
}));

// Import nodes after mocks
import StartNode from './StartNode';
import EndNode from './EndNode';
import DelayNode from './DelayNode';
import ForkNode from './ForkNode';
import JoinNode from './JoinNode';
import ConditionNode from './ConditionNode';
import SwitchNode from './SwitchNode';
import LoopNode from './LoopNode';
import SetVariableNode from './SetVariableNode';
import LogDebugNode from './LogDebugNode';
import AggregateNode from './AggregateNode';
import ErrorHandlerNode from './ErrorHandlerNode';
import HttpStepNode from './HttpStepNode';
import WebhookTriggerNode from './WebhookTriggerNode';
import ScheduleTriggerNode from './ScheduleTriggerNode';
import WaitForConditionNode from './WaitForConditionNode';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  mockOpenStepDetail.mockClear();
  // Reset node state before each test
  setNodeState(null, '');
});

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <ReactFlowProvider>
      {ui}
    </ReactFlowProvider>
  );
}

function createNodeProps<T>(data: T): NodeProps<T> {
  return {
    id: 'test-node',
    type: 'test',
    data,
    selected: false,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    dragHandle: undefined,
    targetPosition: undefined,
    sourcePosition: undefined,
  };
}

/** Minimal Scenario for HTTP node previews in these tests */
function miniScenario(partial: Partial<Scenario> = {}): Scenario {
  return {
    id: 'sc-mini',
    name: 'Mini',
    url: 'https://example.com/path',
    method: 'GET',
    headers: [],
    body: '',
    bodyType: 'none',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...partial,
  };
}

describe('Workflow Nodes', () => {
  describe('StartNode', () => {
    it('renders with default label', () => {
      renderWithProvider(
        <StartNode {...createNodeProps({ label: '' })} />
      );
      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      renderWithProvider(
        <StartNode {...createNodeProps({ label: 'Begin Flow' })} />
      );
      expect(screen.getByText('Begin Flow')).toBeInTheDocument();
    });

    it('shows input variable count', () => {
      renderWithProvider(
        <StartNode {...createNodeProps({ label: 'Start', inputVariables: { a: '1', b: '2' } })} />
      );
      expect(screen.getByText('2 input variables')).toBeInTheDocument();
    });

    it('shows singular for one variable', () => {
      renderWithProvider(
        <StartNode {...createNodeProps({ label: 'Start', inputVariables: { a: '1' } })} />
      );
      expect(screen.getByText('1 input variable')).toBeInTheDocument();
    });

    it('applies selected class when selected', () => {
      const props = createNodeProps({ label: 'Start' });
      props.selected = true;
      const { container } = renderWithProvider(
        <StartNode {...props} />
      );
      expect(container.querySelector('.wf-node-selected')).toBeInTheDocument();
    });

    it('hides variable count when no input variables', () => {
      renderWithProvider(
        <StartNode {...createNodeProps({ label: 'Start', inputVariables: {} })} />
      );
      expect(screen.queryByText(/input variable/)).not.toBeInTheDocument();
    });
  });

  describe('EndNode', () => {
    it('renders with default label', () => {
      renderWithProvider(
        <EndNode {...createNodeProps({ label: '' })} />
      );
      expect(screen.getByText('End')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      renderWithProvider(
        <EndNode {...createNodeProps({ label: 'Finish' })} />
      );
      expect(screen.getByText('Finish')).toBeInTheDocument();
    });

    it('shows completed badge when state is pass', () => {
      setNodeState({ state: 'pass' }, 'wf-node-pass');
      renderWithProvider(
        <EndNode {...createNodeProps({ label: 'End' })} />
      );
      expect(screen.getByText('✓ Completed')).toBeInTheDocument();
    });

    it('shows failed badge when state is fail', () => {
      setNodeState({ state: 'fail', error: 'Something went wrong' }, 'wf-node-fail');
      renderWithProvider(
        <EndNode {...createNodeProps({ label: 'End' })} />
      );
      expect(screen.getByText('✗ Failed')).toBeInTheDocument();
    });

    it('shows error detail when state is fail with responseDetail', () => {
      setNodeState({ state: 'fail', responseDetail: 'Connection refused' }, 'wf-node-fail');
      renderWithProvider(
        <EndNode {...createNodeProps({ label: 'End' })} />
      );
      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });

    it('applies selected class when selected', () => {
      const props = createNodeProps({ label: 'End' });
      props.selected = true;
      const { container } = renderWithProvider(
        <EndNode {...props} />
      );
      expect(container.querySelector('.wf-node-selected')).toBeInTheDocument();
    });
  });

  describe('DelayNode', () => {
    it('renders with fixed delay', () => {
      renderWithProvider(
        <DelayNode {...createNodeProps({ label: 'Wait', mode: 'fixed', delayMs: 1000 })} />
      );
      expect(screen.getByText('Wait')).toBeInTheDocument();
      expect(screen.getByText('1000ms')).toBeInTheDocument();
    });

    it('renders with random delay range', () => {
      renderWithProvider(
        <DelayNode {...createNodeProps({ label: 'Random Wait', mode: 'random', minMs: 500, maxMs: 2000, delayMs: 1000 })} />
      );
      expect(screen.getByText('500–2000ms')).toBeInTheDocument();
    });

    it('renders with default label', () => {
      renderWithProvider(
        <DelayNode {...createNodeProps({ label: '', mode: 'fixed', delayMs: 500 })} />
      );
      expect(screen.getByText('Delay')).toBeInTheDocument();
    });

    it('applies selected class when selected', () => {
      const props = createNodeProps({ label: 'Wait', mode: 'fixed', delayMs: 1000 });
      props.selected = true;
      const { container } = renderWithProvider(
        <DelayNode {...props} />
      );
      expect(container.querySelector('.wf-node-selected')).toBeInTheDocument();
    });

    it('random mode treats missing minMs as 0 when maxMs present', () => {
      renderWithProvider(
        <DelayNode {...createNodeProps({
          label: 'R',
          mode: 'random',
          delayMs: 500,
          maxMs: 2000,
        })} />
      );
      expect(screen.getByText(/0–2000ms/)).toBeInTheDocument();
    });

    it('random mode falls back maxMs to delayMs when maxMs missing', () => {
      renderWithProvider(
        <DelayNode {...createNodeProps({
          label: 'R',
          mode: 'random',
          minMs: 100,
          delayMs: 900,
        })} />
      );
      expect(screen.getByText(/100–900ms/)).toBeInTheDocument();
    });
  });

  describe('ForkNode', () => {
    it('renders with label', () => {
      renderWithProvider(
        <ForkNode {...createNodeProps({ label: 'Parallel Start' })} />
      );
      expect(screen.getByText('Parallel Start')).toBeInTheDocument();
    });

    it('renders with default label', () => {
      renderWithProvider(
        <ForkNode {...createNodeProps({ label: '' })} />
      );
      expect(screen.getByText('Parallel Fork')).toBeInTheDocument();
    });

    it('applies selected class when selected', () => {
      const props = createNodeProps({ label: 'Fork' });
      props.selected = true;
      const { container } = renderWithProvider(
        <ForkNode {...props} />
      );
      expect(container.querySelector('.wf-node-selected')).toBeInTheDocument();
    });
  });

  describe('JoinNode', () => {
    it('renders with label', () => {
      renderWithProvider(
        <JoinNode {...createNodeProps({ label: 'Merge' })} />
      );
      expect(screen.getByText('Merge')).toBeInTheDocument();
    });

    it('renders with default label', () => {
      renderWithProvider(
        <JoinNode {...createNodeProps({ label: '' })} />
      );
      expect(screen.getByText('Join')).toBeInTheDocument();
    });

    it('shows waiting detail when state is running with responseDetail', () => {
      setNodeState({ state: 'running', responseDetail: 'Waiting for 2 branches' }, '');
      renderWithProvider(
        <JoinNode {...createNodeProps({ label: 'Join' })} />
      );
      expect(screen.getByText('Waiting for 2 branches')).toBeInTheDocument();
    });

    it('shows waiting detail when state is pending with responseDetail', () => {
      setNodeState({ state: 'pending', responseDetail: 'Waiting for 3 branches' }, '');
      renderWithProvider(
        <JoinNode {...createNodeProps({ label: 'Join' })} />
      );
      expect(screen.getByText('Waiting for 3 branches')).toBeInTheDocument();
    });

    it('shows joined badge when state is pass', () => {
      setNodeState({ state: 'pass' }, 'wf-node-pass');
      renderWithProvider(
        <JoinNode {...createNodeProps({ label: 'Join' })} />
      );
      expect(screen.getByText('✓ Joined')).toBeInTheDocument();
    });

    it('applies selected class when selected', () => {
      const props = createNodeProps({ label: 'Join' });
      props.selected = true;
      const { container } = renderWithProvider(
        <JoinNode {...props} />
      );
      expect(container.querySelector('.wf-node-selected')).toBeInTheDocument();
    });
  });

  describe('ConditionNode', () => {
    it('renders summary when left and right are both set', () => {
      renderWithProvider(
        <ConditionNode {...createNodeProps({
          label: 'Check',
          left: '{{status}}',
          operator: '==',
          right: '200',
        })}
        />
      );
      expect(screen.getByText('Check')).toBeInTheDocument();
      expect(screen.getByText('{{status}} == 200')).toBeInTheDocument();
    });

    it('shows configure placeholder when left or right missing', () => {
      renderWithProvider(
        <ConditionNode {...createNodeProps({
          label: '',
          left: '{{x}}',
          operator: '>=',
          right: '',
        })}
        />
      );
      expect(screen.getByText('If/Else')).toBeInTheDocument();
      expect(screen.getByText('Configure condition…')).toBeInTheDocument();
    });

    it('shows placeholder when only right is present', () => {
      renderWithProvider(
        <ConditionNode {...createNodeProps({
          label: '',
          left: '',
          operator: '==',
          right: '1',
        })}
        />
      );
      expect(screen.getByText('Configure condition…')).toBeInTheDocument();
    });

    it('applies selected class when selected', () => {
      const props = createNodeProps({
        label: 'C',
        left: 'a',
        operator: '==' as const,
        right: 'b',
      });
      props.selected = true;
      const { container } = renderWithProvider(<ConditionNode {...props} />);
      expect(container.querySelector('.wf-node-selected')).toBeInTheDocument();
    });
  });

  describe('SwitchNode', () => {
    it('renders with cases', () => {
      renderWithProvider(
        <SwitchNode {...createNodeProps({
          label: 'Route',
          expression: 'status',
          cases: [{ id: 'c1', value: '200', label: '' }, { id: 'c2', value: '404', label: '' }],
        })}
        />
      );
      expect(screen.getByText('Route')).toBeInTheDocument();
    });

    it('renders with default label', () => {
      renderWithProvider(
        <SwitchNode {...createNodeProps({ label: '', expression: '', cases: [] })} />
      );
      expect(screen.getByText('Switch')).toBeInTheDocument();
    });

    it('shows singular case wording for one branch', () => {
      renderWithProvider(
        <SwitchNode {...createNodeProps({
          label: 'R',
          expression: 'x',
          cases: [{ id: 'only', value: 'v', label: '' }],
        })}
        />
      );
      expect(screen.getByText('1 case')).toBeInTheDocument();
    });

    it('shows case count when cases exist', () => {
      renderWithProvider(
        <SwitchNode {...createNodeProps({
          label: 'Route',
          expression: 'type',
          cases: [
            { id: 'a', value: 'a', label: '' },
            { id: 'b', value: 'b', label: '' },
            { id: 'c', value: 'c', label: '' },
          ],
        })}
        />
      );
      expect(screen.getByText('3 cases')).toBeInTheDocument();
    });

    it('shows case label over value when label is provided', () => {
      renderWithProvider(
        <SwitchNode {...createNodeProps({
          label: 'R',
          expression: 't',
          cases: [{ id: 'k', value: 'hidden', label: 'Visible' }],
        })}
        />
      );
      expect(screen.getByText('Visible')).toBeInTheDocument();
    });

    it('shows Configure expression fallback when expression empty', () => {
      renderWithProvider(
        <SwitchNode {...createNodeProps({ label: 'S', expression: '', cases: [] })} />
      );
      expect(screen.getByTitle('Configure expression…')).toBeInTheDocument();
    });

    it('shows default handle when cases array is undefined', () => {
      const { container } = renderWithProvider(
        <SwitchNode {...createNodeProps({
          label: 'S',
          expression: 'v',
          cases: undefined as unknown as [],
        })}
        />
      );
      expect(screen.getByText('Default')).toBeInTheDocument();
      expect(container.querySelector('.wf-switch-cases-badge')).toBeNull();
    });

    it('applies selected class when selected', () => {
      const props = createNodeProps({ label: 'Switch', expression: '', cases: [] });
      props.selected = true;
      const { container } = renderWithProvider(
        <SwitchNode {...props} />
      );
      expect(container.querySelector('.wf-node-selected')).toBeInTheDocument();
    });
  });

  describe('LoopNode', () => {
    it('renders with iterations', () => {
      renderWithProvider(
        <LoopNode {...createNodeProps({ label: 'Repeat', iterations: 5, mode: 'count' })} />
      );
      expect(screen.getByText('Repeat')).toBeInTheDocument();
    });

    it('renders default label', () => {
      renderWithProvider(
        <LoopNode {...createNodeProps({ label: '', iterations: 1, mode: 'count' })} />
      );
      expect(screen.getByText('Loop')).toBeInTheDocument();
    });
  });

  describe('SetVariableNode', () => {
    it('renders with variable name', () => {
      renderWithProvider(
        <SetVariableNode {...createNodeProps({ label: 'Set Var', variableName: 'userId', expression: '"123"' })} />
      );
      expect(screen.getByText('Set Var')).toBeInTheDocument();
    });

    it('renders assignment preview and +more for three assignments', () => {
      renderWithProvider(
        <SetVariableNode {...createNodeProps({
          label: 'Set Var',
          assignments: [
            { id: '1', name: 'a', expression: '1' },
            { id: '2', name: 'b', expression: '2' },
            { id: '3', name: 'c', expression: '3' },
          ],
        })} />
      );
      expect(screen.getByText('3 assignments')).toBeInTheDocument();
      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });

    it('uses singular wording for single assignment without +more row', () => {
      renderWithProvider(
        <SetVariableNode {...createNodeProps({
          label: 'SV',
          assignments: [{ id: '1', name: 'x', expression: '1' }],
        })}
        />
      );
      expect(screen.getByText('1 assignment')).toBeInTheDocument();
      expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
    });

    it('shows two previews without +more for exactly two assignments', () => {
      renderWithProvider(
        <SetVariableNode {...createNodeProps({
          label: 'SV',
          assignments: [
            { id: '1', name: 'a', expression: '1' },
            { id: '2', name: 'b', expression: '2' },
          ],
        })}
        />
      );
      expect(screen.getByText('2 assignments')).toBeInTheDocument();
      expect(screen.queryByText(/\+.*more/i)).not.toBeInTheDocument();
    });

    it('hides assignment UI when assignments null', () => {
      const { container } = renderWithProvider(
        <SetVariableNode {...createNodeProps({
          label: 'N',
          assignments: null as unknown as [],
        })}
        />
      );
      expect(container.querySelector('.wf-setvar-badge')).toBeNull();
    });

    it('shows selected styling', () => {
      const props = createNodeProps({
        label: 'SVSel',
        assignments: [{ id: '1', name: 'z', expression: '1' }],
      });
      props.selected = true;
      const { container } = renderWithProvider(<SetVariableNode {...props} />);
      expect(container.querySelector('.wf-node-selected')).toBeTruthy();
    });

    it('hides assignment UI when assignments undefined', () => {
      const { container } = renderWithProvider(
        <SetVariableNode {...createNodeProps({
          label: 'Undef',
          assignments: undefined as unknown as [],
        })}
        />
      );
      expect(container.querySelector('.wf-setvar-badge')).toBeNull();
    });
  });

  describe('LogDebugNode', () => {
    it('renders with message', () => {
      renderWithProvider(
        <LogDebugNode {...createNodeProps({ label: 'Log', message: 'Debug info' })} />
      );
      expect(screen.getByText('Log')).toBeInTheDocument();
    });

    it('shows default label', () => {
      renderWithProvider(
        <LogDebugNode {...createNodeProps({ label: '', message: '' })} />
      );
      expect(screen.getByText('Log/Debug')).toBeInTheDocument();
    });

    it('shows message preview when message exists', () => {
      renderWithProvider(
        <LogDebugNode {...createNodeProps({ label: 'Log', message: 'Request completed' })} />
      );
      expect(screen.getByText(/Request completed/)).toBeInTheDocument();
    });

    it('applies selected class when selected', () => {
      const props = createNodeProps({ label: 'Log', message: '' });
      props.selected = true;
      const { container } = renderWithProvider(
        <LogDebugNode {...props} />
      );
      expect(container.querySelector('.wf-node-selected')).toBeInTheDocument();
    });

    it('shows log level badge', () => {
      renderWithProvider(
        <LogDebugNode {...createNodeProps({ label: 'Log', message: 'test', logLevel: 'warn' })} />
      );
      expect(screen.getByText('Warn')).toBeInTheDocument();
    });

    it('shows snapshot indicator when enabled', () => {
      renderWithProvider(
        <LogDebugNode {...createNodeProps({ label: 'Log', message: 'test', logLevel: 'info', snapshotVariables: true })} />
      );
      expect(screen.getByText(/snapshot/)).toBeInTheDocument();
    });
  });

  describe('AggregateNode', () => {
    it('renders with label', () => {
      renderWithProvider(
        <AggregateNode {...createNodeProps({ label: 'Collect', operation: 'sum' })} />
      );
      expect(screen.getByText('Collect')).toBeInTheDocument();
    });

    it('renders mapping preview and +more for three mappings', () => {
      renderWithProvider(
        <AggregateNode {...createNodeProps({
          label: 'Collect',
          mappings: [
            { id: '1', sourceExpression: 'x', targetVariable: 'y', strategy: 'first' },
            { id: '2', sourceExpression: 'a', targetVariable: 'b', strategy: 'last' },
            { id: '3', sourceExpression: 'm', targetVariable: 'n', strategy: 'sum' },
          ],
        })} />
      );
      expect(screen.getByText('3 mappings')).toBeInTheDocument();
      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });

    it('uses singular wording for single mapping', () => {
      renderWithProvider(
        <AggregateNode {...createNodeProps({
          label: 'Agg',
          mappings: [{ id: '1', sourceExpression: '$.a', targetVariable: 'b', strategy: 'first' }],
        })}
        />
      );
      expect(screen.getByText('1 mapping')).toBeInTheDocument();
    });

    it('two mappings render both lines without trailing +more row', () => {
      renderWithProvider(
        <AggregateNode {...createNodeProps({
          label: 'Two',
          mappings: [
            { id: 'a', sourceExpression: 'x', targetVariable: 'y', strategy: 'first' },
            { id: 'b', sourceExpression: 'q', targetVariable: 'z', strategy: 'sum' },
          ],
        })}
        />
      );
      expect(screen.getByText('2 mappings')).toBeInTheDocument();
      expect(screen.queryByText(/\+\d+ more/)).toBeNull();
    });

    it('hides aggregate UI when mappings null', () => {
      const { container } = renderWithProvider(
        <AggregateNode {...createNodeProps({
          label: 'Null',
          mappings: null as unknown as [],
        })}
        />
      );
      expect(container.querySelector('.wf-aggregate-badge')).toBeNull();
    });

    it('shows selected styling', () => {
      const props = createNodeProps({
        label: 'Sel',
        mappings: [{ id: '1', sourceExpression: 'a', targetVariable: 'b', strategy: 'first' }],
      });
      props.selected = true;
      const { container } = renderWithProvider(<AggregateNode {...props} />);
      expect(container.querySelector('.wf-node-selected')).toBeTruthy();
    });

    it('hides aggregate UI when mappings undefined', () => {
      const { container } = renderWithProvider(
        <AggregateNode {...createNodeProps({
          label: 'Undefined',
          mappings: undefined as unknown as [],
        })}
        />
      );
      expect(container.querySelector('.wf-aggregate-badge')).toBeNull();
    });
  });

  describe('ErrorHandlerNode', () => {
    it('renders with label', () => {
      renderWithProvider(
        <ErrorHandlerNode {...createNodeProps({
          label: 'Handle Error',
          errorFilter: 'all',
          retryCount: 3,
          retryDelayMs: 1000,
          retryBackoff: 'fixed',
          retryTimeoutMs: 0,
          continueOnError: false,
        })}
        />
      );
      expect(screen.getByText('Handle Error')).toBeInTheDocument();
      expect(screen.getByTitle(/Retry ×3 \(fixed 1000ms\)/)).toBeInTheDocument();
    });

    it('shows default label', () => {
      renderWithProvider(
        <ErrorHandlerNode {...createNodeProps({
          label: '',
          errorFilter: 'all',
          retryCount: 0,
          retryDelayMs: 0,
          retryBackoff: 'fixed',
          retryTimeoutMs: 0,
          continueOnError: false,
        })}
        />
      );
      expect(screen.getByText('Error Handler')).toBeInTheDocument();
      expect(screen.getByText('No retry')).toBeInTheDocument();
      expect(screen.getByText(/Catch all/)).toBeInTheDocument();
    });

    it('shows exponential backoff in retry badge', () => {
      renderWithProvider(
        <ErrorHandlerNode {...createNodeProps({
          label: 'EH',
          errorFilter: 'all',
          retryCount: 2,
          retryDelayMs: 500,
          retryBackoff: 'exponential',
          retryTimeoutMs: 0,
          continueOnError: false,
        })}
        />
      );
      expect(screen.getByTitle(/Retry ×2 \(exp 500ms\)/)).toBeInTheDocument();
    });

    it('formats http-error filter label', () => {
      renderWithProvider(
        <ErrorHandlerNode {...createNodeProps({
          label: 'EH',
          errorFilter: 'http-error',
          retryCount: 0,
          retryDelayMs: 0,
          retryBackoff: 'fixed',
          retryTimeoutMs: 0,
          continueOnError: false,
        })}
        />
      );
      expect(screen.getByText(/http error/i)).toBeInTheDocument();
    });

    it('formats assertion-failure filter label', () => {
      renderWithProvider(
        <ErrorHandlerNode {...createNodeProps({
          label: 'EH',
          errorFilter: 'assertion-failure',
          retryCount: 0,
          retryDelayMs: 0,
          retryBackoff: 'fixed',
          retryTimeoutMs: 0,
          continueOnError: false,
        })}
        />
      );
      expect(screen.getByText(/assertion failure/i)).toBeInTheDocument();
    });

    it('formats network-error filter label', () => {
      renderWithProvider(
        <ErrorHandlerNode {...createNodeProps({
          label: 'EH',
          errorFilter: 'network-error',
          retryCount: 0,
          retryDelayMs: 0,
          retryBackoff: 'fixed',
          retryTimeoutMs: 0,
          continueOnError: false,
        })}
        />
      );
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    it('appends continue marker when continueOnError is true', () => {
      renderWithProvider(
        <ErrorHandlerNode {...createNodeProps({
          label: 'EH',
          errorFilter: 'all',
          retryCount: 0,
          retryDelayMs: 0,
          retryBackoff: 'fixed',
          retryTimeoutMs: 0,
          continueOnError: true,
        })}
        />
      );
      expect(screen.getByText(/Catch all · continue/)).toBeInTheDocument();
    });
  });

  describe('HttpStepNode', () => {
    it('uses defaults when scenario is missing', () => {
      const data = { label: 'No Scenario', scenario: undefined } as unknown as HttpNodeData;
      renderWithProvider(<HttpStepNode {...createNodeProps(data)} />);
      expect(screen.getByText('No Scenario')).toBeInTheDocument();
      expect(screen.getByText('GET')).toBeInTheDocument();
    });

    it('renders with scenario', () => {
      renderWithProvider(
        <HttpStepNode {...createNodeProps({
          label: 'Get User',
          scenario: miniScenario({
            id: 'sc-1',
            name: 'Get User',
            url: 'https://api.example.com/users/1',
          }),
        })} />
      );
      expect(screen.getByText('Get User')).toBeInTheDocument();
    });

    it('shows truncated URL ellipsis when URL is longer than 40 chars', () => {
      const longUrl = `https://api.example.com/${'seg/'.repeat(15)}`;
      renderWithProvider(
        <HttpStepNode {...createNodeProps({
          label: 'Req',
          scenario: miniScenario({
            id: 's',
            name: 'Req',
            url: longUrl,
          }),
        })} />
      );
      expect(document.querySelector('.wf-node-url')?.textContent?.startsWith('...')).toBe(true);
    });

    it('pass status opens detail twice from status and Details buttons', () => {
      setNodeState({ state: 'pass', statusCode: 201, responseTimeMs: 33 });
      renderWithProvider(
        <HttpStepNode {...createNodeProps({
          label: 'S',
          scenario: miniScenario({
            name: 'S',
            url: 'https://a.test/x',
          }),
        })} />
      );
      fireEvent.click(screen.getByTitle('Click for full response details'));
      expect(mockOpenStepDetail).toHaveBeenCalledWith('test-node');
      fireEvent.click(screen.getByText('Details'));
      expect(mockOpenStepDetail).toHaveBeenCalledTimes(2);
    });

    it('fail state without error shows generic detail title branch', () => {
      setNodeState({ state: 'fail', statusCode: 0 });
      renderWithProvider(
        <HttpStepNode {...createNodeProps({
          label: 'S',
          scenario: miniScenario({
            name: 'S',
            method: 'DELETE',
            url: 'http://bad',
          }),
        })} />
      );
      expect(screen.getByTitle('Click for details')).toBeInTheDocument();
      fireEvent.click(screen.getByTitle('Click for details'));
      expect(mockOpenStepDetail).toHaveBeenCalledWith('test-node');
    });

    it('shows plural extracts and counts only enabled rows', () => {
      renderWithProvider(
        <HttpStepNode {...createNodeProps({
          label: 'Batch',
          scenario: miniScenario({
            name: 'Batch',
            url: 'https://api.example.com',
            extractions: [
              { name: 'a', source: 'body', expression: '$.a' },
              { name: 'b', source: 'body', expression: '$.b' },
            ],
            dataSource: {
              id: 'ds',
              columns: [],
              rows: [
                { id: '1', values: {}, enabled: true },
                { id: '2', values: {}, enabled: false },
              ],
              source: { type: 'inline' },
            },
          }),
        })}
        />
      );
      expect(screen.getByText('2 extracts')).toBeInTheDocument();
      expect(screen.getByText(/1 row/)).toBeInTheDocument();
    });

    it('shows running spinner when rs state is running', () => {
      setNodeState({ state: 'running' });
      renderWithProvider(
        <HttpStepNode {...createNodeProps({
          label: 'R',
          scenario: miniScenario({ name: 'R', url: '' }),
        })} />
      );
      expect(screen.getByText(/Running/i)).toBeInTheDocument();
    });

    it('shows catalog source badge when sourceType catalog', () => {
      renderWithProvider(
        <HttpStepNode {...createNodeProps({
          label: 'Cat',
          sourceType: 'catalog',
          scenario: miniScenario(),
        })} />
      );
      expect(screen.getByText('CAT')).toBeInTheDocument();
    });

    it('fail state omits timing when responseTimeMs absent', () => {
      setNodeState({ state: 'fail', statusCode: 418 });
      renderWithProvider(
        <HttpStepNode {...createNodeProps({
          label: 'S',
          scenario: miniScenario(),
        })}
        />
      );
      const btn = screen.getByTitle('Click for details');
      expect(btn.textContent).not.toMatch(/ms/);
      fireEvent.click(btn);
      expect(mockOpenStepDetail).toHaveBeenCalled();
    });

    it('uses unknown method color fallback via HEAD verb', () => {
      renderWithProvider(
        <HttpStepNode {...createNodeProps({
          label: 'X',
          scenario: miniScenario({ method: 'HEAD' as unknown as Scenario['method'] }),
        })}
        />
      );
      const badge = document.querySelector('.wf-method-badge') as HTMLElement;
      expect(badge?.style.background).toBeTruthy();
      expect(screen.getByText('HEAD')).toBeInTheDocument();
    });
  });

  describe('WebhookTriggerNode', () => {
    const baseWebhook = {
      label: 'Webhook',
      method: 'POST' as const,
      path: '/hook',
      samplePayload: '{}',
    };

    it('renders with label', () => {
      renderWithProvider(
        <WebhookTriggerNode {...createNodeProps(baseWebhook)} />
      );
      expect(screen.getByText('Webhook')).toBeInTheDocument();
    });

    it('does not render path row when path empty string', () => {
      renderWithProvider(
        <WebhookTriggerNode {...createNodeProps({ ...baseWebhook, label: '', path: '' as unknown as '/hook' })} />
      );
      expect(document.querySelector('.wf-webhook-path')).toBeNull();
    });

    it('shows method beside path when path set', () => {
      renderWithProvider(
        <WebhookTriggerNode {...createNodeProps({ ...baseWebhook, method: 'PUT', path: '/api/x' })} />
      );
      expect(document.querySelector('.wf-webhook-path')?.textContent).toContain('PUT');
      expect(document.querySelector('.wf-webhook-path')?.textContent).toContain('/api/x');
    });

    it('shows singular extract wording', () => {
      renderWithProvider(
        <WebhookTriggerNode {...createNodeProps({
          ...baseWebhook,
          extractVariables: [{ name: 'id', jsonPath: '$.id' }],
        })}
        />
      );
      expect(screen.getByText(/Extracts 1 variable\b/)).toBeInTheDocument();
    });

    it('shows plural extract wording', () => {
      renderWithProvider(
        <WebhookTriggerNode {...createNodeProps({
          ...baseWebhook,
          extractVariables: [{ name: 'a', jsonPath: '$.a' }, { name: 'b', jsonPath: '$.b' }],
        })}
        />
      );
      expect(screen.getByText(/Extracts 2 variables/)).toBeInTheDocument();
    });

    it('omits extracts block when extractVariables property undefined', () => {
      const { container } = renderWithProvider(
        <WebhookTriggerNode {...createNodeProps({
          ...baseWebhook,
          extractVariables: undefined as unknown as undefined,
        })}
        />
      );
      expect(container.textContent ?? '').not.toMatch(/Extracts/);
    });

    it('does not list extracts when array empty', () => {
      renderWithProvider(
        <WebhookTriggerNode {...createNodeProps({ ...baseWebhook, extractVariables: [] })} />
      );
      expect(screen.queryByText(/Extracts/)).toBeNull();
    });

    it('uses default Webhook label when label empty', () => {
      renderWithProvider(
        <WebhookTriggerNode {...createNodeProps({ ...baseWebhook, label: '' })} />
      );
      expect(screen.getByText('Webhook')).toBeInTheDocument();
    });
  });

  describe('ScheduleTriggerNode', () => {
    const baseSchedule = {
      label: 'Cron',
      cronExpression: '0 9 * * *',
      timezone: 'UTC',
    };

    it('renders with label', () => {
      renderWithProvider(
        <ScheduleTriggerNode {...createNodeProps({ ...baseSchedule, label: 'Daily Run' })} />
      );
      expect(screen.getByText('Daily Run')).toBeInTheDocument();
    });

    it('shows default label when label empty', () => {
      renderWithProvider(
        <ScheduleTriggerNode {...createNodeProps({ ...baseSchedule, label: '' })} />
      );
      expect(screen.getByText('Schedule')).toBeInTheDocument();
    });

    it('renders human schedule description block', () => {
      renderWithProvider(
        <ScheduleTriggerNode {...createNodeProps({
          ...baseSchedule,
          scheduleDescription: 'Every morning at nine',
        })} />
      );
      expect(screen.getByText('Every morning at nine')).toBeInTheDocument();
    });

    it('renders cron expression in code', () => {
      renderWithProvider(
        <ScheduleTriggerNode {...createNodeProps({
          ...baseSchedule,
          cronExpression: '15 14 1 * *',
        })} />
      );
      expect(screen.getByText('15 14 1 * *')).toBeInTheDocument();
    });

    it('shows singular variable count label', () => {
      renderWithProvider(
        <ScheduleTriggerNode {...createNodeProps({
          ...baseSchedule,
          inputVariables: { only: '{{x}}' },
        })} />
      );
      expect(screen.getByText('1 variable')).toBeInTheDocument();
    });

    it('hides cron block when cronExpression empty', () => {
      const { container } = renderWithProvider(
        <ScheduleTriggerNode {...createNodeProps({
          ...baseSchedule,
          cronExpression: '',
        })}
        />
      );
      expect(container.querySelector('.wf-schedule-cron')).toBeNull();
    });

    it('omits description block when scheduleDescription absent', () => {
      const { container } = renderWithProvider(
        <ScheduleTriggerNode {...createNodeProps({ ...baseSchedule })} />
      );
      expect(container.querySelector('.wf-schedule-desc')).toBeNull();
    });

    it('shows plural variable count label', () => {
      renderWithProvider(
        <ScheduleTriggerNode {...createNodeProps({
          ...baseSchedule,
          inputVariables: { a: '1', b: '2' },
        })}
        />
      );
      expect(screen.getByText('2 variables')).toBeInTheDocument();
    });
  });

  describe('WaitForConditionNode', () => {
    it('renders with label', () => {
      renderWithProvider(
        <WaitForConditionNode {...createNodeProps({ label: 'Wait Ready', expression: 'ready === true', timeoutMs: 5000, pollIntervalMs: 100 })} />
      );
      expect(screen.getByText('Wait Ready')).toBeInTheDocument();
    });

    it('shows default label', () => {
      renderWithProvider(
        <WaitForConditionNode {...createNodeProps({ label: '', expression: '', timeoutMs: 5000, pollIntervalMs: 100 })} />
      );
      expect(screen.getByText('Wait for Condition')).toBeInTheDocument();
    });
  });
});
