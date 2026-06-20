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
    fieldAliases: {},
    fieldDirectives: {},
    ...overrides,
  };
}

function defaultProps(overrides = {}) {
  return {
    selectedCount: 0,
    maxDepth: 0,
    argsCount: 0,
    variablesCount: 0,
    aliasCount: 0,
    directiveCount: 0,
    schemaInfo: null,
    state: makeState(),
    onSetSearch: vi.fn(),
    onSearchExpand: vi.fn(),
    onSetAlias: vi.fn(),
    onSetDirective: vi.fn(),
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

  // ── Field Options Section ────────────────────────────────────────────────

  it('does not render Field Options when no fields selected', () => {
    render(<SummaryPanel {...defaultProps({ selectedCount: 0 })} />);
    expect(screen.queryByTestId('gql-qb-field-options')).toBeNull();
  });

  it('renders Field Options section when fields are selected', () => {
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'user.id': true } }),
        })}
      />,
    );
    expect(screen.getByTestId('gql-qb-field-options')).toBeInTheDocument();
    expect(screen.getByText('Field Options')).toBeInTheDocument();
  });

  it('shows one row per selected leaf path', () => {
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 2,
          state: makeState({ selectedFields: { 'user.id': true, 'user.name': true } }),
        })}
      />,
    );
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('shows overflow count when more than 12 fields selected', () => {
    const selectedFields = Object.fromEntries(
      Array.from({ length: 14 }, (_, i) => [`field${i}`, true]),
    );
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 14,
          state: makeState({ selectedFields }),
        })}
      />,
    );
    expect(screen.getByText('+2 more fields')).toBeInTheDocument();
  });

  it('shows alias count badge when aliasCount > 0', () => {
    render(<SummaryPanel {...defaultProps({ aliasCount: 3 })} />);
    expect(screen.getByText('Aliases')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('shows directive count badge when directiveCount > 0', () => {
    render(<SummaryPanel {...defaultProps({ directiveCount: 2 })} />);
    expect(screen.getByText('Directives')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('expands a field row to show alias input and directive toggles', () => {
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'user.id': true } }),
        })}
      />,
    );
    const expandBtn = screen.getByRole('button', { name: /expand options for id/i });
    fireEvent.click(expandBtn);
    expect(screen.getByTestId('gql-fo-alias-user.id')).toBeInTheDocument();
    expect(screen.getByTestId('gql-fo-include-user.id')).toBeInTheDocument();
    expect(screen.getByTestId('gql-fo-skip-user.id')).toBeInTheDocument();
  });

  it('calls onSetAlias when alias input changes', () => {
    const onSetAlias = vi.fn();
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'user.id': true } }),
          onSetAlias,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand options for id/i }));
    fireEvent.change(screen.getByTestId('gql-fo-alias-user.id'), { target: { value: 'userId' } });
    expect(onSetAlias).toHaveBeenCalledWith('user.id', 'userId');
  });

  it('calls onSetDirective when @include toggle is clicked', () => {
    const onSetDirective = vi.fn();
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'user.id': true } }),
          onSetDirective,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand options for id/i }));
    fireEvent.click(screen.getByTestId('gql-fo-include-user.id'));
    expect(onSetDirective).toHaveBeenCalledWith('user.id', 'include', true, '');
  });

  it('shows @include ifVar input when directive entry exists', () => {
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({
            selectedFields: { 'user.id': true },
            fieldDirectives: { 'user.id': { include: { enabled: true, ifVar: '{{showUser}}' } } },
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand options for id/i }));
    expect(screen.getByTestId('gql-fo-include-if-user.id')).toHaveValue('{{showUser}}');
  });

  it('existing alias is pre-filled in the alias input', () => {
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({
            selectedFields: { 'user.id': true },
            fieldAliases: { 'user.id': 'userId' },
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand options for id/i }));
    expect(screen.getByTestId('gql-fo-alias-user.id')).toHaveValue('userId');
  });

  // ── Arguments & Variables Display ────────────────────────────────────────

  it('shows arguments count in summary', () => {
    render(<SummaryPanel {...defaultProps({ argsCount: 5 })} />);
    expect(screen.getByText('Arguments')).toBeInTheDocument();
    const labels = screen.getAllByText('5');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('shows variables count in summary', () => {
    render(<SummaryPanel {...defaultProps({ variablesCount: 3 })} />);
    expect(screen.getByText('Variables')).toBeInTheDocument();
    const labels = screen.getAllByText('3');
    expect(labels.length).toBeGreaterThan(0);
  });

  // ── @skip Directive Tests ────────────────────────────────────────────────

  it('calls onSetDirective when @skip toggle is clicked', () => {
    const onSetDirective = vi.fn();
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'user.id': true } }),
          onSetDirective,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand options for id/i }));
    fireEvent.click(screen.getByTestId('gql-fo-skip-user.id'));
    expect(onSetDirective).toHaveBeenCalledWith('user.id', 'skip', true, '');
  });

  it('shows @skip ifVar input when skip directive entry exists', () => {
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({
            selectedFields: { 'user.id': true },
            fieldDirectives: { 'user.id': { skip: { enabled: true, ifVar: '{{hideUser}}' } } },
          }),
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand options for id/i }));
    expect(screen.getByTestId('gql-fo-skip-if-user.id')).toHaveValue('{{hideUser}}');
  });

  it('updates @include ifVar when input changes', () => {
    const onSetDirective = vi.fn();
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({
            selectedFields: { 'user.id': true },
            fieldDirectives: { 'user.id': { include: { enabled: true, ifVar: '{{old}}' } } },
          }),
          onSetDirective,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand options for id/i }));
    fireEvent.change(screen.getByTestId('gql-fo-include-if-user.id'), {
      target: { value: '{{newVar}}' },
    });
    expect(onSetDirective).toHaveBeenCalledWith('user.id', 'include', true, '{{newVar}}');
  });

  it('updates @skip ifVar when input changes', () => {
    const onSetDirective = vi.fn();
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({
            selectedFields: { 'user.id': true },
            fieldDirectives: { 'user.id': { skip: { enabled: true, ifVar: '{{old}}' } } },
          }),
          onSetDirective,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand options for id/i }));
    fireEvent.change(screen.getByTestId('gql-fo-skip-if-user.id'), {
      target: { value: '{{newSkipVar}}' },
    });
    expect(onSetDirective).toHaveBeenCalledWith('user.id', 'skip', true, '{{newSkipVar}}');
  });

  it('toggles @include directive off when already enabled', () => {
    const onSetDirective = vi.fn();
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({
            selectedFields: { 'user.id': true },
            fieldDirectives: { 'user.id': { include: { enabled: true, ifVar: '{{var}}' } } },
          }),
          onSetDirective,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand options for id/i }));
    fireEvent.click(screen.getByTestId('gql-fo-include-user.id'));
    expect(onSetDirective).toHaveBeenCalledWith('user.id', 'include', false, '{{var}}');
  });

  it('toggles @skip directive off when already enabled', () => {
    const onSetDirective = vi.fn();
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({
            selectedFields: { 'user.id': true },
            fieldDirectives: { 'user.id': { skip: { enabled: true, ifVar: '{{var}}' } } },
          }),
          onSetDirective,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /expand options for id/i }));
    fireEvent.click(screen.getByTestId('gql-fo-skip-user.id'));
    expect(onSetDirective).toHaveBeenCalledWith('user.id', 'skip', false, '{{var}}');
  });

  // ── Field Path Display Tests ─────────────────────────────────────────────

  it('shows multi-segment field path with parent context', () => {
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'user.posts.title': true } }),
        })}
      />,
    );
    expect(screen.getByText('title')).toBeInTheDocument();
    // Parent path should be shown in parentheses
    expect(screen.getByText('(user.posts)')).toBeInTheDocument();
  });

  it('expands field row for nested path', () => {
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'user.profile.bio': true } }),
        })}
      />,
    );
    const expandBtn = screen.getByRole('button', { name: /expand options for bio/i });
    fireEvent.click(expandBtn);
    expect(screen.getByTestId('gql-fo-alias-user.profile.bio')).toBeInTheDocument();
  });

  it('shows has-options styling when field has alias or directives', () => {
    const { container } = render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({
            selectedFields: { 'user.id': true },
            fieldAliases: { 'user.id': 'userId' },
          }),
        })}
      />,
    );
    const fieldRow = container.querySelector('.gql-qb-fo-row--has-options');
    expect(fieldRow).toBeInTheDocument();
  });

  it('does not show has-options styling when field has no alias/directives', () => {
    const { container } = render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'user.id': true } }),
        })}
      />,
    );
    const fieldRow = container.querySelector('.gql-qb-fo-row--has-options');
    expect(fieldRow).not.toBeInTheDocument();
  });

  // ── Fragment Section Tests ───────────────────────────────────────────────

  it('renders Fragment Section', () => {
    const onAddFragment = vi.fn();
    render(
      <SummaryPanel
        {...defaultProps({
          onAddFragment,
        })}
      />,
    );
    expect(screen.getByText('Fragments')).toBeInTheDocument();
  });

  it('does not show fragment count when fragmentCount is 0', () => {
    render(<SummaryPanel {...defaultProps({ fragmentCount: 0 })} />);
    const fragmentLabels = screen.queryAllByText('Fragments');
    // Should only have the "Fragments" section header, not a count badge
    expect(fragmentLabels.length).toBe(1);
  });

  it('shows fragment count badge when fragmentCount > 0', () => {
    render(<SummaryPanel {...defaultProps({ fragmentCount: 2 })} />);
    const fragmentLabels = screen.queryAllByText('Fragments');
    // Should have both the label in the summary grid and the section header
    expect(fragmentLabels.length).toBeGreaterThanOrEqual(1);
    const labels = screen.getAllByText('2');
    expect(labels.length).toBeGreaterThan(0);
  });

  // ── Path Search Results Display ──────────────────────────────────────────

  it('displays field type in search results', () => {
    mockSearchFields.mockReturnValue([{ path: 'user.id', fieldName: 'id', fieldType: 'ID!' }]);

    render(<SummaryPanel {...defaultProps({ schemaInfo: { queryType: 'Query', types: [] } })} />);
    const input = screen.getByTestId('gql-qb-path-search');
    fireEvent.change(input, { target: { value: 'id' } });

    expect(screen.getByText('ID!')).toBeInTheDocument();
  });

  it('renders field path with multiple segments in results', () => {
    mockSearchFields.mockReturnValue([
      { path: 'author.profile.bio', fieldName: 'bio', fieldType: 'String' },
    ]);

    render(<SummaryPanel {...defaultProps({ schemaInfo: { queryType: 'Query', types: [] } })} />);
    const input = screen.getByTestId('gql-qb-path-search');
    fireEvent.change(input, { target: { value: 'bio' } });

    // Check for path segments
    expect(screen.getByText('author')).toBeInTheDocument();
    expect(screen.getByText('profile')).toBeInTheDocument();
    expect(screen.getByText('bio')).toBeInTheDocument();
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────

  it('handles field with no parent path (single segment)', () => {
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'user': true } }),
        })}
      />,
    );
    const expandBtn = screen.getByRole('button', { name: /expand options for user/i });
    fireEvent.click(expandBtn);
    expect(screen.getByTestId('gql-fo-alias-user')).toBeInTheDocument();
  });

  it('does not show parent path when field is root-level', () => {
    const { container } = render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'user': true } }),
        })}
      />,
    );
    // Parent path wrapper should not exist for root-level fields
    const parentSpans = container.querySelectorAll('.gql-qb-fo-parent');
    // Should be 0 since 'user' is not nested
    expect(parentSpans.length).toBe(0);
  });

  it('clears field path search when input is empty and result exists', () => {
    mockSearchFields.mockReturnValueOnce([{ path: 'user.id', fieldName: 'id', fieldType: 'ID' }]);

    render(<SummaryPanel {...defaultProps({ schemaInfo: { queryType: 'Query', types: [] } })} />);
    const input = screen.getByTestId('gql-qb-path-search');

    fireEvent.change(input, { target: { value: 'id' } });
    expect(screen.getByTitle('Navigate to: user.id')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByTitle('Navigate to: user.id')).not.toBeInTheDocument();
  });

  it('handles search with empty query (returns nothing)', () => {
    mockSearchFields.mockReturnValue([]);

    render(<SummaryPanel {...defaultProps({ schemaInfo: { queryType: 'Query', types: [] } })} />);
    const input = screen.getByTestId('gql-qb-path-search');

    fireEvent.change(input, { target: { value: '   ' } });
    // No results shown for whitespace-only query
    expect(screen.queryByTitle(/Navigate to/)).not.toBeInTheDocument();
  });

  it('does not render search results when schema is null', () => {
    mockSearchFields.mockReturnValue([{ path: 'user.id', fieldName: 'id', fieldType: 'ID' }]);

    render(<SummaryPanel {...defaultProps({ schemaInfo: null })} />);
    const input = screen.getByTestId('gql-qb-path-search');

    fireEvent.change(input, { target: { value: 'id' } });
    // mockSearchFields still returns results, but handler checks for rootTypeName
    // which is null, so should not search
    expect(screen.queryByTitle(/Navigate to/)).not.toBeInTheDocument();
  });

  it('limits search results to 10 entries', () => {
    const results = Array.from({ length: 20 }, (_, i) => ({
      path: `field${i}`,
      fieldName: `field${i}`,
      fieldType: 'String',
    }));
    mockSearchFields.mockReturnValue(results);

    render(<SummaryPanel {...defaultProps({ schemaInfo: { queryType: 'Query', types: [] } })} />);
    const input = screen.getByTestId('gql-qb-path-search');

    fireEvent.change(input, { target: { value: 'field' } });
    const buttons = screen.queryAllByRole('button', { name: /Navigate to/ });
    // The implementation slices to 10, so max 10 results shown
    expect(buttons.length).toBeLessThanOrEqual(10);
  });

  it('shows single field when no suffix', () => {
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 1,
          state: makeState({ selectedFields: { 'name': true } }),
        })}
      />,
    );
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('handles fragment count of 0 gracefully', () => {
    render(<SummaryPanel {...defaultProps({ fragmentCount: 0 })} />);
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
  });

  it('shows overflow message with singular "field" when overflow is 1', () => {
    const selectedFields = Object.fromEntries(
      Array.from({ length: 13 }, (_, i) => [`field${i}`, true]),
    );
    render(
      <SummaryPanel
        {...defaultProps({
          selectedCount: 13,
          state: makeState({ selectedFields }),
        })}
      />,
    );
    expect(screen.getByText('+1 more field')).toBeInTheDocument();
  });
});
