/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarContextMenu from './SidebarContextMenu';
import type { RequestCollection, RequestFolder, RequestItem } from '../../../shared/types';
import type { CtxMenuData } from './RequestsSidebar';

function req(id: string, name: string): RequestItem {
  return {
    id,
    name,
    method: 'GET',
    url: '/a',
    headers: [],
    body: '',
    auth: { type: 'none' },
  };
}

function makeBaseCallbacks() {
  return {
    dismiss: vi.fn(),
    onNewRequest: vi.fn(),
    onEditCollection: vi.fn(),
    onDuplicateCollection: vi.fn(),
    onDeleteCollection: vi.fn(),
    onEditSubCollection: vi.fn(),
    onDuplicateFolder: vi.fn(),
    onDuplicateRequest: vi.fn(),
    onDeleteFolder: vi.fn(),
    onDeleteRequest: vi.fn(),
    onMoveFolder: vi.fn(),
    onMoveFolderTo: vi.fn(),
    onMoveRequest: vi.fn(),
    onMoveRequestToCollection: vi.fn(),
    onMoveFolderToCollection: vi.fn(),
    onMergeCollectionInto: vi.fn(),
    countAllRequests: vi.fn(() => 0),
    startAddFolder: vi.fn(),
    startRenameFolder: vi.fn(),
    handleExportCollection: vi.fn(),
    handleExportFolder: vi.fn(),
    handleImportToCollection: vi.fn(),
    handleImportToFolder: vi.fn(),
    setConfirmDelete: vi.fn(),
    onNewCollection: vi.fn(),
    startAddGroup: vi.fn(),
    startRenameGroup: vi.fn(),
    onDeleteGroup: vi.fn(),
    onDuplicateGroup: vi.fn(),
    onMoveToGroup: vi.fn(),
    handleExportGroup: vi.fn(),
  };
}

