/**
 * @vitest-environment jsdom
 *
 * Tests for GraphqlQueryBuilder.tsx — orchestration component for the visual query builder.
 * Mocks all sub-components and hooks to test the orchestration logic:
 *  - handleCopy: clipboard write with "copied" state + timer
 *  - handleEditInEditor / handleExecute: forward sdl + variablesJson
 *  - handleSearchExpand: calls builder.expandPath for each path
 *  - keyboard handler: ArrowRight/ArrowLeft expand/collapse, Space toggles
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GraphqlQueryBuilder } from './GraphqlQueryBuilder';
import { installClipboardMock } from '../../../test-utils/clipboardMock';

// ─── Mock sub-components ──────────────────────────────────────────────────────

vi.mock('./query-builder', () => ({
  BuilderToolbar: ({ onCopy, onEditInEditor, onExecute, onReset, copied }: {
    onCopy: () => void;
    onEditInEditor: () => void;
    onExecute: () => void;
    onReset: () => void;
    copied: boolean;
  }) => (
    <div data-testid="builder-toolbar">
      <button data-testid="copy-btn" onClick={onCopy}>Copy{copied ? '!' : ''}</button>
      <button data-testid="edit-btn" onClick={onEditInEditor}>Edit</button>
      <button data-testid="execute-btn" onClick={onExecute}>Execute</button>
      <button data-testid="reset-btn" onClick={onReset}>Reset</button>
    </div>
  ),
  FieldTree: ({ onSetSearch, onSearchExpand }: {
    onSetSearch: (q: string) => void;
    onSearchExpand: (paths: string[]) => void;
  }) => (
    <div data-testid="field-tree">
      <button data-testid="set-search-btn" onClick={() => onSetSearch('test')}>SetSearch</button>
      <button data-testid="search-expand-btn" onClick={() => onSearchExpand(['path.a', 'path.b'])}>SearchExpand</button>
    </div>
  ),
  GeneratedQueryPreview: () => <div data-testid="query-preview" />,
  SummaryPanel: ({ onSetSearch, onSearchExpand }: {
    onSetSearch: (q: string) => void;
    onSearchExpand: (paths: string[]) => void;
  }) => (
    <div data-testid="summary-panel">
      <button data-testid="summary-search-btn" onClick={() => onSetSearch('summary')}>SummarySearch</button>
      <button data-testid="summary-expand-btn" onClick={() => onSearchExpand(['sum.a'])}>SummaryExpand</button>
    </div>
  ),
}));

// ─── Mock hooks and utils ─────────────────────────────────────────────────────

const mockExpandPath = vi.fn();
const mockSetSearchQuery = vi.fn();
const mockReset = vi.fn();
const mockToggleField = vi.fn();
const mockToggleExpand = vi.fn();
const mockSelectPaths = vi.fn();
const mockDeselectPaths = vi.fn();
const mockSetArgValue = vi.fn();

vi.mock('../hooks/useGraphqlQueryBuilder', () => ({
  useGraphqlQueryBuilder: () => ({
    state: { operationType: 'query', operationName: '', selectedPaths: {}, expandedPaths: {}, argValues: {}, searchQuery: '' },
    selectedCount: 0,
    maxDepth: 0,
    argsCount: 0,
    expandPath: mockExpandPath,
    setSearchQuery: mockSetSearchQuery,
    reset: mockReset,
    toggleField: mockToggleField,
    toggleExpand: mockToggleExpand,
    selectPaths: mockSelectPaths,
    deselectPaths: mockDeselectPaths,
    setArgValue: mockSetArgValue,
    setOperationType: vi.fn(),
    setOperationName: vi.fn(),
  }),
}));

vi.mock('../utils/queryBuilderGenerator', () => ({
  generateQuery: vi.fn(() => ({
    sdl: 'query { user { id name } }',
    variables: { limit: 10 },
    variableDeclarations: [{ name: 'limit' }],
  })),
}));

// ─── Clipboard mock ───────────────────────────────────────────────────────────

let mockWriteText: ReturnType<typeof installClipboardMock>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultProps() {
  return {
    schemaInfo: null,
    onEditInEditor: vi.fn(),
    onExecute: vi.fn(),
  };
}

beforeEach(() => {
  resetAllMocks();
  vi.useRealTimers();
  mockWriteText = installClipboardMock();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GraphqlQueryBuilder', () => {
  it('renders all sub-components', () => {
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    expect(screen.getByTestId('builder-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('field-tree')).toBeInTheDocument();
    expect(screen.getByTestId('query-preview')).toBeInTheDocument();
    expect(screen.getByTestId('summary-panel')).toBeInTheDocument();
  });

  it('handleCopy writes sdl to clipboard and sets copied state', async () => {
    vi.useFakeTimers();
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    const copyBtn = screen.getByTestId('copy-btn');
    await act(async () => { fireEvent.click(copyBtn); });
    expect(mockWriteText).toHaveBeenCalledWith('query { user { id name } }');
    expect(screen.getByTestId('copy-btn').textContent).toBe('Copy!');
    // After 1800ms timer, copied state should reset
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByTestId('copy-btn').textContent).toBe('Copy');
  });

  it('handleCopy silently handles clipboard write failure', async () => {
    mockWriteText.mockRejectedValueOnce(new Error('Permission denied'));
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    // Should not throw
    await act(async () => { fireEvent.click(screen.getByTestId('copy-btn')); });
    expect(screen.getByTestId('copy-btn').textContent).toBe('Copy');
  });

  it('handleEditInEditor calls props.onEditInEditor with sdl and variablesJson', async () => {
    const onEditInEditor = vi.fn();
    render(<GraphqlQueryBuilder {...defaultProps()} onEditInEditor={onEditInEditor} />);
    fireEvent.click(screen.getByTestId('edit-btn'));
    expect(onEditInEditor).toHaveBeenCalledWith(
      'query { user { id name } }',
      JSON.stringify({ limit: 10 }, null, 2),
    );
  });

  it('handleExecute calls props.onExecute with sdl and variablesJson', async () => {
    const onExecute = vi.fn();
    render(<GraphqlQueryBuilder {...defaultProps()} onExecute={onExecute} />);
    fireEvent.click(screen.getByTestId('execute-btn'));
    expect(onExecute).toHaveBeenCalledWith(
      'query { user { id name } }',
      JSON.stringify({ limit: 10 }, null, 2),
    );
  });

  it('handleSearchExpand calls builder.expandPath for each path', () => {
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('search-expand-btn'));
    expect(mockExpandPath).toHaveBeenCalledWith('path.a');
    expect(mockExpandPath).toHaveBeenCalledWith('path.b');
  });

  it('SummaryPanel onSearchExpand calls builder.expandPath for each path', () => {
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('summary-expand-btn'));
    expect(mockExpandPath).toHaveBeenCalledWith('sum.a');
  });

  it('cleanup on unmount cancels copied timer', () => {
    vi.useFakeTimers();
    const { unmount } = render(<GraphqlQueryBuilder {...defaultProps()} />);
    act(() => { fireEvent.click(screen.getByTestId('copy-btn')); });
    unmount();
    // Should not throw even after unmount
    act(() => { vi.advanceTimersByTime(2000); });
  });

  it('keyboard ArrowRight clicks expand button when not open', () => {
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    // Build DOM structure inside a tabindex=0 element so focus works in jsdom
    const tree = document.createElement('div');
    tree.className = 'gql-qb-field-tree';
    const fieldRow = document.createElement('div');
    fieldRow.className = 'gql-qb-field-row';
    const inner = document.createElement('button');
    inner.setAttribute('tabindex', '0');
    const expandBtn = document.createElement('button');
    expandBtn.className = 'gql-qb-expand-btn';
    const clickSpy = vi.spyOn(expandBtn, 'click');
    fieldRow.appendChild(inner);
    fieldRow.appendChild(expandBtn);
    tree.appendChild(fieldRow);
    document.body.appendChild(tree);
    inner.focus(); // sets document.activeElement to inner (inside .gql-qb-field-tree)
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(clickSpy).toHaveBeenCalled();
    document.body.removeChild(tree);
  });

  it('keyboard ArrowLeft clicks expand button when open', () => {
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    const tree = document.createElement('div');
    tree.className = 'gql-qb-field-tree';
    const fieldRow = document.createElement('div');
    fieldRow.className = 'gql-qb-field-row';
    const inner = document.createElement('button');
    inner.setAttribute('tabindex', '0');
    const expandBtn = document.createElement('button');
    expandBtn.className = 'gql-qb-expand-btn gql-qb-expand-btn--open';
    const clickSpy = vi.spyOn(expandBtn, 'click');
    fieldRow.appendChild(inner);
    fieldRow.appendChild(expandBtn);
    tree.appendChild(fieldRow);
    document.body.appendChild(tree);
    inner.focus();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(clickSpy).toHaveBeenCalled();
    document.body.removeChild(tree);
  });

  it('keyboard Space clicks check button when not the active element', () => {
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    const tree = document.createElement('div');
    tree.className = 'gql-qb-field-tree';
    const fieldRow = document.createElement('div');
    fieldRow.className = 'gql-qb-field-row';
    const inner = document.createElement('button');
    inner.setAttribute('tabindex', '0');
    const checkBtn = document.createElement('button');
    checkBtn.className = 'gql-qb-check';
    const clickSpy = vi.spyOn(checkBtn, 'click');
    fieldRow.appendChild(inner);
    fieldRow.appendChild(checkBtn);
    tree.appendChild(fieldRow);
    document.body.appendChild(tree);
    inner.focus();
    fireEvent.keyDown(window, { key: ' ' });
    expect(clickSpy).toHaveBeenCalled();
    document.body.removeChild(tree);
  });

  it('keyboard ArrowRight does not click expand when already open', () => {
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    const tree = document.createElement('div');
    tree.className = 'gql-qb-field-tree';
    const fieldRow = document.createElement('div');
    fieldRow.className = 'gql-qb-field-row';
    const inner = document.createElement('button');
    inner.setAttribute('tabindex', '0');
    const expandBtn = document.createElement('button');
    expandBtn.className = 'gql-qb-expand-btn gql-qb-expand-btn--open';
    const clickSpy = vi.spyOn(expandBtn, 'click');
    fieldRow.appendChild(inner);
    fieldRow.appendChild(expandBtn);
    tree.appendChild(fieldRow);
    document.body.appendChild(tree);
    inner.focus();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(clickSpy).not.toHaveBeenCalled();
    document.body.removeChild(tree);
  });

  it('keyboard ArrowLeft does not click expand when not open', () => {
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    const tree = document.createElement('div');
    tree.className = 'gql-qb-field-tree';
    const fieldRow = document.createElement('div');
    fieldRow.className = 'gql-qb-field-row';
    const inner = document.createElement('button');
    inner.setAttribute('tabindex', '0');
    const expandBtn = document.createElement('button');
    expandBtn.className = 'gql-qb-expand-btn';
    const clickSpy = vi.spyOn(expandBtn, 'click');
    fieldRow.appendChild(inner);
    fieldRow.appendChild(expandBtn);
    tree.appendChild(fieldRow);
    document.body.appendChild(tree);
    inner.focus();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(clickSpy).not.toHaveBeenCalled();
    document.body.removeChild(tree);
  });

  it('keyboard Space does not click check if activeElement IS the check button', () => {
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    const tree = document.createElement('div');
    tree.className = 'gql-qb-field-tree';
    const fieldRow = document.createElement('div');
    fieldRow.className = 'gql-qb-field-row';
    const checkBtn = document.createElement('button');
    checkBtn.className = 'gql-qb-check';
    checkBtn.setAttribute('tabindex', '0');
    const clickSpy = vi.spyOn(checkBtn, 'click');
    fieldRow.appendChild(checkBtn);
    tree.appendChild(fieldRow);
    document.body.appendChild(tree);
    checkBtn.focus(); // activeElement IS checkBtn
    fireEvent.keyDown(window, { key: ' ' });
    expect(clickSpy).not.toHaveBeenCalled();
    document.body.removeChild(tree);
  });

  it('keyboard events outside .gql-qb-field-tree are ignored', () => {
    render(<GraphqlQueryBuilder {...defaultProps()} />);
    // Focus body — no .gql-qb-field-tree ancestor
    document.body.focus?.();
    expect(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: ' ' });
    }).not.toThrow();
  });

  it('keyboard events are ignored when builder pane is hidden in the studio', () => {
    const pane = document.createElement('div');
    pane.className = 'gql-mode-pane gql-mode-pane--builder gql-mode-pane--hidden';
    document.body.appendChild(pane);

    render(<GraphqlQueryBuilder {...defaultProps()} />);
    const tree = document.createElement('div');
    tree.className = 'gql-qb-field-tree';
    const fieldRow = document.createElement('div');
    fieldRow.className = 'gql-qb-field-row';
    const inner = document.createElement('button');
    inner.setAttribute('tabindex', '0');
    const checkBtn = document.createElement('button');
    checkBtn.className = 'gql-qb-check';
    const clickSpy = vi.spyOn(checkBtn, 'click');
    fieldRow.appendChild(inner);
    fieldRow.appendChild(checkBtn);
    tree.appendChild(fieldRow);
    document.body.appendChild(tree);
    inner.focus();
    fireEvent.keyDown(window, { key: ' ' });
    expect(clickSpy).not.toHaveBeenCalled();

    document.body.removeChild(pane);
    document.body.removeChild(tree);
  });

  it('variablesJson is empty object when no variables', async () => {
    const { generateQuery } = await import('../utils/queryBuilderGenerator');
    vi.mocked(generateQuery).mockReturnValueOnce({
      sdl: '{ hello }',
      variables: {},
      variableDeclarations: [],
    });
    const onExecute = vi.fn();
    render(<GraphqlQueryBuilder {...defaultProps()} onExecute={onExecute} />);
    fireEvent.click(screen.getByTestId('execute-btn'));
    expect(onExecute).toHaveBeenCalledWith('{ hello }', '{}');
  });
});
