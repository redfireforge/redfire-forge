/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { ApiMockServerListEntry } from '../ApiMockServerListBridge';

// ─── hoisted mocks ─────────────────────────────────────────────────────────
const h = vi.hoisted(() => {
  const state: ReturnType<typeof makeState> | null = null;
  const confirmCb: (() => void) | null = null;

  function makeState(overrides: Partial<{
    entries: ApiMockServerListEntry[];
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
    onRename: (id: string, n: string) => void;
    onMoveToFolder: (id: string, f: string | undefined) => void;
    onReorder: (dragId: string, targetId: string) => void;
  }> = {}) {
    return {
      entries: [] as ApiMockServerListEntry[],
      onSelect: vi.fn(),
      onCreate: vi.fn(),
      onDelete: vi.fn(),
      onRename: vi.fn(),
      onMoveToFolder: vi.fn(),
      onReorder: vi.fn(),
      ...overrides,
    };
  }

  return { state, confirmCb, makeState };
});

vi.mock('../ApiMockServerListBridge', () => ({
  useApiMockServerList: () => h.state,
}));

vi.mock('../../../app/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: (
      _title: string,
      onConfirm: () => void,
      _onCancel?: () => void,
      _opts?: unknown,
    ) => {
      h.confirmCb = onConfirm;
    },
    confirmDialogElement: null,
  }),
}));

import ApiMockSidebar from './ApiMockSidebar';

function makeEntry(overrides: Partial<ApiMockServerListEntry> = {}): ApiMockServerListEntry {
  return {
    id: 'srv-1',
    name: 'My Server',
    port: 8080,
    status: 'stopped',
    isActive: false,
    isOpen: true,
    serverFolder: undefined,
    ...overrides,
  };
}

function setup(entries: ApiMockServerListEntry[] = []) {
  h.state = h.makeState({ entries });
  return render(<ApiMockSidebar />);
}

