/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowPicker from './WorkflowPicker';
import type { Workflow, WorkflowFolder } from '../../workflow/types/workflow';
import { createPerfSimpleWorkflow } from '../../../data/galleries/workflows';

const ts = Date.now();

const manyHttpWorkflow: Workflow = {
  id: 'wf-many-http',
  name: 'Many HTTP',
  variables: { v: '1' },
  nodes: Array.from({ length: 6 }, (_, i) => ({
    id: `h${i}`,
    type: 'http' as const,
    position: { x: 0, y: i * 40 },
    data: { label: `Step${i}` },
  })),
  edges: [],
  createdAt: ts,
  updatedAt: ts,
};

const noHttpWorkflow: Workflow = {
  id: 'wf-no-http',
  name: 'No HTTP',
  variables: { only: 'x' },
  nodes: [
    { id: 's1', type: 'start', position: { x: 0, y: 0 }, data: {} },
    { id: 'e1', type: 'end', position: { x: 0, y: 100 }, data: {} },
  ],
  edges: [],
  createdAt: ts,
  updatedAt: ts,
};

const defaultLabelHttpWorkflow: Workflow = {
  id: 'wf-default-http-label',
  name: 'Default HTTP label',
  variables: {},
  nodes: [
    { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: '' } },
  ],
  edges: [],
  createdAt: ts,
  updatedAt: ts,
};

