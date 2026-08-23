/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Scenario } from '@shared/types';
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
import _StartNode from './StartNode';
import _EndNode from './EndNode';
import _DelayNode from './DelayNode';
import _ForkNode from './ForkNode';
import _JoinNode from './JoinNode';
import _ConditionNode from './ConditionNode';
import _SwitchNode from './SwitchNode';
import _LoopNode from './LoopNode';
import _SetVariableNode from './SetVariableNode';
import _LogDebugNode from './LogDebugNode';
import _AggregateNode from './AggregateNode';
import ErrorHandlerNode from './ErrorHandlerNode';
import HttpStepNode from './HttpStepNode';
import WebhookTriggerNode from './WebhookTriggerNode';
import ScheduleTriggerNode from './ScheduleTriggerNode';
import WaitForConditionNode from './WaitForConditionNode';
import { stubScrollIntoView } from '@test-utils/domMocks';

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
