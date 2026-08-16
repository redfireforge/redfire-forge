/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
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

  it('shows the Runtime guide in page mode when the journal is empty', () => {
    render(
      <ApiMockDock
        variant="page"
        serverAddress="http://127.0.0.1:4600"
        routes={baseRoutes()}
        running={false}
        transactions={[]}
      />,
    );
    expect(screen.getByTestId('api-mock-runtime-guide').textContent).toMatch(/Start the mock/i);
    expect(screen.getByTestId('api-mock-runtime-sample-curl').textContent).toContain('/users');
  });

  it('opens the requested Runtime tab on the first paint', () => {
    render(
      <ApiMockDock
        variant="page"
        serverAddress="http://127.0.0.1:4600"
        routes={baseRoutes()}
        requestedTab="variables"
        onVariablesChange={vi.fn()}
        transactions={[]}
      />,
    );
    expect(screen.getByTestId('api-mock-dock-variables')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-runtime-guide')).toBeNull();
  });

  it('exposes mockup Runtime tabs including Settings and Console', () => {
    const onServerPatch = vi.fn();
    const server = {
      id: 'srv-1', name: 'Mock Server 1', enabled: true, host: '127.0.0.1' as const, port: 4600, basePath: '',
      folders: [], routes: baseRoutes(), variables: [], settings: { ...DEFAULT_SETTINGS },
      createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
    } as any;
    render(
      <ApiMockDock
        variant="page"
        serverAddress="http://127.0.0.1:4600"
        server={server}
        onServerPatch={onServerPatch}
        routes={baseRoutes()}
        transactions={[]}
      />,
    );
    const list = within(screen.getByTestId('api-mock-dock')).getByRole('tablist', { name: 'Runtime inspector' });
    const labels = within(list).getAllByRole('tab').map(t => t.textContent ?? '');
    expect(labels.some(t => t.startsWith('Transactions'))).toBe(true);
    expect(labels).toContain('State');
    expect(labels.some(t => t.startsWith('Variables'))).toBe(true);
    expect(labels).toContain('Settings');
    expect(labels).toContain('Diagnostics');
    expect(labels).toContain('Console');
    expect(labels.some(t => t.startsWith('Conflicts'))).toBe(false);
    openTab('Settings');
    expect(screen.getByTestId('api-mock-runtime-settings-panel')).toBeTruthy();
  });

  it('renders transaction rows, selection detail, and clear button', () => {
    const onClearTransactions = vi.fn();
    const tx = {
      id: 'tx-1', serverId: 'srv-1', generation: 2, receivedAt: '2026-08-12T00:00:00.000Z', completedAt: '2026-08-12T00:00:00.000Z',
      request: { method: 'GET', path: '/users', rawPath: '/users?active=true', query: {}, cookies: {}, headers: { accept: ['application/json'] }, body: null, bodyTruncated: false, receivedAt: '2026-08-12T00:00:00.000Z', clientCertSubject: 'CN=integration-client' },
      response: { status: 200, headers: {}, cookies: [], body: '{"ok":true}', bodyTruncated: false, durationMs: 3, generationAtResponse: 2 },
      outcome: 'matched', matchedRouteId: 'r1', matchedResponseId: 'v1', durationMs: 3,
      explanation: { normalizedRequest: { method: 'GET', path: '/users', decodedPath: '/users', pathSegments: ['users'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched', selectedRouteId: 'r1' }, nearMisses: [] },
    } as any;
    render(<ApiMockDock routes={baseRoutes()} transactions={[tx]} onClearTransactions={onClearTransactions} />);

    expect(screen.getByTestId('api-mock-journal-toolbar')).toBeTruthy();
    fireEvent.change(screen.getByTestId('api-mock-journal-filter'), { target: { value: 'nomatch' } });
    expect(screen.getByTestId('api-mock-journal-filter-empty')).toBeTruthy();
    fireEvent.change(screen.getByTestId('api-mock-journal-filter'), { target: { value: '' } });

    fireEvent.click(screen.getByTestId('api-mock-tx-tx-1'));
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('GET /users');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('Client-Cert-Subject: CN=integration-client');
    expect(screen.getByTestId('api-mock-tx-request').textContent).toContain('GET /users');
    expect(screen.getByTestId('api-mock-tx-response').textContent).toContain('HTTP 200');
    expect(screen.getByTestId('api-mock-tx-io').children).toHaveLength(2);
    fireEvent.click(screen.getByTestId('api-mock-journal-clear'));
    expect(onClearTransactions).toHaveBeenCalled();
  });

  it('exposes journal Open in Requests / Create route / Copy actions', () => {
    const onOpenInRequests = vi.fn();
    const onCreateRouteFromTransaction = vi.fn(() => 'route-new');
    const onSaveSampleFromTransaction = vi.fn();
    const onCopyTransaction = vi.fn();
    const onSelectRoute = vi.fn();
    const tx = {
      id: 'tx-1', serverId: 'srv-1', generation: 2, receivedAt: '2026-08-12T00:00:00.000Z', completedAt: '2026-08-12T00:00:00.000Z',
      request: { method: 'GET', path: '/users', rawPath: '/users', query: {}, cookies: {}, headers: {}, body: null, bodyTruncated: false, receivedAt: '2026-08-12T00:00:00.000Z' },
      response: { status: 200, headers: {}, cookies: [], body: '{}', bodyTruncated: false, durationMs: 3, generationAtResponse: 2 },
      outcome: 'matched', matchedRouteId: 'r1', matchedResponseId: 'v1', durationMs: 3,
      explanation: { normalizedRequest: { method: 'GET', path: '/users', decodedPath: '/users', pathSegments: ['users'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched', selectedRouteId: 'r1' }, nearMisses: [] },
    } as any;
    render(
      <ApiMockDock
        routes={baseRoutes()}
        transactions={[tx]}
        onSelectRoute={onSelectRoute}
        onOpenInRequests={onOpenInRequests}
        onCreateRouteFromTransaction={onCreateRouteFromTransaction}
        onSaveSampleFromTransaction={onSaveSampleFromTransaction}
        onCopyTransaction={onCopyTransaction}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-tx-tx-1'));
    expect(screen.getByTestId('api-mock-tx-splitter')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-tx-open-requests'));
    fireEvent.click(screen.getByTestId('api-mock-tx-create-route'));
    expect(screen.getByTestId('api-mock-tx-create-route').textContent).toContain('Created');
    expect(screen.getByTestId('api-mock-tx-notice').textContent).toMatch(/Draft route created/i);
    fireEvent.click(screen.getByTestId('api-mock-tx-open-created'));
    expect(onSelectRoute).toHaveBeenCalledWith('route-new');
    fireEvent.click(screen.getByTestId('api-mock-tx-save-example'));
    expect(screen.getByTestId('api-mock-tx-save-example').textContent).toContain('Saved');
    fireEvent.click(screen.getByTestId('api-mock-tx-view-example'));
    expect(onSelectRoute).toHaveBeenCalledWith('r1');
    fireEvent.click(screen.getByTestId('api-mock-tx-copy'));
    expect(screen.getByTestId('api-mock-tx-copy').textContent).toContain('Copied');
    fireEvent.click(screen.getByTestId('api-mock-tx-matched-route'));
    expect(onSelectRoute).toHaveBeenCalledWith('r1');
    expect(onOpenInRequests).toHaveBeenCalled();
    expect(onCreateRouteFromTransaction).toHaveBeenCalled();
    expect(onSaveSampleFromTransaction).toHaveBeenCalled();
    expect(onCopyTransaction).toHaveBeenCalled();
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

    const onCreate = vi.fn();
    const onSave = vi.fn();
    render(
      <ApiMockDock
        routes={baseRoutes()}
        transactions={txs}
        onCreateRouteFromTransaction={onCreate}
        onSaveSampleFromTransaction={onSave}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-tx-tx-amb'));
    expect(screen.getByTestId('api-mock-tx-tx-amb').textContent).toContain('ambiguous');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('POST /unknown?q=1');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('accept: application/json');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('payload');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('gen 1');
    expect(screen.getByTestId('api-mock-tx-response').textContent).toMatch(/No response captured/i);
    expect(screen.getByTestId('api-mock-tx-create-route').className).toContain('primary');
    fireEvent.click(screen.getByTestId('api-mock-tx-create-route'));
    expect(onCreate).toHaveBeenCalled();
    expect(screen.queryByTestId('api-mock-tx-open-created')).toBeNull();
    fireEvent.click(screen.getByTestId('api-mock-tx-save-example'));
    expect(onSave).toHaveBeenCalled();
    expect(screen.getByTestId('api-mock-tx-notice').textContent).toMatch(/Attach it to a rule/i);

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
    expect(screen.getByTestId('api-mock-conflict-detail').textContent).toMatch(/Match dimensions/i);
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

    rerender(<ApiMockDock routes={baseRoutes()} variables={variables} running liveState={{ states: { default: 'done' }, counters: { hits: 2 }, sequencePositions: { 'route-post-cart': 1 } }} onResetState={onResetState} />);
    openTab('State');
    expect(screen.getByTestId('api-mock-dock-state-live').textContent).toContain('default = done');
    expect(screen.getByTestId('api-mock-dock-state-live').textContent).toContain('hits: 2');
    expect(screen.getByTestId('api-mock-dock-seq-row').textContent).toMatch(/seq /);
    expect(screen.getByTestId('api-mock-dock-seq-row').textContent).toContain('1');
    fireEvent.click(screen.getByTestId('api-mock-state-reset'));
    expect(onResetState).toHaveBeenCalled();
  });

  it('supports variables CRUD when onVariablesChange is provided', () => {
    const onVariablesChange = vi.fn();
    const variables = [
      { id: 'v1', key: 'tenant', value: 'acme', sensitive: false },
    ] as any;
    render(<ApiMockDock routes={baseRoutes()} variables={variables} onVariablesChange={onVariablesChange} />);
    openTab('Variables');
    expect(screen.getByRole('table', { name: 'Server variables' }).className).toContain('am-vars-table');
    expect(document.querySelector('.am-vars-col-key')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-var-add'));
    expect(onVariablesChange).toHaveBeenCalled();
    expect(onVariablesChange.mock.calls.at(-1)?.[0]).toHaveLength(2);

    fireEvent.change(screen.getByTestId('api-mock-var-key-v1'), { target: { value: 'tenantId' } });
    expect(onVariablesChange.mock.calls.at(-1)?.[0][0].key).toBe('tenantId');

    fireEvent.click(screen.getByTestId('api-mock-var-sensitive-v1'));
    expect(onVariablesChange.mock.calls.at(-1)?.[0][0].sensitive).toBe(true);

    fireEvent.click(screen.getByTestId('api-mock-var-delete-v1'));
    expect(onVariablesChange.mock.calls.at(-1)?.[0]).toHaveLength(0);
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

  it('copies request and response panes and exposes a keyboard-resizable splitter', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const tx = {
      id: 'tx-1', serverId: 'srv-1', generation: 2, receivedAt: '2026-08-12T00:00:00.000Z', completedAt: '2026-08-12T00:00:00.000Z',
      request: { method: 'GET', path: '/users', rawPath: '/users', query: {}, cookies: {}, headers: {}, body: null, bodyTruncated: false, receivedAt: '2026-08-12T00:00:00.000Z' },
      response: { status: 404, headers: {}, cookies: [], body: 'missing', bodyTruncated: false, durationMs: 3, generationAtResponse: 2 },
      outcome: 'unmatched', matchedRouteId: undefined, matchedResponseId: undefined, durationMs: 3,
      explanation: { normalizedRequest: { method: 'GET', path: '/users', decodedPath: '/users', pathSegments: ['users'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 0, highestPriority: 0, tiedAtHighest: 0, outcome: 'unmatched' }, nearMisses: [] },
    } as any;
    render(<ApiMockDock routes={baseRoutes()} transactions={[tx]} />);
    fireEvent.click(screen.getByTestId('api-mock-tx-tx-1'));
    expect(screen.getByTestId('api-mock-tx-io').getAttribute('style')).toBeNull();
    expect(document.querySelector('.am-tx-time')).toBeTruthy();
    expect(document.querySelector('.am-tx-status')).toBeTruthy();
    const splitter = screen.getByTestId('api-mock-tx-splitter');
    fireEvent.mouseDown(splitter, { clientX: 300 });
    fireEvent.keyDown(splitter, { key: 'ArrowRight' });
    fireEvent.click(screen.getByTestId('api-mock-tx-copy-request'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('api-mock-tx-copy-response'));
    await waitFor(() => expect(writeText.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByTestId('api-mock-tx-response').textContent).toContain('404');
    fireEvent.click(screen.getByTestId('api-mock-tx-copy'));
    expect(screen.getByTestId('api-mock-tx-copy').textContent).toContain('Copied');
  });
});
