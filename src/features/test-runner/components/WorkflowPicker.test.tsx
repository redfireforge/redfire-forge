/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowPicker from './WorkflowPicker';
import type { Workflow } from '../../workflow/types/workflow';

const mockWorkflows: Workflow[] = [
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'wf2',
    name: 'User Registration',
    variables: {},
    nodes: [
      { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Register' } },
    ],
    edges: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

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
    expect(screen.getByText('Create a workflow in the Workflow Designer first.')).toBeInTheDocument();
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

    expect(screen.getByText('Select a workflow...')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Order API Flow' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'User Registration' })).toBeInTheDocument();
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

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'wf1' } });

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

    expect(screen.getByText('(modified)')).toBeInTheDocument();
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

    render(
      <WorkflowPicker
        workflows={mockWorkflows}
        selectedWorkflowId="wf1"
        onWorkflowChange={onWorkflowChange}
        variables={{ baseUrl: 'https://api.example.com', apiKey: 'sk-test' }}
        onVariablesChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onWorkflowChange).toHaveBeenCalledWith(null);
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

    expect(screen.getByRole('combobox')).toBeDisabled();
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

    expect(screen.getByText(/Select a workflow above to run it as a performance test/)).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: /History \(1\)/ })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /History/ }));

    expect(screen.getByText('No saved configurations yet. Run a test to save the current variables.')).toBeInTheDocument();
  });
});
