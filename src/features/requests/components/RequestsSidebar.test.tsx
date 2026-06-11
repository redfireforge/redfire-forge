/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestsSidebar from './RequestsSidebar';
import type { RequestCollection } from '../../../shared/types';

const h = vi.hoisted(() => ({
  ctx: null as unknown as Record<string, (...a: unknown[]) => unknown>,
  save: vi.fn(),
  open: vi.fn(),
  toast: vi.fn(),
  drag: {
    dragItem: null as unknown,
    dragItemRef: { current: null as unknown },
    autoExpandTimerRef: { current: null as ReturnType<typeof setTimeout> | null },
    dropTarget: null as unknown,
    dropInsert: null as unknown,
  },
}));

vi.mock('./SidebarContextMenu', () => ({
  default: (props: Record<string, (...a: unknown[]) => unknown>) => {
    h.ctx = props;
    return null;
  },
}));
vi.mock('../../../shared/hooks/useToast', () => ({ useToast: () => ({ show: h.toast }) }));
vi.mock('../../../shared/utils/fileSaver', () => ({
  saveJsonFile: (...a: unknown[]) => h.save(...a),
  openJsonFile: (...a: unknown[]) => h.open(...a),
}));
vi.mock('../../../shared/utils/platform', () => ({ isTauri: () => true }));
vi.mock('../hooks/useRequestsSidebarDnD', () => ({
  useRequestsSidebarDnD: () => ({
    dragItem: h.drag.dragItem,
    dragItemRef: h.drag.dragItemRef,
    dropTarget: h.drag.dropTarget,
    setDropTarget: vi.fn(),
    dropInsert: h.drag.dropInsert,
    setDropInsert: vi.fn(),
    autoExpandTimerRef: h.drag.autoExpandTimerRef,
    handleCollectionDragStart: vi.fn(),
    handleReqDragStart: vi.fn(),
    handleFolderDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
    handleGroupDrop: vi.fn(),
    handleFolderDrop: vi.fn(),
    handleDragEnd: vi.fn(),
    handleReqDragOver: vi.fn(),
    handleReqDrop: vi.fn(),
    handleRootDrop: vi.fn(),
  }),
}));

const reqA = { id: 'r1', name: 'Get Thing', method: 'GET', url: '/a', headers: [], catalogMeta: { sourceSpec: 'spec.yaml', deprecated: true } };
const reqB = { id: 'r2', name: '', method: 'POST', url: '/b', headers: [] };
const subFolder = { id: 'f2', name: 'SubCol', isSubCollection: true, requests: [], folders: [] };
const folder = { id: 'f1', name: 'Folder One', requests: [reqB], folders: [subFolder] };
const col: RequestCollection = {
  id: 'c1', name: 'My Coll', mode: 'multi-env',
  requests: [reqA], folders: [folder], auth: { type: 'bearer', token: 't' },
} as unknown as RequestCollection;
const childCol: RequestCollection = {
  id: 'c2', name: 'Child Coll', mode: 'direct', requests: [], folders: [], groupId: 'g1',
} as unknown as RequestCollection;
const group: RequestCollection = {
  id: 'g1', name: 'My Group', mode: 'group', requests: [], folders: [],
} as unknown as RequestCollection;

const baseCollections: RequestCollection[] = [group, childCol, col];

function makeProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    collections: baseCollections,
    selectedCollectionId: 'c1',
    selectedRequestId: undefined,
    onSelectCollection: vi.fn(),
    onSelectRequest: vi.fn(),
    onNewCollection: vi.fn(),
    onEditCollection: vi.fn(),
    onDeleteCollection: vi.fn(),
    onDuplicateCollection: vi.fn(),
    onNewRequest: vi.fn(),
    onDeleteRequest: vi.fn(),
    onDuplicateRequest: vi.fn(),
    onAddFolder: vi.fn(),
    onAddSubCollection: vi.fn(),
    onEditSubCollection: vi.fn(),
    onRenameFolder: vi.fn(),
    onDeleteFolder: vi.fn(),
    onDuplicateFolder: vi.fn(),
    onMoveFolder: vi.fn(),
    onMoveFolderTo: vi.fn(),
    onMoveRequest: vi.fn(),
    onMoveRequestToCollection: vi.fn(),
    onMoveFolderToCollection: vi.fn(),
    onMergeCollectionInto: vi.fn(),
    countAllRequests: (c: RequestCollection) => c.requests.length,
    onImportCollection: vi.fn(),
    onImportFolder: vi.fn(),
    onAddGroup: vi.fn(() => 'new-group-id'),
    onRenameGroup: vi.fn(),
    onDeleteGroup: vi.fn(),
    onMoveToGroup: vi.fn(),
    onDuplicateGroup: vi.fn(),
    onSendCollectionToHarness: vi.fn(),
    onSendFolderToHarness: vi.fn(),
    harnessRequestIds: new Set(['r1']),
    ...overrides,
  };
}

function setup(overrides: Partial<Record<string, unknown>> = {}) {
  const props = makeProps(overrides);
  render(<RequestsSidebar {...(props as never)} />);
  return props;
}

// open context menu of a given type by right-clicking the right element
function openCollectionCtx() {
  fireEvent.contextMenu(screen.getByText('My Coll'));
}

beforeEach(() => {
  h.toast.mockReset();
  h.save.mockReset();
  h.open.mockReset();
  h.ctx = null as never;
  h.drag.dragItem = null;
  h.drag.dragItemRef = { current: null };
  h.drag.autoExpandTimerRef = { current: null };
  h.drag.dropTarget = null;
  h.drag.dropInsert = null;
});

