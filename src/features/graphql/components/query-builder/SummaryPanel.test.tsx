/**
 * @vitest-environment jsdom
 *
 * SummaryPanel — unit tests.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummaryPanel } from './SummaryPanel';
import type { BuilderState } from '../../hooks/useGraphqlQueryBuilder';

vi.mock('../../utils/queryBuilderGenerator', () => ({
  findType: vi.fn((name: string, types: Array<{ name: string; fields?: unknown[] }>) =>
    types.find((t) => t.name === name) ?? null,
  ),
  getAncestorPaths: vi.fn((path: string) => {
    const parts = path.split('.');
    return parts.slice(0, -1).map((_: unknown, i: number) => parts.slice(0, i + 1).join('.'));
  }),
  getRootTypeName: vi.fn((_op: string, _schema: unknown) => 'Query'),
  searchFields: vi.fn(() => []),
  stripTypeModifiers: (t: string) => t.replace(/[![\]]/g, ''),
}));

import { searchFields as mockSearchFieldsRaw, getAncestorPaths as mockGetAncestorPathsRaw } from '../../utils/queryBuilderGenerator';
const mockSearchFields = vi.mocked(mockSearchFieldsRaw);
const mockGetAncestorPaths = vi.mocked(mockGetAncestorPathsRaw);

function makeState(overrides: Partial<BuilderState> = {}): BuilderState {
  return {
    operationType: 'query',
    operationName: '',
    selectedFields: {},
    expandedPaths: new Set(),
    argValues: {},
    searchQuery: '',
    ...overrides,
  };
}

function defaultProps(overrides = {}) {
  return {
    selectedCount: 0,
    maxDepth: 0,
    argsCount: 0,
    variablesCount: 0,
    schemaInfo: null,
    state: makeState(),
    onSetSearch: vi.fn(),
    onSearchExpand: vi.fn(),
    ...overrides,
  };
}

describe('SummaryPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the summary panel container', () => {
    render(<SummaryPanel {...defaultProps()} />);
    expect(screen.getByTestId('gql-qb-summary')).toBeInTheDocument();
  });

  it('shows selected fields count', () => {
    render(<SummaryPanel {...defaultProps({ selectedCount: 5 })} />);
    const labels = screen.getAllByText('5');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('shows nested depth', () => {
    render(<SummaryPanel {...defaultProps({ maxDepth: 3 })} />);
    const items = screen.getAllByText('3');
    expect(items.length).toBeGreaterThan(0);
  });

  it('does not show complexity when selectedCount is 0', () => {
    render(<SummaryPanel {...defaultProps({ selectedCount: 0 })} />);
    expect(screen.queryByText('Est. complexity')).toBeNull();
  });

  it('shows complexity=0 when selectedCount>0 but schemaInfo is null', () => {
    render(<SummaryPanel {...defaultProps({ selectedCount: 3, schemaInfo: null })} />);
    expect(screen.queryByText('Est. complexity')).toBeNull();
  });

  it('shows complexity row when there are selected fields and schemaInfo', () => {
    const schemaInfo = {
      queryType: 'Query',
      types: [{ name: 'Query', kind: 'OBJECT' as const, fields: [{ name: 'user', type: 'String', args: [], isDeprecated: false }] }],
    };
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          schemaInfo,
          state: makeState({ selectedFields: { user: true } }),
        })}
      />,
    );
    expect(screen.getByText('Est. complexity')).toBeInTheDocument();
  });

  it('adds extra cost for list-type fields in complexity calculation', async () => {
    const { findType } = await import('../../utils/queryBuilderGenerator');
    vi.mocked(findType).mockReturnValue({
      name: 'Query',
      kind: 'OBJECT',
      fields: [{ name: 'items', type: '[Item]', args: [], isDeprecated: false }],
    });
    const schemaInfo = { queryType: 'Query', types: [{ name: 'Query', kind: 'OBJECT' as const, fields: [] }] };
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          schemaInfo,
          state: makeState({ selectedFields: { 'items': true } }),
        })}
      />,
    );
    // complexity should be > 0 (at least 1 + 2 for list type)
    expect(screen.getByText('Est. complexity')).toBeInTheDocument();
  });

  it('stops complexity walk when parent type has no fields', async () => {
    const { findType } = await import('../../utils/queryBuilderGenerator');
    vi.mocked(findType).mockImplementation((name: string) => {
      if (name === 'Query') {
        return { name: 'Query', kind: 'OBJECT', fields: [{ name: 'user', type: 'User', args: [], isDeprecated: false }] };
      }
      return { name: 'User', kind: 'OBJECT' };
    });
    const schemaInfo = { queryType: 'Query', types: [] };
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          schemaInfo,
          state: makeState({ selectedFields: { 'user.name': true } }),
        })}
      />,
    );
    expect(screen.getByText('Est. complexity')).toBeInTheDocument();
    expect(screen.getByTitle('Estimated query complexity score')).toHaveTextContent('1');
  });

  it('stops complexity walk when field is not found on parent type', async () => {
    const { findType } = await import('../../utils/queryBuilderGenerator');
    vi.mocked(findType).mockReturnValue({
      name: 'Query',
      kind: 'OBJECT',
      fields: [{ name: 'user', type: 'User', args: [], isDeprecated: false }],
    });
    const schemaInfo = { queryType: 'Query', types: [] };
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          schemaInfo,
          state: makeState({ selectedFields: { 'missing.path': true } }),
        })}
      />,
    );
    expect(screen.getByTitle('Estimated query complexity score')).toHaveTextContent('1');
  });

  it('applies warn complexity class when score exceeds 80', async () => {
    const { findType } = await import('../../utils/queryBuilderGenerator');
    vi.mocked(findType).mockReturnValue({
      name: 'Query',
      kind: 'OBJECT',
      fields: [{ name: 'items', type: '[Item]', args: [], isDeprecated: false }],
    });
    const selectedFields = Object.fromEntries(
      Array.from({ length: 85 }, (_, i) => [`field${i}`, true]),
    );
    const schemaInfo = { queryType: 'Query', types: [] };
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 85,
          schemaInfo,
          state: makeState({ selectedFields }),
        })}
      />,
    );
    expect(screen.getByTitle('Estimated query complexity score')).toHaveClass('gql-qb-summary-value--warn');
  });

  it('applies danger complexity class when score exceeds 150', async () => {
    const { findType } = await import('../../utils/queryBuilderGenerator');
    vi.mocked(findType).mockReturnValue({
      name: 'Query',
      kind: 'OBJECT',
      fields: [{ name: 'items', type: '[Item]', args: [], isDeprecated: false }],
    });
    const selectedFields = Object.fromEntries(
      Array.from({ length: 155 }, (_, i) => [`field${i}`, true]),
    );
    const schemaInfo = { queryType: 'Query', types: [] };
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 155,
          schemaInfo,
          state: makeState({ selectedFields }),
        })}
      />,
    );
    expect(screen.getByTitle('Estimated query complexity score')).toHaveClass('gql-qb-summary-value--danger');
  });

  it('renders the field path search input', () => {
    render(<SummaryPanel {...defaultProps()} />);
    expect(screen.getByTestId('gql-qb-path-search')).toBeInTheDocument();
  });

  it('shows no-results message when search has no matches', () => {
    render(<SummaryPanel {...defaultProps({ schemaInfo: { queryType: 'Query', types: [] } })} />);
    const input = screen.getByTestId('gql-qb-path-search');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    expect(screen.getByText(/No paths found for/)).toBeInTheDocument();
  });

  it('clears results when search is cleared', () => {
    mockSearchFields.mockReturnValueOnce([{ path: 'user.id', fieldName: 'id', fieldType: 'ID' }]);

    render(<SummaryPanel {...defaultProps({ schemaInfo: { queryType: 'Query', types: [] } })} />);
    const input = screen.getByTestId('gql-qb-path-search');
    fireEvent.change(input, { target: { value: 'id' } });
    fireEvent.change(input, { target: { value: '' } });

    // After clearing, the no-results message should not appear
    expect(screen.queryByText(/No paths found/)).toBeNull();
  });

  it('calls onSearchExpand and onSetSearch when a path result is clicked', () => {
    mockSearchFields.mockReturnValue([{ path: 'user.id', fieldName: 'id', fieldType: 'ID' }]);
    mockGetAncestorPaths.mockReturnValue(['user']);

    const onSearchExpand = vi.fn();
    const onSetSearch = vi.fn();
    render(
      <SummaryPanel
        {...defaultProps({
          schemaInfo: { queryType: 'Query', types: [] },
          onSearchExpand,
          onSetSearch,
        })}
      />,
    );
    const input = screen.getByTestId('gql-qb-path-search');
    fireEvent.change(input, { target: { value: 'id' } });

    const resultBtn = screen.getByTitle('Navigate to: user.id');
    fireEvent.click(resultBtn);

    expect(onSearchExpand).toHaveBeenCalledWith(['user']);
    expect(onSetSearch).toHaveBeenCalledWith('id');
  });

  it('renders keyboard shortcuts section', () => {
    render(<SummaryPanel {...defaultProps()} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Toggle field')).toBeInTheDocument();
  });
});
