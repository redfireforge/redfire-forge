/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowPicker from './WorkflowPicker';
import type { Workflow } from '../../workflow/types/workflow';
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

});
