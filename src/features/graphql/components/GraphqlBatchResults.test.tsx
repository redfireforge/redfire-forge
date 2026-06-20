/**
 * @vitest-environment jsdom
 *
 * GraphqlBatchResults — unit tests for the batch results display component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphqlBatchResults } from './GraphqlBatchResults';
import type { GraphqlBatchResult } from '../../../shared/types/graphql';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSuccessResult(index: number, operationName?: string): GraphqlBatchResult['results'][0] {
  return {
    index,
    operationName,
    response: {
      httpStatus: 200,
      httpHeaders: {},
      latencyMs: 42,
      timestamp: Date.now(),
      data: { field: 'value' },
    },
  };
}

function makeErrorResult(index: number, errorMsg: string, hasData = false): GraphqlBatchResult['results'][0] {
  return {
    index,
    operationName: `Op${index}`,
    response: {
      httpStatus: 200,
      httpHeaders: {},
      latencyMs: 10,
      timestamp: Date.now(),
      data: hasData ? { partial: true } : null,
      errors: [{ message: errorMsg }],
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GraphqlBatchResults — header rendering', () => {
  it('renders "Batch of N" header with correct count', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0), makeSuccessResult(1)],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('Batch of 2')).toBeTruthy();
  });

  it('shows correct passed/failed counts for all success', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0), makeSuccessResult(1), makeSuccessResult(2)],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('3 passed')).toBeTruthy();
    expect(screen.queryByText(/failed/)).toBeNull();
  });

  it('shows failed count when some operations fail', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0), makeErrorResult(1, 'something went wrong')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('1 passed')).toBeTruthy();
    expect(screen.getByText('1 failed')).toBeTruthy();
  });

  it('shows "Sequential fallback" badge when batchUnsupported is true', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: true,
      results: [makeSuccessResult(0)],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('Sequential fallback')).toBeTruthy();
  });

  it('does not show fallback badge when batchUnsupported is false', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0)],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.queryByText('Sequential fallback')).toBeNull();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0)],
    };
    render(<GraphqlBatchResults result={result} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss batch results'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe('GraphqlBatchResults — operation card rendering', () => {
  it('renders a card for each operation in results', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0, 'GetUser'), makeSuccessResult(1, 'GetPosts')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('GetUser')).toBeTruthy();
    expect(screen.getByText('GetPosts')).toBeTruthy();
  });

  it('uses "Operation N+1" label when operationName is undefined', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0, undefined)],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('Operation 1')).toBeTruthy();
  });

  it('shows success indicator (✓) for successful operations', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0, 'GetUser')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('shows error indicator (✗) for failed operations', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeErrorResult(0, 'Not found')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('✗')).toBeTruthy();
  });

  it('shows HTTP status and latency labels when available', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0, 'GetUser')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('HTTP 200')).toBeTruthy();
    expect(screen.getByText('42 ms')).toBeTruthy();
  });

  it('does not show latency label when latencyMs is 0', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [{
        ...makeSuccessResult(0, 'GetUser'),
        response: { ...makeSuccessResult(0, 'GetUser').response, latencyMs: 0 },
      }],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.queryByText(/ms/)).toBeNull();
  });

  it('does not show HTTP status label when httpStatus is 0', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [{
        ...makeSuccessResult(0, 'GetUser'),
        response: { ...makeSuccessResult(0, 'GetUser').response, httpStatus: 0 },
      }],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.queryByText(/HTTP/)).toBeNull();
  });
});

describe('GraphqlBatchResults — card expand/collapse', () => {
  it('starts expanded and shows data', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0, 'GetUser')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    // Data should be visible (card starts expanded)
    expect(screen.getByText(/"field"/)).toBeTruthy();
  });

  it('collapses when header button is clicked', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0, 'GetUser')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    const headerBtn = screen.getByRole('button', { name: /GetUser/ });
    fireEvent.click(headerBtn);
    // After click, data should not be visible
    expect(screen.queryByText(/"field"/)).toBeNull();
  });

  it('re-expands when header button is clicked again', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0, 'GetUser')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    const headerBtn = screen.getByRole('button', { name: /GetUser/ });
    fireEvent.click(headerBtn);
    fireEvent.click(headerBtn);
    // After second click, data should be visible again
    expect(screen.getByText(/"field"/)).toBeTruthy();
  });

  it('shows chevron pointing down (▾) when expanded', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0, 'GetUser')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('▾')).toBeTruthy();
  });

  it('shows chevron pointing right (▸) when collapsed', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0, 'GetUser')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    const headerBtn = screen.getByRole('button', { name: /GetUser/ });
    fireEvent.click(headerBtn);
    expect(screen.getByText('▸')).toBeTruthy();
  });
});

describe('GraphqlBatchResults — error display', () => {
  it('shows error messages in the card body', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeErrorResult(0, 'Field not found')],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('Field not found')).toBeTruthy();
  });

  it('shows error path when available', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [{
        index: 0,
        operationName: 'Op0',
        response: {
          httpStatus: 200,
          httpHeaders: {},
          latencyMs: 10,
          timestamp: Date.now(),
          data: null,
          errors: [{ message: 'Value error', path: ['user', 'profile', 'avatar'] }],
        },
      }],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('user → profile → avatar')).toBeTruthy();
  });

  it('does not show path element when path is empty', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [{
        index: 0,
        operationName: 'Op0',
        response: {
          httpStatus: 200,
          httpHeaders: {},
          latencyMs: 10,
          timestamp: Date.now(),
          data: null,
          errors: [{ message: 'Some error', path: [] }],
        },
      }],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('Some error')).toBeTruthy();
    expect(screen.queryByText('→')).toBeNull();
  });

  it('shows "No data returned." when data is null and no errors', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [{
        index: 0,
        operationName: 'Op0',
        response: {
          httpStatus: 200,
          httpHeaders: {},
          latencyMs: 0,
          timestamp: Date.now(),
          data: null,
        },
      }],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('No data returned.')).toBeTruthy();
  });

  it('counts operation as success when it has errors but also has data (partial success)', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeErrorResult(0, 'Partial error', true)],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(screen.getByText('1 passed')).toBeTruthy();
    expect(screen.queryByText(/failed/)).toBeNull();
    // Should show success indicator (✓) for partial success
    expect(screen.getByText('✓')).toBeTruthy();
  });
});

describe('GraphqlBatchResults — testid', () => {
  it('renders with the correct data-testid', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [makeSuccessResult(0)],
    };
    render(<GraphqlBatchResults result={result} onDismiss={vi.fn()} />);
    expect(document.querySelector('[data-testid="gql-batch-results"]')).toBeTruthy();
  });
});
