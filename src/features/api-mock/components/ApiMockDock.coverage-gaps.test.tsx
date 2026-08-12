/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
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
  const list = within(screen.getByTestId('api-mock-dock')).getByRole('tablist', { name: 'Runtime inspector' });
  fireEvent.click(within(list).getAllByRole('tab').find(t => t.textContent?.trim().startsWith(label))!);
}

describe('ApiMockDock coverage gaps', () => {
  it('covers requested-tab consumption, conflict tab callback, and maximize toggle', () => {
    const onRequestedTabConsumed = vi.fn();
    const onOpenConflicts = vi.fn();
    const finding = {
      id: 'cf-1',
      serverId: 'srv-1',
      ruleIds: ['r1', 'r2'] as [string, string],
      kind: 'potential_overlap' as const,
      severity: 'warning' as const,
      dimensions: [{ source: 'path' as const, result: 'overlap' as const, explanation: 'overlap' }],
      selectionOutcome: 'reject_ambiguous' as const,
      ruleFingerprints: ['a', 'b'] as [string, string],
    };

    render(
      <ApiMockDock
        routes={[...baseRoutes(), { ...baseRoutes()[0], id: 'r2', path: { kind: 'exact', value: '/users/admin' } }] as any}
        requestedTab="conflicts"
        onRequestedTabConsumed={onRequestedTabConsumed}
        onOpenConflicts={onOpenConflicts}
        conflictCount={1}
        conflictFindings={[finding] as any}
      />,
    );

    expect(onRequestedTabConsumed).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('api-mock-conflict-inspector')).toBeTruthy();

    openTab('Conflicts');
    expect(onOpenConflicts).toHaveBeenCalledTimes(1);

    const max = screen.getByTestId('api-mock-dock-maximize');
    expect(max.getAttribute('aria-label')).toBe('Maximize dock');
    fireEvent.click(max);
    expect(screen.getByTestId('api-mock-dock-maximize').getAttribute('aria-label')).toBe('Restore dock');
  });

  it('covers candidates and near-misses detail rows and running-state notice without live values', () => {
    const tx = {
      id: 'tx-1', serverId: 'srv-1', generation: 2, receivedAt: '2026-08-12T00:00:00.000Z', completedAt: '2026-08-12T00:00:00.000Z',
      request: { method: 'GET', path: '/users', rawPath: '/users', query: {}, cookies: {}, headers: {}, body: null, bodyTruncated: false, receivedAt: '2026-08-12T00:00:00.000Z' },
      response: { status: 200, headers: {}, cookies: [], body: '{"ok":true}', bodyTruncated: false, durationMs: 3, generationAtResponse: 2 },
      outcome: 'matched', matchedRouteId: 'r1', matchedResponseId: 'v1', durationMs: null,
      explanation: {
        normalizedRequest: { method: 'GET', path: '/users', decodedPath: '/users', pathSegments: ['users'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
        candidates: [{ routeId: 'r1', routeName: '', priority: 10, overallMatch: false }],
        policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched', selectedRouteId: 'r1' },
        nearMisses: [{ routeId: 'r2', routeName: '', failedPredicates: [{ predicateId: 'p1', source: 'header', reason: 'missing X-Tenant' }] }],
      },
    } as any;

    render(<ApiMockDock routes={[...baseRoutes(), { ...baseRoutes()[0], id: 'r2', path: { kind: 'exact', value: '/r2' } }] as any} transactions={[tx]} running />);
    fireEvent.click(screen.getByTestId('api-mock-tx-tx-1'));
    expect(screen.getByTestId('api-mock-tx-candidates').textContent).toContain('miss');
    expect(screen.getByTestId('api-mock-tx-near-misses').textContent).toContain('header: missing X-Tenant');
    expect(screen.getByTestId('api-mock-tx-detail').textContent).toContain('Duration: —');

    openTab('State');
    expect(screen.getByText(/Live counter\/state values update as requests hit stateful routes/i)).toBeTruthy();
  });
});
