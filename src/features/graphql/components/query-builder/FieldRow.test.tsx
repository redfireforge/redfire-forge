/**
 * @vitest-environment jsdom
 *
 * FieldRow — unit tests.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldRow } from './FieldRow';
import type { GraphqlFieldNode, GraphqlTypeNode } from '../../../../shared/types/graphql';
import type { BuilderState } from '../../hooks/useGraphqlQueryBuilder';

vi.mock('../../utils/queryBuilderGenerator', () => ({
  isLeafType: (type: string, _types: GraphqlTypeNode[]) =>
    type === 'String' || type === 'Int' || type === 'Boolean' || type === 'ID',
  stripTypeModifiers: (t: string) => t.replace(/[![\]]/g, ''),
}));

vi.mock('./ArgInput', () => ({
  ArgInput: ({ argName, onChange }: { argName: string; onChange: (v: string) => void }) => (
    <button data-testid={`arg-${argName}`} onClick={() => onChange('test-val')}>{argName}</button>
  ),
}));

function makeField(overrides: Partial<GraphqlFieldNode> = {}): GraphqlFieldNode {
  return { name: 'id', type: 'ID', args: [], isDeprecated: false, ...overrides };
}

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

const TYPES: GraphqlTypeNode[] = [
  { name: 'User', kind: 'OBJECT', fields: [{ name: 'name', type: 'String', args: [], isDeprecated: false }] },
];

function defaultProps(overrides = {}) {
  return {
    field: makeField(),
    path: 'id',
    depth: 0,
    state: makeState(),
    types: [],
    onToggle: vi.fn(),
    onToggleExpand: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onSetArg: vi.fn(),
    allLeafPaths: vi.fn(() => []),
    ...overrides,
  };
}

describe('FieldRow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a leaf field row', () => {
    render(<FieldRow {...defaultProps()} />);
    expect(screen.getByText('id')).toBeInTheDocument();
  });

  it('renders expand button for non-leaf field', () => {
    const props = defaultProps({ field: makeField({ name: 'user', type: 'User' }), types: TYPES });
    render(<FieldRow {...props} />);
    expect(screen.getByLabelText('Expand user')).toBeInTheDocument();
  });

  it('renders spacer for leaf field (no expand button)', () => {
    const { container } = render(<FieldRow {...defaultProps()} />);
    expect(container.querySelector('.gql-qb-expand-spacer')).not.toBeNull();
    expect(container.querySelector('.gql-qb-expand-btn')).toBeNull();
  });

  it('calls onToggle when checkbox clicked for leaf field', () => {
    const onToggle = vi.fn();
    render(<FieldRow {...defaultProps({ onToggle })} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('id');
  });

  it('calls onToggleExpand when expand button clicked', () => {
    const onToggleExpand = vi.fn();
    const props = defaultProps({
      field: makeField({ name: 'user', type: 'User' }),
      path: 'user',
      types: TYPES,
      onToggleExpand,
    });
    render(<FieldRow {...props} />);
    fireEvent.click(screen.getByLabelText('Expand user'));
    expect(onToggleExpand).toHaveBeenCalledWith('user');
  });

  it('shows selected state for selected leaf', () => {
    const props = defaultProps({ state: makeState({ selectedFields: { id: true } }) });
    render(<FieldRow {...props} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onDeselectAll when clicking a selected object field', () => {
    const onDeselectAll = vi.fn();
    const props = defaultProps({
      field: makeField({ name: 'user', type: 'User' }),
      path: 'user',
      types: TYPES,
      state: makeState({ selectedFields: { 'user.name': true } }),
      onDeselectAll,
    });
    render(<FieldRow {...props} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onDeselectAll).toHaveBeenCalled();
  });

  it('calls onSelectAll when clicking a non-selected object with leaf paths', () => {
    const onSelectAll = vi.fn();
    const allLeafPaths = vi.fn(() => ['user.name']);
    const props = defaultProps({
      field: makeField({ name: 'user', type: 'User' }),
      types: TYPES,
      allLeafPaths,
      onSelectAll,
    });
    render(<FieldRow {...props} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onSelectAll).toHaveBeenCalledWith(['user.name']);
  });

  it('shows deprecated tag for deprecated field', () => {
    const props = defaultProps({
      field: makeField({ name: 'old', type: 'String', isDeprecated: true, deprecationReason: 'Use newField' }),
    });
    render(<FieldRow {...props} />);
    expect(screen.getByText('@deprecated')).toBeInTheDocument();
  });

  it('shows description snippet', () => {
    const props = defaultProps({
      field: makeField({ name: 'id', type: 'ID', description: 'Unique identifier' }),
    });
    render(<FieldRow {...props} />);
    expect(screen.getByText('Unique identifier')).toBeInTheDocument();
  });

  it('shows arg count badge when field has args', () => {
    const props = defaultProps({
      field: makeField({ name: 'items', type: 'String', args: [{ name: 'limit', type: 'Int' }] }),
      state: makeState({ selectedFields: { items: true } }),
    });
    render(<FieldRow {...props} />);
    expect(screen.getByText('1 arg')).toBeInTheDocument();
  });

  it('renders ArgInput when field is selected and has args', () => {
    const props = defaultProps({
      field: makeField({ name: 'items', type: 'String', args: [{ name: 'limit', type: 'Int' }] }),
      path: 'items',
      state: makeState({ selectedFields: { items: true } }),
    });
    render(<FieldRow {...props} />);
    expect(screen.getByTestId('arg-limit')).toBeInTheDocument();
  });

  it('renders child fields when expanded', () => {
    const props = defaultProps({
      field: makeField({ name: 'user', type: 'User' }),
      path: 'user',
      types: TYPES,
      state: makeState({ expandedPaths: new Set(['user']) }),
    });
    render(<FieldRow {...props} />);
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('calls onToggle for non-leaf with no leaf paths (no leaves to select)', () => {
    const onToggle = vi.fn();
    const props = defaultProps({
      field: makeField({ name: 'user', type: 'User' }),
      path: 'user',
      types: TYPES,
      allLeafPaths: vi.fn(() => []), // no leaves
      onToggle,
    });
    render(<FieldRow {...props} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('user');
  });

  it('calls onSetArg when ArgInput onChange is triggered', () => {
    const onSetArg = vi.fn();
    const props = defaultProps({
      field: makeField({ name: 'items', type: 'String', args: [{ name: 'limit', type: 'Int' }] }),
      path: 'items',
      state: makeState({ selectedFields: { items: true } }),
      onSetArg,
    });
    render(<FieldRow {...props} />);
    fireEvent.click(screen.getByTestId('arg-limit'));
    expect(onSetArg).toHaveBeenCalledWith('items', 'limit', 'test-val');
  });

  it('auto-expands when selecting leaves of a collapsed non-leaf field', () => {
    const onToggleExpand = vi.fn();
    const props = defaultProps({
      field: makeField({ name: 'user', type: 'User' }),
      path: 'user',
      types: TYPES,
      allLeafPaths: vi.fn(() => ['user.name']),
      // not expanded
      state: makeState({ expandedPaths: new Set() }),
      onToggleExpand,
    });
    render(<FieldRow {...props} />);
    fireEvent.click(screen.getByRole('checkbox'));
    // should auto-expand since field is not expanded
    expect(onToggleExpand).toHaveBeenCalledWith('user');
  });

  it('shows enum type badge for ENUM kind', () => {
    const types: GraphqlTypeNode[] = [
      { name: 'Status', kind: 'ENUM', fields: [], enumValues: ['A'] },
    ];
    const props = defaultProps({
      field: makeField({ name: 'status', type: 'Status' }),
      types,
    });
    const { container } = render(<FieldRow {...props} />);
    const badge = container.querySelector('.gql-qb-type-badge--enum');
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent('E');
  });

  it('shows plural arg count badge when field has multiple args', () => {
    const props = defaultProps({
      field: makeField({
        name: 'search',
        type: 'String',
        args: [
          { name: 'limit', type: 'Int' },
          { name: 'offset', type: 'Int' },
        ],
      }),
      state: makeState({ selectedFields: { search: true } }),
    });
    render(<FieldRow {...props} />);
    expect(screen.getByText('2 args')).toBeInTheDocument();
    expect(screen.getByLabelText('2 arguments')).toBeInTheDocument();
  });

  it('shows deprecated tag with default title when no deprecationReason', () => {
    const props = defaultProps({
      field: makeField({ name: 'legacy', type: 'String', isDeprecated: true }),
    });
    render(<FieldRow {...props} />);
    const tag = screen.getByText('@deprecated');
    expect(tag).toHaveAttribute('title', 'Deprecated');
    expect(tag).toHaveAttribute('aria-label', 'Deprecated');
  });

  it('truncates long descriptions with ellipsis', () => {
    const longDesc = 'A'.repeat(70);
    const props = defaultProps({
      field: makeField({ name: 'id', type: 'ID', description: longDesc }),
    });
    render(<FieldRow {...props} />);
    expect(screen.getByText(`${'A'.repeat(60)}…`)).toBeInTheDocument();
  });
});
