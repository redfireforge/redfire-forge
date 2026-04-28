/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import WorkflowExecutionHistory from './WorkflowExecutionHistory';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockExecutionsResponse(executions: unknown[] = []) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ executions }),
  });
}

function mockCorrelationsResponse(correlations: unknown[] = []) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ correlations, count: correlations.length }),
  });
}

function mockResumeResponse(resumed: boolean) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ resumed, correlationId: 'test-corr', executionId: 'exec-1' }),
  });
}

const samplePaused = [
  {
    correlationId: 'pay_123',
    webhookPath: '/webhooks/callback/payment',
    executionId: 'exec-1',
    workflowId: 'wf-1',
    pausedNodeId: 'cw1',
    pausedAt: Date.now() - 30000, // 30s ago
    timeoutAt: Date.now() + 60000, // 60s from now
    correlationSource: 'body',
  },
  {
    correlationId: 'order_456',
    webhookPath: '/webhooks/callback/order',
    executionId: 'exec-2',
    workflowId: 'wf-2',
    pausedNodeId: 'cw2',
    pausedAt: Date.now() - 120000, // 2m ago
    timeoutAt: 0, // no timeout
    correlationSource: 'header',
  },
];

describe('WorkflowExecutionHistory — Paused Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the paused filter option in dropdown', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse());
    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
    // Should have Paused option
    const options = select.querySelectorAll('option');
    const pausedOption = [...options].find(o => o.textContent?.includes('Paused'));
    expect(pausedOption).toBeTruthy();
  });

  it('shows empty state when no paused correlations', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/correlations')) return mockCorrelationsResponse([]);
      return mockExecutionsResponse();
    });

    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    // Switch to paused filter
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'paused' } });

    await waitFor(() => {
      expect(screen.getByText('No paused workflows')).toBeTruthy();
    });
  });

  it('shows paused correlation cards', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/correlations')) return mockCorrelationsResponse(samplePaused);
      return mockExecutionsResponse();
    });

    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'paused' } });

    await waitFor(() => {
      expect(screen.getByText('pay_123')).toBeTruthy();
      expect(screen.getByText('order_456')).toBeTruthy();
    });
  });

  it('shows correlation details in paused cards', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/correlations')) return mockCorrelationsResponse([samplePaused[0]]);
      return mockExecutionsResponse();
    });

    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'paused' } });

    await waitFor(() => {
      expect(screen.getByText('pay_123')).toBeTruthy();
      expect(screen.getByText('/webhooks/callback/payment')).toBeTruthy();
      expect(screen.getByText('wf-1')).toBeTruthy();
      expect(screen.getByText('exec-1')).toBeTruthy();
    });
  });

  it('shows Resume Manually button for each paused card', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/correlations')) return mockCorrelationsResponse([samplePaused[0]]);
      return mockExecutionsResponse();
    });

    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'paused' } });

    await waitFor(() => {
      const btn = screen.getByTestId('exh-resume-btn');
      expect(btn).toBeTruthy();
      expect(btn.textContent).toContain('Resume Manually');
    });
  });

  it('calls resume API when Resume Manually is clicked', async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/correlations/resume') && opts?.method === 'POST') {
        return mockResumeResponse(true);
      }
      if (url.includes('/api/correlations')) return mockCorrelationsResponse([samplePaused[0]]);
      return mockExecutionsResponse();
    });

    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'paused' } });

    await waitFor(() => {
      expect(screen.getByTestId('exh-resume-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('exh-resume-btn'));

    await waitFor(() => {
      // Should show success message
      expect(screen.getByText(/Workflow resumed successfully/)).toBeTruthy();
    });
  });

  it('shows "No timeout" for entries with timeoutAt = 0', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/correlations')) return mockCorrelationsResponse([samplePaused[1]]);
      return mockExecutionsResponse();
    });

    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'paused' } });

    await waitFor(() => {
      expect(screen.getByText('No timeout')).toBeTruthy();
    });
  });

  it('shows PAUSED badge on each card', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/correlations')) return mockCorrelationsResponse([samplePaused[0]]);
      return mockExecutionsResponse();
    });

    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'paused' } });

    await waitFor(() => {
      expect(screen.getByText('⏸ PAUSED')).toBeTruthy();
    });
  });
});
