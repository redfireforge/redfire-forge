/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ApiMockSimulationResultV1 } from '../../../shared/api-mock/contracts';
import { ApiMockSimulateRenderedPane } from './ApiMockSimulateRenderedPane';

function result(overrides: Partial<ApiMockSimulationResultV1> = {}): ApiMockSimulationResultV1 {
  return {
    outcome: 'matched',
    trace: {
      normalizedRequest: {
        method: 'GET', path: '/products/42', decodedPath: '/products/42',
        pathSegments: ['products', '42'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0,
      },
      candidates: [],
      policyDecision: {
        matchedCount: 1, selectedRouteId: 'r1', policy: 'highest_priority',
        equalPriorityPolicy: 'reject', highestPriority: 10, tiedAtHighest: 1, outcome: 'matched',
      },
      nearMisses: [],
    },
    preview: {
      fault: 'none', virtualDelayMs: 0, httpCompleted: true, faultTimeline: [],
    },
    renderedResponse: {
      status: 200,
      body: '{"id":42}',
      contentType: 'application/json',
      headers: {},
    },
    ...overrides,
  } as ApiMockSimulationResultV1;
}

describe('ApiMockSimulateRenderedPane', () => {
  it('pretty-prints compact JSON and then disables Format', () => {
    render(<ApiMockSimulateRenderedPane result={result()} />);
    const body = screen.getByTestId('api-mock-sim-rendered-body');
    expect(body.textContent).toBe('{"id":42}');
    fireEvent.click(screen.getByTestId('api-mock-sim-rendered-format'));
    expect(body.textContent).toBe('{\n  "id": 42\n}');
    expect(screen.getByTestId('api-mock-sim-rendered-format')).toBeDisabled();
  });

  it('disables Format for empty and non-JSON bodies', () => {
    const { rerender } = render(<ApiMockSimulateRenderedPane result={result({
      renderedResponse: { status: 200, body: 'not json', contentType: 'text/plain', headers: {} },
    })} />);
    expect(screen.getByTestId('api-mock-sim-rendered-format')).toBeDisabled();
    expect(screen.getByTestId('api-mock-sim-rendered-body').textContent).toBe('not json');

    rerender(<ApiMockSimulateRenderedPane result={result({
      renderedResponse: { status: 204, body: '', contentType: 'application/json', headers: {} },
    })} />);
    expect(screen.getByTestId('api-mock-sim-rendered-format')).toBeDisabled();
  });

  it('falls back to a dash when content-type is missing and skips delay without a preview', () => {
    render(<ApiMockSimulateRenderedPane result={result({
      preview: undefined,
      renderedResponse: { status: 200, body: 'ok', contentType: undefined, headers: {} },
    })} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByTestId('api-mock-sim-virtual-delay')).toBeNull();
    expect(screen.getByTestId('api-mock-sim-rendered-format')).toBeDisabled();
  });

  it('falls back to the content-type header and a warning badge for 4xx', () => {
    render(<ApiMockSimulateRenderedPane result={result({
      renderedResponse: {
        status: 404,
        body: '{"error":true}',
        contentType: undefined,
        headers: { 'content-type': ['application/problem+json'] },
      },
    })} />);
    expect(screen.getByText('404').className).toContain('warning');
    expect(screen.getByTestId('api-mock-sim-rendered-status')).toHaveTextContent('404');
    expect(screen.getByText('application/problem+json')).toBeInTheDocument();
  });

  it('shows the connection-level fault notice instead of a body', () => {
    render(<ApiMockSimulateRenderedPane result={result({
      preview: {
        fault: 'reset', virtualDelayMs: 5, httpCompleted: false,
        faultTimeline: [{ atMs: 0, label: 'Socket destroy' }],
      },
    })} />);
    expect(screen.getByText('—').className).toContain('danger');
    expect(screen.getByText(/No HTTP body would reach the client/)).toBeInTheDocument();
    expect(screen.queryByTestId('api-mock-sim-rendered-body')).toBeNull();
    expect(screen.getByText(/t\+0ms — Socket destroy/)).toBeInTheDocument();
    expect(screen.getByTestId('api-mock-sim-fault-timeline')).toBeInTheDocument();
  });

  it('shows an empty state when nothing was rendered', () => {
    render(<ApiMockSimulateRenderedPane result={result({ renderedResponse: undefined, preview: undefined })} />);
    expect(screen.getByText('No response rendered for this outcome.')).toBeInTheDocument();
    expect(screen.queryByTestId('api-mock-sim-rendered-format')).toBeNull();
  });

  it('resets Format when a new body arrives', () => {
    const { rerender } = render(<ApiMockSimulateRenderedPane result={result()} />);
    fireEvent.click(screen.getByTestId('api-mock-sim-rendered-format'));
    expect(screen.getByTestId('api-mock-sim-rendered-format')).toBeDisabled();

    rerender(<ApiMockSimulateRenderedPane result={result({
      renderedResponse: { status: 200, body: '{"ok":true}', contentType: 'application/json', headers: {} },
    })} />);
    expect(screen.getByTestId('api-mock-sim-rendered-body').textContent).toBe('{"ok":true}');
    expect(screen.getByTestId('api-mock-sim-rendered-format')).not.toBeDisabled();
  });
});
