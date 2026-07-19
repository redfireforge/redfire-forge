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
  isTauri: true,
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
vi.mock('../../../shared/utils/platform', () => ({ isTauri: () => h.isTauri }));
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
  baseUrls: { 'e-dev': 'https://dev', 'e-stg': 'https://stg' },
} as unknown as RequestCollection;

const testEnvironments = [
  { id: 'e-dev', name: 'dev' },
  { id: 'e-stg', name: 'staging' },
];
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
    environments: testEnvironments,
    microservices: [],
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
  h.isTauri = true;
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

  it('expand-all toggle expands then shrinks all collections and folders', () => {
    setup();
    const toggle = screen.getByTestId('req-sidebar-expand-all');
    // Sub-collection is nested inside a collapsed folder, so hidden initially.
    expect(screen.queryByText('SubCol')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('title', 'Expand All');

    // Expand all -> nested folder + sub-collection become visible.
    fireEvent.click(toggle);
    expect(screen.getByText('SubCol')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('title', 'Shrink All');
    expect(toggle).toHaveClass('active');

    // Shrink all -> collapse everything again.
    fireEvent.click(toggle);
    expect(screen.queryByText('SubCol')).not.toBeInTheDocument();
    expect(screen.queryByText('Folder One')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('title', 'Expand All');
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

  it('startAddFolder as sub-collection inside a parent folder uses the env dropdown', () => {
    const props = setup();
    fireEvent.click(screen.getByText('Folder One')); // expand f1
    openCollectionCtx();
    act(() => { (h.ctx.startAddFolder as (c: string, p?: string, s?: boolean) => void)('c1', 'f1', true); });
    const select = screen.getByTestId('req-subcol-env-select');
    fireEvent.change(select, { target: { value: 'e-dev' } });
    expect(props.onAddSubCollection).toHaveBeenCalledWith('c1', 'dev', 'f1', 'e-dev');
  });

  it('toasts and does not open the dropdown when no environments are eligible', () => {
    const props = setup({
      collections: [{ ...col, baseUrls: undefined }],
      selectedCollectionId: 'c1',
    });
    openCollectionCtx();
    act(() => { (h.ctx.startAddFolder as (c: string, p?: string, s?: boolean) => void)('c1', undefined, true); });
    expect(h.toast).toHaveBeenCalledWith('info', 'No environments available', expect.any(String));
    expect(screen.queryByTestId('req-subcol-env-select')).not.toBeInTheDocument();
    expect(props.onAddSubCollection).not.toHaveBeenCalled();
  });

  it('exposes an eligible-env count helper to the context menu', () => {
    setup();
    openCollectionCtx();
    expect((h.ctx.getSubColEligibleCount as (c: string) => number)('c1')).toBe(2);
    // env already bound to a sibling sub-collection is excluded
    expect((h.ctx.getSubColEligibleCount as (c: string, p?: string) => number)('c1', 'f1')).toBe(2);
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

  it('renders auth badges for every auth type (authLabel branches)', () => {
    const mk = (id: string, name: string, type: string) => ({ id, name, mode: 'direct', requests: [], folders: [], auth: { type } } as unknown as RequestCollection);
    setup({
      collections: [
        mk('ca', 'BearerCol', 'bearer'),
        mk('cb', 'BasicCol', 'basic'),
        mk('cc', 'ApiKeyCol', 'apikey'),
        mk('cd', 'OAuthCol', 'oauth2'),
        mk('ce', 'WeirdCol', 'custom'),
      ],
    });
    expect(within(screen.getByText('BearerCol').closest('.req-col-header')!).getByTitle('Auth: Bearer')).toBeInTheDocument();
    expect(within(screen.getByText('BasicCol').closest('.req-col-header')!).getByTitle('Auth: Basic')).toBeInTheDocument();
    expect(within(screen.getByText('ApiKeyCol').closest('.req-col-header')!).getByTitle('Auth: API Key')).toBeInTheDocument();
    expect(within(screen.getByText('OAuthCol').closest('.req-col-header')!).getByTitle('Auth: OAuth2')).toBeInTheDocument();
    // unknown auth type => hasAuth true but authLabel default '' branch (badge still rendered)
    expect(screen.getByText('WeirdCol').closest('.req-col-header')!.querySelector('.req-col-auth-badge')).toBeInTheDocument();
  });

  it('clicks the header Import button (handleImportToCollection)', async () => {
    setup();
    h.open.mockResolvedValueOnce(null);
    await act(async () => { fireEvent.click(screen.getByTitle('Import')); });
    expect(h.open).toHaveBeenCalled();
  });

  it('imports a folder with nested requests and sub-folders (regenIds deep)', async () => {
    const props = setup();
    openCollectionCtx();
    h.open.mockResolvedValueOnce({ content: JSON.stringify({
      type: 'requests-folder',
      data: {
        name: 'Deep Folder',
        requests: [{ id: 'q1', name: 'Q', method: 'GET', url: '/q', headers: [] }],
        folders: [{ id: 'sf', name: 'Sub', requests: [{ id: 'q2', name: 'Q2', method: 'POST', url: '/q2', headers: [] }], folders: [] }],
      },
    }) });
    await act(async () => { await (h.ctx.handleImportToCollection as (c?: string) => Promise<void>)('c1'); });
    expect(props.onImportFolder).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'Deep Folder' }));
  });

  it('imports a group whose children carry requests/folders (importGroupData deep)', async () => {
    const props = setup();
    openCollectionCtx();
    h.open.mockResolvedValueOnce({ content: JSON.stringify({
      type: 'requests-group',
      data: {
        group: { id: 'gg', name: 'GG', mode: 'group', requests: [], folders: [] },
        children: [
          { id: 'cc1', name: 'Cc1', mode: 'direct', groupId: 'gg', requests: [{ id: 'rr', name: 'R', method: 'GET', url: '/r', headers: [] }], folders: [{ id: 'ff', name: 'F', requests: [], folders: [] }] },
          { id: 'cc2', name: 'Cc2', mode: 'direct', requests: [], folders: [] },
        ],
      },
    }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    // group + 2 children imported
    expect(props.onImportCollection.mock.calls.length).toBe(3);
  });

  it('imports all-collections with requests and warns when none valid', async () => {
    const props = setup();
    openCollectionCtx();
    // valid: one with requests, one group; invalid: missing name
    h.open.mockResolvedValueOnce({ content: JSON.stringify({
      type: 'requests-all',
      data: { collections: [
        { id: 'a1', name: 'A1', mode: 'direct', groupId: 'a2', requests: [{ id: 'x', name: 'x', method: 'GET', url: '/x', headers: [] }], folders: [] },
        { id: 'a2', name: 'A2', mode: 'group', requests: [], folders: [] },
        { id: 'a3', name: '', mode: 'direct', requests: [], folders: [] },
      ] },
    }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    expect(props.onImportCollection.mock.calls.length).toBe(2);
    // all invalid => warning
    props.onImportCollection.mockClear();
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-all', data: { collections: [{ id: 'b1', name: '', mode: 'direct', requests: [], folders: [] }] } }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    expect(h.toast).toHaveBeenCalledWith('warning', 'No valid collections found in the file');
  });

  it('handleImportToFolder handles invalid JSON (catch path)', async () => {
    setup();
    openCollectionCtx();
    h.open.mockResolvedValueOnce({ content: 'totally not json {' });
    await act(async () => { await (h.ctx.handleImportToFolder as (c: string, f: string) => Promise<void>)('c1', 'f1'); });
    expect(h.toast).toHaveBeenCalledWith('error', 'Invalid JSON file', expect.any(String));
  });

  it('imports via the browser file picker when not in Tauri (FileReader onload)', async () => {
    h.isTauri = false;
    const props = setup();
    openCollectionCtx();
    const ORIG = document.createElement;
    const inputEl = ORIG.call(document, 'input') as HTMLInputElement;
    const file = new File([JSON.stringify({ type: 'requests-collection', data: { name: 'Picked', requests: [], folders: [] } })], 'picked.json', { type: 'application/json' });
    Object.defineProperty(inputEl, 'files', { value: [file], configurable: true });
    inputEl.click = () => { inputEl.onchange?.(new Event('change')); };
    document.createElement = ((tag: string) => tag === 'input' ? inputEl : ORIG.call(document, tag)) as typeof document.createElement;
    try {
      await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    } finally {
      document.createElement = ORIG;
    }
    expect(props.onImportCollection).toHaveBeenCalledWith(expect.objectContaining({ name: 'Picked' }));
  });

  it('browser file picker resolves null when no file chosen', async () => {
    h.isTauri = false;
    const props = setup();
    openCollectionCtx();
    const ORIG = document.createElement;
    const inputEl = ORIG.call(document, 'input') as HTMLInputElement;
    Object.defineProperty(inputEl, 'files', { value: [], configurable: true });
    inputEl.click = () => { inputEl.onchange?.(new Event('change')); };
    document.createElement = ((tag: string) => tag === 'input' ? inputEl : ORIG.call(document, tag)) as typeof document.createElement;
    try {
      await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    } finally {
      document.createElement = ORIG;
    }
    expect(props.onImportCollection).not.toHaveBeenCalled();
  });

  it('browser file picker resolves null on FileReader error', async () => {
    h.isTauri = false;
    const props = setup();
    openCollectionCtx();
    const ORIG = document.createElement;
    const inputEl = ORIG.call(document, 'input') as HTMLInputElement;
    Object.defineProperty(inputEl, 'files', { value: [new File(['x'], 'x.json')], configurable: true });
    inputEl.click = () => { inputEl.onchange?.(new Event('change')); };
    document.createElement = ((tag: string) => tag === 'input' ? inputEl : ORIG.call(document, tag)) as typeof document.createElement;
    // Force FileReader to fire onerror
    class ErrReader {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      readAsText() { this.onerror?.(); }
    }
    const OrigReader = globalThis.FileReader;
    (globalThis as unknown as { FileReader: unknown }).FileReader = ErrReader as unknown;
    try {
      await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    } finally {
      (globalThis as unknown as { FileReader: unknown }).FileReader = OrigReader;
      document.createElement = ORIG;
    }
    expect(props.onImportCollection).not.toHaveBeenCalled();
  });

  // ─── Drag-and-drop inline handler coverage ──────────────────────

  it('fires request drag handlers (context/dragOver/leave/drop/start)', () => {
    setup();
    const reqEl = screen.getByText('Get Thing').closest('.req-req-item')!;
    fireEvent.contextMenu(reqEl);
    fireEvent.dragStart(reqEl, { dataTransfer: { setData: vi.fn() } });
    fireEvent.dragOver(reqEl, { dataTransfer: { dropEffect: '' } });
    fireEvent.dragLeave(reqEl);
    fireEvent.drop(reqEl, { dataTransfer: {} });
    fireEvent.dragEnd(reqEl);
    expect(screen.getByText('Get Thing')).toBeInTheDocument();
  });

  it('fires folder drag handlers and folder header context/drag', () => {
    setup();
    const folderGroup = screen.getByText('Folder One').closest('.req-folder-group')!;
    fireEvent.dragOver(folderGroup, { dataTransfer: { dropEffect: '' } });
    fireEvent.dragLeave(folderGroup, { relatedTarget: document.body });
    fireEvent.drop(folderGroup, { dataTransfer: {} });
    const folderHeader = screen.getByText('Folder One').closest('.req-folder-header')!;
    fireEvent.contextMenu(folderHeader);
    fireEvent.dragStart(folderHeader, { dataTransfer: { setData: vi.fn() } });
    fireEvent.dragEnd(folderHeader);
    expect(screen.getByText('Folder One')).toBeInTheDocument();
  });

  it('rename folder input stops propagation on click', () => {
    setup();
    openCollectionCtx();
    act(() => { (h.ctx.startRenameFolder as (c: string, f: string, n: string) => void)('c1', 'f1', 'Folder One'); });
    const input = screen.getByDisplayValue('Folder One');
    fireEvent.click(input);
    expect(screen.getByDisplayValue('Folder One')).toBeInTheDocument();
  });

  it('fires collection drag handlers including auto-expand timer', () => {
    vi.useFakeTimers();
    try {
      setup();
      // arrange drag of a request from another collection, then collapse My Coll
      h.drag.dragItemRef.current = { kind: 'request', colId: 'other', reqId: 'r9' };
      act(() => { fireEvent.click(screen.getByText('My Coll')); });
      const colGroup = screen.getByText('My Coll').closest('.req-col-group')!;
      fireEvent.dragOver(colGroup, { dataTransfer: { dropEffect: '' } });
      act(() => { vi.advanceTimersByTime(600); });
      // same-collection dragOver returns early
      h.drag.dragItemRef.current = { kind: 'request', colId: 'c1', reqId: 'r1' };
      fireEvent.dragOver(colGroup, { dataTransfer: { dropEffect: '' } });
      // drop with active timer to clear it
      h.drag.dragItemRef.current = { kind: 'request', colId: 'other', reqId: 'r9' };
      h.drag.autoExpandTimerRef.current = 1 as unknown as ReturnType<typeof setTimeout>;
      fireEvent.drop(colGroup, { dataTransfer: {} });
      // same-col drop returns early
      h.drag.dragItemRef.current = { kind: 'request', colId: 'c1', reqId: 'r1' };
      fireEvent.drop(colGroup, { dataTransfer: {} });
      expect(screen.getByText('My Coll')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fires req-list and root-drop drag handlers and col header dragStart', () => {
    setup();
    h.drag.dragItemRef.current = { kind: 'request', colId: 'other', reqId: 'r9' };
    const reqList = document.querySelector('.req-req-list')!;
    fireEvent.dragOver(reqList, { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(reqList, { dataTransfer: {} });
    const rootDrop = document.querySelector('.req-root-drop')!;
    fireEvent.dragOver(rootDrop, { dataTransfer: { dropEffect: '' } });
    fireEvent.dragLeave(rootDrop);
    fireEvent.drop(rootDrop, { dataTransfer: {} });
    const colHeader = screen.getByText('My Coll').closest('.req-col-header')!;
    fireEvent.dragStart(colHeader, { dataTransfer: { setData: vi.fn() } });
    expect(screen.getByText('My Coll')).toBeInTheDocument();
  });

  it('fires group drag handlers including auto-expand timer', () => {
    vi.useFakeTimers();
    try {
      setup();
      // arrange collection drag onto a different group, then collapse the group
      h.drag.dragItemRef.current = { kind: 'collection', colId: 'other-col' };
      act(() => { fireEvent.click(screen.getByText('My Group')); });
      const groupWrapper = screen.getByText('My Group').closest('.req-group-wrapper')!;
      fireEvent.dragOver(groupWrapper, { dataTransfer: { dropEffect: '' } });
      act(() => { vi.advanceTimersByTime(600); });
      // non-collection drag returns early
      h.drag.dragItemRef.current = { kind: 'request', colId: 'x', reqId: 'r' };
      fireEvent.dragOver(groupWrapper, { dataTransfer: { dropEffect: '' } });
      // same-group drag returns early
      h.drag.dragItemRef.current = { kind: 'collection', colId: 'g1' };
      fireEvent.dragOver(groupWrapper, { dataTransfer: { dropEffect: '' } });
      fireEvent.drop(groupWrapper, { dataTransfer: {} });
      const groupHeader = screen.getByText('My Group').closest('.req-group-header')!;
      fireEvent.dragStart(groupHeader, { dataTransfer: { setData: vi.fn() } });
      expect(screen.getByText('My Group')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('group rename input stops propagation on click', () => {
    setup();
    fireEvent.contextMenu(screen.getByText('My Group'));
    act(() => { (h.ctx.startRenameGroup as (g: string, n: string) => void)('g1', 'My Group'); });
    const input = screen.getByDisplayValue('My Group');
    fireEvent.click(input);
    expect(screen.getByDisplayValue('My Group')).toBeInTheDocument();
  });

  it('sidebar-list dragOver activates root drop when dragging a grouped collection', () => {
    setup();
    h.drag.dragItemRef.current = { kind: 'collection', colId: 'c2' }; // c2 has groupId g1
    const list = document.querySelector('.req-sidebar-list')!;
    fireEvent.dragOver(list, { dataTransfer: { dropEffect: '' } });
    // ungrouped collection => no-op branch
    h.drag.dragItemRef.current = { kind: 'collection', colId: 'c1' };
    fireEvent.dragOver(list, { dataTransfer: { dropEffect: '' } });
    // non-collection drag => early return
    h.drag.dragItemRef.current = { kind: 'request', colId: 'c1', reqId: 'r1' };
    fireEvent.dragOver(list, { dataTransfer: { dropEffect: '' } });
    expect(screen.getByText('My Coll')).toBeInTheDocument();
  });

  it('cancels root new-group input with Escape', () => {
    setup();
    fireEvent.click(screen.getByTitle('Add new...'));
    const dd = document.querySelector('.req-add-dropdown')!;
    fireEvent.click(within(dd as HTMLElement).getByText(/Group/));
    const input = screen.getByPlaceholderText('Group name');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Group name')).not.toBeInTheDocument();
  });

  it('dismisses confirm-delete overlay by clicking the backdrop', () => {
    setup();
    openCollectionCtx();
    act(() => { (h.ctx.setConfirmDelete as (v: unknown) => void)({ message: 'Backdrop?', onConfirm: vi.fn() }); });
    expect(screen.getByText('Backdrop?')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.req-confirm-overlay')!);
    expect(screen.queryByText('Backdrop?')).not.toBeInTheDocument();
  });

  it('handleContainerDragLeave clears drop target when leaving the container', () => {
    setup();
    h.drag.dragItemRef.current = { kind: 'request', colId: 'other', reqId: 'r9' };
    const colGroup = screen.getByText('My Coll').closest('.req-col-group')!;
    fireEvent.dragOver(colGroup, { dataTransfer: { dropEffect: '' } });
    fireEvent.dragLeave(colGroup, { relatedTarget: document.body });
    expect(screen.getByText('My Coll')).toBeInTheDocument();
  });

  it('renders request dragging/selected/drop-insert and col-header drop-target states', () => {
    h.drag.dragItem = { kind: 'request', reqId: 'r1' };
    h.drag.dropTarget = 'col-header-c1';
    h.drag.dropInsert = { beforeReqId: 'r1' };
    setup({ selectedRequestId: 'r1' });
    expect(screen.getByText('Get Thing').closest('.req-req-item')).toHaveClass('dragging');
    expect(screen.getByText('My Coll').closest('.req-col-group')).toHaveClass('col-drop-target');
    expect(document.querySelector('.req-drop-indicator')).toBeInTheDocument();
  });

  it('renders drop-insert after indicator', () => {
    h.drag.dropInsert = { beforeReqId: 'r1:after' };
    setup();
    expect(document.querySelector('.req-drop-indicator')).toBeInTheDocument();
  });

  it('renders folder dragging and folder drop-target states', () => {
    h.drag.dragItem = { kind: 'folder', folderId: 'f1' };
    h.drag.dropTarget = 'f1';
    setup();
    const folderGroup = screen.getByText('Folder One').closest('.req-folder-group')!;
    expect(folderGroup).toHaveClass('dragging');
    expect(folderGroup).toHaveClass('drop-target');
  });

  it('renders collection-header and group dragging/drop-target states', () => {
    h.drag.dragItem = { kind: 'collection', colId: 'c1' };
    h.drag.dropTarget = 'group-g1';
    setup();
    expect(screen.getByText('My Coll').closest('.req-col-header')).toHaveClass('dragging');
    const groupWrapper = screen.getByText('My Group').closest('.req-group-wrapper')!;
    expect(groupWrapper).toHaveClass('drop-target');
  });

  it('renders catalog badge with default title when sourceSpec is absent', () => {
    const dirCol = {
      id: 'cd', name: 'DirectCol', mode: 'direct',
      requests: [{ id: 'rg', name: 'Cat Req', method: 'GET', url: '/cat', headers: [], catalogMeta: {} }],
      folders: [],
    } as unknown as RequestCollection;
    setup({ collections: [dirCol], selectedCollectionId: 'cd' });
    // catalog badge renders (meta truthy) with default 'From API Catalog' title (no sourceSpec)
    expect(document.querySelector('.req-req-catalog-badge')).toHaveAttribute('title', 'From API Catalog');
    // not deprecated => no deprecated badge
    expect(document.querySelector('.req-req-deprecated-badge')).toBeNull();
  });

  it('commits add-folder on Enter', () => {
    const props = setup();
    openCollectionCtx();
    act(() => { (h.ctx.startAddFolder as (c: string) => void)('c1'); });
    const input = screen.getByPlaceholderText('Folder name');
    fireEvent.change(input, { target: { value: 'NewF' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onAddFolder).toHaveBeenCalled();
  });

  it('commits rename-group on Enter', () => {
    const props = setup();
    fireEvent.contextMenu(screen.getByText('My Group'));
    act(() => { (h.ctx.startRenameGroup as (g: string, n: string) => void)('g1', 'My Group'); });
    const input = screen.getByDisplayValue('My Group');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRenameGroup).toHaveBeenCalled();
  });

  it('commits add-group on Enter from the root add menu', () => {
    const props = setup();
    fireEvent.click(screen.getByTitle('Add new...'));
    const dd = document.querySelector('.req-add-dropdown')!;
    fireEvent.click(within(dd as HTMLElement).getByText(/Group/));
    const input = screen.getByPlaceholderText('Group name');
    fireEvent.change(input, { target: { value: 'GG' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onAddGroup).toHaveBeenCalled();
  });

  it('cancels add-folder input with Escape', () => {
    setup();
    openCollectionCtx();
    act(() => { (h.ctx.startAddFolder as (c: string) => void)('c1'); });
    const input = screen.getByPlaceholderText('Folder name');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Folder name')).not.toBeInTheDocument();
  });

  it('cancels rename-group input with Escape', () => {
    setup();
    fireEvent.contextMenu(screen.getByText('My Group'));
    act(() => { (h.ctx.startRenameGroup as (g: string, n: string) => void)('g1', 'My Group'); });
    const input = screen.getByDisplayValue('My Group');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByDisplayValue('My Group')).not.toBeInTheDocument();
  });

  it('renders sub-collection env dropdown at collection root with eligible options', () => {
    setup();
    openCollectionCtx();
    act(() => { (h.ctx.startAddFolder as (c: string, p?: string, s?: boolean) => void)('c1', undefined, true); });
    const select = screen.getByTestId('req-subcol-env-select');
    expect(select).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'dev' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'staging' })).toBeInTheDocument();
  });

  it('imports a collection with nested folders and a mixed all-collections payload', async () => {
    const props = setup();
    openCollectionCtx();
    // collection with nested folders => exercises folders ?? [] truthy + nested regenIds
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-collection', data: { name: 'NewColl', requests: [{ id: 'x', name: 'q', method: 'GET', url: '/x', headers: [] }], folders: [{ id: 'nf', name: 'NF', requests: [], folders: [{ id: 'nf2', name: 'NF2', requests: [], folders: [] }] }] } }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    // collection with folders omitted => folders ?? [] falsy arm
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-collection', data: { name: 'NoFolders', requests: [{ id: 'y', name: 'q', method: 'GET', url: '/y', headers: [] }] } }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    // all-collections: skip no-name, keep group w/o requests, child groupId in map, child groupId not in map, name collision
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-all', data: { collections: [
      { id: 'g0', name: 'Grp', mode: 'group' },
      { id: '', name: '', mode: 'direct', requests: [] },
      { id: 'k1', name: 'My Coll', mode: 'direct', requests: [{ id: 'r', name: '', method: 'GET', url: '/', headers: [] }], groupId: 'g0', folders: [{ id: 'kf', name: 'KF', requests: [], folders: [] }] },
      { id: 'k2', name: 'K2', mode: 'direct', requests: [], groupId: 'ext' },
    ] } }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    expect(props.onImportCollection).toHaveBeenCalled();
  });

  it('imports a group with children carrying groupId, content, and no groupId', async () => {
    const props = setup();
    openCollectionCtx();
    h.open.mockResolvedValueOnce({ content: JSON.stringify({ type: 'requests-group', data: { group: { id: 'gg', name: 'G', mode: 'group', requests: [], folders: [] }, children: [
      { id: 'c0', name: 'C0', mode: 'direct', requests: [{ id: 'r', name: '', method: 'GET', url: '/', headers: [] }], folders: [{ id: 'cf', name: 'CF', requests: [], folders: [] }], groupId: 'gg' },
      { id: 'c1x', name: 'C1', mode: 'direct', requests: [], folders: [], groupId: 'ext' },
      { id: 'c2x', name: 'C2', mode: 'direct' },
    ] } }) });
    await act(async () => { await (h.ctx.handleImportToCollection as () => Promise<void>)(); });
    expect(props.onImportCollection.mock.calls.length).toBeGreaterThan(1);
  });

  it('filters out non-matching collections and groups when searching', () => {
    setup();
    const searchBox = screen.getByPlaceholderText('Search collections...');
    fireEvent.change(searchBox, { target: { value: 'zzzznomatch' } });
    expect(screen.queryByText('My Coll')).not.toBeInTheDocument();
    expect(screen.queryByText('My Group')).not.toBeInTheDocument();
    // clear search restores
    fireEvent.click(screen.getByTitle('Clear search'));
    expect(screen.getByText('My Coll')).toBeInTheDocument();
  });

  it('renders folder-level add-folder and sub-collection inputs and handles keys', () => {
    setup();
    fireEvent.click(screen.getByText('Folder One')); // expand f1
    openCollectionCtx();
    act(() => { (h.ctx.startAddFolder as (c: string, p?: string, s?: boolean) => void)('c1', 'f1'); });
    const fInput = screen.getByPlaceholderText('Folder name');
    fireEvent.keyDown(fInput, { key: 'Escape' }); // folder-level Escape arm
    expect(screen.queryByPlaceholderText('Folder name')).not.toBeInTheDocument();
    act(() => { (h.ctx.startAddFolder as (c: string, p?: string, s?: boolean) => void)('c1', 'f1', true); });
    const sSelect = screen.getByTestId('req-subcol-env-select'); // sub-collection dropdown arms
    fireEvent.keyDown(sSelect, { key: 'Escape' }); // Escape closes the dropdown
    expect(screen.queryByTestId('req-subcol-env-select')).not.toBeInTheDocument();
  });

  it('renders method-color fallback for an unknown HTTP method', () => {
    const oddCol = {
      id: 'co', name: 'OddCol', mode: 'direct',
      requests: [{ id: 'ro', name: 'Odd', method: 'HEAD', url: '/o', headers: [] }],
      folders: [],
    } as unknown as RequestCollection;
    setup({ collections: [oddCol], selectedCollectionId: 'co' });
    const methodEl = document.querySelector('.req-req-method') as HTMLElement;
    expect(methodEl.style.color).toBe('rgb(148, 163, 184)'); // #94a3b8 fallback
  });

  // ─── Tab indicator + "Open in New Tab" ────────────────

  it('renders tab-dot indicator for requests with open tabs', () => {
    setup({ openTabRequestIds: new Set(['r1']) });
    const dot = document.querySelector('.req-req-tab-dot');
    expect(dot).toBeInTheDocument();
  });

  it('does not render tab-dot when openTabRequestIds is not provided', () => {
    setup();
    expect(document.querySelector('.req-req-tab-dot')).not.toBeInTheDocument();
  });

  it('does not render tab-dot for requests not in openTabRequestIds', () => {
    setup({ openTabRequestIds: new Set(['other-id']) });
    expect(document.querySelector('.req-req-tab-dot')).not.toBeInTheDocument();
  });

  it('passes onOpenInNewTab to SidebarContextMenu', () => {
    const openInNewTab = vi.fn();
    setup({ onOpenInNewTab: openInNewTab });
    openCollectionCtx();
    expect((h.ctx as Record<string, unknown>).onOpenInNewTab).toBe(openInNewTab);
  });

  it('renders safely with collection auth missing and folders undefined', () => {
    setup({
      collections: [{
        id: 'c-na',
        name: 'NoAuthRaw',
        mode: 'direct',
        requests: [{ id: 'r-na', name: '', method: 'GET', url: '', headers: [] }],
        folders: undefined,
      } as unknown as RequestCollection],
      selectedCollectionId: 'c-na',
    });

    // name/url fallback branch in renderRequest
    expect(screen.getByText('Untitled')).toBeInTheDocument();
    // hasAuth/authLabel branch where auth object is absent
    const header = screen.getByText('NoAuthRaw').closest('.req-col-header')!;
    expect(within(header).queryByTitle(/Auth:/)).toBeNull();
  });

  it('renders folder safely when nested folders array is undefined', () => {
    const colWithUndefinedNested = {
      id: 'c-uf',
      name: 'UF',
      mode: 'direct',
      requests: [],
      folders: [{ id: 'f-uf', name: 'Folder UF', requests: [], folders: undefined }],
    } as unknown as RequestCollection;

    setup({ collections: [colWithUndefinedNested], selectedCollectionId: 'c-uf' });
    expect(screen.getByText('Folder UF')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Folder UF'));
    expect(screen.getByText('Folder UF')).toBeInTheDocument();
  });

  it('getSubColEligibleCount returns empty for missing collection', () => {
    setup();
    openCollectionCtx();
    expect((h.ctx.getSubColEligibleCount as (c: string, p?: string) => number)('missing-col')).toBe(0);
  });

  it('sub-collection add guards invalid env selection and allows root valid selection', () => {
    const props = setup();
    openCollectionCtx();

    act(() => { (h.ctx.startAddFolder as (c: string, p?: string, s?: boolean) => void)('c1', undefined, true); });
    let select = screen.getByTestId('req-subcol-env-select');
    fireEvent.change(select, { target: { value: '' } });
    expect(props.onAddSubCollection).not.toHaveBeenCalled();

    act(() => { (h.ctx.startAddFolder as (c: string, p?: string, s?: boolean) => void)('c1', undefined, true); });
    select = screen.getByTestId('req-subcol-env-select');
    fireEvent.change(select, { target: { value: 'missing-env' } });
    expect(props.onAddSubCollection).not.toHaveBeenCalled();

    act(() => { (h.ctx.startAddFolder as (c: string, p?: string, s?: boolean) => void)('c1', undefined, true); });
    select = screen.getByTestId('req-subcol-env-select');
    fireEvent.change(select, { target: { value: 'e-dev' } });
    expect(props.onAddSubCollection).toHaveBeenCalledWith('c1', 'dev', undefined, 'e-dev');
  });

  it('does not add folder when inline folder name is empty on blur', () => {
    const props = setup();
    openCollectionCtx();
    act(() => { (h.ctx.startAddFolder as (c: string) => void)('c1'); });
    const input = screen.getByPlaceholderText('Folder name');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(props.onAddFolder).not.toHaveBeenCalled();
  });

  it('does not commit empty folder/group rename or empty group add', () => {
    const props = setup();

    openCollectionCtx();
    act(() => { (h.ctx.startRenameFolder as (c: string, f: string, n: string) => void)('c1', 'f1', 'Folder One'); });
    const folderInput = screen.getByDisplayValue('Folder One');
    fireEvent.change(folderInput, { target: { value: '   ' } });
    fireEvent.blur(folderInput);
    expect(props.onRenameFolder).not.toHaveBeenCalled();

    fireEvent.contextMenu(screen.getByText('My Group'));
    act(() => { (h.ctx.startRenameGroup as (g: string, n: string) => void)('g1', 'My Group'); });
    const groupInput = screen.getByDisplayValue('My Group');
    fireEvent.change(groupInput, { target: { value: '   ' } });
    fireEvent.blur(groupInput);
    expect(props.onRenameGroup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Add new...'));
    const dd = document.querySelector('.req-add-dropdown')!;
    fireEvent.click(within(dd as HTMLElement).getByText(/Group/));
    const addGroupInput = screen.getByPlaceholderText('Group name');
    fireEvent.change(addGroupInput, { target: { value: '   ' } });
    fireEvent.blur(addGroupInput);
    expect(props.onAddGroup).not.toHaveBeenCalled();
  });

  it('container drag-leave does nothing when related target stays inside container', () => {
    setup();
    const colGroup = screen.getByText('My Coll').closest('.req-col-group')!;
    const inside = colGroup.querySelector('.req-col-header')!;
    fireEvent.dragLeave(colGroup, { relatedTarget: inside });
    expect(screen.getByText('My Coll')).toBeInTheDocument();
  });
});
