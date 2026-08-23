/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockConflictInspector, conflictPeerLabel } from './ApiMockConflictInspector';
import { createDefaultResponse, EMPTY_PREDICATE_GROUP } from '@shared/api-mock/defaults';
import type { ApiMockConflictFindingV1, ApiMockRouteV1 } from '@shared/api-mock/contracts';

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
    severity: 'info',
    dimensions: [
      { source: 'method', selector: 'GET', result: 'disjoint', explanation: 'Method differs' },
      { source: 'path', result: 'unknown', explanation: '' },
    ],
    selectionOutcome: 'reject_ambiguous',
    ruleFingerprints: ['fp1', 'fp2'],
    ...overrides,
  };
}

describe('ApiMockConflictInspector coverage gaps', () => {
  const routes = [makeRoute('r-a', '/users/:id', 20), makeRoute('r-b', '/users/admin', 20)];

  it('covers focus-route initial selection, empty filter after rerender, and right-side navigation', () => {
    const onSelectRoute = vi.fn();
    const dup = makeFinding({ id: 'cf-dup', kind: 'duplicate', severity: 'error' });
    const { rerender } = render(
      <ApiMockConflictInspector findings={[makeFinding(), dup]} routes={routes} focusRouteId="r-b" onSelectRoute={onSelectRoute} />,
    );

    expect(screen.getByTestId('api-mock-conflict-detail').textContent).toMatch(/409|reject ambiguous/i);
    expect(screen.getByTestId('api-mock-conflict-detail').textContent).toContain('Method differs');

    expect(screen.getByTestId('api-mock-conflict-dimensions')).toBeTruthy();
    expect(screen.getAllByTestId('api-mock-conflict-dim-row').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-testid="api-mock-conflict-dim-row"][data-result="unknown"]')).toBeTruthy();

    fireEvent.click(screen.getByTestId('api-mock-conflict-goto-right'));
    expect(onSelectRoute).toHaveBeenCalledWith('r-b');

    fireEvent.click(screen.getByTestId('api-mock-conflict-filter-duplicate'));
    rerender(<ApiMockConflictInspector findings={[makeFinding()]} routes={routes} focusRouteId="r-b" onSelectRoute={onSelectRoute} />);
    expect(screen.getByTestId('api-mock-conflict-filter-empty')).toBeTruthy();
    expect(screen.getByText('No findings in this filter.')).toBeTruthy();
  });

  it('scrolls the Adjust priority menu into view when it opens', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <ApiMockConflictInspector
        findings={[makeFinding()]}
        routes={routes}
        onAdjustPriority={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-conflict-adjust-priority'));
    expect(screen.getByTestId('api-mock-conflict-prio-menu')).toBeTruthy();
    expect(screen.getByTestId('api-mock-conflict-prio-left').textContent).toMatch(/Raise/);
    expect(screen.getByTestId('api-mock-conflict-prio-right').textContent).toMatch(/Raise/);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('covers empty findings and peer-label fallback when the peer route is missing', () => {
    render(<ApiMockConflictInspector findings={[]} routes={routes} />);
    expect(screen.getByTestId('api-mock-dock-conflicts-empty')).toBeTruthy();

    expect(conflictPeerLabel([makeFinding({ ruleIds: ['r-a', 'missing-long-id'] })], 'r-a', routes)).toBe('missing-');
  });
});
