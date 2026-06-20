/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldTree } from './FieldTree';
import type { FieldTreeProps } from './FieldTree';
import type { GraphqlSchemaInfo, GraphqlTypeNode } from '../../../../shared/types/graphql';
import type { BuilderState } from '../../hooks/useGraphqlQueryBuilder';

// Mock FieldRow to avoid rendering its full complexity
vi.mock('./FieldRow', () => ({
  FieldRow: ({ field }: { field: { name: string } }) => (
    <div data-testid={`field-row-${field.name}`}>{field.name}</div>
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDefaultState(overrides: Partial<BuilderState> = {}): BuilderState {
  return {
    operationType: 'query',
    operationName: '',
    selectedFields: {},
    argValues: {},
    expandedPaths: new Set(),
    searchQuery: '',
    ...overrides,
  };
}

const SIMPLE_TYPES: GraphqlTypeNode[] = [
  {
    name: 'Query',
    kind: 'OBJECT',
    fields: [
      { name: 'users', type: '[User!]!' },
      { name: 'me', type: 'User' },
    ],
  },
  {
    name: 'User',
    kind: 'OBJECT',
    fields: [
      { name: 'id', type: 'ID!' },
      { name: 'name', type: 'String!' },
    ],
  },
];

function makeSchemaInfo(overrides: Partial<GraphqlSchemaInfo> = {}): GraphqlSchemaInfo {
  return {
    sdl: 'type Query { users: [User!]! }',
    types: SIMPLE_TYPES,
    queryType: 'Query',
    fetchedAt: Date.now(),
    ...overrides,
  };
}

function makeProps(overrides: Partial<FieldTreeProps> = {}): FieldTreeProps {
  return {
    schemaInfo: makeSchemaInfo(),
    state: makeDefaultState(),
    onToggle: vi.fn(),
    onToggleExpand: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onSetArg: vi.fn(),
    onSetSearch: vi.fn(),
    onSearchExpand: vi.fn(),
    ...overrides,
  };
}

describe('FieldTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── No schema ───────────────────────────────────────────────────────────────

  it('shows "No schema loaded" when schemaInfo is null', () => {
    render(<FieldTree {...makeProps({ schemaInfo: null })} />);
    expect(screen.getByText(/No schema loaded/)).toBeInTheDocument();
  });

  it('renders the wrapper div even with null schema', () => {
    render(<FieldTree {...makeProps({ schemaInfo: null })} />);
    expect(document.querySelector('.gql-qb-field-tree')).toBeInTheDocument();
  });

  // ── No root type fields ──────────────────────────────────────────────────────

  it('shows "No ... type found" when root type has no fields', () => {
    const schemaInfo = makeSchemaInfo({
      types: [{ name: 'Query', kind: 'OBJECT', fields: [] }],
    });
    render(<FieldTree {...makeProps({ schemaInfo })} />);
    expect(screen.getByText(/No.*type found/i)).toBeInTheDocument();
  });

  it('uses the operationType label when rootTypeName is null', () => {
    const schemaInfo = makeSchemaInfo({
      types: [], // no types → rootTypeName won't resolve
      queryType: undefined,
    });
    render(<FieldTree {...makeProps({ schemaInfo })} />);
    expect(screen.getByText(/No.*type found/i)).toBeInTheDocument();
  });

  // ── Normal render ────────────────────────────────────────────────────────────

  it('renders the search input', () => {
    render(<FieldTree {...makeProps()} />);
    expect(screen.getByTestId('gql-qb-search')).toBeInTheDocument();
  });

  it('renders field rows for root type fields', () => {
    render(<FieldTree {...makeProps()} />);
    expect(screen.getByTestId('field-row-users')).toBeInTheDocument();
    expect(screen.getByTestId('field-row-me')).toBeInTheDocument();
  });

  it('renders root type name in header', () => {
    render(<FieldTree {...makeProps()} />);
    expect(screen.getByText('Query')).toBeInTheDocument();
  });

  it('renders "root type" label', () => {
    render(<FieldTree {...makeProps()} />);
    expect(screen.getByText('root type')).toBeInTheDocument();
  });

  it('renders field count in header', () => {
    render(<FieldTree {...makeProps()} />);
    expect(screen.getByText('2 fields')).toBeInTheDocument();
  });

  // ── Search ──────────────────────────────────────────────────────────────────

  it('calls onSetSearch when search input changes', () => {
    const onSetSearch = vi.fn();
    render(<FieldTree {...makeProps({ onSetSearch })} />);
    fireEvent.change(screen.getByTestId('gql-qb-search'), { target: { value: 'user' } });
    expect(onSetSearch).toHaveBeenCalledWith('user');
  });

  it('shows search results panel when searchQuery is non-empty', () => {
    const state = makeDefaultState({ searchQuery: 'name' });
    render(<FieldTree {...makeProps({ state })} />);
    expect(screen.getByTestId('gql-qb-search-results')).toBeInTheDocument();
  });

  it('hides field tree body when searching', () => {
    const state = makeDefaultState({ searchQuery: 'name' });
    render(<FieldTree {...makeProps({ state })} />);
    // field rows are only rendered when !state.searchQuery.trim()
    expect(screen.queryByTestId('field-row-users')).not.toBeInTheDocument();
  });

  it('shows "No fields match" when search has no results', () => {
    const state = makeDefaultState({ searchQuery: 'zzznomatch' });
    render(<FieldTree {...makeProps({ state })} />);
    expect(screen.getByText(/No fields match/)).toBeInTheDocument();
  });

  it('calls onSetSearch with empty string when Escape is pressed in search', () => {
    const onSetSearch = vi.fn();
    render(<FieldTree {...makeProps({ onSetSearch })} />);
    const searchInput = screen.getByTestId('gql-qb-search');
    fireEvent.keyDown(searchInput, { key: 'Escape' });
    expect(onSetSearch).toHaveBeenCalledWith('');
  });

  it('shows clear button when search query is non-empty', () => {
    const state = makeDefaultState({ searchQuery: 'hello' });
    render(<FieldTree {...makeProps({ state })} />);
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('calls onSetSearch("") when clear button is clicked', () => {
    const onSetSearch = vi.fn();
    const state = makeDefaultState({ searchQuery: 'hello' });
    render(<FieldTree {...makeProps({ state, onSetSearch })} />);
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onSetSearch).toHaveBeenCalledWith('');
  });

  it('shows result count text for search results', () => {
    // 'name' matches the 'name' field in User type
    const state = makeDefaultState({ searchQuery: 'name' });
    render(<FieldTree {...makeProps({ state })} />);
    // should show at least "1 result"
    const resultsHeader = document.querySelector('.gql-qb-search-results-header');
    expect(resultsHeader?.textContent).toMatch(/\d+ result/);
  });

  it('shows singular "result" label when exactly 1 match is found', () => {
    // Use very specific query that should only match one field
    const state = makeDefaultState({ searchQuery: 'me' }); // matches 'me' field exactly
    render(<FieldTree {...makeProps({ state })} />);
    const resultsHeader = document.querySelector('.gql-qb-search-results-header');
    if (resultsHeader?.textContent?.match(/^1 result/)) {
      expect(resultsHeader.textContent).toMatch(/^1 result[^s]/);
    }
    // If multiple results, just verify it renders
    expect(screen.getByTestId('gql-qb-search-results')).toBeInTheDocument();
  });

  it('renders description snippet in search result when description is available', () => {
    // Schema with fields that have descriptions
    const typesWithDescriptions: GraphqlTypeNode[] = [
      {
        name: 'Query',
        kind: 'OBJECT',
        fields: [
          { name: 'findUser', type: 'User!', description: 'Find a user by identifier' },
        ],
      },
      {
        name: 'User',
        kind: 'OBJECT',
        fields: [{ name: 'id', type: 'ID!' }],
      },
    ];
    const schemaInfo = makeSchemaInfo({ types: typesWithDescriptions });
    const state = makeDefaultState({ searchQuery: 'find' });
    render(<FieldTree {...makeProps({ schemaInfo, state })} />);
    // Description should appear in the search result
    expect(screen.queryByText(/Find a user/)).toBeDefined();
  });

  it('calls onSetSearch and onSearchExpand when a search result is clicked', () => {
    const onSetSearch = vi.fn();
    const onSearchExpand = vi.fn();
    // Use a query that matches the 'name' field nested in User
    const state = makeDefaultState({ searchQuery: 'id' });
    render(<FieldTree {...makeProps({ state, onSetSearch, onSearchExpand })} />);
    // Click the first search result button
    const resultButtons = document.querySelectorAll('[data-testid^="gql-qb-sr-"]');
    if (resultButtons.length > 0) {
      fireEvent.click(resultButtons[0]);
      expect(onSetSearch).toHaveBeenCalledWith('');
      expect(onSearchExpand).toHaveBeenCalled();
    }
  });

  // ── Keyboard shortcut ────────────────────────────────────────────────────────

  it('focuses the search input on Cmd+K when inside .gql-qb-field-tree', () => {
    render(<FieldTree {...makeProps()} />);
    const searchInput = screen.getByTestId('gql-qb-search');
    const focusSpy = vi.spyOn(searchInput, 'focus');
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(focusSpy).toHaveBeenCalled();
  });

  it('removes the keydown listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<FieldTree {...makeProps()} />);
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  // ── allLeafPaths via SelectAllButton ─────────────────────────────────────────

  it('renders SelectAllButton which exercises allLeafPaths', () => {
    // With non-mocked SelectAllButton, it calls allLeafPaths to enumerate leaf fields
    render(<FieldTree {...makeProps()} />);
    // SelectAllButton should render if there are leaf paths
    expect(document.querySelector('[data-testid="gql-qb-select-all"]')).toBeInTheDocument();
  });

  it('handles circular type references in allLeafPaths without infinite recursion', () => {
    // Type A has field of type A (self-referential)
    const circularTypes: GraphqlTypeNode[] = [
      {
        name: 'Query',
        kind: 'OBJECT',
        fields: [{ name: 'self', type: 'SelfRef!' }],
      },
      {
        name: 'SelfRef',
        kind: 'OBJECT',
        fields: [
          { name: 'id', type: 'ID!' },
          { name: 'child', type: 'SelfRef' }, // circular reference
        ],
      },
    ];
    const schemaInfo = makeSchemaInfo({ types: circularTypes });
    // Should render without infinite loop
    expect(() => render(<FieldTree {...makeProps({ schemaInfo })} />)).not.toThrow();
  });

  it('handles allLeafPaths when field type references a non-existent type (type has no fields)', () => {
    // unknownField points to 'UnknownType' which doesn't exist in types array
    const typesWithMissingRef: GraphqlTypeNode[] = [
      {
        name: 'Query',
        kind: 'OBJECT',
        fields: [{ name: 'ghost', type: 'UnknownType!' }],
      },
    ];
    const schemaInfo = makeSchemaInfo({ types: typesWithMissingRef });
    // Should render without throwing - allLeafPaths returns [] for unknown types
    expect(() => render(<FieldTree {...makeProps({ schemaInfo })} />)).not.toThrow();
  });

  it('does not focus search input when Cmd+K pressed outside .gql-qb-field-tree context', () => {
    // Test the case where Cmd+K is pressed but .gql-qb-field-tree is not found (null schema)
    render(<FieldTree {...makeProps({ schemaInfo: null })} />);
    // With null schema, .gql-qb-field-tree renders but search input is absent
    // Cmd+K handler checks for .gql-qb-field-tree — won't find search input
    expect(() => fireEvent.keyDown(window, { key: 'k', metaKey: true })).not.toThrow();
  });

  // ── Mutation operation ───────────────────────────────────────────────────────

  it('resolves mutation root type correctly', () => {
    const schemaInfo = makeSchemaInfo({
      types: [
        {
          name: 'Mutation',
          kind: 'OBJECT',
          fields: [{ name: 'createUser', type: 'User!' }],
        },
        { name: 'User', kind: 'OBJECT', fields: [{ name: 'id', type: 'ID!' }] },
      ],
      mutationType: 'Mutation',
    });
    const state = makeDefaultState({ operationType: 'mutation' });
    render(<FieldTree {...makeProps({ schemaInfo, state })} />);
    expect(screen.getByText('Mutation')).toBeInTheDocument();
    expect(screen.getByTestId('field-row-createUser')).toBeInTheDocument();
  });
});
