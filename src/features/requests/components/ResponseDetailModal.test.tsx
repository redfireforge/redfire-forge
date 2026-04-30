/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResponseDetailModal from './ResponseDetailModal';
import type { RequestResult } from '../../../shared/types';

vi.mock('../../test-runner/components/WaterfallBar', () => ({
  default: () => <div data-testid="waterfall-bar" />,
}));

function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: 'r1',
    scenarioId: 's1',
    scenarioName: 'Test Request',
    url: 'https://api.example.com/users',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 42,
    responseBody: '{"ok":true}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    ...overrides,
  };
}

describe('ResponseDetailModal', () => {
  it('renders nothing when result is null', () => {
    const { container } = render(<ResponseDetailModal result={null} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders meta info', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    expect(screen.getByText('GET')).toBeTruthy();
    expect(screen.getByText('Test Request')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('42 ms')).toBeTruthy();
  });

  it('renders response headers section', () => {
    const result = makeResult({
      responseHeaders: {
        'content-type': 'application/json',
        'x-request-id': 'abc-123',
      },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Response Headers')).toBeTruthy();
    expect(screen.getByText('content-type')).toBeTruthy();
    expect(screen.getByText('application/json')).toBeTruthy();
    expect(screen.getByText('x-request-id')).toBeTruthy();
    expect(screen.getByText('abc-123')).toBeTruthy();
  });

  it('hides response headers section when empty', () => {
    render(<ResponseDetailModal result={makeResult({ responseHeaders: {} })} onClose={vi.fn()} />);
    expect(screen.queryByText('Response Headers')).toBeNull();
  });

  it('hides response headers section when undefined', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    expect(screen.queryByText('Response Headers')).toBeNull();
  });

  it('renders request headers section', () => {
    const result = makeResult({
      requestLog: {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: '{"name":"test"}',
      },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Request Headers')).toBeTruthy();
    expect(screen.getByText('Content-Type')).toBeTruthy();
    expect(screen.getByText('Accept')).toBeTruthy();
  });

  it('masks Authorization header value', () => {
    const result = makeResult({
      requestLog: {
        headers: { 'Authorization': 'Bearer secret-token', 'Accept': '*/*' },
      },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Authorization')).toBeTruthy();
    expect(screen.getByText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')).toBeTruthy();
    expect(screen.queryByText('Bearer secret-token')).toBeNull();
  });

  it('renders request body section', () => {
    const result = makeResult({
      requestLog: {
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"test"}',
      },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Request Body')).toBeTruthy();
  });

  it('hides request body when not provided', () => {
    const result = makeResult({
      requestLog: { headers: { 'Accept': '*/*' } },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.queryByText('Request Body')).toBeNull();
  });

  it('hides request headers when requestLog is undefined', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    expect(screen.queryByText('Request Headers')).toBeNull();
    expect(screen.queryByText('Request Body')).toBeNull();
  });
});