const extendedWorkflows: Workflow[] = [
  ...[
    {
      id: 'wf1',
      name: 'Order API Flow',
      variables: { baseUrl: 'https://api.example.com', apiKey: 'sk-test' },
      nodes: [
        { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Create Order' } },
        { id: 'n2', type: 'http', position: { x: 0, y: 100 }, data: { label: 'Get Order' } },
        { id: 'n3', type: 'condition', position: { x: 0, y: 200 }, data: {} },
      ],
      edges: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'wf2',
      name: 'User Registration',
      variables: {},
      nodes: [
        { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Register' } },
      ],
      edges: [],
      createdAt: ts,
      updatedAt: ts,
    },
  ],
  manyHttpWorkflow,
  noHttpWorkflow,
  defaultLabelHttpWorkflow,
] as Workflow[];

const mockWorkflows: Workflow[] = extendedWorkflows.slice(0, 2);

describe('WorkflowPicker', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders empty state when no workflows', () => {
    render(
      <WorkflowPicker
        workflows={[]}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText('No workflows available')).toBeInTheDocument();
    expect(screen.getByText(/Create a workflow in the Workflow Designer/)).toBeInTheDocument();
  });

  it('renders workflow dropdown with options', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText('Select a workflow…')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('workflow-select'));
    expect(screen.getByText('Order API Flow')).toBeInTheDocument();
    expect(screen.getByText('User Registration')).toBeInTheDocument();
  });

  it('calls onWorkflowChange when workflow selected', () => {
    const onWorkflowChange = vi.fn();
    const onVariablesChange = vi.fn();

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={onWorkflowChange}
        variables={{}}
        onVariablesChange={onVariablesChange}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    fireEvent.click(screen.getByText('Order API Flow'));

    expect(onWorkflowChange).toHaveBeenCalledWith('wf1');
    expect(onVariablesChange).toHaveBeenCalledWith({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test',
    });
  });

  it('shows workflow summary when selected', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText('2 HTTP steps')).toBeInTheDocument();
    expect(screen.getByText('Create Order → Get Order')).toBeInTheDocument();
  });

  it('shows variable inputs when workflow selected', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText('Initial Variables')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://api.example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sk-test')).toBeInTheDocument();
  });

  it('updates variables on input change', () => {
    const onVariablesChange = vi.fn();

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={onVariablesChange}
      />
    );

    const input = screen.getByDisplayValue('https://api.example.com');
    fireEvent.change(input, { target: { value: 'https://staging.example.com' } });

    expect(onVariablesChange).toHaveBeenCalledWith({
      baseUrl: 'https://staging.example.com',
      apiKey: 'sk-test',
    });
  });

  it('shows modified badge when variables differ from defaults', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://modified.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText('Modified')).toBeInTheDocument();
  });

  it('shows Reset button when variables modified', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://modified.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('resets variables to defaults on Reset click', () => {
    const onVariablesChange = vi.fn();

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://modified.example.com', apiKey: 'changed' }}
        onVariablesChange={onVariablesChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(onVariablesChange).toHaveBeenCalledWith({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test',
    });
  });

  it('clears selection on Clear click', () => {
    const onWorkflowChange = vi.fn();
    const onVariablesChange = vi.fn();

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={onWorkflowChange}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={onVariablesChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onWorkflowChange).toHaveBeenCalledWith(null);
    expect(onVariablesChange).toHaveBeenCalledWith({});
  });

  it('clears selection via Clear button', () => {
    const onWorkflowChange = vi.fn();
    const onVariablesChange = vi.fn();

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={onWorkflowChange}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={onVariablesChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onWorkflowChange).toHaveBeenCalledWith(null);
    expect(onVariablesChange).toHaveBeenCalledWith({});
  });

  it('shows empty variables message when workflow has no variables', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf2"
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText('This workflow has no defined variables.')).toBeInTheDocument();
  });

  it('disables inputs when disabled prop is true', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
        disabled
      />
    );

    expect(screen.getByTestId('workflow-select')).toBeDisabled();
    expect(screen.getByDisplayValue('https://api.example.com')).toBeDisabled();
  });

  it('shows hint text when no workflow selected', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Select a workflow to run it as a load test/)).toBeInTheDocument();
  });

  it('shows History button with count', () => {
    localStorage.setItem('workflow-run-configs', JSON.stringify([
      { id: '1', workflowId: 'wf1', variables: { test: 'config' }, usedAt: Date.now() },
    ]));

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Presets/ })).toBeInTheDocument();
  });

  it('toggles history panel on History button click', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.queryByText('No saved configurations yet.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));

    expect(screen.getByText(/No presets yet/)).toBeInTheDocument();
  });

  it('uses singular HTTP step label for a single HTTP node', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf2"
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText('1 HTTP step')).toBeInTheDocument();
  });

  it('shows ellipsis in summary when more than five HTTP steps', () => {
    render(
      <WorkflowPicker
        workflows={extendedWorkflows}
        selectedWorkflowId="wf-many-http"
        onWorkflowChange={vi.fn()}
        variables={{ v: '1' }}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText('6 HTTP steps')).toBeInTheDocument();
    expect(screen.getByText(/Step0 → Step1 → Step2 → Step3 → Step4 → \.\.\./)).toBeInTheDocument();
  });

  it('falls back to HTTP when step label is empty', () => {
    render(
      <WorkflowPicker
        workflows={extendedWorkflows}
        selectedWorkflowId="wf-default-http-label"
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText('HTTP')).toBeInTheDocument();
  });

  it('omits step name row when there are no HTTP nodes', () => {
    const { container } = render(
      <WorkflowPicker
        workflows={extendedWorkflows}
        selectedWorkflowId="wf-no-http"
        onWorkflowChange={vi.fn()}
        variables={{ only: 'x' }}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByText('0 HTTP steps')).toBeInTheDocument();
    expect(container.querySelector('.workflow-step-names')).toBeNull();
  });

  it('does not show modified hint when variables match workflow defaults', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.queryByText('(modified)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('shows History without count when there is no saved config', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    const btn = screen.getByRole('button', { name: /Presets/ });
    expect(btn.textContent).toMatch(/Presets/);
  });

  it('collapses history panel when History is clicked twice', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    const historyBtn = screen.getByRole('button', { name: /Presets/ });
    fireEvent.click(historyBtn);
    expect(screen.getByText(/No presets yet/)).toBeInTheDocument();

    fireEvent.click(historyBtn);
    expect(screen.queryByText(/No presets yet/)).not.toBeInTheDocument();
  });

  it('restores variables from history and closes the panel', () => {
    const onVariablesChange = vi.fn();
    localStorage.setItem('workflow-run-configs', JSON.stringify([
      {
        id: 'hist-1',
        workflowId: 'wf1',
        label: 'Staging',
        variables: { baseUrl: 'https://staging.example.com', apiKey: 'sk-staging' },
        usedAt: Date.now(),
      },
    ]));

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={onVariablesChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));
    fireEvent.click(screen.getByRole('button', { name: /Restore/ }));

    expect(onVariablesChange).toHaveBeenCalledWith({
      baseUrl: 'https://staging.example.com',
      apiKey: 'sk-staging',
    });
    expect(screen.queryByText('No presets yet.')).not.toBeInTheDocument();
  });

  it('shows auto-generated history label for many variables', () => {
    localStorage.setItem('workflow-run-configs', JSON.stringify([
      {
        id: 'hist-2',
        workflowId: 'wf1',
        variables: { a: '1', b: '2', c: '3' },
        usedAt: Date.now(),
      },
    ]));

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));
    // Panel now shows actual variable keys instead of "3 variables" summary
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
  });

  it('edits a history label and saves with the Save button', () => {
    localStorage.setItem('workflow-run-configs', JSON.stringify([
      {
        id: 'hist-edit',
        workflowId: 'wf1',
        variables: { x: '1' },
        usedAt: Date.now(),
      },
    ]));

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('View and restore saved variable presets'));
    fireEvent.click(screen.getByTitle('Rename this entry'));

    const input = screen.getByPlaceholderText('Give this run a name...');
    fireEvent.change(input, { target: { value: 'Prod run' } });
    const editRow = document.querySelector('.history-edit-row') as HTMLElement;
    fireEvent.click(within(editRow).getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Prod run')).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem('workflow-run-configs') ?? '[]') as { id: string; label?: string }[];
    expect(stored.find(c => c.id === 'hist-edit')?.label).toBe('Prod run');
  });

  it('saves history label when Enter is pressed in the edit field', () => {
    localStorage.setItem('workflow-run-configs', JSON.stringify([
      {
        id: 'hist-enter',
        workflowId: 'wf1',
        variables: { y: '2' },
        usedAt: Date.now(),
      },
    ]));

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));
    fireEvent.click(screen.getByTitle('Rename this entry'));

    const input = screen.getByPlaceholderText('Give this run a name...');
    fireEvent.change(input, { target: { value: 'From enter' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('From enter')).toBeInTheDocument();
  });

  it('cancels label edit with the Cancel button', () => {
    localStorage.setItem('workflow-run-configs', JSON.stringify([
      {
        id: 'hist-cancel',
        workflowId: 'wf1',
        label: 'Keep me',
        variables: { z: '3' },
        usedAt: Date.now(),
      },
    ]));

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));
    fireEvent.click(screen.getByTitle('Rename this entry'));
    fireEvent.change(screen.getByPlaceholderText('Give this run a name...'), { target: { value: 'Discarded' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Keep me')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Give this run a name...')).not.toBeInTheDocument();
  });

  it('cancels label edit when Escape is pressed', () => {
    localStorage.setItem('workflow-run-configs', JSON.stringify([
      {
        id: 'hist-esc',
        workflowId: 'wf1',
        label: 'Escape keep',
        variables: { z: '3' },
        usedAt: Date.now(),
      },
    ]));

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));
    fireEvent.click(screen.getByTitle('Rename this entry'));
    const input = screen.getByPlaceholderText('Give this run a name...');
    fireEvent.change(input, { target: { value: 'Nope' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.getByText('Escape keep')).toBeInTheDocument();
  });

  it('deletes a history entry', () => {
    localStorage.setItem('workflow-run-configs', JSON.stringify([
      {
        id: 'del-a',
        workflowId: 'wf1',
        variables: { a: '1' },
        usedAt: Date.now(),
      },
      {
        id: 'del-b',
        workflowId: 'wf1',
        variables: { b: '2' },
        usedAt: Date.now() + 1,
      },
    ]));

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    const firstItem = within(list).getAllByRole('listitem')[0];
    fireEvent.click(within(firstItem).getByTitle('Delete'));

    const after = JSON.parse(localStorage.getItem('workflow-run-configs') ?? '[]') as { id: string }[];
    expect(after.map(c => c.id)).not.toContain('del-b');
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('formats relative time in history (minutes ago)', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'));

      const then = Date.now() - 3 * 60 * 1000;
      localStorage.setItem('workflow-run-configs', JSON.stringify([
        {
          id: 'time-1',
          workflowId: 'wf1',
          variables: { q: '1' },
          usedAt: then,
        },
      ]));

      render(
        <WorkflowPicker
          workflows={mockWorkflows}
          selectedWorkflowId="wf1"
          onWorkflowChange={vi.fn()}
          variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
          onVariablesChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Presets/ }));
      expect(screen.getByText('3m ago')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows History/Presets button as primary while panel is open', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    const presetsBtn = screen.getByRole('button', { name: /Presets/ });
    expect(presetsBtn.className).not.toContain('active');
    fireEvent.click(presetsBtn);
    expect(presetsBtn.className).toContain('active');
  });

  it('does not render performance sample shortcuts when workflows list is empty and onImportSample is omitted', () => {
    render(
      <WorkflowPicker
        workflows={[]}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );
    expect(screen.queryByText(/Quick Start/)).not.toBeInTheDocument();
  });

  it('imports a catalog sample via empty-state card and forwards the factory workflow', () => {
    const onImportSample = vi.fn();
    render(
      <WorkflowPicker
        workflows={[]}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
        onImportSample={onImportSample}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Perf: Simple POST/ }));
    expect(onImportSample).toHaveBeenCalledTimes(1);
    const wf = onImportSample.mock.calls[0][0] as Workflow;
    expect(wf.name).toBe('Perf: Simple POST → GET');
    expect(wf.id).toBe('perf-workflow-simple');
  });

  it('reuses stored workflow id when importing a sample that matches an existing workflow name', () => {
    const base = createPerfSimpleWorkflow();
    const existingUserCopy: Workflow = { ...base, id: 'user-owned-perf-simple', createdAt: ts, updatedAt: ts };
    const onImportSample = vi.fn();

    render(
      <WorkflowPicker
        workflows={[existingUserCopy]}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
        onImportSample={onImportSample}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Perf: Simple POST → GET/ }));
    expect(onImportSample).toHaveBeenCalledTimes(1);
    const imported = onImportSample.mock.calls[0][0] as Workflow;
    expect(imported.id).toBe('user-owned-perf-simple');
    expect(imported.name).toBe(base.name);
  });

  it('marks compact sample chips as imported when a workflow shares the catalog name', () => {
    const base = createPerfSimpleWorkflow();
    const existingUserCopy: Workflow = { ...base, id: 'local-id', createdAt: ts, updatedAt: ts };

    render(
      <WorkflowPicker
        workflows={[existingUserCopy]}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    const chip = screen.getByRole('button', { name: /Perf: Simple POST → GET/ }).closest('.sample-chip');
    expect(chip).toHaveClass('imported');
  });

  it('saves a named preset via Save preset → Save and persists to storage', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-special' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Save the current variable values as a named preset'));
    fireEvent.change(screen.getByPlaceholderText(/Staging config/), { target: { value: 'Staging A' } });
    fireEvent.click(within(document.querySelector('.history-save-form') as HTMLElement).getByRole('button', { name: 'Save' }));

    const stored = JSON.parse(localStorage.getItem('workflow-run-configs') ?? '[]') as Array<{ workflowId?: string; label?: string }>;
    expect(stored.some(c => c.workflowId === 'wf1' && c.label === 'Staging A')).toBe(true);

    expect(screen.queryByPlaceholderText(/Staging config/)).not.toBeInTheDocument();
    expect(screen.getByText('Staging A')).toBeInTheDocument();
  });

  it('commits preset name when Enter is pressed in the preset name input', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Save the current variable values as a named preset'));
    const input = screen.getByPlaceholderText(/Staging config/);
    fireEvent.change(input, { target: { value: 'From Enter preset' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const stored = JSON.parse(localStorage.getItem('workflow-run-configs') ?? '[]') as Array<{ label?: string }>;
    expect(stored.some(c => c.label === 'From Enter preset')).toBe(true);
  });

  it('closes the save preset form on Escape without persisting empty name-only cancel path', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Save the current variable values as a named preset'));
    const input = screen.getByPlaceholderText(/Staging config/);
    fireEvent.change(input, { target: { value: 'Discarded preset' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    const stored = JSON.parse(localStorage.getItem('workflow-run-configs') ?? '[]') as Array<{ label?: string }>;
    expect(stored.some(c => c.label === 'Discarded preset')).toBe(false);

    expect(screen.queryByPlaceholderText(/Staging config/)).not.toBeInTheDocument();
  });

  it('cancels save preset via Cancel button and returns to preset hint copy', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Save the current variable values as a named preset'));
    expect(screen.getByPlaceholderText(/Staging config/)).toBeInTheDocument();

    const savePanel = document.querySelector('.history-save-form');
    expect(savePanel).toBeTruthy();
    fireEvent.click(within(savePanel as HTMLElement).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText(/Staging config/)).not.toBeInTheDocument();
    expect(screen.getByText(/Saved variable presets/i)).toBeInTheDocument();
  });

  it('shows unnamed preset title, empty variable summary, and empty value placeholder in history rows', () => {
    localStorage.setItem('workflow-run-configs', JSON.stringify([
      {
        id: 'blank-label',
        workflowId: 'wf1',
        variables: {},
        usedAt: Date.now(),
      },
      {
        id: 'blank-val',
        workflowId: 'wf1',
        label: '',
        variables: { onlyKey: '' },
        usedAt: Date.now(),
      },
    ]));

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));

    expect(screen.getAllByText('Unnamed preset')).toHaveLength(2);

    expect(screen.getByText('No variables')).toBeInTheDocument();

    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('disables Clear and History when disabled', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
        disabled
      />
    );

    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Presets/ })).toBeDisabled();
  });

  // ── Custom dropdown & search ──────────────────────

  it('opens and closes the custom dropdown on trigger click', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId('wfp-search-input')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('workflow-select'));
    expect(screen.getByTestId('wfp-search-input')).toBeInTheDocument();
  });

  it('filters workflows by search text in dropdown', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    fireEvent.change(screen.getByTestId('wfp-search-input'), { target: { value: 'order' } });

    expect(screen.getByText((_content, el) =>
      el?.classList.contains('wfp-dropdown-item') === true && el.textContent === 'Order API Flow',
    )).toBeInTheDocument();
    expect(screen.queryByText('User Registration')).not.toBeInTheDocument();
  });

  it('selects workflow from filtered search rows and clears search state', () => {
    const onWorkflowChange = vi.fn();
    const onVariablesChange = vi.fn();
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={onWorkflowChange}
        variables={{}}
        onVariablesChange={onVariablesChange}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    fireEvent.change(screen.getByTestId('wfp-search-input'), {
      target: { value: 'order' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Order API Flow/ }));

    expect(onWorkflowChange).toHaveBeenCalledWith('wf1');
    expect(onVariablesChange).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('workflow-select'));
    expect(screen.getByTestId('wfp-search-input')).toHaveValue('');
  });

  it('shows no-match message when search has no results', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    fireEvent.change(screen.getByTestId('wfp-search-input'), { target: { value: 'zzz' } });

    expect(screen.getByText(/No workflows match/)).toBeInTheDocument();
  });

  it('shows search clear button and clears on click', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    const searchInput = screen.getByTestId('wfp-search-input');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    const clearBtn = screen.getByTitle('Clear search');
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  it('shows folder navigation at root level with drill-down', () => {
    const folders = [
      { id: 'f1', name: 'Performance', order: 0 },
      { id: 'f2', name: 'Load', parentId: 'f1', order: 0 },
    ];
    const folderedWorkflows: Workflow[] = [
      { ...mockWorkflows[0], folderId: 'f2' },
      { ...mockWorkflows[1] },
    ];

    render(
      <WorkflowPicker
        workflows={folderedWorkflows}
        folders={folders}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));

    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText(mockWorkflows[1].name)).toBeInTheDocument();
  });

  it('shows selected workflow name on trigger button', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('workflow-select').textContent).toContain('Order API Flow');
  });

  it('shows placeholder text when no workflow selected', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('workflow-select').textContent).toContain('Select a workflow');
  });

  it('closes dropdown after selecting a workflow', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    expect(screen.getByTestId('wfp-search-input')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Order API Flow'));
    expect(screen.queryByTestId('wfp-search-input')).not.toBeInTheDocument();
  });

  it('highlights active workflow in dropdown', () => {
    const { container } = render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={vi.fn()}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    const activeItem = container.querySelector('.wfp-dropdown-item.active');
    expect(activeItem).toBeTruthy();
    expect(activeItem?.textContent).toBe('Order API Flow');
  });

  it('closes dropdown on outside mousedown and clears search panel state', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    fireEvent.change(screen.getByTestId('wfp-search-input'), { target: { value: 'order' } });
    fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId('wfp-search-input')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('workflow-select'));
    expect(screen.getByTestId('wfp-search-input')).toHaveValue('');
  });

  it('shows dropdown trigger up-arrow while panel is open', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    const chevron = screen.getByTestId('workflow-select').querySelector('.wfp-dropdown-chevron');
    expect(chevron).toBeTruthy();
    expect(chevron?.getAttribute('style')).toContain('rotate(180deg)');
  });

  it('does not open dropdown when trigger is disabled', () => {
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
        disabled
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    expect(screen.queryByTestId('wfp-search-input')).not.toBeInTheDocument();
  });

  it('navigates nested folders, restores root via breadcrumb All, selects workflow inside leaf', () => {
    const folders: WorkflowFolder[] = [
      { id: 'root-a', name: 'Dept', order: 0 },
      { id: 'mid-b', name: 'Team', parentId: 'root-a', order: 0 },
      { id: 'leaf-c', name: 'Project', parentId: 'mid-b', order: 0 },
    ];

    const inLeaf: Workflow = {
      ...mockWorkflows[0],
      id: 'wf-deep',
      name: 'Deep Flow',
      folderId: 'leaf-c',
    };

    const onWorkflowChange = vi.fn();
    render(
      <WorkflowPicker
        workflows={[inLeaf]}
        folders={folders}
        selectedWorkflowId={null}
        onWorkflowChange={onWorkflowChange}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    fireEvent.click(screen.getByRole('button', { name: /Dept/ }));

    fireEvent.click(screen.getByRole('button', { name: /Team/ }));
    fireEvent.click(screen.getByRole('button', { name: /Project/ }));

    expect(document.querySelector('.wft-dropdown-breadcrumb')).toBeTruthy();
    expect(screen.getByText('Deep Flow')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Deep Flow'));
    expect(onWorkflowChange).toHaveBeenCalledWith('wf-deep');

    fireEvent.click(screen.getByTestId('workflow-select'));

    fireEvent.click(screen.getByRole('button', { name: /Dept/ }));
    fireEvent.click(document.querySelector('.wft-breadcrumb-root') as HTMLElement);

    expect(document.querySelector('.wft-dropdown-breadcrumb')).not.toBeInTheDocument();
  });

  it('folder back button climbs to parent in breadcrumb drill-down', () => {
    const folders: WorkflowFolder[] = [
      { id: 'a1', name: 'Alpha', order: 0 },
      { id: 'b1', name: 'Beta', parentId: 'a1', order: 0 },
    ];

    render(
      <WorkflowPicker
        workflows={[mockWorkflows[1]]}
        folders={folders}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    fireEvent.click(screen.getByRole('button', { name: /Beta/ }));

    expect(document.querySelector('.wft-breadcrumb-current')?.textContent).toContain('Beta');

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.getByRole('button', { name: /Beta/ })).toBeInTheDocument();
  });

  it('shows Empty folder inside a navigated folder that has only empty structure', () => {
    const folders: WorkflowFolder[] = [
      { id: 'p1', name: 'Packed', order: 0 },
      { id: 'v1', name: 'Vacant', order: 1 },
    ];

    render(
      <WorkflowPicker
        workflows={[mockWorkflows[1]]}
        folders={folders}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    fireEvent.click(screen.getByRole('button', { name: /Vacant/ }));

    expect(screen.getByText('Empty folder')).toBeInTheDocument();
  });

  it('search highlights substring and shows filed workflow breadcrumb in results', () => {
    const folders: WorkflowFolder[] = [{ id: 'fx', name: 'Archive', order: 0 }];
    const filedWf: Workflow = {
      ...mockWorkflows[0],
      folderId: 'fx',
      name: 'Archived Order Flow',
    };

    render(
      <WorkflowPicker
        workflows={[filedWf, mockWorkflows[1]]}
        folders={folders}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    fireEvent.change(screen.getByTestId('wfp-search-input'), {
      target: { value: 'order' },
    });

    expect(document.querySelectorAll('.wfp-search-highlight').length).toBeGreaterThan(0);

    const row = screen.getByRole('button', { name: /Archived Order Flow/ }).closest('.wfp-dropdown-item');
    expect(row?.querySelector('.wft-item-breadcrumb')).toHaveTextContent('Archive');

    fireEvent.change(screen.getByTestId('wfp-search-input'), {
      target: { value: 'user' },
    });
    const userRow = screen.getByRole('button', { name: mockWorkflows[1].name });
    expect(userRow.querySelector('.wft-item-breadcrumb')).toBeNull();
  });

  it('drops breadcrumb drill-down when typing in search clears folder navigation', () => {
    const folders: WorkflowFolder[] = [{ id: 'solo', name: 'Solo', order: 0 }];

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        folders={folders}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-select'));
    fireEvent.click(screen.getByRole('button', { name: /Solo/ }));
    expect(document.querySelector('.wft-dropdown-breadcrumb')).toBeTruthy();

    fireEvent.change(screen.getByTestId('wfp-search-input'), { target: { value: 'a' } });
    expect(document.querySelector('.wft-dropdown-breadcrumb')).not.toBeInTheDocument();
  });

  it('does not invoke import when compact sample chip is clicked without onImportSample', () => {
    const onWorkflowChange = vi.fn();
    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId={null}
        onWorkflowChange={onWorkflowChange}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Perf: Simple POST → GET/ }));
    expect(onWorkflowChange).not.toHaveBeenCalled();
  });

  it('shows catalog description as compact sample chip tooltip when not imported yet', () => {
    render(
      <WorkflowPicker
        workflows={[mockWorkflows[0]]}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    const chip = screen.getByRole('button', { name: /Perf: Conditional Branching/ });
    expect(chip.getAttribute('title')).toBe(
      'Load test a workflow with conditional paths: search country, branch on result.',
    );
  });

  it('shows update/select hint as compact chip tooltip when sample name already exists locally', () => {
    render(
      <WorkflowPicker
        workflows={[createPerfSimpleWorkflow()]}
        selectedWorkflowId={null}
        onWorkflowChange={vi.fn()}
        variables={{}}
        onVariablesChange={vi.fn()}
      />
    );

    const chip = screen.getByRole('button', { name: /Perf: Simple POST → GET/ });
    expect(chip.getAttribute('title')).toMatch(/Update/);
    expect(chip.getAttribute('title')).toContain('Perf: Simple POST → GET');
  });
});
