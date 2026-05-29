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

  describe('wait-for-real — server polling and payloads', () => {
    it('polls /api/correlations on interval while mounted', async () => {
      vi.useFakeTimers();
      try {
        mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [] }) });
        render(
          <CorrelationWaitConfigPanel
            workflow={makeWorkflow()}
            config={{ mode: 'wait-for-real' }}
            onChange={vi.fn()}
          />
        );
        await act(async () => {
          await Promise.resolve();
        });
        const counts = mockFetch.mock.calls.filter(
          ([u]) => typeof u === 'string' && String(u).includes('/api/correlations'),
        ).length;
        expect(counts).toBeGreaterThanOrEqual(1);
        await act(async () => {
          vi.advanceTimersByTime(3000);
          await Promise.resolve();
        });
        const later = mockFetch.mock.calls.filter(
          ([u]) => typeof u === 'string' && String(u).includes('/api/correlations'),
        ).length;
        expect(later).toBeGreaterThan(counts);
      } finally {
        vi.useRealTimers();
      }
    });

    it('treats null correlations from API response as empty', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ correlations: null }) });
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={{ mode: 'wait-for-real' }} onChange={vi.fn()} />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByText('Currently Paused Workflows')).not.toBeInTheDocument();
    });

    it('computes webhook base URL with empty hostname fallback', async () => {
      const hostSpy = vi.spyOn(globalThis.window, 'location', 'get').mockReturnValue({
        ...globalThis.window.location,
        hostname: '',
      } as Location);
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [] }) });
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={{ mode: 'wait-for-real' }} onChange={vi.fn()} />
      );
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3001/api/correlations`);
      });
      hostSpy.mockRestore();
    });

    it('swallows fetch errors when polling correlations', async () => {
      mockFetch.mockRejectedValueOnce(new Error('offline'));
      await act(async () => {
        render(
          <CorrelationWaitConfigPanel
            workflow={makeWorkflow()}
            config={{ mode: 'wait-for-real' }}
            onChange={vi.fn()}
          />
        );
        await Promise.resolve();
      });
      expect(screen.getByRole('heading', { level: 3, name: 'CorrelationWait Behavior' })).toBeInTheDocument();
    });

    it('does not load correlations when server returns non-OK', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ correlations: [{ correlationId: 'x', webhookPath: '/bad' }] }),
      });
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByText('Currently Paused Workflows')).not.toBeInTheDocument();
    });

    it('lists paused workflows and refreshes via button', async () => {
      const paused = {
        correlationId: 'real-cid',
        webhookPath: '/webhooks/callback/webhooks/payment0',
      };
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [paused] }) });
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Currently Paused Workflows')).toBeInTheDocument();
      });
      expect(screen.getByText('real-cid')).toBeInTheDocument();
      mockFetch.mockClear();
      fireEvent.click(screen.getByTitle('Refresh'));
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/correlations'));
      });
    });

    it('disables paused-area refresh until the in-flight correlations fetch completes', async () => {
      const paused = {
        correlationId: 'real-cid',
        webhookPath: '/webhooks/callback/webhooks/payment0',
      };
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [paused] }) });
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={{ mode: 'wait-for-real' }} onChange={vi.fn()} />
      );
      await waitFor(() => screen.getByText('Currently Paused Workflows'));

      let finishHang!: (value: Response) => void;
      const hangPromise = new Promise<Response>((resolve) => {
        finishHang = resolve;
      });
      mockFetch.mockImplementationOnce(() => hangPromise);

      const refreshBtn = screen.getByTitle('Refresh');
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(refreshBtn).toBeDisabled();
      });

      const hangResponse = {
        ok: true as const,
        json: async () => ({ correlations: [paused] }),
      };
      finishHang!(hangResponse as Response);

      await waitFor(() => {
        expect(refreshBtn).not.toBeDisabled();
      });
    });

    it('copies webhook URL via copy button', async () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await act(async () => { fireEvent.click(screen.getByTitle('Copy URL')); });
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3001/webhooks/callback/webhooks/payment0'),
      );
    });

    it('shows payload requirement hints for header and query correlation sources', async () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([
            {
              correlationSource: 'header',
              correlationHeader: 'X-Trace',
              correlationJsonPath: '$.ignored',
            },
            {
              correlationSource: 'query',
              correlationQueryParam: 'traceId',
            },
          ])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await act(async () => {});
      expect(screen.getByText(/header:.*X-Trace/i)).toBeInTheDocument();
      expect(screen.getByText(/query param:.*traceId/i)).toBeInTheDocument();
    });

    it('defaults header and query payload hints when names are omitted', async () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([
            {
              webhookPath: '/hint-h',
              correlationSource: 'header',
              correlationHeader: undefined,
            },
            {
              webhookPath: '/hint-q',
              correlationSource: 'query',
              correlationQueryParam: undefined,
            },
          ])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await act(async () => {});
      expect(screen.getByText(/header:.*X-Correlation-Id/i)).toBeInTheDocument();
      expect(screen.getByText(/query param:\s+correlationId/i)).toBeInTheDocument();
    });

    it('treats undefined correlationSource as body in webhook payload hints', async () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            correlationSource: undefined as unknown as 'body',
          }])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await act(async () => {});
      expect(screen.getByText(/JSONPath:\s*\$\.paymentId/)).toBeInTheDocument();
    });

    it('uses webhookPath that already begins with /webhooks/callback as-is', async () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{ webhookPath: '/webhooks/callback/payments' }])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await act(async () => {});
      expect(screen.getByText(/localhost:3001\/webhooks\/callback\/payments/)).toBeInTheDocument();
    });

    it('prefixes bare webhook path segments for callback URLs', async () => {
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{ webhookPath: 'custom-hook' }])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await act(async () => {});
      expect(screen.getByText(/\/webhooks\/callback\/custom-hook/)).toBeInTheDocument();
    });

    it('paused panel curl generates modal matched to webhook node', async () => {
      const paused = {
        correlationId: 'from-paused',
        webhookPath: '/webhooks/callback/webhooks/payment0',
      };
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [paused] }) });
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={{ mode: 'wait-for-real' }} onChange={vi.fn()} />
      );
      await waitFor(() => screen.getByText('Currently Paused Workflows'));
      const curls = screen.getAllByRole('button', { name: /^curl$/i });
      fireEvent.click(curls[curls.length - 1]);
      await waitFor(() => {
        expect(screen.getByText(/Ready to run!/)).toBeInTheDocument();
      });
      expect(screen.getByRole('heading', { name: /curl Command/ })).toBeInTheDocument();
    });

    it('primary row curl with matching pause skips placeholder banner', async () => {
      const paused = {
        correlationId: 'cid-live',
        webhookPath: '/webhooks/callback/webhooks/payment0',
      };
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [paused] }) });
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={{ mode: 'wait-for-real' }} onChange={vi.fn()} />
      );
      await waitFor(() => screen.getByText(/cid-live/));
      const btn = screen.getAllByTitle(/actual correlation ID/i)[0];
      fireEvent.click(btn);
      await waitFor(() => {
        expect(screen.getByText(/Ready to run!/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/No active correlation ID yet/)).not.toBeInTheDocument();
    });
  });

  describe('curl modal interactions', () => {
    async function openPlaceholderModalFromRow(): Promise<void> {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [] }) });
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={{ mode: 'wait-for-real' }} onChange={vi.fn()} />
      );
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      fireEvent.click(screen.getAllByRole('button', { name: /^curl$/i })[0]);
    }

    it('shows placeholder hint when correlation id is synthetic', async () => {
      await openPlaceholderModalFromRow();
      expect(screen.getByText(/No active correlation ID yet/)).toBeInTheDocument();
      expect(screen.getByText(FIXED_UUID)).toBeInTheDocument();
    });

    it('closes modal on overlay click', async () => {
      await openPlaceholderModalFromRow();
      fireEvent.click(document.querySelector('.wf-curl-modal-overlay') as HTMLElement);
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /curl Command/ })).not.toBeInTheDocument();
      });
    });

    it('closes modal via header X and footer Close', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [] }) });
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={{ mode: 'wait-for-real' }} onChange={vi.fn()} />
      );
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      fireEvent.click(screen.getAllByRole('button', { name: /^curl$/i })[0]);
      fireEvent.click(document.querySelector('.wf-curl-modal-close') as HTMLButtonElement);
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /curl Command/ })).not.toBeInTheDocument();
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [] }) });
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={{ mode: 'wait-for-real' }} onChange={vi.fn()} />
      );
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      fireEvent.click(screen.getAllByRole('button', { name: /^curl$/i })[0]);
      fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /curl Command/ })).not.toBeInTheDocument();
      });
    });

    it('copies curl command and shows Copied feedback with timed reset', async () => {
      await openPlaceholderModalFromRow();
      const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i });
      vi.useFakeTimers();
      try {
        fireEvent.click(copyBtn);
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining("curl -X POST 'http://localhost:3001"),
        );
        expect(screen.getByText('Copied!')).toBeInTheDocument();
        await act(async () => {
          vi.advanceTimersByTime(2100);
          await Promise.resolve();
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('builds curl with header correlation placement', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [] }) });
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            correlationSource: 'header',
            correlationHeader: 'X-Req-Corr',
          }])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      fireEvent.click(screen.getAllByRole('button', { name: /^curl$/i })[0]);
      const modalCode = document.querySelector('.wf-curl-modal-code code');
      expect(modalCode?.textContent).toContain("'X-Req-Corr:");
      expect(modalCode?.textContent).toContain(FIXED_UUID);
    });

    it('builds curl with query-param correlation placement', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [] }) });
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            correlationSource: 'query',
            correlationQueryParam: 'rid',
          }])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      fireEvent.click(screen.getAllByRole('button', { name: /^curl$/i })[0]);
      const modalCode = document.querySelector('.wf-curl-modal-code code');
      expect(modalCode?.textContent).toContain(`?rid=${FIXED_UUID}`);
    });

    it('builds curl with default correlation header/query names when unspecified', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [] }) });
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([
            {
              webhookPath: '/alpha',
              correlationSource: 'header',
              correlationHeader: undefined,
              extractVariables: [],
            },
            {
              webhookPath: '/beta',
              correlationSource: 'query',
              correlationQueryParam: undefined,
              extractVariables: [],
            },
          ])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      fireEvent.click(screen.getAllByRole('button', { name: /^curl$/i })[0]);
      let modalCode = document.querySelector('.wf-curl-modal-code code');
      expect(modalCode?.textContent).toContain("'X-Correlation-Id:");
      fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /curl Command/ })).not.toBeInTheDocument();
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [] }) });
      const curlAfter = screen.getAllByRole('button', { name: /^curl$/i });
      fireEvent.click(curlAfter[1]);
      await waitFor(() => {
        modalCode = document.querySelector('.wf-curl-modal-code code');
        expect(modalCode?.textContent).toContain(`?correlationId=${FIXED_UUID}`);
      });
    });

    it('builds nested JSON body in curl preview for correlated paths', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ correlations: [] }) });
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{
            correlationJsonPath: '$.parent.child.payId',
            extractVariables: [{ name: 'midStatus', jsonPath: '$.level.mid.state' }],
          }])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      fireEvent.click(screen.getAllByRole('button', { name: /^curl$/i })[0]);
      const modalCode = document.querySelector('.wf-curl-modal-code code');
      expect(modalCode?.textContent).toContain('"parent":');
      expect(modalCode?.textContent).toContain(FIXED_UUID);
    });

    it('modal alternate paused picker matches bare webhook path segments', async () => {
      const fullPath = '/webhooks/callback/bareHookSeg';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          correlations: [
            { correlationId: 'bare-a', webhookPath: fullPath },
            { correlationId: 'bare-b', webhookPath: fullPath },
          ],
        }),
      });
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{ webhookPath: 'bareHookSeg' }])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await waitFor(() => screen.getByText('Currently Paused Workflows'));
      fireEvent.click(screen.getAllByTitle(/actual correlation ID/i)[0]);
      expect(screen.getByText(/Other paused workflows:/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /bare-b/ }));
      await waitFor(() => {
        expect(document.querySelector('.wf-curl-modal-code code')?.textContent).toContain('bare-b');
      });
    });

    it('shows other paused correlations for callback-prefixed webhook paths inside modal picker', async () => {
      const path = '/webhooks/callback/express';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          correlations: [
            { correlationId: 'one-e', webhookPath: path },
            { correlationId: 'two-e', webhookPath: path },
          ],
        }),
      });
      render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow([{ webhookPath: path }])}
          config={{ mode: 'wait-for-real' }}
          onChange={vi.fn()}
        />
      );
      await waitFor(() => screen.getByText('Currently Paused Workflows'));
      fireEvent.click(screen.getAllByTitle(/actual correlation ID/i)[0]);
      expect(screen.getByText(/Other paused workflows:/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /two-e/ }));
      await waitFor(() => {
        expect(document.querySelector('.wf-curl-modal-code code')?.textContent).toContain('two-e');
      });
    });

    it('offers switching between multiple paused correlations for same path', async () => {
      const path = '/webhooks/callback/webhooks/payment0';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          correlations: [
            { correlationId: 'first-id', webhookPath: path },
            { correlationId: 'second-id', webhookPath: path },
          ],
        }),
      });
      render(
        <CorrelationWaitConfigPanel workflow={makeWorkflow()} config={{ mode: 'wait-for-real' }} onChange={vi.fn()} />
      );
      await waitFor(() => screen.getByText('Currently Paused Workflows'));
      fireEvent.click(screen.getAllByTitle(/actual correlation ID/i)[0]);
      expect(screen.getByText(/Other paused workflows:/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /second-id/ }));
      await waitFor(() => {
        expect(document.querySelector('.wf-curl-modal-code code')?.textContent).toContain('second-id');
      });
    });
  });
  describe('disabled state extended', () => {
    it('disables synthetic delay inputs when disabled', () => {
      const { container } = render(
        <CorrelationWaitConfigPanel
          workflow={makeWorkflow()}
          config={{
            mode: 'synthetic-inject',
            mockPayloads: { 'cw-0': {} },
            syntheticDelayMs: 1,
            syntheticJitterMs: 2,
          }}
          disabled
          onChange={vi.fn()}
        />
      );
      const timing = container.querySelector('.wf-runner-correlation-timing');
      expect(timing).toBeTruthy();
      const spins = within(timing!).getAllByRole('spinbutton');
      spins.forEach((el) => {
        expect(el).toBeDisabled();
      });
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
