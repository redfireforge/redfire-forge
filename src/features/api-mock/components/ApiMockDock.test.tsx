/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ApiMockDock } from './ApiMockDock';

function baseRoutes() {
  return [{
    id: 'r1',
    name: 'Users route',
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/users' },
    priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules',
    responses: [{
      id: 'v1', name: 'default', enabled: true, isDefault: true, status: 200,
      headers: [], cookies: [], body: { kind: 'json', content: '{}', contentType: 'application/json' },
      behavior: { delayMs: 0, jitterMs: 0 },
      transition: { currentState: 'draft', targetState: 'done', counterUpdates: [{ key: 'hits', delta: 1 }] },
    }],
    tags: [], createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
  }] as any;
}

function openTab(label: string) {
  const dock = screen.getByTestId('api-mock-dock');
  const list = within(dock).getByRole('tablist', { name: 'Runtime inspector' });
  fireEvent.click(within(list).getAllByRole('tab').find(t => t.textContent?.trim().startsWith(label))!);
}

function openConsole() {
  openTab('Server console');
}

describe('ApiMockDock', () => {
  it('shows transaction empty states for stopped and running servers', () => {
    const { rerender } = render(<ApiMockDock routes={baseRoutes()} running={false} transactions={[]} />);
    expect(screen.getByTestId('api-mock-dock-transactions-empty').textContent).toMatch(/Start the server/i);

    rerender(<ApiMockDock routes={baseRoutes()} running transactions={[]} />);
    expect(screen.getByTestId('api-mock-dock-transactions-empty').textContent).toMatch(/Send a request/i);
  });

  it('renders transaction rows, selection detail, and clear button', () => {
    const onClearTransactions = vi.fn();
    const tx = {
      id: 'tx-1', serverId: 'srv-1', generation: 2, receivedAt: '2026-08-12T00:00:00.000Z', completedAt: '2026-08-12T00:00:00.000Z',
      request: { method: 'GET', path: '/users', rawPath: '/users?active=true', query: {}, cookies: {}, headers: { accept: ['application/json'] }, body: null, bodyTruncated: false, receivedAt: '2026-08-12T00:00:00.000Z' },
      response: { status: 200, headers: {}, cookies: [], body: '{"ok":true}', bodyTruncated: false, durationMs: 3, generationAtResponse: 2 },
      outcome: 'matched', matchedRouteId: 'r1', matchedResponseId: 'v1', durationMs: 3,
      explanation: { normalizedRequest: { method: 'GET', path: '/users', decodedPath: '/users', pathSegments: ['users'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched', selectedRouteId: 'r1' }, nearMisses: [] },
    } as any;
    render(<ApiMockDock routes={baseRoutes()} transactions={[tx]} onClearTransactions={onClearTransactions} />);

    fireEvent.click(screen.getByTestId('api-mock-tx-tx-1'));
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('GET /users');
    fireEvent.click(screen.getByTestId('api-mock-journal-clear'));
    expect(onClearTransactions).toHaveBeenCalled();
  });

  it('covers transaction status, route-name fallback, request body/header formatting, and missing response detail', () => {
    const txs = [
      {
        id: 'tx-amb', serverId: 'srv-1', generation: 1, receivedAt: 'invalid-date', completedAt: '2026-08-12T00:00:00.000Z',
        request: { method: 'POST', path: '/unknown', rawPath: '/unknown?q=1', query: {}, cookies: {}, headers: { accept: 'application/json' as any }, body: 'payload', bodyTruncated: false, receivedAt: '2026-08-12T00:00:00.000Z' },
        response: undefined,
        outcome: 'ambiguous', matchedRouteId: undefined, matchedResponseId: undefined, durationMs: 9,
        explanation: { normalizedRequest: { method: 'POST', path: '/unknown', decodedPath: '/unknown', pathSegments: ['unknown'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 7 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 2, highestPriority: 10, tiedAtHighest: 2, outcome: 'ambiguous' }, nearMisses: [] },
      },
      {
        id: 'tx-err', serverId: 'srv-1', generation: 1, receivedAt: '2026-08-12T00:00:00.000Z', completedAt: '2026-08-12T00:00:00.000Z',
        request: { method: 'GET', path: '/boom', rawPath: '/boom', query: {}, cookies: {}, headers: {}, body: null, bodyTruncated: false, receivedAt: '2026-08-12T00:00:00.000Z' },
        response: { status: 500, headers: {}, cookies: [], body: 'oops', bodyTruncated: false, durationMs: 5, generationAtResponse: 1 },
        outcome: 'error', matchedRouteId: 'missing-route', matchedResponseId: undefined, durationMs: 5,
        explanation: { normalizedRequest: { method: 'GET', path: '/boom', decodedPath: '/boom', pathSegments: ['boom'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 0, highestPriority: 0, tiedAtHighest: 0, outcome: 'error' }, nearMisses: [] },
      },
    ] as any;

    render(<ApiMockDock routes={baseRoutes()} transactions={txs} />);
    fireEvent.click(screen.getByTestId('api-mock-tx-tx-amb'));
    expect(screen.getByTestId('api-mock-tx-tx-amb').textContent).toContain('ambiguous');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('POST /unknown?q=1');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('accept: application/json');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('payload');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('gen 1');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).not.toContain('Response');

    fireEvent.click(screen.getByTestId('api-mock-tx-tx-err'));
    expect(screen.getByTestId('api-mock-tx-tx-err').textContent).toContain('500');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('missing-route');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('HTTP 500');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('oops');
  });

  it('renders conflict inspector empty state and findings list', () => {
    const finding = {
      id: 'cf-1',
      serverId: 'srv-1',
      ruleIds: ['r1', 'r2'] as [string, string],
      kind: 'potential_overlap' as const,
      severity: 'warning' as const,
      dimensions: [{ source: 'path' as const, result: 'overlap' as const, explanation: 'Path templates overlap' }],
      selectionOutcome: 'reject_ambiguous' as const,
      ruleFingerprints: ['a', 'b'] as [string, string],
    };
    const routes = [
      ...baseRoutes(),
      { ...baseRoutes()[0], id: 'r2', name: 'Admin', path: { kind: 'exact', value: '/users/admin' }, priority: 20 },
    ] as any;

    const { rerender } = render(<ApiMockDock routes={routes} conflictCount={0} conflictFindings={[]} />);
    openTab('Conflicts');
    expect(screen.getByTestId('api-mock-dock-conflicts-empty').textContent).toMatch(/No route conflicts/i);

    rerender(<ApiMockDock routes={routes} conflictCount={1} conflictFindings={[finding]} />);
    openTab('Conflicts');
    expect(screen.getByTestId('api-mock-conflict-inspector')).toBeTruthy();
    expect(screen.getByTestId('api-mock-finding-cf-1').textContent).toMatch(/Potential overlap/i);
    expect(screen.getByTestId('api-mock-conflict-detail').textContent).toMatch(/Dimension analysis/i);
  });

  it('renders static state model, masked variables, and live state reset', () => {
    const onResetState = vi.fn();
    const variables = [
      { id: 'v1', key: 'tenant', value: 'acme', sensitive: false },
      { id: 'v2', key: 'apiKey', value: 'secret', sensitive: true },
    ] as any;
    const { rerender } = render(<ApiMockDock routes={baseRoutes()} variables={variables} running={false} />);
    openTab('Variables');
    expect(screen.getByText('tenant')).toBeTruthy();
    expect(screen.getByText('••••••••')).toBeTruthy();
    openTab('State');
    expect(screen.getByTestId('api-mock-dock-state-list').textContent).toContain('draft');
    expect(screen.getByTestId('api-mock-dock-state-list').textContent).toContain('done');
    expect(screen.getByTestId('api-mock-dock-state-list').textContent).toContain('hits');

    rerender(<ApiMockDock routes={baseRoutes()} variables={variables} running liveState={{ states: { default: 'done' }, counters: { hits: 2 } }} onResetState={onResetState} />);
    openTab('State');
    expect(screen.getByTestId('api-mock-dock-state-live').textContent).toContain('default = done');
    expect(screen.getByTestId('api-mock-dock-state-live').textContent).toContain('hits: 2');
    fireEvent.click(screen.getByTestId('api-mock-state-reset'));
    expect(onResetState).toHaveBeenCalled();
  });

  it('covers state fallbacks for no variables, no stateful routes, and empty live state', () => {
    const statelessRoutes = [{ ...baseRoutes()[0], responses: [{ ...baseRoutes()[0].responses[0], transition: undefined }] }] as any;
    const { rerender } = render(<ApiMockDock routes={statelessRoutes} variables={[]} running={false} />);
    openTab('Variables');
    expect(screen.getByTestId('api-mock-dock-variables-empty')).toBeTruthy();
    openTab('State');
    expect(screen.getByText(/No stateful routes/i)).toBeTruthy();
    expect(screen.getByText(/Start the server to track live counter/i)).toBeTruthy();

    rerender(<ApiMockDock routes={statelessRoutes} variables={[]} running liveState={{ states: {}, counters: {} }} onResetState={vi.fn()} />);
    openTab('State');
    expect(screen.getByTestId('api-mock-dock-state-live').textContent).toMatch(/No state changes yet/i);
  });

  it('renders empty-state symbol for blank live states', () => {
    render(<ApiMockDock routes={baseRoutes()} variables={[]} running liveState={{ states: { default: '' }, counters: {} }} onResetState={vi.fn()} />);
    openTab('State');
    expect(screen.getByTestId('api-mock-dock-state-live').textContent).toContain('default = ∅');
  });

  it('shows an empty state when there are no console lines', () => {
    render(<ApiMockDock routes={baseRoutes()} />);
    openConsole();
    expect(screen.getByTestId('api-mock-dock-console-empty')).toBeTruthy();
  });

  it('renders streamed console lines and a clear button', () => {
    const onClearConsole = vi.fn();
    const lines = [
      { ts: '2026-08-12T00:00:00.000Z', level: 'info', message: 'Started "Mock Server 1" on :4600' },
      { ts: '2026-08-12T00:00:05.000Z', level: 'info', message: 'Committed gen 2 for "srv-1"' },
    ];
    render(<ApiMockDock routes={baseRoutes()} consoleLines={lines} onClearConsole={onClearConsole} />);
    openConsole();
    const pane = screen.getByTestId('api-mock-dock-console');
    expect(pane.textContent).toContain('Started "Mock Server 1" on :4600');
    expect(pane.textContent).toContain('Committed gen 2 for "srv-1"');
    fireEvent.click(screen.getByTestId('api-mock-console-clear'));
    expect(onClearConsole).toHaveBeenCalled();
  });

  it('formats console lines without timestamp or level', () => {
    render(<ApiMockDock routes={baseRoutes()} consoleLines={[{ message: 'bare line' }]} />);
    openConsole();
    expect(screen.getByTestId('api-mock-dock-console').textContent).toContain('bare line');
  });
});
