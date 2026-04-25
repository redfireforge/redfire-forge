import { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useExpressionHints } from '../../hooks/useExpressionHints';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import ExpressionHintDropdown from './ExpressionHintDropdown';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
  variableHints: WorkflowVariableHint[];
}

/**
 * Text input with inline autocomplete for `{{variable}}` and `{{$function()}}`.
 *
 * - Type `{{` → shows matching variable hints
 * - Type `{{$` → shows matching expression function hints
 * - Arrow keys navigate, Enter/Tab accepts, Escape dismisses
 */
const ExpressionInput = forwardRef<HTMLInputElement, Props>(function ExpressionInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  variableHints,
  ...rest
}, ref) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { hintState, inputRef, onInputChange, onKeyDown, accept, close } = useExpressionHints(variableHints);

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, [inputRef]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    onChange(val);
    onInputChange(val, cursor);
  }, [onChange, onInputChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown(e, value, onChange);
  }, [onKeyDown, value, onChange]);

  const handleSelect = useCallback((item: Parameters<typeof accept>[0]) => {
    accept(item, value, onChange);
  }, [accept, value, onChange]);

  return (
    <div className="expr-input-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          requestAnimationFrame(() => {
            if (document.activeElement === inputRef.current) return;
            close();
          });
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
        style={{ width: '100%' }}
        {...rest}
      />
      <ExpressionHintDropdown
        open={hintState.open}
        items={hintState.items}
        selectedIndex={hintState.selectedIndex}
        onSelect={handleSelect}
        anchorRef={inputRef as React.RefObject<HTMLElement>}
      />
    </div>
  );
});

export default ExpressionInput;
