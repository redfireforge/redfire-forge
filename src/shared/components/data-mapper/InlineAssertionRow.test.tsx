/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption, getCustomSelectValue } from '../../../test-utils/customSelectHelper';
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
    expect(screen.getByTitle('Array size check')).toBeInTheDocument();
  });

  it('renders comparison operator select when arrayLength + onUpdate provided', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    expect(getCustomSelectValue(screen.getByLabelText('Comparison operator').closest('.cs-wrapper')!)).toBe('>=');
  });

  it('changes operator via select dispatches onUpdate', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    selectOption(screen.getByLabelText('Comparison operator').closest('.cs-wrapper')!, '<');
    expect(onUpdate).toHaveBeenCalledWith(0, { operator: '<' });
  });

  it('renders operator label (non-editable) when arrayLength without onUpdate', () => {
    renderRow();
    expect(screen.getByText('>=')).toBeInTheDocument();
  });

  it('clicking the value span starts editing and pre-fills input', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    fireEvent.click(screen.getByText('3'));
    const input = screen.getByLabelText('Assertion value') as HTMLInputElement;
    expect(input.value).toBe('3');
  });

  it('commits arrayLength value on Enter as a number', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate, globalIndex: 2 });
    fireEvent.click(screen.getByText('3'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith(2, { value: 7 });
  });

  it('ignores non-numeric arrayLength values on commit', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    fireEvent.click(screen.getByText('3'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('Escape cancels edit without dispatching', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    fireEvent.click(screen.getByText('3'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Assertion value')).not.toBeInTheDocument();
  });

  it('commits on blur', () => {
    const onUpdate = vi.fn();
    renderRow({ onUpdate });
    fireEvent.click(screen.getByText('3'));
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

  it('each: edits pre-fill with full summary and commit parses back', () => {
    const onUpdate = vi.fn();
    renderRow({
      onUpdate,
      assertion: { type: 'each', jsonPath: '$.x', fieldPath: 'name', operator: 'equals', value: 'a' },
    });
    // formatAssertionSummary renders: "name = a"
    fireEvent.click(screen.getByText('name = a'));
    const input = screen.getByLabelText('Assertion value') as HTMLInputElement;
    expect(input.value).toBe('name = a');
    // Edit to a new compound value
    fireEvent.change(input, { target: { value: 'score >= 5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith(0, { fieldPath: 'score', operator: 'greater_than_or_equal', value: '5' });
  });

  it('each: pre-fills with full summary when value undefined', () => {
    const onUpdate = vi.fn();
    renderRow({
      onUpdate,
      assertion: { type: 'each', jsonPath: '$.x', fieldPath: '', operator: 'is_true' },
    });
    fireEvent.click(screen.getByText('* is_true'));
    const input = screen.getByLabelText('Assertion value') as HTMLInputElement;
    expect(input.value).toBe('* is_true');
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
    fireEvent.click(screen.getByText('3'));
    expect(screen.queryByLabelText('Assertion value')).not.toBeInTheDocument();
  });

  it('falls back to custom assertion meta when assertion.type is unknown', () => {
    const onUpdate = vi.fn();
    const unknown = { type: 'mystery', someField: 'x' } as unknown as Assertion;
    render(<InlineAssertionRow assertion={unknown} globalIndex={0} onUpdate={onUpdate} />);
    expect(screen.getByTitle('Custom assertion')).toBeInTheDocument();
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

  it('each: falls back to raw value when parseEachInput returns null', () => {
    const onUpdate = vi.fn();
    renderRow({
      onUpdate,
      assertion: { type: 'each', jsonPath: '$.x', fieldPath: 'rank', operator: 'exists' },
    });
    fireEvent.click(screen.getByText('rank exists'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.change(input, { target: { value: 'gibberish' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith(0, { value: 'gibberish' });
  });

  it('clicking the input while editing does not bubble to parent', () => {
    const parentClick = vi.fn();
    const onUpdate = vi.fn();
    render(
      <div onClick={parentClick}>
        <InlineAssertionRow
          assertion={{ type: 'arrayLength', jsonPath: '$.x', operator: '=', value: 5 }}
          globalIndex={0}
          onUpdate={onUpdate}
        />
      </div>,
    );
    fireEvent.click(screen.getByText('5'));
    const input = screen.getByLabelText('Assertion value');
    fireEvent.click(input);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('renders verify badge with pass status', () => {
    renderRow({
      assertion: { type: 'arrayLength', jsonPath: '$.x', operator: '=', value: 3 },
    });
    const { container } = render(
      <InlineAssertionRow
        assertion={{ type: 'arrayLength', jsonPath: '$.x', operator: '=', value: 3 }}
        globalIndex={0}
        verifyResult={{ passed: true }}
      />,
    );
    const badge = container.querySelector('.dm-array-assertion-verify-badge--pass');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('✓');
  });

  it('renders verify badge with fail status including expected/actual', () => {
    const { container } = render(
      <InlineAssertionRow
        assertion={{ type: 'arrayLength', jsonPath: '$.x', operator: '>=', value: 5 }}
        globalIndex={0}
        verifyResult={{ passed: false, expected: '5', actual: '3' }}
      />,
    );
    const badge = container.querySelector('.dm-array-assertion-verify-badge--fail');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('✗');
    expect(badge?.getAttribute('title')).toContain('Expected: 5');
    expect(badge?.getAttribute('title')).toContain('Got: 3');
  });
});
