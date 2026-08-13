/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockConflictInspector, conflictPeerLabel } from './ApiMockConflictInspector';
import type { ApiMockConflictFindingV1, ApiMockRouteV1 } from '../../../shared/api-mock/contracts';
import { createDefaultResponse, EMPTY_PREDICATE_GROUP } from '../../../shared/api-mock/defaults';

const ts = '2026-08-12T00:00:00.000Z';

function makeRoute(id: string, path: string, priority = 10): ApiMockRouteV1 {
  return {
    id,
    name: id,
    enabled: true,
    method: 'GET',
    path: { kind: 'parameterized', value: path },
    priority,
    predicates: { ...EMPTY_PREDICATE_GROUP, id: `pg-${id}` },
    responseMode: 'rules',
    responses: [createDefaultResponse(`resp-${id}`)],
    tags: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

function makeFinding(overrides: Partial<ApiMockConflictFindingV1> = {}): ApiMockConflictFindingV1 {
  return {
    id: 'cf-1',
    serverId: 'srv-1',
    ruleIds: ['r-a', 'r-b'],
    kind: 'potential_overlap',
    severity: 'warning',
    dimensions: [
      { source: 'method', result: 'overlap', explanation: 'Both match GET' },
      { source: 'path', result: 'overlap', explanation: ':id captures admin' },
    ],
    selectionOutcome: 'reject_ambiguous',
    witnessRequest: {
      method: 'GET',
      path: '/users/admin',
      rawPath: '/users/admin',
      query: {},
      cookies: {},
      headers: { 'x-tenant': ['acme'] },
      body: null,
      bodyTruncated: false,
      receivedAt: ts,
    },
    ruleFingerprints: ['fp1', 'fp2'],
    ...overrides,
  };
}

describe('ApiMockConflictInspector', () => {
  const routes = [makeRoute('r-a', '/users/:id', 20), makeRoute('r-b', '/users/admin', 20)];

  it('lists findings, filters by kind, and shows witness detail', () => {
    const onSelectRoute = vi.fn();
    const onSimulateWitness = vi.fn();
    render(
      <ApiMockConflictInspector
        findings={[makeFinding(), makeFinding({ id: 'cf-2', kind: 'duplicate', severity: 'error' })]}
        routes={routes}
        onSelectRoute={onSelectRoute}
        onSimulateWitness={onSimulateWitness}
      />,
    );

    expect(screen.getByTestId('api-mock-finding-cf-1')).toBeTruthy();
    expect(screen.getByTestId('api-mock-conflict-witness').textContent).toMatch(/GET \/users\/admin/);
    fireEvent.click(screen.getByTestId('api-mock-conflict-filter-duplicate'));
    expect(screen.queryByTestId('api-mock-finding-cf-1')).toBeNull();
    expect(screen.getByTestId('api-mock-finding-cf-2')).toBeTruthy();

    fireEvent.click(screen.getByTestId('api-mock-conflict-filter-all'));
    fireEvent.click(screen.getByTestId('api-mock-finding-cf-1'));
    fireEvent.click(screen.getByTestId('api-mock-conflict-goto-left'));
    expect(onSelectRoute).toHaveBeenCalledWith('r-a');
    fireEvent.click(screen.getByTestId('api-mock-conflict-simulate'));
    expect(onSimulateWitness).toHaveBeenCalled();
  });

  it('shows the Conflicts guide when empty on the Conflicts page', () => {
    render(
      <ApiMockConflictInspector
        findings={[]}
        routes={routes}
        onAnalyze={vi.fn()}
        onOpenStudio={vi.fn()}
        stats={{ analyzedRules: 2, durationMs: 4 }}
      />,
    );
    expect(screen.getByTestId('api-mock-conflict-guide')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-dock-conflicts-empty')).toBeNull();
  });

  it('resolves peer labels for the match-tab notice', () => {
    expect(conflictPeerLabel([makeFinding()], 'r-a', routes)).toBe('GET /users/admin');
    expect(conflictPeerLabel([makeFinding()], 'r-b', routes)).toBe('GET /users/:id');
    expect(conflictPeerLabel([], 'r-a', routes)).toBeUndefined();
  });

  it('acknowledges findings and adjusts priority via the Adjust priority menu', () => {
    const onAcknowledge = vi.fn();
    const onAdjustPriority = vi.fn();
    render(
      <ApiMockConflictInspector
        findings={[makeFinding()]}
        routes={routes}
        onAcknowledge={onAcknowledge}
        onAdjustPriority={onAdjustPriority}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-conflict-acknowledge'));
    expect(onAcknowledge).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('api-mock-conflict-adjust-priority'));
    fireEvent.click(screen.getByTestId('api-mock-conflict-prio-left'));
    expect(onAdjustPriority).toHaveBeenCalledWith('r-a', 10);
    fireEvent.click(screen.getByTestId('api-mock-conflict-adjust-priority'));
    fireEvent.click(screen.getByTestId('api-mock-conflict-prio-right'));
    expect(onAdjustPriority).toHaveBeenCalledWith('r-b', 10);
  });

  it('shows stale acknowledgement and always lists filter kinds', () => {
    render(
      <ApiMockConflictInspector
        findings={[makeFinding({ acknowledgementStale: true })]}
        routes={routes}
        onAcknowledge={vi.fn()}
        onApply={vi.fn()}
        dirty
      />,
    );
    expect(screen.getByTestId('api-mock-conflict-stale')).toBeTruthy();
    expect(screen.getByTestId('api-mock-conflict-filter-shadowed')).toBeTruthy();
    expect(screen.getByTestId('api-mock-conflict-filter-unreachable')).toBeTruthy();
    expect(screen.getByTestId('api-mock-conflict-apply')).not.toBeDisabled();
    expect(screen.getByTestId('api-mock-conflict-acknowledge')).toBeTruthy();
  });

  it('shows acknowledgement banner when already acknowledged', () => {
    render(
      <ApiMockConflictInspector
        findings={[makeFinding({ acknowledgedAt: '2026-08-12T12:00:00.000Z' })]}
        routes={routes}
        onAcknowledge={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-conflict-ack')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-conflict-acknowledge')).toBeNull();
  });
});
