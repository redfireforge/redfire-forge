/**
 * @vitest-environment jsdom
 *
 * CollectionContextMenu — unit tests.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollectionContextMenu } from './GraphqlCollectionContextMenu';
import type { ContextMenuState } from './graphqlCollectionsTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMenu(overrides: Partial<ContextMenuState> = {}): ContextMenuState {
  return {
    id: 'item-1',
    type: 'item',
    name: 'My Query',
    x: 100,
    y: 200,
    ...overrides,
  };
}

function defaultProps(menu: ContextMenuState) {
  return {
    menu,
    onClose: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onFork: vi.fn(),
    onDuplicate: vi.fn(),
    onEditItemScripts: vi.fn(),
    onEditCollectionScripts: vi.fn(),
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CollectionContextMenu — rendering', () => {
  it('renders Rename and Delete buttons for all menu types', () => {
    const menu = makeMenu({ type: 'item' });
    render(<CollectionContextMenu {...defaultProps(menu)} />);
    expect(screen.getByText('Rename')).not.toBeNull();
    expect(screen.getByText('Delete')).not.toBeNull();
  });

  it('renders Fork and Edit collection scripts buttons for collection type', () => {
    const menu = makeMenu({ type: 'collection' });
    render(<CollectionContextMenu {...defaultProps(menu)} />);
    expect(screen.getByText('Fork collection')).not.toBeNull();
    expect(screen.getByText('Edit collection scripts')).not.toBeNull();
  });

  it('does NOT render Fork button for item type', () => {
    const menu = makeMenu({ type: 'item' });
    render(<CollectionContextMenu {...defaultProps(menu)} />);
    expect(screen.queryByText('Fork collection')).toBeNull();
  });

  it('renders Duplicate and Edit scripts buttons for item type', () => {
    const menu = makeMenu({ type: 'item' });
    render(<CollectionContextMenu {...defaultProps(menu)} />);
    expect(screen.getByText('Duplicate')).not.toBeNull();
    expect(screen.getByText('Edit scripts')).not.toBeNull();
  });

  it('does NOT render Duplicate button for collection type', () => {
    const menu = makeMenu({ type: 'collection' });
    render(<CollectionContextMenu {...defaultProps(menu)} />);
    expect(screen.queryByText('Duplicate')).toBeNull();
  });

  it('renders Pin to top button when onTogglePin is provided and item is not pinned', () => {
    const menu = makeMenu({ type: 'item' });
    const props = { ...defaultProps(menu), onTogglePin: vi.fn(), itemIsPinned: false };
    render(<CollectionContextMenu {...props} />);
    expect(screen.getByTestId('gql-ctx-pin')).not.toBeNull();
    expect(screen.getByText('Pin to top')).not.toBeNull();
  });

  it('renders Unpin button when item is pinned', () => {
    const menu = makeMenu({ type: 'item' });
    const props = { ...defaultProps(menu), onTogglePin: vi.fn(), itemIsPinned: true };
    render(<CollectionContextMenu {...props} />);
    expect(screen.getByText('Unpin')).not.toBeNull();
  });

  it('does NOT render pin button when onTogglePin is not provided', () => {
    const menu = makeMenu({ type: 'item' });
    render(<CollectionContextMenu {...defaultProps(menu)} />);
    expect(screen.queryByTestId('gql-ctx-pin')).toBeNull();
  });

  it('positions menu at specified x/y', () => {
    const menu = makeMenu({ x: 150, y: 250 });
    const { container } = render(<CollectionContextMenu {...defaultProps(menu)} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.top).toBe('250px');
    expect(el.style.left).toBe('150px');
  });

  it('does not render collection/item-specific buttons for folder type', () => {
    const menu = makeMenu({ type: 'folder' });
    render(<CollectionContextMenu {...defaultProps(menu)} />);
    expect(screen.queryByText('Fork collection')).toBeNull();
    expect(screen.queryByText('Duplicate')).toBeNull();
  });
});

describe('CollectionContextMenu — interactions', () => {
  it('calls onRename with correct args and closes on Rename click', () => {
    const menu = makeMenu({ id: 'item-1', type: 'item', name: 'My Query' });
    const props = defaultProps(menu);
    render(<CollectionContextMenu {...props} />);

    fireEvent.click(screen.getByText('Rename'));

    expect(props.onRename).toHaveBeenCalledWith('item', 'item-1', 'My Query');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onDelete with correct args on Delete click', () => {
    const menu = makeMenu({ id: 'item-1', type: 'item' });
    const props = defaultProps(menu);
    render(<CollectionContextMenu {...props} />);

    fireEvent.click(screen.getByText('Delete'));

    expect(props.onDelete).toHaveBeenCalledWith('item', 'item-1');
  });

  it('calls onFork and onClose on Fork click', () => {
    const menu = makeMenu({ id: 'col-1', type: 'collection' });
    const props = defaultProps(menu);
    render(<CollectionContextMenu {...props} />);

    fireEvent.click(screen.getByText('Fork collection'));

    expect(props.onFork).toHaveBeenCalledWith('col-1');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onEditCollectionScripts (no close) on Edit collection scripts click', () => {
    const menu = makeMenu({ id: 'col-1', type: 'collection', name: 'My Collection' });
    const props = defaultProps(menu);
    render(<CollectionContextMenu {...props} />);

    fireEvent.click(screen.getByText('Edit collection scripts'));

    expect(props.onEditCollectionScripts).toHaveBeenCalledWith('col-1', 'My Collection');
    // Does NOT close
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('calls onDuplicate and onClose on Duplicate click', () => {
    const menu = makeMenu({ id: 'item-1', type: 'item' });
    const props = defaultProps(menu);
    render(<CollectionContextMenu {...props} />);

    fireEvent.click(screen.getByText('Duplicate'));

    expect(props.onDuplicate).toHaveBeenCalledWith('item-1');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onEditItemScripts (no close) on Edit scripts click', () => {
    const menu = makeMenu({ id: 'item-1', type: 'item' });
    const props = defaultProps(menu);
    render(<CollectionContextMenu {...props} />);

    fireEvent.click(screen.getByText('Edit scripts'));

    expect(props.onEditItemScripts).toHaveBeenCalledWith('item-1');
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('calls onTogglePin with !itemIsPinned and closes', () => {
    const menu = makeMenu({ id: 'item-1', type: 'item' });
    const onTogglePin = vi.fn();
    const props = { ...defaultProps(menu), onTogglePin, itemIsPinned: false };
    render(<CollectionContextMenu {...props} />);

    fireEvent.click(screen.getByTestId('gql-ctx-pin'));

    expect(onTogglePin).toHaveBeenCalledWith('item-1', true);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onClose when mouse leaves the menu', () => {
    const menu = makeMenu();
    const props = defaultProps(menu);
    const { container } = render(<CollectionContextMenu {...props} />);

    fireEvent.mouseLeave(container.firstElementChild!);

    expect(props.onClose).toHaveBeenCalled();
  });
});
