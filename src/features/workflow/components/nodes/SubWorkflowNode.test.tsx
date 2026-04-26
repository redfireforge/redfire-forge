/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SubWorkflowNode from './SubWorkflowNode';
import type { SubWorkflowNodeData } from '../../types/workflow';

// Mock ReactFlow handles
vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, id, className }: { type: string; position: string; id?: string; className?: string }) => (
    <div data-testid={`handle-${type}${id ? `-${id}` : ''}`} data-position={position} className={className} />
  ),
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

// Mock useNodeBase
vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: null,
    stateClass: '',
    debugStep: null,
    handleConfigure: vi.fn(),
    openStepDetail: vi.fn(),
  }),
}));

// Mock NodeIcon
vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <div data-testid={`icon-${type}`} />,
  getNodeCategory: (type: string) => type === 'subWorkflow' ? 'Flow' : '',
}));

const mockNavigateToWorkflow = vi.fn();
const mockGetWorkflowPreview = vi.fn();
vi.mock('../panels/WorkflowInspectContext', () => ({
  useWorkflowInspect: () => ({
    openStepDetail: vi.fn(),
    openVariableDetail: vi.fn(),
    openNodeConfig: vi.fn(),
    navigateToWorkflow: mockNavigateToWorkflow,
    getWorkflowPreview: mockGetWorkflowPreview,
  }),
}));

function makeProps(data: Partial<SubWorkflowNodeData> = {}) {
  const fullData: SubWorkflowNodeData = {
    label: 'Sub-Workflow',
    workflowId: '',
    inputMappings: [],
    outputMappings: [],
    ...data,
  };
  return {
    id: 'sw-1',
    data: fullData,
    selected: false,
    type: 'subWorkflow' as const,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    dragHandle: undefined,
    parentId: undefined,
    sourcePosition: undefined,
    targetPosition: undefined,
  };
}

