/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiMockSidebarContextMenus } from './ApiMockSidebarContextMenus';

function renderMenus(overrides: Record<string, unknown> = {}) {
  const props = {
    entries: [{ id: 's1', serverFolder: 'parent' }], flatFolders: [{ path: 'parent', name: 'Parent', depth: 0 }, { path: 'child', name: 'Child', depth: 1 }],
    ctxMenu: { id: 's1', name: 'Server', x: 10, y: 20 }, setCtxMenu: vi.fn(), folderMenu: null, setFolderMenu: vi.fn(),
    folderCtxMenu: null, setFolderCtxMenu: vi.fn(), folderMoveMenu: null, setFolderMoveMenu: vi.fn(), newFolderInput: '', setNewFolderInput: vi.fn(),
    startRename: vi.fn(), moveToFolder: vi.fn(), onDeleteServer: vi.fn(), startFolderCreate: vi.fn(), startFolderRename: vi.fn(), moveFolderInto: vi.fn(), deleteFolder: vi.fn(), ...overrides,
  };
  render(<ApiMockSidebarContextMenus {...props} />);
  return props;
}

describe('ApiMockSidebarContextMenus', () => {
  it('opens the server folder menu and handles its new-folder controls', () => {
    const props = renderMenus();
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-move-folder'), { clientY: 25 });
    expect(props.setFolderMenu).toHaveBeenCalled();
    const { rerender } = render(<ApiMockSidebarContextMenus {...props} folderMenu={{ id: 's1', x: 10, y: 25 }} />);
    fireEvent.keyDown(screen.getByTestId('api-mock-sidebar-new-folder-input'), { key: 'Escape' });
    expect(props.setFolderMenu).toHaveBeenCalledWith(null);
    rerender(<ApiMockSidebarContextMenus {...props} folderMenu={{ id: 's1', x: 10, y: 25 }} newFolderInput="New" />);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-new-folder-btn'));
    expect(props.moveToFolder).toHaveBeenCalledWith('s1', 'New');
  });

  it('runs folder context actions and folder move targets', () => {
    const props = renderMenus({ ctxMenu: null, folderCtxMenu: { path: 'parent', x: 10, y: 20 } });
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-ctx-subfolder'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-ctx-rename'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-ctx-delete'));
    expect(props.startFolderCreate).toHaveBeenCalledWith('parent');
    expect(props.startFolderRename).toHaveBeenCalledWith('parent');
    expect(props.deleteFolder).toHaveBeenCalledWith('parent');
  });

  it('runs direct server and folder context-menu commands', () => {
    const serverProps = renderMenus();
    fireEvent.click(screen.getByTestId('api-mock-sidebar-ctx-rename'));
    expect(serverProps.startRename).toHaveBeenCalledWith('s1', 'Server');
    cleanup();

    const props = renderMenus({ ctxMenu: null, folderCtxMenu: { path: 'parent', x: 10, y: 20 } });
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-ctx-move'), { clientY: 30 });
    expect(props.setFolderMoveMenu).toHaveBeenCalled();
    cleanup();
    render(<ApiMockSidebarContextMenus {...props} ctxMenu={null} folderCtxMenu={{ path: 'parent', x: 10, y: 20 }} folderMoveMenu={{ path: 'parent', x: 10, y: 30 }} />);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-move-top'));
    expect(props.moveFolderInto).toHaveBeenCalledWith('parent', undefined);
    cleanup();
    render(<ApiMockSidebarContextMenus {...props} ctxMenu={null} folderCtxMenu={{ path: 'parent', x: 10, y: 20 }} folderMoveMenu={null} />);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-ctx-subfolder'));
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-ctx-rename'));
    expect(props.startFolderCreate).toHaveBeenCalledWith('parent');
    expect(props.startFolderRename).toHaveBeenCalledWith('parent');
  });

  it('dismisses menus and handles submenu close and nested-folder moves', () => {
    const server = renderMenus({ folderMenu: { id: 's1', x: 10, y: 20 } });
    fireEvent.contextMenu(document.querySelector('.am-sidebar-ctx-backdrop')!);
    expect(server.setCtxMenu).toHaveBeenCalledWith(null);
    expect(server.setFolderMenu).toHaveBeenCalledWith(null);
    cleanup();

    const folder = renderMenus({ ctxMenu: null, folderCtxMenu: { path: 'parent', x: 10, y: 20 }, folderMoveMenu: { path: 'parent', x: 10, y: 30 } });
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-ctx-move'));
    expect(folder.setFolderMoveMenu).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByTestId('api-mock-sidebar-folder-move-to-child'));
    expect(folder.moveFolderInto).toHaveBeenCalledWith('parent', 'child');
    fireEvent.contextMenu(document.querySelector('.am-sidebar-ctx-backdrop')!);
    expect(folder.setFolderCtxMenu).toHaveBeenCalledWith(null);
  });
});