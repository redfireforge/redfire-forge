/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ScriptNode from './ScriptNode';
import { ScriptNodeData } from '../../types/workflow';

// Mock ReactFlow handles
vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, className }: { type: string; position: string; className?: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} className={className} />
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
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
  getNodeCategory: (type: string) => type === 'script' ? 'Data' : '',
}));

function makeProps(data: Partial<ScriptNodeData> = {}) {
  const fullData: ScriptNodeData = {
    label: 'Script',
    code: 'output.result = input.value;',
    mode: 'transform',
    inputVariables: [],
    outputVariables: [],
    timeoutMs: 5000,
    captureConsole: true,
    ...data,
  };
  return {
    id: 'script-1',
    data: fullData,
    selected: false,
    type: 'script' as const,
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

describe('ScriptNode', () => {
  it('renders with default label', () => {
    const { container } = render(<ScriptNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-script')).toBeTruthy();
    expect(container.textContent).toContain('Script');
  });

  it('renders custom label', () => {
    const { container } = render(<ScriptNode {...makeProps({ label: 'Transform Data' })} />);
    expect(container.textContent).toContain('Transform Data');
  });

  it('renders mode label', () => {
    const { container } = render(<ScriptNode {...makeProps({ mode: 'validate' })} />);
    expect(container.textContent).toContain('Validate');
  });

  it('renders transform mode label', () => {
    const { container } = render(<ScriptNode {...makeProps({ mode: 'transform' })} />);
    expect(container.textContent).toContain('Transform');
  });

  it('renders generate mode label', () => {
    const { container } = render(<ScriptNode {...makeProps({ mode: 'generate' })} />);
    expect(container.textContent).toContain('Generate');
  });

  it('renders code preview', () => {
    const { container } = render(<ScriptNode {...makeProps({ code: 'output.result = input.value;' })} />);
    expect(container.textContent).toContain('output.result = input.value;');
  });

  it('truncates long code preview', () => {
    const longCode = 'output.result = input.value + input.value + input.value + input.value;';
    const { container } = render(<ScriptNode {...makeProps({ code: longCode })} />);
    const preview = container.querySelector('.wf-script-preview');
    expect(preview?.textContent?.length).toBeLessThanOrEqual(41); // 40 chars + potential ellipsis
  });

  it('shows "No code" for empty code', () => {
    const { container } = render(<ScriptNode {...makeProps({ code: '' })} />);
    expect(container.textContent).toContain('No code');
  });

  it('shows "Empty script" when code is only comments', () => {
    const { container } = render(<ScriptNode {...makeProps({ code: '// just a comment' })} />);
    expect(container.textContent).toContain('Empty script');
  });

  it('renders script icon', () => {
    const { getByTestId } = render(<ScriptNode {...makeProps()} />);
    expect(getByTestId('icon-script')).toBeTruthy();
  });

  it('renders target and source handles', () => {
    const { getByTestId } = render(<ScriptNode {...makeProps()} />);
    expect(getByTestId('handle-target')).toBeTruthy();
    expect(getByTestId('handle-source')).toBeTruthy();
  });

  it('applies selected class when selected', () => {
    const { container } = render(<ScriptNode {...makeProps()} selected={true} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('does not apply selected class when not selected', () => {
    const { container } = render(<ScriptNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-selected')).toBeNull();
  });

  it('renders fallback label when label is empty', () => {
    const { container } = render(<ScriptNode {...makeProps({ label: '' })} />);
    expect(container.textContent).toContain('Script');
  });

  it('renders configure button', () => {
    const { container } = render(<ScriptNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-footer')).toBeTruthy();
  });

  it('falls back to raw mode value for unknown modes', () => {
    const { container } = render(<ScriptNode {...makeProps({ mode: 'custom' as never })} />);
    expect(container.textContent).toContain('custom');
  });
});
