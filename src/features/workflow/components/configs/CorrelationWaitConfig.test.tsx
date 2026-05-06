/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CorrelationWaitConfig from './CorrelationWaitConfig';
import type { CorrelationWaitNodeData } from '../../types/workflow';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Mock InsertVarField — just render children
vi.mock('../expression/InsertVarField', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="insert-var-field">{children}</div>,
}));

// Mock AvailableVariables
vi.mock('../expression/AvailableVariables', () => ({
  default: () => <div data-testid="available-variables" />,
}));

function makeData(overrides: Partial<CorrelationWaitNodeData> = {}): CorrelationWaitNodeData {
  return {
    label: 'Correlation Wait',
    correlationIdExpression: '{{paymentId}}',
    webhookPath: '/webhooks/payment',
    correlationSource: 'body',
    correlationJsonPath: '$.correlationId',
    extractVariables: [],
    timeoutMs: 60000,
    ...overrides,
  };
}

describe('CorrelationWaitConfig', () => {
  // ── Label ──
  it('renders label input with current value', () => {
    render(<CorrelationWaitConfig data={makeData({ label: 'My Wait' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('My Wait')).toBeTruthy();
  });

  it('calls onChange when label changes', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Correlation Wait'), { target: { value: 'Payment Wait' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Payment Wait' }));
  });

  // ── Correlation ID Expression ──
  it('renders correlation ID expression input', () => {
    render(<CorrelationWaitConfig data={makeData({ correlationIdExpression: '{{orderId}}' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('{{orderId}}')).toBeTruthy();
  });

  it('calls onChange when correlation ID expression changes', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{{paymentId}}'), { target: { value: '{{orderId}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationIdExpression: '{{orderId}}' }));
  });

  // ── Webhook Path ──
  it('renders webhook path input', () => {
    render(<CorrelationWaitConfig data={makeData({ webhookPath: '/webhooks/test' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('/webhooks/test')).toBeTruthy();
  });

  it('calls onChange when webhook path changes', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('/webhooks/payment'), { target: { value: '/webhooks/callback' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ webhookPath: '/webhooks/callback' }));
  });

  // ── Correlation Source ──
  it('renders correlation source select with body selected', () => {
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'body' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Request Body (JSONPath)')).toBeTruthy();
  });

  it('calls onChange when correlation source changes', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Request Body (JSONPath)'), { target: { value: 'header' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationSource: 'header' }));
  });

  // ── Source-specific fields ──
  it('shows JSONPath field when source is body', () => {
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'body', correlationJsonPath: '$.id' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('$.id')).toBeTruthy();
    expect(screen.getByText('Correlation JSONPath')).toBeTruthy();
  });

  it('hides JSONPath field when source is header', () => {
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'header' })} onChange={vi.fn()} />);
    expect(screen.queryByText('Correlation JSONPath')).toBeNull();
  });

  it('shows header name field when source is header', () => {
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'header', correlationHeader: 'X-Corr-Id' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('X-Corr-Id')).toBeTruthy();
    expect(screen.getByText('Header Name')).toBeTruthy();
  });

  it('calls onChange when header name changes', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'header', correlationHeader: 'X-Corr' })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('X-Corr'), { target: { value: 'X-Request-Id' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationHeader: 'X-Request-Id' }));
  });

  it('shows query parameter field when source is query', () => {
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'query', correlationQueryParam: 'cid' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('cid')).toBeTruthy();
    // Label + option both contain 'Query Parameter', use getAllByText
    expect(screen.getAllByText('Query Parameter').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onChange when query parameter changes', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'query', correlationQueryParam: 'cid' })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('cid'), { target: { value: 'correlationId' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationQueryParam: 'correlationId' }));
  });

  it('calls onChange when JSONPath changes', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'body', correlationJsonPath: '$.id' })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('$.id'), { target: { value: '$.data.id' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ correlationJsonPath: '$.data.id' }));
  });

  // ── Timeout ──
  it('renders timeout input with current value', () => {
    render(<CorrelationWaitConfig data={makeData({ timeoutMs: 30000 })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('30000')).toBeTruthy();
  });

  it('calls onChange when timeout changes', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData({ timeoutMs: 60000 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('60000'), { target: { value: '120000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 120000 }));
  });

  it('defaults timeout to 0 on invalid input', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData({ timeoutMs: 5000 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5000'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 0 }));
  });

  // ── Webhook Filter ──
  it('renders webhook filter input', () => {
    render(<CorrelationWaitConfig data={makeData({ webhookFilter: 'type == payment' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('type == payment')).toBeTruthy();
  });

  it('calls onChange when webhook filter changes', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData({ webhookFilter: '' })} onChange={onChange} />);
    const filterInputs = screen.getAllByRole('textbox');
    const filterInput = filterInputs.find(i => (i as HTMLInputElement).placeholder?.includes('webhook.type'));
    expect(filterInput).toBeTruthy();
    fireEvent.change(filterInput!, { target: { value: 'type == order' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ webhookFilter: 'type == order' }));
  });

  // ── Notes ──
  it('renders notes textarea', () => {
    render(<CorrelationWaitConfig data={makeData({ notes: 'Wait for payment gateway' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Wait for payment gateway')).toBeTruthy();
  });

  it('calls onChange when notes change', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData({ notes: 'old note' })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('old note'), { target: { value: 'new note' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: 'new note' }));
  });

  // ── Extract Variables ──
  it('renders extract variables rows', () => {
    render(<CorrelationWaitConfig
      data={makeData({ extractVariables: [{ name: 'status', jsonPath: '$.status' }] })}
      onChange={vi.fn()}
    />);
    expect(screen.getByDisplayValue('status')).toBeTruthy();
    expect(screen.getByDisplayValue('$.status')).toBeTruthy();
  });

  it('adds a new extract variable', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig data={makeData({ extractVariables: [] })} onChange={onChange} />);
    fireEvent.click(screen.getByText('Add Variable'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ extractVariables: [{ name: '', jsonPath: '' }] }),
    );
  });

  it('removes an extract variable', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig
      data={makeData({ extractVariables: [{ name: 'a', jsonPath: '$.a' }, { name: 'b', jsonPath: '$.b' }] })}
      onChange={onChange}
    />);
    const removeButtons = screen.getAllByLabelText('Remove variable');
    fireEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ extractVariables: [{ name: 'b', jsonPath: '$.b' }] }),
    );
  });

  it('updates extract variable name', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig
      data={makeData({ extractVariables: [{ name: 'old', jsonPath: '$.path' }] })}
      onChange={onChange}
    />);
    fireEvent.change(screen.getByDisplayValue('old'), { target: { value: 'new' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ extractVariables: [{ name: 'new', jsonPath: '$.path' }] }),
    );
  });

  it('updates extract variable jsonPath', () => {
    const onChange = vi.fn();
    render(<CorrelationWaitConfig
      data={makeData({ extractVariables: [{ name: 'x', jsonPath: '$.old' }] })}
      onChange={onChange}
    />);
    fireEvent.change(screen.getByDisplayValue('$.old'), { target: { value: '$.new' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ extractVariables: [{ name: 'x', jsonPath: '$.new' }] }),
    );
  });

  // ── AvailableVariables ──
  it('renders AvailableVariables component', () => {
    render(<CorrelationWaitConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByTestId('available-variables')).toBeTruthy();
  });

  // ── Default values ──
  it('handles undefined webhookFilter', () => {
    render(<CorrelationWaitConfig data={makeData({ webhookFilter: undefined })} onChange={vi.fn()} />);
    // Should not crash
    expect(screen.getByText('Webhook Filter (optional)')).toBeTruthy();
  });

  it('handles undefined notes', () => {
    render(<CorrelationWaitConfig data={makeData({ notes: undefined })} onChange={vi.fn()} />);
    expect(screen.getByText('Notes')).toBeTruthy();
  });

  it('handles undefined extractVariables', () => {
    render(<CorrelationWaitConfig data={makeData({ extractVariables: undefined })} onChange={vi.fn()} />);
    expect(screen.getByText('Add Variable')).toBeTruthy();
  });

  it('handles undefined correlationJsonPath', () => {
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'body', correlationJsonPath: undefined })} onChange={vi.fn()} />);
    expect(screen.getByText('Correlation JSONPath')).toBeTruthy();
  });

  it('handles undefined correlationHeader', () => {
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'header', correlationHeader: undefined })} onChange={vi.fn()} />);
    expect(screen.getByText('Header Name')).toBeTruthy();
  });

  it('handles undefined correlationQueryParam', () => {
    render(<CorrelationWaitConfig data={makeData({ correlationSource: 'query', correlationQueryParam: undefined })} onChange={vi.fn()} />);
    expect(screen.getAllByText('Query Parameter').length).toBeGreaterThanOrEqual(1);
  });

  // ── Test Webhook section ──

  it('renders Test Webhook section', () => {
    render(<CorrelationWaitConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByTestId('test-webhook-section')).toBeTruthy();
    expect(screen.getByText('Test Webhook')).toBeTruthy();
  });

  it('renders Test Webhook payload textarea with default payload', () => {
    render(<CorrelationWaitConfig data={makeData({ correlationJsonPath: '$.paymentId' })} onChange={vi.fn()} />);
    const textarea = screen.getByTestId('test-webhook-payload') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    const value = textarea.value;
    expect(value).toContain('paymentId');
  });

  it('renders Send Test Webhook button', () => {
    render(<CorrelationWaitConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByTestId('test-webhook-send')).toBeTruthy();
    expect(screen.getByText('Send Test Webhook')).toBeTruthy();
  });

  it('includes nested keys in default test payload for correlation path', () => {
    render(<CorrelationWaitConfig
      data={makeData({
        correlationJsonPath: '$.a.b',
        correlationIdExpression: 'cid-val',
        extractVariables: [{ name: 'out', jsonPath: '$.x.y' }],
      })}
      onChange={vi.fn()}
    />);
    const ta = screen.getByTestId('test-webhook-payload') as HTMLTextAreaElement;
    const parsed = JSON.parse(ta.value) as Record<string, unknown>;
    expect((parsed.a as Record<string, unknown>).b).toBe('cid-val');
    expect(((parsed.x as Record<string, unknown>).y as string)).toBe('<out>');
  });

  it('send test webhook shows success when resumed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ resumed: true, executionId: 'ex-1' }),
    }));
    render(<CorrelationWaitConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('test-webhook-send'));
    await waitFor(() => {
      expect(screen.getByTestId('test-webhook-result').textContent).toContain('Resumed execution ex-1');
    });
  });

  it('send test webhook shows message when not resumed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ resumed: false }),
    }));
    render(<CorrelationWaitConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('test-webhook-send'));
    await waitFor(() => {
      expect(screen.getByTestId('test-webhook-result').textContent).toContain('No matching paused workflow found');
    });
  });

  it('send test webhook surfaces fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net down')));
    render(<CorrelationWaitConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('test-webhook-send'));
    await waitFor(() => {
      expect(screen.getByTestId('test-webhook-result').textContent).toContain('net down');
    });
  });

  it('send test webhook stringifies non-Error rejections', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('weird'));
    render(<CorrelationWaitConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('test-webhook-send'));
    await waitFor(() => {
      expect(screen.getByTestId('test-webhook-result').textContent).toContain('weird');
    });
  });

  it('falls back to correlationIdExpression when parsed body lacks path key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resumed: true, correlations: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<CorrelationWaitConfig
      data={makeData({ correlationJsonPath: '$.nope', correlationIdExpression: 'expr-fallback' })}
      onChange={vi.fn()}
    />);
    fireEvent.click(screen.getByTestId('test-webhook-send'));
    // Wait for the resume call specifically (POST to /api/correlations/resume)
    await waitFor(() => {
      const resumeCall = fetchMock.mock.calls.find(
        (c: [string, RequestInit?]) => typeof c[0] === 'string' && c[0].includes('/api/correlations/resume')
      );
      expect(resumeCall).toBeTruthy();
    });
    const resumeCall = fetchMock.mock.calls.find(
      (c: [string, RequestInit?]) => typeof c[0] === 'string' && c[0].includes('/api/correlations/resume')
    );
    const init = resumeCall![1] as RequestInit;
    const posted = JSON.parse(init.body as string) as { correlationId: string };
    expect(posted.correlationId).toBe('expr-fallback');
  });

  it('reports invalid JSON in test payload', async () => {
    render(<CorrelationWaitConfig data={makeData()} onChange={vi.fn()} />);
    const ta = screen.getByTestId('test-webhook-payload');
    fireEvent.change(ta, { target: { value: 'not-json' } });
    fireEvent.click(screen.getByTestId('test-webhook-send'));
    await waitFor(() => {
      expect(screen.getByTestId('test-webhook-result').textContent).toMatch(/Unexpected token/i);
    });
  });

  // Note: Load Test Behavior UI was moved to Workflow Runner
  // Tests for that functionality are now in WorkflowRunner.test.tsx
});
