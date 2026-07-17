/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkflowConfigPanel from './WorkflowConfigPanel';
import type { WorkflowNode } from '../../types/workflow';

let mockCapturedDraftChange: ((d: unknown) => void) | undefined;

vi.mock('../modals/WorkflowVariableInsertModal', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="var-insert-modal" /> : null),
}));
vi.mock('../configs/HttpConfig', () => ({
  default: ({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="http-config">
      <button type="button" onClick={() => onChange({ label: 'x' })}>http-change</button>
    </div>
  ),
}));
vi.mock('../configs/ConditionConfig', () => ({
  default: ({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="condition-config">
      <button type="button" onClick={() => onChange({ expression: 'y' })}>cond-change</button>
    </div>
  ),
}));
vi.mock('../configs/DelayConfig', () => ({
  default: ({ onChange }: { onChange: (p: Record<string, unknown>) => void }) => (
    <div data-testid="delay-config">
      <button type="button" onClick={() => onChange({ ms: 100 })}>delay-change</button>
    </div>
  ),
}));
vi.mock('./VariablesSection', () => ({
  default: ({ title, onUpdateVariables }: { title: string; onUpdateVariables?: (v: Record<string, string>) => void }) => (
    <div data-testid="variables-section">
      {title}
      <button type="button" onClick={() => onUpdateVariables?.({ k: 'v' })}>{`update-${title}`}</button>
    </div>
  ),
}));
vi.mock('../modals/WorkflowModalScrollBody', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-body">{children}</div>,
}));
vi.mock('../../../../shared/hooks/useModalDrag', () => ({
  useModalDrag: () => ({ onDragStart: vi.fn(), overlayStyle: {}, modalStyle: {} }),
}));
vi.mock('../../hooks/useVariableInsertModal', () => ({
  useVariableInsertModal: () => ({
    variableInsertOpen: false,
    variableInsertShortRef: false,
    variableInsertInitialSearch: '',
    requestVariableInsert: vi.fn(),
    handleVariableInsertPicked: vi.fn(),
    closeVariableInsert: vi.fn(),
  }),
}));
vi.mock('../../hooks/useWorkflowValidationFetch', () => ({
  useWorkflowValidationFetch: (args: { onDraftChange?: (d: unknown) => void }) => {
    mockCapturedDraftChange = args?.onDraftChange;
    return {
    fetchingResponse: false,
    fetchError: null,
    fetchHostOverride: '',
    setFetchHostOverride: vi.fn(),
    fetchHostEnabled: false,
    setFetchHostEnabled: vi.fn(),
    handleFetchSampleResponse: vi.fn(),
    fetchSampleDataForMapper: vi.fn(),
    validating: false,
    validationResult: null,
    setValidationResult: vi.fn(),
    handleValidateResponse: vi.fn(),
    pendingFetchResponse: null,
    handleFetchKeepRules: vi.fn(),
    handleFetchReplaceAll: vi.fn(),
    handleFetchCancel: vi.fn(),
    };
  },
}));
vi.mock('../../utils/workflowVariableHints', () => ({
  isHttpWorkflowNode: (n: WorkflowNode | null) => n?.type === 'http',
  buildConfigVariableInsertHints: () => [],
}));

const makeNode = (type: string, data: Record<string, unknown> = {}): WorkflowNode =>
  ({ id: 'n1', type, position: { x: 0, y: 0 }, data }) as unknown as WorkflowNode;

const baseProps = {
  workflowVariables: { baseUrl: 'http://x' },
  onUpdateWorkflowVariables: vi.fn(),
  onUpdateNode: vi.fn(),
  onDeleteNode: vi.fn(),
  effectiveQuickTestBaseUrl: 'http://x',
};

