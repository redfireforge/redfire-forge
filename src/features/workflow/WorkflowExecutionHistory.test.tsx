/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { selectOption } from '../../test-utils/customSelectHelper';
import WorkflowExecutionHistory from './WorkflowExecutionHistory';

vi.mock('../requests/components/JsonTreePreview', () => ({
  default: ({ body, search, onMatchCountChange, onToggle }: { body: string; search?: string; onMatchCountChange?: (n: number) => void; onToggle?: (path: string) => void }) => {
    if (onMatchCountChange) {
      if (!search) onMatchCountChange(0);
      else if (search === 'nomatch') onMatchCountChange(0);
      else onMatchCountChange(2);
    }
    return (
      <div data-testid="json-preview">
        {body.slice(0, 50)}
        {onToggle && <button data-testid="toggle-path" onClick={() => onToggle('/a')}>Toggle</button>}
      </div>
    );
  },
  buildJTree: (obj: unknown) => ({ key: 'root', value: obj, type: 'object', children: [{ key: 'a', value: 1, children: [] }] }),
}));

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
    resetAllMocks();
  });

  it('renders the paused filter option in dropdown', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse());
    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    fireEvent.click(document.querySelector('.cs-trigger')!);
    const items = document.querySelectorAll('.cs-item');
    const pausedOption = [...items].find(o => o.textContent?.includes('Paused'));
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
    selectOption(document, 'Paused');

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

    selectOption(document, 'Paused');

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

    selectOption(document, 'Paused');

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

    selectOption(document, 'Paused');

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

    selectOption(document, 'Paused');

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

    selectOption(document, 'Paused');

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

    selectOption(document, 'Paused');

    await waitFor(() => {
      expect(screen.getByText('⏸ PAUSED')).toBeTruthy();
    });
  });

  it('shows failure message when resume returns not-resumed', async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/correlations/resume') && opts?.method === 'POST') {
        return mockResumeResponse(false);
      }
      if (url.includes('/api/correlations')) return mockCorrelationsResponse([samplePaused[0]]);
      return mockExecutionsResponse();
    });

    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    selectOption(document, 'Paused');
    await waitFor(() => expect(screen.getByTestId('exh-resume-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('exh-resume-btn'));

    await waitFor(() => {
      expect(screen.getByText(/No matching paused workflow/)).toBeTruthy();
    });
  });

  it('shows error message when resume fetch throws', async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/correlations/resume') && opts?.method === 'POST') {
        return Promise.reject(new Error('Network error'));
      }
      if (url.includes('/api/correlations')) return mockCorrelationsResponse([samplePaused[0]]);
      return mockExecutionsResponse();
    });

    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());

    selectOption(document, 'Paused');
    await waitFor(() => expect(screen.getByTestId('exh-resume-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('exh-resume-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeTruthy();
    });
  });
});

const sampleExecution = {
  id: 'exec-001',
  workflowId: 'wf-main',
  triggerType: 'webhook',
  status: 'completed',
  timestamp: '2026-05-01T10:00:00Z',
  duration: 1234,
  variables: { userId: '42', orderId: 'ord-1' },
  results: [
    { url: 'https://api.example.com/users/42', statusCode: 200, responseTime: 45.67, body: '{"name":"Alice"}' },
    { url: 'https://api.example.com/orders/1', statusCode: 404, responseTime: 12.34, body: null },
  ],
  error: null,
};

const sampleExecution2 = {
  id: 'exec-002',
  workflowId: 'wf-other',
  triggerType: 'schedule',
  status: 'failed',
  timestamp: '2026-05-02T14:00:00Z',
  duration: 567,
  variables: {},
  results: [],
  error: 'Timeout exceeded',
};

