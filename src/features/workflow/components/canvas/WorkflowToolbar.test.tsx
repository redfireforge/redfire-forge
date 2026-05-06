/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import WorkflowToolbar from './WorkflowToolbar';
import type { Workflow, WorkflowService } from '../../types/workflow';

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
    onNew: vi.fn(),
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
    const sel = document.querySelector('select.wf-toolbar-select') as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'b' } });
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

  it('renders New button and workflow select when workflows exist', () => {
    const { container } = render(<WorkflowToolbar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /^New$/i })).toBeTruthy();
    expect(container.querySelector('select.wf-toolbar-select')).toBeTruthy();
  });

  it('omits workflow select when no workflows and not in preview', () => {
    const { container } = render(
      <WorkflowToolbar {...defaultProps} workflows={[]} selected={null} />,
    );
    expect(container.querySelector('select.wf-toolbar-select')).toBeNull();
  });

  it('shows preview-only workflow in select when not in workflows list', () => {
    const preview = { ...mockWorkflow, id: 'preview-1', name: 'Preview WF' };
    render(
      <WorkflowToolbar
        {...defaultProps}
        workflows={[]}
        selected={preview}
        isPreview={true}
      />,
    );
    expect(screen.getByRole('option', { name: 'Preview WF' })).toBeTruthy();
  });

  it('disables workflow select in preview mode', () => {
    const { container } = render(<WorkflowToolbar {...defaultProps} isPreview={true} />);
    expect(container.querySelector('select.wf-toolbar-select')).toBeDisabled();
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
});
