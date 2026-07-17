/**
 * @vitest-environment jsdom
 *
 * SaveToCollectionModal — unit tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock IDB dependencies that get transitively imported
vi.mock('../../../shared/utils/idbGraphqlCollections', () => ({
  idbLoadCollections: vi.fn().mockResolvedValue([]),
  idbSaveCollection: vi.fn().mockResolvedValue(undefined),
  idbDeleteCollection: vi.fn().mockResolvedValue(undefined),
  idbLoadFolders: vi.fn().mockResolvedValue([]),
  idbSaveFolder: vi.fn().mockResolvedValue(undefined),
  idbDeleteFolder: vi.fn().mockResolvedValue(undefined),
  idbLoadItems: vi.fn().mockResolvedValue([]),
  idbSaveItem: vi.fn().mockResolvedValue(undefined),
  idbDeleteItem: vi.fn().mockResolvedValue(undefined),
  idbUpdateItemSortOrders: vi.fn().mockResolvedValue(undefined),
  idbExportCollections: vi.fn().mockResolvedValue({}),
  idbImportCollections: vi.fn().mockResolvedValue([]),
}));

import { SaveToCollectionModal, type SaveToCollectionModalProps } from './GraphqlSaveToCollectionModal';

// ─── Local type mirrors (avoid importing the full hook to prevent IDB side effects) ──

interface LocalFolder {
  id: string;
  collectionId: string;
  name: string;
  sortOrder: number;
  createdAt: number;
  parentId?: string;
}

interface LocalTree {
  collection: { id: string; name: string; variables: Record<string, string>; preRequestScript: string; postResponseScript: string; createdAt: number };
  folders: LocalFolder[];
  items: unknown[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTree(id: string, name: string, folders: LocalFolder[] = []): LocalTree {
  return {
    collection: { id, name, variables: {}, preRequestScript: '', postResponseScript: '', createdAt: Date.now() },
    folders,
    items: [],
  };
}

function makeFolder(id: string, collectionId: string, name: string): LocalFolder {
  return { id, collectionId, name, sortOrder: 0, createdAt: Date.now(), parentId: undefined };
}

function defaultProps(overrides: Partial<SaveToCollectionModalProps> = {}): SaveToCollectionModalProps {
  return {
    defaultName: 'My Operation',
    trees: [makeTree('col-1', 'Collection 1')],
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SaveToCollectionModal — rendering', () => {
  it('renders with defaultName in the name input', () => {
    render(<SaveToCollectionModal {...defaultProps()} />);
    const input = screen.getByTestId('gql-save-col-name') as HTMLInputElement;
    expect(input.value).toBe('My Operation');
  });

  it('uses "Unnamed operation" when defaultName is empty', () => {
    render(<SaveToCollectionModal {...defaultProps({ defaultName: '' })} />);
    const input = screen.getByTestId('gql-save-col-name') as HTMLInputElement;
    expect(input.value).toBe('Unnamed operation');
  });

  it('renders collection options in the select', () => {
    const trees = [makeTree('col-1', 'Collection A'), makeTree('col-2', 'Collection B')];
    render(<SaveToCollectionModal {...defaultProps({ trees })} />);
    const select = screen.getByTestId('gql-save-col-collection') as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(select.options[0].text).toBe('Collection A');
    expect(select.options[1].text).toBe('Collection B');
  });

  it('shows empty state when no collections exist', () => {
    render(<SaveToCollectionModal {...defaultProps({ trees: [] })} />);
    expect(screen.getByText('No collections yet. Create one first.')).toBeTruthy();
    expect(screen.queryByTestId('gql-save-col-collection')).toBeNull();
  });

  it('shows folder select when the selected collection has folders', () => {
    const folder = makeFolder('fld-1', 'col-1', 'Folder A');
    const trees = [makeTree('col-1', 'Collection 1', [folder])];
    render(<SaveToCollectionModal {...defaultProps({ trees })} />);
    expect(screen.getByTestId('gql-save-col-folder')).toBeTruthy();
    expect(screen.getByText('Folder A')).toBeTruthy();
  });

  it('does not show folder select when selected collection has no folders', () => {
    const trees = [makeTree('col-1', 'Collection 1', [])];
    render(<SaveToCollectionModal {...defaultProps({ trees })} />);
    expect(screen.queryByTestId('gql-save-col-folder')).toBeNull();
  });

  it('save button is disabled when there are no collections', () => {
    render(<SaveToCollectionModal {...defaultProps({ trees: [] })} />);
    const saveBtn = screen.getByTestId('gql-save-col-save') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('has a role=dialog with the right aria-label', () => {
    render(<SaveToCollectionModal {...defaultProps()} />);
    expect(document.querySelector('[role="dialog"][aria-label="Save to collection"]')).toBeTruthy();
  });
});

describe('SaveToCollectionModal — save validation', () => {
  it('calls onSave with correct args when form is valid', () => {
    const onSave = vi.fn();
    render(<SaveToCollectionModal {...defaultProps({ onSave })} />);
    fireEvent.click(screen.getByTestId('gql-save-col-save'));
    expect(onSave).toHaveBeenCalledWith('col-1', undefined, 'My Operation');
  });

  it('calls onSave with folderId when folder is selected', () => {
    const onSave = vi.fn();
    const folder = makeFolder('fld-1', 'col-1', 'Folder A');
    const trees = [makeTree('col-1', 'Collection 1', [folder])];
    render(<SaveToCollectionModal {...defaultProps({ trees, onSave })} />);
    fireEvent.change(screen.getByTestId('gql-save-col-folder'), { target: { value: 'fld-1' } });
    fireEvent.click(screen.getByTestId('gql-save-col-save'));
    expect(onSave).toHaveBeenCalledWith('col-1', 'fld-1', 'My Operation');
  });

  it('shows error when name is empty', () => {
    render(<SaveToCollectionModal {...defaultProps({ defaultName: '' })} />);
    // Clear the default "Unnamed operation" name
    fireEvent.change(screen.getByTestId('gql-save-col-name'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('gql-save-col-save'));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Name is required')).toBeTruthy();
  });

  it('shows error when variables are invalid JSON', () => {
    render(<SaveToCollectionModal {...defaultProps({ operationVariables: '{ invalid json' })} />);
    fireEvent.click(screen.getByTestId('gql-save-col-save'));
    expect(screen.getByText('Variables must be valid JSON')).toBeTruthy();
  });

  it('does not show error when variables are valid JSON', () => {
    const onSave = vi.fn();
    render(<SaveToCollectionModal {...defaultProps({ operationVariables: '{"key": "value"}', onSave })} />);
    fireEvent.click(screen.getByTestId('gql-save-col-save'));
    expect(onSave).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not validate variables when they are empty {}', () => {
    const onSave = vi.fn();
    render(<SaveToCollectionModal {...defaultProps({ operationVariables: '{}', onSave })} />);
    fireEvent.click(screen.getByTestId('gql-save-col-save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('trims whitespace-only variables string', () => {
    const onSave = vi.fn();
    render(<SaveToCollectionModal {...defaultProps({ operationVariables: '   ', onSave })} />);
    fireEvent.click(screen.getByTestId('gql-save-col-save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('clears error when name input is modified after an error', () => {
    render(<SaveToCollectionModal {...defaultProps({ defaultName: '' })} />);
    fireEvent.change(screen.getByTestId('gql-save-col-name'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('gql-save-col-save'));
    expect(screen.getByText('Name is required')).toBeTruthy();
    fireEvent.change(screen.getByTestId('gql-save-col-name'), { target: { value: 'New Name' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SaveToCollectionModal — cancel interaction', () => {
  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<SaveToCollectionModal {...defaultProps({ onCancel })} />);
    fireEvent.click(screen.getByTestId('gql-save-col-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn();
    render(<SaveToCollectionModal {...defaultProps({ onCancel })} />);
    fireEvent.keyDown(screen.getByTestId('gql-save-col-modal'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onCancel for non-Escape keys', () => {
    const onCancel = vi.fn();
    render(<SaveToCollectionModal {...defaultProps({ onCancel })} />);
    fireEvent.keyDown(screen.getByTestId('gql-save-col-modal'), { key: 'Enter' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('SaveToCollectionModal — collection switching', () => {
  it('updates folder list when selected collection changes', () => {
    const folder2 = makeFolder('fld-2', 'col-2', 'Folder B');
    const trees = [makeTree('col-1', 'Collection 1', []), makeTree('col-2', 'Collection 2', [folder2])];
    render(<SaveToCollectionModal {...defaultProps({ trees })} />);

    // Initially no folder select (col-1 has no folders)
    expect(screen.queryByTestId('gql-save-col-folder')).toBeNull();

    // Switch to col-2 which has a folder
    fireEvent.change(screen.getByTestId('gql-save-col-collection'), { target: { value: 'col-2' } });
    expect(screen.getByTestId('gql-save-col-folder')).toBeTruthy();
    expect(screen.getByText('Folder B')).toBeTruthy();
  });

  it('shows error when no collection is selected', () => {
    render(<SaveToCollectionModal {...defaultProps()} />);
    fireEvent.change(screen.getByTestId('gql-save-col-collection'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('gql-save-col-save'));
    expect(screen.getByText('Select a collection')).toBeTruthy();
  });

  it('auto-selects the first collection when trees load after mount', () => {
    const { rerender } = render(
      <SaveToCollectionModal {...defaultProps({ trees: [], defaultName: 'Op' })} />,
    );
    expect(screen.getByText('No collections yet. Create one first.')).toBeTruthy();
    rerender(
      <SaveToCollectionModal
        {...defaultProps({ trees: [makeTree('col-new', 'New Collection')], defaultName: 'Op' })}
      />,
    );
    expect((screen.getByTestId('gql-save-col-collection') as HTMLSelectElement).value).toBe('col-new');
  });
});
