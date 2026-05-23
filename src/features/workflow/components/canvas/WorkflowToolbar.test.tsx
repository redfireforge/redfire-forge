/** @vitest-environment jsdom */
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkflowToolbar from './WorkflowToolbar';
import type { Workflow, WorkflowFolder, WorkflowService } from '../../types/workflow';

const mockWorkflow: Workflow = {
  id: 'wf-1',
  name: 'Test Workflow',
  nodes: [],
  edges: [],
  variables: {},
  services: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('WorkflowToolbar', () => {
  const defaultProps = {
    workflows: [mockWorkflow],
    selected: mockWorkflow,
    isRunning: false,
    onSelect: vi.fn(),
    onSave: vi.fn(),
    onQuickTest: vi.fn(),
  };

  it('calls onSelect when workflow selection changes', () => {
    const onSelect = vi.fn();
    const w1 = { ...mockWorkflow, id: 'a', name: 'Workflow A' };
    const w2 = { ...mockWorkflow, id: 'b', name: 'Workflow B' };
    render(
      <WorkflowToolbar
        {...defaultProps}
        workflows={[w1, w2]}
        selected={w1}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId('wf-toolbar-select'));
    fireEvent.click(screen.getByText('Workflow B'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('renders "Run in Harness" button when workflow is selected and callback provided', () => {
    const onRunInHarness = vi.fn();
    render(<WorkflowToolbar {...defaultProps} onRunInHarness={onRunInHarness} />);

    const button = screen.getByRole('button', { name: /run in harness/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('does not render "Run in Harness" button when no callback provided', () => {
    render(<WorkflowToolbar {...defaultProps} />);

    expect(screen.queryByRole('button', { name: /run in harness/i })).not.toBeInTheDocument();
  });

  it('does not render "Run in Harness" button in preview mode', () => {
    const onRunInHarness = vi.fn();
    render(<WorkflowToolbar {...defaultProps} isPreview={true} onRunInHarness={onRunInHarness} />);

    expect(screen.queryByRole('button', { name: /run in harness/i })).not.toBeInTheDocument();
  });

  it('calls onRunInHarness when button is clicked', () => {
    const onRunInHarness = vi.fn();
    render(<WorkflowToolbar {...defaultProps} onRunInHarness={onRunInHarness} />);

    fireEvent.click(screen.getByRole('button', { name: /run in harness/i }));
    expect(onRunInHarness).toHaveBeenCalledTimes(1);
  });

  it('disables "Run in Harness" button when running', () => {
    const onRunInHarness = vi.fn();
    render(<WorkflowToolbar {...defaultProps} isRunning={true} onRunInHarness={onRunInHarness} />);

    expect(screen.getByRole('button', { name: /run in harness/i })).toBeDisabled();
  });

  it('renders workflow select when workflows exist', () => {
    render(<WorkflowToolbar {...defaultProps} />);
    expect(screen.getByTestId('wf-toolbar-select')).toBeTruthy();
  });

  it('omits workflow select when no workflows and not in preview', () => {
    render(
      <WorkflowToolbar {...defaultProps} workflows={[]} selected={null} />,
    );
    expect(screen.queryByTestId('wf-toolbar-select')).toBeNull();
  });

  it('shows preview-only workflow name in dropdown trigger', () => {
    const preview = { ...mockWorkflow, id: 'preview-1', name: 'Preview WF' };
    render(
      <WorkflowToolbar
        {...defaultProps}
        workflows={[]}
        selected={preview}
        isPreview={true}
      />,
    );
    expect(screen.getByText('Preview WF')).toBeTruthy();
  });

  it('keeps workflow select enabled in preview mode to allow switching', () => {
    render(<WorkflowToolbar {...defaultProps} isPreview={true} />);
    expect(screen.getByTestId('wf-toolbar-select')).not.toBeDisabled();
  });

  it('shows service and version badges when counts provided', () => {
    render(
      <WorkflowToolbar {...defaultProps} serviceCount={2} versionCount={3} variableCount={4} />,
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('shows Saved message when saveAcknowledged', () => {
    render(<WorkflowToolbar {...defaultProps} saveAcknowledged={true} />);
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('shows environment warning when readiness not ready', () => {
    const envs = [{ id: 'e1', name: 'Dev' }];
    const services: WorkflowService[] = [{
      id: 's1',
      name: 'API',
      endpoints: [{ envId: 'e1', enabled: true, url: '' }],
    }];
    render(
      <WorkflowToolbar
        {...defaultProps}
        environments={envs}
        selectedEnvId="e1"
        onEnvSelect={vi.fn()}
        workflowServices={services}
      />,
    );
    expect(screen.getByTitle(/Missing config/)).toBeTruthy();
    const envSelect = screen.getByTitle('Select target environment for Quick Test') as HTMLSelectElement;
    const opt = Array.from(envSelect.options).find(o => o.value === 'e1');
    expect(opt?.textContent).toMatch(/missing/);
  });

  it('does not show env warning in dropdown when services are ready', () => {
    const envs = [{ id: 'e1', name: 'Dev' }];
    const services: WorkflowService[] = [{
      id: 's1',
      name: 'API',
      endpoints: [{ envId: 'e1', enabled: true, url: 'https://ok.example.com' }],
    }];
    render(
      <WorkflowToolbar
        {...defaultProps}
        environments={envs}
        selectedEnvId="e1"
        onEnvSelect={vi.fn()}
        workflowServices={services}
      />,
    );
    expect(screen.queryByTitle(/Missing config/)).toBeNull();
  });

  it('hides environment selector in preview mode', () => {
    render(
      <WorkflowToolbar
        {...defaultProps}
        isPreview={true}
        environments={[{ id: 'e1', name: 'Dev' }]}
        selectedEnvId=""
        onEnvSelect={vi.fn()}
      />,
    );
    expect(screen.queryByTitle('Select target environment for Quick Test')).toBeNull();
  });

  it('calls onEnvSelect when environment changes', () => {
    const onEnvSelect = vi.fn();
    render(
      <WorkflowToolbar
        {...defaultProps}
        environments={[{ id: 'e1', name: 'Dev' }]}
        selectedEnvId=""
        onEnvSelect={onEnvSelect}
      />,
    );
    fireEvent.change(screen.getByTitle('Select target environment for Quick Test'), {
      target: { value: 'e1' },
    });
    expect(onEnvSelect).toHaveBeenCalledWith('e1');
  });

  it('shows run progress while running', () => {
    render(
      <WorkflowToolbar
        {...defaultProps}
        isRunning={true}
        runProgress={{
          completed: 1,
          total: 3,
          failed: 0,
          elapsedMs: 5000,
          lastRunStatus: 'running',
        }}
      />,
    );
    expect(screen.getByText(/Step 1\/3/)).toBeTruthy();
  });

  it('shows pass progress and clear button when idle after pass', () => {
    const onReset = vi.fn();
    render(
      <WorkflowToolbar
        {...defaultProps}
        isRunning={false}
        onReset={onReset}
        runProgress={{
          completed: 2,
          total: 2,
          failed: 0,
          elapsedMs: 1000,
          lastRunStatus: 'pass',
        }}
      />,
    );
    expect(screen.getByText(/passed/)).toBeTruthy();
    fireEvent.click(screen.getByTitle('Clear previous run status from all nodes'));
    expect(onReset).toHaveBeenCalled();
  });

  it('shows fail progress with failed count', () => {
    render(
      <WorkflowToolbar
        {...defaultProps}
        isRunning={false}
        runProgress={{
          completed: 2,
          total: 3,
          failed: 1,
          elapsedMs: 1000,
          lastRunStatus: 'fail',
        }}
      />,
    );
    expect(screen.getByText(/1 failed/)).toBeTruthy();
  });

  it('shows fail progress without failed suffix when failed is zero', () => {
    render(
      <WorkflowToolbar
        {...defaultProps}
        isRunning={false}
        runProgress={{
          completed: 3,
          total: 3,
          failed: 0,
          elapsedMs: 1000,
          lastRunStatus: 'fail',
        }}
      />,
    );
    // UI shows (completed - failed) / total → 3/3 when nothing failed
    expect(screen.getByText(/3\/3/)).toBeTruthy();
    expect(screen.queryByText(/failed/)).toBeNull();
  });

  it('run progress running uses zero width bar when total is zero', () => {
    const { container } = render(
      <WorkflowToolbar
        {...defaultProps}
        isRunning
        runProgress={{
          completed: 0,
          total: 0,
          failed: 0,
          elapsedMs: 0,
          lastRunStatus: 'running',
        }}
      />,
    );
    const bar = container.querySelector('.wf-run-progress-bar-running') as HTMLSpanElement;
    expect(bar?.style.width).toBe('0%');
  });

  it('does not show Clear button after pass when onReset omitted', () => {
    render(
      <WorkflowToolbar
        {...defaultProps}
        isRunning={false}
        runProgress={{
          completed: 1,
          total: 1,
          failed: 0,
          elapsedMs: 100,
          lastRunStatus: 'pass',
        }}
      />,
    );
    expect(screen.queryByTitle('Clear previous run status from all nodes')).toBeNull();
  });

  it('shows stopped progress', () => {
    const onReset = vi.fn();
    render(
      <WorkflowToolbar
        {...defaultProps}
        onReset={onReset}
        isRunning={false}
        runProgress={{
          completed: 1,
          total: 2,
          failed: 0,
          elapsedMs: 500,
          lastRunStatus: 'stopped',
        }}
      />,
    );
    expect(screen.getByText(/Stopped by user/)).toBeTruthy();
    fireEvent.click(screen.getByTitle('Clear previous run status from all nodes'));
    expect(onReset).toHaveBeenCalled();
  });

  it('switches Quick Test button to Stop while running', () => {
    render(<WorkflowToolbar {...defaultProps} isRunning={true} />);
    expect(screen.getByRole('button', { name: /Stop/i })).toBeTruthy();
  });

  it('renders Debug controls when onDebugTest provided', () => {
    render(<WorkflowToolbar {...defaultProps} onDebugTest={vi.fn()} />);
    expect(screen.getByTitle('Run workflow step-by-step')).toBeTruthy();
  });

  it('shows Stop Debug when running in debug mode', () => {
    render(
      <WorkflowToolbar {...defaultProps} isRunning={true} isDebugMode={true} onDebugTest={vi.fn()} />,
    );
    expect(screen.getByText(/Stop Debug/)).toBeTruthy();
  });

  describe('workflow dropdown (folders, search, navigation)', () => {
    const folders: WorkflowFolder[] = [
      { id: 'f-root', name: 'Projects', order: 0 },
      { id: 'f-sub', name: 'Alpha', order: 0, parentId: 'f-root' },
      { id: 'f-empty', name: 'Empty Box', order: 1 },
    ];

    const wfInRoot: Workflow = {
      ...mockWorkflow,
      id: 'wf-root',
      name: 'Root Tagged Item',
      folderId: 'f-root',
    };
    const wfInSub: Workflow = {
      ...mockWorkflow,
      id: 'wf-sub',
      name: 'Sub Nested Item',
      folderId: 'f-sub',
    };
    /** Name chosen so search substring tests highlighting. */
    const wfSearchDemo: Workflow = {
      ...mockWorkflow,
      id: 'wf-hl',
      name: 'ZySearchTermZy',
      folderId: 'f-root',
    };
    const wfUnfiled: Workflow = {
      ...mockWorkflow,
      id: 'wf-loose',
      name: 'Surface Unfiled',
    };

    const folderWorkflowProps = {
      workflows: [wfInRoot, wfInSub, wfSearchDemo, wfUnfiled],
      selected: wfInRoot,
      folders,
    };

    const openDropdown = () => {
      fireEvent.click(screen.getByTestId('wf-toolbar-select'));
      const panel = document.querySelector('.wft-dropdown-panel');
      expect(panel).toBeTruthy();
      return panel as HTMLElement;
    };

    /** Accessible name for `.wft-dropdown-folder` rows starts with the folder icon, so avoid `name: /^Foo$/`. */
    const fireClickFolderRow = (folderLabel: string) => {
      const rows = [...document.querySelectorAll<HTMLElement>('.wft-dropdown-folder')];
      const row = rows.find((el) => el.querySelector('.wft-folder-name')?.textContent === folderLabel);
      expect(row, `folder row "${folderLabel}"`).toBeTruthy();
      fireEvent.click(row!);
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('opens dropdown and shows panel; second toggle click closes', () => {
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} />);
      expect(document.querySelector('.wft-dropdown-panel')).toBeNull();
      openDropdown();
      expect(document.querySelector('.wft-dropdown-panel')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('wf-toolbar-select'));
      expect(document.querySelector('.wft-dropdown-panel')).toBeNull();
    });

    it('does not open dropdown when toolbar isRunning', () => {
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} isRunning />);
      fireEvent.click(screen.getByTestId('wf-toolbar-select'));
      expect(document.querySelector('.wft-dropdown-panel')).toBeNull();
    });

    it('closes dropdown and clears navigation when backdrop is clicked', () => {
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} />);
      openDropdown();
      fireClickFolderRow('Projects');

      fireEvent.click(document.querySelector('.wft-dropdown-backdrop') as HTMLElement);
      expect(document.querySelector('.wft-dropdown-panel')).toBeNull();

      openDropdown();
      expect((screen.getByPlaceholderText('Search workflows…') as HTMLInputElement).value).toBe('');
    });

    it('closes dropdown on mousedown outside the dropdown wrap', () => {
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} />);
      openDropdown();

      const outsider = document.createElement('div');
      document.body.appendChild(outsider);
      fireEvent.mouseDown(outsider);
      outsider.remove();

      expect(document.querySelector('.wft-dropdown-panel')).toBeNull();
    });

    it('filters root list by search and shows breadcrumb hints for filed workflows', () => {
      const onSelect = vi.fn();
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} onSelect={onSelect} />);
      openDropdown();

      fireEvent.change(screen.getByPlaceholderText('Search workflows…'), { target: { value: 'sub' } });
      const searchBtn = screen.getByRole('button', { name: /Sub Nested Item/i });
      expect(searchBtn).toHaveClass('wft-dropdown-item-search');
      expect(within(searchBtn).getByText(/Projects \/ Alpha/i)).toBeInTheDocument();

      fireEvent.click(searchBtn);
      expect(onSelect).toHaveBeenCalledWith('wf-sub');
      expect(document.querySelector('.wft-dropdown-panel')).toBeNull();
    });

    it('shows empty-search state and clears query via ×', () => {
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} />);
      openDropdown();

      fireEvent.change(screen.getByPlaceholderText('Search workflows…'), { target: { value: 'no-such-workflow-xyz' } });
      expect(screen.getByText(/No workflows match/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '×' }));
      expect((screen.getByPlaceholderText('Search workflows…') as HTMLInputElement).value).toBe('');
      expect(screen.queryByText(/No workflows match/)).not.toBeInTheDocument();
    });

    it('wraps matching search substring in highlight mark', () => {
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} />);
      openDropdown();

      fireEvent.change(screen.getByPlaceholderText('Search workflows…'), { target: { value: 'SearchTerm' } });
      const mark = document.querySelector('.wft-search-highlight');
      expect(mark?.textContent).toBe('SearchTerm');
      expect(mark?.closest('.wft-item-name')).toHaveTextContent('ZySearchTermZy');
    });

    it('shows folder workflow counts at root using recursive totals', () => {
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} />);
      openDropdown();

      const projectsBtn = screen.getByRole('button', { name: /Projects/i });
      /** Root folder holds wfInRoot + wfSearchDemo plus wfInSub under Alpha → count 3. */
      expect(projectsBtn).toHaveTextContent('(3)');
      const emptyBtn = screen.getByRole('button', { name: /Empty Box/i });
      expect(emptyBtn).toHaveTextContent('(0)');
    });

    it('navigates into folders, lists workflows and subfolders, and shows breadcrumbs', () => {
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} />);
      openDropdown();

      fireClickFolderRow('Projects');

      expect(screen.getByRole('button', { name: /Alpha/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Root Tagged Item$/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^ZySearchTermZy$/ })).toBeInTheDocument();

      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toHaveClass('wft-breadcrumb-current');

      fireClickFolderRow('Alpha');
      expect(screen.getByRole('button', { name: /^Sub Nested Item$/ })).toBeInTheDocument();
      expect(screen.getByText('Alpha')).toHaveClass('wft-breadcrumb-current');
      expect(screen.getByText('Projects')).toHaveClass('wft-breadcrumb-seg');

      /** Back pops to Projects. */
      fireEvent.click(screen.getByRole('button', { name: '←' }));
      expect(screen.getByRole('button', { name: /Alpha/i })).toBeInTheDocument();

      /** "All" returns to browser root listing. */
      fireEvent.click(screen.getByText('All'));
      expect(screen.getAllByRole('button', { name: /Projects/i }).some(btn => btn.classList.contains('wft-dropdown-folder'))).toBe(true);
      expect(screen.getByRole('button', { name: /^Surface Unfiled$/ })).toBeInTheDocument();
    });

    it('shows empty-folder message inside a folder with no workflows or children', () => {
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} />);
      openDropdown();

      fireClickFolderRow('Empty Box');
      expect(screen.getByText('Empty folder')).toBeInTheDocument();
    });

    it('typing in search resets folder navigation from inside a folder', () => {
      render(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} />);
      openDropdown();

      fireClickFolderRow('Projects');
      expect(screen.queryByPlaceholderText('Search workflows…')).toBeTruthy();

      fireEvent.change(screen.getByPlaceholderText('Search workflows…'), { target: { value: 'x' } });
      expect(screen.queryByText('All')).not.toBeInTheDocument();

      /** Search mode (nav cleared — no crumb "All"); query "surf" surfaces unfiled workflow. */

      fireEvent.change(screen.getByPlaceholderText('Search workflows…'), { target: { value: 'surf' } });
      expect(screen.getByRole('button', { name: /Surface Unfiled/i })).toBeInTheDocument();
    });

    it('nested folder workflow row is active when selected and selects via nested list handler', () => {
      const onSel = vi.fn();
      const view = render(
        <WorkflowToolbar {...defaultProps} {...folderWorkflowProps} onSelect={onSel} selected={wfInSub} />,
      );
      openDropdown();
      fireClickFolderRow('Projects');
      fireClickFolderRow('Alpha');
      expect(screen.getByRole('button', { name: /^Sub Nested Item$/ })).toHaveClass('active');

      view.rerender(<WorkflowToolbar {...defaultProps} {...folderWorkflowProps} onSelect={onSel} selected={wfInRoot} />);
      fireEvent.click(screen.getByRole('button', { name: /^Sub Nested Item$/ }));
      expect(onSel).toHaveBeenCalledWith('wf-sub');
      expect(document.querySelector('.wft-dropdown-panel')).toBeNull();
    });
  });

});
