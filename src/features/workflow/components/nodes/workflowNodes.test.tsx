/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Scenario } from '@shared/types';
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
import _ErrorHandlerNode from './ErrorHandlerNode';
import _HttpStepNode from './HttpStepNode';
import _WebhookTriggerNode from './WebhookTriggerNode';
import _ScheduleTriggerNode from './ScheduleTriggerNode';
import _WaitForConditionNode from './WaitForConditionNode';
import { stubScrollIntoView } from '../../../../test-utils/domMocks';

beforeAll(() => {
  stubScrollIntoView();
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
function _miniScenario(partial: Partial<Scenario> = {}): Scenario {
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

});
