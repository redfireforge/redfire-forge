/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import InlineAssertionRow from './InlineAssertionRow';
import type { Assertion } from '../../types';

function renderRow(overrides: Partial<{
  assertion: Assertion;
  globalIndex: number;
  onUpdate: ((index: number, patch: Partial<Assertion>) => void) | undefined;
  onRemove: ((index: number) => void) | undefined;
}> = {}) {
  const assertion: Assertion = overrides.assertion ?? {
    type: 'arrayLength',
    jsonPath: '$.offers',
    operator: '>=',
    value: 3,
  };
  return render(
    <InlineAssertionRow
      assertion={assertion}
      globalIndex={overrides.globalIndex ?? 0}
      onUpdate={overrides.onUpdate}
      onRemove={overrides.onRemove}
    />,
  );
}

describe('InlineAssertionRow', () => {
  it('renders the type pill with label and icon', () => {
    renderRow();
    expect(screen.getByTitle('length')).toBeInTheDocument();
  });

  it('renders comparison operator select when arrayLength + onUpdate provided', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    const select = screen.getByLabelText('Comparison operator') as HTMLSelectElement;
    expect(select.value).toBe('>=');
  });

  it('changes operator via select dispatches onUpdate', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    const select = screen.getByLabelText('Comparison operator');
    fireEvent.change(select, { target: { value: '<' } });
    expect(onUpdate).toHaveBeenCalledWith(0, { operator: '<' });
  });

  it('renders operator label (non-editable) when arrayLength without onUpdate', () => {
    renderRow();
    expect(screen.getByText('>=')).toBeInTheDocument();
  });

  it('clicking the value span starts editing and pre-fills input', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    fireEvent.click(screen.getByText('>= 3'));
    const input = screen.getByLabelText('Assertion value') as HTMLInputElement;
    expect(input.value).toBe('3');
  });

  it('commits arrayLength value on Enter as a number', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate, globalIndex: 2 });
    fireEvent.click(screen.getByText('>= 3'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith(2, { value: 7 });
  });

  it('ignores non-numeric arrayLength values on commit', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    fireEvent.click(screen.getByText('>= 3'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('Escape cancels edit without dispatching', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    fireEvent.click(screen.getByText('>= 3'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Assertion value')).not.toBeInTheDocument();
  });

  it('commits on blur', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    fireEvent.click(screen.getByText('>= 3'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);
    expect(onUpdate).toHaveBeenCalledWith(0, { value: 9 });
  });

  it('shows remove button and dispatches onRemove on click', () => {
    const onRemove = vi.fn();
    renderRow({ onRemove, globalIndex: 4 });
    fireEvent.click(screen.getByLabelText('Remove assertion'));
    expect(onRemove).toHaveBeenCalledWith(4);
  });

  it('renders NOT badge when assertion is negated', () => {
    renderRow({
      assertion: { type: 'arrayLength', jsonPath: '$.x', operator: '=', value: 1, negate: true },
    });
    expect(screen.getByText('NOT')).toBeInTheDocument();
  });

  it('arrayContains: edits commit string value', () => {
    const onUpdate = vi.fn();
    renderRow({
      onUpdate,
      assertion: { type: 'arrayContains', jsonPath: '$.x', mode: 'any', value: 'foo' },
    });
    fireEvent.click(screen.getByText('any: foo'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: 'bar' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith(0, { value: 'bar' });
  });

  it('each: edits commit value', () => {
    const onUpdate = vi.fn();
    renderRow({
      onUpdate,
      assertion: { type: 'each', jsonPath: '$.x', fieldPath: 'name', operator: 'equals', value: 'a' },
    });
    fireEvent.click(screen.getByText('name equals a'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: 'z' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith(0, { value: 'z' });
  });

  it('each: pre-fills with empty string when value undefined', () => {
    const onUpdate = vi.fn();
    renderRow({
      onUpdate,
      assertion: { type: 'each', jsonPath: '$.x', fieldPath: '', operator: 'is_true' },
    });
    fireEvent.click(screen.getByText('* is_true'));
    const input = screen.getByLabelText('Assertion value') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('containsSubset: edits commit expected', () => {
    const onUpdate = vi.fn();
    renderRow({
      onUpdate,
      assertion: { type: 'containsSubset', jsonPath: '$.x', expected: '{"a":1}' },
    });
    fireEvent.click(screen.getByText('{"a":1}'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: '{"a":2}' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith(0, { expected: '{"a":2}' });
  });

  it('custom: edits commit expression', () => {
    const onUpdate = vi.fn();
    renderRow({
      onUpdate,
      assertion: { type: 'custom', expression: 'x > 0' },
    });
    fireEvent.click(screen.getByText('x > 0'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: 'x > 5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith(0, { expression: 'x > 5' });
  });

  it('clicking value when onUpdate is undefined does not enter edit mode', () => {
    renderRow({ onUpdate: undefined });
    fireEvent.click(screen.getByText('>= 3'));
    expect(screen.queryByLabelText('Assertion value')).not.toBeInTheDocument();
  });

  it('falls back to custom assertion meta when assertion.type is unknown', () => {
    const onUpdate = vi.fn();
    const unknown = { type: 'mystery', someField: 'x' } as unknown as Assertion;
    render(<InlineAssertionRow assertion={unknown} globalIndex={0} onUpdate={onUpdate} />);
    expect(screen.getByTitle('custom')).toBeInTheDocument();
  });

  it('does not dispatch onUpdate when commitEdit is called without handler', () => {
    renderRow({ onUpdate: undefined });
    expect(screen.queryByLabelText('Assertion value')).not.toBeInTheDocument();
  });

  it('clicking the row root invokes its stopPropagation handler (does not bubble to parent onClick)', () => {
    const parentClick = vi.fn();
    const { container } = render(
      <div onClick={parentClick}>
        <InlineAssertionRow
          assertion={{ type: 'arrayLength', jsonPath: '$.x', operator: '=', value: 1 }}
          globalIndex={0}
        />
      </div>,
    );
    fireEvent.click(container.querySelector('.dm-array-assertion-row')!);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('clicking the comparison-operator select invokes its stopPropagation handler', () => {
    const parentClick = vi.fn();
    const onUpdate = vi.fn();
    const { container } = render(
      <div onClick={parentClick}>
        <InlineAssertionRow
          assertion={{ type: 'arrayLength', jsonPath: '$.x', operator: '=', value: 1 }}
          globalIndex={0}
          onUpdate={onUpdate}
        />
      </div>,
    );
    fireEvent.click(container.querySelector('.dm-array-assertion-op-select')!);
    expect(parentClick).not.toHaveBeenCalled();
  });
});