describe('WorkflowExecutionHistory — Execution List', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<WorkflowExecutionHistory />);
    expect(screen.getByText('Loading executions...')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 500 }));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText('Error Loading Executions')).toBeInTheDocument();
    });
    expect(screen.getByText(/npm run server/)).toBeInTheDocument();
  });

  it('retries on Retry button click', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: false, status: 500 }));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText('Error Loading Executions')).toBeInTheDocument();
    });
    mockFetch.mockReturnValueOnce(mockExecutionsResponse([sampleExecution]));
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => {
      expect(screen.getAllByText('wf-main').length).toBeGreaterThan(0);
    });
  });

  it('shows empty state when no executions', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText('No executions found')).toBeInTheDocument();
    });
  });

  it('renders execution cards', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution, sampleExecution2]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getAllByText('wf-main').length).toBeGreaterThan(0);
      expect(screen.getAllByText('wf-other').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('FAILED').length).toBeGreaterThan(0);
  });

  it('auto-selects first execution and shows detail panel', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText('Execution Details')).toBeInTheDocument();
    });
    expect(screen.getByText('exec-001')).toBeInTheDocument();
    const durationEls = screen.getAllByText('1234ms');
    expect(durationEls.length).toBeGreaterThan(0);
  });

  it('shows variables in detail panel', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText('Variables')).toBeInTheDocument();
    });
    expect(screen.getByText(/"userId": "42"/)).toBeInTheDocument();
  });

  it('shows results in detail panel', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/api\.example\.com\/users/)).toBeInTheDocument();
    });
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('shows error in detail panel when execution has error', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution2]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
    expect(screen.getByText('Timeout exceeded')).toBeInTheDocument();
  });

  it('closes detail panel with ✕ button', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText('Execution Details')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('Execution Details')).not.toBeInTheDocument();
  });

  it('selects a different execution on card click', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution, sampleExecution2]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getAllByText('wf-main').length).toBeGreaterThan(0);
    });
    // sampleExecution2 is newer so it appears first in desc sort; sampleExecution is second
    // Click the card that contains "wf-other" workflow
    const otherCard = screen.getAllByText('wf-other')[0].closest('button.exh-card');
    fireEvent.click(otherCard!);
    await waitFor(() => {
      expect(screen.getByText('exec-002')).toBeInTheDocument();
    });
  });

  it('filters by webhook trigger type', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution, sampleExecution2]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getAllByText('wf-main').length).toBeGreaterThan(0);
    });
    selectOption(document, 'Webhooks');
    expect(screen.getAllByText('wf-main').length).toBeGreaterThan(0);
    expect(screen.queryByText('wf-other')).not.toBeInTheDocument();
  });

  it('toggles sort order', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution, sampleExecution2]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Newest/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Newest/));
    expect(screen.getByText(/Oldest/)).toBeInTheDocument();
  });

  it('shows total count when filter applied', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution, sampleExecution2]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getAllByText('wf-main').length).toBeGreaterThan(0);
    });
    selectOption(document, 'Webhooks');
    expect(screen.getByText(/2 total/)).toBeInTheDocument();
  });

  it('shows subtitle with singular execution', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/1 execution(?!s)/)).toBeInTheDocument();
    });
  });

  it('hides sort toggle when only one execution matches filter', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.queryByText(/Newest/)).not.toBeInTheDocument();
    });
  });

  it('shows schedule trigger icon on schedule executions', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution2]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText('⏰')).toBeInTheDocument();
    });
  });

  it('omits variables section when execution has no variables', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([{ ...sampleExecution, variables: {}, error: null }]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Variables' })).not.toBeInTheDocument();
    });
  });

  it('does not render response body details when result has no body', async () => {
    const execNoBody = {
      ...sampleExecution,
      results: [{ url: 'https://api.example.com/x', statusCode: 204, responseTime: 1, body: null as string | null }],
    };
    mockFetch.mockReturnValue(mockExecutionsResponse([execNoBody]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.queryByText('Response Body')).not.toBeInTheDocument();
    });
  });

  it('shows loading state when paused tab fetches correlations', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/correlations')) {
        return new Promise(() => {});
      }
      return mockExecutionsResponse();
    });
    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());
    selectOption(document, 'Paused');
    expect(screen.getByText('Loading paused workflows...')).toBeInTheDocument();
  });

  it('survives correlations fetch failure on paused tab', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/correlations')) return Promise.resolve({ ok: false, status: 500 });
      return mockExecutionsResponse();
    });
    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());
    selectOption(document, 'Paused');
    await waitFor(() => {
      expect(errSpy).toHaveBeenCalled();
    });
    errSpy.mockRestore();
  });

  it('shows elapsed in hours for long paused workflows', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/correlations')) {
        return mockCorrelationsResponse([{
          ...samplePaused[0],
          pausedAt: Date.now() - 7200000,
        }]);
      }
      return mockExecutionsResponse();
    });
    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());
    selectOption(document, 'Paused');
    await waitFor(() => {
      expect(screen.getByText(/2h ago/)).toBeInTheDocument();
    });
  });

  it('shows Expired when timeout is in the past', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/correlations')) {
        return mockCorrelationsResponse([{
          ...samplePaused[0],
          timeoutAt: Date.now() - 1000,
        }]);
      }
      return mockExecutionsResponse();
    });
    render(<WorkflowExecutionHistory />);
    await waitFor(() => expect(screen.queryByText('Loading executions...')).toBeNull());
    selectOption(document, 'Paused');
    await waitFor(() => {
      expect(screen.getByText('Expired')).toBeInTheDocument();
    });
  });

  it('renders Refresh button and reloads', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
    mockFetch.mockReturnValueOnce(mockExecutionsResponse([sampleExecution, sampleExecution2]));
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() => {
      expect(screen.getByText('wf-other')).toBeInTheDocument();
    });
  });

  it('ExhResultBody search shows No match when preview reports zero hits', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Response Body/)).toBeInTheDocument();
    });
    const details = document.querySelector('details.exh-result-body-toggle') as HTMLElement;
    fireEvent.click(details.querySelector('summary')!);
    fireEvent.change(screen.getByPlaceholderText('Search response...'), { target: { value: 'nomatch' } });
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('renders response body with JSON tree', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Response Body/)).toBeInTheDocument();
    });
    const details = document.querySelector('details.exh-result-body-toggle') as HTMLElement;
    fireEvent.click(details.querySelector('summary')!);
    expect(screen.getByTestId('json-preview')).toBeInTheDocument();
  });

  it('ExhResultBody shows search and expand/collapse controls', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Response Body/)).toBeInTheDocument();
    });
    const details = document.querySelector('details.exh-result-body-toggle') as HTMLElement;
    fireEvent.click(details.querySelector('summary')!);
    expect(screen.getByPlaceholderText('Search response...')).toBeInTheDocument();
    expect(screen.getByText('Expand All')).toBeInTheDocument();
    expect(screen.getByText('Collapse All')).toBeInTheDocument();
  });

  it('ExhResultBody search shows match count and navigation', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Response Body/)).toBeInTheDocument();
    });
    const details = document.querySelector('details.exh-result-body-toggle') as HTMLElement;
    fireEvent.click(details.querySelector('summary')!);
    const searchInput = screen.getByPlaceholderText('Search response...');
    fireEvent.change(searchInput, { target: { value: 'name' } });
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByTitle('Previous')).toBeInTheDocument();
    expect(screen.getByTitle('Next')).toBeInTheDocument();
  });

  it('ExhResultBody search clear resets', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Response Body/)).toBeInTheDocument();
    });
    const details = document.querySelector('details.exh-result-body-toggle') as HTMLElement;
    fireEvent.click(details.querySelector('summary')!);
    const searchInput = screen.getByPlaceholderText('Search response...');
    fireEvent.change(searchInput, { target: { value: 'name' } });
    expect(screen.getByText('×')).toBeInTheDocument();
    fireEvent.click(screen.getByText('×'));
    expect(screen.queryByText('1/2')).not.toBeInTheDocument();
  });

  it('ExhResultBody Expand All / Collapse All works', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Response Body/)).toBeInTheDocument();
    });
    const details = document.querySelector('details.exh-result-body-toggle') as HTMLElement;
    fireEvent.click(details.querySelector('summary')!);
    fireEvent.click(screen.getByText('Collapse All'));
    fireEvent.click(screen.getByText('Expand All'));
    // No crash — just verify buttons are functional
    expect(screen.getByTestId('json-preview')).toBeInTheDocument();
  });

  it('ExhResultBody toggle path works', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Response Body/)).toBeInTheDocument();
    });
    const details = document.querySelector('details.exh-result-body-toggle') as HTMLElement;
    fireEvent.click(details.querySelector('summary')!);
    fireEvent.click(screen.getByTestId('toggle-path'));
    // Toggle again to cover the else branch
    fireEvent.click(screen.getByTestId('toggle-path'));
    expect(screen.getByTestId('json-preview')).toBeInTheDocument();
  });

  it('ExhResultBody shows pre for non-JSON body', async () => {
    const execWithPlainBody = {
      ...sampleExecution,
      id: 'exec-plain',
      results: [{ url: 'https://example.com', statusCode: 200, responseTime: 10, body: 'plain text response' }],
    };
    mockFetch.mockReturnValue(mockExecutionsResponse([execWithPlainBody]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Response Body/)).toBeInTheDocument();
    });
    const details = document.querySelector('details.exh-result-body-toggle') as HTMLElement;
    fireEvent.click(details.querySelector('summary')!);
    expect(screen.getByText('plain text response')).toBeInTheDocument();
  });

  it('search navigation Previous wraps around', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Response Body/)).toBeInTheDocument();
    });
    const details = document.querySelector('details.exh-result-body-toggle') as HTMLElement;
    fireEvent.click(details.querySelector('summary')!);
    const searchInput = screen.getByPlaceholderText('Search response...');
    fireEvent.change(searchInput, { target: { value: 'name' } });
    // Click previous when at index 0 — should wrap to end
    fireEvent.click(screen.getByTitle('Previous'));
    expect(screen.getByText('2/2')).toBeInTheDocument();
  });

  it('search navigation Next wraps around', async () => {
    mockFetch.mockReturnValue(mockExecutionsResponse([sampleExecution]));
    render(<WorkflowExecutionHistory />);
    await waitFor(() => {
      expect(screen.getByText(/Response Body/)).toBeInTheDocument();
    });
    const details = document.querySelector('details.exh-result-body-toggle') as HTMLElement;
    fireEvent.click(details.querySelector('summary')!);
    const searchInput = screen.getByPlaceholderText('Search response...');
    fireEvent.change(searchInput, { target: { value: 'name' } });
    // Click next to go from 1/2 to 2/2
    fireEvent.click(screen.getByTitle('Next'));
    expect(screen.getByText('2/2')).toBeInTheDocument();
    // Click next again — should wrap to 1/2
    fireEvent.click(screen.getByTitle('Next'));
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });
});
