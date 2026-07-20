/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarContextMenu from './SidebarContextMenu';
import { RequestCollection, RequestFolder, RequestItem } from '../../../shared/types';
import { CtxMenuData } from './RequestsSidebar';

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
    getSubColEligibleCount: vi.fn(() => 1),
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

  it('group menu: triggers actions and delete confirm with request count wording', () => {
    const g1: RequestCollection = { id: 'g1', name: 'G1', mode: 'group', requests: [], folders: [] };
    const c1: RequestCollection = {
      id: 'c1', name: 'C1', mode: 'direct', groupId: 'g1', requests: [req('r1', 'R1')], folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'g1' }, [g1, c1]);

    fireEvent.click(screen.getByText('Add Group'));
    expect(baseCallbacks.startAddGroup).toHaveBeenCalledWith('g1');

    fireEvent.click(screen.getByText('Add URL Collection'));
    expect(baseCallbacks.onNewCollection).toHaveBeenCalledWith('direct', 'g1');

    fireEvent.click(screen.getByText('Rename'));
    expect(baseCallbacks.startRenameGroup).toHaveBeenCalledWith('g1', 'G1');

    fireEvent.click(screen.getByText('Duplicate Group'));
    expect(baseCallbacks.onDuplicateGroup).toHaveBeenCalledWith('g1');

    fireEvent.click(screen.getByText('Delete Group'));
    expect(baseCallbacks.setConfirmDelete).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('1 request'),
    }));
  });

  it('group menu: delete wording uses plural requests', () => {
    const g1: RequestCollection = { id: 'g1', name: 'G1', mode: 'group', requests: [], folders: [] };
    const c1: RequestCollection = {
      id: 'c1', name: 'C1', mode: 'direct', groupId: 'g1',
      requests: [req('r1', 'R1'), req('r2', 'R2')],
      folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'g1' }, [g1, c1]);
    fireEvent.click(screen.getByText('Delete Group'));
    expect(baseCallbacks.setConfirmDelete).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('2 requests'),
    }));
  });

  it('group menu: returns null when group id missing from collections', () => {
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'missing' }, []);
    expect(screen.queryByText('Add Group')).not.toBeInTheDocument();
  });

  it('collection menu: move submenu merge into another collection', () => {
    const a: RequestCollection = { id: 'a', name: 'A', mode: 'direct', requests: [], folders: [] };
    const b: RequestCollection = { id: 'b', name: 'B', mode: 'direct', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'a' }, [a, b]);

    fireEvent.click(screen.getByText('Move to...'));
    fireEvent.click(screen.getByText(/B/));
    expect(baseCallbacks.onMergeCollectionInto).toHaveBeenCalledWith('a', 'b');
  });

  it('collection menu: tree root when collection has groupId', () => {
    const a: RequestCollection = {
      id: 'a', name: 'A', mode: 'direct', groupId: 'g1', requests: [], folders: [],
    };
    const g1: RequestCollection = { id: 'g1', name: 'G1', mode: 'group', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'a' }, [g1, a]);

    fireEvent.click(screen.getByText('Move to...'));
    fireEvent.click(screen.getByText(/Root level/));
    expect(baseCallbacks.onMoveToGroup).toHaveBeenCalledWith('a', undefined);
  });

  it('folder menu: sub-collection shows edit settings and sub labels', () => {
    const folderId = 'f1';
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [{ id: folderId, name: 'Sub', isSubCollection: true, requests: [], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId }, [col]);

    expect(screen.getByText('Edit Settings')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Edit Settings'));
    expect(baseCallbacks.onEditSubCollection).toHaveBeenCalledWith('c1', folderId);

    expect(screen.getByText('Duplicate Sub-Collection')).toBeInTheDocument();
    expect(screen.getByText('Export Sub-Collection')).toBeInTheDocument();
  });

  it('folder menu: empty sub-collection delete omits request wording', () => {
    const folderId = 'f1';
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [{ id: folderId, name: 'Sub', isSubCollection: true, requests: [], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId }, [col]);
    fireEvent.click(screen.getByText('Delete Sub-Collection'));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).toMatch(/sub-collection/);
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).not.toMatch(/\d+ request/);
  });

  it('folder menu: move into nested folder of another collection', () => {
    const colA: RequestCollection = {
      id: 'a',
      name: 'ColA',
      mode: 'direct',
      requests: [],
      folders: [{ id: 'fx', name: 'FoldX', requests: [], folders: [] }],
    };
    const colB: RequestCollection = {
      id: 'b',
      name: 'ColB',
      mode: 'direct',
      requests: [],
      folders: [{ id: 'nest', name: 'TargetNest', requests: [], folders: [] }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'a', folderId: 'fx' },
      [colA, colB],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /ColB/ }));
    fireEvent.click(screen.getByRole('button', { name: /TargetNest/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move here/ }));
    expect(baseCallbacks.onMoveFolderToCollection).toHaveBeenCalledWith('a', 'fx', 'b', 'nest');
  });

  it('folder menu: delete uses plural requests for two reqs in same folder', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [{
        id: 'f1',
        name: 'F',
        requests: [req('rA', 'A'), req('rB', 'B')],
        folders: [],
      }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' }, [col]);
    fireEvent.click(screen.getByText('Delete Folder'));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).toMatch(/2 requests/);
  });

  it('folder menu: delete confirm uses empty name when folder id missing from tree', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [{ id: 'f1', name: 'Real', requests: [], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'ghost' }, [col]);
    fireEvent.click(screen.getByText('Delete Folder'));
    const msg = baseCallbacks.setConfirmDelete.mock.calls[0][0].message as string;
    expect(msg).toMatch(/^Delete folder ""\?$/);
  });

  it('folder menu: delete uses singular request wording for one nested request', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [{
        id: 'f1', name: 'F', requests: [req('rSolo', 'Solo')], folders: [],
      }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' }, [col]);
    fireEvent.click(screen.getByText('Delete Folder'));
    const msg = baseCallbacks.setConfirmDelete.mock.calls[0][0].message as string;
    expect(msg).toMatch(/and its 1 request\?/);
    expect(msg).not.toContain('requests');
  });

  it('folder menu: delete uses plural requests when nested folders hold more rows', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [{
        id: 'f1',
        name: 'Outer',
        requests: [req('a', 'A')],
        folders: [{ id: 'inner', name: 'Inner', requests: [req('b', 'B')], folders: [] }],
      }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' }, [col]);
    fireEvent.click(screen.getByText('Delete Folder'));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).toMatch(/2 requests/);
  });

  it('folder menu: move up and move down when siblings exist', () => {
    const folderId = 'f2';
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [
        { id: 'f1', name: 'A', requests: [], folders: [] },
        { id: folderId, name: 'B', requests: [], folders: [] },
        { id: 'f3', name: 'C', requests: [], folders: [] },
      ],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId }, [col]);

    fireEvent.click(screen.getByText('Move Up'));
    expect(baseCallbacks.onMoveFolder).toHaveBeenCalledWith('c1', folderId, 'up');

    fireEvent.click(screen.getByText('Move Down'));
    expect(baseCallbacks.onMoveFolder).toHaveBeenCalledWith('c1', folderId, 'down');
  });

  it('request menu: navigate into collection and move to folder', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [req('r9', 'Nine')],
      folders: [{ id: 'fold1', name: 'F1', requests: [], folders: [] }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r9' },
      [col],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );

    fireEvent.click(screen.getByRole('button', { name: /📋 C/ }));
    fireEvent.click(screen.getByRole('button', { name: /F1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move here/ }));
    expect(baseCallbacks.onMoveRequest).toHaveBeenCalledWith('c1', 'r9', 'fold1');
  });

  it('request menu: open in new tab action delegates and dismisses', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [req('r9', 'Nine')],
      folders: [],
    };
    const onOpenInNewTab = vi.fn();
    const dismiss = vi.fn();
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r9' },
      [col],
      { onOpenInNewTab, dismiss },
    );

    fireEvent.click(screen.getByText('Open in New Tab'));
    expect(onOpenInNewTab).toHaveBeenCalledWith('c1', 'r9');
    expect(dismiss).toHaveBeenCalled();
  });

  it('folder menu: send-to-harness delegates and dismisses', () => {
    const folderId = 'f1';
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [{ id: folderId, name: 'Sub', isSubCollection: true, requests: [], folders: [] }],
    };
    const onSendFolderToHarness = vi.fn();
    const dismiss = vi.fn();
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId },
      [col],
      { onSendFolderToHarness, dismiss },
    );

    fireEvent.click(screen.getByText('Send to Harness'));
    expect(onSendFolderToHarness).toHaveBeenCalledWith('c1', folderId);
    expect(dismiss).toHaveBeenCalled();
  });

  it('request menu: move from folder to collection root via navigation', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [{ id: 'fold1', name: 'F1', requests: [req('r9', 'Nine')], folders: [] }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r9' },
      [col],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /📋 C/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move here/ }));
    expect(baseCallbacks.onMoveRequest).toHaveBeenCalledWith('c1', 'r9', null);
  });

  it('request menu: deep nested request can move to collection root', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [{
        id: 'p',
        name: 'P',
        requests: [],
        folders: [{
          id: 'inner',
          name: 'I',
          requests: [req('r99', 'DeepReq')],
          folders: [],
        }],
      }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r99' },
      [col],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /📋 C/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move here/ }));
    expect(baseCallbacks.onMoveRequest).toHaveBeenCalledWith('c1', 'r99', null);
  });

  it('request menu: missing collection hides move submenu but duplicate still fires', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [req('r1', 'R')], folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'request', colId: 'ghost', reqId: 'r1' }, [col], { showMoveMenu: true });
    expect(screen.queryByText('Move to...')).toBeNull();
    fireEvent.click(screen.getByText('Duplicate'));
    expect(baseCallbacks.onDuplicateRequest).toHaveBeenCalledWith('ghost', 'r1');
  });

  it('request menu: empty req id omits request block', () => {
    const col: RequestCollection = { id: 'c1', name: 'C', mode: 'direct', requests: [req('r1', 'R')], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'request', colId: 'c1', reqId: '' as unknown as string }, [col]);
    expect(screen.queryByText('Duplicate')).toBeNull();
  });

  it('request menu: request at root of own collection shows current location after nav', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [req('r1', 'R')], folders: [{ id: 'f1', name: 'F', requests: [], folders: [] }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r1' },
      [col],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );
    const btn = screen.getByRole('button', { name: /📋 C/ });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByText(/Current location/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /F/ })).toBeTruthy();
  });

  it('request menu: unknown request id resolves name to Untitled', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [req('keep', 'Keep')], folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'nope' }, [col]);
    fireEvent.click(screen.getByText('Delete'));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).toContain('Untitled');
  });

  it('request menu: nested request with blank name shows Untitled in delete confirm', () => {
    const unnamed = { ...req('r9', ''), name: '' };
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [{ id: 'f1', name: 'F', requests: [unnamed], folders: undefined as unknown as RequestFolder[] }],
    };
    renderMenu({ x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r9' }, [col]);
    fireEvent.click(screen.getByText('Delete'));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).toContain('Untitled');
  });

  it('folder menu: move to collection root via navigation', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [
        { id: 'parent', name: 'P', requests: [], folders: [{ id: 'nested', name: 'N', requests: [], folders: [] }] },
      ],
    };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'nested' },
      [col],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /📋 C/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move here/ }));
    expect(baseCallbacks.onMoveFolderTo).toHaveBeenCalledWith('c1', 'nested', null);
  });

  it('collection delete confirm uses singular request', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'Only',
      mode: 'direct',
      requests: [req('r1', 'A')],
      folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'c1' }, [col], {
      countAllRequests: () => 1,
    });
    fireEvent.click(screen.getByText('Delete Collection'));
    expect(baseCallbacks.setConfirmDelete).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringMatching(/1 request[^s]/),
    }));
  });

  it('folder menu: non-sub duplicate/export/import and plural delete', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [{ id: 'f1', name: 'F', requests: [req('a', 'A'), req('b', 'B')], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' }, [col]);
    fireEvent.click(screen.getByText('Duplicate Folder'));
    expect(baseCallbacks.onDuplicateFolder).toHaveBeenCalledWith('c1', 'f1');
    fireEvent.click(screen.getByText('Export Folder'));
    expect(baseCallbacks.handleExportFolder).toHaveBeenCalledWith('c1', 'f1');
    fireEvent.click(screen.getByText('Import into Folder'));
    expect(baseCallbacks.handleImportToFolder).toHaveBeenCalledWith('c1', 'f1');
    fireEvent.click(screen.getByText('Delete Folder'));
    expect(baseCallbacks.setConfirmDelete).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('2 requests'),
    }));
  });

  it('folder menu: move into sibling folder via navigation', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [
        { id: 'f1', name: 'Here', requests: [], folders: [] },
        { id: 'f2', name: 'There', requests: [], folders: [] },
      ],
    };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' },
      [col],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /📋 C/ }));
    fireEvent.click(screen.getByRole('button', { name: /There/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move here/ }));
    expect(baseCallbacks.onMoveFolderTo).toHaveBeenCalledWith('c1', 'f1', 'f2');
  });

  it('folder menu: move targets omit descendant folders', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [
        {
          id: 'parent',
          name: 'Parent',
          requests: [],
          folders: [{ id: 'child', name: 'Child', requests: [], folders: [] }],
        },
      ],
    };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'parent' },
      [col],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    expect(screen.queryByRole('button', { name: /Child/ })).toBeNull();
  });

  it('folder menu: move into another collection folder tree via navigation', () => {
    const c1: RequestCollection = {
      id: 'c1',
      name: 'A',
      mode: 'direct',
      requests: [],
      folders: [{ id: 'fx', name: 'MoveMe', requests: [], folders: [] }],
    };
    const c2: RequestCollection = {
      id: 'c2',
      name: 'B',
      mode: 'direct',
      requests: [],
      folders: [{ id: 'dest', name: 'Dest', requests: [], folders: [] }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'fx' },
      [c1, c2],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /📦 B/ }));
    fireEvent.click(screen.getByRole('button', { name: /Dest/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move here/ }));
    expect(baseCallbacks.onMoveFolderToCollection).toHaveBeenLastCalledWith('c1', 'fx', 'c2', 'dest');
  });

  it('group menu: export and import', () => {
    const g1: RequestCollection = { id: 'g1', name: 'G1', mode: 'group', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'g1' }, [g1]);
    fireEvent.click(screen.getByText('Add ENV Collection'));
    expect(baseCallbacks.onNewCollection).toHaveBeenCalledWith('multi-env', 'g1');
    fireEvent.click(screen.getByText('Export Group'));
    expect(baseCallbacks.handleExportGroup).toHaveBeenCalledWith('g1');
    fireEvent.click(screen.getByText('Import into Group'));
    expect(baseCallbacks.handleImportToCollection).toHaveBeenCalledWith(undefined, 'g1');
  });

  it('collection menu: add request, export, import', () => {
    const col: RequestCollection = { id: 'c1', name: 'C', mode: 'direct', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'c1' }, [col]);
    fireEvent.click(screen.getByText('Add Request'));
    expect(baseCallbacks.onNewRequest).toHaveBeenCalledWith('c1');
    fireEvent.click(screen.getByText('Edit Collection'));
    expect(baseCallbacks.onEditCollection).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Duplicate Collection'));
    expect(baseCallbacks.onDuplicateCollection).toHaveBeenCalledWith('c1');
    fireEvent.click(screen.getByText('Export Collection'));
    expect(baseCallbacks.handleExportCollection).toHaveBeenCalledWith('c1');
    fireEvent.click(screen.getByText('Import into Collection'));
    expect(baseCallbacks.handleImportToCollection).toHaveBeenCalledWith('c1');
  });

  it('collection menu: delete with zero requests', () => {
    const col: RequestCollection = { id: 'c1', name: 'Empty', mode: 'direct', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'c1' }, [col], {
      countAllRequests: () => 0,
    });
    fireEvent.click(screen.getByText('Delete Collection'));
    expect(baseCallbacks.setConfirmDelete).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringMatching(/Delete collection "Empty"/),
    }));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).not.toMatch(/request/);
  });

  it('folder menu: first sibling only moves down', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [
        { id: 'f1', name: 'A', requests: [], folders: [] },
        { id: 'f2', name: 'B', requests: [], folders: [] },
      ],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' }, [col]);
    expect(screen.queryByText('Move Up')).toBeNull();
    expect(screen.getByText('Move Down')).toBeInTheDocument();
  });

  it('folder menu: last sibling only moves up', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [
        { id: 'f1', name: 'A', requests: [], folders: [] },
        { id: 'f2', name: 'B', requests: [], folders: [] },
      ],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f2' }, [col]);
    expect(screen.getByText('Move Up')).toBeInTheDocument();
    expect(screen.queryByText('Move Down')).toBeNull();
  });

  it('request menu: move to another collection tree', () => {
    const c1: RequestCollection = {
      id: 'c1',
      name: 'C1',
      mode: 'direct',
      requests: [req('r1', 'R1')],
      folders: [],
    };
    const c2: RequestCollection = {
      id: 'c2',
      name: 'C2',
      mode: 'direct',
      requests: [],
      folders: [{ id: 'fx', name: 'Inner', requests: [], folders: [] }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r1' },
      [c1, c2],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );

    fireEvent.click(screen.getByRole('button', { name: /C2/ }));
    fireEvent.click(screen.getByRole('button', { name: /Inner/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move here/ }));
    expect(baseCallbacks.onMoveRequestToCollection).toHaveBeenCalledWith('c1', 'r1', 'c2', 'fx');
  });

  it('group menu: delete wording omits request clause when group has no requests', () => {
    const g1: RequestCollection = { id: 'g1', name: 'EmptyG', mode: 'group', requests: [], folders: [] };
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'g1' }, [g1]);
    fireEvent.click(screen.getByText('Delete Group'));
    expect(baseCallbacks.setConfirmDelete).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringMatching(/Delete group "EmptyG"/),
    }));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).not.toMatch(/\d+ request/);
  });

  it('group menu: nested group shows move submenu and root level target', () => {
    const root: RequestCollection = { id: 'root', name: 'Root', mode: 'group', requests: [], folders: [] };
    const child: RequestCollection = {
      id: 'child', name: 'Child', mode: 'group', groupId: 'root', requests: [], folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'group', colId: 'child' }, [root, child]);
    fireEvent.click(screen.getByText('Move to...'));
    fireEvent.click(screen.getByRole('button', { name: /Root level/ }));
    expect(baseCallbacks.onMoveToGroup).toHaveBeenCalledWith('child', undefined);
  });

  it('collection menu: move collection to another group', () => {
    const g1: RequestCollection = { id: 'g1', name: 'GX', mode: 'group', requests: [], folders: [] };
    const g2: RequestCollection = { id: 'g2', name: 'GY', mode: 'group', requests: [], folders: [] };
    const a: RequestCollection = {
      id: 'a', name: 'A', mode: 'direct', groupId: 'g1', requests: [], folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'a' }, [g1, g2, a]);
    fireEvent.click(screen.getByText('Move to...'));
    fireEvent.click(screen.getByRole('button', { name: /GY/ }));
    expect(baseCallbacks.onMoveToGroup).toHaveBeenCalledWith('a', 'g2');
  });

  it('collection menu: delete uses plural requests when count > 1', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'Many', mode: 'direct', requests: [], folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'collection', colId: 'c1' }, [col], {
      countAllRequests: () => 3,
    });
    fireEvent.click(screen.getByText('Delete Collection'));
    expect(baseCallbacks.setConfirmDelete.mock.calls[0][0].message).toMatch(/3 requests/);
  });

  it('folder menu: unknown folder id skips sibling moves', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [], folders: [{ id: 'f1', name: 'F', requests: [], folders: [] }],
    };
    renderMenu({ x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'missing' }, [col]);
    expect(screen.queryByText('Move Up')).toBeNull();
    expect(screen.queryByText('Move Down')).toBeNull();
  });

  it('folder menu: three-level nesting shows collection at top level', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [],
      folders: [{
        id: 'L1', name: 'L1', requests: [], folders: [{
          id: 'L2', name: 'L2', requests: [], folders: [{ id: 'L3', name: 'L3', requests: [], folders: [] }],
        }],
      }],
    };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'L3' },
      [col],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    expect(screen.getByRole('button', { name: /📋 C/ })).toBeTruthy();
  });

  it('folder menu: nested folders appear after navigating into collection', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [
        {
          id: 'parent',
          name: 'Parent',
          requests: [],
          folders: [{ id: 'inner', name: 'Inner', requests: [], folders: [] }],
        },
        { id: 'peer', name: 'Peer', requests: [], folders: [] },
      ],
    };
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'peer' },
      [col],
      { showFolderMoveMenu: true, setShowFolderMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /📋 C/ }));
    fireEvent.click(screen.getByRole('button', { name: /Parent/ }));
    fireEvent.click(screen.getByRole('button', { name: /Inner/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move here/ }));
    expect(baseCallbacks.onMoveFolderTo).toHaveBeenCalledWith('c1', 'peer', 'inner');
  });

  it('folder menu: toggles move submenu from closed state', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [], folders: [{ id: 'f1', name: 'F', requests: [], folders: [] }],
    };
    const setFolder = vi.fn();
    renderMenu(
      { x: 0, y: 0, type: 'folder', colId: 'c1', folderId: 'f1' },
      [col],
      { showFolderMoveMenu: false, setShowFolderMoveMenu: setFolder },
    );
    fireEvent.click(screen.getByText('Move to...'));
    expect(setFolder).toHaveBeenCalledWith(true);
  });

  it('request menu: duplicate', () => {
    const col: RequestCollection = {
      id: 'c1', name: 'C', mode: 'direct', requests: [req('r1', 'One')], folders: [],
    };
    renderMenu({ x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'r1' }, [col]);
    fireEvent.click(screen.getByText('Duplicate'));
    expect(baseCallbacks.onDuplicateRequest).toHaveBeenCalledWith('c1', 'r1');
  });

  it('request menu: navigating into collection shows current location marker', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'direct',
      requests: [],
      folders: [
        { id: 'here', name: 'Here', requests: [req('rx', 'InHere')], folders: [] },
        { id: 'there', name: 'There', requests: [], folders: [] },
      ],
    };
    renderMenu(
      { x: 0, y: 0, type: 'request', colId: 'c1', reqId: 'rx' },
      [col],
      { showMoveMenu: true, setShowMoveMenu: vi.fn() },
    );
    fireEvent.click(screen.getByRole('button', { name: /📋 C/ }));
    fireEvent.click(screen.getByRole('button', { name: /Here/ }));
    expect(screen.getByText(/Current location/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    fireEvent.click(screen.getByRole('button', { name: /There/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move here/ }));
    expect(baseCallbacks.onMoveRequest).toHaveBeenCalledWith('c1', 'rx', 'there');
  });

});
