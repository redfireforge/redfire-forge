/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockRouteEditor } from './ApiMockRouteEditor';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockRouteV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

vi.mock('./ApiMockResponseEditor', () => ({
  ApiMockResponseEditor: () => <div data-testid="mock-response-editor" />,
}));

vi.mock('./ApiMockPatternToolboxModal', () => ({
  ApiMockPatternToolboxModal: () => <div data-testid="mock-pattern-toolbox" />,
}));

function makeRoute(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'route-1',
    name: 'Route 1',
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/users' },
    priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules',
    responses: [createDefaultResponse('resp-1')],
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function openTab(label: string) {
  const list = screen.getByRole('tablist', { name: 'Route editor sections' });
  fireEvent.click(within(list).getAllByRole('tab').find(t => t.textContent?.trim().startsWith(label))!);
}

describe('ApiMockRouteEditor coverage gaps', () => {
  it('covers examples-grid click handler and docs summary update branch', () => {
    const onUpdate = vi.fn();
    const onSimulate = vi.fn();
    const route = makeRoute();
    const samples = [{
      id: 's1',
      routeId: route.id,
      name: 'Sample 1',
      request: { method: 'GET', path: '/users', query: {}, headers: {}, body: null },
      expected: { outcome: 'matched', status: 200 },
      createdAt: ts,
    }] as any;

    render(<ApiMockRouteEditor route={route} onUpdate={onUpdate} onSimulate={onSimulate} samples={samples} />);

    openTab('Examples');
    fireEvent.click(screen.getByTestId('api-mock-example-s1'));
    expect(onSimulate).toHaveBeenCalledTimes(1);

    openTab('Documentation');
    fireEvent.change(screen.getByTestId('api-mock-docs-summary'), { target: { value: 'Updated summary' } });
    expect(onUpdate).toHaveBeenCalledWith({ name: 'Updated summary' });
  });

  it('covers remaining match-tab conditional branches', () => {
    const onUpdate = vi.fn();
    const route = makeRoute({
      id: 'route-very-long-12345',
      method: 'ANY',
      enabled: false,
      path: { kind: 'exact', value: '' },
      operationId: 'getUsers',
      responses: [{ ...createDefaultResponse('resp-a'), isDefault: false }],
      predicates: {
        id: 'pg',
        combinator: 'all',
        children: [{ id: 'pred-x', source: 'header', selector: undefined, operator: 'exact', expected: 1 }],
      } as any,
    });

    const { rerender } = render(
      <ApiMockRouteEditor route={route} onUpdate={onUpdate} folderName="Core" matchCount={1} />,
    );

    const meta = document.querySelector('.am-editor-meta')?.textContent ?? '';
    expect(screen.getByTestId('api-mock-route-title').textContent).toBe('ANY /');
    expect(meta).toContain('Rule ID route-very-l');
    expect(meta).toContain('1 match');
    expect(meta).toContain('op getUsers');
    expect(screen.getByTestId('api-mock-route-enabled').getAttribute('title')).toBe('Enable route');
    expect(screen.getByText(/All of 1/)).toBeTruthy();

    const [selectorInput] = screen.getAllByLabelText('Condition selector') as HTMLInputElement[];
    expect(selectorInput.value).toBe('');
    const [valueInput] = screen.getAllByLabelText('Condition value') as HTMLInputElement[];
    expect(valueInput.value).toBe('');

    rerender(<ApiMockRouteEditor route={route} onUpdate={onUpdate} folderName="Core" matchCount={2} />);
    expect(document.querySelector('.am-editor-meta')?.textContent ?? '').toContain('2 matches');
  });
});
