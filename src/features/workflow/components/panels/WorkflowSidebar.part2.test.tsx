/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowSidebar from './WorkflowSidebar';
import { Workflow, WorkflowFolder } from '../../types/workflow';
import { mockDataTransfer } from '../../../../test-utils/domMocks';
import { makeWorkflow as _makeWorkflow, makeWorkflowFolder } from '../../../../test-utils/factories';

const ts = Date.now();

const makeWorkflow = (overrides: Partial<Workflow> & { id: string; name: string }): Workflow =>
  _makeWorkflow({
    nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Step' } }],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  });

const makeFolder = (overrides: Partial<WorkflowFolder> & { id: string; name: string }): WorkflowFolder =>
  makeWorkflowFolder(overrides);

const defaultProps = {
  selectedId: null,
  foldersLoaded: true,
  onSelect: vi.fn(),
  onNew: vi.fn(),
  onBrowseTemplates: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
};

const workflows: Workflow[] = [
  makeWorkflow({ id: 'w1', name: 'Order Flow', folderId: 'f-perf', folderOrder: 0 }),
  makeWorkflow({ id: 'w2', name: 'User Registration', folderId: 'f-perf', folderOrder: 1 }),
  makeWorkflow({ id: 'w3', name: 'Health Check' }),
  makeWorkflow({ id: 'w4', name: 'Stripe Payment', folderId: 'f-pay', folderOrder: 0 }),
];

const folders: WorkflowFolder[] = [
  makeFolder({ id: 'f-perf', name: 'Performance', order: 0 }),
  makeFolder({ id: 'f-pay', name: 'Payment', parentId: 'f-perf', order: 0 }),
];

function stubRect(el: Element | null, height = 40) {
  if (!el) return;
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    width: 200,
    height,
    bottom: height,
    right: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('WorkflowSidebar', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not rename folder inline on blur when name is unchanged', () => {
    const onRenameFolder = vi.fn();
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onRenameFolder={onRenameFolder} />,
    );
    fireEvent.doubleClick(screen.getByText('Performance'));
    fireEvent.blur(screen.getByDisplayValue('Performance'));
    expect(onRenameFolder).not.toHaveBeenCalled();
  });

  it('does not call onRenameFolder when inline rename commits empty name on Enter', () => {
    const onRenameFolder = vi.fn();
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onRenameFolder={onRenameFolder} />,
    );
    fireEvent.doubleClick(screen.getByText('Performance'));
    const input = screen.getByDisplayValue('Performance');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameFolder).not.toHaveBeenCalled();
  });

  it('does not propagate click from inline folder rename field to folder header collapse', () => {
    const onToggleFolderCollapse = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        onRenameFolder={vi.fn()}
        onToggleFolderCollapse={onToggleFolderCollapse}
      />,
    );
    fireEvent.contextMenu(screen.getByText('Performance'));
    fireEvent.click(screen.getByText('Rename Folder'));
    fireEvent.click(screen.getByDisplayValue('Performance'));
    expect(onToggleFolderCollapse).not.toHaveBeenCalled();
  });

  it('does not crash when clicking folder header without onToggleFolderCollapse', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);
    fireEvent.click(screen.getByText('Performance').closest('.wf-folder-header') as HTMLElement);
  });

  it('opens sub-folder create dialog from folder context menu', () => {
    const onCreateFolder = vi.fn();
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onCreateFolder={onCreateFolder} />,
    );
    fireEvent.contextMenu(screen.getByText('Performance'));
    fireEvent.click(screen.getByText('New Sub-Folder'));
    expect(screen.getByText('New sub-folder')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Folder name'), { target: { value: 'Child' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/ }));
    expect(onCreateFolder).toHaveBeenCalledWith('Child', 'f-perf');
  });

  it('deletes folder without rewiring workflows when onMoveWorkflowToFolder is omitted', () => {
    const onDeleteFolder = vi.fn(() => new Set(['f-pay']));
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onDeleteFolder={onDeleteFolder} />,
    );
    fireEvent.contextMenu(screen.getByText('Payment'));
    fireEvent.click(screen.getByText('Delete Folder'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleteFolder).toHaveBeenCalledWith('f-pay');
  });

  it('Run All in Folder calls callback with workflows in folder subtree', () => {
    const onRunAllInFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        onRunAllInFolder={onRunAllInFolder}
      />,
    );
    fireEvent.contextMenu(screen.getByText('Performance'));
    fireEvent.click(screen.getByText(/Run All in Folder \(3\)/));
    expect(onRunAllInFolder).toHaveBeenCalled();
    const arg = onRunAllInFolder.mock.calls[0][0] as Workflow[];
    expect(arg.map((w) => w.id).sort()).toEqual(['w1', 'w2', 'w4']);
  });

  it('shows empty-folder delete confirmation message when folder has no workflows', () => {
    const onDeleteFolder = vi.fn(() => new Set(['f-empty']));
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={[makeFolder({ id: 'f-empty', name: 'Empty' }), ...folders]}
        onDeleteFolder={onDeleteFolder}
      />,
    );
    fireEvent.contextMenu(screen.getByText('Empty'));
    fireEvent.click(screen.getByText('Delete Folder'));
    expect(screen.getByText('Delete empty folder "Empty"?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleteFolder).toHaveBeenCalledWith('f-empty');
  });

  it('shows non-empty folder delete confirmation and moves affected workflows after delete', () => {
    const onDeleteFolder = vi.fn(() => new Set(['f-pay', 'f-perf']));
    const onMoveWorkflowToFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        onDeleteFolder={onDeleteFolder}
        onMoveWorkflowToFolder={onMoveWorkflowToFolder}
      />,
    );
    fireEvent.contextMenu(screen.getByText('Performance'));
    fireEvent.click(screen.getByText('Delete Folder'));
    expect(screen.getByText(/Delete folder "Performance" and move its 3 workflow\(s\) out of the folder/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleteFolder).toHaveBeenCalled();
    expect(onMoveWorkflowToFolder).toHaveBeenCalled();
  });

  // ── Drag and drop ────────────────────────────────────

  it('sets draggable attribute on workflow items', () => {
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onMoveWorkflowToFolder={vi.fn()} />,
    );

    const item = screen.getByText('Order Flow').closest('.wf-sidebar-item');
    expect(item).toHaveAttribute('draggable', 'true');
  });

  it('sets draggable attribute on folder headers', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onMoveFolder={vi.fn()} />);

    const header = screen.getByText('Performance').closest('.wf-folder-header');
    expect(header).toHaveAttribute('draggable', 'true');
  });

  it('applies wf-dragging to dragged folder container', async () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onMoveFolder={vi.fn()} />);
    const perfHeader = screen.getByText('Performance').closest('.wf-folder-header')!;
    const group = perfHeader.closest('.wf-folder-group')!;
    fireEvent.dragStart(perfHeader, { dataTransfer: mockDataTransfer() });
    await waitFor(() => expect(group).toHaveClass('wf-dragging'));
  });

  it('adds wf-drop-inside class on folder header during drag over inside zone', async () => {
    const onMoveWorkflowToFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        onMoveWorkflowToFolder={onMoveWorkflowToFolder}
      />,
    );

    const orderItem = screen.getByText('Health Check').closest('.wf-sidebar-item')!;
    const payHeader = screen.getByText('Payment').closest('.wf-folder-header')!;
    stubRect(payHeader, 40);
    const dt = mockDataTransfer();
    fireEvent.dragStart(orderItem, { dataTransfer: dt });
    await waitFor(() => expect(orderItem).toHaveClass('wf-dragging'));
    fireEvent.dragOver(payHeader, {
      clientY: 20,
      dataTransfer: dt,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(payHeader).toHaveClass('wf-drop-inside');
  });

  it('shows unfiled drop hint when dragging and all workflows are filed', async () => {
    const allFiled = [
      makeWorkflow({ id: 'a', name: 'A', folderId: 'f-perf', folderOrder: 0 }),
      makeWorkflow({ id: 'b', name: 'B', folderId: 'f-perf', folderOrder: 1 }),
    ];
    const onMoveWorkflowToFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={allFiled}
        folders={folders}
        onMoveWorkflowToFolder={onMoveWorkflowToFolder}
      />,
    );
    const wfItem = screen.getByText('A').closest('.wf-sidebar-item')!;
    const dt = mockDataTransfer();
    fireEvent.dragStart(wfItem, { dataTransfer: dt });
    await waitFor(() => expect(wfItem).toHaveClass('wf-dragging'));
    expect(screen.getByText('Drop here')).toBeInTheDocument();
    const zone = screen.getByText('Drop here').closest('.wf-folder-unfiled')!;
    stubRect(zone, 60);
    fireEvent.dragOver(zone, {
      dataTransfer: dt,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(zone).toHaveClass('wf-drop-inside');
  });

  it('highlights root drop zone when workflows exist outside folders and drag is active', async () => {
    const onMoveWorkflowToFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        onMoveWorkflowToFolder={onMoveWorkflowToFolder}
      />,
    );
    const orderItem = screen.getByText('Order Flow').closest('.wf-sidebar-item')!;
    const dt = mockDataTransfer();
    fireEvent.dragStart(orderItem, { dataTransfer: dt });
    await waitFor(() => expect(orderItem).toHaveClass('wf-dragging'));
    const unfiledZone = document.querySelector('.wf-folder-unfiled')!;
    stubRect(unfiledZone, 80);
    fireEvent.dragOver(unfiledZone, {
      clientY: 40,
      dataTransfer: dt,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(unfiledZone).toHaveClass('wf-drop-inside');
  });

  it('applies workflow drop-zone class when hovering another workflow during workflow drag', async () => {
    const onMoveWorkflowToFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        onMoveWorkflowToFolder={onMoveWorkflowToFolder}
      />,
    );
    const w1item = screen.getByText('Order Flow').closest('.wf-sidebar-item')!;
    const w2item = screen.getByText('User Registration').closest('.wf-sidebar-item')!;
    stubRect(w2item, 40);
    const dt = mockDataTransfer();
    fireEvent.dragStart(w1item, { dataTransfer: dt });
    await waitFor(() => expect(w1item).toHaveClass('wf-dragging'));
    fireEvent.dragOver(w2item, {
      clientY: 35,
      dataTransfer: dt,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(w2item.className).toMatch(/wf-drop-(above|below)/);
  });

  // ── Multi-select ─────────────────────────────────────

  it('selects multiple workflows with Ctrl+click', () => {
    const onSelect = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Order Flow'));
    expect(onSelect).toHaveBeenCalledWith('w1');

    fireEvent.click(screen.getByText('Health Check'), { ctrlKey: true });

    const items = screen.getAllByText(
      (_content, el) => el?.classList.contains('wf-sidebar-item') === true && el.classList.contains('wf-multi-selected'),
    );
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('selects multiple workflows with Meta+click (Mac)', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);

    fireEvent.click(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Health Check'), { metaKey: true });

    const checks = document.querySelectorAll('.wf-multi-check.checked');
    expect(checks.length).toBeGreaterThanOrEqual(1);
  });

  it('clears multi-select on plain click', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);

    fireEvent.click(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Health Check'), { ctrlKey: true });
    expect(document.querySelectorAll('.wf-multi-check').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('User Registration'));
    expect(document.querySelectorAll('.wf-multi-check').length).toBe(0);
  });

  it('shows checkboxes when multi-select is active', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);

    expect(document.querySelectorAll('.wf-multi-check').length).toBe(0);

    fireEvent.click(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Health Check'), { ctrlKey: true });

    expect(document.querySelectorAll('.wf-multi-check').length).toBe(workflows.length);
  });

  it('shows bulk context menu when right-clicking multi-selected workflow', () => {
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        selectedId="w1"
        onMoveWorkflowsToFolder={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Health Check'), { ctrlKey: true });

    fireEvent.contextMenu(screen.getByText('Order Flow'));

    expect(screen.getByText('2 workflows selected')).toBeInTheDocument();
    expect(screen.getByText('Delete 2 workflows')).toBeInTheDocument();
  });

  it('shows single context menu when right-clicking non-selected workflow during multi-select', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);

    fireEvent.click(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Health Check'), { ctrlKey: true });

    fireEvent.contextMenu(screen.getByText('User Registration'));

    expect(screen.getByText('Rename Workflow')).toBeInTheDocument();
    expect(screen.queryByText('2 workflows selected')).not.toBeInTheDocument();
  });
});
