/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const copyTextToClipboard = vi.fn(async () => true);
const copyTransactionToClipboard = vi.fn(async () => true);

vi.mock('../apiMockJournalActions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../apiMockJournalActions')>();
  return {
    ...actual,
    copyTextToClipboard: (...args: unknown[]) => copyTextToClipboard(...args),
    copyTransactionToClipboard: (...args: unknown[]) => copyTransactionToClipboard(...args),
  };
});

import { ApiMockTransactionDetail } from './ApiMockTransactionDetail';

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1', serverId: 'srv-1', generation: 2,
    receivedAt: '2026-08-12T00:00:00.000Z', completedAt: '2026-08-12T00:00:00.000Z',
    request: {
      method: 'GET', path: '/users', rawPath: '/users', query: {}, cookies: {}, headers: {},
      body: null, bodyTruncated: false, receivedAt: '2026-08-12T00:00:00.000Z',
    },
    response: { status: 200, headers: {}, cookies: [], body: '{}', bodyTruncated: false, durationMs: 3, generationAtResponse: 2 },
    outcome: 'matched', matchedRouteId: 'r1', matchedResponseId: 'v1', durationMs: 3,
    explanation: {
      normalizedRequest: { method: 'GET', path: '/users', decodedPath: '/users', pathSegments: ['users'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
      candidates: [
        { routeId: 'r1', routeName: 'Users', priority: 10, overallMatch: true },
        { routeId: 'r2', priority: 5, overallMatch: false },
      ],
      policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched', selectedRouteId: 'r1' },
      nearMisses: [
        { routeId: 'r2', routeName: '', failedPredicates: [{ predicateId: 'p1', source: 'header', reason: 'missing' }] },
      ],
    },
    ...overrides,
  } as never;
}

describe('ApiMockTransactionDetail', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders match chrome and selectable candidates', () => {
    const onSelectRoute = vi.fn();
    render(<ApiMockTransactionDetail selected={makeTx()} routeName={id => id ?? '—'} onSelectRoute={onSelectRoute} />);
    expect(screen.getByTestId('api-mock-tx-outcome')).toHaveTextContent('matched');
    fireEvent.click(screen.getByTestId('api-mock-tx-matched-route'));
    expect(onSelectRoute).toHaveBeenCalledWith('r1');
    fireEvent.click(screen.getByText(/Users/));
    expect(onSelectRoute).toHaveBeenCalledWith('r1');
    expect(screen.getByTestId('api-mock-tx-near-misses')).toHaveTextContent('header: missing');
  });

  it('shows static match labels when selection is disabled and handles missing response', () => {
    render(
      <ApiMockTransactionDetail
        selected={makeTx({
          response: undefined,
          durationMs: undefined,
          outcome: 'unmatched',
          matchedRouteId: 'r1',
          explanation: {
            candidates: [{ routeId: 'r2', priority: 1, overallMatch: false }],
            policyDecision: { policy: 'first_match', equalPriorityPolicy: 'first', matchedCount: 0, highestPriority: 0, tiedAtHighest: 0, outcome: 'unmatched' },
            nearMisses: [{ routeId: 'r9', failedPredicates: [] }],
          },
        })}
        routeName={id => `rule-${id}`}
      />,
    );
    expect(screen.getByText('→ rule-r1')).toBeTruthy();
    expect(screen.getByTestId('api-mock-tx-detail-duration')).toHaveTextContent('—');
    expect(screen.getByText('No response captured')).toBeTruthy();
  });

  it('copies panes and flashes create/save/copy actions', async () => {
    vi.useFakeTimers();
    const onOpenInRequests = vi.fn();
    const onCreateRouteFromTransaction = vi.fn(() => 'route-new');
    const onSaveSampleFromTransaction = vi.fn();
    const onCopyTransaction = vi.fn();
    const onSelectRoute = vi.fn();
    render(
      <ApiMockTransactionDetail
        selected={makeTx({ outcome: 'unmatched', matchedRouteId: undefined })}
        routeName={id => id ?? '—'}
        onSelectRoute={onSelectRoute}
        onOpenInRequests={onOpenInRequests}
        onCreateRouteFromTransaction={onCreateRouteFromTransaction}
        onSaveSampleFromTransaction={onSaveSampleFromTransaction}
        onCopyTransaction={onCopyTransaction}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-tx-open-requests'));
    expect(onOpenInRequests).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('api-mock-tx-create-route'));
    expect(screen.getByTestId('api-mock-tx-notice')).toHaveTextContent(/Draft route created/);
    fireEvent.click(screen.getByTestId('api-mock-tx-open-created'));
    expect(onSelectRoute).toHaveBeenCalledWith('route-new');
    fireEvent.click(screen.getByTestId('api-mock-tx-save-example'));
    expect(screen.getByTestId('api-mock-tx-notice')).toHaveTextContent(/Attach it to a rule/);
    fireEvent.click(screen.getByTestId('api-mock-tx-copy'));
    expect(onCopyTransaction).toHaveBeenCalled();
    await act(async () => { await copyTextToClipboard.mock.results[0]?.value; });
    fireEvent.click(screen.getByTestId('api-mock-tx-copy-request'));
    fireEvent.click(screen.getByTestId('api-mock-tx-copy-response'));
    await act(async () => { vi.advanceTimersByTime(2200); });
  });

  it('shows the matched-rule save notice and view button', () => {
    const onSelectRoute = vi.fn();
    render(
      <ApiMockTransactionDetail
        selected={makeTx()}
        routeName={id => id ?? '—'}
        onSelectRoute={onSelectRoute}
        onSaveSampleFromTransaction={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-tx-save-example'));
    expect(screen.getByTestId('api-mock-tx-notice')).toHaveTextContent(/matched rule/);
    fireEvent.click(screen.getByTestId('api-mock-tx-view-example'));
    expect(onSelectRoute).toHaveBeenCalledWith('r1');
  });

  it('skips the copied flash when clipboard write fails', async () => {
    copyTextToClipboard.mockResolvedValueOnce(false);
    render(<ApiMockTransactionDetail selected={makeTx()} routeName={() => '—'} />);
    fireEvent.click(screen.getByTestId('api-mock-tx-copy-request'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('api-mock-tx-copy-request')).toHaveTextContent('Copy');
  });
});