describe('SidebarContextMenu', () => {
  const baseCallbacks = makeBaseCallbacks();

  beforeEach(() => {
    for (const fn of Object.values(baseCallbacks)) {
      if (typeof fn === 'function' && 'mockClear' in fn) (fn as ReturnType<typeof vi.fn>).mockClear();
    }
  });

  function renderMenu(
    contextMenu: CtxMenuData,
    collections: RequestCollection[],
    overrides: Partial<Parameters<typeof SidebarContextMenu>[0]> = {},
  ) {
    return render(
      <SidebarContextMenu
        contextMenu={contextMenu}
        collections={collections}
        nonGroupCollections={collections.filter((c) => c.mode !== 'group')}
        showMoveMenu={false}
        showFolderMoveMenu={false}
        setShowMoveMenu={vi.fn()}
        setShowFolderMoveMenu={vi.fn()}
        {...baseCallbacks}
        {...overrides}
      />,
    );
  }

  it('request menu: move to nested folder in another collection', () => {
    const colA: RequestCollection = {
      id: 'a',
      name: 'ColA',
      mode: 'direct',
      requests: [req('rx', 'MoveMe')],
      folders: [],
    };
    const colB: RequestCollection = {
      id: 'b',
      name: 'ColB',
      mode: 'direct',
      requests: [],
      folders: [{ id: 'nest', name: 'Nested', requests: [], folders: [] }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'a', reqId: 'rx' },
      [colA, colB],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /Nested/ }));
    expect(baseCallbacks.onMoveRequestToCollection).toHaveBeenCalledWith('a', 'rx', 'b', 'nest');
  });

  it('request menu: move to root of another collection', () => {
    const colA: RequestCollection = {
      id: 'a', name: 'A', mode: 'direct', requests: [req('rx', 'X')], folders: [],
    };
    const colB: RequestCollection = {
      id: 'b', name: 'DestCol', mode: 'direct', requests: [], folders: [],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'a', reqId: 'rx' },
      [colA, colB],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /DestCol/ }));
    expect(baseCallbacks.onMoveRequestToCollection).toHaveBeenCalledWith('a', 'rx', 'b', null);
  });

  it('request menu: move into deeply nested folder of another collection', () => {
    const colA: RequestCollection = {
      id: 'a',
      name: 'ColA',
      mode: 'direct',
      requests: [req('rx', 'MoveMe')],
      folders: [],
    };
    const colB: RequestCollection = {
      id: 'b',
      name: 'ColB',
      mode: 'direct',
      requests: [],
      folders: [{
        id: 'outer',
        name: 'Outer',
        requests: [],
        folders: [{ id: 'deep', name: 'Deep', requests: [], folders: [] }],
      }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'a', reqId: 'rx' },
      [colA, colB],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /Deep/ }));
    expect(baseCallbacks.onMoveRequestToCollection).toHaveBeenCalledWith('a', 'rx', 'b', 'deep');
  });

  it('request menu: unknown req id treats location as undefined for move targets', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [req('r1', 'R')],
      folders: [{ id: 'f1', name: 'F', requests: [], folders: [] }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'ghost' },
      [col],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );
    expect(screen.getByRole('button', { name: /Collection Root/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /F/ }));
    expect(baseCallbacks.onMoveRequest).toHaveBeenCalledWith('c1', 'ghost', 'f1');
  });

  it('request menu: delete uses Untitled when request has no name in nested folder', () => {
    const unnamed = { ...req('r9', ''), name: '' };
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [{ id: 'fold1', name: 'F', requests: [unnamed], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r9' }, [col]);
    fireEvent.click(screen.getByText('Delete'));
    expect(baseCallbacks.setConfirmDelete).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Untitled'),
    }));
  });

  it('request menu: toggles move submenu via Move to button', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [req('r1', 'R')], folders: [],
    };
    const setMove = vi.fn();
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r1' },
      [col],
      { showMoveMenu: false, setShowMoveMenu: setMove },
    );
    fireEvent.click(screen.getByText('Move to...'));
    expect(setMove).toHaveBeenCalledWith(true);
  });

  it('folder menu: singular request in delete message', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [{ id: 'f1', name: 'F', requests: [req('a', 'A')], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' }, [col]);
    fireEvent.click(screen.getByText('Delete Folder'));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).toMatch(/1 request[^s]/);
  });

  it('folder menu: rename no-ops when folder missing from tree', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [{ id: 'f1', name: 'F', requests: [], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'missing' }, [col]);
    fireEvent.click(screen.getByText('Rename'));
    expect(baseCallbacks.startRenameFolder).not.toHaveBeenCalled();
  });

  it('folder menu: rename passes resolved folder name', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [{ id: 'f1', name: 'Fold', requests: [], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' }, [col]);
    fireEvent.click(screen.getByText('Rename'));
    expect(baseCallbacks.startRenameFolder).toHaveBeenCalledWith('c1', 'f1', 'Fold');
  });

  it('collection menu: delete uses empty name when collection id missing', () => {
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'missing' }, [], {
      countAllRequests: () => 5,
    });
    fireEvent.click(screen.getByText('Delete Collection'));
    const msg = baseCallbacks.setConfirmDelete.mock.calls[0][0].message as string;
    expect(msg).toMatch(/^Delete collection ""\?$/);
  });

  it('folder move submenu works when collection has undefined folders', () => {
    const col = {
      id: 'c1', name: 'C', mode: 'direct' as const, requests: [], folders: undefined,
    } as RequestCollection;
    const { container } = render(
      <SidebarContextMenu
        contextMenu={{ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'n/a' }}
        collections={[col]}
        nonGroupCollections={[col]}
        showMoveMenu={false}
        showFolderMoveMenu
        setShowMoveMenu={vi.fn()}
        setShowFolderMoveMenu={vi.fn()}
        {...makeBaseCallbacks()}
      />,
    );
    expect(container.querySelector('.req-ctx-submenu')).toBeTruthy();
  });

  it('group menu: single root group omits move submenu', () => {
    const g1: RequestCollection = { id: 'g1', name: 'Solo', mode: 'group', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'g1' }, [g1]);
    expect(screen.queryByText('Move to...')).toBeNull();
  });

  it('collection menu: add folder and sub-collection', () => {
    const col: RequestCollection = { id: 'c1', name: 'C', mode: 'direct', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'c1' }, [col]);
    fireEvent.click(screen.getByText('Add Folder'));
    expect(baseCallbacks.startAddFolder).toHaveBeenCalledWith('c1', undefined, false);
    fireEvent.click(screen.getByText('Add Sub-Collection'));
    expect(baseCallbacks.startAddFolder).toHaveBeenCalledWith('c1', undefined, true);
  });

  it('request menu: omits move submenu when collection missing', () => {
    renderMenu({ x: 0, y: 0, type: 'request', colId: 'ghost', reqId: 'r1' }, []);
    expect(screen.queryByText('Move to...')).toBeNull();
    fireEvent.click(screen.getByText('Delete'));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).toContain('Untitled');
  });

  it('request menu: root unnamed request delete message', () => {
    const unnamed = { ...req('rx', ''), name: '' };
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [unnamed], folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'rx' }, [col]);
    fireEvent.click(screen.getByText('Delete'));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).toContain('Untitled');
  });

  it('group menu: delete uses singular request in its clause', () => {
    const g1: RequestCollection = { id: 'g1', name: 'G1', mode: 'group', requests: [], folders: [] };
    const c1: RequestCollection = {
      id: 'c1', name: 'C1', mode: 'direct', groupId: 'g1', requests: [req('r1', 'R1')], folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'g1' }, [g1, c1]);
    fireEvent.click(screen.getByText('Delete Group'));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).toMatch(/1 request and/);
  });

  it('group menu: move to peer root group', () => {
    const g1: RequestCollection = { id: 'g1', name: 'GA', mode: 'group', requests: [], folders: [] };
    const g2: RequestCollection = { id: 'g2', name: 'GB', mode: 'group', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'g1' }, [g1, g2]);
    fireEvent.click(screen.getByText('Move to...'));
    fireEvent.click(screen.getByRole('button', { name: /GB/ }));
    expect(baseCallbacks.onMoveToGroup).toHaveBeenCalledWith('g1', 'g2');
  });

  it('collection menu: move lists merge target with group present', () => {
    const g1: RequestCollection = { id: 'g1', name: 'Grp', mode: 'group', requests: [], folders: [] };
    const a: RequestCollection = { id: 'a', name: 'A', mode: 'direct', requests: [], folders: [] };
    const b: RequestCollection = { id: 'b', name: 'Bmerge', mode: 'direct', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'a' }, [g1, a, b]);
    fireEvent.click(screen.getByText('Move to...'));
    fireEvent.click(screen.getByRole('button', { name: /Bmerge/ }));
    expect(baseCallbacks.onMergeCollectionInto).toHaveBeenCalledWith('a', 'b');
  });

  it('collection menu: edit skips when collection not in list', () => {
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'missing' }, []);
    fireEvent.click(screen.getByText('Edit Collection'));
    expect(baseCallbacks.onEditCollection).not.toHaveBeenCalled();
  });

  it('group delete confirm calls onDeleteGroup', () => {
    const g1: RequestCollection = { id: 'g1', name: 'G', mode: 'group', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'g1' }, [g1]);
    fireEvent.click(screen.getByText('Delete Group'));
    const dlg = baseCallbacks.setConfirmDelete.mock.calls[0][0];
    dlg.onConfirm();
    expect(baseCallbacks.onDeleteGroup).toHaveBeenCalledWith('g1');
  });

  it('folder menu: add request into folder', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [{ id: 'f1', name: 'F', requests: [], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' }, [col]);
    fireEvent.click(screen.getByText('Add Request'));
    expect(baseCallbacks.onNewRequest).toHaveBeenCalledWith('c1', 'f1');
  });

  it('folder menu: add folder and sub-collection under parent', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [{ id: 'f1', name: 'F', requests: [], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' }, [col]);
    fireEvent.click(screen.getByText('Add Folder'));
    expect(baseCallbacks.startAddFolder).toHaveBeenCalledWith('c1', 'f1', false);
    fireEvent.click(screen.getByText('Add Sub-Collection'));
    expect(baseCallbacks.startAddFolder).toHaveBeenCalledWith('c1', 'f1', true);
  });

  it('folder at collection root omits Collection Root move target', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [{ id: 'f1', name: 'RootF', requests: [], folders: [] }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' },
      [col],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    expect(screen.queryByRole('button', { name: /Collection Root/ })).toBeNull();
  });

  it('collection move submenu shows divider when groups and merge targets exist', () => {
    const g1: RequestCollection = { id: 'g1', name: 'Grp', mode: 'group', requests: [], folders: [] };
    const a: RequestCollection = { id: 'a', name: 'A', mode: 'direct', requests: [], folders: [] };
    const b: RequestCollection = { id: 'b', name: 'Bmerge', mode: 'direct', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'a' }, [g1, a, b]);
    fireEvent.click(screen.getByText('Move to...'));
    const dividers = document.querySelectorAll('.req-dropdown-divider');
    expect(dividers.length).toBeGreaterThan(0);
  });

  it('request move submenu shows divider when another collection exists', () => {
    const c1: RequestCollection = {
      id: 'c1', name: 'C1', mode: 'direct', requests: [req('r1', 'R')], folders: [],
    };
    const c2: RequestCollection = {
      id: 'c2', name: 'C2', mode: 'direct', requests: [], folders: [],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r1' },
      [c1, c2],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );
    expect(document.querySelectorAll('.req-dropdown-divider').length).toBeGreaterThan(0);
  });

  it('folder move submenu shows divider before other collections', () => {
    const c1: RequestCollection = {
      id: 'c1', name: 'A', mode: 'direct', requests: [],
      folders: [{ id: 'fx', name: 'F', requests: [], folders: [] }],
    };
    const c2: RequestCollection = { id: 'c2', name: 'Other', mode: 'direct', requests: [], folders: [] };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'fx' },
      [c1, c2],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    expect(document.querySelectorAll('.req-dropdown-divider').length).toBeGreaterThan(0);
  });

  it('folder menu hidden when folderId missing', () => {
    const col: RequestCollection = { id: 'c1', name: 'C', mode: 'direct', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1' } as CtxMenuData, [col]);
    expect(screen.queryByText('Add Request')).toBeNull();
  });

  it('group move lists excludes self group from targets', () => {
    const g1: RequestCollection = { id: 'g1', name: 'Self', mode: 'group', requests: [], folders: [] };
    const g2: RequestCollection = { id: 'g2', name: 'Peer', mode: 'group', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'g1' }, [g1, g2]);
    fireEvent.click(screen.getByText('Move to...'));
    expect(screen.getByRole('button', { name: /Peer/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /📦\s*Self/ })).toBeNull();
  });

  it('folder menu hides move-to submenu when collection is missing', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [{ id: 'f1', name: 'F', requests: [], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'ghost', folderId: 'f1' }, [col]);
    expect(screen.queryByText('Move to...')).toBeNull();
    fireEvent.click(screen.getByText('Rename'));
    expect(baseCallbacks.startRenameFolder).not.toHaveBeenCalled();
  });

  it('request at collection root hides Collection Root target in move menu', () => {
    const c1: RequestCollection = {
      id: 'c1', name: 'C1', mode: 'direct', requests: [req('r1', 'R')], folders: [],
    };
    const c2: RequestCollection = { id: 'c2', name: 'C2', mode: 'direct', requests: [], folders: [] };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r1' },
      [c1, c2],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );
    expect(screen.queryByRole('button', { name: /Collection Root/ })).toBeNull();
  });

  it('folder move targets treat unknown folder id as non-ancestor for filtering', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [
        { id: 'f1', name: 'One', requests: [], folders: [] },
        { id: 'f2', name: 'Two', requests: [], folders: [] },
      ],
    };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'ghost' },
      [col],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    expect(screen.getByRole('button', { name: /Two/ })).toBeTruthy();
  });

  it('collectAllFolders handles undefined nested folders arrays', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [
        { id: 'p', name: 'Parent', requests: [], folders: undefined as unknown as RequestFolder[] },
        { id: 'leaf', name: 'Leaf', requests: [], folders: [] },
      ],
    };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'leaf' },
      [col],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /Parent/ }));
    expect(baseCallbacks.onMoveFolderTo).toHaveBeenCalledWith('c1', 'leaf', 'p');
  });

  it('context menu root stops click propagation', () => {
    const parentClick = vi.fn();
    const col: RequestCollection = { id: 'c1', name: 'C', mode: 'direct', requests: [], folders: [] };
    const { container } = render(
      <div onClick={parentClick}>
        <SidebarContextMenu
          contextMenu={{ x: 0, y: 0, type: 'collection', colId: 'c1' }}
          collections={[col]}
          nonGroupCollections={[col]}
          showMoveMenu={false}
          showFolderMoveMenu={false}
          setShowMoveMenu={vi.fn()}
          setShowFolderMoveMenu={vi.fn()}
          {...makeBaseCallbacks()}
        />
      </div>,
    );
    fireEvent.click(container.querySelector('.req-context-menu')!);
    expect(parentClick).not.toHaveBeenCalled();
  });
});