describe('SubWorkflowNode', () => {
  it('renders with default label', () => {
    const { container } = render(<SubWorkflowNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-subWorkflow')).toBeTruthy();
    expect(container.textContent).toContain('Sub-Workflow');
  });

  it('renders custom label', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({ label: 'Auth Flow' })} />);
    expect(container.textContent).toContain('Auth Flow');
  });

  it('shows warning when no workflow selected', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: '' })} />);
    const warning = container.querySelector('.wf-subworkflow-warning');
    expect(warning).toBeTruthy();
    expect(warning?.textContent).toContain('Select workflow');
  });

  it('shows workflow name when selected', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({
      workflowId: 'child-uuid',
      workflowName: 'My Child Workflow',
    })} />);
    const name = container.querySelector('.wf-subworkflow-name');
    expect(name).toBeTruthy();
    expect(name?.textContent).toBe('My Child Workflow');
    expect(container.querySelector('.wf-subworkflow-warning')).toBeNull();
  });

  it('falls back to workflowId when workflowName is missing', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({
      workflowId: 'child-uuid-123',
    })} />);
    const name = container.querySelector('.wf-subworkflow-name');
    expect(name?.textContent).toBe('child-uuid-123');
  });

  it('shows mapping counts', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({
      workflowId: 'x',
      inputMappings: [
        { sourceExpression: '{{a}}', targetVariable: 'b' },
        { sourceExpression: '{{c}}', targetVariable: 'd' },
      ],
      outputMappings: [
        { sourceVariable: 'result', targetVariable: 'out' },
      ],
    })} />);
    const mappings = container.querySelector('.wf-subworkflow-mappings');
    expect(mappings?.textContent).toBe('2 in · 1 out');
  });

  it('hides mappings badge when no mappings', () => {
    const { container } = render(<SubWorkflowNode {...makeProps()} />);
    expect(container.querySelector('.wf-subworkflow-mappings')).toBeNull();
  });

  it('renders target and source handles', () => {
    const { container } = render(<SubWorkflowNode {...makeProps()} />);
    const handles = container.querySelectorAll('[data-testid^="handle-"]');
    expect(handles).toHaveLength(2);
    expect(container.querySelector('[data-testid="handle-target"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="handle-source"]')).toBeTruthy();
  });

  it('renders NodeIcon for subWorkflow type', () => {
    const { container } = render(<SubWorkflowNode {...makeProps()} />);
    expect(container.querySelector('[data-testid="icon-subWorkflow"]')).toBeTruthy();
  });

  it('renders configure button', () => {
    const { container } = render(<SubWorkflowNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-configure-badge')).toBeTruthy();
  });

  it('applies selected class when selected', () => {
    const props = makeProps();
    props.selected = true;
    const { container } = render(<SubWorkflowNode {...props} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('shows category label from getNodeCategory', () => {
    const { container } = render(<SubWorkflowNode {...makeProps()} />);
    expect(container.textContent).toContain('Flow');
  });

  it('renders Open button when workflow is selected', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: 'child-uuid' })} />);
    const openBtn = container.querySelector('.wf-subworkflow-open-btn');
    expect(openBtn).toBeTruthy();
  });

  it('does not render Open button when no workflow selected', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: '' })} />);
    const openBtn = container.querySelector('.wf-subworkflow-open-btn');
    expect(openBtn).toBeNull();
  });

  it('calls navigateToWorkflow when Open button clicked', () => {
    mockNavigateToWorkflow.mockClear();
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: 'child-uuid' })} />);
    const openBtn = container.querySelector('.wf-subworkflow-open-btn') as HTMLElement;
    fireEvent.click(openBtn);
    expect(mockNavigateToWorkflow).toHaveBeenCalledWith('child-uuid');
  });

  // ── E4: Inline Canvas Preview ──

  it('shows node and edge counts when getWorkflowPreview returns data', () => {
    mockGetWorkflowPreview.mockReturnValue({ nodeCount: 5, edgeCount: 4 });
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: 'child-uuid' })} />);
    const preview = container.querySelector('.wf-subworkflow-preview');
    expect(preview).toBeTruthy();
    expect(preview?.textContent).toContain('5 nodes');
    expect(preview?.textContent).toContain('4 edges');
  });

  it('shows singular "node" and "edge" for count of 1', () => {
    mockGetWorkflowPreview.mockReturnValue({ nodeCount: 1, edgeCount: 1 });
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: 'child-uuid' })} />);
    const preview = container.querySelector('.wf-subworkflow-preview');
    expect(preview?.textContent).toContain('1 node');
    expect(preview?.textContent).toContain('1 edge');
    expect(preview?.textContent).not.toContain('nodes');
    expect(preview?.textContent).not.toContain('edges');
  });

  it('shows pass status indicator when lastRunStatus is pass', () => {
    mockGetWorkflowPreview.mockReturnValue({ nodeCount: 3, edgeCount: 2, lastRunStatus: 'pass' });
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: 'child-uuid' })} />);
    const status = container.querySelector('.wf-subworkflow-preview-status-pass');
    expect(status).toBeTruthy();
    expect(status?.textContent).toBe('✓');
  });

  it('shows fail status indicator when lastRunStatus is fail', () => {
    mockGetWorkflowPreview.mockReturnValue({ nodeCount: 3, edgeCount: 2, lastRunStatus: 'fail' });
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: 'child-uuid' })} />);
    const status = container.querySelector('.wf-subworkflow-preview-status-fail');
    expect(status).toBeTruthy();
    expect(status?.textContent).toBe('✗');
  });

  it('does not show status indicator when lastRunStatus is idle', () => {
    mockGetWorkflowPreview.mockReturnValue({ nodeCount: 3, edgeCount: 2, lastRunStatus: 'idle' });
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: 'child-uuid' })} />);
    expect(container.querySelector('.wf-subworkflow-preview-status')).toBeNull();
  });

  it('does not show preview when no workflow selected', () => {
    mockGetWorkflowPreview.mockReturnValue(undefined);
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: '' })} />);
    expect(container.querySelector('.wf-subworkflow-preview')).toBeNull();
  });

  it('does not show preview when getWorkflowPreview returns undefined', () => {
    mockGetWorkflowPreview.mockReturnValue(undefined);
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: 'missing-wf' })} />);
    expect(container.querySelector('.wf-subworkflow-preview')).toBeNull();
  });

  // ── E5: Dynamic Workflow ID ──

  it('shows dynamic expression indicator for {{variable}} workflowId', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: '{{targetWf}}' })} />);
    const dynamic = container.querySelector('.wf-subworkflow-dynamic');
    expect(dynamic).toBeTruthy();
    expect(dynamic?.textContent).toContain('{{targetWf}}');
  });

  it('hides Open button for dynamic workflowId', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: '{{targetWf}}' })} />);
    expect(container.querySelector('.wf-subworkflow-open-btn')).toBeNull();
  });

  it('does not show preview for dynamic workflowId', () => {
    mockGetWorkflowPreview.mockReturnValue({ nodeCount: 3, edgeCount: 2 });
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: '{{targetWf}}' })} />);
    expect(container.querySelector('.wf-subworkflow-preview')).toBeNull();
  });

  // ── E6: Multi-Instance forEach ──

  it('shows multi-instance badge when multiInstance is configured', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({
      workflowId: 'child-uuid',
      multiInstance: { collection: '{{users}}', elementVariable: 'user', mode: 'sequential' },
    })} />);
    const badge = container.querySelector('.wf-subworkflow-multi-instance');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('sequential');
    expect(badge?.textContent).toContain('user');
  });

  it('does not show multi-instance badge when not configured', () => {
    const { container } = render(<SubWorkflowNode {...makeProps({ workflowId: 'child-uuid' })} />);
    expect(container.querySelector('.wf-subworkflow-multi-instance')).toBeNull();
  });
});
