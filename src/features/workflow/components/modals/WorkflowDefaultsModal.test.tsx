/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowDefaultsModal from './WorkflowDefaultsModal';
import type { WorkflowNode } from '../../types/workflow';

vi.mock('../panels/VariablesSection', () => ({
  default: ({ variables, onUpdateVariables }: {
    variables: Record<string, string>;
    onUpdateVariables: (v: Record<string, string>) => void;
  }) => (
    <div data-testid="vars-section">
      keys:{Object.keys(variables).join(',')}
      <button data-testid="add-var" onClick={() => onUpdateVariables({ ...variables, added: '1' })}>add</button>
    </div>
  ),
}));

vi.mock('./WorkflowVariableInsertModal', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="var-insert">open</div> : null),
}));

vi.mock('./WorkflowEditorModalFrame', () => ({
  default: ({ open, title, children, footer, onClose }: {
    open: boolean;
    title: React.ReactNode;
    children: React.ReactNode;
    footer: React.ReactNode;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="frame">
        <div>{title}</div>
        <button data-testid="frame-x" onClick={onClose}>x</button>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
}));

const nodes: WorkflowNode[] = [
  { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Get User' } } as unknown as WorkflowNode,
  { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} } as unknown as WorkflowNode,
  { id: 'n2', type: 'delay', position: { x: 0, y: 0 }, data: {} } as unknown as WorkflowNode,
];

const baseProps = {
  open: true,
  workflowVariables: { baseUrl: 'http://x' },
  onUpdateWorkflowVariables: vi.fn(),
  onClose: vi.fn(),
};

async function pickDarkSelectOption(testId: string, label: string) {
  const root = screen.getByTestId(testId);
  fireEvent.click(root.querySelector('.wf-dark-select__trigger')!);
  fireEvent.click(await screen.findByRole('option', { name: label }));
}

describe('WorkflowDefaultsModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<WorkflowDefaultsModal {...baseProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders variables section and error select when open', () => {
    render(<WorkflowDefaultsModal {...baseProps} />);
    expect(screen.getByTestId('vars-section').textContent).toContain('baseUrl');
    expect(screen.getByText('Workflow Variables')).toBeTruthy();
    expect(screen.getByTestId('wf-defaults-error-mode').textContent).toContain('Stop workflow (default)');
  });

  it('reflects existing errorConfig mode', () => {
    render(<WorkflowDefaultsModal {...baseProps} errorConfig={{ mode: 'continue' }} />);
    expect(screen.getByTestId('wf-defaults-error-mode').textContent).toContain('Continue (ignore errors)');
    expect(screen.getByText(/Workflow continues even when steps fail/)).toBeTruthy();
  });

  it('switching to run-handler shows handler node select (filters start/end)', async () => {
    render(<WorkflowDefaultsModal {...baseProps} workflowNodes={nodes} />);
    await pickDarkSelectOption('wf-defaults-error-mode', 'Run error handler subgraph');
    expect(screen.getByTestId('wf-defaults-handler-node')).toBeTruthy();
    fireEvent.click(screen.getByTestId('wf-defaults-handler-node').querySelector('.wf-dark-select__trigger')!);
    expect(screen.getByRole('option', { name: 'Get User (http)' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'delay (delay)' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /start/ })).toBeNull();
  });

  it('selecting handler entry node updates draft', async () => {
    render(<WorkflowDefaultsModal {...baseProps} workflowNodes={nodes} />);
    await pickDarkSelectOption('wf-defaults-error-mode', 'Run error handler subgraph');
    await pickDarkSelectOption('wf-defaults-handler-node', 'Get User (http)');
    expect(screen.getByTestId('wf-defaults-handler-node').textContent).toContain('Get User (http)');
  });

  it('switching back to stop clears error draft', async () => {
    render(<WorkflowDefaultsModal {...baseProps} errorConfig={{ mode: 'continue' }} />);
    await pickDarkSelectOption('wf-defaults-error-mode', 'Stop workflow (default)');
    expect(screen.getByText(/Workflow stops when any step fails/)).toBeTruthy();
  });

  it('Save calls onUpdateWorkflowVariables, onUpdateErrorConfig, onClose', () => {
    const onUpdateWorkflowVariables = vi.fn();
    const onUpdateErrorConfig = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkflowDefaultsModal
        {...baseProps}
        onUpdateWorkflowVariables={onUpdateWorkflowVariables}
        onUpdateErrorConfig={onUpdateErrorConfig}
        onClose={onClose}
        errorConfig={{ mode: 'continue' }}
      />,
    );
    fireEvent.click(screen.getByTestId('add-var'));
    fireEvent.click(screen.getByText('Save'));
    expect(onUpdateWorkflowVariables).toHaveBeenCalledWith({ baseUrl: 'http://x', added: '1' });
    expect(onUpdateErrorConfig).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel rolls back to original variables and config', () => {
    const onUpdateWorkflowVariables = vi.fn();
    const onUpdateErrorConfig = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkflowDefaultsModal
        {...baseProps}
        onUpdateWorkflowVariables={onUpdateWorkflowVariables}
        onUpdateErrorConfig={onUpdateErrorConfig}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('add-var'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onUpdateWorkflowVariables).toHaveBeenCalledWith({ baseUrl: 'http://x' });
    expect(onClose).toHaveBeenCalled();
  });

  it('marks baseUrl deprecated when services present (no crash)', () => {
    render(
      <WorkflowDefaultsModal
        {...baseProps}
        workflowServices={[{ id: 's1', name: 'svc', endpoints: [] }]}
      />,
    );
    expect(screen.getByTestId('vars-section')).toBeTruthy();
  });
});
