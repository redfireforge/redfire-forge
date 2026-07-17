/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import MultiWebhookTestingPanel, { type WebhookScenario } from './MultiWebhookTestingPanel';
import { Workflow, CorrelationWaitNodeData } from '../../workflow/types/workflow';

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
function _createWorkflowWithSwitch(): Workflow {
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
  const _mockOnLoadScenario = vi.fn();

  beforeEach(() => {
    resetAllMocks();
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

  it('shows waiting message when running but no paused nodes', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={true}
        onFireWebhook={mockOnFireWebhook}
      />
    );
    await act(async () => {});

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

  it('does not show batch fire button when only one node is paused', async () => {
    const workflow = createTestWorkflow([{ label: 'Wait' }]);

    render(
      <MultiWebhookTestingPanel
        workflow={workflow}
        isRunning={true}
        onFireWebhook={mockOnFireWebhook}
      />
    );
    await act(async () => {});

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

});
