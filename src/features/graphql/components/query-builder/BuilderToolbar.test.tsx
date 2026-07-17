/**
 * @vitest-environment jsdom
 *
 * BuilderToolbar — unit tests.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuilderToolbar } from './BuilderToolbar';
import type { BuilderState } from '../../hooks/useGraphqlQueryBuilder';

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
    state: makeState(),
    schemaInfo: null,
    selectedCount: 0,
    onSetOpType: vi.fn(),
    onSetOpName: vi.fn(),
    onCopy: vi.fn(),
    onEditInEditor: vi.fn(),
    onExecute: vi.fn(),
    onReset: vi.fn(),
    copied: false,
    ...overrides,
  };
}

describe('BuilderToolbar', () => {
  beforeEach(() => { resetAllMocks(); });

  it('renders all three operation type buttons', () => {
    render(<BuilderToolbar {...defaultProps()} />);
    expect(screen.getByTestId('gql-qb-op-query')).toBeInTheDocument();
    expect(screen.getByTestId('gql-qb-op-mutation')).toBeInTheDocument();
    expect(screen.getByTestId('gql-qb-op-subscription')).toBeInTheDocument();
  });

  it('marks the active operation type button as pressed', () => {
    render(<BuilderToolbar {...defaultProps({ state: makeState({ operationType: 'mutation' }) })} />);
    expect(screen.getByTestId('gql-qb-op-mutation')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('gql-qb-op-query')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSetOpType when operation type button is clicked', () => {
    const onSetOpType = vi.fn();
    render(<BuilderToolbar {...defaultProps({ onSetOpType })} />);
    fireEvent.click(screen.getByTestId('gql-qb-op-mutation'));
    expect(onSetOpType).toHaveBeenCalledWith('mutation');
  });

  it('renders operation name input', () => {
    render(<BuilderToolbar {...defaultProps()} />);
    expect(screen.getByTestId('gql-qb-op-name')).toBeInTheDocument();
  });

  it('calls onSetOpName when operation name changes', () => {
    const onSetOpName = vi.fn();
    render(<BuilderToolbar {...defaultProps({ onSetOpName })} />);
    fireEvent.change(screen.getByTestId('gql-qb-op-name'), { target: { value: 'GetUser' } });
    expect(onSetOpName).toHaveBeenCalledWith('GetUser');
  });

  it('calls onCopy when Copy SDL is clicked', () => {
    const onCopy = vi.fn();
    render(<BuilderToolbar {...defaultProps({ onCopy, selectedCount: 3 })} />);
    fireEvent.click(screen.getByTestId('gql-qb-copy'));
    expect(onCopy).toHaveBeenCalled();
  });

  it('shows "✓ Copied" when copied=true', () => {
    render(<BuilderToolbar {...defaultProps({ copied: true })} />);
    expect(screen.getByTestId('gql-qb-copy')).toHaveTextContent('✓ Copied');
  });

  it('calls onEditInEditor when Edit in Editor is clicked', () => {
    const onEditInEditor = vi.fn();
    render(<BuilderToolbar {...defaultProps({ onEditInEditor, selectedCount: 1 })} />);
    fireEvent.click(screen.getByTestId('gql-qb-edit'));
    expect(onEditInEditor).toHaveBeenCalled();
  });

  it('disables Execute when selectedCount=0', () => {
    render(<BuilderToolbar {...defaultProps({ selectedCount: 0 })} />);
    expect(screen.getByTestId('gql-qb-execute')).toBeDisabled();
  });

  it('enables Execute when selectedCount>0', () => {
    render(<BuilderToolbar {...defaultProps({ selectedCount: 2 })} />);
    expect(screen.getByTestId('gql-qb-execute')).not.toBeDisabled();
  });

  it('calls onExecute when Execute is clicked', () => {
    const onExecute = vi.fn();
    render(<BuilderToolbar {...defaultProps({ onExecute, selectedCount: 1 })} />);
    fireEvent.click(screen.getByTestId('gql-qb-execute'));
    expect(onExecute).toHaveBeenCalled();
  });

  it('shows schema info when schemaInfo is provided', () => {
    const schemaInfo = { queryType: 'Query', types: [{ name: 'Query', kind: 'OBJECT' as const, fields: [] }] };
    render(<BuilderToolbar {...defaultProps({ schemaInfo: schemaInfo as never })} />);
    expect(screen.getByText('1 types')).toBeInTheDocument();
  });

  it('shows selected count', () => {
    render(<BuilderToolbar {...defaultProps({ selectedCount: 5 })} />);
    expect(screen.getByText('5 fields')).toBeInTheDocument();
  });

  it('shows "1 field" (singular) when selectedCount=1', () => {
    render(<BuilderToolbar {...defaultProps({ selectedCount: 1 })} />);
    expect(screen.getByText('1 field')).toBeInTheDocument();
  });

  it('calls onReset when Clear is clicked', () => {
    const onReset = vi.fn();
    render(<BuilderToolbar {...defaultProps({ onReset, selectedCount: 3 })} />);
    fireEvent.click(screen.getByTestId('gql-qb-reset'));
    expect(onReset).toHaveBeenCalled();
  });

  it('disables Clear when no fields selected', () => {
    render(<BuilderToolbar {...defaultProps({ selectedCount: 0 })} />);
    expect(screen.getByTestId('gql-qb-reset')).toBeDisabled();
  });
});
