/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import SwitchConfig from './SwitchConfig';
import type { SwitchNodeData } from '../../types/workflow';

function makeData(overrides: Partial<SwitchNodeData> = {}): SwitchNodeData {
  return {
    label: 'Test Switch',
    expression: '{{status}}',
    cases: [],
    ...overrides,
  };
}

describe('SwitchConfig', () => {
  it('renders label and expression inputs', () => {
    const onChange = vi.fn();
    render(<SwitchConfig data={makeData()} onChange={onChange} />);
    expect(screen.getByDisplayValue('Test Switch')).toBeTruthy();
    expect(screen.getByDisplayValue('{{status}}')).toBeTruthy();
  });

  it('calls onChange when label is edited', () => {
    const onChange = vi.fn();
    render(<SwitchConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Test Switch'), { target: { value: 'New Label' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'New Label' }));
  });

  it('calls onChange when expression is edited', () => {
    const onChange = vi.fn();
    render(<SwitchConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{{status}}'), { target: { value: '{{type}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ expression: '{{type}}' }));
  });

  it('adds a case when + Add Case is clicked', () => {
    const onChange = vi.fn();
    render(<SwitchConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Case'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      cases: [expect.objectContaining({ value: '', label: '' })],
    }));
  });

  it('renders existing cases', () => {
    const onChange = vi.fn();
    const data = makeData({ cases: [{ id: 'c1', value: '200', label: 'OK' }] });
    render(<SwitchConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('200')).toBeTruthy();
    expect(screen.getByDisplayValue('OK')).toBeTruthy();
  });

  it('updates case value', () => {
    const onChange = vi.fn();
    const data = makeData({ cases: [{ id: 'c1', value: '200', label: 'OK' }] });
    render(<SwitchConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('200'), { target: { value: '404' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      cases: [expect.objectContaining({ value: '404' })],
    }));
  });

  it('removes a case', () => {
    const onChange = vi.fn();
    const data = makeData({ cases: [{ id: 'c1', value: '200', label: 'OK' }] });
    render(<SwitchConfig data={data} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Remove case'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cases: [] }));
  });

  it('moves case down', () => {
    const onChange = vi.fn();
    const data = makeData({ cases: [{ id: 'c1', value: '200' }, { id: 'c2', value: '404' }] });
    render(<SwitchConfig data={data} onChange={onChange} />);
    const moveDownBtns = screen.getAllByTitle('Move down');
    fireEvent.click(moveDownBtns[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      cases: [expect.objectContaining({ id: 'c2' }), expect.objectContaining({ id: 'c1' })],
    }));
  });

  it('disables move up on first case and move down on last case', () => {
    const onChange = vi.fn();
    const data = makeData({ cases: [{ id: 'c1', value: '200' }] });
    const { container } = render(<SwitchConfig data={data} onChange={onChange} />);
    const moveUp = container.querySelector('button[title="Move up"]') as HTMLButtonElement;
    const moveDown = container.querySelector('button[title="Move down"]') as HTMLButtonElement;
    expect(moveUp.disabled).toBe(true);
    expect(moveDown.disabled).toBe(true);
  });

  it('updates case label', () => {
    const onChange = vi.fn();
    const data = makeData({ cases: [{ id: 'c1', value: '200', label: 'OK' }] });
    render(<SwitchConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('OK'), { target: { value: 'Success' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      cases: [expect.objectContaining({ label: 'Success' })],
    }));
  });

  it('moves case up', () => {
    const onChange = vi.fn();
    const data = makeData({ cases: [{ id: 'c1', value: '200' }, { id: 'c2', value: '404' }] });
    render(<SwitchConfig data={data} onChange={onChange} />);
    const moveUpBtns = screen.getAllByTitle('Move up');
    fireEvent.click(moveUpBtns[1]); // move second item up
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      cases: [expect.objectContaining({ id: 'c2' }), expect.objectContaining({ id: 'c1' })],
    }));
  });

  it('renders hint about default path', () => {
    const onChange = vi.fn();
    render(<SwitchConfig data={makeData()} onChange={onChange} />);
    expect(screen.getByText('If no case matches, the Default path is taken')).toBeTruthy();
  });

  it('handles undefined cases gracefully', () => {
    const onChange = vi.fn();
    const data = { label: 'No Cases', expression: '{{x}}' } as SwitchNodeData;
    const { container } = render(<SwitchConfig data={data} onChange={onChange} />);
    expect(container.querySelectorAll('.wf-switch-case-row').length).toBe(0);
  });
});
