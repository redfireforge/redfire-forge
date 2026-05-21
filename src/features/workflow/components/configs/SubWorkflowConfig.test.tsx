/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import SubWorkflowConfig from './SubWorkflowConfig';
import type { SubWorkflowNodeData } from '../../types/workflow';
import type { WorkflowPickerItem } from './SubWorkflowConfig';

function makeData(overrides: Partial<SubWorkflowNodeData> = {}): SubWorkflowNodeData {
  return {
    label: 'Sub-Workflow',
    workflowId: '',
    inputMappings: [],
    outputMappings: [],
    ...overrides,
  };
}

const sampleWorkflows: WorkflowPickerItem[] = [
  { id: 'wf-1', name: 'Auth Flow' },
  { id: 'wf-2', name: 'Checkout Flow' },
  { id: 'wf-3', name: 'Signup Flow' },
];

describe('SubWorkflowConfig', () => {
  it('renders label field with current value', () => {
    render(<SubWorkflowConfig data={makeData()} onChange={vi.fn()} workflows={sampleWorkflows} />);
    expect(screen.getByDisplayValue('Sub-Workflow')).toBeTruthy();
  });

  it('calls onChange when label is edited', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.change(screen.getByDisplayValue('Sub-Workflow'), { target: { value: 'My Step' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'My Step' }));
  });

  it('renders workflow picker with available workflows', () => {
    render(<SubWorkflowConfig data={makeData()} onChange={vi.fn()} workflows={sampleWorkflows} />);
    expect(screen.getByText('Auth Flow')).toBeTruthy();
    expect(screen.getByText('Checkout Flow')).toBeTruthy();
    expect(screen.getByText('Signup Flow')).toBeTruthy();
  });

  it('filters out the current workflow from picker', () => {
    render(
      <SubWorkflowConfig
        data={makeData()}
        onChange={vi.fn()}
        workflows={sampleWorkflows}
        currentWorkflowId="wf-2"
      />,
    );
    expect(screen.getByText('Auth Flow')).toBeTruthy();
    expect(screen.queryByText('Checkout Flow')).toBeNull();
    expect(screen.getByText('Signup Flow')).toBeTruthy();
  });

  it('calls onChange with workflowId and workflowName when workflow is selected', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />);
    const select = screen.getByDisplayValue('— Select workflow —');
    fireEvent.change(select, { target: { value: 'wf-1' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: 'wf-1', workflowName: 'Auth Flow' }),
    );
  });

  it('shows empty state hint when no workflows available', () => {
    render(<SubWorkflowConfig data={makeData()} onChange={vi.fn()} workflows={[]} />);
    expect(screen.getByText(/No other workflows available/)).toBeTruthy();
  });

  it('renders input mapping rows', () => {
    const data = makeData({
      inputMappings: [
        { sourceExpression: '{{userId}}', targetVariable: 'user_id' },
        { sourceExpression: '{{token}}', targetVariable: 'auth_token' },
      ],
    });
    render(<SubWorkflowConfig data={data} onChange={vi.fn()} workflows={sampleWorkflows} />);
    expect(screen.getByDisplayValue('{{userId}}')).toBeTruthy();
    expect(screen.getByDisplayValue('user_id')).toBeTruthy();
    expect(screen.getByDisplayValue('{{token}}')).toBeTruthy();
    expect(screen.getByDisplayValue('auth_token')).toBeTruthy();
  });

  it('adds a new input mapping row', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.click(screen.getByText('+ Add input mapping'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        inputMappings: [{ sourceExpression: '', targetVariable: '' }],
      }),
    );
  });

  it('removes an input mapping row', () => {
    const onChange = vi.fn();
    const data = makeData({
      inputMappings: [{ sourceExpression: '{{x}}', targetVariable: 'y' }],
    });
    render(<SubWorkflowConfig data={data} onChange={onChange} workflows={sampleWorkflows} />);
    const removeButtons = screen.getAllByTitle('Remove mapping');
    fireEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ inputMappings: [] }));
  });

  it('updates an input mapping source expression', () => {
    const onChange = vi.fn();
    const data = makeData({
      inputMappings: [{ sourceExpression: '{{old}}', targetVariable: 'v' }],
    });
    render(<SubWorkflowConfig data={data} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.change(screen.getByDisplayValue('{{old}}'), { target: { value: '{{new}}' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        inputMappings: [{ sourceExpression: '{{new}}', targetVariable: 'v' }],
      }),
    );
  });

  it('updates an input mapping target variable', () => {
    const onChange = vi.fn();
    const data = makeData({
      inputMappings: [{ sourceExpression: '{{x}}', targetVariable: 'old_target' }],
    });
    render(<SubWorkflowConfig data={data} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.change(screen.getByDisplayValue('old_target'), { target: { value: 'new_target' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        inputMappings: [{ sourceExpression: '{{x}}', targetVariable: 'new_target' }],
      }),
    );
  });

  it('updates dynamic workflow id expression', () => {
    const onChange = vi.fn();
    render(
      <SubWorkflowConfig
        data={makeData({ workflowId: '{{wf}}' })}
        onChange={onChange}
        workflows={sampleWorkflows}
      />,
    );
    const input = document.querySelector('.wf-subworkflow-expression-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '{{dynamicWf}}' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: '{{dynamicWf}}', workflowName: '' }),
    );
  });

  it('adds a new output mapping row', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.click(screen.getByText('+ Add output mapping'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        outputMappings: [{ sourceVariable: '', targetVariable: '' }],
      }),
    );
  });

  it('removes an output mapping row', () => {
    const onChange = vi.fn();
    const data = makeData({
      outputMappings: [{ sourceVariable: 'result', targetVariable: 'out' }],
    });
    render(<SubWorkflowConfig data={data} onChange={onChange} workflows={sampleWorkflows} />);
    const removeButtons = screen.getAllByTitle('Remove mapping');
    fireEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ outputMappings: [] }));
  });

  it('updates an output mapping source variable', () => {
    const onChange = vi.fn();
    const data = makeData({
      outputMappings: [{ sourceVariable: 'result', targetVariable: 'out' }],
    });
    render(<SubWorkflowConfig data={data} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.change(screen.getByDisplayValue('result'), { target: { value: 'childResult' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        outputMappings: [{ sourceVariable: 'childResult', targetVariable: 'out' }],
      }),
    );
  });

  it('toggles propagateAllOutputs checkbox', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.click(screen.getByLabelText(/Propagate all outputs/));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ propagateAllOutputs: true }));
  });

  it('renders max depth field with default value', () => {
    render(<SubWorkflowConfig data={makeData()} onChange={vi.fn()} workflows={sampleWorkflows} />);
    expect(screen.getByDisplayValue('10')).toBeTruthy();
  });

  it('calls onChange when max depth is edited', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxDepth: 5 }));
  });

  it('renders timeout field with default value', () => {
    render(<SubWorkflowConfig data={makeData()} onChange={vi.fn()} workflows={sampleWorkflows} />);
    const label = screen.getByText('Timeout (ms)');
    const field = label.closest('.wf-config-field')!;
    const input = field.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('0');
  });

  it('calls onChange when timeout is edited', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />);
    const label = screen.getByText('Timeout (ms)');
    const field = label.closest('.wf-config-field')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 5000 }));
  });

  it('renders "How it works" info section', () => {
    render(<SubWorkflowConfig data={makeData()} onChange={vi.fn()} workflows={sampleWorkflows} />);
    expect(screen.getByText('How it works')).toBeTruthy();
  });

  // ── Retry Policy (E1) ──

  it('renders retry count field with default value 0', () => {
    render(<SubWorkflowConfig data={makeData()} onChange={vi.fn()} workflows={sampleWorkflows} />);
    expect(screen.getByText('Retry Count')).toBeTruthy();
    // Find the input next to the Retry Count label
    const label = screen.getByText('Retry Count');
    const field = label.closest('.wf-config-field')!;
    const input = field.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('0');
  });

  it('calls onChange when retry count is changed', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />);
    const label = screen.getByText('Retry Count');
    const field = label.closest('.wf-config-field')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 3 }));
  });

  it('shows retry delay field only when retryCount > 0', () => {
    const { rerender } = render(
      <SubWorkflowConfig data={makeData({ retryCount: 0 })} onChange={vi.fn()} workflows={sampleWorkflows} />,
    );
    expect(screen.queryByText('Retry Delay (ms)')).toBeFalsy();

    rerender(
      <SubWorkflowConfig data={makeData({ retryCount: 2 })} onChange={vi.fn()} workflows={sampleWorkflows} />,
    );
    expect(screen.getByText('Retry Delay (ms)')).toBeTruthy();
    const label = screen.getByText('Retry Delay (ms)');
    const field = label.closest('.wf-config-field')!;
    const input = field.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('1000');
  });

  it('calls onChange when retry delay is changed', () => {
    const onChange = vi.fn();
    render(
      <SubWorkflowConfig data={makeData({ retryCount: 2 })} onChange={onChange} workflows={sampleWorkflows} />,
    );
    const label = screen.getByText('Retry Delay (ms)');
    const field = label.closest('.wf-config-field')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryDelayMs: 2000 }));
  });

  // ── On-Failure Strategy (E2) ──

  it('renders on-child-failure selector with default "fail"', () => {
    render(<SubWorkflowConfig data={makeData()} onChange={vi.fn()} workflows={sampleWorkflows} />);
    expect(screen.getByDisplayValue('Fail parent node')).toBeTruthy();
  });

  it('calls onChange when on-child-failure is changed to continue', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.change(screen.getByDisplayValue('Fail parent node'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ onChildFailure: 'continue' }));
  });

  it('shows continue option text in the selector', () => {
    render(
      <SubWorkflowConfig data={makeData({ onChildFailure: 'continue' })} onChange={vi.fn()} workflows={sampleWorkflows} />,
    );
    expect(screen.getByText('Continue (set __subWorkflowFailed variable)')).toBeTruthy();
  });

  // ── E5: Dynamic Workflow ID ──

  it('shows expression input when workflowId contains {{', () => {
    const { container } = render(
      <SubWorkflowConfig data={makeData({ workflowId: '{{targetWf}}' })} onChange={vi.fn()} workflows={sampleWorkflows} />,
    );
    const input = container.querySelector('.wf-subworkflow-expression-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('{{targetWf}}');
  });

  it('shows static picker when workflowId does not contain {{', () => {
    render(
      <SubWorkflowConfig data={makeData({ workflowId: 'wf-child' })} onChange={vi.fn()} workflows={sampleWorkflows} />,
    );
    expect(screen.getByText('— Select workflow —')).toBeTruthy();
  });

  it('toggles to expression mode when button clicked', () => {
    const onChange = vi.fn();
    render(
      <SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />,
    );
    fireEvent.click(screen.getByText('⇄ Expression'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ workflowId: '{{}}' }));
  });

  it('toggles to static mode when button clicked in expression mode', () => {
    const onChange = vi.fn();
    render(
      <SubWorkflowConfig data={makeData({ workflowId: '{{targetWf}}' })} onChange={onChange} workflows={sampleWorkflows} />,
    );
    fireEvent.click(screen.getByText('⇄ Static'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ workflowId: '' }));
  });

  // ── E6: Multi-Instance forEach ──

  it('shows multi-instance checkbox unchecked by default', () => {
    render(<SubWorkflowConfig data={makeData()} onChange={vi.fn()} workflows={sampleWorkflows} />);
    expect(screen.getByText('Multi-Instance (forEach)')).toBeTruthy();
  });

  it('enables multi-instance when checkbox checked', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData()} onChange={onChange} workflows={sampleWorkflows} />);
    const checkbox = screen.getByText('Multi-Instance (forEach)').closest('label')!.querySelector('input')!;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      multiInstance: { collection: '', elementVariable: 'item', mode: 'sequential' },
    }));
  });

  it('shows collection and element variable inputs when multi-instance enabled', () => {
    render(
      <SubWorkflowConfig
        data={makeData({ multiInstance: { collection: '{{users}}', elementVariable: 'user', mode: 'sequential' } })}
        onChange={vi.fn()}
        workflows={sampleWorkflows}
      />,
    );
    expect(screen.getByDisplayValue('{{users}}')).toBeTruthy();
    expect(screen.getByDisplayValue('user')).toBeTruthy();
    expect(screen.getByDisplayValue('Sequential')).toBeTruthy();
  });

  it('toggles multi-instance execution mode to parallel', () => {
    const onChange = vi.fn();
    const data = makeData({
      multiInstance: { collection: '{{u}}', elementVariable: 'item', mode: 'sequential' },
    });
    const { container } = render(<SubWorkflowConfig data={data} onChange={onChange} workflows={sampleWorkflows} />);
    const selects = container.querySelectorAll('select');
    const modeSelect = Array.from(selects).find(s => s.value === 'sequential') as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: 'parallel' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        multiInstance: expect.objectContaining({ mode: 'parallel' }),
      }),
    );
  });

  it('updates multiInstance collection expression', () => {
    const onChange = vi.fn();
    const data = makeData({
      multiInstance: { collection: '{{a}}', elementVariable: 'item', mode: 'sequential' },
    });
    render(<SubWorkflowConfig data={data} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.change(screen.getByDisplayValue('{{a}}'), { target: { value: '{{b}}' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        multiInstance: expect.objectContaining({ collection: '{{b}}' }),
      }),
    );
  });

  it('updates multiInstance element variable name', () => {
    const onChange = vi.fn();
    const data = makeData({
      multiInstance: { collection: '{{users}}', elementVariable: 'item', mode: 'sequential' },
    });
    render(<SubWorkflowConfig data={data} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.change(screen.getByDisplayValue('item'), { target: { value: 'user' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        multiInstance: expect.objectContaining({ elementVariable: 'user' }),
      }),
    );
  });

  it('clears multiInstance when checkbox unchecked', () => {
    const onChange = vi.fn();
    const data = makeData({
      multiInstance: { collection: '{{x}}', elementVariable: 'item', mode: 'sequential' },
    });
    render(<SubWorkflowConfig data={data} onChange={onChange} workflows={sampleWorkflows} />);
    const checkbox = screen.getByText('Multi-Instance (forEach)').closest('label')!.querySelector('input')!;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ multiInstance: undefined }));
  });

  it('updates output mapping target variable', () => {
    const onChange = vi.fn();
    const data = makeData({
      outputMappings: [{ sourceVariable: 'a', targetVariable: 'b' }],
    });
    render(<SubWorkflowConfig data={data} onChange={onChange} workflows={sampleWorkflows} />);
    fireEvent.change(screen.getByDisplayValue('b'), { target: { value: 'out' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        outputMappings: [{ sourceVariable: 'a', targetVariable: 'out' }],
      }),
    );
  });

  it('sets empty workflowName when selecting id not in list', () => {
    const onChange = vi.fn();
    render(<SubWorkflowConfig data={makeData({ workflowId: '' })} onChange={onChange} workflows={sampleWorkflows} />);
    const select = screen.getByDisplayValue('— Select workflow —') as HTMLSelectElement;
    const opt = document.createElement('option');
    opt.value = 'missing-id';
    opt.text = 'Ghost';
    select.appendChild(opt);
    fireEvent.change(select, { target: { value: 'missing-id' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: 'missing-id', workflowName: '' }),
    );
  });
});
