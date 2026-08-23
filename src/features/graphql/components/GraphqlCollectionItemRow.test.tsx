/**
 * @vitest-environment jsdom
 *
 * CollectionItemRow — unit tests.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollectionItemRow } from './GraphqlCollectionItemRow';
import type { GraphqlCollectionItem } from '@shared/types/graphql';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<GraphqlCollectionItem> = {}): GraphqlCollectionItem {
  return {
    id: 'item-1',
    name: 'Get Users',
    operation: {
      query: 'query GetUsers { users { id } }',
      variables: '{}',
      headers: [],
      operationType: 'query',
      operationName: 'GetUsers',
    },
    isPinned: false,
    createdAt: 1000,
    scripts: undefined,
    ...overrides,
  };
}

function defaultProps(overrides: Partial<Parameters<typeof CollectionItemRow>[0]> = {}) {
  return {
    item: makeItem(),
    depth: 0,
    isInvalid: false,
    onRun: vi.fn(),
    onLoad: vi.fn(),
    onDelete: vi.fn(),
    onEditScripts: vi.fn(),
    onContextMenu: vi.fn(),
    editingId: null,
    editingName: '',
    onEditingNameChange: vi.fn(),
    onCommitRename: vi.fn(),
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CollectionItemRow — rendering', () => {
  it('renders item name', () => {
    render(<CollectionItemRow {...defaultProps()} />);
    expect(screen.getByText('Get Users')).not.toBeNull();
  });

  it('renders Q badge for query type', () => {
    const item = makeItem({ operation: { query: '', variables: '{}', headers: [], operationType: 'query', operationName: 'Test' } });
    render(<CollectionItemRow {...defaultProps({ item })} />);
    expect(screen.getByText('Q')).not.toBeNull();
  });

  it('renders M badge for mutation type', () => {
    const item = makeItem({ operation: { query: '', variables: '{}', headers: [], operationType: 'mutation', operationName: 'Test' } });
    render(<CollectionItemRow {...defaultProps({ item })} />);
    expect(screen.getByText('M')).not.toBeNull();
  });

  it('renders S badge for subscription type', () => {
    const item = makeItem({ operation: { query: '', variables: '{}', headers: [], operationType: 'subscription', operationName: 'Test' } });
    render(<CollectionItemRow {...defaultProps({ item })} />);
    expect(screen.getByText('S')).not.toBeNull();
  });

  it('renders invalid badge when isInvalid=true', () => {
    render(<CollectionItemRow {...defaultProps({ isInvalid: true })} />);
    expect(screen.getByTitle('Schema validation error')).not.toBeNull();
  });

  it('does not render invalid badge when isInvalid=false', () => {
    render(<CollectionItemRow {...defaultProps({ isInvalid: false })} />);
    expect(screen.queryByTitle('Schema validation error')).toBeNull();
  });

  it('renders pinned badge when isPinned=true', () => {
    const item = makeItem({ isPinned: true });
    render(<CollectionItemRow {...defaultProps({ item })} />);
    expect(screen.getByTitle('Pinned')).not.toBeNull();
  });

  it('does not render pinned badge when isPinned=false', () => {
    render(<CollectionItemRow {...defaultProps()} />);
    expect(screen.queryByTitle('Pinned')).toBeNull();
  });

  it('renders script badge when preRequest script is defined', () => {
    const item = makeItem({
      scripts: { preRequest: 'console.log("pre")', postResponse: undefined, enabled: true },
    });
    render(<CollectionItemRow {...defaultProps({ item })} />);
    expect(screen.getByText('[Script]')).not.toBeNull();
  });

  it('renders disabled script badge when scripts.enabled=false', () => {
    const item = makeItem({
      scripts: { preRequest: 'x', postResponse: undefined, enabled: false },
    });
    render(<CollectionItemRow {...defaultProps({ item })} />);
    const badge = screen.getByTitle('Scripts defined but disabled');
    expect(badge).not.toBeNull();
  });

  it('does not render script badge when no scripts are defined', () => {
    render(<CollectionItemRow {...defaultProps()} />);
    expect(screen.queryByText('[Script]')).toBeNull();
  });

  it('renders rename input when editing this item', () => {
    render(
      <CollectionItemRow
        {...defaultProps({ editingId: 'item:item-1', editingName: 'New Name' })}
      />,
    );
    const input = screen.getByTestId('gql-col-item-rename-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('New Name');
  });

  it('renders name span (not input) when not editing', () => {
    render(<CollectionItemRow {...defaultProps({ editingId: null })} />);
    expect(screen.queryByTestId('gql-col-item-rename-input')).toBeNull();
    expect(screen.getByText('Get Users')).not.toBeNull();
  });
});

describe('CollectionItemRow — interactions', () => {
  it('calls onLoad on double-click when not editing', () => {
    const onLoad = vi.fn();
    render(<CollectionItemRow {...defaultProps({ onLoad })} />);
    fireEvent.dblClick(screen.getByTestId('gql-col-item'));
    expect(onLoad).toHaveBeenCalled();
  });

  it('does NOT call onLoad on double-click when editing', () => {
    const onLoad = vi.fn();
    render(
      <CollectionItemRow
        {...defaultProps({ onLoad, editingId: 'item:item-1', editingName: 'x' })}
      />,
    );
    fireEvent.dblClick(screen.getByTestId('gql-col-item'));
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('calls onRun on run button click', () => {
    const onRun = vi.fn();
    render(<CollectionItemRow {...defaultProps({ onRun })} />);
    fireEvent.click(screen.getByTitle('Run'));
    expect(onRun).toHaveBeenCalled();
  });

  it('calls onDelete on delete button click', () => {
    const onDelete = vi.fn();
    render(<CollectionItemRow {...defaultProps({ onDelete })} />);
    fireEvent.click(screen.getByTitle('Delete'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('calls onEditScripts on scripts button click', () => {
    const onEditScripts = vi.fn();
    render(<CollectionItemRow {...defaultProps({ onEditScripts })} />);
    fireEvent.click(screen.getByTestId('gql-col-item-scripts'));
    expect(onEditScripts).toHaveBeenCalled();
  });

  it('calls onContextMenu on right-click', () => {
    const onContextMenu = vi.fn();
    render(<CollectionItemRow {...defaultProps({ onContextMenu })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-col-item'));
    expect(onContextMenu).toHaveBeenCalled();
  });

  it('calls onEditingNameChange when rename input changes', () => {
    const onEditingNameChange = vi.fn();
    render(
      <CollectionItemRow
        {...defaultProps({ editingId: 'item:item-1', editingName: 'Old', onEditingNameChange })}
      />,
    );
    const input = screen.getByTestId('gql-col-item-rename-input');
    fireEvent.change(input, { target: { value: 'New' } });
    expect(onEditingNameChange).toHaveBeenCalledWith('New');
  });

  it('calls onCommitRename on Enter key in rename input', () => {
    const onCommitRename = vi.fn();
    render(
      <CollectionItemRow
        {...defaultProps({ editingId: 'item:item-1', editingName: 'New', onCommitRename })}
      />,
    );
    const input = screen.getByTestId('gql-col-item-rename-input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommitRename).toHaveBeenCalledWith('item', 'item-1');
  });

  it('calls onCommitRename on blur of rename input', () => {
    const onCommitRename = vi.fn();
    render(
      <CollectionItemRow
        {...defaultProps({ editingId: 'item:item-1', editingName: 'Name', onCommitRename })}
      />,
    );
    const input = screen.getByTestId('gql-col-item-rename-input');
    fireEvent.blur(input);
    expect(onCommitRename).toHaveBeenCalledWith('item', 'item-1');
  });

  it('restores original name on Escape key in rename input', () => {
    const onEditingNameChange = vi.fn();
    const item = makeItem({ name: 'Original Name' });
    render(
      <CollectionItemRow
        {...defaultProps({ item, editingId: 'item:item-1', editingName: 'Changed', onEditingNameChange })}
      />,
    );
    const input = screen.getByTestId('gql-col-item-rename-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onEditingNameChange).toHaveBeenCalledWith('Original Name');
  });

  it('stops propagation when clicking rename input', () => {
    const onLoad = vi.fn();
    render(
      <CollectionItemRow
        {...defaultProps({ onLoad, editingId: 'item:item-1', editingName: 'Edit' })}
      />,
    );
    const input = screen.getByTestId('gql-col-item-rename-input');
    const clickEvent = new MouseEvent('click', { bubbles: true });
    const stopSpy = vi.spyOn(clickEvent, 'stopPropagation');
    input.dispatchEvent(clickEvent);
    expect(stopSpy).toHaveBeenCalled();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('renders script badge for postResponse-only scripts', () => {
    const item = makeItem({
      scripts: { preRequest: undefined, postResponse: 'console.log("post")', enabled: true },
    });
    render(<CollectionItemRow {...defaultProps({ item })} />);
    expect(screen.getByTitle('Has scripts')).toBeTruthy();
  });

  it('applies pinned class when item is pinned', () => {
    render(<CollectionItemRow {...defaultProps({ item: makeItem({ isPinned: true }) })} />);
    expect(screen.getByTestId('gql-col-item').className).toContain('gql-col-item--pinned');
  });
});
