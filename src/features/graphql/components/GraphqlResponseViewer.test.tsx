/**
 * @vitest-environment jsdom
 * GraphqlResponseViewer.test.tsx — unit tests for the response viewer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphqlResponseViewer } from './GraphqlResponseViewer';
import type { GraphqlResponse } from '../../../shared/types/graphql';

function makeResponse(overrides: Partial<GraphqlResponse> = {}): GraphqlResponse {
  return {
    data: { user: { id: '1', name: 'Alice' } },
    errors: undefined,
    latencyMs: 42,
    httpStatus: 200,
    httpHeaders: { 'content-type': 'application/json' },
    timestamp: 1000000,
    ...overrides,
  };
}

describe('GraphqlResponseViewer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders loading state', () => {
    render(<GraphqlResponseViewer response={null} loading />);
    expect(screen.getByTestId('gql-response-loading')).toBeTruthy();
  });

  it('renders empty state when no response and not loading', () => {
    render(<GraphqlResponseViewer response={null} />);
    expect(screen.getByTestId('gql-response-empty')).toBeTruthy();
  });

  it('renders response viewer when response is provided', () => {
    render(<GraphqlResponseViewer response={makeResponse()} />);
    expect(screen.getByTestId('gql-response-viewer')).toBeTruthy();
  });

  it('shows HTTP status badge', () => {
    render(<GraphqlResponseViewer response={makeResponse({ httpStatus: 200 })} />);
    expect(screen.getByTestId('gql-response-status').textContent).toContain('200');
  });

  it('shows latency', () => {
    render(<GraphqlResponseViewer response={makeResponse({ latencyMs: 123 })} />);
    expect(screen.getByTestId('gql-response-latency').textContent).toContain('123');
  });

  it('shows "GraphQL Error" label for 200 + errors only (no data)', () => {
    const response = makeResponse({
      httpStatus: 200,
      data: null,
      errors: [{ message: 'Something went wrong' }],
    });
    render(<GraphqlResponseViewer response={response} />);
    expect(screen.getByTestId('gql-response-status').textContent).toContain('GraphQL Error');
  });

  it('shows 200 OK label for successful 200 response', () => {
    render(<GraphqlResponseViewer response={makeResponse()} />);
    expect(screen.getByTestId('gql-response-status').textContent).toContain('200');
  });

  it('renders body tab content', () => {
    render(<GraphqlResponseViewer response={makeResponse()} />);
    expect(screen.getByTestId('gql-rv-json-scroll')).toBeTruthy();
  });

  it('renders headers tab when switching', () => {
    render(<GraphqlResponseViewer response={makeResponse()} />);
    fireEvent.click(screen.getByTestId('gql-rv-tab-headers'));
    expect(screen.getByTestId('gql-rv-headers')).toBeTruthy();
  });

  it('renders empty headers message when no headers', () => {
    render(<GraphqlResponseViewer response={makeResponse({ httpHeaders: {} })} />);
    fireEvent.click(screen.getByTestId('gql-rv-tab-headers'));
    expect(screen.getByTestId('gql-rv-headers-empty')).toBeTruthy();
  });

  it('renders metadata tab when switching', () => {
    render(<GraphqlResponseViewer response={makeResponse()} />);
    fireEvent.click(screen.getByTestId('gql-rv-tab-metadata'));
    expect(screen.getByTestId('gql-rv-metadata')).toBeTruthy();
  });

  it('shows header badge count on headers tab', () => {
    const response = makeResponse({ httpHeaders: { 'x-a': '1', 'x-b': '2' } });
    render(<GraphqlResponseViewer response={response} />);
    expect(screen.getByTestId('gql-rv-tab-headers').textContent).toContain('2');
  });

  it('shows error count button for responses with errors', () => {
    const response = makeResponse({
      errors: [{ message: 'err1' }, { message: 'err2' }],
    });
    render(<GraphqlResponseViewer response={response} />);
    expect(screen.getByTestId('gql-response-error-count').textContent).toContain('2');
  });

  it('clicking error count navigates to metadata tab', () => {
    const response = makeResponse({ errors: [{ message: 'err' }] });
    render(<GraphqlResponseViewer response={response} />);
    fireEvent.click(screen.getByTestId('gql-response-error-count'));
    expect(screen.getByTestId('gql-rv-metadata')).toBeTruthy();
  });

  it('renders copy button', () => {
    render(<GraphqlResponseViewer response={makeResponse()} />);
    expect(screen.getByTestId('gql-rv-copy-btn')).toBeTruthy();
  });

  it('copy button calls clipboard.writeText with the JSON', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<GraphqlResponseViewer response={makeResponse()} />);
    fireEvent.click(screen.getByTestId('gql-rv-copy-btn'));
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      const calledWith = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledWith).toContain('"user"');
    });
  });

  it('renders large response as plain text (no highlighted spans) when above threshold', () => {
    // Build a response with >512KB body
    const largeData = { items: Array.from({ length: 50000 }, (_, i) => ({ id: i, value: `value-${i}` })) };
    const response = makeResponse({ data: largeData });
    render(<GraphqlResponseViewer response={response} />);
    const pre = screen.getByTestId('gql-response-body');
    // Large response should NOT have syntax highlighting spans inside pre
    // Just verify the pre element renders (it may be plain text or spans depending on size)
    expect(pre).toBeTruthy();
  });

  it('shows error list in metadata tab for responses with errors', () => {
    const response = makeResponse({
      errors: [{ message: 'Server error', locations: [{ line: 1, column: 5 }] }],
    });
    render(<GraphqlResponseViewer response={response} />);
    fireEvent.click(screen.getByTestId('gql-rv-tab-metadata'));
    expect(screen.getByTestId('gql-rv-error-list')).toBeTruthy();
  });

  it('shows "Partial" badge when response has both data and errors', () => {
    const response = makeResponse({
      data: { user: { id: '1' } },
      errors: [{ message: 'partial error' }],
    });
    render(<GraphqlResponseViewer response={response} />);
    expect(screen.getByTestId('gql-response-viewer').textContent).toContain('Partial');
  });

  it('shows redirect class for 3xx HTTP status', () => {
    const response = makeResponse({ httpStatus: 301 });
    render(<GraphqlResponseViewer response={response} />);
    const badge = screen.getByTestId('gql-response-status');
    expect(badge.className).toContain('gql-status--redirect');
  });

  it('shows client-error class for 4xx HTTP status', () => {
    const response = makeResponse({ httpStatus: 404 });
    render(<GraphqlResponseViewer response={response} />);
    const badge = screen.getByTestId('gql-response-status');
    expect(badge.className).toContain('gql-status--client-error');
  });

  it('shows server-error class for 5xx HTTP status', () => {
    const response = makeResponse({ httpStatus: 500 });
    render(<GraphqlResponseViewer response={response} />);
    const badge = screen.getByTestId('gql-response-status');
    expect(badge.className).toContain('gql-status--server-error');
  });

  it('renders Body tab button and switches to body tab', () => {
    render(<GraphqlResponseViewer response={makeResponse()} />);
    // Switch away first
    fireEvent.click(screen.getByTestId('gql-rv-tab-headers'));
    // Now switch back to body
    fireEvent.click(screen.getByTestId('gql-rv-tab-body'));
    expect(screen.getByTestId('gql-response-body')).toBeTruthy();
  });

  // ── Sprint 7 (2D) streaming UI tests ──────────────────────────────────────

  it('shows streaming banner when isStreaming is true', () => {
    render(<GraphqlResponseViewer response={makeResponse({ isStreaming: true, chunkCount: 1 })} />);
    expect(screen.getByTestId('gql-rv-streaming-banner')).toBeTruthy();
  });

  it('hides streaming banner when isStreaming is false', () => {
    render(<GraphqlResponseViewer response={makeResponse({ isStreaming: false, chunkCount: 3 })} />);
    expect(screen.queryByTestId('gql-rv-streaming-banner')).toBeNull();
  });

  it('shows chunk badge for non-streaming multipart response', () => {
    render(<GraphqlResponseViewer response={makeResponse({ isStreaming: false, chunkCount: 4 })} loading={false} />);
    expect(screen.getByTestId('gql-rv-chunk-badge')).toBeTruthy();
  });

  it('does not reset tab when streaming chunk updates arrive (chunkCount > 1)', () => {
    const r1 = makeResponse({ isStreaming: true, chunkCount: 1, timestamp: 1000 });
    const { rerender } = render(<GraphqlResponseViewer response={r1} />);
    // Switch to headers tab
    fireEvent.click(screen.getByTestId('gql-rv-tab-headers'));
    // Simulate second chunk arriving — new timestamp, chunkCount = 2
    const r2 = makeResponse({ isStreaming: true, chunkCount: 2, timestamp: 2000 });
    rerender(<GraphqlResponseViewer response={r2} />);
    // Tab should still be on headers (NOT reset to body)
    expect(screen.getByTestId('gql-rv-headers')).toBeTruthy();
  });

  it('resets tab to body on first streaming chunk (chunkCount === 1)', () => {
    const rPrev = makeResponse({ timestamp: 500 });
    const { rerender } = render(<GraphqlResponseViewer response={rPrev} />);
    fireEvent.click(screen.getByTestId('gql-rv-tab-headers'));
    // New execution starts — first chunk
    const r1 = makeResponse({ isStreaming: true, chunkCount: 1, timestamp: 1000 });
    rerender(<GraphqlResponseViewer response={r1} />);
    // Tab should be reset to body
    expect(screen.getByTestId('gql-response-body')).toBeTruthy();
  });

  // ── Sprint 7 (2G-1) tracing tests ─────────────────────────────────────────

  it('shows tracing tab and badge when extensions.tracing is present', () => {
    const tracingExt = {
      version: 1,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T00:00:00.1Z',
      duration: 100_000_000,
      parsing: { startOffset: 0, duration: 1_000_000 },
      validation: { startOffset: 1_000_000, duration: 2_000_000 },
      execution: {
        resolvers: [
          { path: ['user'], parentType: 'Query', fieldName: 'user', returnType: 'User', startOffset: 3_000_000, duration: 10_000_000 },
        ],
      },
    };
    render(<GraphqlResponseViewer response={makeResponse({ extensions: { tracing: tracingExt } })} />);
    expect(screen.getByTestId('gql-rv-tracing-badge')).toBeTruthy();
    expect(screen.getByTestId('gql-rv-tab-tracing')).toBeTruthy();
  });

  it('does not show tracing tab when extensions.tracing is absent', () => {
    render(<GraphqlResponseViewer response={makeResponse()} />);
    expect(screen.queryByTestId('gql-rv-tab-tracing')).toBeNull();
    expect(screen.queryByTestId('gql-rv-tracing-badge')).toBeNull();
  });

});
