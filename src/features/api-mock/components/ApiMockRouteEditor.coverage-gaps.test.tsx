/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockRouteEditor } from './ApiMockRouteEditor';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockRouteV1 } from '../../../shared/api-mock/contracts';
import { CUSTOM_SELECT_SET_VALUE_EVENT } from '../../../shared/components/CustomSelect';

const ts = '2026-08-12T00:00:00.000Z';

vi.mock('./ApiMockResponseEditor', () => ({
  ApiMockResponseEditor: () => <div data-testid="mock-response-editor" />,
}));

vi.mock('./ApiMockPatternToolboxModal', () => ({
  ApiMockPatternToolboxModal: ({
    onApply,
    onApplyConditions,
    onClose,
    contextLabel,
  }: {
    onApply: (m: ApiMockRouteV1['path']) => void;
    onApplyConditions?: (preds: ApiMockRouteV1['predicates']['children']) => void;
    onClose: () => void;
    contextLabel?: string;
  }) => (
    <div data-testid="mock-pattern-toolbox">
      <span data-testid="mock-pattern-context">{contextLabel}</span>
      <button data-testid="mock-pattern-apply" onClick={() => onApply({ kind: 'glob', value: '/api/**' })}>apply</button>
      <button
        data-testid="mock-pattern-apply-conditions"
        onClick={() => onApplyConditions?.([{ id: 'pred-new', source: 'header', selector: 'x', operator: 'exact', expected: '1' }])}
      >apply conditions</button>
      <button data-testid="mock-pattern-close" onClick={onClose}>close</button>
    </div>
  ),
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
    expect(screen.getByText(/1 condition/)).toBeTruthy();

    const [selectorInput] = screen.getAllByLabelText('Condition selector') as HTMLInputElement[];
    expect(selectorInput.value).toBe('');
    const [valueInput] = screen.getAllByLabelText('Condition value') as HTMLInputElement[];
    expect(valueInput.value).toBe('');

    rerender(<ApiMockRouteEditor route={route} onUpdate={onUpdate} folderName="Core" matchCount={2} />);
    expect(document.querySelector('.am-editor-meta')?.textContent ?? '').toContain('2 matches');
  });

  it('covers conflict peer, review conflicts, folder filing, and predicate toolbox', () => {
    const onUpdate = vi.fn();
    const onReviewConflicts = vi.fn();
    const route = makeRoute({
      predicates: {
        id: 'pg',
        combinator: 'all',
        children: [{ id: 'pred-1', source: 'header', selector: 'x', operator: 'exact', expected: '1' }],
      } as any,
    });
    render(
      <ApiMockRouteEditor
        route={route}
        onUpdate={onUpdate}
        hasConflict
        conflictPeer="GET /admin"
        onReviewConflicts={onReviewConflicts}
        folders={[{ id: 'fld-1', name: 'Core', sortOrder: 0, expanded: true } as any]}
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-review-conflicts'));
    expect(onReviewConflicts).toHaveBeenCalled();

    openTab('Documentation');
    fireEvent(
      screen.getByTestId('api-mock-docs-folder'),
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'fld-1' }, bubbles: true }),
    );
    expect(onUpdate).toHaveBeenCalledWith({ folderId: 'fld-1' });
  });

  it('covers builder tab keyboard navigation', () => {
    render(<ApiMockRouteEditor route={makeRoute()} onUpdate={vi.fn()} />);
    const tablist = screen.getByRole('tablist', { name: 'Route editor sections' });
    const tabs = within(tablist).getAllByRole('tab');
    tabs[0].focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(tabs[1]).toHaveFocus();
  });

  it('covers nested group add/remove, jsonPath equals, pathParam toolbox, and path kind inference', () => {
    const onUpdate = vi.fn();
    const route = makeRoute({
      path: { kind: 'exact', value: '/users/:id' },
      predicates: {
        id: 'pg',
        combinator: 'all',
        children: [
          {
            id: 'nested',
            combinator: 'any',
            children: [{ id: 'pred-n', source: 'query', selector: 'q', operator: 'jsonPath_equals', expected: ['$.a', 'b'] }],
          },
          { id: 'pred-path', source: 'pathParam', selector: 'id', operator: 'glob', expected: '**' },
        ],
      } as any,
    });
    render(<ApiMockRouteEditor route={route} onUpdate={onUpdate} sequencePosition={3} />);

    fireEvent.click(screen.getByTestId('api-mock-add-group'));
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children.length).toBeGreaterThan(2);

    fireEvent.click(screen.getByTestId('api-mock-group-add-condition-nested'));
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[0].children.length).toBe(2);

    fireEvent(
      screen.getByTestId('api-mock-group-combinator-nested'),
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'not' }, bubbles: true }),
    );
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[0].combinator).toBe('not');

    fireEvent.change(screen.getByLabelText('Condition JSONPath'), { target: { value: '$.tier' } });
    fireEvent.change(screen.getAllByLabelText('Condition value')[0], { target: { value: 'gold' } });
    fireEvent.click(screen.getByTestId('api-mock-condition-matchstyle-pred-n'));
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[0].children[0].options.matchStyle).toBe('subset');

    fireEvent.click(screen.getByTestId('api-mock-condition-toolbox-pred-path'));
    expect(screen.getByTestId('mock-pattern-context').textContent).toContain('Path parameter');
    fireEvent.click(screen.getByTestId('mock-pattern-apply-conditions'));
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children.length).toBe(3);

    fireEvent.click(screen.getByTestId('api-mock-group-remove-nested'));
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children).toHaveLength(1);

    fireEvent.change(screen.getByTestId('api-mock-path-input'), { target: { value: '/users/**' } });
    expect(onUpdate.mock.calls.at(-1)?.[0].path.kind).toBe('glob');

    openTab('Response');
    expect(screen.getByTestId('mock-response-editor')).toBeTruthy();
  });

  it('covers xpath operators, empty folders hint, and conflict fallback peer', () => {
    const onUpdate = vi.fn();
    const route = makeRoute({
      folderId: 'fld-old',
      predicates: {
        id: 'pg',
        combinator: 'all',
        children: [{ id: 'pred-x', source: 'body', selector: '', operator: 'xpath_equals', expected: ['', ''] }],
      } as any,
    });
    render(
      <ApiMockRouteEditor route={route} onUpdate={onUpdate} hasConflict folders={[]} />,
    );
    expect(screen.getByText(/another rule/)).toBeTruthy();
    openTab('Documentation');
    expect(screen.getByText(/Create a folder in the rules panel first/)).toBeTruthy();
    fireEvent(
      screen.getByTestId('api-mock-docs-folder'),
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: '' }, bubbles: true }),
    );
    expect(onUpdate).toHaveBeenCalledWith({ folderId: undefined });

    openTab('Match');
    const xpathInput = screen.getByLabelText('Condition XPath') as HTMLInputElement;
    fireEvent.change(xpathInput, { target: { value: '//vin' } });
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[0].expected[0]).toBe('//vin');

    fireEvent(
      screen.getByTestId('api-mock-condition-operator-pred-x'),
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'jsonPath_exists' }, bubbles: true }),
    );
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[0].operator).toBe('jsonPath_exists');
  });
});