describe('WorkflowConfigPanel', () => {
  it('renders empty state and workflow defaults when no node selected', () => {
    render(<WorkflowConfigPanel {...baseProps} node={null} />);
    expect(screen.getByText('Select a node to configure')).toBeTruthy();
    expect(screen.getAllByTestId('variables-section').length).toBeGreaterThan(0);
  });

  it('renders deprecated baseUrl hint when services exist and no node', () => {
    render(<WorkflowConfigPanel {...baseProps} node={null} workflowServices={[{ id: 's', name: 'S', endpoints: [] }]} />);
    expect(screen.getAllByText('Workflow defaults').length).toBeGreaterThan(0);
  });

  it('renders HTTP node config', () => {
    render(<WorkflowConfigPanel {...baseProps} node={makeNode('http', { label: 'Get' })} />);
    expect(screen.getByTestId('http-config')).toBeTruthy();
    expect(screen.getByText('HTTP')).toBeTruthy();
  });

  it('updates HTTP node data and initial variables via callbacks', async () => {
    const user = userEvent.setup();
    const onUpdateNode = vi.fn();
    render(<WorkflowConfigPanel {...baseProps} onUpdateNode={onUpdateNode} node={makeNode('http', { label: 'Get' })} />);
    await user.click(screen.getByText('http-change'));
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { label: 'x' });
    await user.click(screen.getByText('update-Initial variables (this step)'));
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { initialVariables: { k: 'v' } });
  });

  it('forwards validation draft changes to onUpdateNode', () => {
    const onUpdateNode = vi.fn();
    render(<WorkflowConfigPanel {...baseProps} onUpdateNode={onUpdateNode} node={makeNode('http', { label: 'Get' })} />);
    mockCapturedDraftChange?.({ id: 's', name: 'S' });
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { scenario: { id: 's', name: 'S' } });
  });

  it('renders condition node config', () => {
    render(<WorkflowConfigPanel {...baseProps} node={makeNode('condition')} />);
    expect(screen.getByTestId('condition-config')).toBeTruthy();
  });

  it('updates condition node via callback', async () => {
    const user = userEvent.setup();
    const onUpdateNode = vi.fn();
    render(<WorkflowConfigPanel {...baseProps} onUpdateNode={onUpdateNode} node={makeNode('condition')} />);
    await user.click(screen.getByText('cond-change'));
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { expression: 'y' });
  });

  it('renders delay node config', () => {
    render(<WorkflowConfigPanel {...baseProps} node={makeNode('delay')} />);
    expect(screen.getByTestId('delay-config')).toBeTruthy();
  });

  it('updates delay node via callback', async () => {
    const user = userEvent.setup();
    const onUpdateNode = vi.fn();
    render(<WorkflowConfigPanel {...baseProps} onUpdateNode={onUpdateNode} node={makeNode('delay')} />);
    await user.click(screen.getByText('delay-change'));
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { ms: 100 });
  });

  it('renders start node trigger variables', () => {
    render(<WorkflowConfigPanel {...baseProps} node={makeNode('start', { inputVariables: { a: '1' } })} />);
    expect(screen.getByText('Trigger input variables')).toBeTruthy();
  });

  it('updates start node input variables via callback', async () => {
    const user = userEvent.setup();
    const onUpdateNode = vi.fn();
    render(<WorkflowConfigPanel {...baseProps} onUpdateNode={onUpdateNode} node={makeNode('start', { inputVariables: { a: '1' } })} />);
    await user.click(screen.getByText('update-Trigger input variables'));
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { inputVariables: { k: 'v' } });
  });

  it('updates workflow defaults via callback when no node', async () => {
    const user = userEvent.setup();
    const onUpdateWorkflowVariables = vi.fn();
    render(<WorkflowConfigPanel {...baseProps} onUpdateWorkflowVariables={onUpdateWorkflowVariables} node={null} />);
    await user.click(screen.getAllByText('update-Workflow defaults')[0]);
    expect(onUpdateWorkflowVariables).toHaveBeenCalledWith({ k: 'v' });
  });

  it('expands to full-screen modal and deletes node from expanded header', async () => {
    const user = userEvent.setup();
    const onDeleteNode = vi.fn();
    render(<WorkflowConfigPanel {...baseProps} onDeleteNode={onDeleteNode} node={makeNode('http', { label: 'Get' })} />);
    await user.click(screen.getAllByTitle('Expand to full screen')[0]);
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.click(screen.getByTitle('Delete node'));
    expect(onDeleteNode).toHaveBeenCalledWith('n1');
  });

  it('deletes node via delete button', async () => {
    const user = userEvent.setup();
    const onDeleteNode = vi.fn();
    render(<WorkflowConfigPanel {...baseProps} onDeleteNode={onDeleteNode} node={makeNode('delay')} />);
    await user.click(screen.getByTitle('Delete node'));
    expect(onDeleteNode).toHaveBeenCalledWith('n1');
  });

  it('expands to full screen modal and collapses back', async () => {
    const user = userEvent.setup();
    render(<WorkflowConfigPanel {...baseProps} node={makeNode('http', { label: 'Get' })} />);
    await user.click(screen.getByTitle('Expand to full screen'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTestId('scroll-body')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stops propagation when clicking inside the expanded modal', async () => {
    const user = userEvent.setup();
    render(<WorkflowConfigPanel {...baseProps} node={makeNode('http', { label: 'Get' })} />);
    await user.click(screen.getByTitle('Expand to full screen'));
    const dialog = screen.getByRole('dialog');
    await user.click(dialog);
    // Clicking inside the modal must not close it (stopPropagation prevents overlay dismissal)
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('collapses via shrink button in expanded header', async () => {
    const user = userEvent.setup();
    render(<WorkflowConfigPanel {...baseProps} node={makeNode('condition')} />);
    await user.click(screen.getByTitle('Expand to full screen'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.click(screen.getByTitle('Shrink back to side panel'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('resets to inline view when a different node is selected', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WorkflowConfigPanel {...baseProps} node={makeNode('condition')} />);
    await user.click(screen.getByTitle('Expand to full screen'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    rerender(<WorkflowConfigPanel {...baseProps} node={{ ...makeNode('delay'), id: 'n2' }} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not update node when validation draft changes with no node selected', () => {
    const onUpdateNode = vi.fn();
    render(<WorkflowConfigPanel {...baseProps} onUpdateNode={onUpdateNode} node={null} />);
    mockCapturedDraftChange?.({ id: 's', name: 'S' });
    expect(onUpdateNode).not.toHaveBeenCalled();
  });

  it('uses empty inputVariables when start node has none defined', () => {
    render(<WorkflowConfigPanel {...baseProps} node={makeNode('start', {})} />);
    expect(screen.getByText('Trigger input variables')).toBeTruthy();
  });

  it('ignores expand click while collapse animation is in progress', () => {
    render(<WorkflowConfigPanel {...baseProps} node={makeNode('http', { label: 'Get' })} />);
    // Expand
    fireEvent.click(screen.getByTitle('Expand to full screen'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    // Collapse — sets collapsingRef=true, queues requestAnimationFrame
    fireEvent.click(screen.getByTitle('Shrink back to side panel'));
    // Immediately try to expand again before rAF fires → should be blocked
    fireEvent.click(screen.getByTitle('Expand to full screen'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
