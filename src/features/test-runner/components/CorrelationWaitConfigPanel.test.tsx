/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
    vi.useFakeTimers();
    mockFetch.mockReset();
    mockClipboard.writeText.mockClear();
    // Default: no paused correlations
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
  });

  afterEach(() => {
    vi.useRealTimers();
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
  });

  describe('wait-for-real mode', () => {
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
        await vi.advanceTimersByTimeAsync(100);
      });

      const curlButton = screen.getByText('curl');
      const btn = curlButton.closest('button');
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

  describe('disabled state', () => {
    it('disables all inputs when disabled prop is true', () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'auto-resume' }}
          onChange={vi.fn()}
          disabled={true}
        />
      );

      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).toBeDisabled();
      });
    });
  });
});
