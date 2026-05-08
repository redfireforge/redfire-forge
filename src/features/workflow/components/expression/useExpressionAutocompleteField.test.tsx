/** @vitest-environment jsdom */
import type { RefObject } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useExpressionAutocompleteField } from './useExpressionAutocompleteField';
import ExpressionHintDropdown from './ExpressionHintDropdown';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

const sampleHints: WorkflowVariableHint[] = [
  { ref: 'myVar', description: 'Var', source: { nodeId: 'n1', nodeLabel: 'Node1' } },
];

function Harness({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const {
    wrapperRef,
    inputRef,
    hintState,
    handleTextChange,
    handleSelect,
    handleBlur,
    onKeyDown,
  } = useExpressionAutocompleteField({ value, onChange, variableHints: sampleHints });

  return (
    <div ref={wrapperRef}>
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        value={value}
        onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart)}
        onKeyDown={(e) => onKeyDown(e, value, onChange)}
        onBlur={handleBlur}
      />
      <ExpressionHintDropdown
        open={hintState.open}
        items={hintState.items}
        selectedIndex={hintState.selectedIndex}
        onSelect={handleSelect}
        anchorRef={inputRef as RefObject<HTMLElement | null>}
      />
    </div>
  );
}

describe('useExpressionAutocompleteField', () => {
  it('handleBlur does not close hints when input is still document.activeElement after rAF', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Harness value="" onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '{{', selectionStart: 2 } });
    rerender(<Harness value="{{" onChange={onChange} />);
    expect(document.querySelector('[role="listbox"]')).toBeTruthy();

    const activeSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(input);

    await act(async () => {
      fireEvent.blur(input);
      await new Promise<void>((r) => {
        requestAnimationFrame(() => r());
      });
    });

    activeSpy.mockRestore();

    expect(document.querySelector('[role="listbox"]')).toBeTruthy();
  });

  it('handleTextChange forwards cursor length when selectionStart is null', () => {
    const onChange = vi.fn();
    render(<Harness value="" onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    Object.defineProperty(input, 'selectionStart', { value: null, writable: true, configurable: true });
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(onChange).toHaveBeenCalledWith('ab');
  });

  it('handleBlur closes hints after rAF when focus truly left the input', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Harness value="" onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '{{', selectionStart: 2 } });
    rerender(<Harness value="{{" onChange={onChange} />);
    expect(document.querySelector('[role="listbox"]')).toBeTruthy();

    await act(async () => {
      fireEvent.blur(input);
      await new Promise<void>((r) => {
        requestAnimationFrame(() => r());
      });
    });
    rerender(<Harness value="{{" onChange={onChange} />);

    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('handleSelect applies a variable hint', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Harness value="" onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '{{', selectionStart: 2 } });
    rerender(<Harness value="{{" onChange={onChange} />);

    const option = document.querySelector('[role="option"]');
    expect(option).toBeTruthy();
    fireEvent.mouseDown(option!);
    expect(onChange).toHaveBeenCalled();
  });
});
