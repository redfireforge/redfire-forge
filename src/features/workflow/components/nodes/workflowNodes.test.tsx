/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactFlowProvider } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

// Mock the useNodeBase hook
vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: null,
    stateClass: '',
    debugStep: null,
    handleConfigure: vi.fn(),
    handleDelete: vi.fn(),
  }),
}));

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

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <ReactFlowProvider>
      {ui}
    </ReactFlowProvider>
  );
}

function createNodeProps<T>(data: T): NodeProps<any> {
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
  });

  describe('ConditionNode', () => {
    it('renders with expression', () => {
      renderWithProvider(
        <ConditionNode {...createNodeProps({ label: 'Check', expression: 'status === 200' })} />
      );
      expect(screen.getByText('Check')).toBeInTheDocument();
    });

    it('renders with default label when empty', () => {
      renderWithProvider(
        <ConditionNode {...createNodeProps({ label: '', expression: '' })} />
      );
      expect(screen.getByText('If/Else')).toBeInTheDocument();
    });
  });

  describe('SwitchNode', () => {
    it('renders with cases', () => {
      renderWithProvider(
        <SwitchNode {...createNodeProps({ label: 'Route', expression: 'status', cases: [{ value: '200', label: '' }, { value: '404', label: '' }] })} />
      );
      expect(screen.getByText('Route')).toBeInTheDocument();
    });

    it('renders with default label', () => {
      renderWithProvider(
        <SwitchNode {...createNodeProps({ label: '', expression: '', cases: [] })} />
      );
      expect(screen.getByText('Switch')).toBeInTheDocument();
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
  });

  describe('ErrorHandlerNode', () => {
    it('renders with label', () => {
      renderWithProvider(
        <ErrorHandlerNode {...createNodeProps({ label: 'Handle Error', errorFilter: 'all', retryCount: 3, retryDelayMs: 1000 })} />
      );
      expect(screen.getByText('Handle Error')).toBeInTheDocument();
    });

    it('shows default label', () => {
      renderWithProvider(
        <ErrorHandlerNode {...createNodeProps({ label: '', errorFilter: 'all', retryCount: 0, retryDelayMs: 0 })} />
      );
      expect(screen.getByText('Error Handler')).toBeInTheDocument();
    });
  });

  describe('HttpStepNode', () => {
    it('renders with scenario', () => {
      renderWithProvider(
        <HttpStepNode {...createNodeProps({ 
          label: 'Get User', 
          scenario: { 
            id: 'sc-1', 
            name: 'Get User', 
            method: 'GET', 
            url: 'https://api.example.com/users/1', 
            headers: [], 
            body: '', 
            bodyType: 'none' 
          } 
        })} />
      );
      expect(screen.getByText('Get User')).toBeInTheDocument();
    });
  });

  describe('WebhookTriggerNode', () => {
    it('renders with label', () => {
      renderWithProvider(
        <WebhookTriggerNode {...createNodeProps({ label: 'Webhook', webhookId: 'wh-1', path: '/hook' })} />
      );
      expect(screen.getByText('Webhook')).toBeInTheDocument();
    });
  });

  describe('ScheduleTriggerNode', () => {
    it('renders with label', () => {
      renderWithProvider(
        <ScheduleTriggerNode {...createNodeProps({ label: 'Daily Run', schedule: '0 0 * * *' })} />
      );
      expect(screen.getByText('Daily Run')).toBeInTheDocument();
    });

    it('shows default label', () => {
      renderWithProvider(
        <ScheduleTriggerNode {...createNodeProps({ label: '', schedule: '' })} />
      );
      expect(screen.getByText('Schedule')).toBeInTheDocument();
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
