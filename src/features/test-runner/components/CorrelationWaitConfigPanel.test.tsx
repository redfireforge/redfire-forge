/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CorrelationWaitConfigPanel from './CorrelationWaitConfig';
import type { Workflow, CorrelationWaitNodeData } from '../../workflow/types/workflow';

// Mock fetch for polling tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock navigator.clipboard
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

const FIXED_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
vi.stubGlobal('crypto', { randomUUID: () => FIXED_UUID });

function makeWorkflow(correlationNodes: Partial<CorrelationWaitNodeData>[] = [{}]): Workflow {
  const nodes = correlationNodes.map((data, i) => ({
    id: `cw-${i}`,
    type: 'correlationWait' as const,
    position: { x: 0, y: 0 },
    data: {
      label: `Wait for Callback ${i + 1}`,
      correlationIdExpression: '{{paymentId}}',
      webhookPath: `/webhooks/payment${i}`,
      correlationSource: 'body' as const,
      correlationJsonPath: '$.paymentId',
      extractVariables: [
        { name: 'paymentStatus', jsonPath: '$.status' },
        { name: 'transactionId', jsonPath: '$.transactionId' },
      ],
      timeoutMs: 5000,
      ...data,
    } as CorrelationWaitNodeData,
  }));

  return {
    id: 'test-wf',
    name: 'Test Workflow',
    nodes: [
      { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
      ...nodes,
      { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End' } },
    ],
    edges: [],
    variables: {},
  };
}

describe('CorrelationWaitConfigPanel', () => {

  beforeEach(() => {
    mockFetch.mockReset();
    mockClipboard.writeText.mockClear();
    // Default: no paused correlations (response body may be array or object)
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ correlations: [] }) });
  });

  afterEach(() => {
    vi.clearAllTimers();
    cleanup();
  });

  describe('rendering', () => {
    it('renders nothing for workflow without CorrelationWait nodes', () => {
      const workflow: Workflow = {
        id: 'wf',
        name: 'Simple',
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
          { id: 'http', type: 'http', position: { x: 0, y: 0 }, data: { label: 'HTTP' } },
        ],
        edges: [],
        variables: {},
      };

      const { container } = render(
        <CorrelationWaitConfigPanel
          workflow={workflow}
          config={undefined}
          onChange={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders section header for workflow with CorrelationWait nodes', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={undefined}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText('CorrelationWait Behavior')).toBeInTheDocument();
    });

    it('renders all three mode options', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={undefined}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/Auto-Resume/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Synthetic Inject/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Wait for Real Webhook/)).toBeInTheDocument();
    });
  });

  describe('mode selection', () => {
    it('defaults to auto-resume mode', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={undefined}
          onChange={vi.fn()}
        />
      );

      const autoResumeRadio = screen.getByLabelText(/Auto-Resume/) as HTMLInputElement;
      expect(autoResumeRadio.checked).toBe(true);
    });

    it('calls onChange when mode changes', () => {
      const onChange = vi.fn();
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'auto-resume' }}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByLabelText(/Synthetic Inject/));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'synthetic-inject',
      }));
    });

    it('shows synthetic timing config when synthetic-inject selected', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'synthetic-inject', syntheticDelayMs: 1000 }}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText(/Delay.*ms/i)).toBeInTheDocument();
      expect(screen.getByText(/Jitter.*ms/i)).toBeInTheDocument();
    });
  });

  describe('mock payload configuration', () => {
    it('shows mock payload section for auto-resume mode', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText('Mock Webhook Response')).toBeInTheDocument();
    });

    it('shows editable status field for dynamic variables', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
        />
      );

      // paymentStatus should be editable (status is a dynamic field)
      const statusInput = screen.getByPlaceholderText(/completed, failed, pending/);
      expect(statusInput).toBeInTheDocument();
    });

    it('shows payload preview JSON', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText(/Mock Payload:/)).toBeInTheDocument();
      // Should show JSON with paymentId and other fields
      expect(screen.getByText(/"paymentId"/)).toBeInTheDocument();
    });

    it('updates payload when status field changes', () => {
      const onChange = vi.fn();
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'auto-resume' }}
          onChange={onChange}
        />
      );

      const statusInput = screen.getByPlaceholderText(/completed, failed, pending/);
      fireEvent.change(statusInput, { target: { value: 'failed' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        mockPayloads: expect.objectContaining({
          'cw-0': expect.objectContaining({
            status: 'failed',
          }),
        }),
      }));
    });

    it('does not propagate mock payload changes when JSON.parse rejects during sync', () => {
      const onChange = vi.fn();
      const parseSpy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
        throw new SyntaxError('unexpected');
      });
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'auto-resume', mockPayloads: { 'cw-0': { status: 'ok' } } }}
          onChange={onChange}
        />
      );
      fireEvent.change(screen.getByPlaceholderText(/completed, failed, pending/), { target: { value: 'x' } });
      expect(onChange).not.toHaveBeenCalled();
      parseSpy.mockRestore();
    });
  });

  describe('wait-for-real mode', () => {
    it('uses default correlation JSON path in payload hints when body path omitted', async () => {
      await act(async () => {
        render(
          <CorrelationWaitConfigPanel
            workflow={makeWorkflow([{
              correlationSource: 'body',
              correlationJsonPath: undefined,
            }])}
            config={{ mode: 'wait-for-real' }}
            onChange={vi.fn()}
          />
        );
      });
      expect(screen.getByText(/\$\.correlationId/)).toBeInTheDocument();
    });

    it('shows webhook URL info', async () => {
      await act(async () => {
        render(
          <CorrelationWaitConfigPanel
            workflow={makeWorkflow()}
            config={{ mode: 'wait-for-real' }}
            onChange={vi.fn()}
          />
        );
      });

      expect(screen.getAllByText(/POST/).length).toBeGreaterThan(0);
      expect(screen.getByText(/webhooks\/payment0/)).toBeInTheDocument();
    });

    it('shows copy URL button', async () => {
      await act(async () => {
        render(
          <CorrelationWaitConfigPanel
            workflow={makeWorkflow()}
            config={{ mode: 'wait-for-real' }}
            onChange={vi.fn()}
          />
        );
      });

      expect(screen.getByTitle('Copy URL')).toBeInTheDocument();
    });

    it('shows curl button as always enabled with placeholder when no paused workflows', async () => {
      await act(async () => {
        render(
          <CorrelationWaitConfigPanel
            workflow={makeWorkflow()}
            config={{ mode: 'wait-for-real' }}
            onChange={vi.fn()}
          />
        );
      });
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/correlations'));
      });

      const curlButtons = screen.getAllByRole('button', { name: /curl/i });
      const btn = curlButtons[0];
      expect(btn).not.toBeDisabled();
      expect(btn).toHaveAttribute(
        'title',
        'View curl command template (start a workflow to get a real correlation ID)'
      );
    });
  });

  describe('collapsible behavior', () => {
    it('can be collapsed and expanded', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
        />
      );

      const header = screen.getByText('CorrelationWait Behavior');
      
      // Initially expanded
      expect(screen.getByText('Mock Webhook Response')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(header);
      
      // Content should be hidden (summary shown instead)
      expect(screen.queryByText('Mock Webhook Response')).not.toBeInTheDocument();
      expect(screen.getByText(/Auto-Resume/)).toBeInTheDocument();
    });
  });

  describe('additional coverage — badges, modes, payloads', () => {
    it('shows singular badge for one correlation node and plural for two', () => {
      const { rerender } = render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow([{}])} config={{ mode: 'auto-resume' }} onChange={vi.fn()} />
      );
      expect(screen.getByText('1 node')).toBeInTheDocument();

      rerender(
        <CorrelationWaitConfigPanel workflow={makeWorkflow([{}, {}])} config={{ mode: 'auto-resume' }} onChange={vi.fn()} />
      );
      expect(screen.getByText('2 nodes')).toBeInTheDocument();
    });

    it('selecting wait-for-real calls onChange with only mode flag', () => {
      const onChange = vi.fn();
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'auto-resume', mockPayloads: { 'cw-0': { x: 1 } } }}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByLabelText(/Wait for Real Webhook/));
      expect(onChange).toHaveBeenCalledWith({ mode: 'wait-for-real' });
    });

    it('switching back from wait-for-real to synthetic-inject builds mock payloads and timing defaults', async () => {
      const onChange = vi.fn();
      await act(async () => {
        render(
          <CorrelationWaitConfigPanel
            workflow={makeWorkflow()}
            config={{ mode: 'wait-for-real' }}
            onChange={onChange}
          />
        );
      });
      fireEvent.click(screen.getByLabelText(/Synthetic Inject/));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'synthetic-inject',
          mockPayloads: expect.objectContaining({ 'cw-0': expect.any(Object) }),
          syntheticDelayMs: 2000,
          syntheticJitterMs: 500,
        }),
      );
    });

    it('preserves explicit synthetic delay values when leaving wait-for-real mode', async () => {
      const onChange = vi.fn();
      await act(async () => {
        render(
          <CorrelationWaitConfigPanel
            workflow={makeWorkflow()}
            config={{
              mode: 'wait-for-real',
              mockPayloads: { 'cw-0': { k: 1 } },
              syntheticDelayMs: 909,
              syntheticJitterMs: 111,
            }}
            onChange={onChange}
          />
        );
      });
      fireEvent.click(screen.getByLabelText(/Synthetic Inject/));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'synthetic-inject',
          syntheticDelayMs: 909,
          syntheticJitterMs: 111,
        }),
      );
    });

    it('shows mock payload editors for synthetic-inject mode', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'synthetic-inject', syntheticDelayMs: 100, syntheticJitterMs: 10 }}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText('Mock Webhook Response')).toBeInTheDocument();
    });

    it('fires onChange when synthetic delay/jitter numeric inputs change (empty becomes 0)', () => {
      const onChange = vi.fn();
      const { container } = render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{
            mode: 'synthetic-inject',
            mockPayloads: { 'cw-0': {} },
            syntheticDelayMs: 2000,
            syntheticJitterMs: 500,
          }}
          onChange={onChange}
        />
      );
      const timing = container.querySelector('.wf-runner-correlation-timing');
      expect(timing).toBeTruthy();
      const [delayInput, jitterInput] = within(timing!).getAllByRole('spinbutton');
      fireEvent.change(delayInput, { target: { value: '' } });
      fireEvent.change(jitterInput, { target: { value: 'xyz' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ syntheticDelayMs: 0 }));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ syntheticJitterMs: 0 }));
    });

    it('does not propagate mock payload edits when config is undefined', () => {
      const onChange = vi.fn();
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={undefined} onChange={onChange} />
      );
      fireEvent.change(screen.getByPlaceholderText(/completed, failed, pending/), { target: { value: 'pending' } });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('falls back CorrelationWait label when workflow node label is empty', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{ label: '' }])}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
        />
      );
      expect(screen.getAllByText('CorrelationWait').length).toBeGreaterThan(0);
    });

    it('shows no configurable fields hint when extracts are not scenario-like names', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            extractVariables: [{ name: 'sku', jsonPath: '$.sku' }],
          }])}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText(/No configurable fields/)).toBeInTheDocument();
    });

    it('surfaced sample-derived values appear in preview for amount-ish extract names', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            extractVariables: [{ name: 'totalAmount', jsonPath: '$.amt' }],
          }])}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText(/100\.00/)).toBeInTheDocument();
    });

    it('builds nested structure for correlation JSONPath and nested extract paths', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            correlationJsonPath: '$.outer.inner.paymentRef',
            extractVariables: [
              { name: 'deepCurrency', jsonPath: '$.prices.fx.currencyCode' },
              { name: 'msgLine', jsonPath: '$.info.line' },
              { name: 'userEmailAddr', jsonPath: '$.u.mail' },
              { name: 'docTimestamp', jsonPath: '$.meta.when' },
              { name: 'postedAuditDate', jsonPath: '$.audit.postedDate' },
              { name: 'errorDetail', jsonPath: '$.err.reason' },
              { name: 'httpCodeNum', jsonPath: '$.resp.httpCode' },
              { name: 'fullNamePerson', jsonPath: '$.person.displayName' },
              { name: 'homePageUrl', jsonPath: '$.links.site' },
              { name: 'plainField', jsonPath: '$.leaf' },
            ],
          }])}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
        />
      );
      const pre = document.querySelector('.wf-runner-payload-json') as HTMLPreElement | null;
      expect(pre?.textContent).toContain('"{{correlationId}}"');
      expect(pre?.textContent).toMatch(/USD/);
      expect(pre?.textContent).toContain('completed successfully');
      expect(pre?.textContent).toContain('Sample Name');
      expect(pre?.textContent).toContain('https://example.com');
      expect(pre?.textContent).toContain('test@example.com');
      expect(pre?.textContent).toContain('200');
      expect(pre?.textContent).toContain('sample_plainField');
      expect(pre?.textContent).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('re-parents nested dynamic edits when ancestor is non-object JSON value', () => {
      const onChange = vi.fn();
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            extractVariables: [{ name: 'paymentStatus', jsonPath: '$.tier.status.level' }],
          }])}
          config={{
            mode: 'auto-resume',
            mockPayloads: { 'cw-0': { tier: 'blocked' as unknown as Record<string, never> } },
          }}
          onChange={onChange}
        />
      );
      fireEvent.change(screen.getByPlaceholderText(/completed, failed, pending/), { target: { value: 'ok' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        mockPayloads: expect.objectContaining({
          'cw-0': { tier: { status: { level: 'ok' } } },
        }),
      }));
    });

    it('falls back per-node payload when runner mockPayloads omit the node entry', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'auto-resume', mockPayloads: { notThisNode: {} } }}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText(/"paymentId"/)).toBeInTheDocument();
    });

    it('ignores extract variable rows missing name or JSONPath when building mocks', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            extractVariables: [
              { name: 'onlyVar', jsonPath: '' },
              { name: '', jsonPath: '$.oops' },
            ],
          }])}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
        />
      );
      const pre = document.querySelector('.wf-runner-payload-json') as HTMLPreElement;
      expect(pre.textContent).toContain('"{{correlationId}}"');
      expect(pre.textContent).not.toContain('sample_onlyVar');
    });

    it('treats outcome-like extract names as editable dynamic scenario fields', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            extractVariables: [{ name: 'billingOutcomeCode', jsonPath: '$.bc' }],
          }])}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByPlaceholderText(/completed, failed, pending/)).toBeInTheDocument();
    });

    it('shows empty text for dynamic nested path when traversing null intermediary', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            extractVariables: [{ name: 'paymentStatus', jsonPath: '$.tier.status.level' }],
          }])}
          config={{
            mode: 'auto-resume',
            mockPayloads: { 'cw-0': { tier: null } },
          }}
          onChange={vi.fn()}
        />
      );
      const inp = screen.getByPlaceholderText(/completed, failed, pending/) as HTMLInputElement;
      expect(inp.value).toBe('');
    });

    it('collapse toggle button collapses and expands panel', () => {
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={{ mode: 'auto-resume' }} onChange={vi.fn()} />
      );
      fireEvent.click(screen.getByTitle(/collapse/i));
      expect(screen.queryByText('Mock Webhook Response')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTitle(/expand/i));
      expect(screen.getByText('Mock Webhook Response')).toBeInTheDocument();
    });
  });

});
