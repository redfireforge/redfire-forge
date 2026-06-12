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

describe('WorkflowDefaultsModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<WorkflowDefaultsModal {...baseProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders variables section and error select when open', () => {
    render(<WorkflowDefaultsModal {...baseProps} />);
    expect(screen.getByTestId('vars-section').textContent).toContain('baseUrl');
    expect(screen.getByText('Workflow Variables')).toBeTruthy();
    const select = document.querySelector('.wf-defaults-select') as HTMLSelectElement;
    expect(select.value).toBe('stop');
  });

  it('reflects existing errorConfig mode', () => {
    render(<WorkflowDefaultsModal {...baseProps} errorConfig={{ mode: 'continue' }} />);
    const select = document.querySelector('.wf-defaults-select') as HTMLSelectElement;
    expect(select.value).toBe('continue');
    expect(screen.getByText('Workflow continues even when steps fail')).toBeTruthy();
  });

  it('switching to run-handler shows handler node select (filters start/end)', () => {
    render(<WorkflowDefaultsModal {...baseProps} workflowNodes={nodes} />);
    const select = document.querySelector('.wf-defaults-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'run-handler' } });
    const selects = document.querySelectorAll('.wf-defaults-select');
    expect(selects.length).toBe(2);
    const handlerSelect = selects[1] as HTMLSelectElement;
    const options = handlerSelect.querySelectorAll('option');
    // placeholder + n1 + n2 (start filtered out)
    expect(options.length).toBe(3);
    expect(screen.getByText('Get User (http)')).toBeTruthy();
    expect(screen.getByText('delay (delay)')).toBeTruthy();
  });

  it('selecting handler entry node updates draft', () => {
    render(<WorkflowDefaultsModal {...baseProps} workflowNodes={nodes} />);
    const modeSelect = document.querySelector('.wf-defaults-select') as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: 'run-handler' } });
    const handlerSelect = document.querySelectorAll('.wf-defaults-select')[1] as HTMLSelectElement;
    fireEvent.change(handlerSelect, { target: { value: 'n1' } });
    expect(handlerSelect.value).toBe('n1');
  });

  it('switching back to stop clears error draft', () => {
    render(<WorkflowDefaultsModal {...baseProps} errorConfig={{ mode: 'continue' }} />);
    const select = document.querySelector('.wf-defaults-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'stop' } });
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
