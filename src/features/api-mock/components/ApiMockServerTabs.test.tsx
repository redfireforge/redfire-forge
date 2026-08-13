/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockServerTabs, API_MOCK_WORKSPACE_PANEL_ID } from './ApiMockServerTabs';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(id: string, name: string, port: number): ApiMockServerDefinitionV1 {
  return {
    id,
    name,
    enabled: true,
    host: '127.0.0.1',
    port,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('ApiMockServerTabs', () => {
  it('renders tabs with default stopped status and create/select handlers', () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();
    const servers = [makeServer('srv-1', 'Mock Server 1', 4600), makeServer('srv-2', 'Mock Server 2', 4601)];
    render(<ApiMockServerTabs servers={servers} activeServerId="srv-1" onSelect={onSelect} onCreate={onCreate} onClose={vi.fn()} />);

    const tabs = within(screen.getByTestId('api-mock-server-tabs')).getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-controls', API_MOCK_WORKSPACE_PANEL_ID);
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    expect(tabs[0].getAttribute('title')).toContain('Stopped');
    expect(tabs[0].querySelector('.am-server-tab-label')?.textContent).toBe('Mock Server 1:4600');
    expect(tabs[0].querySelector('.am-mono')).toBeNull();

    fireEvent.click(tabs[1]);
    expect(onSelect).toHaveBeenCalledWith('srv-2');
    fireEvent.click(screen.getByTestId('api-mock-tab-add'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('renames on F2 / double-click, duplicates from the context menu, and reorders on drop', () => {
    const onRename = vi.fn();
    const onDuplicate = vi.fn();
    const onReorder = vi.fn();
    const onClose = vi.fn();
    const servers = [makeServer('srv-1', 'Mock Server 1', 4600), makeServer('srv-2', 'Mock Server 2', 4601)];
    render(
      <ApiMockServerTabs
        servers={servers}
        activeServerId="srv-1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={onClose}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onReorder={onReorder}
      />,
    );

    const tab = screen.getByTestId('api-mock-tab-srv-1');
    fireEvent.doubleClick(tab);
    const input = screen.getByTestId('api-mock-tab-rename-srv-1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Users' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('srv-1', 'Users');

    tab.focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'F2' });
    const input2 = screen.getByTestId('api-mock-tab-rename-srv-1') as HTMLInputElement;
    fireEvent.change(input2, { target: { value: 'Nope' } });
    fireEvent.keyDown(input2, { key: 'Escape' });
    fireEvent.blur(input2);
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalledWith('srv-1', 'Nope');

    fireEvent.contextMenu(screen.getByTestId('api-mock-tab-srv-2'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-duplicate'));
    expect(onDuplicate).toHaveBeenCalledWith('srv-2');

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    fireEvent.contextMenu(screen.getByTestId('api-mock-tab-srv-1'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-copy-label'));
    expect(writeText).toHaveBeenCalledWith('Mock Server 1');

    fireEvent.contextMenu(screen.getByTestId('api-mock-tab-srv-1'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close-others'));
    expect(onClose).toHaveBeenCalledWith('srv-2');

    fireEvent.contextMenu(screen.getByTestId('api-mock-tab-srv-1'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close-right'));
    expect(onClose).toHaveBeenCalledWith('srv-2');

    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      types: ['text/x-api-mock-tab-index'],
      setData: vi.fn(),
      getData: () => '0',
    };
    fireEvent.dragStart(tab, { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('api-mock-tab-srv-2'), { dataTransfer, clientX: 900 });
    fireEvent.drop(screen.getByTestId('api-mock-tab-srv-2'), { dataTransfer, clientX: 900 });
    expect(onReorder).toHaveBeenCalled();
  });

  it('batches close-others and close-right through onCloseMany when provided', () => {
    const onClose = vi.fn();
    const onCloseMany = vi.fn();
    const servers = [
      makeServer('srv-1', 'Mock Server 1', 4600),
      makeServer('srv-2', 'Mock Server 2', 4601),
      makeServer('srv-3', 'Mock Server 3', 4602),
    ];
    render(
      <ApiMockServerTabs
        servers={servers}
        activeServerId="srv-1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={onClose}
        onCloseMany={onCloseMany}
      />,
    );
    fireEvent.contextMenu(screen.getByTestId('api-mock-tab-srv-1'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close-others'));
    expect(onCloseMany).toHaveBeenCalledWith(['srv-2', 'srv-3']);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.contextMenu(screen.getByTestId('api-mock-tab-srv-2'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close-right'));
    expect(onCloseMany).toHaveBeenCalledWith(['srv-3']);
  });

  it('covers remaining rename, close, and drag branches', () => {
    const onRename = vi.fn();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const onReorder = vi.fn();
    const servers = [makeServer('srv-1', 'Mock Server 1', 4600), makeServer('srv-2', 'Mock Server 2', 4601)];
    render(
      <ApiMockServerTabs
        servers={servers}
        activeServerId="srv-1"
        onSelect={onSelect}
        onCreate={vi.fn()}
        onClose={onClose}
        onRename={onRename}
        onReorder={onReorder}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId('api-mock-tab-srv-1'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-rename'));
    const input = screen.getByTestId('api-mock-tab-rename-srv-1');
    fireEvent.click(input);
    fireEvent.doubleClick(input);
    fireEvent.change(input, { target: { value: 'Payments' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('srv-1', 'Payments');

    fireEvent.contextMenu(screen.getByTestId('api-mock-tab-srv-1'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close'));
    expect(onClose).toHaveBeenCalledWith('srv-1');

    fireEvent.doubleClick(screen.getByTestId('api-mock-tab-srv-2'));
    const editing = screen.getByTestId('api-mock-tab-rename-srv-2');
    fireEvent.click(screen.getByTestId('api-mock-tab-srv-2'));
    fireEvent.keyDown(editing, { key: 'a' });
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Delete' });
    const dt = { effectAllowed: '', dropEffect: '', types: ['text/x-api-mock-tab-index'], setData: vi.fn(), getData: () => '1', preventDefault: vi.fn() };
    fireEvent.dragStart(screen.getByTestId('api-mock-tab-srv-2'), { dataTransfer: dt });
    fireEvent.keyDown(editing, { key: 'Escape' });

    const dt2 = { effectAllowed: '', dropEffect: '', types: ['text/plain'], setData: vi.fn(), getData: () => '0' };
    fireEvent.dragOver(screen.getByTestId('api-mock-tab-srv-2'), { dataTransfer: dt2, clientX: 10 });
    const dt3 = { effectAllowed: '', dropEffect: '', types: ['text/x-api-mock-tab-index'], setData: vi.fn(), getData: () => '0' };
    fireEvent.dragStart(screen.getByTestId('api-mock-tab-srv-1'), { dataTransfer: dt3 });
    fireEvent.dragOver(screen.getByTestId('api-mock-tab-srv-1'), { dataTransfer: dt3, clientX: 10 });
    fireEvent.dragOver(screen.getByTestId('api-mock-tab-srv-2'), { dataTransfer: dt3, clientX: 1 });
    fireEvent.dragLeave(screen.getByTestId('api-mock-tab-srv-2'));
    fireEvent.drop(screen.getByTestId('api-mock-tab-srv-1'), { dataTransfer: dt3, clientX: 1 });
    fireEvent.dragEnd(screen.getByTestId('api-mock-tab-srv-1'));

    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'F2' });
    fireEvent.click(screen.getByTestId('api-mock-tab-srv-2'));
    expect(onSelect).toHaveBeenCalledWith('srv-2');
  });

  it('does not start a rename when onRename is omitted', () => {
    render(
      <ApiMockServerTabs
        servers={[makeServer('srv-1', 'Mock Server 1', 4600)]}
        activeServerId="srv-1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId('api-mock-tab-srv-1'));
    expect(screen.queryByTestId('api-mock-tab-rename-srv-1')).toBeNull();
    const dt = { effectAllowed: '', dropEffect: '', types: ['text/x-api-mock-tab-index'], setData: vi.fn(), getData: () => '0' };
    fireEvent.dragStart(screen.getByTestId('api-mock-tab-srv-1'), { dataTransfer: dt });
  });

  it('renders running and dirty state indicators and closes from the close button', () => {
    const onClose = vi.fn();
    const servers = [makeServer('srv-1', 'Mock Server 1', 4600)];
    render(
      <ApiMockServerTabs
        servers={servers}
        activeServerId="srv-1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={onClose}
        statusById={{ 'srv-1': 'running' }}
        dirtyById={{ 'srv-1': true }}
      />,
    );

    expect(screen.getByTestId('api-mock-tab-srv-1').getAttribute('title')).toContain('Running');
    expect(screen.getByRole('img', { name: 'Unapplied changes' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-tab-close-srv-1'));
    expect(onClose).toHaveBeenCalledWith('srv-1');
  });

  it('renders embedded chrome and remaining status titles', () => {
    const servers = [
      makeServer('srv-1', 'Mock Server 1', 4600),
      makeServer('srv-2', 'Mock Server 2', 4601),
    ];
    render(
      <ApiMockServerTabs
        servers={servers}
        activeServerId="srv-1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
        embedded
        statusById={{ 'srv-1': 'draining', 'srv-2': 'error' }}
      />,
    );
    expect(screen.getByTestId('api-mock-server-tabs').className).toContain('embedded');
    expect(screen.getByTestId('api-mock-tab-srv-1').getAttribute('title')).toContain('Draining');
    expect(screen.getByTestId('api-mock-tab-srv-2').getAttribute('title')).toContain('Error');
  });

  it('supports Delete/Backspace keyboard close only when a tab is focused', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const servers = [makeServer('srv-1', 'Mock Server 1', 4600), makeServer('srv-2', 'Mock Server 2', 4601)];
    render(<ApiMockServerTabs servers={servers} activeServerId="srv-1" onSelect={onSelect} onCreate={vi.fn()} onClose={onClose} />);

    const list = screen.getByRole('tablist', { name: 'Mock server tabs' });
    fireEvent.keyDown(list, { key: 'Delete' });
    expect(onClose).not.toHaveBeenCalled();

    const tabs = within(list).getAllByRole('tab');
    tabs[1].focus();
    fireEvent.keyDown(list, { key: 'Backspace' });
    expect(onClose).toHaveBeenCalledWith('srv-2');
  });

  it('shows the 8-tab ceiling on the add button and drops before the target tab', () => {
    const onReorder = vi.fn();
    const onDuplicate = vi.fn();
    const onCreate = vi.fn();
    const servers = Array.from({ length: 8 }, (_, i) => makeServer(`srv-${i}`, `Server ${i}`, 4600 + i));
    render(
      <ApiMockServerTabs
        servers={servers}
        activeServerId="srv-0"
        onSelect={vi.fn()}
        onCreate={onCreate}
        onClose={vi.fn()}
        onRename={vi.fn()}
        onDuplicate={onDuplicate}
        onReorder={onReorder}
        statusById={{ 'srv-0': 'starting', 'srv-1': 'applying' }}
      />,
    );
    const add = screen.getByTestId('api-mock-tab-add');
    expect(add.getAttribute('title')).toMatch(/Maximum 8/);
    expect(add).toBeDisabled();
    fireEvent.click(add);
    expect(onCreate).not.toHaveBeenCalled();

    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      types: ['text/x-api-mock-tab-index'],
      setData: vi.fn(),
      getData: () => '0',
    };
    fireEvent.dragStart(screen.getByTestId('api-mock-tab-srv-0'), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('api-mock-tab-srv-1'), { dataTransfer, clientX: -50 });
    fireEvent.drop(screen.getByTestId('api-mock-tab-srv-1'), { dataTransfer, clientX: -50 });
    onReorder.mockClear();

    const bogus = {
      effectAllowed: '',
      dropEffect: '',
      types: [] as string[],
      setData: vi.fn(),
      getData: () => '',
    };
    fireEvent.drop(screen.getByTestId('api-mock-tab-srv-1'), { dataTransfer: bogus, clientX: 10 });
    expect(onReorder).not.toHaveBeenCalled();

    const nanIndex = {
      effectAllowed: '',
      dropEffect: '',
      types: ['text/x-api-mock-tab-index'],
      setData: vi.fn(),
      getData: () => 'nope',
    };
    fireEvent.drop(screen.getByTestId('api-mock-tab-srv-1'), { dataTransfer: nanIndex, clientX: 10 });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('keeps the drop indicator when the pointer moves into a child of the tab', () => {
    const onReorder = vi.fn();
    const servers = [makeServer('srv-1', 'Mock Server 1', 4600), makeServer('srv-2', 'Mock Server 2', 4601)];
    render(
      <ApiMockServerTabs
        servers={servers}
        activeServerId="srv-1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
        onReorder={onReorder}
      />,
    );
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      types: ['text/x-api-mock-tab-index'],
      setData: vi.fn(),
      getData: () => '0',
    };
    fireEvent.dragStart(screen.getByTestId('api-mock-tab-srv-1'), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('api-mock-tab-srv-2'), { dataTransfer, clientX: 900 });
    expect(screen.getByTestId('api-mock-tab-srv-2').className).toMatch(/am-server-tab-drop-/);
    fireEvent.dragLeave(screen.getByTestId('api-mock-tab-srv-2'), {
      relatedTarget: screen.getByTestId('api-mock-tab-srv-2').querySelector('.am-server-tab-label'),
    });
    expect(screen.getByTestId('api-mock-tab-srv-2').className).toMatch(/am-server-tab-drop-/);
    fireEvent.dragEnd(screen.getByTestId('api-mock-tab-srv-1'));
    expect(screen.getByTestId('api-mock-tab-srv-2').className).not.toMatch(/am-server-tab-drop-/);
  });
});
