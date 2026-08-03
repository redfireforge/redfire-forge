/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StartConfig from './StartConfig';
import type { StartNodeData } from '../../types/workflow';

function makeData(overrides: Partial<StartNodeData> = {}): StartNodeData {
  return {
    label: 'Start',
    inputVariables: {},
    ...overrides,
  } as StartNodeData;
}

function Host({
  initial = makeData(),
  workflowVariables = {},
}: {
  initial?: StartNodeData;
  workflowVariables?: Record<string, string>;
}) {
  const [data, setData] = useState(initial);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  return (
    <StartConfig
      data={data}
      onChange={(patch) => setData((prev) => ({ ...prev, ...patch }))}
      newVarKey={newVarKey}
      setNewVarKey={setNewVarKey}
      newVarValue={newVarValue}
      setNewVarValue={setNewVarValue}
      workflowVariables={workflowVariables}
    />
  );
}

describe('StartConfig', () => {
  it('renders with data-testid="start-config" and section cards', () => {
    render(<Host />);
    expect(screen.getByTestId('start-config')).toBeTruthy();
    expect(screen.getByText('Trigger input variables')).toBeTruthy();
    expect(screen.getByText('How trigger variables work')).toBeTruthy();
    expect(screen.getByLabelText('Start node label')).toBeTruthy();
  });

  it('shows empty-state copy when there are no variables', () => {
    render(<Host />);
    expect(screen.getByText('No trigger variables yet')).toBeTruthy();
    expect(screen.getByPlaceholderText('name')).toBeTruthy();
    expect(screen.getByPlaceholderText('value')).toBeTruthy();
    expect(screen.queryByText('Source')).toBeNull();
  });

  it('renders existing variables in the Name / Value grid', () => {
    render(<Host initial={makeData({ inputVariables: { orderId: 'ORD-1' } })} />);
    expect(screen.getByDisplayValue('orderId')).toBeTruthy();
    expect(screen.getByDisplayValue('ORD-1')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Value')).toBeTruthy();
    expect(screen.queryByText('No trigger variables yet')).toBeNull();
  });

  it('adds a trigger input variable', () => {
    const onChange = vi.fn();
    render(
      <StartConfig
        data={makeData()}
        onChange={onChange}
        newVarKey="orderId"
        setNewVarKey={vi.fn()}
        newVarValue="ord-1"
        setNewVarValue={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add variable' }));
    expect(onChange).toHaveBeenCalledWith({ inputVariables: { orderId: 'ord-1' } });
  });

  it('updates the Start label', () => {
    const onChange = vi.fn();
    render(
      <StartConfig
        data={makeData()}
        onChange={onChange}
        newVarKey=""
        setNewVarKey={vi.fn()}
        newVarValue=""
        setNewVarValue={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Start node label'), { target: { value: 'Entry' } });
    expect(onChange).toHaveBeenCalledWith({ label: 'Entry' });
  });

  it('removes a trigger variable', () => {
    const onChange = vi.fn();
    render(
      <StartConfig
        data={makeData({ inputVariables: { a: '1', b: '2' } })}
        onChange={onChange}
        newVarKey=""
        setNewVarKey={vi.fn()}
        newVarValue=""
        setNewVarValue={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove variable a' }));
    expect(onChange).toHaveBeenCalledWith({ inputVariables: { b: '2' } });
  });

  it('lists workflow variable names in the tips card when present', () => {
    render(<Host workflowVariables={{ topic: 'orders', runId: 'r1' }} />);
    expect(screen.getByText(/Workflow Variables also define/)).toBeTruthy();
    expect(screen.getByText('topic')).toBeTruthy();
    expect(screen.getByText('runId')).toBeTruthy();
  });

  it('uses empty object when inputVariables is undefined', () => {
    render(<Host initial={makeData({ inputVariables: undefined })} />);
    expect(screen.getByTestId('start-config')).toBeTruthy();
    expect(screen.getByPlaceholderText('name')).toBeTruthy();
  });

  it('header + Add focuses the name field when the draft name is empty', () => {
    render(<Host />);
    const nameInput = screen.getByLabelText('New variable name');
    fireEvent.click(screen.getByTestId('start-var-add-btn'));
    expect(document.activeElement).toBe(nameInput);
  });

  it('renames a variable key after sanitizing braces and whitespace', () => {
    const onChange = vi.fn();
    render(
      <StartConfig
        data={makeData({ inputVariables: { oldKey: 'v1', keep: 'v2' } })}
        onChange={onChange}
        newVarKey=""
        setNewVarKey={vi.fn()}
        newVarValue=""
        setNewVarValue={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Variable name oldKey'), {
      target: { value: '  {{newKey}}  ' },
    });
    expect(onChange).toHaveBeenCalledWith({ inputVariables: { newKey: 'v1', keep: 'v2' } });
  });

  it('does not rename when the sanitized key is empty or unchanged', () => {
    const onChange = vi.fn();
    render(
      <StartConfig
        data={makeData({ inputVariables: { oldKey: 'v1' } })}
        onChange={onChange}
        newVarKey=""
        setNewVarKey={vi.fn()}
        newVarValue=""
        setNewVarValue={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Variable name oldKey'), {
      target: { value: '  {{oldKey}}  ' },
    });
    fireEvent.change(screen.getByLabelText('Variable name oldKey'), {
      target: { value: '   {}   ' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('updates an existing variable value inline', () => {
    const onChange = vi.fn();
    render(
      <StartConfig
        data={makeData({ inputVariables: { a: '1', b: '2' } })}
        onChange={onChange}
        newVarKey=""
        setNewVarKey={vi.fn()}
        newVarValue=""
        setNewVarValue={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Value for a'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith({ inputVariables: { a: '42', b: '2' } });
  });

  it('adds variable from Enter key on name and value inputs', () => {
    const onChange = vi.fn();
    const setNewVarKey = vi.fn();
    const setNewVarValue = vi.fn();
    render(
      <StartConfig
        data={makeData()}
        onChange={onChange}
        newVarKey="{{runId}}"
        setNewVarKey={setNewVarKey}
        newVarValue="abc"
        setNewVarValue={setNewVarValue}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText('New variable name'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByLabelText('New variable value'), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({ inputVariables: { runId: 'abc' } });
    expect(setNewVarKey).toHaveBeenCalledWith('');
    expect(setNewVarValue).toHaveBeenCalledWith('');
  });

  it('shows ellipsis when workflow variable list is truncated beyond six names', () => {
    render(
      <Host
        workflowVariables={{ a: '1', b: '1', c: '1', d: '1', e: '1', f: '1', g: '1' }}
      />,
    );
    expect(screen.getByText(/Workflow Variables also define/)).toBeTruthy();
    expect(screen.getByText('…', { exact: false })).toBeTruthy();
  });

  it('focuses name input when row add button is clicked with an empty draft name', () => {
    render(<Host />);
    const nameInput = screen.getByLabelText('New variable name');
    fireEvent.click(screen.getByRole('button', { name: 'Add variable' }));
    expect(document.activeElement).toBe(nameInput);
  });

  it('forwards draft input onChange for new variable name and value fields', () => {
    const setNewVarKey = vi.fn();
    const setNewVarValue = vi.fn();
    render(
      <StartConfig
        data={makeData()}
        onChange={vi.fn()}
        newVarKey=""
        setNewVarKey={setNewVarKey}
        newVarValue=""
        setNewVarValue={setNewVarValue}
      />,
    );

    fireEvent.change(screen.getByLabelText('New variable name'), { target: { value: 'region' } });
    fireEvent.change(screen.getByLabelText('New variable value'), { target: { value: 'us-east-1' } });

    expect(setNewVarKey).toHaveBeenCalledWith('region');
    expect(setNewVarValue).toHaveBeenCalledWith('us-east-1');
  });
});