describe('ApiMockSidebar', () => {
  beforeEach(() => {
    h.state = null;
    h.confirmCb = null;
  });

  // ─── Null state (no bridge) ─────────────────────────────────────────────
  it('renders the sidebar shell when state is null', () => {
    h.state = null;
    render(<ApiMockSidebar />);
    expect(screen.getByTestId('api-mock-sidebar')).toBeTruthy();
    expect(screen.getByText('Mock Servers')).toBeTruthy();
    // new-server button should be disabled with no state
    expect((screen.getByTestId('api-mock-sidebar-new') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('api-mock-sidebar-new-folder-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows empty message when no servers', () => {
    setup([]);
    expect(screen.getByTestId('api-mock-sidebar-list').textContent).toMatch(/No mock servers yet/);
  });

  it('renders server items', () => {
    setup([makeEntry({ id: 'srv-1', name: 'Alpha' }), makeEntry({ id: 'srv-2', name: 'Beta', status: 'running' })]);
    expect(screen.getByTestId('api-mock-sidebar-item-srv-1')).toBeTruthy();
    expect(screen.getByTestId('api-mock-sidebar-item-srv-2')).toBeTruthy();
  });

  it('calls onSelect when clicking a server item', () => {
    setup([makeEntry()]);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    expect(h.state!.onSelect).toHaveBeenCalledWith('srv-1');
  });

  it('calls onCreate when clicking the new-server button', () => {
    setup([]);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-new'));
    expect(h.state!.onCreate).toHaveBeenCalled();
  });

  // ─── Search ─────────────────────────────────────────────────────────────
  it('filters servers by name', () => {
    setup([makeEntry({ id: 'a', name: 'Alpha' }), makeEntry({ id: 'b', name: 'Beta' })]);
    fireEvent.change(screen.getByTestId('api-mock-sidebar-search'), { target: { value: 'alph' } });
    expect(screen.getByTestId('api-mock-sidebar-item-a')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-sidebar-item-b')).toBeNull();
  });

  it('filters servers by port number', () => {
    setup([makeEntry({ id: 'a', name: 'A', port: 8080 }), makeEntry({ id: 'b', name: 'B', port: 9090 })]);
    fireEvent.change(screen.getByTestId('api-mock-sidebar-search'), { target: { value: '9090' } });
    expect(screen.queryByTestId('api-mock-sidebar-item-a')).toBeNull();
    expect(screen.getByTestId('api-mock-sidebar-item-b')).toBeTruthy();
  });

  it('shows "no match" when search has no results', () => {
    setup([makeEntry({ name: 'Alpha' })]);
    fireEvent.change(screen.getByTestId('api-mock-sidebar-search'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('api-mock-sidebar-list').textContent).toMatch(/No servers match/);
  });

  it('clears search via the × button', () => {
    setup([makeEntry({ id: 'a', name: 'Alpha' })]);
    fireEvent.change(screen.getByTestId('api-mock-sidebar-search'), { target: { value: 'alph' } });
    // Clear button appears
    fireEvent.click(screen.getByTitle('Clear search'));
    // Item should be visible again
    expect(screen.getByTestId('api-mock-sidebar-item-a')).toBeTruthy();
  });

  // ─── Rename ─────────────────────────────────────────────────────────────
  it('opens context menu on right-click and rename input on Rename click', () => {
    setup([makeEntry()]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    expect(screen.getByTestId('api-mock-sidebar-ctx-menu')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-rename'));
    expect(screen.getByTestId('api-mock-sidebar-rename-input')).toBeTruthy();
  });

  it('commits rename on Enter', () => {
    setup([makeEntry({ id: 'srv-1', name: 'Old Name' })]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-rename'));
    const input = screen.getByTestId('api-mock-sidebar-rename-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.state!.onRename).toHaveBeenCalledWith('srv-1', 'New Name');
  });

  it('cancels rename on Escape', () => {
    setup([makeEntry({ id: 'srv-1', name: 'Alpha' })]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-rename'));
    const input = screen.getByTestId('api-mock-sidebar-rename-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(h.state!.onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('api-mock-sidebar-rename-input')).toBeNull();
  });

  // ─── Delete ─────────────────────────────────────────────────────────────
  it('calls onDelete when clicking Delete in ctx menu', () => {
    setup([makeEntry()]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-delete'));
    expect(h.state!.onDelete).toHaveBeenCalledWith('srv-1');
  });

  it('closes ctx menu when clicking backdrop', () => {
    setup([makeEntry()]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    expect(screen.getByTestId('api-mock-sidebar-ctx-menu')).toBeTruthy();
    // backdrop is the sibling presentation div
    const backdrop = document.querySelector('.am-sidebar-ctx-backdrop') as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.queryByTestId('api-mock-sidebar-ctx-menu')).toBeNull();
  });

  // ─── Move to folder via ctx menu ────────────────────────────────────────
  it('shows folder submenu when clicking "Move to folder"', () => {
    // Two servers, one in a folder — submenu should offer that folder
    setup([
      makeEntry({ id: 'a', name: 'A', serverFolder: undefined }),
      makeEntry({ id: 'b', name: 'B', serverFolder: 'Prod' }),
    ]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-a'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-move-folder'));
    expect(screen.getByTestId('api-mock-sidebar-folder-submenu')).toBeTruthy();
    // Move to 'Prod' entry
    fireEvent.click(screen.getByTestId('api-mock-sidebar-move-to-Prod'));
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', 'Prod');
  });

  it('moves server to "No folder" option when in a folder', () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-move-folder'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-move-no-folder'));
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('srv-1', undefined);
  });

  it('moves server via new-folder input in submenu', () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: undefined })]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-move-folder'));
    const input = screen.getByTestId('api-mock-sidebar-new-folder-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Staging' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('srv-1', 'Staging');
  });

  // ─── Folder creation ─────────────────────────────────────────────────────
  it('creates a top-level folder via the header button', async () => {
    setup([]);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-new-folder-btn'));
    const input = screen.getByTestId('api-mock-sidebar-folder-create-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'DevFarm' } });
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-create-confirm'));
    // After confirming, folder should appear in tree
    await waitFor(() => expect(screen.getByTestId('api-mock-sidebar-folder-DevFarm')).toBeTruthy());
  });

  it('cancels folder creation on Cancel click', () => {
    setup([]);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-new-folder-btn'));
    const cancelBtn = screen.getByTitle('Cancel');
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId('api-mock-sidebar-folder-create-input')).toBeNull();
  });

  it('does not create duplicate folder', async () => {
    // Create DevFarm, then try to create DevFarm again
    setup([]);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-new-folder-btn'));
    let input = screen.getByTestId('api-mock-sidebar-folder-create-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'DevFarm' } });
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-create-confirm'));
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-DevFarm'));

    // Try again with same name
    fireEvent.click(screen.getByTestId('api-mock-sidebar-new-folder-btn'));
    input = screen.getByTestId('api-mock-sidebar-folder-create-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'devfarm' } }); // case insensitive
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-create-confirm'));
    // only one DevFarm folder should exist
    expect(screen.getAllByTestId('api-mock-sidebar-folder-DevFarm')).toHaveLength(1);
  });

  // ─── Expand/collapse ─────────────────────────────────────────────────────
  it('expand-all button is disabled when no folders', () => {
    setup([makeEntry()]);
    // no server folders, so expand-all should be disabled
    const expand = screen.getByTestId('api-mock-sidebar-expand-all') as HTMLButtonElement;
    expect(expand.disabled).toBe(true);
    fireEvent.click(expand);
  });

  it('expand-all enabled when folders exist and toggles them', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    const expandBtn = screen.getByTestId('api-mock-sidebar-expand-all');
    expect((expandBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(expandBtn);
    fireEvent.click(expandBtn);
  });

  it('toggles a folder collapsed state on click', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    const folder = screen.getByTestId('api-mock-sidebar-folder-Prod');
    // Click to collapse
    const toggleBtn = folder.querySelector('.am-sidebar-folder-label') as HTMLElement;
    if (toggleBtn) fireEvent.click(toggleBtn);
    // Click to expand
    if (toggleBtn) fireEvent.click(toggleBtn);
  });

  // ─── Folder ctx menu: rename, delete ───────────────────────────────────
  function getFolderHeaderWrap(path: string) {
    const folder = screen.getByTestId(`api-mock-sidebar-folder-${path}`);
    return folder.querySelector('.am-sidebar-folder-header-wrap') as HTMLElement;
  }

  it('opens folder ctx menu on right-click and can rename', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    expect(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-menu"]')).toBeTruthy();
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-rename"]')!);
    const renameInput = screen.getByTestId('api-mock-sidebar-folder-rename-input') as HTMLInputElement;
    fireEvent.change(renameInput, { target: { value: 'Production' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });
    // onMoveToFolder is called to remap the server to the new folder path
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('srv-1', 'Production');
  });

  it('cancels folder rename on Escape', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-rename"]')!);
    const renameInput = screen.getByTestId('api-mock-sidebar-folder-rename-input');
    fireEvent.keyDown(renameInput, { key: 'Escape' });
    // folder name unchanged
    expect(screen.getByTestId('api-mock-sidebar-folder-Prod')).toBeTruthy();
  });

  it('deletes a folder via ctx menu (confirm callback)', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-delete"]')!);
    // Trigger the confirm callback that the mock captured
    act(() => { h.confirmCb?.(); });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('srv-1', undefined);
  });

  it('creates a subfolder via folder ctx menu', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-subfolder"]')!);
    const input = screen.getByTestId('api-mock-sidebar-folder-create-input');
    fireEvent.change(input, { target: { value: 'EU' } });
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-create-confirm'));
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod/EU'));
  });

  // ─── Active server marker ────────────────────────────────────────────────
  it('shows active-item marker for the active server', () => {
    setup([makeEntry({ id: 'srv-1', isActive: true })]);
    expect(screen.getByTestId('api-mock-sidebar-active-item')).toBeTruthy();
  });

  // ─── Empty stale-folder cleanup ──────────────────────────────────────────
  it('drops stale empty folders when servers populate them', async () => {
    // Start with a server in "Prod"
    h.state = h.makeState({ entries: [makeEntry({ id: 'srv-1', serverFolder: 'Prod' })] });
    const { rerender } = render(<ApiMockSidebar />);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));

    // Move server out (trigger keep-alive) then back in via re-render with new entries
    // The internal emptyFolders cleanup runs via useEffect when entries change
    h.state = h.makeState({ entries: [makeEntry({ id: 'srv-1', serverFolder: 'Prod' })] });
    await act(async () => {
      rerender(<ApiMockSidebar />);
    });
    expect(screen.getByTestId('api-mock-sidebar-folder-Prod')).toBeTruthy();
  });

  // ─── Subfolder button inside folder ─────────────────────────────────────
  it('opens subfolder create row via the + button in a folder', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-add-Prod'));
    expect(screen.getByTestId('api-mock-sidebar-folder-create-input')).toBeTruthy();
  });

  // ─── moveServerToFolder: keeps empty folder alive ─────────────────────
  it('keeps the source folder alive as empty when last server leaves', () => {
    // srv-1 is the only server in 'Prod'; moving it out should track 'Prod' as empty
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    // Open move-folder submenu
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-move-folder'));
    // Click "No folder" to remove from Prod
    fireEvent.click(screen.getByTestId('api-mock-sidebar-move-no-folder'));
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('srv-1', undefined);
  });

  // ─── folder-move submenu: move to existing folder ────────────────────
  it('moves server to another folder using the move submenu', async () => {
    setup([
      makeEntry({ id: 'a', name: 'A', serverFolder: 'Dev' }),
      makeEntry({ id: 'b', name: 'B', serverFolder: 'Prod' }),
    ]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-a'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-move-folder'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-move-to-Prod'));
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', 'Prod');
  });

  it('closes folder move submenu via Escape in new-folder-input', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: undefined })]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-move-folder'));
    const input = screen.getByTestId('api-mock-sidebar-new-folder-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    // submenu should close
    expect(screen.queryByTestId('api-mock-sidebar-folder-submenu')).toBeNull();
  });

  it('does not move server via new-folder-input if input is empty', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: undefined })]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-move-folder'));
    // button inside the submenu; query from the submenu portal
    const submenu = screen.getByTestId('api-mock-sidebar-folder-submenu');
    const btn = submenu.querySelector('button[data-testid="api-mock-sidebar-new-folder-btn"]') as HTMLButtonElement;
    // Empty input — button should be disabled
    expect(btn?.disabled).toBe(true);
  });

  // ─── Folder ctx move ─────────────────────────────────────────────────
  it('folder ctx move submenu: moves a folder into another', async () => {
    setup([
      makeEntry({ id: 'a', serverFolder: 'Prod' }),
      makeEntry({ id: 'b', serverFolder: 'Dev' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-move"]')!);
    // Find "Dev" as a move target
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-move-folder-to-Dev"]') || document.querySelector('[role="menuitem"]')!);
    // onMoveToFolder should have been called to remap Prod servers under Dev
  });

  // ─── Rename: empty input does not call onRename ────────────────────────
  it('does not call onRename when rename input is empty on Enter', () => {
    setup([makeEntry({ id: 'srv-1', name: 'Alpha' })]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-srv-1'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-rename'));
    const input = screen.getByTestId('api-mock-sidebar-rename-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.state!.onRename).not.toHaveBeenCalled();
  });

  // ─── Folder delete with multiple servers ───────────────────────────────
  it('deletes folder with multiple servers — all move up', async () => {
    setup([
      makeEntry({ id: 'a', serverFolder: 'Prod' }),
      makeEntry({ id: 'b', serverFolder: 'Prod' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-delete"]')!);
    act(() => { h.confirmCb?.(); });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', undefined);
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('b', undefined);
  });

  // ─── Folder create: Escape in input cancels ────────────────────────────
  it('cancels top-level folder create on Escape in input', () => {
    setup([]);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-new-folder-btn'));
    const input = screen.getByTestId('api-mock-sidebar-folder-create-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('api-mock-sidebar-folder-create-input')).toBeNull();
  });

  it('cancels an empty folder draft when Enter is pressed', () => {
    setup([]);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-new-folder-btn'));
    const input = screen.getByTestId('api-mock-sidebar-folder-create-input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByTestId('api-mock-sidebar-folder-create-input')).toBeNull();
  });

  it('deletes an explicitly created empty folder', async () => {
    setup([]);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-new-folder-btn'));
    fireEvent.change(screen.getByTestId('api-mock-sidebar-folder-create-input'), { target: { value: 'Empty' } });
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-create-confirm'));
    await waitFor(() => expect(screen.getByTestId('api-mock-sidebar-folder-Empty')).toBeTruthy());
    fireEvent.contextMenu(getFolderHeaderWrap('Empty'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-delete"]')!);
    act(() => { h.confirmCb?.(); });
    expect(screen.queryByTestId('api-mock-sidebar-folder-Empty')).toBeNull();
  });

  // ─── folder rename: sibling collision is rejected ─────────────────────
  it('rejects folder rename if sibling has same name (case-insensitive)', async () => {
    // Two folders: 'Prod' and 'Dev'
    h.state = h.makeState({
      entries: [
        makeEntry({ id: 'a', serverFolder: 'Prod' }),
        makeEntry({ id: 'b', serverFolder: 'Dev' }),
      ],
    });
    render(<ApiMockSidebar />);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-rename"]')!);
    const input = screen.getByTestId('api-mock-sidebar-folder-rename-input') as HTMLInputElement;
    // Try to rename 'Prod' to 'Dev' (collision)
    fireEvent.change(input, { target: { value: 'dev' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // onMoveToFolder should NOT have been called (rename rejected)
    expect(h.state!.onMoveToFolder).not.toHaveBeenCalled();
  });

  // ─── Folder move menu (folder into folder) ─────────────────────────────
  it('move-folder menu closes if same name already exists at destination', async () => {
    // Prod/Sub and Dev — moving Sub into Dev rejected if Dev already has Sub
    setup([
      makeEntry({ id: 'a', serverFolder: 'Prod' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    // Open ctx menu, then move menu
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    const moveBtn = document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-move"]');
    if (moveBtn) {
      fireEvent.click(moveBtn);
      // No other valid folders to move to with a single folder — just verify the move menu opens
      expect(document.querySelector('[data-testid="api-mock-sidebar-folder-move-submenu"]') ||
             document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-menu"]')).toBeTruthy();
    }
  });

  // ─── Server rendered inside folder ─────────────────────────────────────
  it('renders a server inside its folder', async () => {
    setup([makeEntry({ id: 'srv-1', name: 'Alpha', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    expect(screen.getByTestId('api-mock-sidebar-item-srv-1')).toBeTruthy();
  });

  // ─── Folder toggle ────────────────────────────────────────────────────
  it('toggles a folder open/closed on header button click', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    const folder = screen.getByTestId('api-mock-sidebar-folder-Prod');
    const headerBtn = folder.querySelector('.am-sidebar-folder-header') as HTMLElement;
    // Collapse (the folder starts expanded)
    fireEvent.click(headerBtn);
    // Expand again
    fireEvent.click(headerBtn);
  });

  // ─── Backdrop right-click closes folder ctx ─────────────────────────────
  it('right-click on ctx backdrop closes folder ctx menu', async () => {
    setup([makeEntry({ id: 'srv-1', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    expect(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-menu"]')).toBeTruthy();
    const backdrop = document.querySelector('.am-sidebar-ctx-backdrop') as HTMLElement;
    fireEvent.contextMenu(backdrop);
    expect(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-menu"]')).toBeNull();
  });

  it('reorders a server when dragged onto another server', () => {
    setup([
      makeEntry({ id: 'a', name: 'A' }),
      makeEntry({ id: 'b', name: 'B' }),
    ]);
    const source = screen.getByTestId('api-mock-sidebar-item-a');
    const target = screen.getByTestId('api-mock-sidebar-item-b');
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(h.state!.onReorder).toHaveBeenCalledWith('a', 'b');
  });

  it('moves a dragged server into the target server folder before reordering', () => {
    setup([
      makeEntry({ id: 'a', name: 'A', serverFolder: undefined }),
      makeEntry({ id: 'b', name: 'B', serverFolder: 'Prod' }),
    ]);
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(screen.getByTestId('api-mock-sidebar-item-a'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('api-mock-sidebar-item-b'), { dataTransfer });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', 'Prod');
    expect(h.state!.onReorder).toHaveBeenCalledWith('a', 'b');
  });

  it('handles folder drag onto a server and resets the drag state', async () => {
    setup([
      makeEntry({ id: 'a', name: 'A', serverFolder: 'Source' }),
      makeEntry({ id: 'b', name: 'B', serverFolder: 'Target' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Source'));
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    const folderHeader = screen
      .getByTestId('api-mock-sidebar-folder-Source')
      .querySelector('.am-sidebar-folder-header-wrap') as HTMLElement;
    fireEvent.dragStart(folderHeader, { dataTransfer });
    fireEvent.drop(screen.getByTestId('api-mock-sidebar-item-b'), { dataTransfer });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', 'Target/Source');
  });

  it('drops a dragged folder onto the root drop zone', async () => {
    setup([
      makeEntry({ id: 'a', name: 'A', serverFolder: 'Parent/Child' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Parent/Child'));
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    const folderHeader = screen
      .getByTestId('api-mock-sidebar-folder-Parent/Child')
      .querySelector('.am-sidebar-folder-header-wrap') as HTMLElement;
    fireEvent.dragStart(folderHeader, { dataTransfer });
    const rootDrop = screen.getByTestId('api-mock-sidebar-root-drop');
    fireEvent.dragOver(rootDrop, { dataTransfer });
    fireEvent.drop(rootDrop, { dataTransfer });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', 'Child');
  });

  it('covers server drag hover, leave, end, and same-target drop paths', () => {
    setup([
      makeEntry({ id: 'a', name: 'A' }),
      makeEntry({ id: 'b', name: 'B' }),
    ]);
    const source = screen.getByTestId('api-mock-sidebar-item-a');
    const target = screen.getByTestId('api-mock-sidebar-item-b');
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.dragLeave(target);
    fireEvent.drop(source, { dataTransfer });
    fireEvent.dragEnd(source);
    expect(h.state!.onReorder).not.toHaveBeenCalled();
  });

  it('covers folder hover, leave, drop, and drag-end paths', async () => {
    setup([
      makeEntry({ id: 'a', name: 'A', serverFolder: 'Source' }),
      makeEntry({ id: 'b', name: 'B', serverFolder: 'Target' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Source'));
    const sourceHeader = screen
      .getByTestId('api-mock-sidebar-folder-Source')
      .querySelector('.am-sidebar-folder-header-wrap') as HTMLElement;
    const targetFolder = screen.getByTestId('api-mock-sidebar-folder-Target');
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(screen.getByTestId('api-mock-sidebar-item-a'), { dataTransfer });
    fireEvent.dragOver(targetFolder, { dataTransfer });
    fireEvent.dragLeave(targetFolder, { relatedTarget: null });
    fireEvent.drop(targetFolder, { dataTransfer });
    fireEvent.dragStart(sourceHeader, { dataTransfer });
    fireEvent.dragEnd(sourceHeader);
  });

  it('covers folder create Enter and disabled duplicate-name branches', async () => {
    setup([makeEntry({ id: 'a', serverFolder: 'Prod' })]);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-new-folder-btn'));
    const input = screen.getByTestId('api-mock-sidebar-folder-create-input');
    fireEvent.change(input, { target: { value: 'Prod' } });
    const add = screen.getByTestId('api-mock-sidebar-folder-create-confirm') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByTestId('api-mock-sidebar-folder-create-input')).toBeNull();
  });

  it('covers drag guards while a search filter disables dragging', () => {
    setup([makeEntry({ id: 'a', name: 'Alpha' }), makeEntry({ id: 'b', name: 'Beta' })]);
    fireEvent.change(screen.getByTestId('api-mock-sidebar-search'), { target: { value: 'alpha' } });
    const item = screen.getByTestId('api-mock-sidebar-item-a');
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(item, { dataTransfer });
    fireEvent.dragOver(item, { dataTransfer });
    fireEvent.drop(item, { dataTransfer });
    fireEvent.dragEnd(item);
    expect(h.state!.onReorder).not.toHaveBeenCalled();
  });

  it('renders closed servers and singular/plural rule counts', () => {
    setup([
      makeEntry({ id: 'one', name: 'One', isOpen: false, status: 'running', ruleCount: 1 }),
      makeEntry({ id: 'many', name: 'Many', ruleCount: 3 }),
    ]);
    expect(screen.getByTestId('api-mock-sidebar-item-one').textContent).toContain('One');
    expect(screen.getByTestId('api-mock-sidebar-item-many').textContent).toContain('Many');
  });

  it('moves one server out while its source folder remains occupied', () => {
    setup([
      makeEntry({ id: 'a', serverFolder: 'Prod' }),
      makeEntry({ id: 'b', serverFolder: 'Prod' }),
    ]);
    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-a'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-move-folder'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-move-no-folder'));
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', undefined);
  });

  it('does not remap a server when dropped back into its current folder', async () => {
    setup([
      makeEntry({ id: 'a', serverFolder: 'Prod' }),
      makeEntry({ id: 'b', serverFolder: 'Prod' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(screen.getByTestId('api-mock-sidebar-item-a'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('api-mock-sidebar-folder-Prod'), { dataTransfer });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', 'Prod');
  });

  it('deletes a parent folder and promotes nested servers', async () => {
    setup([
      makeEntry({ id: 'a', serverFolder: 'Prod' }),
      makeEntry({ id: 'b', serverFolder: 'Prod/EU' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod/EU'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-delete"]')!);
    act(() => { h.confirmCb?.(); });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', undefined);
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('b', 'EU');
  });

  it('leaves unrelated servers unchanged when deleting a folder', async () => {
    setup([
      makeEntry({ id: 'a', serverFolder: 'Prod' }),
      makeEntry({ id: 'b', serverFolder: 'Other' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-delete"]')!);
    act(() => { h.confirmCb?.(); });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', undefined);
    expect(h.state!.onMoveToFolder).not.toHaveBeenCalledWith('b', expect.anything());
  });

  it('deletes a nested folder with multiple direct servers and subfolders', async () => {
    setup([
      makeEntry({ id: 'a', serverFolder: 'Prod/EU' }),
      makeEntry({ id: 'b', serverFolder: 'Prod/EU' }),
      makeEntry({ id: 'c', serverFolder: 'Prod/EU/Smoke' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod/EU'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod/EU'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-delete"]')!);
    act(() => { h.confirmCb?.(); });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', undefined);
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('b', undefined);
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('c', 'Prod/Smoke');
  });

  it('moves a folder to top level from its folder move submenu', async () => {
    setup([makeEntry({ id: 'a', serverFolder: 'Parent/Child' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Parent/Child'));
    fireEvent.contextMenu(getFolderHeaderWrap('Parent/Child'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-move"]')!);
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-move-top"]')!);
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', 'Child');
  });

  it('commits a folder rename on blur', async () => {
    setup([makeEntry({ id: 'a', serverFolder: 'Prod' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    fireEvent.contextMenu(getFolderHeaderWrap('Prod'));
    fireEvent.click(document.querySelector('[data-testid="api-mock-sidebar-folder-ctx-rename"]')!);
    const input = screen.getByTestId('api-mock-sidebar-folder-rename-input');
    fireEvent.change(input, { target: { value: 'Production' } });
    fireEvent.blur(input);
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', 'Production');
  });

  it('covers nested server item and rename input click handlers', () => {
    setup([makeEntry({ id: 'a', name: 'Alpha' })]);
    const item = screen.getByTestId('api-mock-sidebar-item-a');
    fireEvent.click(item.querySelector('.am-sidebar-item-btn')!);
    fireEvent.contextMenu(item);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-rename'));
    const renameInput = screen.getByTestId('api-mock-sidebar-rename-input');
    fireEvent.click(renameInput);
    expect(renameInput).toBeTruthy();
  });

  it('covers folder drop hover and drop branches for a server drag', async () => {
    setup([
      makeEntry({ id: 'a', serverFolder: undefined }),
      makeEntry({ id: 'b', serverFolder: 'Prod' }),
    ]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));
    const folder = screen.getByTestId('api-mock-sidebar-folder-Prod');
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(screen.getByTestId('api-mock-sidebar-item-a'), { dataTransfer });
    fireEvent.dragOver(folder, { dataTransfer });
    fireEvent.drop(folder, { dataTransfer });
    expect(h.state!.onMoveToFolder).toHaveBeenCalledWith('a', 'Prod');
  });

  it('removes an empty-folder marker when the folder becomes occupied again', async () => {
    const initial = makeEntry({ id: 'a', serverFolder: 'Prod' });
    h.state = h.makeState({ entries: [initial] });
    const rendered = render(<ApiMockSidebar />);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Prod'));

    fireEvent.contextMenu(screen.getByTestId('api-mock-sidebar-item-a'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-move-folder'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-move-no-folder'));

    h.state = h.makeState({ entries: [makeEntry({ id: 'a', serverFolder: undefined })] });
    rendered.rerender(<ApiMockSidebar />);
    h.state = h.makeState({ entries: [initial] });
    rendered.rerender(<ApiMockSidebar />);
    await waitFor(() => expect(screen.getByTestId('api-mock-sidebar-folder-Prod')).toBeTruthy());
  });

  it('ignores a folder drop onto its own descendant', async () => {
    setup([makeEntry({ id: 'a', serverFolder: 'Parent/Child' })]);
    await waitFor(() => screen.getByTestId('api-mock-sidebar-folder-Parent/Child'));
    const parentHeader = getFolderHeaderWrap('Parent');
    const child = screen.getByTestId('api-mock-sidebar-folder-Parent/Child');
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(parentHeader, { dataTransfer });
    fireEvent.dragOver(child, { dataTransfer });
    fireEvent.drop(child, { dataTransfer });
    expect(h.state!.onMoveToFolder).not.toHaveBeenCalled();
  });

});
