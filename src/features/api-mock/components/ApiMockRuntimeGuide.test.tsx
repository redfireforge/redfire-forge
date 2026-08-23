/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockRuntimeGuide } from './ApiMockRuntimeGuide';
import type { ApiMockRouteV1 } from '@shared/api-mock/contracts';
import { DEFAULT_SETTINGS } from '@shared/api-mock/defaults';

const ts = '2026-08-12T00:00:00.000Z';

function makeRoute(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'r1',
    name: 'List users',
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/users' },
    priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules',
    responses: [],
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe('ApiMockRuntimeGuide', () => {
  it('shows stopped readiness and sample curl for the first rule', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onCopySample = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(
      <ApiMockRuntimeGuide
        running={false}
        serverAddress="http://127.0.0.1:4600"
        routes={[makeRoute()]}
        variableCount={2}
        settings={DEFAULT_SETTINGS}
        onCopySample={onCopySample}
      />,
    );

    expect(screen.getByTestId('api-mock-runtime-guide').textContent).toMatch(/Start the mock/i);
    expect(screen.getByTestId('api-mock-runtime-guide').textContent).toContain('1 enabled');
    expect(screen.getByTestId('api-mock-runtime-sample-curl').textContent).toContain("curl -i -X GET 'http://127.0.0.1:4600/users'");
    expect(screen.getByText(/highest priority wins/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('api-mock-runtime-copy-curl'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(onCopySample).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument());
  });

  it('switches copy for a running server with trailing slash address', () => {
    render(
      <ApiMockRuntimeGuide
        running
        serverAddress="http://127.0.0.1:4600/api/"
        routes={[]}
      />,
    );
    expect(screen.getByText(/Waiting for the first request/i)).toBeInTheDocument();
    expect(screen.getByTestId('api-mock-runtime-sample-curl').textContent).toContain("curl -i -X GET 'http://127.0.0.1:4600/api/'");
    expect(screen.getByText('Default selection policy')).toBeInTheDocument();
  });

  it('handles alternate policies, disabled journal, and path normalization', () => {
    render(
      <ApiMockRuntimeGuide
        running
        serverAddress="http://127.0.0.1:4600"
        routes={[
          makeRoute({ enabled: false }),
          makeRoute({ id: 'r2', enabled: true, method: 'ANY', path: { kind: 'exact', value: 'health' } }),
        ]}
        settings={{
          ...DEFAULT_SETTINGS,
          selection: {
            ...DEFAULT_SETTINGS.selection,
            multipleMatchPolicy: 'reject_multiple',
            equalPriorityPolicy: 'specificity_then_id',
          },
          journal: { ...DEFAULT_SETTINGS.journal, enabled: false },
        }}
      />,
    );
    expect(screen.getByText(/reject multiple matches/i)).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.getByTestId('api-mock-runtime-sample-curl').textContent).toContain('/health');
  });

  it('recovers when clipboard write fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    render(
      <ApiMockRuntimeGuide running serverAddress="http://127.0.0.1:4600" routes={[makeRoute()]} />,
    );
    fireEvent.click(screen.getByTestId('api-mock-runtime-copy-curl'));
    await waitFor(() => expect(screen.getByText('Copy curl')).toBeInTheDocument());
  });

  it('resets copied label after timeout', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(
      <ApiMockRuntimeGuide running serverAddress="http://127.0.0.1:4600" routes={[makeRoute()]} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('api-mock-runtime-copy-curl'));
      await Promise.resolve();
    });
    expect(screen.getByText('Copied')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1700); });
    expect(screen.getByText('Copy curl')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
