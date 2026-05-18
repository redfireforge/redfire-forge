/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import MultiWebhookTestingPanel, { type WebhookScenario } from './MultiWebhookTestingPanel';
import type { Workflow, CorrelationWaitNodeData } from '../../workflow/types/workflow';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ correlations: [] }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function createTestWorkflow(correlationWaitNodes: Partial<CorrelationWaitNodeData>[] = [{}]): Workflow {
  const nodes = correlationWaitNodes.map((data, idx) => ({
    id: `cw-node-${idx}`,
    type: 'correlationWait' as const,
    position: { x: 100 * idx, y: 0 },
    data: {
      label: data.label || `Wait ${idx + 1}`,
      webhookPath: data.webhookPath || '/webhooks/callback',
      correlationSource: data.correlationSource || 'body',
      correlationJsonPath: data.correlationJsonPath || '$.correlationId',
      extractVariables: data.extractVariables || [],
      ...data,
    } as CorrelationWaitNodeData,
  }));

  const startNode = {
    id: 'start-node',
    type: 'start' as const,
    position: { x: 0, y: 0 },
    data: { label: 'Start' },
  };

  const edges = nodes.map((n, idx) => ({
    id: `edge-${idx}`,
    source: idx === 0 ? 'start-node' : nodes[idx - 1].id,
    target: n.id,
  }));

  return {
    id: 'test-workflow',
    name: 'Test Workflow',
    nodes: [startNode, ...nodes],
    edges,
    variables: {},
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Workflow with CW → downstream switch routed on `approvalDecision`. */
function createWorkflowWithSwitch(): Workflow {
  return {
    id: 'test-switch-wf',
    name: 'Approval Workflow',
    nodes: [
      { id: 'start', type: 'start' as const, position: { x: 0, y: 0 }, data: { label: 'Start' } },
      {
        id: 'cw-approval', type: 'correlationWait' as const, position: { x: 0, y: 100 },
        data: {
          label: 'Wait for Approval',
          webhookPath: '/webhooks/callback/approval',
          correlationSource: 'body' as const,
          correlationJsonPath: '$.correlationId',
          correlationIdExpression: '{{requestId}}',
          extractVariables: [
            { name: 'approvalDecision', jsonPath: '$.decision' },
            { name: 'approverComment', jsonPath: '$.comment' },
          ],
          timeoutMs: 0,
        } as CorrelationWaitNodeData,
      },
      {
        id: 'switch-decision', type: 'switch' as const, position: { x: 0, y: 200 },
        data: {
          label: 'Route by Decision',
          expression: '{{approvalDecision}}',
          cases: [
            { id: 'approved', value: 'approved', label: 'Approved' },
            { id: 'rejected', value: 'rejected', label: 'Rejected' },
          ],
        },
      },
      { id: 'end', type: 'end' as const, position: { x: 0, y: 300 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'cw-approval' },
      { id: 'e2', source: 'cw-approval', target: 'switch-decision' },
      { id: 'e3', source: 'switch-decision', target: 'end', sourceHandle: 'case-approved' },
      { id: 'e4', source: 'switch-decision', target: 'end', sourceHandle: 'case-rejected' },
      { id: 'e5', source: 'switch-decision', target: 'end', sourceHandle: 'default' },
    ],
    variables: {},
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('MultiWebhookTestingPanel', () => {
  const mockOnFireWebhook = vi.fn().mockResolvedValue(undefined);
  const mockOnSaveScenario = vi.fn();
  const mockOnDeleteScenario = vi.fn();
  const mockOnLoadScenario = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when workflow has no CorrelationWait nodes', () => {
    const workflow: Workflow = {
      id: 'empty',
      name: 'Empty',
      nodes: [{ id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } }],
      edges: [],
      variables: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { container } = render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders panel with title and webhook count', () => {
    const workflow = createTestWorkflow([{ label: 'Payment Callback' }, { label: 'Shipping Callback' }]);

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    expect(screen.getByText('Multi-Webhook Testing')).toBeInTheDocument();
    expect(screen.getByText('2 webhooks')).toBeInTheDocument();
  });

  it('displays all CorrelationWait nodes in order', () => {
    const workflow = createTestWorkflow([
      { label: 'First Wait' },
      { label: 'Second Wait' },
      { label: 'Third Wait' },
    ]);

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    expect(screen.getByText('First Wait')).toBeInTheDocument();
    expect(screen.getByText('Second Wait')).toBeInTheDocument();
    expect(screen.getByText('Third Wait')).toBeInTheDocument();
  });

  it('shows waiting message when running but no paused nodes', () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={true}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    expect(screen.getByText(/Waiting for workflow to pause/)).toBeInTheDocument();
  });

  it('renders save scenario button when onSaveScenario provided', () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        onSaveScenario={mockOnSaveScenario}
      />
    );

    expect(screen.getByText('Save Scenario')).toBeInTheDocument();
  });

  it('opens save scenario modal when clicking save button', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        onSaveScenario={mockOnSaveScenario}
      />
    );

    await user.click(screen.getByText('Save Scenario'));

    expect(screen.getByText('Save Webhook Scenario')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Happy Path/)).toBeInTheDocument();
  });

  it('calls onSaveScenario when saving with valid name', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        onSaveScenario={mockOnSaveScenario}
      />
    );

    await user.click(screen.getByText('Save Scenario'));
    await user.type(screen.getByPlaceholderText(/Happy Path/), 'My Test Scenario');

    const modalFooter = document.querySelector('.mwt-modal-footer');
    const saveButton = modalFooter?.querySelector('.mwt-btn-primary') as HTMLButtonElement;
    await user.click(saveButton);

    expect(mockOnSaveScenario).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Test Scenario' })
    );
  });

  it('disables save button when name is empty', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        onSaveScenario={mockOnSaveScenario}
      />
    );

    await user.click(screen.getByText('Save Scenario'));

    const modalFooter = document.querySelector('.mwt-modal-footer');
    const saveButton = modalFooter?.querySelector('.mwt-btn-primary');
    expect(saveButton).toBeDisabled();
  });

  it('displays saved scenarios list', () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const scenarios: WebhookScenario[] = [
      { id: '1', name: 'Happy Path', payloads: [], createdAt: 1000 },
      { id: '2', name: 'Error Case', payloads: [], createdAt: 2000 },
    ];

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        scenarios={scenarios}
      />
    );

    expect(screen.getByText('Saved Scenarios')).toBeInTheDocument();
    expect(screen.getByText('Happy Path')).toBeInTheDocument();
    expect(screen.getByText('Error Case')).toBeInTheDocument();
  });

  it('calls onDeleteScenario when clicking delete button', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();
    const scenarios: WebhookScenario[] = [
      { id: 'to-delete', name: 'Delete Me', payloads: [], createdAt: 1000 },
    ];

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        scenarios={scenarios}
        onDeleteScenario={mockOnDeleteScenario}
      />
    );

    const deleteButtons = document.querySelectorAll('.mwt-btn-danger');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(deleteButtons[0] as HTMLButtonElement);

    expect(mockOnDeleteScenario).toHaveBeenCalledWith('to-delete');
  });

  it('renders refresh button', () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    expect(screen.getByTitle('Refresh paused workflows')).toBeInTheDocument();
  });

  it('shows node cards with pending status indicator', () => {
    const workflow = createTestWorkflow([{ label: 'Wait Node' }]);

    const { container } = render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    const pendingDot = container.querySelector('.mwt-status-pending');
    expect(pendingDot).toBeInTheDocument();
  });

  it('closes modal when clicking cancel', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        onSaveScenario={mockOnSaveScenario}
      />
    );

    await user.click(screen.getByText('Save Scenario'));
    expect(screen.getByText('Save Webhook Scenario')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Save Webhook Scenario')).not.toBeInTheDocument();
  });

  it('closes modal when clicking overlay', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        onSaveScenario={mockOnSaveScenario}
      />
    );

    await user.click(screen.getByText('Save Scenario'));
    expect(screen.getByText('Save Webhook Scenario')).toBeInTheDocument();

    const overlay = document.querySelector('.mwt-modal-overlay');
    if (overlay) {
      await user.click(overlay);
    }

    expect(screen.queryByText('Save Webhook Scenario')).not.toBeInTheDocument();
  });

  it('does not show batch fire button when only one node is paused', () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={true}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    expect(screen.queryByText(/Fire All Paused/)).not.toBeInTheDocument();
  });

  it('expands card and shows fire button when node is paused', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        correlations: [{
          correlationId: 'test-corr',
          webhookPath: '/webhooks/callback',
          pausedAt: Date.now(),
          pausedNodeId: 'cw-node-0',
        }],
      }),
    });

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={true}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Fire Webhook')).toBeInTheDocument();
    });

    const corrValues = screen.getAllByText('test-corr');
    expect(corrValues.length).toBeGreaterThanOrEqual(1);
  });

  it('displays error message and allows dismissal', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        correlations: [{
          correlationId: 'test-corr',
          webhookPath: '/webhooks/callback',
          pausedAt: Date.now(),
          pausedNodeId: 'cw-node-0',
        }],
      }),
    });

    const failingFireWebhook = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={true}
        onFireWebhook={failingFireWebhook}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Fire Webhook')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Fire Webhook'));

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    const dismissBtn = screen.getByRole('button', { name: /Dismiss error/ });
    await user.click(dismissBtn);

    expect(screen.queryByText(/Network error/)).not.toBeInTheDocument();
  });

  it('toggles card expand/collapse on click', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait Node' }]);
    const user = userEvent.setup();

    const { container } = render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    const cardHeader = container.querySelector('.mwt-card-header');
    expect(cardHeader).toBeInTheDocument();

    await user.click(cardHeader!);
    expect(container.querySelector('.mwt-card-body')).toBeInTheDocument();

    await user.click(cardHeader!);
    expect(container.querySelector('.mwt-card-body')).not.toBeInTheDocument();
  });

  it('shows webhook path in card header', () => {
    const workflow = createTestWorkflow([{ label: 'Payment CB', webhookPath: '/webhooks/callback/payments' }]);

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    expect(screen.getByText('/webhooks/callback/payments')).toBeInTheDocument();
  });

  it('shows timeline dots for multiple nodes', () => {
    const workflow = createTestWorkflow([
      { label: 'Wait A' },
      { label: 'Wait B' },
      { label: 'Wait C' },
    ]);

    const { container } = render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    const timelineDots = container.querySelectorAll('.mwt-timeline-dot');
    expect(timelineDots).toHaveLength(3);
  });

  it('validates JSON in payload editor', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    const { container } = render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
      />
    );

    const cardHeader = container.querySelector('.mwt-card-header');
    await user.click(cardHeader!);

    const editor = container.querySelector('.mwt-card-editor') as HTMLTextAreaElement;
    expect(editor).toBeInTheDocument();

    await user.clear(editor);
    await user.type(editor, '{{ invalid json');

    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
  });

  describe('Decision Picker', () => {
    it('renders decision picker when downstream switch node exists', async () => {
      const workflow = createWorkflowWithSwitch();
      const user = userEvent.setup();

      const { container } = render(
        <MultiWebhookTestingPanel
          workflow={workflow}
          isRunning={false}
          onFireWebhook={mockOnFireWebhook}
        />
      );

      const cardHeader = container.querySelector('.mwt-card-header');
      await user.click(cardHeader!);

      expect(screen.getByTestId('decision-picker')).toBeInTheDocument();
      expect(screen.getByText('Route by Decision')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('Default (other)')).toBeInTheDocument();
    });

    it('clicking a decision option updates the payload', async () => {
      const workflow = createWorkflowWithSwitch();
      const user = userEvent.setup();

      const { container } = render(
        <MultiWebhookTestingPanel
          workflow={workflow}
          isRunning={false}
          onFireWebhook={mockOnFireWebhook}
        />
      );

      const cardHeader = container.querySelector('.mwt-card-header');
      await user.click(cardHeader!);

      await user.click(screen.getByText('Approved'));

      const editor = container.querySelector('.mwt-card-editor') as HTMLTextAreaElement;
      const payload = JSON.parse(editor.value);
      expect(payload.decision).toBe('approved');
    });

    it('highlights the active decision option', async () => {
      const workflow = createWorkflowWithSwitch();
      const user = userEvent.setup();

      const { container } = render(
        <MultiWebhookTestingPanel
          workflow={workflow}
          isRunning={false}
          onFireWebhook={mockOnFireWebhook}
        />
      );

      const cardHeader = container.querySelector('.mwt-card-header');
      await user.click(cardHeader!);

      await user.click(screen.getByText('Rejected'));

      const rejectedBtn = screen.getByText('Rejected');
      expect(rejectedBtn.classList.contains('active')).toBe(true);

      const approvedBtn = screen.getByText('Approved');
      expect(approvedBtn.classList.contains('active')).toBe(false);
    });

    it('switching decision options updates the payload correctly', async () => {
      const workflow = createWorkflowWithSwitch();
      const user = userEvent.setup();

      const { container } = render(
        <MultiWebhookTestingPanel
          workflow={workflow}
          isRunning={false}
          onFireWebhook={mockOnFireWebhook}
        />
      );

      const cardHeader = container.querySelector('.mwt-card-header');
      await user.click(cardHeader!);

      await user.click(screen.getByText('Approved'));
      let editor = container.querySelector('.mwt-card-editor') as HTMLTextAreaElement;
      expect(JSON.parse(editor.value).decision).toBe('approved');

      await user.click(screen.getByText('Rejected'));
      editor = container.querySelector('.mwt-card-editor') as HTMLTextAreaElement;
      expect(JSON.parse(editor.value).decision).toBe('rejected');
    });

    it('default option sets a non-matching value', async () => {
      const workflow = createWorkflowWithSwitch();
      const user = userEvent.setup();

      const { container } = render(
        <MultiWebhookTestingPanel
          workflow={workflow}
          isRunning={false}
          onFireWebhook={mockOnFireWebhook}
        />
      );

      const cardHeader = container.querySelector('.mwt-card-header');
      await user.click(cardHeader!);

      const defaultBtn = screen.getByText('Default (other)');
      expect(defaultBtn).not.toBeDisabled();

      await user.click(defaultBtn);
      const editor = container.querySelector('.mwt-card-editor') as HTMLTextAreaElement;
      const payload = JSON.parse(editor.value);
      expect(payload.decision).toBe('other');
      expect(payload.decision).not.toBe('approved');
      expect(payload.decision).not.toBe('rejected');
    });

    it('does not render decision picker for simple workflows without switch', async () => {
      const workflow = createTestWorkflow([{ label: 'Simple Wait' }]);
      const user = userEvent.setup();

      const { container } = render(
        <MultiWebhookTestingPanel
          workflow={workflow}
          isRunning={false}
          onFireWebhook={mockOnFireWebhook}
        />
      );

      const cardHeader = container.querySelector('.mwt-card-header');
      await user.click(cardHeader!);

      expect(container.querySelector('.mwt-decision-picker')).toBeNull();
    });

    it('renders decision picker for downstream condition node', async () => {
      const workflow: Workflow = {
        id: 'wf-cond',
        name: 'Cond',
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
          {
            id: 'cw-step',
            type: 'correlationWait',
            position: { x: 0, y: 50 },
            data: {
              label: 'CW',
              webhookPath: '/webhooks/callback/x',
              correlationSource: 'body',
              correlationJsonPath: '$.correlationId',
              correlationIdExpression: '{{x}}',
              extractVariables: [{ name: 'gate', jsonPath: '$.gate' }],
              timeoutMs: 0,
            } as CorrelationWaitNodeData,
          },
          {
            id: 'cond-1',
            type: 'condition',
            position: { x: 0, y: 150 },
            data: {
              label: 'Is Open',
              left: '{{gate}}',
              operator: '==',
              right: '{{open}}',
            },
          },
          { id: 'end', type: 'end', position: { x: 0, y: 250 }, data: { label: 'End' } },
        ],
        edges: [
          { id: 'e0', source: 'start', target: 'cw-step' },
          { id: 'e1', source: 'cw-step', target: 'cond-1' },
          { id: 'e2', source: 'cond-1', target: 'end' },
        ],
        variables: {},
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const user = userEvent.setup();
      const { container } = render(
        <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
      );

      await user.click(container.querySelector('.mwt-card-header')!);

      expect(screen.getByTestId('decision-picker')).toBeInTheDocument();
      expect(screen.getByText('Is Open')).toBeInTheDocument();
      expect(screen.getByText(/open \(true path\)/)).toBeInTheDocument();
      expect(screen.getByText(/Other value \(false path\)/)).toBeInTheDocument();
    });

    it('uses case value as label when switch case has no label', async () => {
      const workflow: Workflow = {
        id: 'wf-nolabel',
        name: 'No label',
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
          {
            id: 'cw',
            type: 'correlationWait',
            position: { x: 0, y: 50 },
            data: {
              label: 'Wait',
              webhookPath: '/webhooks/callback',
              correlationSource: 'body',
              correlationJsonPath: '$.id',
              correlationIdExpression: '{{id}}',
              extractVariables: [{ name: 'flag', jsonPath: '$.flag' }],
              timeoutMs: 0,
            } as CorrelationWaitNodeData,
          },
          {
            id: 'sw',
            type: 'switch',
            position: { x: 0, y: 150 },
            data: {
              label: '',
              expression: '{{flag}}',
              cases: [{ id: 'a', value: 'alpha-only' }],
            },
          },
          { id: 'end', type: 'end', position: { x: 0, y: 250 }, data: { label: 'End' } },
        ],
        edges: [
          { id: 'e0', source: 'start', target: 'cw' },
          { id: 'e1', source: 'cw', target: 'sw' },
          { id: 'e2', source: 'sw', target: 'end' },
        ],
        variables: {},
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const user = userEvent.setup();
      const { container } = render(
        <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
      );

      await user.click(container.querySelector('.mwt-card-header')!);
      expect(screen.getByRole('button', { name: 'alpha-only' })).toBeInTheDocument();
    });
  });

  it('shows singular webhook count for a single node', () => {
    const workflow = createTestWorkflow([{ label: 'Only' }]);
    render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );
    expect(screen.getByText('1 webhook')).toBeInTheDocument();
    expect(screen.queryByText(/1 webhooks/)).not.toBeInTheDocument();
  });

  it('shows elapsed seconds when paused longer than one second', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(10_000_000);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          correlations: [
            {
              correlationId: 'c1',
              webhookPath: '/webhooks/callback',
              pausedAt: 9_996_400,
              pausedNodeId: 'cw-node-0',
            },
          ],
        }),
    });

    render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={true} onFireWebhook={mockOnFireWebhook} />
    );

    await waitFor(() => {
      expect(screen.getByText(/3\.6s ago/)).toBeInTheDocument();
    });

    nowSpy.mockRestore();
  });

  it('truncates long correlation IDs in the header badge', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const longId = 'abcdefghi-abcdefghi-abcdefghi';
    expect(longId.length).toBeGreaterThan(20);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          correlations: [
            {
              correlationId: longId,
              webhookPath: '/webhooks/callback',
              pausedAt: Date.now(),
              pausedNodeId: 'cw-node-0',
            },
          ],
        }),
    });

    render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={true} onFireWebhook={mockOnFireWebhook} />
    );

    await waitFor(() => {
      expect(screen.getByTitle(longId)).toBeInTheDocument();
    });

    await waitFor(() => {
      const badge = document.querySelector('.mwt-card-corr-badge');
      expect(badge?.textContent).toMatch(/^abcdefghi-abcdefghi-/);
      expect(badge?.textContent).toContain('…');
    });
  });

  it('shows error when firing while correlation ID is missing', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          correlations: [
            {
              correlationId: '',
              webhookPath: '/webhooks/callback',
              pausedAt: Date.now(),
              pausedNodeId: 'cw-node-0',
            },
          ],
        }),
    });

    render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={true} onFireWebhook={mockOnFireWebhook} />
    );

    await waitFor(() => expect(screen.getByText('Fire Webhook')).toBeInTheDocument());
    await user.click(screen.getByText('Fire Webhook'));

    expect(
      await screen.findByText(/No correlation ID for .*Wait.*Workflow may not be paused/)
    ).toBeInTheDocument();
  });

  it('shows generic error when webhook fire rejects with non-Error', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();
    const boom = vi.fn().mockRejectedValue('not-an-error-instance');

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          correlations: [
            {
              correlationId: 'x',
              webhookPath: '/webhooks/callback',
              pausedAt: Date.now(),
              pausedNodeId: 'cw-node-0',
            },
          ],
        }),
    });

    render(<MultiWebhookTestingPanel workflow={workflow} isRunning={true} onFireWebhook={boom} />);

    await waitFor(() => expect(screen.getByText('Fire Webhook')).toBeInTheDocument());
    await user.click(screen.getByText('Fire Webhook'));

    await waitFor(() => {
      expect(screen.getByText('Failed to fire webhook')).toBeInTheDocument();
    });
  });

  it('completes successfully and shows fired message after fire succeeds', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();
    let correlationsReleased = false;

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () =>
          ({
            correlations: correlationsReleased
              ? []
              : [
                  {
                    correlationId: 'ok-corr',
                    webhookPath: '/webhooks/callback',
                    pausedAt: Date.now(),
                    pausedNodeId: 'cw-node-0',
                  },
                ],
          }),
      })
    );

    const releaseAfterFire = vi.fn(async (...args: Parameters<typeof mockOnFireWebhook>) => {
      correlationsReleased = true;
      await mockOnFireWebhook(...args);
    });

    render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={true} onFireWebhook={releaseAfterFire} />
    );

    await waitFor(() => expect(screen.getByText('Fire Webhook')).toBeInTheDocument());
    await user.click(screen.getByText('Fire Webhook'));

    await waitFor(() => {
      expect(screen.getByText('Webhook fired successfully')).toBeInTheDocument();
    });
    expect(mockOnFireWebhook).toHaveBeenCalledWith('cw-node-0', 'ok-corr', expect.any(Object));
  });

  it('marks node completed when paused correlation disappears after refresh', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          correlations: [
            {
              correlationId: 'gone',
              webhookPath: '/webhooks/callback',
              pausedAt: Date.now(),
              pausedNodeId: 'cw-node-0',
            },
          ],
        }),
    }).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ correlations: [] }),
    });

    render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );

    await user.click(screen.getByTitle('Refresh paused workflows'));
    await waitFor(() => expect(screen.getByText('Fire Webhook')).toBeInTheDocument());

    await user.click(screen.getByTitle('Refresh paused workflows'));

    await waitFor(() => {
      expect(screen.getByText('Webhook fired successfully')).toBeInTheDocument();
    });
  });

  it('fires batch for all paused nodes when more than one is paused', async () => {
    const workflow = createTestWorkflow([{ label: 'A' }, { label: 'B' }]);
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          correlations: [
            {
              correlationId: 'c-a',
              webhookPath: '/webhooks/callback',
              pausedAt: Date.now(),
              pausedNodeId: 'cw-node-0',
            },
            {
              correlationId: 'c-b',
              webhookPath: '/webhooks/callback',
              pausedAt: Date.now(),
              pausedNodeId: 'cw-node-1',
            },
          ],
        }),
    });

    render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={true} onFireWebhook={mockOnFireWebhook} />
    );

    const batchBtn = await screen.findByRole('button', { name: /Fire All Paused \(2\)/ });
    await user.click(batchBtn);

    await waitFor(() => expect(mockOnFireWebhook).toHaveBeenCalledTimes(2));
    expect(mockOnFireWebhook).toHaveBeenCalledWith('cw-node-0', 'c-a', expect.any(Object));
    expect(mockOnFireWebhook).toHaveBeenCalledWith('cw-node-1', 'c-b', expect.any(Object));
  });

  it('resolves webhook path prefix for callbacks not already under /webhooks/callback', async () => {
    const wf = createTestWorkflow([
      {
        label: 'Custom Path',
        webhookPath: '/my-hook',
      },
    ]);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          correlations: [
            {
              correlationId: 'p1',
              webhookPath: '/webhooks/callback/my-hook',
              pausedAt: Date.now(),
              pausedNodeId: 'cw-node-0',
            },
          ],
        }),
    });

    render(<MultiWebhookTestingPanel workflow={wf} isRunning={true} onFireWebhook={mockOnFireWebhook} />);

    await waitFor(() => expect(screen.getByText('Fire Webhook')).toBeInTheDocument());
  });

  it('handles non-OK refresh response without throwing', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });

    render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );

    await act(async () => {
      await user.click(screen.getByTitle('Refresh paused workflows'));
    });

    expect(global.fetch).toHaveBeenCalled();
  });

  it('handles fetch errors during refresh without throwing', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

    render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );

    await act(async () => {
      await user.click(screen.getByTitle('Refresh paused workflows'));
    });

    expect(global.fetch).toHaveBeenCalled();
  });

  it('calls onLoadScenario and updates payload textarea when loading a scenario', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();
    const scenario: WebhookScenario = {
      id: 's1',
      name: 'Preset',
      payloads: [{ nodeId: 'cw-node-0', payload: { custom: true, nested: { k: 1 } } }],
      createdAt: 1,
    };

    const { container } = render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        scenarios={[scenario]}
        onLoadScenario={mockOnLoadScenario}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Load' }));
    expect(mockOnLoadScenario).toHaveBeenCalledWith(scenario);

    await user.click(container.querySelector('.mwt-card-header')!);
    const editor = container.querySelector('.mwt-card-editor') as HTMLTextAreaElement;
    expect(JSON.parse(editor.value)).toEqual({ custom: true, nested: { k: 1 } });
  });

  it('saves scenario when pressing Enter in the modal name field', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        onSaveScenario={mockOnSaveScenario}
      />
    );

    await user.click(screen.getByText('Save Scenario'));
    const input = screen.getByPlaceholderText(/Happy Path/);
    await user.type(input, 'Enter Save{Enter}');

    await waitFor(() => {
      expect(mockOnSaveScenario).toHaveBeenCalledWith(expect.objectContaining({ name: 'Enter Save' }));
    });
    expect(screen.queryByText('Save Webhook Scenario')).not.toBeInTheDocument();
  });

  it('closes save modal via header close button', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        onSaveScenario={mockOnSaveScenario}
      />
    );

    await user.click(screen.getByText('Save Scenario'));
    await user.click(document.querySelector('.mwt-modal-close') as HTMLElement);
    expect(screen.queryByText('Save Webhook Scenario')).not.toBeInTheDocument();
  });

  it('keeps modal open when clicking inner modal shell (stop propagation)', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        onSaveScenario={mockOnSaveScenario}
      />
    );

    await user.click(screen.getByText('Save Scenario'));
    await user.click(document.querySelector('.mwt-modal-body') as HTMLElement);
    expect(screen.getByText('Save Webhook Scenario')).toBeInTheDocument();
  });

  it('builds default payload from extractVariables sample helpers (non-body correlation)', async () => {
    const workflow = createTestWorkflow([
      {
        label: 'Rich',
        correlationSource: 'header',
        correlationJsonPath: undefined,
        extractVariables: [
          { name: 'order_status', jsonPath: '$.a' },
          { name: 'myAmount', jsonPath: '$.b' },
          { name: '', jsonPath: '$.skip' },
        ],
      },
    ]);
    const user = userEvent.setup();
    const { container } = render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );

    await user.click(container.querySelector('.mwt-card-header')!);
    const editor = container.querySelector('.mwt-card-editor') as HTMLTextAreaElement;
    const parsed = JSON.parse(editor.value);
    expect(parsed).toEqual({ a: 'completed', b: '100.00' });
  });

  it('shows waiting hint on pending node body when expanded', async () => {
    const workflow = createTestWorkflow([{ label: 'Later' }]);
    const user = userEvent.setup();
    const { container } = render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );

    await user.click(container.querySelector('.mwt-card-header')!);
    expect(screen.getByText('Waiting for workflow to reach this node...')).toBeInTheDocument();
  });

  it('preserves edited payload text when adding another correlation node (payload merge branch)', async () => {
    let workflow = createTestWorkflow([{ label: 'First' }]);
    const user = userEvent.setup();
    const { container, rerender } = render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );

    await user.click(container.querySelector('.mwt-card-header')!);
    const editor = container.querySelector('.mwt-card-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '{"custom": true}' } });

    workflow = createTestWorkflow([{ label: 'First' }, { label: 'Second' }]);
    rerender(<MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />);

    const headers = container.querySelectorAll('.mwt-card-header');
    await user.click(headers[1] as HTMLElement);

    const editors = container.querySelectorAll('.mwt-card-editor');
    expect(editors.length).toBe(2);
    expect((editors[0] as HTMLTextAreaElement).value).toContain('"custom": true');
  });

  it('uses fallback label CorrelationWait when node label omitted', () => {
    const wf: Workflow = {
      id: 'solo-wf',
      name: 'Solo',
      nodes: [
        { id: 'start-node', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        {
          id: 'solo-cw',
          type: 'correlationWait',
          position: { x: 100, y: 0 },
          data: ({
            webhookPath: '/webhooks/callback',
            correlationSource: 'body',
            correlationJsonPath: '$.correlationId',
            correlationIdExpression: '{{cid}}',
            timeoutMs: 0,
          }) as unknown as CorrelationWaitNodeData,
        },
      ],
      edges: [{ id: 'e-solo', source: 'start-node', target: 'solo-cw' }],
      variables: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(<MultiWebhookTestingPanel workflow={wf} isRunning={false} onFireWebhook={mockOnFireWebhook} />);
    expect(screen.getByText('CorrelationWait')).toBeInTheDocument();
  });

  it('covers getSampleValue helper branches via extract variable names', async () => {
    const wf = createTestWorkflow([
      {
        label: 'Samples',
        correlationSource: 'header',
        extractVariables: [
          { name: 'billing_currency_iso', jsonPath: 'payment.currency' },
          { name: 'workflow_state_gate', jsonPath: 'workflow.state_field' },
          { name: 'line_amount_usd', jsonPath: 'line.amount_field' },
          { name: 'user_message_text', jsonPath: 'notice.message_field' },
          { name: 'last_error_reason', jsonPath: 'diag.error_detail' },
          { name: 'response_code_xyz', jsonPath: 'rsp.code_field' },
          { name: 'event_timestamp_ms', jsonPath: 'meta.ts_field' },
          { name: 'uniqueCamelKey', jsonPath: 'misc.other' },
        ],
      },
    ]);
    const user = userEvent.setup();
    const { container } = render(
      <MultiWebhookTestingPanel workflow={wf} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );

    await user.click(container.querySelector('.mwt-card-header')!);
    const parsed = JSON.parse((container.querySelector('.mwt-card-editor') as HTMLTextAreaElement).value);
    expect(parsed.payment.currency).toBe('USD');
    expect(parsed.workflow.state_field).toBe('success');
    expect(parsed.line.amount_field).toBe('100.00');
    expect(parsed.notice.message_field).toBe('Operation completed successfully');
    expect(parsed.diag.error_detail).toBe('');
    expect(parsed.rsp.code_field).toBe('200');
    expect(parsed.meta.ts_field).toMatch(/^\d{4}-/);
    expect(parsed.misc.other).toBe('sample_uniqueCamelKey');
  });

  it('nested correlationJsonPath strips leading $. when building defaults', async () => {
    const wf = createTestWorkflow([
      {
        label: 'Nested',
        correlationSource: 'body',
        correlationJsonPath: '$.outer.inner.cid',
        extractVariables: [],
      },
    ]);
    const user = userEvent.setup();
    const { container } = render(
      <MultiWebhookTestingPanel workflow={wf} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );

    await user.click(container.querySelector('.mwt-card-header')!);
    const parsed = JSON.parse((container.querySelector('.mwt-card-editor') as HTMLTextAreaElement).value);
    expect(parsed.outer.inner.cid).toBe('{{correlationId}}');
  });

  it('handles ifCondition downstream like condition for decision picker', async () => {
    const workflow = {
      id: 'ifc',
      name: 'IfCond',
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        {
          id: 'cw1',
          type: 'correlationWait',
          position: { x: 0, y: 60 },
          data: {
            label: 'CW',
            webhookPath: '/webhooks/callback',
            correlationSource: 'body',
            correlationJsonPath: '$.id',
            correlationIdExpression: '{{id}}',
            extractVariables: [{ name: 'flag', jsonPath: '$.flag' }],
            timeoutMs: 0,
          } as CorrelationWaitNodeData,
        },
        {
          id: 'ifn',
          type: 'condition',
          position: { x: 0, y: 160 },
          data: {
            label: 'If Gate',
            left: '{{flag}}',
            operator: '!=',
            right: 'off',
          },
        },
        { id: 'e', type: 'end', position: { x: 0, y: 260 }, data: { label: 'End' } },
      ],
      edges: [
        { id: 'a', source: 's', target: 'cw1' },
        { id: 'b', source: 'cw1', target: 'ifn' },
        { id: 'c', source: 'ifn', target: 'e' },
      ],
      variables: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as unknown as Workflow;

    const user = userEvent.setup();
    const { container } = render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );

    await user.click(container.querySelector('.mwt-card-header')!);
    expect(screen.getByTestId('decision-picker')).toBeInTheDocument();
    expect(screen.getByText('If Gate')).toBeInTheDocument();
    expect(screen.getByText(/off \(true path\)/)).toBeInTheDocument();
  });

  it('does not show decision picker when switch expression lacks template variable ref', async () => {
    const wf: Workflow = {
      id: 'bad-sw',
      name: 'Bad',
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'S' } },
        {
          id: 'cw1',
          type: 'correlationWait',
          position: { x: 0, y: 50 },
          data: {
            label: 'CW',
            webhookPath: '/webhooks/callback',
            correlationSource: 'body',
            correlationJsonPath: '$.id',
            correlationIdExpression: '{{id}}',
            extractVariables: [{ name: 'flag', jsonPath: '$.f' }],
            timeoutMs: 0,
          } as CorrelationWaitNodeData,
        },
        {
          id: 'sw1',
          type: 'switch',
          position: { x: 0, y: 150 },
          data: {
            label: 'Broken',
            expression: 'literal',
            cases: [{ id: '1', value: 'a', label: 'A' }],
          },
        },
        { id: 'en', type: 'end', position: { x: 0, y: 250 }, data: { label: 'E' } },
      ],
      edges: [
        { id: 'a', source: 's', target: 'cw1' },
        { id: 'b', source: 'cw1', target: 'sw1' },
        { id: 'c', source: 'sw1', target: 'en' },
      ],
      variables: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const user = userEvent.setup();
    const { container } = render(<MultiWebhookTestingPanel workflow={wf} isRunning={false} onFireWebhook={mockOnFireWebhook} />);

    await user.click(container.querySelector('.mwt-card-header')!);
    expect(container.querySelector('[data-testid="decision-picker"]')).toBeNull();
  });

  it('treats missing correlations property as empty on refresh', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(<MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />);

    await act(async () => {
      await user.click(screen.getByTitle('Refresh paused workflows'));
    });

    expect(global.fetch).toHaveBeenCalled();
  });

  it('load scenario ignores payloads for unknown node ids', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);
    const user = userEvent.setup();
    const scenario: WebhookScenario = {
      id: 'mix',
      name: 'Mixed',
      payloads: [
        { nodeId: 'ghost', payload: { only: true } },
        { nodeId: 'cw-node-0', payload: { applied: 1 } },
      ],
      createdAt: 1,
    };

    const { container } = render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={false}
        onFireWebhook={mockOnFireWebhook}
        scenarios={[scenario]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Load' }));
    await user.click(container.querySelector('.mwt-card-header')!);
    const editor = container.querySelector('.mwt-card-editor') as HTMLTextAreaElement;
    expect(JSON.parse(editor.value)).toEqual({ applied: 1 });
  });

  it('matches webhookPath without leading slash against callback prefix URL', async () => {
    const wf = createTestWorkflow([{ label: 'Rel', webhookPath: 'my-hook' }]);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          correlations: [
            {
              correlationId: 'rel',
              webhookPath: '/webhooks/callback/my-hook',
              pausedAt: Date.now(),
              pausedNodeId: 'cw-node-0',
            },
          ],
        }),
    });

    render(<MultiWebhookTestingPanel workflow={wf} isRunning={true} onFireWebhook={mockOnFireWebhook} />);

    await waitFor(() => expect(screen.getByText('Fire Webhook')).toBeInTheDocument());
  });

  it('shows active connectors on timeline when paused steps advance past pending', async () => {
    const workflow = createTestWorkflow([{ label: 'Step A' }, { label: 'Step B' }]);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          correlations: [
            {
              correlationId: 'a',
              webhookPath: '/webhooks/callback',
              pausedAt: Date.now(),
              pausedNodeId: 'cw-node-0',
            },
            {
              correlationId: 'b',
              webhookPath: '/webhooks/callback',
              pausedAt: Date.now(),
              pausedNodeId: 'cw-node-1',
            },
          ],
        }),
    });

    const { container } = render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={true} onFireWebhook={mockOnFireWebhook} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll('.mwt-timeline-line.active').length).toBeGreaterThan(0);
    });
  });

  it('decision quick-picks support nested JSON path from extract variable', async () => {
    const workflow: Workflow = {
      id: 'nest-dec',
      name: 'Nested decision',
      nodes: [
        { id: 'st', type: 'start', position: { x: 0, y: 0 }, data: { label: 'S' } },
        {
          id: 'cwNest',
          type: 'correlationWait',
          position: { x: 0, y: 50 },
          data: {
            label: 'Nest CW',
            webhookPath: '/webhooks/callback',
            correlationSource: 'body',
            correlationJsonPath: '$.cid',
            correlationIdExpression: '{{cid}}',
            extractVariables: [{ name: 'route', jsonPath: '$.outer.inner.kind' }],
            timeoutMs: 0,
          } as CorrelationWaitNodeData,
        },
        {
          id: 'swNest',
          type: 'switch',
          position: { x: 0, y: 150 },
          data: {
            label: 'Pick nested',
            expression: '{{route}}',
            cases: [{ id: 'x', value: 'fast', label: 'FAST' }],
          },
        },
        { id: 'en', type: 'end', position: { x: 0, y: 250 }, data: { label: 'E' } },
      ],
      edges: [
        { id: 'ea', source: 'st', target: 'cwNest' },
        { id: 'eb', source: 'cwNest', target: 'swNest' },
        { id: 'ec', source: 'swNest', target: 'en' },
      ],
      variables: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const user = userEvent.setup();
    const { container } = render(
      <MultiWebhookTestingPanel workflow={workflow} isRunning={false} onFireWebhook={mockOnFireWebhook} />
    );

    await user.click(container.querySelector('.mwt-card-header')!);
    await user.click(screen.getByText('FAST'));

    const editor = container.querySelector('.mwt-card-editor') as HTMLTextAreaElement;
    expect(JSON.parse(editor.value).outer.inner.kind).toBe('fast');
  });
});