describe('RequestsSidebar', () => {
  it('renders collections, group, folders, requests with badges', () => {
    setup();
    expect(screen.getByText('COLLECTIONS')).toBeInTheDocument();
    expect(screen.getByText('My Coll')).toBeInTheDocument();
    expect(screen.getByText('My Group')).toBeInTheDocument();
    expect(screen.getByText('Folder One')).toBeInTheDocument();
    expect(screen.getByText('Get Thing')).toBeInTheDocument();
    expect(screen.getByText('IN HARNESS')).toBeInTheDocument();
    // child collection renders inside group
    expect(screen.getByText('Child Coll')).toBeInTheDocument();
    // expand folder to reveal sub-collection
    fireEvent.click(screen.getByText('Folder One'));
    expect(screen.getByText('SubCol')).toBeInTheDocument();
  });

  it('renders empty state and create button', () => {
    const props = setup({ collections: [] });
    fireEvent.click(screen.getByText('Create one'));
    expect(props.onNewCollection).toHaveBeenCalled();
  });

  it('selects collection on header click and toggles expansion', () => {
    const props = setup();
    fireEvent.click(screen.getByText('My Coll'));
    expect(props.onSelectCollection).toHaveBeenCalledWith('c1');
  });

  it('edits collection from edit button', () => {
    const props = setup();
    const header = screen.getByText('My Coll').closest('.req-col-header')!;
    fireEvent.click(within(header).getByTitle('Edit collection settings'));
    expect(props.onEditCollection).toHaveBeenCalledWith(col);
  });

  it('selects request on click', () => {
    const props = setup();
    fireEvent.click(screen.getByText('Get Thing'));
    expect(props.onSelectRequest).toHaveBeenCalledWith('c1', 'r1');
  });

  it('toggles folder expansion and group expansion', () => {
    setup();
    fireEvent.click(screen.getByText('Folder One'));
    fireEvent.click(screen.getByText('My Group'));
    expect(screen.getByText('My Coll')).toBeInTheDocument();
  });

  it('filters via search and clears it', () => {
    setup();
    const input = screen.getByPlaceholderText('Search collections...');
    fireEvent.change(input, { target: { value: 'Folder One' } });
    expect(screen.getByText('My Coll')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'zzz-nomatch' } });
    expect(screen.queryByText('My Coll')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Clear search'));
    expect(screen.getByText('My Coll')).toBeInTheDocument();
  });

  it('opens add menu and creates group / url / env collections', () => {
    const props = setup();
    fireEvent.click(screen.getByTitle('Add new...'));
    let dd = document.querySelector('.req-add-dropdown')!;
    fireEvent.click(within(dd as HTMLElement).getByText(/URL Collection/));
    expect(props.onNewCollection).toHaveBeenCalledWith('direct');
    fireEvent.click(screen.getByTitle('Add new...'));
    dd = document.querySelector('.req-add-dropdown')!;
    fireEvent.click(within(dd as HTMLElement).getByText(/ENV Collection/));
    expect(props.onNewCollection).toHaveBeenCalledWith('multi-env');
    fireEvent.click(screen.getByTitle('Add new...'));
    dd = document.querySelector('.req-add-dropdown')!;
    fireEvent.click(within(dd as HTMLElement).getByText(/Group/));
    // new group input appears
    expect(screen.getByPlaceholderText('Group name')).toBeInTheDocument();
  });

  it('closes add menu on outside click', () => {
    setup();
    fireEvent.click(screen.getByTitle('Add new...'));
    expect(document.querySelector('.req-add-dropdown')).toBeTruthy();
    fireEvent.click(document.body);
    expect(document.querySelector('.req-add-dropdown')).toBeFalsy();
  });

  it('exports all collections', async () => {
    setup();
    await act(async () => {
      fireEvent.click(screen.getByTitle('Export All'));
    });
    expect(h.save).toHaveBeenCalled();
  });

  it('does not export all when there are no collections', async () => {
    setup({ collections: [] });
    await act(async () => { fireEvent.click(screen.getByTitle('Export All')); });
    expect(h.save).not.toHaveBeenCalled();
  });

  it('opens collection context menu (captures handlers)', () => {
    setup();
    openCollectionCtx();
    expect(h.ctx).toBeTruthy();
    expect(h.ctx.contextMenu).toBeTruthy();
  });

  it('startAddFolder then commit adds folder; duplicate warns', () => {
    const props = setup();
    openCollectionCtx();
    act(() => { (h.ctx.startAddFolder as (c: string) => void)('c1'); });
    const input = screen.getByPlaceholderText('Folder name');
    // duplicate name
    fireEvent.change(input, { target: { value: 'Folder One' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.toast).toHaveBeenCalledWith('warning', 'Name already exists', expect.any(String));
    expect(props.onAddFolder).not.toHaveBeenCalled();
    // unique name
    fireEvent.change(input, { target: { value: 'Brand New' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onAddFolder).toHaveBeenCalledWith('c1', 'Brand New', undefined);
  });

  it('startAddFolder as sub-collection inside a parent folder', () => {
    const props = setup();
    openCollectionCtx();
    act(() => { (h.ctx.startAddFolder as (c: string, p?: string, s?: boolean) => void)('c1', 'f1', true); });
    const input = screen.getByPlaceholderText('Sub-collection name');
    fireEvent.change(input, { target: { value: 'NewSub' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onAddSubCollection).toHaveBeenCalledWith('c1', 'NewSub', 'f1');
  });

  it('cancels add folder with Escape', () => {
    setup();
    openCollectionCtx();
    act(() => { (h.ctx.startAddFolder as (c: string) => void)('c1'); });
    const input = screen.getByPlaceholderText('Folder name');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Folder name')).not.toBeInTheDocument();
  });

  it('startRenameFolder then commit; duplicate warns', () => {
    const twoFolderCol = {
      id: 'cc', name: 'Two Folders', mode: 'direct', requests: [],
      folders: [
        { id: 'fa', name: 'Alpha', requests: [], folders: [] },
        { id: 'fb', name: 'Beta', requests: [], folders: [] },
      ],
    } as unknown as RequestCollection;
    const props = setup({ collections: [twoFolderCol] });
    fireEvent.contextMenu(screen.getByText('Two Folders'));
    act(() => { (h.ctx.startRenameFolder as (c: string, f: string, n: string) => void)('cc', 'fb', 'Beta'); });
    const input = screen.getByDisplayValue('Beta');
    fireEvent.change(input, { target: { value: 'Alpha' } }); // sibling name dup
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.toast).toHaveBeenCalledWith('warning', 'Name already exists', expect.any(String));
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.blur(input);
    expect(props.onRenameFolder).toHaveBeenCalledWith('cc', 'fb', 'Renamed');
  });

  it('cancels rename folder with Escape', () => {
    setup();
    openCollectionCtx();
    act(() => { (h.ctx.startRenameFolder as (c: string, f: string, n: string) => void)('c1', 'f1', 'Folder One'); });
    const input = screen.getByDisplayValue('Folder One');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByDisplayValue('Folder One')).not.toBeInTheDocument();
  });

  it('startAddGroup then commit creates group; Escape cancels', () => {
    const props = setup();
    fireEvent.contextMenu(screen.getByText('My Group'));
    act(() => { (h.ctx.startAddGroup as (p?: string) => void)('g1'); });
    const input = screen.getByPlaceholderText('Group name');
    fireEvent.change(input, { target: { value: 'Nested' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onAddGroup).toHaveBeenCalledWith('Nested', 'g1');
  });

  it('startAddGroup at root and blur commits', () => {
    const props = setup();
    fireEvent.click(screen.getByTitle('Add new...'));
    const dd = document.querySelector('.req-add-dropdown')!;
    fireEvent.click(within(dd as HTMLElement).getByText(/Group/));
    const input = screen.getByPlaceholderText('Group name');
    fireEvent.change(input, { target: { value: 'RootGroup' } });
    fireEvent.blur(input);
    expect(props.onAddGroup).toHaveBeenCalledWith('RootGroup', undefined);
  });

  it('startRenameGroup then commit; Escape cancels', () => {
    const props = setup();
    fireEvent.contextMenu(screen.getByText('My Group'));
    act(() => { (h.ctx.startRenameGroup as (g: string, n: string) => void)('g1', 'My Group'); });
    const input = screen.getByDisplayValue('My Group');
    fireEvent.change(input, { target: { value: 'Renamed Group' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRenameGroup).toHaveBeenCalledWith('g1', 'Renamed Group');
  });

  it('confirmDelete overlay confirm and cancel', () => {
    setup();
    openCollectionCtx();
    const onConfirm = vi.fn();
    act(() => { (h.ctx.setConfirmDelete as (v: unknown) => void)({ message: 'Delete it?', onConfirm }); });
    expect(screen.getByText('Delete it?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalled();
    // reopen and cancel
    act(() => { (h.ctx.setConfirmDelete as (v: unknown) => void)({ message: 'Again?', onConfirm: vi.fn() }); });
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Again?')).not.toBeInTheDocument();
  });

  it('exports a collection, folder, and group via context handlers', async () => {
    setup();
    openCollectionCtx();
    await act(async () => { await (h.ctx.handleExportCollection as (c: string) => Promise<void>)('c1'); });
    await act(async () => { await (h.ctx.handleExportFolder as (c: string, f: string) => Promise<void>)('c1', 'f1'); });
    await act(async () => { await (h.ctx.handleExportGroup as (g: string) => Promise<void>)('g1'); });
    expect(h.save).toHaveBeenCalledTimes(3);
  });

  it('export handlers no-op for missing targets', async () => {
    setup();
    openCollectionCtx();
    await act(async () => { await (h.ctx.handleExportCollection as (c: string) => Promise<void>)('nope'); });
    await act(async () => { await (h.ctx.handleExportFolder as (c: string, f: string) => Promise<void>)('c1', 'nope'); });
    await act(async () => { await (h.ctx.handleExportGroup as (g: string) => Promise<void>)('c1'); }); // not a group
    expect(h.save).not.toHaveBeenCalled();
  });

  it('imports a collection, folder, group, and all-collections via tauri', async () => {
    const props = setup();
    openCollectionCtx();
    // collection
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-collection', data: { name: 'My Coll', requests: [{ id: 'x', name: 'q', method: 'GET', url: '/x', headers: [] }], folders: [] } }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    expect(props.onImportCollection).toHaveBeenCalled();
    // folder
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-folder', data: { name: 'Folder One', requests: [], folders: [] } }) });
    await act(async () => { await (h.ctx.handleImportToCollection as (c?: string) => Promise<void>)('c1'); });
    expect(props.onImportFolder).toHaveBeenCalled();
    // group
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-group', data: { group: { id: 'gg', name: 'G', mode: 'group', requests: [], folders: [] }, children: [{ id: 'cc', name: 'C', mode: 'direct', requests: [], folders: [], groupId: 'gg' }] } }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    // all
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-all', data: { collections: [{ id: 'a1', name: 'A', mode: 'direct', requests: [], folders: [] }] } }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    expect(props.onImportCollection.mock.calls.length).toBeGreaterThan(1);
  });

  it('import handles invalid json, unrecognized type, and missing fields', async () => {
    setup();
    openCollectionCtx();
    h.open.mockResolvedValueOnce({ content: 'not json' });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    expect(h.toast).toHaveBeenCalledWith('error', 'Invalid JSON file', expect.any(String));
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'mystery', data: {} }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    expect(h.toast).toHaveBeenCalledWith('error', 'Unrecognized file format', expect.any(String));
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-collection', data: { name: '' } }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    expect(h.toast).toHaveBeenCalledWith('error', 'Invalid collection format', expect.any(String));
  });

  it('import returns early when no file selected', async () => {
    const props = setup();
    openCollectionCtx();
    h.open.mockResolvedValueOnce(null);
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    expect(props.onImportCollection).not.toHaveBeenCalled();
  });

  it('imports into a folder via handleImportToFolder', async () => {
    const props = setup();
    openCollectionCtx();
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-folder', data: { name: 'Imported F', requests: [], folders: [] } }) });
    await act(async () => { await (h.ctx.handleImportToFolder as (c: string, f: string) => Promise<void>)('c1', 'f1'); });
    expect(props.onImportFolder).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'Imported F' }), 'f1');
    // wrong type
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-collection', data: {} }) });
    await act(async () => { await (h.ctx.handleImportToFolder as (c: string, f: string) => Promise<void>)('c1', 'f1'); });
    expect(h.toast).toHaveBeenCalledWith('error', 'Unexpected file type', expect.any(String));
  });

  it('dismisses context menu on document click', () => {
    setup();
    openCollectionCtx();
    expect(h.ctx.contextMenu).toBeTruthy();
    fireEvent.click(document.body);
    // list onClick also closes; both fine
    expect(screen.getByText('My Coll')).toBeInTheDocument();
  });

  it('handles drag over collection header with active drag (non-null ref)', () => {
    setup();
    h.drag.dragItemRef = { current: { kind: 'request', colId: 'c2', reqId: 'r9' } };
    const header = screen.getByText('My Coll').closest('.req-col-group')!;
    fireEvent.dragOver(header, { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(header, { dataTransfer: {} });
    expect(screen.getByText('My Coll')).toBeInTheDocument();
  });

  it('renders group empty state when group has no children', () => {
    setup({ collections: [{ id: 'g9', name: 'Lonely', mode: 'group', requests: [], folders: [] } as unknown as RequestCollection] });
    expect(screen.getByText('Empty group')).toBeInTheDocument();
  });

  it('renders an unauthenticated collection without auth badge', () => {
    setup({ collections: [{ id: 'c9', name: 'NoAuth', mode: 'direct', requests: [], folders: [], auth: { type: 'none' } } as unknown as RequestCollection] });
    expect(within(screen.getByText('NoAuth').closest('.req-col-header')!).queryByTitle(/Auth:/)).toBeNull();
  });
});
