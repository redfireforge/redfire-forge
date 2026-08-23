/**
 * @vitest-environment jsdom
 *
 * SelectAllButton — unit tests.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectAllButton } from './SelectAllButton';
import type { GraphqlTypeNode } from '@shared/types/graphql';
import type { BuilderState } from '../../hooks/useGraphqlQueryBuilder';

vi.mock('../../utils/queryBuilderGenerator', () => ({
  isLeafType: (type: string) => type === 'String' || type === 'Int' || type === 'Boolean' || type === 'ID',
  stripTypeModifiers: (t: string) => t.replace(/[![\]]/g, ''),
}));

const TYPES: GraphqlTypeNode[] = [];

function makeRootType(fields: Array<{ name: string; type: string }>): GraphqlTypeNode {
  return { name: 'Query', kind: 'OBJECT', fields };
}

function makeState(selectedFields: Record<string, boolean> = {}): BuilderState {
  return {
    operationType: 'query',
    operationName: '',
    selectedFields,
    expandedPaths: new Set(),
    argValues: {},
    searchQuery: '',
  };
}

describe('SelectAllButton', () => {
  beforeEach(() => resetAllMocks());

  it('renders nothing when rootType has no fields', () => {
    const { container } = render(
      <SelectAllButton
        rootType={makeRootType([])}
        state={makeState()}
        types={TYPES}
        allLeafPaths={vi.fn(() => [])}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders Select all button when no fields are selected', () => {
    render(
      <SelectAllButton
        rootType={makeRootType([{ name: 'id', type: 'ID' }])}
        state={makeState()}
        types={TYPES}
        allLeafPaths={vi.fn(() => [])}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-qb-select-all')).toHaveTextContent('Select all');
  });

  it('renders Deselect all button when all leaf fields are selected', () => {
    render(
      <SelectAllButton
        rootType={makeRootType([{ name: 'id', type: 'ID' }])}
        state={makeState({ id: true })}
        types={TYPES}
        allLeafPaths={vi.fn(() => [])}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-qb-select-all')).toHaveTextContent('Deselect all');
  });

  it('renders Select all when only some fields are selected', () => {
    render(
      <SelectAllButton
        rootType={makeRootType([{ name: 'id', type: 'ID' }, { name: 'name', type: 'String' }])}
        state={makeState({ id: true })}
        types={TYPES}
        allLeafPaths={vi.fn(() => [])}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-qb-select-all')).toHaveTextContent('Select all');
  });

  it('calls onSelectAll when clicked with partial selection', () => {
    const onSelectAll = vi.fn();
    render(
      <SelectAllButton
        rootType={makeRootType([{ name: 'id', type: 'ID' }, { name: 'name', type: 'String' }])}
        state={makeState({ id: true })}
        types={TYPES}
        allLeafPaths={vi.fn(() => [])}
        onSelectAll={onSelectAll}
        onDeselectAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-qb-select-all'));
    expect(onSelectAll).toHaveBeenCalledWith(['id', 'name']);
  });

  it('calls onSelectAll when clicked with none selected', () => {
    const onSelectAll = vi.fn();
    render(
      <SelectAllButton
        rootType={makeRootType([{ name: 'id', type: 'ID' }])}
        state={makeState()}
        types={TYPES}
        allLeafPaths={vi.fn(() => [])}
        onSelectAll={onSelectAll}
        onDeselectAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-qb-select-all'));
    expect(onSelectAll).toHaveBeenCalledWith(['id']);
  });

  it('calls onDeselectAll when clicked with all selected', () => {
    const onDeselectAll = vi.fn();
    render(
      <SelectAllButton
        rootType={makeRootType([{ name: 'id', type: 'ID' }])}
        state={makeState({ id: true })}
        types={TYPES}
        allLeafPaths={vi.fn(() => [])}
        onSelectAll={vi.fn()}
        onDeselectAll={onDeselectAll}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-qb-select-all'));
    expect(onDeselectAll).toHaveBeenCalledWith(['id']);
  });

  it('includes nested leaf paths from allLeafPaths for non-leaf fields', () => {
    const allLeafPaths = vi.fn(() => ['user.name', 'user.email']);
    render(
      <SelectAllButton
        rootType={makeRootType([{ name: 'user', type: 'User' }])}
        state={makeState()}
        types={TYPES}
        allLeafPaths={allLeafPaths}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    // allLeafPaths is called for the non-leaf 'user' field
    expect(allLeafPaths).toHaveBeenCalledWith('User', 'user');
  });
});
