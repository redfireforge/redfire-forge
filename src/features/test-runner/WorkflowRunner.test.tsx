/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowRunner from './WorkflowRunner';
import type { Workflow } from '../workflow/types/workflow';

vi.mock('../../../shared/utils/storage', () => ({
  saveRunnerConfig: vi.fn().mockResolvedValue(undefined),
  loadRunnerConfig: vi.fn().mockResolvedValue(null),
}));

vi.mock('./utils/runnerProgressStorage', () => ({
  saveProgress: vi.fn(),
  loadProgress: vi.fn().mockReturnValue(null),
  clearProgress: vi.fn(),
  thinkTimeLabel: vi.fn().mockReturnValue(null),
}));

vi.mock('./utils/workflowRunConfigStorage', () => ({
  getWorkflowRunConfigs: vi.fn().mockReturnValue([]),
  saveWorkflowRunConfig: vi.fn(),
  updateWorkflowRunConfigLabel: vi.fn(),
  deleteWorkflowRunConfig: vi.fn(),
  formatConfigLabel: vi.fn().mockReturnValue('Config'),
  formatRelativeTime: vi.fn().mockReturnValue('just now'),
}));

const mockWorkflows: Workflow[] = [
  {
    id: 'wf1',
    name: 'Test Workflow',
    nodes: [
      { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Get Users' } },
      { id: 'n2', type: 'http', position: { x: 100, y: 0 }, data: { label: 'Get Orders' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    variables: { baseUrl: 'https://api.example.com' },
  },
  {
    id: 'wf2',
    name: 'Another Workflow',
    nodes: [
      { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Health Check' } },
    ],
    edges: [],
    variables: {},
  },
];

describe('WorkflowRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', () => {
    render(<WorkflowRunner workflows={[]} onComplete={vi.fn()} />);
    
    expect(screen.getByText('Workflow Runner')).toBeInTheDocument();
  });

  it('renders empty state when no workflows', () => {
    render(<WorkflowRunner workflows={[]} onComplete={vi.fn()} />);
    
    expect(screen.getByText('No workflows available')).toBeInTheDocument();
    expect(screen.getByText(/Create a workflow in the Workflow Designer first/)).toBeInTheDocument();
  });

  it('renders workflow selector when workflows exist', () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    expect(screen.getByText('Select a workflow...')).toBeInTheDocument();
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText('Another Workflow')).toBeInTheDocument();
  });

  it('shows run button after selecting a workflow', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
    await waitFor(() => {
      expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument();
    });
  });

  it('shows workflow step count after selection', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
    await waitFor(() => {
      expect(screen.getByText('2 HTTP steps')).toBeInTheDocument();
    });
  });

  it('shows workflow step names after selection', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
    await waitFor(() => {
      expect(screen.getByText(/Get Users → Get Orders/)).toBeInTheDocument();
    });
  });

  it('shows variables section when workflow has variables', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
    await waitFor(() => {
      expect(screen.getByText('Initial Variables')).toBeInTheDocument();
      expect(screen.getByText('baseUrl')).toBeInTheDocument();
    });
  });

  it('does not show execution config before selecting workflow', () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    expect(screen.queryByText('Execution Mode:')).not.toBeInTheDocument();
  });

  it('shows execution config after selecting workflow', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
    await waitFor(() => {
      expect(screen.getByText('Execution Mode:')).toBeInTheDocument();
    });
  });

  it('allows clearing workflow selection', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Clear'));
    
    await waitFor(() => {
      expect(screen.queryByText('▶ Run Workflow')).not.toBeInTheDocument();
    });
  });
});
