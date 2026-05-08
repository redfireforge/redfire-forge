/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import ConditionConfig from './ConditionConfig';
import type { ConditionNodeData } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

function makeData(overrides: Partial<ConditionNodeData> = {}): ConditionNodeData {
  return {
    label: 'If/Else',
    left: '{{status}}',
    operator: '==',
    right: '200',
    ...overrides,
  };
}

const defaultHints: WorkflowVariableHint[] = [
  { ref: 'status', label: 'status (latest)' },
  { ref: 'userId', label: 'userId (latest)' },
];

describe('ConditionConfig', () => {
  it('renders label, operator, and right value inputs', () => {
    render(<ConditionConfig data={makeData()} onChange={vi.fn()} variableHints={defaultHints} />);
    expect(screen.getByDisplayValue('If/Else')).toBeTruthy();
    expect(screen.getByDisplayValue('200')).toBeTruthy();
  });

  it('calls onChange when label is edited', () => {
    const onChange = vi.fn();
    render(<ConditionConfig data={makeData()} onChange={onChange} variableHints={defaultHints} />);
    fireEvent.change(screen.getByDisplayValue('If/Else'), { target: { value: 'Check' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Check' }));
  });

  it('calls onChange when operator is changed', () => {
    const onChange = vi.fn();
    render(<ConditionConfig data={makeData()} onChange={onChange} variableHints={defaultHints} />);
    fireEvent.change(screen.getByDisplayValue('== (equals)'), { target: { value: '!=' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ operator: '!=' }));
  });

  it('calls onChange when right value is edited', () => {
    const onChange = vi.fn();
    render(<ConditionConfig data={makeData()} onChange={onChange} variableHints={defaultHints} />);
    fireEvent.change(screen.getByDisplayValue('200'), { target: { value: '404' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ right: '404' }));
  });

  it('starts in pick mode when left is a single variable ref', () => {
    render(<ConditionConfig data={makeData()} onChange={vi.fn()} variableHints={defaultHints} />);
    expect(screen.getByLabelText('Variable for left operand')).toBeTruthy();
  });

  it('starts in expr mode when left is a complex expression', () => {
    const data = makeData({ left: '{{a}} + {{b}}' });
    render(<ConditionConfig data={data} onChange={vi.fn()} variableHints={defaultHints} />);
    expect(screen.getByLabelText('Left operand expression')).toBeTruthy();
  });

  it('switches to expression mode when radio is clicked', () => {
    render(<ConditionConfig data={makeData()} onChange={vi.fn()} variableHints={defaultHints} />);
    fireEvent.click(screen.getByLabelText('Expression'));
    expect(screen.getByLabelText('Left operand expression')).toBeTruthy();
  });

  it('switches back to pick mode from expression mode', () => {
    render(<ConditionConfig data={makeData()} onChange={vi.fn()} variableHints={defaultHints} />);
    fireEvent.click(screen.getByLabelText('Expression'));
    expect(screen.getByLabelText('Left operand expression')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Choose variable'));
    expect(screen.getByLabelText('Variable for left operand')).toBeTruthy();
  });

  it('does not render Insert buttons when onRequestVariableInsert is not provided', () => {
    const data = makeData({ left: '{{a}} + {{b}}' });
    render(<ConditionConfig data={data} onChange={vi.fn()} variableHints={defaultHints} />);
    expect(screen.queryByText('Insert…')).toBeNull();
  });

  it('renders Insert buttons in expression mode when onRequestVariableInsert is provided', () => {
    const data = makeData({ left: '{{a}} + {{b}}' });
    render(<ConditionConfig data={data} onChange={vi.fn()} variableHints={defaultHints} onRequestVariableInsert={vi.fn()} />);
    const buttons = screen.getAllByText('Insert…');
    // One for left expression, one for right value
    expect(buttons.length).toBe(2);
  });

  it('calls onRequestVariableInsert for left operand and applies snippet', () => {
    const onRequest = vi.fn();
    const onChange = vi.fn();
    const data = makeData({ left: 'hello' });
    render(<ConditionConfig data={data} onChange={onChange} variableHints={defaultHints} onRequestVariableInsert={onRequest} />);
    // Switch to expression mode
    fireEvent.click(screen.getByLabelText('Expression'));
    const buttons = screen.getAllByText('Insert…');
    fireEvent.click(buttons[0]); // left operand Insert
    expect(onRequest).toHaveBeenCalledTimes(1);
    const applyFn = onRequest.mock.calls[0][0];
    applyFn('{{status}}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ left: 'hello{{status}}' }));
  });

  it('calls onRequestVariableInsert for right operand and applies snippet', () => {
    const onRequest = vi.fn();
    const onChange = vi.fn();
    const data = makeData({ left: '{{a}} + {{b}}' }); // expr mode by default
    render(<ConditionConfig data={data} onChange={onChange} variableHints={defaultHints} onRequestVariableInsert={onRequest} />);
    const buttons = screen.getAllByText('Insert…');
    fireEvent.click(buttons[1]); // right operand Insert
    expect(onRequest).toHaveBeenCalledTimes(1);
    const applyFn = onRequest.mock.calls[0][0];
    applyFn('{{userId}}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ right: '200{{userId}}' }));
  });

  it('renders variable hints in pick mode dropdown', () => {
    render(<ConditionConfig data={makeData()} onChange={vi.fn()} variableHints={defaultHints} />);
    const combobox = screen.getByLabelText('Variable for left operand');
    fireEvent.focus(combobox);
    // The dropdown should contain items with role="option"
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  it('renders with empty variable hints without crashing', () => {
    const { container } = render(<ConditionConfig data={makeData({ left: '' })} onChange={vi.fn()} variableHints={[]} />);
    // Should render without errors and have operator select even with no hints
    expect(container.querySelector('select')).toBeTruthy();
    expect(screen.getByDisplayValue('== (equals)')).toBeTruthy();
  });

  it('renders Insert button only for right operand in pick mode', () => {
    render(<ConditionConfig data={makeData()} onChange={vi.fn()} variableHints={defaultHints} onRequestVariableInsert={vi.fn()} />);
    // In pick mode, only right operand has Insert
    const buttons = screen.getAllByText('Insert…');
    expect(buttons.length).toBe(1);
  });

  it('selects a variable from the dropdown', () => {
    const onChange = vi.fn();
    render(<ConditionConfig data={makeData()} onChange={onChange} variableHints={defaultHints} />);
    const combobox = screen.getByLabelText('Variable for left operand');
    fireEvent.focus(combobox);
    fireEvent.mouseDown(screen.getByText('userId'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ left: '{{userId}}' }));
  });

  it('selects a variable via keyboard in pick mode', () => {
    const onChange = vi.fn();
    render(<ConditionConfig data={makeData()} onChange={onChange} variableHints={defaultHints} />);
    const combobox = screen.getByLabelText('Variable for left operand');
    fireEvent.focus(combobox);
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ left: '{{userId}}' }));
  });

  it('shows custom input when Custom name is selected', () => {
    const onChange = vi.fn();
    render(<ConditionConfig data={makeData()} onChange={onChange} variableHints={defaultHints} />);
    const combobox = screen.getByLabelText('Variable for left operand');
    fireEvent.focus(combobox);
    fireEvent.mouseDown(screen.getByText('Custom name…'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ left: '' }));
  });

  it('shows custom input for unknown variable ref', () => {
    render(<ConditionConfig data={makeData({ left: '{{unknownVar}}' })} onChange={vi.fn()} variableHints={defaultHints} />);
    // Should show custom input since unknownVar is not in hints
    expect(screen.getByLabelText('Custom variable name or node-scoped ref')).toBeTruthy();
  });

  it('updates custom variable name on input change', () => {
    const onChange = vi.fn();
    render(<ConditionConfig data={makeData({ left: '{{unknownVar}}' })} onChange={onChange} variableHints={defaultHints} />);
    const customInput = screen.getByLabelText('Custom variable name or node-scoped ref');
    fireEvent.change(customInput, { target: { value: 'myVar' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ left: '{{myVar}}' }));
  });

  it('clears left when custom input is emptied', () => {
    const onChange = vi.fn();
    render(<ConditionConfig data={makeData({ left: '{{unknownVar}}' })} onChange={onChange} variableHints={defaultHints} />);
    const customInput = screen.getByLabelText('Custom variable name or node-scoped ref');
    fireEvent.change(customInput, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ left: '' }));
  });

  it('shows validation error for unknown variable refs', () => {
    render(<ConditionConfig data={makeData({ left: '{{unknownVar}}' })} onChange={vi.fn()} variableHints={defaultHints} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Unknown variable/)).toBeTruthy();
  });

  it('uses plural "variables" when multiple unknown refs', () => {
    render(
      <ConditionConfig
        data={makeData({ left: '{{bad1}} + {{bad2}}' })}
        onChange={vi.fn()}
        variableHints={defaultHints}
      />,
    );
    expect(screen.getByText(/Unknown variables/)).toBeTruthy();
  });

  it('shows validation error in expression mode for unknown refs', () => {
    render(<ConditionConfig data={makeData({ left: '{{badRef}} + {{badRef2}}' })} onChange={vi.fn()} variableHints={defaultHints} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('edits expression textarea in expression mode', () => {
    const onChange = vi.fn();
    render(<ConditionConfig data={makeData({ left: '{{a}} + {{b}}' })} onChange={onChange} variableHints={defaultHints} />);
    fireEvent.change(screen.getByLabelText('Left operand expression'), { target: { value: '{{c}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ left: '{{c}}' }));
  });

  it('shows "No names yet" hint when variableHints is empty in pick mode', () => {
    // Use a valid single ref so guessConditionLeftMode returns 'pick'
    render(<ConditionConfig data={makeData({ left: '{{x}}' })} onChange={vi.fn()} variableHints={[]} />);
    expect(screen.getByText(/No names yet/)).toBeTruthy();
  });

  it('strips invalid characters from custom variable name', () => {
    const onChange = vi.fn();
    render(<ConditionConfig data={makeData({ left: '{{unknownVar}}' })} onChange={onChange} variableHints={defaultHints} />);
    const customInput = screen.getByLabelText('Custom variable name or node-scoped ref');
    fireEvent.change(customInput, { target: { value: 'my var!' } });
    // Should strip space and !, keeping 'myvar'
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ left: '{{myvar}}' }));
  });
});
