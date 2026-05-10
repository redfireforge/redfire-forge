/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowSidebar from './WorkflowSidebar';
import type { Workflow, WorkflowFolder } from '../../types/workflow';

const ts = Date.now();

/** jsdom lacks DataTransfer — minimal stub for drag events */
function mockDataTransfer(): DataTransfer {
  const data = new Map<string, string>();
  let dropEffect = 'none';
  return {
    effectAllowed: 'all',
    get dropEffect() {
      return dropEffect;
    },
    set dropEffect(v: string) {
      dropEffect = v;
    },
    setData: (k: string, v: string) => {
      data.set(k, v);
    },
    getData: (k: string) => data.get(k) ?? '',
    clear: () => {
      data.clear();
    },
  } as unknown as DataTransfer;
}

const makeWorkflow = (overrides: Partial<Workflow> & { id: string; name: string }): Workflow =>
  ({
    variables: {},
    nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Step' } }],
    edges: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }) as Workflow;

const makeFolder = (overrides: Partial<WorkflowFolder> & { id: string; name: string }): WorkflowFolder => ({
  order: 0,
  ...overrides,
});

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

  it('renders folder tree with nested folders and workflows', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);

    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Payment')).toBeInTheDocument();
    expect(screen.getByText('Order Flow')).toBeInTheDocument();
    expect(screen.getByText('User Registration')).toBeInTheDocument();
    expect(screen.getByText('Stripe Payment')).toBeInTheDocument();
  });

  it('shows expanded folder arrow ▾ when not collapsed', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);
    const perfHeader = screen.getByText('Performance').closest('.wf-folder-header');
    const arrow = perfHeader?.querySelector('.wf-folder-arrow');
    expect(arrow?.textContent).toBe('▾');
  });

  it('shows collapsed folder arrow ▸ when collapsed', () => {
    const collapsedFolders = folders.map((f) => ({ ...f, collapsed: true }));
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={collapsedFolders} />);
    const perfHeader = screen.getByText('Performance').closest('.wf-folder-header');
    expect(perfHeader?.querySelector('.wf-folder-arrow')?.textContent).toBe('▸');
  });

  it('renders unfiled workflows at the bottom', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);

    expect(screen.getByText('Unfiled')).toBeInTheDocument();
    expect(screen.getByText('Health Check')).toBeInTheDocument();
  });

  it('renders flat list when no folders exist', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);

    expect(screen.getByText('Order Flow')).toBeInTheDocument();
    expect(screen.getByText('Health Check')).toBeInTheDocument();
    expect(screen.queryByText('Unfiled')).not.toBeInTheDocument();
  });

  it('shows unfiled workflows in flat mode when folders not loaded but folders empty', () => {
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} foldersLoaded={false} />,
    );
    expect(screen.getByText('Health Check')).toBeInTheDocument();
    expect(screen.queryByText('Unfiled')).not.toBeInTheDocument();
  });

  it('renders empty state when no workflows', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={[]} folders={[]} />);

    expect(screen.getByText(/No workflows yet/)).toBeInTheDocument();
  });

  it('selects a workflow on click', () => {
    const onSelect = vi.fn();
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByText('Order Flow'));
    expect(onSelect).toHaveBeenCalledWith('w1');
  });

  it('highlights the selected workflow', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} selectedId="w1" />);

    const item = screen.getByText('Order Flow').closest('.wf-sidebar-item');
    expect(item).toHaveClass('active');
  });

  // ── Search ───────────────────────────────────────────

  it('renders search input when workflows exist', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);

    expect(screen.getByTestId('wf-sidebar-search')).toBeInTheDocument();
  });

  it('does not render search input when no workflows', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={[]} folders={[]} />);

    expect(screen.queryByTestId('wf-sidebar-search')).not.toBeInTheDocument();
  });

  it('filters workflows by name on search input', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);

    const searchInput = screen.getByTestId('wf-sidebar-search');
    fireEvent.change(searchInput, { target: { value: 'order' } });

    expect(
      screen.getByText((_content, el) => el?.classList.contains('wf-sidebar-item-name') === true && el.textContent === 'Order Flow'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Health Check')).not.toBeInTheDocument();
    expect(screen.queryByText('Stripe Payment')).not.toBeInTheDocument();
  });

  it('wraps matching substring in search results with highlight mark', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);
    fireEvent.change(screen.getByTestId('wf-sidebar-search'), { target: { value: 'Ord' } });
    expect(document.querySelector('.wf-search-highlight')?.textContent).toBe('Ord');
  });

  it('shows breadcrumb path when searching', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);

    const searchInput = screen.getByTestId('wf-sidebar-search');
    fireEvent.change(searchInput, { target: { value: 'stripe' } });

    expect(screen.getByText('Performance / Payment')).toBeInTheDocument();
  });

  it('shows no-results message for unmatched search', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);

    const searchInput = screen.getByTestId('wf-sidebar-search');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText(/No workflows match/)).toBeInTheDocument();
  });

  it('selects workflow from search result on click', () => {
    const onSelect = vi.fn();
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onSelect={onSelect} />,
    );
    fireEvent.change(screen.getByTestId('wf-sidebar-search'), { target: { value: 'health' } });
    const row = document.querySelector('.wf-search-result-item');
    fireEvent.click(row as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith('w3');
  });

  it('shows clear button when search has text', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);

    const searchInput = screen.getByTestId('wf-sidebar-search');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    const clearBtn = screen.getByTitle('Clear search');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  it('shows breadcrumb "Unfiled" for unfiled workflows during search', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);

    const searchInput = screen.getByTestId('wf-sidebar-search');
    fireEvent.change(searchInput, { target: { value: 'health' } });

    expect(
      screen.getByText(
        (_content, el) => el?.classList.contains('wf-sidebar-item-name') === true && el.textContent === 'Health Check',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Unfiled')).toBeInTheDocument();
  });

  // ── Folder collapse ─────────────────────────────────

  it('calls onToggleFolderCollapse when folder header is clicked', () => {
    const onToggleFolderCollapse = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        onToggleFolderCollapse={onToggleFolderCollapse}
      />,
    );

    const perfHeader = screen.getByText('Performance').closest('.wf-folder-header');
    if (perfHeader) fireEvent.click(perfHeader);

    expect(onToggleFolderCollapse).toHaveBeenCalledWith('f-perf');
  });

  it('hides folder children when collapsed', () => {
    const collapsedFolders = folders.map((f) => (f.id === 'f-perf' ? { ...f, collapsed: true } : f));

    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={collapsedFolders} />);

    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.queryByText('Order Flow')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment')).not.toBeInTheDocument();
  });

  // ── Sort ─────────────────────────────────────────────

  it('cycles sort button through none → asc → desc titles and glyph', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);
    const sortBtn = screen.getByTestId('wf-sidebar-sort');
    expect(sortBtn).toHaveAttribute('title', 'Sort A–Z');
    fireEvent.click(sortBtn);
    expect(sortBtn).toHaveAttribute('title', 'Sort Z–A');
    expect(sortBtn.textContent).toBe('↑');
    fireEvent.click(sortBtn);
    expect(sortBtn).toHaveAttribute('title', 'Clear sort');
    expect(sortBtn.textContent).toBe('↓');
    fireEvent.click(sortBtn);
    expect(sortBtn).toHaveAttribute('title', 'Sort A–Z');
    expect(sortBtn.textContent).toBe('↕');
  });

  it('sorts unfiled workflows alphabetically ascending when asc is active', () => {
    const many = [
      makeWorkflow({ id: 'u1', name: 'Zebra' }),
      makeWorkflow({ id: 'u2', name: 'Alpha' }),
    ];
    render(<WorkflowSidebar {...defaultProps} workflows={many} folders={folders} />);
    fireEvent.click(screen.getByTestId('wf-sidebar-sort')); // asc
    const unfiled = screen.getByText('Unfiled').closest('.wf-folder-unfiled');
    const names = within(unfiled!).getAllByText((_c, el) => el?.classList.contains('wf-sidebar-item-name') ?? false);
    expect(names.map((n) => n.textContent)).toEqual(['Alpha', 'Zebra']);
  });

  it('sorts workflows descending when sort is in desc mode', () => {
    const many = [
      makeWorkflow({ id: 'u1', name: 'Zebra' }),
      makeWorkflow({ id: 'u2', name: 'Alpha' }),
    ];
    render(<WorkflowSidebar {...defaultProps} workflows={many} folders={folders} />);
    fireEvent.click(screen.getByTestId('wf-sidebar-sort'));
    fireEvent.click(screen.getByTestId('wf-sidebar-sort'));
    const unfiled = screen.getByText('Unfiled').closest('.wf-folder-unfiled');
    const names = within(unfiled!).getAllByText((_c, el) => el?.classList.contains('wf-sidebar-item-name') ?? false);
    expect(names.map((n) => n.textContent)).toEqual(['Zebra', 'Alpha']);
  });

  it('marks sort button active when sort is enabled', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} />);
    const sortBtn = screen.getByTestId('wf-sidebar-sort');
    fireEvent.click(sortBtn);
    expect(sortBtn).toHaveClass('active');
  });

  it('sorts sibling root folders when sort ascending', () => {
    const fApple = makeFolder({ id: 'f-apple', name: 'Apple', order: 0 });
    const fZebra = makeFolder({ id: 'f-zebra', name: 'Zebra', order: 1 });
    const multiRootWorkflows = [
      makeWorkflow({ id: 'w-a', name: 'In Zebra', folderId: 'f-zebra', folderOrder: 0 }),
      makeWorkflow({ id: 'w-b', name: 'In Apple', folderId: 'f-apple', folderOrder: 0 }),
    ];
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={multiRootWorkflows}
        folders={[fApple, fZebra]}
      />,
    );
    fireEvent.click(screen.getByTestId('wf-sidebar-sort')); // asc
    const roots = [...document.querySelectorAll('.wf-folder-header > .wf-folder-name')]
      .map((el) => el.textContent);
    expect(roots).toEqual(['Apple', 'Zebra']);
  });

  // ── New button & dialogs ───────────────────────────────

  it('shows new menu with folder option when onCreateFolder is provided', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onCreateFolder={vi.fn()} />);

    fireEvent.click(screen.getByText('+ New'));
    expect(screen.getByText('Blank Workflow')).toBeInTheDocument();
    expect(screen.getByText('From Template')).toBeInTheDocument();
    expect(screen.getByText('New Folder')).toBeInTheDocument();
  });

  it('calls onBrowseTemplates from new menu', () => {
    const onBrowseTemplates = vi.fn();
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onBrowseTemplates={onBrowseTemplates} />,
    );
    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('From Template'));
    expect(onBrowseTemplates).toHaveBeenCalled();
  });

  it('creates blank workflow via dialog with Create button', () => {
    const onNew = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onNew={onNew} />);
    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('Blank Workflow'));
    const input = screen.getByPlaceholderText('Workflow name');
    fireEvent.change(input, { target: { value: 'My New Flow' } });
    fireEvent.click(screen.getByText('Create'));
    expect(onNew).toHaveBeenCalledWith('My New Flow');
  });

  it('creates blank workflow via dialog Enter key', () => {
    const onNew = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onNew={onNew} />);
    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('Blank Workflow'));
    const input = screen.getByPlaceholderText('Workflow name');
    fireEvent.change(input, { target: { value: 'Enter Flow' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNew).toHaveBeenCalledWith('Enter Flow');
  });

  it('closes create workflow dialog with Escape', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);
    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('Blank Workflow'));
    fireEvent.keyDown(screen.getByPlaceholderText('Workflow name'), { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Workflow name')).not.toBeInTheDocument();
  });

  it('closes create workflow dialog with Cancel and overlay clicks', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);
    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('Blank Workflow'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('Workflow name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('Blank Workflow'));
    fireEvent.click(document.querySelector('.req-confirm-overlay') as HTMLElement);
    expect(screen.queryByPlaceholderText('Workflow name')).not.toBeInTheDocument();
  });

  it('does not call onNew when create workflow dialog has empty trimmed name', () => {
    const onNew = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onNew={onNew} />);
    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('Blank Workflow'));
    fireEvent.click(screen.getByRole('button', { name: /^Create$/ }));
    expect(onNew).not.toHaveBeenCalled();
  });

  it('closes + New dropdown on Escape without opening dialogs', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);
    fireEvent.click(screen.getByText('+ New'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Blank Workflow')).not.toBeInTheDocument();
  });

  it('opens root folder create dialog from + New menu', () => {
    const onCreateFolder = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onCreateFolder={onCreateFolder} />);
    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('New Folder'));
    expect(screen.getByText('New folder')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Folder name'), { target: { value: 'Alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/ }));
    expect(onCreateFolder).toHaveBeenCalledWith('Alpha', undefined);
  });

  it('closes folder dialog with Escape/Cancel/Cancel-overlay and submits with Enter', () => {
    const onCreateFolder = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onCreateFolder={onCreateFolder} />);
    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('New Folder'));
    fireEvent.keyDown(screen.getByPlaceholderText('Folder name'), { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Folder name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('New Folder'));
    fireEvent.click(within(screen.getByText('New folder').closest('.req-confirm-dialog') as HTMLElement).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('Folder name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('New Folder'));
    fireEvent.click(document.querySelector('.req-confirm-overlay') as HTMLElement);
    expect(screen.queryByPlaceholderText('Folder name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('+ New'));
    fireEvent.click(screen.getByText('New Folder'));
    fireEvent.change(screen.getByPlaceholderText('Folder name'), { target: { value: 'EnterFolder' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Folder name'), { key: 'Enter' });
    expect(onCreateFolder).toHaveBeenCalledWith('EnterFolder', undefined);
  });

  it('closes new menu when clicking outside', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);
    fireEvent.click(screen.getByText('+ New'));
    expect(screen.getByText('Blank Workflow')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Blank Workflow')).not.toBeInTheDocument();
  });

  // ── Context menu (workflow) ─────────────────────────────

  it('shows workflow context menu on right-click', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);

    const item = screen.getByText('Order Flow');
    fireEvent.contextMenu(item);

    expect(screen.getByText('Rename Workflow')).toBeInTheDocument();
    expect(screen.getByText('Delete Workflow')).toBeInTheDocument();
    expect(screen.getByText('Duplicate Workflow')).toBeInTheDocument();
  });

  it('closes workflow context menu on Escape', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    expect(screen.getByText('Rename Workflow')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Rename Workflow')).not.toBeInTheDocument();
  });

  it('shows Export and Import in workflow menu when callbacks provided', () => {
    const onExport = vi.fn();
    const onImport = vi.fn();
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onExport={onExport} onImport={onImport} />,
    );
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Export Workflow'));
    expect(onExport).toHaveBeenCalledWith('w1');
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Import Workflow'));
    expect(onImport).toHaveBeenCalled();
  });

  it('closes rename workflow dialog with Escape/Cancel/Cancel-overlay and submits with Enter', () => {
    const onRename = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onRename={onRename} />);
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Rename Workflow'));

    let overlay = document.querySelector('.req-confirm-overlay')!;
    fireEvent.keyDown(within(overlay as HTMLElement).getByDisplayValue('Order Flow'), { key: 'Escape' });
    expect(screen.queryByText('Rename workflow')).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Rename Workflow'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Rename workflow')).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Rename Workflow'));
    overlay = document.querySelector('.req-confirm-overlay')!;
    fireEvent.click(overlay);
    expect(screen.queryByText('Rename workflow')).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Rename Workflow'));
    const renameInput = within(document.querySelector('.req-confirm-overlay') as HTMLElement).getByDisplayValue('Order Flow');
    fireEvent.change(renameInput, { target: { value: 'Keyed' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('w1', 'Keyed');
  });

  it('does not call onRename when workflow rename submits empty trimmed name via Rename button', () => {
    const onRename = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onRename={onRename} />);
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Rename Workflow'));
    const renameInput = within(document.querySelector('.req-confirm-overlay') as HTMLElement).getByDisplayValue('Order Flow');
    fireEvent.change(renameInput, { target: { value: ' \t \n ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(onRename).not.toHaveBeenCalled();
  });

  it('does not rename when workflow rename Enter key with empty trimmed name', () => {
    const onRename = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onRename={onRename} />);
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Rename Workflow'));
    const renameInput = within(document.querySelector('.req-confirm-overlay') as HTMLElement).getByDisplayValue('Order Flow');
    fireEvent.change(renameInput, { target: { value: '   ' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
  });

  it('duplicates workflow from context menu', () => {
    const onDuplicate = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onDuplicate={onDuplicate} />);
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Duplicate Workflow'));
    expect(onDuplicate).toHaveBeenCalledWith('w1');
  });

  it('opens move submenu and moves workflow to folder from context menu', () => {
    const onMoveWorkflowToFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        onMoveWorkflowToFolder={onMoveWorkflowToFolder}
      />,
    );
    fireEvent.contextMenu(screen.getByText('Health Check'));
    fireEvent.click(screen.getByText(/Move to Folder/));
    fireEvent.click(screen.getByRole('menuitem', { name: '📁 Performance' }));
    expect(onMoveWorkflowToFolder).toHaveBeenCalledWith('w3', 'f-perf');
  });

  it('toggles workflow move submenu closed on second toggle click', () => {
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onMoveWorkflowToFolder={vi.fn()} />,
    );
    fireEvent.contextMenu(screen.getByText('Health Check'));
    const moveBtn = screen.getByText(/Move to Folder/);
    fireEvent.click(moveBtn);
    expect(screen.getByRole('menuitem', { name: '📁 Performance' })).toBeInTheDocument();
    fireEvent.click(moveBtn);
    expect(screen.queryByRole('menuitem', { name: '📁 Performance' })).not.toBeInTheDocument();
  });

  it('moves bulk selection via context submenu when onMoveWorkflowsToFolder is set', () => {
    const onMoveWorkflowsToFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        selectedId="w1"
        onMoveWorkflowsToFolder={onMoveWorkflowsToFolder}
      />,
    );
    fireEvent.click(screen.getByText('Health Check'), { ctrlKey: true });
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText(/Move 2 workflows/));
    fireEvent.click(screen.getByRole('menuitem', { name: '📁 Performance' }));
    expect(onMoveWorkflowsToFolder).toHaveBeenCalledWith(expect.arrayContaining(['w1', 'w3']), 'f-perf');
  });

  it('bulk moves workflows to Unfiled from submenu', () => {
    const onMoveWorkflowsToFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        selectedId="w1"
        onMoveWorkflowsToFolder={onMoveWorkflowsToFolder}
      />,
    );
    fireEvent.click(screen.getByText('User Registration'), { ctrlKey: true });
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText(/Move 2 workflows/));
    fireEvent.click(screen.getByRole('menuitem', { name: /Move to Unfiled/ }));
    expect(onMoveWorkflowsToFolder).toHaveBeenCalledWith(expect.arrayContaining(['w1', 'w2']), null);
  });

  it('does not render move submenu when foldersLoaded is false', () => {
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        foldersLoaded={false}
        onMoveWorkflowToFolder={vi.fn()}
      />,
    );
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    expect(screen.queryByText(/Move to Folder/)).not.toBeInTheDocument();
  });

  it('confirms bulk delete from context menu', () => {
    const onDelete = vi.fn();
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onDelete={onDelete} selectedId="w1" />,
    );
    fireEvent.click(screen.getByText('Health Check'), { ctrlKey: true });
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Delete 2 workflows'));
    expect(screen.getByText(/Delete 2 selected workflows/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  it('opens single-delete confirm from workflow context menu', () => {
    const onDelete = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onDelete={onDelete} />);
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Delete Workflow'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('w1');
  });

  it('closes delete confirm with Cancel and dismisses overlay without deleting', () => {
    const onDelete = vi.fn();
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} onDelete={onDelete} />);
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Delete Workflow'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText('Delete Workflow'));
    fireEvent.click(document.querySelector('.req-confirm-overlay') as HTMLElement);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('closes workflow context menu when clicking backdrop', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    expect(screen.getByText('Rename Workflow')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.wf-sidebar-ctx-backdrop') as HTMLElement);
    expect(screen.queryByText('Rename Workflow')).not.toBeInTheDocument();
  });

  it('closes workflow context menu on window resize', async () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} />);
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.queryByText('Rename Workflow')).not.toBeInTheDocument();
  });

  it('falls back to onMoveWorkflowToFolder when bulk move has no onMoveWorkflowsToFolder', () => {
    const onMoveWorkflowToFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        selectedId="w1"
        onMoveWorkflowToFolder={onMoveWorkflowToFolder}
      />,
    );
    fireEvent.click(screen.getByText('Health Check'), { ctrlKey: true });
    fireEvent.contextMenu(screen.getByText('Order Flow'));
    fireEvent.click(screen.getByText(/Move 2 workflows/));
    fireEvent.click(screen.getByRole('menuitem', { name: '📁 Performance' }));
    expect(onMoveWorkflowToFolder).toHaveBeenCalledWith('w1', 'f-perf');
  });

  it('shows drag count badge when dragging multi-selection', () => {
    render(<WorkflowSidebar {...defaultProps} workflows={workflows} folders={[]} selectedId="w1" />);
    fireEvent.click(screen.getByText('Health Check'), { ctrlKey: true });
    const orderItem = screen.getByText('Order Flow').closest('.wf-sidebar-item')!;
    fireEvent.dragStart(orderItem, { dataTransfer: mockDataTransfer() });
    expect(within(orderItem).getByText('2')).toHaveClass('wf-drag-count');
  });

  it('marks active search row when workflow is selected', () => {
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} selectedId="w3" />,
    );
    fireEvent.change(screen.getByTestId('wf-sidebar-search'), { target: { value: 'health' } });
    const row = document.querySelector('.wf-search-result-item');
    expect(row).toHaveClass('active');
  });

  // ── Context menu (folder) ────────────────────────────

  it('shows folder context menu on right-click', () => {
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onCreateFolder={vi.fn()}
      />,
    );

    const folderHeader = screen.getByText('Performance');
    fireEvent.contextMenu(folderHeader);

    expect(screen.getByText('Rename Folder')).toBeInTheDocument();
    expect(screen.getByText('Delete Folder')).toBeInTheDocument();
    expect(screen.getByText('New Sub-Folder')).toBeInTheDocument();
  });

  it('opens inline folder rename via context Rename Folder', () => {
    const onRenameFolder = vi.fn();
    render(
      <WorkflowSidebar
        {...defaultProps}
        workflows={workflows}
        folders={folders}
        onRenameFolder={onRenameFolder}
      />,
    );
    fireEvent.contextMenu(screen.getByText('Performance'));
    fireEvent.click(screen.getByText('Rename Folder'));
    const input = screen.getByDisplayValue('Performance');
    fireEvent.change(input, { target: { value: 'Perf2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameFolder).toHaveBeenCalledWith('f-perf', 'Perf2');
  });

  it('inline folder rename on blur submits when changed', () => {
    const onRenameFolder = vi.fn();
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onRenameFolder={onRenameFolder} />,
    );
    fireEvent.doubleClick(screen.getByText('Performance'));
    const input = screen.getByDisplayValue('Performance');
    fireEvent.change(input, { target: { value: 'Blur Name' } });
    fireEvent.blur(input);
    expect(onRenameFolder).toHaveBeenCalledWith('f-perf', 'Blur Name');
  });

  it('cancels inline folder rename with Escape', () => {
    const onRenameFolder = vi.fn();
    render(
      <WorkflowSidebar {...defaultProps} workflows={workflows} folders={folders} onRenameFolder={onRenameFolder} />,
    );
    fireEvent.doubleClick(screen.getByText('Performance'));
    const input = screen.getByDisplayValue('Performance');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRenameFolder).not.toHaveBeenCalled();
    expect(screen.getByText('Performance')).toBeInTheDocument();
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
    expect(screen.getByText(/Delete folder "Performance" and move its 3 workflow\(s\) to Unfiled/)).toBeInTheDocument();
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
    expect(screen.getByText('Drop here for Unfiled')).toBeInTheDocument();
    const zone = screen.getByText('Drop here for Unfiled').closest('.wf-folder-unfiled')!;
    stubRect(zone, 60);
    fireEvent.dragOver(zone, {
      dataTransfer: dt,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(zone).toHaveClass('wf-drop-inside');
  });

  it('highlights Unfiled drop zone when workflows exist in Unfiled and drag is active', async () => {
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
    const unfiled = screen.getByText('Unfiled').closest('.wf-folder-unfiled')!;
    stubRect(unfiled, 80);
    fireEvent.dragOver(unfiled, {
      clientY: 40,
      dataTransfer: dt,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(unfiled).toHaveClass('wf-drop-inside');
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
