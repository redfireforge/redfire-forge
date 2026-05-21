/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import SetVariableConfig from './SetVariableConfig';
import type { SetVariableNodeData } from '../../types/workflow';

function makeData(overrides: Partial<SetVariableNodeData> = {}): SetVariableNodeData {
  return {
    label: 'Test SetVar',
    assignments: [],
    ...overrides,
  } as SetVariableNodeData;
}

describe('SetVariableConfig', () => {
  it('renders label input', () => {
    const onChange = vi.fn();
    render(<SetVariableConfig data={makeData()} onChange={onChange} />);
    expect(screen.getByDisplayValue('Test SetVar')).toBeTruthy();
  });

  it('adds assignment when + Add Assignment is clicked', () => {
    const onChange = vi.fn();
    render(<SetVariableConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Assignment'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      assignments: [expect.objectContaining({ name: '', expression: '' })],
    }));
  });

  it('renders existing assignments', () => {
    const onChange = vi.fn();
    const data = makeData({ assignments: [{ id: 'a1', name: 'token', expression: '{{auth_token}}' }] });
    render(<SetVariableConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('token')).toBeTruthy();
    expect(screen.getByDisplayValue('{{auth_token}}')).toBeTruthy();
  });

  it('updates assignment name', () => {
    const onChange = vi.fn();
    const data = makeData({ assignments: [{ id: 'a1', name: 'token', expression: '{{auth_token}}' }] });
    render(<SetVariableConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('token'), { target: { value: 'newToken' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      assignments: [expect.objectContaining({ name: 'newToken' })],
    }));
  });

  it('removes assignment', () => {
    const onChange = vi.fn();
    const data = makeData({ assignments: [{ id: 'a1', name: 'token', expression: '{{auth_token}}' }] });
    render(<SetVariableConfig data={data} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Remove'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assignments: [] }));
  });

  it('moves assignment down', () => {
    const onChange = vi.fn();
    const data = makeData({
      assignments: [
        { id: 'a1', name: 'first', expression: '1' },
        { id: 'a2', name: 'second', expression: '2' },
      ],
    });
    render(<SetVariableConfig data={data} onChange={onChange} />);
    const moveDownBtns = screen.getAllByTitle('Move down');
    fireEvent.click(moveDownBtns[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      assignments: [expect.objectContaining({ id: 'a2' }), expect.objectContaining({ id: 'a1' })],
    }));
  });

  it('disables move buttons at boundaries', () => {
    const onChange = vi.fn();
    const data = makeData({ assignments: [{ id: 'a1', name: 'only', expression: 'val' }] });
    const { container } = render(<SetVariableConfig data={data} onChange={onChange} />);
    const moveUp = container.querySelector('button[title="Move up"]') as HTMLButtonElement;
    const moveDown = container.querySelector('button[title="Move down"]') as HTMLButtonElement;
    expect(moveUp.disabled).toBe(true);
    expect(moveDown.disabled).toBe(true);
  });

  it('updates assignment expression', () => {
    const onChange = vi.fn();
    const data = makeData({ assignments: [{ id: 'a1', name: 'token', expression: '{{auth_token}}' }] });
    render(<SetVariableConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{{auth_token}}'), { target: { value: '{{new_token}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      assignments: [expect.objectContaining({ expression: '{{new_token}}' })],
    }));
  });

  it('moves assignment up', () => {
    const onChange = vi.fn();
    const data = makeData({
      assignments: [
        { id: 'a1', name: 'first', expression: '1' },
        { id: 'a2', name: 'second', expression: '2' },
      ],
    });
    render(<SetVariableConfig data={data} onChange={onChange} />);
    const moveUpBtns = screen.getAllByTitle('Move up');
    fireEvent.click(moveUpBtns[1]); // move second item up
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      assignments: [expect.objectContaining({ id: 'a2' }), expect.objectContaining({ id: 'a1' })],
    }));
  });

  it('updates label', () => {
    const onChange = vi.fn();
    render(<SetVariableConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Test SetVar'), { target: { value: 'New Label' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'New Label' }));
  });

  it('handles undefined assignments gracefully', () => {
    const onChange = vi.fn();
    const data = { label: 'No Assignments' } as SetVariableNodeData;
    const { container } = render(<SetVariableConfig data={data} onChange={onChange} />);
    expect(container.querySelectorAll('.wf-setvar-assignment-row').length).toBe(0);
  });

  it('does not render Insert button when onRequestVariableInsert is not provided', () => {
    const data = makeData({ assignments: [{ id: 'a1', name: 'token', expression: '{{auth_token}}' }] });
    render(<SetVariableConfig data={data} onChange={vi.fn()} />);
    expect(screen.queryByText('Insert…')).toBeNull();
  });

  it('renders Insert button when onRequestVariableInsert is provided', () => {
    const data = makeData({ assignments: [{ id: 'a1', name: 'token', expression: '{{auth_token}}' }] });
    render(<SetVariableConfig data={data} onChange={vi.fn()} onRequestVariableInsert={vi.fn()} />);
    expect(screen.getByText('Insert…')).toBeTruthy();
  });

  it('calls onRequestVariableInsert when Insert button is clicked', () => {
    const onRequest = vi.fn();
    const data = makeData({ assignments: [{ id: 'a1', name: 'token', expression: '{{auth_token}}' }] });
    render(<SetVariableConfig data={data} onChange={vi.fn()} onRequestVariableInsert={onRequest} />);
    fireEvent.click(screen.getByText('Insert…'));
    expect(onRequest).toHaveBeenCalled();
  });

  it('appends inserted snippet to assignment expression via onInsert callback', () => {
    const onRequest = vi.fn();
    const onChange = vi.fn();
    const data = makeData({ assignments: [{ id: 'a1', name: 'token', expression: 'base' }] });
    render(<SetVariableConfig data={data} onChange={onChange} onRequestVariableInsert={onRequest} />);
    fireEvent.click(screen.getByText('Insert…'));
    const applyFn = onRequest.mock.calls[0][0];
    applyFn('{{userId}}');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        assignments: [expect.objectContaining({ expression: 'base{{userId}}' })],
      }),
    );
  });

  it('renders Available Variables section when variableHints are provided', () => {
    const hints = [{ ref: 'status', label: 'status (latest)' }];
    render(<SetVariableConfig data={makeData()} onChange={vi.fn()} variableHints={hints} />);
    expect(screen.getByText(/Available variables/)).toBeTruthy();
  });
});
