/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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
  const _mockOnSaveScenario = vi.fn();
  const _mockOnDeleteScenario = vi.fn();
  const _mockOnLoadScenario = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
